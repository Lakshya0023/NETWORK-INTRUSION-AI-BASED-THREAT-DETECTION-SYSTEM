from scapy.all import rdpcap, IP, TCP, UDP
import pandas as pd


def parse_pcap(path):
    packets = rdpcap(path)

    rows = []

    for pkt in packets:
        if IP not in pkt:
            continue

        src_ip = pkt[IP].src
        dst_ip = pkt[IP].dst

        protocol = "OTHER"
        src_port = None
        dst_port = None
        flags = ""

        if TCP in pkt:
            protocol = "TCP"
            src_port = int(pkt[TCP].sport)
            dst_port = int(pkt[TCP].dport)
            flags = str(pkt[TCP].flags)

        elif UDP in pkt:
            protocol = "UDP"
            src_port = int(pkt[UDP].sport)
            dst_port = int(pkt[UDP].dport)

        rows.append({
            "time": float(pkt.time),
            "src_ip": src_ip,
            "dst_ip": dst_ip,
            "proto": protocol,
            "src_port": src_port,
            "dst_port": dst_port,
            "flags": flags
        })

    return pd.DataFrame(rows)
