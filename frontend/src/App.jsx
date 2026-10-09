import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { PcapControls } from "./components/PcapControls";
import { LiveCapture } from "./components/LiveCapture";
import { TrafficCharts } from "./components/TrafficCharts";
import { AlertsTable } from "./components/AlertsTable";
import {
  ShieldAlertIcon,
  RefreshCwIcon,
  Volume2Icon,
  VolumeXIcon,
  Trash2Icon,
  ClockIcon,
} from "./components/icons";

const API = "http://127.0.0.1:8000";
const WS_URL = "ws://127.0.0.1:8000/ws/alerts";

// Tiny SVG Sparkline for Fintech Stat Cards
function Sparkline({ color, points, id }) {
  return (
    <svg className="w-16 h-8 overflow-visible" viewBox="0 0 64 32" fill="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={`0,32 ${points} 64,32`} fill={`url(#${id})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [traffic, setTraffic] = useState([]);
  const [recentFile, setRecentFile] = useState("");

  // WebSocket & Live Stream state
  const [wsStatus, setWsStatus] = useState("CONNECTING"); // CONNECTED, POLLING, OFFLINE
  const [isCapturing, setIsCapturing] = useState(false);
  const [livePackets, setLivePackets] = useState([]);
  const [liveThreatCount, setLiveThreatCount] = useState(0);

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5); // seconds
  const [countdown, setCountdown] = useState(5);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Sound state
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Confirmation modal
  const [showResetModal, setShowResetModal] = useState(false);

  // Time state
  const [currentTime, setCurrentTime] = useState(() => new Date());

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);

  // Initialize Web Audio API synthesizer for SOC sound alerts
  const playCyberAlertSound = useCallback((isCritical = false) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isCritical) {
        // High threat two-tone tactical warble
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        // Gentle radar blip
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  }, [soundEnabled]);

  // Load telemetry data from REST
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsManualSyncing(true);
    try {
      const [statsRes, alertsRes, trafficRes] = await Promise.all([
        axios.get(`${API}/stats`).catch(() => null),
        axios.get(`${API}/alerts?limit=100`).catch(() => null),
        axios.get(`${API}/traffic`).catch(() => null),
      ]);

      if (statsRes?.data) setStats(statsRes.data);
      if (alertsRes?.data) setAlerts(alertsRes.data);
      if (trafficRes?.data) setTraffic(trafficRes.data);

      if (isManual) playCyberAlertSound(false);
    } catch (err) {
      console.warn("Telemetry fetch error:", err.message);
    } finally {
      if (isManual) {
        setTimeout(() => setIsManualSyncing(false), 500);
      }
    }
  }, [playCyberAlertSound]);

  // Clock ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // WebSocket Connection Manager
  useEffect(() => {
    let reconnectTimeout;
    const connectWs = () => {
      try {
        const socket = new WebSocket(WS_URL);
        wsRef.current = socket;

        socket.onopen = () => {
          setWsStatus("CONNECTED");
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "LIVE_PACKET") {
              if (data.packet) {
                setLivePackets((prev) => [data.packet, ...prev.slice(0, 99)]);
              }
              if (data.stats) {
                setLiveThreatCount(data.stats.threats_detected || 0);
              }
              if (data.alert) {
                setAlerts((prev) => [data.alert, ...prev]);
                playCyberAlertSound(data.alert.severity?.toLowerCase() === "high");
              }
            } else if (data.type === "ANALYSIS_COMPLETE") {
              loadData();
              playCyberAlertSound(true);
            } else if (data.type === "DATABASE_RESET") {
              setAlerts([]);
              setTraffic([]);
              setLivePackets([]);
              setLiveThreatCount(0);
              loadData();
            }
          } catch (e) {
            console.error("WS message parse error:", e);
          }
        };

        socket.onerror = () => {
          setWsStatus("POLLING");
        };

        socket.onclose = () => {
          setWsStatus("POLLING");
          reconnectTimeout = setTimeout(connectWs, 4000);
        };
      } catch {
        setWsStatus("POLLING");
        reconnectTimeout = setTimeout(connectWs, 4000);
      }
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [loadData, playCyberAlertSound]);

  // Auto-refresh countdown & ticker
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          loadData();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, refreshInterval, loadData]);

  // Reset database handler
  const handleResetDatabase = async () => {
    try {
      await axios.delete(`${API}/reset`);
      setShowResetModal(false);
      setLivePackets([]);
      setLiveThreatCount(0);
      loadData();
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  // DEFCON & Risk Calculations
  const riskLevel = stats?.risk_level || "LOW";
  const defconLevel =
    riskLevel === "HIGH" ? 1 : (stats?.threats_detected ?? 0) > 0 ? 3 : 5;
  const defconLabel =
    defconLevel === 1
      ? "DEFCON 1 // Critical Hostile"
      : defconLevel === 3
      ? "DEFCON 3 // Elevated Incidents"
      : "DEFCON 5 // Normal Monitoring";

  const totalPackets = stats?.packets_analyzed ?? 0;
  const suspiciousPackets = stats?.suspicious_packets ?? 0;
  const threatRate =
    totalPackets > 0 ? ((suspiciousPackets / totalPackets) * 100).toFixed(1) : 0;

  return (
    <div className="min-h-screen text-white p-4 sm:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto selection:bg-[#C6F432] selection:text-black">
      {/* ============================================================== */}
      {/* 1. HEADER CARD: CHARCOAL GLASS CARD, 1PX BORDER                 */}
      {/* ============================================================== */}
      <header className="fintech-card p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* LOGO & TITLE */}
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 rounded-[12px] bg-[#161616] border border-white/[0.08] text-[#C6F432] shadow-inner">
              <ShieldAlertIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-[-0.01em] text-white">
                  NIDS //{" "}
                  <span className="bg-gradient-to-r from-[#C6F432] via-[#E0B52B] to-[#E8742A] bg-clip-text text-transparent font-semibold">
                    SOC Matrix
                  </span>
                </h1>
                <span className="inline-flex px-2.5 py-0.5 rounded-[10px] text-[11px] font-semibold bg-[#C6F432] text-[#0A0A0A] tracking-wide">
                  v2.0 LIVE
                </span>
              </div>
              <p className="text-xs text-[#8A8A8E] mt-0.5 tracking-[-0.01em]">
                Network Intrusion Detection & Threat Intelligence System
              </p>
            </div>
          </div>

          {/* TELEMETRY CONTROLS & PILLS */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* REAL-TIME CLOCK PILL */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-[10px] bg-[#161616] border border-white/[0.06] text-[#8A8A8E]">
              <ClockIcon className="w-3.5 h-3.5 text-[#E0B52B]" />
              <span className="font-mono text-white tabular-nums">
                {currentTime.toLocaleTimeString()}
              </span>
              <span className="text-[10px] text-[#8A8A8E]/70 font-mono">
                UTC{currentTime.getTimezoneOffset() / -60 >= 0 ? "+" : ""}
                {currentTime.getTimezoneOffset() / -60}
              </span>
            </div>

            {/* WEBSOCKET STATUS PILL (DARK PILL WITH PULSING LIME DOT) */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-[10px] bg-[#161616] border border-white/[0.06]">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsStatus === "CONNECTED"
                    ? "bg-[#C6F432] shadow-[0_0_8px_#C6F432] animate-pulse"
                    : wsStatus === "POLLING"
                    ? "bg-[#E0B52B]"
                    : "bg-[#FF5A4F]"
                }`}
              ></span>
              <span className="text-white font-medium text-xs">
                {wsStatus === "CONNECTED"
                  ? "LIVE"
                  : wsStatus === "POLLING"
                  ? "Auto-Poll"
                  : "Offline"}
              </span>
            </div>

            {/* AUTO-SYNC PILL */}
            <div className="flex items-center bg-[#161616] border border-white/[0.06] rounded-[10px] p-0.5">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-2.5 py-1 rounded-[8px] text-xs font-medium transition-colors cursor-pointer ${
                  autoRefresh
                    ? "bg-white/[0.08] text-white"
                    : "text-[#8A8A8E] hover:text-white"
                }`}
              >
                Auto-Sync: {autoRefresh ? `ON (${countdown}s)` : "Paused"}
              </button>

              <select
                value={refreshInterval}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setRefreshInterval(val);
                  setCountdown(val);
                }}
                className="bg-transparent text-[#8A8A8E] hover:text-white text-xs px-2 py-1 focus:outline-none cursor-pointer border-l border-white/[0.06]"
              >
                <option value={2} className="bg-[#161616] text-white">2s Hyper</option>
                <option value={5} className="bg-[#161616] text-white">5s Fast</option>
                <option value={10} className="bg-[#161616] text-white">10s Normal</option>
                <option value={30} className="bg-[#161616] text-white">30s Slow</option>
              </select>
            </div>

            {/* MANUAL REFRESH PILL */}
            <button
              onClick={() => loadData(true)}
              disabled={isManualSyncing}
              title="Manual Telemetry Sync"
              className="p-2 rounded-[10px] bg-[#161616] border border-white/[0.06] text-[#8A8A8E] hover:text-[#C6F432] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <RefreshCwIcon className={`w-3.5 h-3.5 ${isManualSyncing ? "animate-spin text-[#C6F432]" : ""}`} />
            </button>

            {/* AUDIO TOGGLE PILL */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                playCyberAlertSound(false);
              }}
              title={soundEnabled ? "Audio Alert Active" : "Audio Muted"}
              className={`p-2 rounded-[10px] bg-[#161616] border border-white/[0.06] transition-colors cursor-pointer ${
                soundEnabled
                  ? "text-[#C6F432]"
                  : "text-[#8A8A8E] hover:text-white"
              }`}
            >
              {soundEnabled ? <Volume2Icon className="w-3.5 h-3.5" /> : <VolumeXIcon className="w-3.5 h-3.5" />}
            </button>

            {/* PURGE BUTTON */}
            <button
              onClick={() => setShowResetModal(true)}
              title="Clear Alert & Traffic DB"
              className="p-2 rounded-[10px] bg-[#161616] border border-white/[0.06] text-[#8A8A8E] hover:text-[#FF5A4F] hover:bg-[#FF5A4F]/10 transition-colors cursor-pointer"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. SECURITY POSTURE BANNER: DARK AMBER GLASS                   */}
      {/* ============================================================== */}
      <div className="bg-[rgba(224,181,43,0.08)] border border-[#E0B52B]/25 rounded-[14px] px-4 py-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#E0B52B] shadow-[0_0_20px_rgba(224,181,43,0.05)]">
        <div className="flex items-center space-x-2.5">
          <span className="w-2 h-2 rounded-full bg-[#E0B52B] shadow-[0_0_8px_#E0B52B] animate-pulse"></span>
          <span className="font-medium tracking-[-0.01em]">Security Posture: {defconLabel}</span>
        </div>

        <div className="flex items-center space-x-4 text-[11px] text-[#E0B52B]/80 font-mono tabular-nums">
          <span>Contagion: <strong className="text-[#E0B52B]">{threatRate}%</strong></span>
          <span className="text-[#E0B52B]/30">|</span>
          <span>Rules Correlated: <strong className="text-[#E0B52B]">{alerts.length}</strong></span>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. FOUR STAT CARDS: CHARCOAL CARDS WITH 3PX COLORED MARKER     */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: PACKETS (LIME MARKER) */}
        <div className="fintech-card p-5 relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C6F432] rounded-l-[18px]"></div>
          
          <div className="flex items-start justify-between mb-2 pl-2">
            <div>
              <span className="text-[11px] font-medium tracking-[0.04em] uppercase text-[#8A8A8E]">
                Packets Ingested
              </span>
            </div>
            <Sparkline
              color="#C6F432"
              points="0,26 12,22 24,24 36,14 48,16 64,6"
              id="spark-packets"
            />
          </div>

          <div className="pl-2">
            <p className="text-[44px] leading-tight font-semibold tracking-[-0.03em] text-white tabular-nums">
              {totalPackets.toLocaleString()}
            </p>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3DDC84] bg-[#3DDC84]/10 px-2 py-0.5 rounded-[6px]">
                ▲ 31.8%
              </span>
              <span className="text-[11px] text-[#8A8A8E] font-medium">Network baseline</span>
            </div>
          </div>
        </div>

        {/* CARD 2: SUSPICIOUS PACKETS (GOLD MARKER) */}
        <div className="fintech-card p-5 relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#E0B52B] rounded-l-[18px]"></div>

          <div className="flex items-start justify-between mb-2 pl-2">
            <div>
              <span className="text-[11px] font-medium tracking-[0.04em] uppercase text-[#8A8A8E]">
                Suspicious Packets
              </span>
            </div>
            <Sparkline
              color="#E0B52B"
              points="0,28 14,26 26,18 38,20 50,12 64,10"
              id="spark-suspicious"
            />
          </div>

          <div className="pl-2">
            <p className="text-[44px] leading-tight font-semibold tracking-[-0.03em] text-white tabular-nums">
              {suspiciousPackets.toLocaleString()}
            </p>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E0B52B] bg-[#E0B52B]/10 px-2 py-0.5 rounded-[6px]">
                {threatRate}% ratio
              </span>
              <span className="text-[11px] text-[#8A8A8E] font-medium">Anomaly throughput</span>
            </div>
          </div>
        </div>

        {/* CARD 3: THREATS DETECTED (RED MARKER) */}
        <div className="fintech-card p-5 relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#FF5A4F] rounded-l-[18px]"></div>

          <div className="flex items-start justify-between mb-2 pl-2">
            <div>
              <span className="text-[11px] font-medium tracking-[0.04em] uppercase text-[#8A8A8E]">
                Confirmed Threats
              </span>
            </div>
            <Sparkline
              color="#FF5A4F"
              points="0,30 16,28 28,14 40,24 52,10 64,8"
              id="spark-threats"
            />
          </div>

          <div className="pl-2">
            <p className="text-[44px] leading-tight font-semibold tracking-[-0.03em] text-white tabular-nums">
              {(stats?.threats_detected ?? 0).toLocaleString()}
            </p>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
              <div className="flex items-center space-x-1.5">
                <span className="px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold bg-[#FF5A4F]/15 text-[#FF5A4F]">
                  {alerts.filter((a) => a.severity?.toLowerCase() === "high").length} High
                </span>
                <span className="px-1.5 py-0.5 rounded-[5px] text-[10px] font-semibold bg-[#E0B52B]/15 text-[#E0B52B]">
                  {alerts.filter((a) => a.severity?.toLowerCase() === "medium").length} Med
                </span>
              </div>
              <span className="text-[11px] text-[#8A8A8E] font-medium">Rule triggers</span>
            </div>
          </div>
        </div>

        {/* CARD 4: RISK LEVEL (ORANGE MARKER) */}
        <div className="fintech-card p-5 relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#E8742A] rounded-l-[18px]"></div>

          <div className="flex items-start justify-between mb-2 pl-2">
            <div>
              <span className="text-[11px] font-medium tracking-[0.04em] uppercase text-[#8A8A8E]">
                Dynamic Risk Level
              </span>
            </div>
            <Sparkline
              color="#E8742A"
              points="0,24 16,20 30,22 42,12 54,14 64,8"
              id="spark-risk"
            />
          </div>

          <div className="pl-2">
            <p className="text-[44px] leading-tight font-semibold tracking-[-0.03em] text-white tabular-nums">
              {riskLevel}
            </p>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.04]">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#8A8A8E]">
                <span
                  className={`w-2 h-2 rounded-full ${
                    riskLevel === "HIGH"
                      ? "bg-[#FF5A4F]"
                      : riskLevel === "MEDIUM"
                      ? "bg-[#E0B52B]"
                      : "bg-[#3DDC84]"
                  }`}
                ></span>
                Neural evaluation
              </span>
              <span className="text-[11px] text-[#3DDC84] font-semibold">Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 4. PCAP INGESTION & FORENSIC ENGINE                            */}
      {/* ============================================================== */}
      <PcapControls
        apiBase={API}
        onDataRefresh={() => loadData(false)}
        recentFile={recentFile}
        setRecentFile={setRecentFile}
      />

      {/* ============================================================== */}
      {/* 5. LIVE PACKET CAPTURE STATION                                 */}
      {/* ============================================================== */}
      <LiveCapture
        apiBase={API}
        isCapturing={isCapturing}
        setIsCapturing={setIsCapturing}
        livePackets={livePackets}
        setLivePackets={setLivePackets}
        liveThreatCount={liveThreatCount}
      />

      {/* ============================================================== */}
      {/* 6. TRAFFIC CHARTS & THREAT DONUT VISUALIZATION                  */}
      {/* ============================================================== */}
      <TrafficCharts traffic={traffic} alerts={alerts} />

      {/* ============================================================== */}
      {/* 7. ALERTS TABLE & FORENSIC DOSSIER                             */}
      {/* ============================================================== */}
      <AlertsTable alerts={alerts} />

      {/* ============================================================== */}
      {/* 8. RESET CONFIRMATION MODAL                                    */}
      {/* ============================================================== */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-white/[0.08] rounded-[18px] max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 text-[#FF5A4F] mb-3">
              <Trash2Icon className="w-5 h-5" />
              <h3 className="text-base font-semibold text-white tracking-[-0.01em]">
                Purge Database Records?
              </h3>
            </div>
            <p className="text-xs text-[#8A8A8E] mb-6 leading-relaxed">
              This action will purge all registered alerts and traffic buckets from SQLite storage (<code className="text-white font-mono">nids.db</code>). Live packet buffers will be cleared.
            </p>
            <div className="flex items-center justify-end space-x-2.5 text-xs">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-[10px] bg-[#1e1e1e] hover:bg-[#252525] text-[#8A8A8E] hover:text-white border border-white/[0.06] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDatabase}
                className="px-4 py-2 rounded-[10px] bg-[#FF5A4F] hover:bg-[#e64c42] text-black font-semibold tracking-wide cursor-pointer shadow-lg shadow-[#FF5A4F]/20"
              >
                Confirm Purge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="text-center text-[11px] text-[#8A8A8E]/60 py-6 border-t border-white/[0.04]">
        NIDS Security Operations Center // Real-time Telemetry & Neural Packet Heuristics
      </footer>
    </div>
  );
}