from scapy.all import IP, TCP, UDP, wrpcap
import random
import time

pkts = []

t = time.time()

def add(pkt, offset):
    pkt.time = t + offset
    pkts.append(pkt)

# Normal traffic: 3 hosts browsing
for i in range(300):
    src = f"192.168.1.{random.randint(10, 12)}"
    add(
        IP(src=src, dst="93.184.216.34")
        / TCP(
            sport=random.randint(40000, 60000),
            dport=443,
            flags="S"
        ),
        i * 0.1
    )

# Port scan: 192.168.1.45 probes 100 ports in about 5s
for i, port in enumerate(range(1, 101)):
    add(
        IP(src="192.168.1.45", dst="192.168.1.100")
        / TCP(
            sport=44444,
            dport=port,
            flags="S"
        ),
        12 + i * 0.05
    )

# Brute force: 10.0.0.23 hits SSH 40 times in about 8s
for i in range(40):
    add(
        IP(src="10.0.0.23", dst="192.168.1.100")
        / TCP(
            sport=50000 + i,
            dport=22,
            flags="S"
        ),
        25 + i * 0.2
    )

pkts.sort(key=lambda p: p.time)

wrpcap("pcaps/sample.pcap", pkts)

print(f"Wrote {len(pkts)} packets")
