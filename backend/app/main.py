import os
import shutil
import time
import random
import asyncio
from typing import List, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func

from .db import SessionLocal, Alert, TrafficBucket, init_db
from .parser import parse_pcap
from .detectors import detect_rules
from app.anomaly import detect_anomalies


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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


init_db()
os.makedirs(PCAP_DIR, exist_ok=True)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()


def broadcast_event_sync(event_type: str, data: Any):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast({
            "type": event_type,
            "data": data,
            "timestamp": time.time()
        }))
    except RuntimeError:
        pass


class LiveCaptureEngine:
    def __init__(self):
        self.is_running = False
        self.packets_captured = 0
        self.threats_detected = 0
        self.recent_packets: List[Dict[str, Any]] = []
        self.max_buffer = 150
        self._task: asyncio.Task = None

    def start(self):
        if self.is_running:
            return
        self.is_running = True
        try:
            loop = asyncio.get_running_loop()
            self._task = loop.create_task(self._capture_loop())
        except RuntimeError:
            pass

    def stop(self):
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
            self._task = None

    async def _capture_loop(self):
        mock_attack_ips = ["192.168.1.105", "10.0.0.99", "185.220.101.5", "45.142.120.8"]
        internal_ips = ["192.168.1.20", "192.168.1.25", "192.168.1.50", "10.0.0.5"]
        ports = [80, 443, 22, 8080, 53, 3389, 21, 8443, 445]
        protocols = ["TCP", "TCP", "TCP", "UDP", "UDP", "OTHER"]

        step = 0
        while self.is_running:
            step += 1
            await asyncio.sleep(random.uniform(0.3, 0.9))

            # Decide if this packet is suspicious or attack
            is_attack = random.random() < 0.18
            proto = random.choice(protocols)
            src_ip = random.choice(mock_attack_ips if is_attack else internal_ips)
            dst_ip = random.choice(internal_ips if is_attack else mock_attack_ips)
            dst_port = random.choice([22, 3389, 445, 80, 443] if is_attack else ports)
            src_port = random.randint(30000, 65535)
            length = random.randint(54, 1514)
            flags = "S" if (proto == "TCP" and is_attack) else ("PA" if proto == "TCP" else "")

            packet = {
                "id": f"pkt-{self.packets_captured + 1}",
                "timestamp": time.time(),
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "proto": proto,
                "src_port": src_port,
                "dst_port": dst_port,
                "length": length,
                "flags": flags,
                "is_suspicious": is_attack
            }

            self.packets_captured += 1
            self.recent_packets.insert(0, packet)
            if len(self.recent_packets) > self.max_buffer:
                self.recent_packets.pop()

            alert_obj = None
            if is_attack and step % 4 == 0:
                self.threats_detected += 1
                attack_type = random.choice(["Port Scan", "Brute Force", "Anomaly", "High Volume"])
                severity = SEVERITY.get(attack_type, "medium")
                details = (
                    f"Live threat: Probing port {dst_port} from {src_ip}" if attack_type == "Port Scan"
                    else f"Live threat: Rapid auth attempt on port {dst_port}" if attack_type == "Brute Force"
                    else f"Live statistical spike in outbound payloads ({length} bytes)"
                )

                # Persist to database
                with SessionLocal() as db:
                    new_alert = Alert(
                        type=attack_type,
                        severity=severity,
                        src_ip=src_ip,
                        dst_ip=dst_ip,
                        details=details,
                        source_file="live_capture"
                    )
                    db.add(new_alert)
                    db.commit()
                    db.refresh(new_alert)

                    alert_obj = {
                        "id": new_alert.id,
                        "type": new_alert.type,
                        "severity": new_alert.severity,
                        "src_ip": new_alert.src_ip,
                        "dst_ip": new_alert.dst_ip,
                        "details": new_alert.details,
                        "created_at": new_alert.created_at.isoformat()
                    }

            # Broadcast over WebSocket
            await manager.broadcast({
                "type": "LIVE_PACKET",
                "packet": packet,
                "alert": alert_obj,
                "stats": {
                    "packets_captured": self.packets_captured,
                    "threats_detected": self.threats_detected
                }
            })

live_capture_engine = LiveCaptureEngine()



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
    ai_alerts = detect_anomalies(df)
    raw_alerts.extend(ai_alerts)



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

    result = {
        "file": name,
        "packets": len(df),
        "alerts": len(raw_alerts)
    }

    broadcast_event_sync("ANALYSIS_COMPLETE", result)

    return result


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

    live_capture_engine.packets_captured = 0
    live_capture_engine.threats_detected = 0
    live_capture_engine.recent_packets.clear()

    broadcast_event_sync("DATABASE_RESET", {"status": "cleared"})

    return {
        "status": "cleared"
    }


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "message": "NIDS SOC Telemetry Link Online",
            "timestamp": time.time()
        })
        while True:
            text = await websocket.receive_text()
            if text == "ping":
                await websocket.send_json({"type": "pong", "timestamp": time.time()})
    except (WebSocketDisconnect, Exception):
        manager.disconnect(websocket)


@app.post("/capture/start")
def start_capture():
    live_capture_engine.start()
    return {
        "status": "running",
        "is_running": live_capture_engine.is_running,
        "packets_captured": live_capture_engine.packets_captured
    }


@app.post("/capture/stop")
def stop_capture():
    live_capture_engine.stop()
    return {
        "status": "stopped",
        "is_running": live_capture_engine.is_running,
        "packets_captured": live_capture_engine.packets_captured
    }


@app.get("/capture/status")
def capture_status():
    return {
        "is_running": live_capture_engine.is_running,
        "packets_captured": live_capture_engine.packets_captured,
        "threats_detected": live_capture_engine.threats_detected
    }


@app.get("/capture/packets")
def capture_packets():
    return live_capture_engine.recent_packets

