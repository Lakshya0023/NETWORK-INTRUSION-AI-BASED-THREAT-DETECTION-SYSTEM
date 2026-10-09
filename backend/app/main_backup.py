import os
import shutil

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func

from .db import SessionLocal, Alert, TrafficBucket, init_db
from .parser import parse_pcap
from .detectors import detect_rules


PCAP_DIR = "pcaps"
BUCKET = 5

SEVERITY = {
    "Port Scan": "high",
    "Brute Force": "high",
    "DDoS-like": "high",
    "High Volume": "medium",
    "Anomaly": "medium"
}


app = FastAPI(
    title="NIDS API",
    description="Network Intrusion Detection System",
    version="1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


init_db()
os.makedirs(PCAP_DIR, exist_ok=True)


def analyze_file(path: str, name: str) -> dict:

    # Parse PCAP
    df = parse_pcap(path)

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="No IP packets found in this file"
        )

    # Run existing detectors
    raw_alerts = detect_rules(df)

    # IPs that generated alerts
    bad_ips = {
        a.get("src_ip")
        for a in raw_alerts
        if a.get("src_ip")
    }

    # Convert our parser's column names
    # into the values needed for traffic analysis.
    df["ts"] = df["time"]
    df["src"] = df["src_ip"]

    # Scapy doesn't currently store packet length in our parser,
    # so calculate a packet count safely.
    df["length"] = 1

    df["bucket"] = (
        (df["ts"] // BUCKET) * BUCKET
    ).astype(float)

    df["bad"] = df["src"].isin(bad_ips)

    grouped = df.groupby("bucket").agg(
        packets=("src", "size"),
        bytes=("length", "sum"),
        suspicious=("bad", "sum")
    )

    with SessionLocal() as db:

        # Replace previous analysis of the same file
        db.query(Alert).filter_by(
            source_file=name
        ).delete()

        db.query(TrafficBucket).filter_by(
            source_file=name
        ).delete()

        # Store alerts
        for a in raw_alerts:

            alert_type = a.get(
                "type",
                "Unknown"
            )

            db.add(
                Alert(
                    type=alert_type,
                    severity=(
                        a.get("severity")
                        or SEVERITY.get(
                            alert_type,
                            "medium"
                        )
                    ),
                    src_ip=a.get(
                        "src_ip",
                        ""
                    ),
                    dst_ip=a.get(
                        "dst_ip",
                        ""
                    ),
                    details=(
                        a.get("details")
                        or a.get("detail")
                        or ""
                    ),
                    source_file=name
                )
            )

        # Store traffic
        for ts, row in grouped.iterrows():

            db.add(
                TrafficBucket(
                    ts=float(ts),
                    packets=int(row.packets),
                    bytes=int(row.bytes),
                    suspicious=int(row.suspicious),
                    source_file=name
                )
            )

        db.commit()

    return {
        "file": name,
        "packets": len(df),
        "alerts": len(raw_alerts)
    }


@app.get("/")
def root():
    return {
        "status": "NIDS API running"
    }


@app.get("/pcaps")
def list_pcaps():

    return sorted(
        f
        for f in os.listdir(PCAP_DIR)
        if f.endswith((".pcap", ".pcapng"))
    )


@app.post("/analyze/{filename}")
def analyze(filename: str):

    safe_name = os.path.basename(filename)
    path = os.path.join(
        PCAP_DIR,
        safe_name
    )

    if not os.path.exists(path):
        raise HTTPException(
            status_code=404,
            detail="File not found in pcaps/"
        )

    return analyze_file(
        path,
        safe_name
    )


@app.post("/upload")
async def upload(file: UploadFile = File(...)):

    name = os.path.basename(
        file.filename
    )

    if not name.endswith(
        (".pcap", ".pcapng")
    ):
        raise HTTPException(
            status_code=400,
            detail="Only .pcap / .pcapng files"
        )

    path = os.path.join(
        PCAP_DIR,
        name
    )

    with open(path, "wb") as f:
        shutil.copyfileobj(
            file.file,
            f
        )

    return analyze_file(
        path,
        name
    )


@app.get("/stats")
def stats():

    with SessionLocal() as db:

        packets = db.query(
            func.coalesce(
                func.sum(
                    TrafficBucket.packets
                ),
                0
            )
        ).scalar()

        suspicious = db.query(
            func.coalesce(
                func.sum(
                    TrafficBucket.suspicious
                ),
                0
            )
        ).scalar()

        threats = db.query(
            Alert
        ).count()

        high = db.query(
            Alert
        ).filter_by(
            severity="high"
        ).count()

    risk = (
        "HIGH"
        if high >= 3
        else "MEDIUM"
        if threats > 0
        else "LOW"
    )

    return {
        "packets_analyzed": int(packets),
        "suspicious_packets": int(suspicious),
        "threats_detected": threats,
        "risk_level": risk
    }


@app.get("/alerts")
def alerts(limit: int = 50):

    with SessionLocal() as db:

        rows = (
            db.query(Alert)
            .order_by(Alert.id.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": r.id,
                "type": r.type,
                "severity": r.severity,
                "src_ip": r.src_ip,
                "dst_ip": r.dst_ip,
                "details": r.details,
                "created_at": r.created_at.isoformat()
            }
            for r in rows
        ]


@app.get("/traffic")
def traffic():

    with SessionLocal() as db:

        rows = (
            db.query(TrafficBucket)
            .order_by(TrafficBucket.ts)
            .all()
        )

        return [
            {
                "time": r.ts,
                "packets": r.packets,
                "bytes": r.bytes,
                "suspicious": r.suspicious
            }
            for r in rows
        ]


@app.delete("/reset")
def reset():

    with SessionLocal() as db:

        db.query(Alert).delete()
        db.query(TrafficBucket).delete()

        db.commit()

    return {
        "status": "cleared"
    }
