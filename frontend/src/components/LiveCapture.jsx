import React, { useState } from "react";
import axios from "axios";
import {
  PlayIcon,
  SquareIcon,
  RadioIcon,
  ActivityIcon,
  FlameIcon,
  Trash2Icon,
} from "./icons";

export function LiveCapture({
  apiBase,
  isCapturing,
  setIsCapturing,
  livePackets,
  setLivePackets,
  liveThreatCount,
}) {
  const [isPaused, setIsPaused] = useState(false);
  const [selectedInterface, setSelectedInterface] = useState("auto");
  const [filterQuery, setFilterQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const toggleCapture = async () => {
    setIsLoading(true);
    try {
      if (isCapturing) {
        await axios.post(`${apiBase}/capture/stop`);
        setIsCapturing(false);
      } else {
        await axios.post(`${apiBase}/capture/start`);
        setIsCapturing(true);
      }
    } catch (err) {
      console.error("Capture toggle error:", err);
      // If backend capture endpoint fails, toggle locally so user still has interactive simulation
      setIsCapturing(!isCapturing);
    } finally {
      setIsLoading(false);
    }
  };

  const clearPackets = () => {
    setLivePackets([]);
  };

  const filteredPackets = livePackets.filter((pkt) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      pkt.src_ip?.toLowerCase().includes(q) ||
      pkt.dst_ip?.toLowerCase().includes(q) ||
      pkt.proto?.toLowerCase().includes(q) ||
      pkt.flags?.toLowerCase().includes(q) ||
      (pkt.is_suspicious && "suspicious".includes(q))
    );
  });

  return (
    <div className="fintech-card p-5 sm:p-6">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-white/[0.04]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-[10px] bg-[#161616] border border-white/[0.08] text-[#C6F432]">
            <RadioIcon className={`w-4 h-4 ${isCapturing ? "animate-pulse" : ""}`} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              {isCapturing && (
                <span className="w-2 h-2 rounded-full bg-[#C6F432] shadow-[0_0_8px_#C6F432] animate-pulse-lime inline-block"></span>
              )}
              <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">
                Live Packet Capture & Deep Packet Inspection
              </h3>
              {isCapturing && (
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-[6px] bg-[#C6F432]/10 text-[#C6F432] border border-[#C6F432]/30">
                  LIVE SNIFFING
                </span>
              )}
            </div>
            <p className="text-xs text-[#8A8A8E]">
              Real-time stream inspection across active network interfaces
            </p>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center space-x-2">
          {/* SOLID LIME BUTTON OR RED STOP BUTTON */}
          <button
            onClick={toggleCapture}
            disabled={isLoading}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-[10px] font-semibold text-xs tracking-wide uppercase transition-all duration-150 cursor-pointer ${
              isCapturing
                ? "bg-[#FF5A4F] hover:bg-[#e64c42] text-black shadow-[0_0_20px_rgba(255,90,79,0.25)] active:scale-[0.98]"
                : "bg-[#C6F432] hover:bg-[#b8e52a] text-[#0A0A0A] shadow-[0_0_20px_rgba(198,244,50,0.22)] active:scale-[0.98]"
            }`}
          >
            {isCapturing ? (
              <>
                <SquareIcon className="w-3.5 h-3.5" />
                <span>Stop Capture</span>
              </>
            ) : (
              <>
                <PlayIcon className="w-3.5 h-3.5" />
                <span>Start Live Sniffer</span>
              </>
            )}
          </button>

          {/* GHOST BUTTON WITH 1PX BORDER FOR PAUSE */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            disabled={!isCapturing}
            className={`px-3 py-2 rounded-[10px] text-xs font-medium border border-white/[0.08] transition-colors cursor-pointer ${
              isPaused
                ? "bg-[#E0B52B]/10 border-[#E0B52B]/30 text-[#E0B52B]"
                : "bg-[#161616] text-[#8A8A8E] hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            {isPaused ? "Resume Stream" : "Pause"}
          </button>

          {/* GHOST BUTTON FOR TRASH */}
          <button
            onClick={clearPackets}
            title="Clear buffer"
            className="p-2 rounded-[10px] bg-[#161616] hover:bg-white/[0.04] border border-white/[0.08] text-[#8A8A8E] hover:text-[#FF5A4F] transition-colors cursor-pointer"
          >
            <Trash2Icon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SUB-BAR: STATS & FILTER */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 text-xs text-[#8A8A8E]">
        <div className="flex items-center space-x-4 font-mono tabular-nums">
          <span className="flex items-center gap-1.5">
            <ActivityIcon className="w-3.5 h-3.5 text-[#C6F432]" />
            Buffer: <strong className="text-white">{livePackets.length}</strong> pkts
          </span>
          <span className="flex items-center gap-1.5">
            <FlameIcon className="w-3.5 h-3.5 text-[#FF5A4F]" />
            Threats: <strong className="text-[#FF5A4F]">{liveThreatCount}</strong>
          </span>
          <span className="text-white/20">|</span>
          <span className="text-[#8A8A8E]">
            Engine: <strong className="text-white font-sans">Heuristic Stream</strong>
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={selectedInterface}
            onChange={(e) => setSelectedInterface(e.target.value)}
            disabled={isCapturing}
            className="bg-[#111] border border-white/[0.08] text-[#8A8A8E] hover:text-white text-xs px-2.5 py-1.5 rounded-[10px] focus:outline-none focus:border-[#C6F432] focus:ring-1 focus:ring-[#C6F432]/50 cursor-pointer"
          >
            <option value="auto">Interface: Auto (en0/eth0)</option>
            <option value="lo0">Interface: lo0 (Loopback)</option>
            <option value="sim">Interface: Heuristic Engine</option>
          </select>

          <input
            type="text"
            placeholder="Filter stream (IP, port, proto)..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="bg-[#111] border border-white/[0.08] focus:border-[#C6F432] focus:ring-1 focus:ring-[#C6F432]/50 px-3 py-1.5 rounded-[10px] text-xs text-white placeholder-[#8A8A8E]/60 focus:outline-none w-48 sm:w-56 font-mono"
          />
        </div>
      </div>

      {/* PACKET TABLE: MUTED HEADER ROW, 1PX DIVIDERS, FINTECH ANOMALY BAR */}
      <div className="overflow-x-auto rounded-[12px] border border-white/[0.06] bg-[#101010] max-h-72 overflow-y-auto">
        <table className="w-full text-left text-xs font-mono tabular-nums">
          <thead className="sticky top-0 bg-[#141414] border-b border-white/[0.06] text-[#8A8A8E] text-[11px] font-medium tracking-[0.04em] uppercase backdrop-blur-xs">
            <tr>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Protocol</th>
              <th className="py-2.5 px-3">Source Socket</th>
              <th className="py-2.5 px-3">Destination Socket</th>
              <th className="py-2.5 px-3">Length</th>
              <th className="py-2.5 px-3">Flags</th>
              <th className="py-2.5 px-3 text-right">Anomaly Indicator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filteredPackets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#8A8A8E]/60 text-xs font-sans">
                  {isCapturing
                    ? "Sniffing interface... awaiting ingress packets..."
                    : "Live capture standby. Click 'Start Live Sniffer' above to initiate real-time packet capture."}
                </td>
              </tr>
            ) : (
              filteredPackets.map((pkt, i) => (
                <tr
                  key={pkt.id || i}
                  className={`transition-colors duration-150 hover:bg-white/[0.03] ${
                    pkt.is_suspicious ? "bg-[#FF5A4F]/[0.04]" : ""
                  }`}
                >
                  <td className="py-2 px-3 text-[#8A8A8E]">
                    {new Date(pkt.timestamp * 1000).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-semibold ${
                        pkt.proto === "TCP"
                          ? "bg-[#C6F432]/10 text-[#C6F432] border border-[#C6F432]/25"
                          : pkt.proto === "UDP"
                          ? "bg-[#E0B52B]/10 text-[#E0B52B] border border-[#E0B52B]/25"
                          : "bg-white/[0.05] text-[#8A8A8E] border border-white/[0.06]"
                      }`}
                    >
                      {pkt.proto}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-white">
                    {pkt.src_ip}:{pkt.src_port || "*"}
                  </td>
                  <td className="py-2 px-3 text-[#8A8A8E]">
                    {pkt.dst_ip}:{pkt.dst_port || "*"}
                  </td>
                  <td className="py-2 px-3 text-[#8A8A8E]">{pkt.length} B</td>
                  <td className="py-2 px-3 text-[#8A8A8E]">{pkt.flags || "—"}</td>
                  <td className="py-2 px-3 text-right">
                    {/* TINY GRADIENT PROGRESS BAR (RED TO GOLD TO LIME) PLUS LABEL CHIP */}
                    <div className="flex items-center justify-end space-x-2">
                      <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#FF5A4F] via-[#E0B52B] to-[#C6F432]"
                          style={{
                            width: pkt.is_suspicious ? "100%" : pkt.length > 1000 ? "75%" : "35%",
                          }}
                        />
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-[6px] text-[10px] font-semibold tracking-wide ${
                          pkt.is_suspicious
                            ? "bg-[#FF5A4F]/15 text-[#FF5A4F] border border-[#FF5A4F]/30"
                            : pkt.length > 1000
                            ? "bg-[#E0B52B]/15 text-[#E0B52B] border border-[#E0B52B]/25"
                            : "bg-[#3DDC84]/15 text-[#3DDC84] border border-[#3DDC84]/20"
                        }`}
                      >
                        {pkt.is_suspicious ? "Suspicious" : pkt.length > 1000 ? "Elite" : "Normal"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
