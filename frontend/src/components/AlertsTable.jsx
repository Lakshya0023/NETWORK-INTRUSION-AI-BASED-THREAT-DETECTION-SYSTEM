import React, { useState } from "react";
import {
  FlameIcon,
  SearchIcon,
  EyeIcon,
  CopyIcon,
  CheckCircleIcon,
  TerminalIcon,
  ZapIcon,
} from "./icons";

const MITRE_MAPPINGS = {
  "Port Scan": {
    id: "T1046",
    technique: "Network Service Discovery",
    tactics: "Discovery",
    mitigation: "Deploy iptables/UFW drop rules for origin subnet, configure port knocking, and restrict ingress port ranges.",
  },
  "Brute Force": {
    id: "T1110",
    technique: "Brute Force / Password Guessing",
    tactics: "Credential Access",
    mitigation: "Enforce fail2ban rate limits, disable password-based SSH authentication, and require hardware MFA.",
  },
  "DDoS-like": {
    id: "T1498",
    technique: "Network Denial of Service",
    tactics: "Impact",
    mitigation: "Engage BGP Anycast scrubbing, activate SYN flood syncookies, and apply upstream rate limiting via edge WAF.",
  },
  "Anomaly": {
    id: "T1071",
    technique: "Application Layer Protocol Anomaly",
    tactics: "Command and Control",
    mitigation: "Perform deep packet inspection (DPI), review payload hashes against threat intel feeds, and isolate endpoint.",
  },
  "High Volume": {
    id: "T1049",
    technique: "System Network Connections Discovery",
    tactics: "Discovery / Exfiltration",
    mitigation: "Monitor egress byte volume, inspect TLS SNI headers, and review internal host connection baselines.",
  },
};

