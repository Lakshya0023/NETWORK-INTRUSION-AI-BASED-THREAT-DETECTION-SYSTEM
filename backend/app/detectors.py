from collections import defaultdict


def detect_rules(df):
    alerts = []

    # -----------------------------
    # Port Scan Detection
    # -----------------------------
    scans = defaultdict(set)

    for _, row in df.iterrows():
        if (
            row["proto"] == "TCP"
            and "S" in row["flags"]
            and "A" not in row["flags"]
        ):
            key = (row["src_ip"], row["dst_ip"])
            scans[key].add(row["dst_port"])

    for (src_ip, dst_ip), ports in scans.items():
        if len(ports) >= 20:
            alerts.append({
                "type": "Port Scan",
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "details": f"{len(ports)} different ports probed"
            })

    # -----------------------------
    # Brute Force Detection
    # -----------------------------
    ssh_attempts = defaultdict(int)

    for _, row in df.iterrows():
        if (
            row["proto"] == "TCP"
            and row["dst_port"] == 22
            and "S" in row["flags"]
        ):
            key = (row["src_ip"], row["dst_ip"])
            ssh_attempts[key] += 1

    for (src_ip, dst_ip), count in ssh_attempts.items():
        if count >= 10:
            alerts.append({
                "type": "Brute Force",
                "src_ip": src_ip,
                "dst_ip": dst_ip,
                "details": f"{count} SSH connection attempts"
            })

    return alerts
