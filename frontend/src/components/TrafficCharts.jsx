import React, { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ActivityIcon,
  FlameIcon,
  CopyIcon,
  CheckCircleIcon,
  ShieldAlertIcon,
} from "./icons";

// Segment colors matching the lime, gold, orange gradient
const DONUT_COLORS = ["#C6F432", "#E0B52B", "#E8742A", "#FF5A4F", "#3DDC84"];

function CustomTrafficTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#141414] border border-white/[0.08] rounded-[10px] p-3 shadow-xl backdrop-blur-md text-xs font-mono tabular-nums">
        <p className="text-[#8A8A8E] mb-2 border-b border-white/[0.06] pb-1">
          ⏱ {label ? new Date(label * 1000).toLocaleTimeString() : "Time"}
        </p>
        <div className="space-y-1">
          <p className="text-[#E0B52B] flex items-center justify-between gap-4">
            <span>Packets:</span>
            <strong className="text-white">{payload[0]?.value ?? 0}</strong>
          </p>
          <p className="text-[#8C9C48] flex items-center justify-between gap-4">
            <span>Suspicious:</span>
            <strong className="text-white">{payload[1]?.value ?? 0}</strong>
          </p>
        </div>
      </div>
    );
  }
  return null;
}

function CustomDonutTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-[#141414] border border-white/[0.08] rounded-[10px] p-2.5 shadow-xl text-xs font-mono tabular-nums">
        <div className="flex items-center space-x-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: data.payload.fill || data.color }}
          ></span>
          <span className="text-white font-medium">{data.name}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-4 text-[#8A8A8E]">
          <span>Incidents:</span>
          <strong className="text-white">{data.value}</strong>
        </div>
      </div>
    );
  }
  return null;
}

