from sklearn.ensemble import IsolationForest
import pandas as pd


def detect_anomalies(df):
    if df.empty:
        return []

    # Create one feature row for each source IP
    features = []

    for src_ip, group in df.groupby("src_ip"):
        features.append({
            "src_ip": src_ip,
            "packets": len(group),
            "unique_destinations": group["dst_ip"].nunique(),
            "unique_ports": group["dst_port"].nunique(),
            "tcp_packets": (group["proto"] == "TCP").sum(),
            "udp_packets": (group["proto"] == "UDP").sum(),
        })

    feature_df = pd.DataFrame(features)

    # Isolation Forest needs multiple samples
    if len(feature_df) < 3:
        return []

    columns = [
        "packets",
        "unique_destinations",
        "unique_ports",
        "tcp_packets",
        "udp_packets"
    ]

    model = IsolationForest(
        n_estimators=100,
        contamination="auto",
        random_state=42
    )

    model.fit(feature_df[columns])

    feature_df["prediction"] = model.predict(
        feature_df[columns]
    )

    anomalies = feature_df[
        feature_df["prediction"] == -1
    ]

    alerts = []

    for _, row in anomalies.iterrows():
        alerts.append({
            "type": "Anomaly",
            "src_ip": row["src_ip"],
            "dst_ip": "Multiple",
            "details": (
                f"AI detected unusual behavior: "
                f"{int(row['packets'])} packets, "
                f"{int(row['unique_ports'])} unique ports, "
                f"{int(row['unique_destinations'])} destinations"
            )
        })

    return alerts