export function AlertsTable({ alerts = [] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [copiedText, setCopiedText] = useState(null);

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const highCount = alerts.filter((a) => a.severity?.toLowerCase() === "high").length;
  const medCount = alerts.filter((a) => a.severity?.toLowerCase() === "medium").length;
  const lowCount = alerts.filter((a) => a.severity?.toLowerCase() === "low").length;

  const filteredAlerts = alerts.filter((alert) => {
    const sev = alert.severity?.toLowerCase();
    if (severityFilter === "HIGH" && sev !== "high") return false;
    if (severityFilter === "MEDIUM" && sev !== "medium") return false;
    if (severityFilter === "LOW" && sev !== "low") return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      alert.type?.toLowerCase().includes(q) ||
      alert.src_ip?.toLowerCase().includes(q) ||
      alert.dst_ip?.toLowerCase().includes(q) ||
      alert.details?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fintech-card p-5 sm:p-6">
      {/* HEADER & FILTER BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-white/[0.04]">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-[10px] bg-[#161616] border border-white/[0.08] text-[#FF5A4F]">
              <FlameIcon className="w-4 h-4" />
            </div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">
                Security Incident Feed & SIEM Alerts
              </h3>
              <span className="px-2.5 py-0.5 rounded-[8px] text-[11px] font-mono font-medium bg-[#161616] text-[#8A8A8E] border border-white/[0.06] tabular-nums">
                {alerts.length} Total
              </span>
            </div>
          </div>
          <p className="text-xs text-[#8A8A8E] mt-1">
            Real-time correlation of network rule breaches and heuristics
          </p>
        </div>

        {/* SEVERITY FILTER TABS */}
        <div className="flex items-center space-x-1 p-1 bg-[#111111] rounded-[10px] border border-white/[0.06] text-xs">
          <button
            onClick={() => setSeverityFilter("ALL")}
            className={`px-3 py-1 rounded-[8px] transition-colors cursor-pointer ${
              severityFilter === "ALL"
                ? "bg-white/[0.08] text-white font-medium shadow-xs"
                : "text-[#8A8A8E] hover:text-white"
            }`}
          >
            All ({alerts.length})
          </button>
          <button
            onClick={() => setSeverityFilter("HIGH")}
            className={`px-3 py-1 rounded-[8px] flex items-center space-x-1.5 transition-colors cursor-pointer ${
              severityFilter === "HIGH"
                ? "bg-[#FF5A4F]/15 text-[#FF5A4F] border border-[#FF5A4F]/30 font-semibold"
                : "text-[#8A8A8E] hover:text-[#FF5A4F]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A4F]"></span>
            <span>High ({highCount})</span>
          </button>
          <button
            onClick={() => setSeverityFilter("MEDIUM")}
            className={`px-3 py-1 rounded-[8px] flex items-center space-x-1.5 transition-colors cursor-pointer ${
              severityFilter === "MEDIUM"
                ? "bg-[#E0B52B]/15 text-[#E0B52B] border border-[#E0B52B]/30 font-semibold"
                : "text-[#8A8A8E] hover:text-[#E0B52B]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#E0B52B]"></span>
            <span>Medium ({medCount})</span>
          </button>
          <button
            onClick={() => setSeverityFilter("LOW")}
            className={`px-3 py-1 rounded-[8px] flex items-center space-x-1.5 transition-colors cursor-pointer ${
              severityFilter === "LOW"
                ? "bg-[#3DDC84]/15 text-[#3DDC84] border border-[#3DDC84]/30 font-semibold"
                : "text-[#8A8A8E] hover:text-[#3DDC84]"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#3DDC84]"></span>
            <span>Low ({lowCount})</span>
          </button>
        </div>
      </div>

      {/* SEARCH BAR (10PX RADIUS, LIME FOCUS RING) */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8A8A8E]">
          <SearchIcon className="w-4 h-4" />
        </div>
        <input
          type="text"
          placeholder="Search incident stream by IP address, threat signature, or details..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#111111] border border-white/[0.08] rounded-[10px] pl-9 pr-4 py-2.5 text-xs font-mono text-white placeholder-[#8A8A8E]/60 focus:outline-none focus:border-[#C6F432] focus:ring-1 focus:ring-[#C6F432]/50 transition-all"
        />
      </div>

      {/* ALERTS TABLE */}
      <div className="overflow-x-auto rounded-[12px] border border-white/[0.06] bg-[#101010] max-h-96 overflow-y-auto">
        <table className="w-full text-left text-xs font-mono tabular-nums">
          <thead className="sticky top-0 bg-[#141414] border-b border-white/[0.06] text-[#8A8A8E] text-[11px] font-medium tracking-[0.04em] uppercase backdrop-blur-xs">
            <tr>
              <th className="py-2.5 px-3">Severity</th>
              <th className="py-2.5 px-3">Classification</th>
              <th className="py-2.5 px-3">Source Vector</th>
              <th className="py-2.5 px-3">Target Socket</th>
              <th className="py-2.5 px-3">Findings</th>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3 text-right">Forensics</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[#8A8A8E]/60 text-xs font-sans">
                  {searchQuery || severityFilter !== "ALL"
                    ? "No alerts match the active search and filter criteria."
                    : "No security alerts registered. Clean network state."}
                </td>
              </tr>
            ) : (
              filteredAlerts.map((alert, idx) => {
                const sev = (alert.severity || "medium").toLowerCase();
                const isHigh = sev === "high";
                const isMed = sev === "medium";

                return (
                  <tr
                    key={alert.id || idx}
                    className="transition-colors duration-150 hover:bg-white/[0.03]"
                  >
                    {/* SEVERITY CHIPS (DARK CHARCOAL WITH COLORED MARKER) */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {isHigh ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-semibold tracking-wide bg-[#FF5A4F]/10 text-[#FF5A4F] border border-[#FF5A4F]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5A4F] animate-pulse"></span>
                          High
                        </span>
                      ) : isMed ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-semibold tracking-wide bg-[#E0B52B]/10 text-[#E0B52B] border border-[#E0B52B]/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E0B52B]"></span>
                          Medium
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-semibold tracking-wide bg-[#3DDC84]/10 text-[#3DDC84] border border-[#3DDC84]/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3DDC84]"></span>
                          Low
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap font-sans">
                      {alert.type}
                    </td>

                    <td className="py-2.5 px-3 font-mono font-medium text-[#FF5A4F] whitespace-nowrap">
                      {alert.src_ip || "—"}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[#8A8A8E] whitespace-nowrap">
                      {alert.dst_ip || "Internal"}
                    </td>

                    <td className="py-2.5 px-3 text-[#8A8A8E] max-w-xs truncate font-sans text-xs" title={alert.details}>
                      {alert.details}
                    </td>

                    <td className="py-2.5 px-3 text-[#8A8A8E] whitespace-nowrap text-[11px]">
                      {alert.created_at
                        ? new Date(alert.created_at).toLocaleTimeString()
                        : "Live"}
                    </td>

                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedAlert(alert)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-[8px] bg-[#161616] hover:bg-[#202020] text-[#C6F432] hover:text-[#b8e52a] border border-white/[0.08] hover:border-[#C6F432]/40 transition-colors cursor-pointer text-[11px] font-medium"
                      >
                        <EyeIcon className="w-3 h-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FORENSICS MODAL / DOSSIER */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-white/[0.08] rounded-[18px] max-w-xl w-full p-6 shadow-2xl relative text-xs">
            <button
              onClick={() => setSelectedAlert(null)}
              className="absolute top-4 right-4 text-[#8A8A8E] hover:text-white text-lg cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center space-x-3 mb-4 pb-3 border-b border-white/[0.06]">
              <div
                className={`p-2 rounded-[10px] border ${
                  selectedAlert.severity?.toLowerCase() === "high"
                    ? "bg-[#FF5A4F]/10 text-[#FF5A4F] border-[#FF5A4F]/25"
                    : "bg-[#E0B52B]/10 text-[#E0B52B] border-[#E0B52B]/25"
                }`}
              >
                <TerminalIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white tracking-[-0.01em]">
                  Incident Forensic Dossier #{selectedAlert.id || "LIVE"}
                </h3>
                <p className="text-xs text-[#8A8A8E]">
                  Detailed telemetry, MITRE ATT&CK alignment, and remediation playbook
                </p>
              </div>
            </div>

            <div className="space-y-4 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-[12px] bg-[#101010] border border-white/[0.06]">
                <div>
                  <span className="text-[#8A8A8E] uppercase text-[10px]">Threat Type</span>
                  <p className="font-semibold text-white">{selectedAlert.type}</p>
                </div>
                <div>
                  <span className="text-[#8A8A8E] uppercase text-[10px]">Severity</span>
                  <p
                    className={`font-semibold uppercase ${
                      selectedAlert.severity?.toLowerCase() === "high"
                        ? "text-[#FF5A4F]"
                        : "text-[#E0B52B]"
                    }`}
                  >
                    {selectedAlert.severity}
                  </p>
                </div>
                <div>
                  <span className="text-[#8A8A8E] uppercase text-[10px]">Source Vector</span>
                  <p className="font-semibold text-[#FF5A4F]">{selectedAlert.src_ip || "Unknown"}</p>
                </div>
                <div>
                  <span className="text-[#8A8A8E] uppercase text-[10px]">Target Vector</span>
                  <p className="font-semibold text-white">{selectedAlert.dst_ip || "Broadcast"}</p>
                </div>
              </div>

              <div>
                <span className="text-[#8A8A8E] font-medium block mb-1">Observation Telemetry:</span>
                <p className="p-3 rounded-[12px] bg-[#101010] border border-white/[0.06] text-slate-300 leading-relaxed font-sans text-xs">
                  {selectedAlert.details}
                </p>
              </div>

              {/* MITRE ATT&CK FRAMEWORK MAPPING */}
              {MITRE_MAPPINGS[selectedAlert.type] && (
                <div className="p-3 rounded-[12px] bg-[#111111] border border-white/[0.08]">
                  <div className="flex items-center space-x-2 text-[#E0B52B] font-semibold mb-1.5 font-sans">
                    <ZapIcon className="w-3.5 h-3.5" />
                    <span>
                      MITRE ATT&CK: {MITRE_MAPPINGS[selectedAlert.type].id} —{" "}
                      {MITRE_MAPPINGS[selectedAlert.type].technique}
                    </span>
                  </div>
                  <p className="text-[#8A8A8E] text-[11px] mb-2 font-sans">
                    <strong className="text-white">Tactics:</strong>{" "}
                    {MITRE_MAPPINGS[selectedAlert.type].tactics}
                  </p>
                  <div className="text-slate-300 text-[11px] bg-[#161616] p-2.5 rounded-[8px] border border-white/[0.04] font-sans">
                    <strong className="text-[#C6F432] block mb-0.5">SOC Remediation Playbook:</strong>
                    {MITRE_MAPPINGS[selectedAlert.type].mitigation}
                  </div>
                </div>
              )}

              {/* ACTIONS */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() =>
                    copyToClipboard(
                      JSON.stringify(selectedAlert, null, 2)
                    )
                  }
                  className="flex items-center space-x-1.5 px-3 py-2 rounded-[10px] bg-[#1e1e1e] hover:bg-[#252525] text-white border border-white/[0.06] cursor-pointer"
                >
                  {copiedText ? (
                    <>
                      <CheckCircleIcon className="w-3.5 h-3.5 text-[#3DDC84]" />
                      <span className="text-[#3DDC84]">Copied JSON</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon className="w-3.5 h-3.5 text-[#8A8A8E]" />
                      <span>Copy Incident JSON</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setSelectedAlert(null)}
                  className="px-4 py-2 rounded-[10px] bg-[#C6F432] hover:bg-[#b8e52a] text-[#0A0A0A] font-semibold cursor-pointer"
                >
                  Close Dossier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