export function TrafficCharts({ traffic = [], alerts = [] }) {
  const [copiedIp, setCopiedIp] = useState(null);

  // Derive attack vector breakdown for Donut Chart
  const attackBreakdown = useMemo(() => {
    const counts = {};
    alerts.forEach((a) => {
      const type = a.type || "Unknown Threat";
      counts[type] = (counts[type] || 0) + 1;
    });
    const items = Object.entries(counts)
      .map(([name, value], idx) => ({
        name,
        value,
        color: DONUT_COLORS[idx % DONUT_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);

    return items.length > 0
      ? items
      : [{ name: "Baseline", value: 1, color: "#252525" }];
  }, [alerts]);

  const totalThreats = useMemo(() => {
    return alerts.length;
  }, [alerts]);

  // Derive top suspicious IPs
  const topAttackingIps = useMemo(() => {
    const ips = {};
    alerts.forEach((a) => {
      if (a.src_ip) {
        ips[a.src_ip] = (ips[a.src_ip] || 0) + 1;
      }
    });
    return Object.entries(ips)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [alerts]);

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* 9. DUAL-LINE AREA CHART FOR "PACKETS OVER TIME" */}
      <div className="fintech-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-white/[0.04]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-[10px] bg-[#161616] border border-white/[0.08] text-[#E0B52B]">
              <ActivityIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">
                Packets over time
              </h3>
              <p className="text-xs text-[#8A8A8E]">
                5-second aggregated bucket stream (Total Volume vs Threat Traffic)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs font-mono tabular-nums">
            <span className="flex items-center gap-1.5 text-[#E0B52B]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E0B52B]"></span>
              Packets Analyzed
            </span>
            <span className="flex items-center gap-1.5 text-[#8C9C48]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#8C9C48]"></span>
              Suspicious
            </span>
          </div>
        </div>

        <div className="w-full h-72">
          {traffic.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-[#8A8A8E]/60 text-xs font-mono space-y-2">
              <ActivityIcon className="w-7 h-7 text-[#8A8A8E]/30 animate-pulse" />
              <span>No telemetry samples loaded. Upload or analyze a PCAP to populate time-series metrics.</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={traffic} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  {/* GOLD TO TRANSPARENT AREA FILL */}
                  <linearGradient id="goldArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E0B52B" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#E0B52B" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="oliveArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8C9C48" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8C9C48" stopOpacity={0.0} />
                  </linearGradient>
                </defs>

                {/* SUBTLE GRIDLINES */}
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />

                <XAxis
                  dataKey="time"
                  stroke="#333"
                  tick={{ fontSize: 11, fill: "#8A8A8E" }}
                  tickFormatter={(val) => new Date(val * 1000).toLocaleTimeString()}
                />

                {/* RIGHT-SIDE Y-AXIS */}
                <YAxis
                  orientation="right"
                  stroke="#333"
                  tick={{ fontSize: 11, fill: "#8A8A8E" }}
                />

                <Tooltip content={<CustomTrafficTooltip />} />

                {/* GOLD LINE PLUS MUTED OLIVE LINE */}
                <Area
                  type="monotone"
                  dataKey="packets"
                  stroke="#E0B52B"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#goldArea)"
                  name="Packets"
                />

                <Area
                  type="monotone"
                  dataKey="suspicious"
                  stroke="#8C9C48"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#oliveArea)"
                  name="Suspicious"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* DUAL PANELS: 8. DONUT CHART (THREAT DISTRIBUTION) & TOP ORIGIN VECTORS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 8. DONUT CHART: SEGMENTED RING (LIME, GOLD, ORANGE GRADIENT) */}
        <div className="fintech-card p-5 sm:p-6">
          <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-white/[0.04]">
            <div className="p-2 rounded-[10px] bg-[#161616] border border-white/[0.08] text-[#C6F432]">
              <FlameIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">
                Threat Distribution
              </h3>
              <p className="text-xs text-[#8A8A8E]">
                Segmented incident vectors across active rule sets
              </p>
            </div>
          </div>

          <div className="relative h-60 w-full flex items-center justify-center">
            {/* BIG WHITE NUMBER IN THE CENTER */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <span className="text-3xl font-semibold tracking-tight text-white tabular-nums">
                {totalThreats}
              </span>
              <span className="text-[11px] font-medium tracking-[0.04em] uppercase text-[#8A8A8E]">
                Threats
              </span>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attackBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={68}
                  outerRadius={92}
                  stroke="rgba(10,10,10,0.8)"
                  strokeWidth={3}
                  paddingAngle={3}
                >
                  {attackBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomDonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* DONUT LEGEND PILLS */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-white/[0.04] text-xs">
            {attackBreakdown.map((item) => (
              <div
                key={item.name}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-[8px] bg-[#161616] border border-white/[0.06] text-[#8A8A8E]"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                ></span>
                <span className="text-white font-medium">{item.name}</span>
                <span className="text-[#8A8A8E] font-mono tabular-nums">({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* TOP HOSTILE ORIGIN VECTORS */}
        <div className="fintech-card p-5 sm:p-6">
          <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-white/[0.04]">
            <div className="p-2 rounded-[10px] bg-[#161616] border border-white/[0.08] text-[#E8742A]">
              <ShieldAlertIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">
                Top Malicious Origin Vectors
              </h3>
              <p className="text-xs text-[#8A8A8E]">
                High-frequency threat source addresses
              </p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {topAttackingIps.length === 0 ? (
              <div className="py-16 text-center text-[#8A8A8E]/60 text-xs font-mono">
                No hostile IP addresses registered.
              </div>
            ) : (
              topAttackingIps.map((item, idx) => (
                <div
                  key={item.ip}
                  className="flex items-center justify-between p-3 rounded-[12px] bg-[#111111] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-[8px] bg-[#161616] border border-white/[0.06] flex items-center justify-center text-[11px] font-mono font-medium text-[#C6F432]">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="text-xs font-mono font-semibold text-white">
                        {item.ip}
                      </span>
                      <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-[#8A8A8E]">
                        <span>Flagged Incidents:</span>
                        <strong className="text-[#FF5A4F] font-mono tabular-nums">
                          {item.count}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[6px] bg-[#FF5A4F]/10 text-[#FF5A4F] border border-[#FF5A4F]/25">
                      Hostile
                    </span>
                    <button
                      onClick={() => copyToClipboard(item.ip)}
                      title="Copy IP to clipboard"
                      className="p-1.5 rounded-[8px] bg-[#161616] hover:bg-[#202020] border border-white/[0.06] text-[#8A8A8E] hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedIp === item.ip ? (
                        <CheckCircleIcon className="w-3.5 h-3.5 text-[#3DDC84]" />
                      ) : (
                        <CopyIcon className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
