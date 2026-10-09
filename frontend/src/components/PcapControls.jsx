import React, { useState, useRef, useEffect, useCallback } from "react";
import axios from "axios";
import {
  UploadCloudIcon,
  RefreshCwIcon,
  FileTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ZapIcon,
  ServerIcon,
} from "./icons";

export function PcapControls({ apiBase, onDataRefresh, recentFile, setRecentFile }) {
  const [pcapsList, setPcapsList] = useState([]);
  const [selectedPcap, setSelectedPcap] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);

  const fetchPcaps = useCallback(async () => {
    try {
      const res = await axios.get(`${apiBase}/pcaps`);
      if (Array.isArray(res.data)) {
        setPcapsList(res.data);
        if (res.data.length > 0 && !selectedPcap) {
          setSelectedPcap(res.data[0]);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch pcaps:", err.message);
    }
  }, [apiBase, selectedPcap]);

  useEffect(() => {
    fetchPcaps();
  }, [fetchPcaps]);

  const handleFileUpload = async (file) => {
    if (!file) return;

    if (!file.name.endsWith(".pcap") && !file.name.endsWith(".pcapng")) {
      setUploadFeedback({
        type: "error",
        message: "Invalid file format. Please upload a .pcap or .pcapng file.",
      });
      return;
    }

    setIsUploading(true);
    setUploadFeedback({ type: "info", message: `Uploading & parsing ${file.name}...` });

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${apiBase}/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setUploadFeedback({
        type: "success",
        message: `Successfully analyzed ${res.data.file || file.name} (${res.data.packets} packets, ${res.data.alerts} alerts detected)`,
      });
      setRecentFile(file.name);
      await fetchPcaps();
      setSelectedPcap(file.name);
      if (onDataRefresh) onDataRefresh();
    } catch (err) {
      setUploadFeedback({
        type: "error",
        message: err.response?.data?.detail || "Upload & analysis failed. Check file integrity.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAnalyzeSelected = async () => {
    if (!selectedPcap) return;
    setIsAnalyzing(true);
    setUploadFeedback({ type: "info", message: `Deep scanning PCAP: ${selectedPcap}...` });

    try {
      const res = await axios.post(`${apiBase}/analyze/${encodeURIComponent(selectedPcap)}`);
      setUploadFeedback({
        type: "success",
        message: `Analysis of ${selectedPcap} complete: ${res.data.packets} packets, ${res.data.alerts} threats flagged`,
      });
      setRecentFile(selectedPcap);
      if (onDataRefresh) onDataRefresh();
    } catch (err) {
      setUploadFeedback({
        type: "error",
        message: err.response?.data?.detail || "PCAP analysis failed.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fintech-card p-5 sm:p-6">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.04]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-[10px] bg-[#161616] border border-white/[0.08] text-[#C6F432]">
            <ServerIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-white">
              PCAP Ingestion & Forensic Engine
            </h3>
            <p className="text-xs text-[#8A8A8E]">
              Upload raw packet captures or inspect files from storage
            </p>
          </div>
        </div>
        {recentFile && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-[10px] bg-[#161616] text-[#C6F432] border border-white/[0.06]">
            <FileTextIcon className="w-3.5 h-3.5" />
            Active: {recentFile}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* DRAG AND DROP DROPZONE WITH LIME DASHED BORDER AT 30% OPACITY */}
        <div className="lg:col-span-7">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer group relative flex flex-col items-center justify-center p-6 rounded-[14px] border-2 border-dashed transition-all duration-200 ${
              dragActive
                ? "border-[#C6F432] bg-[#C6F432]/[0.08] shadow-[0_0_25px_rgba(198,244,50,0.18)]"
                : "border-[#C6F432]/30 hover:border-[#C6F432] bg-[#111111]/70 hover:bg-[#111111] hover:shadow-[0_0_20px_rgba(198,244,50,0.12)]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pcap,.pcapng"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
            />

            <div className="p-3 rounded-full bg-[#181818] text-[#C6F432] group-hover:scale-105 transition-all mb-2 shadow-inner">
              <UploadCloudIcon className="w-6 h-6" />
            </div>

            <div className="text-center">
              <p className="text-sm font-medium text-white group-hover:text-[#C6F432] transition-colors">
                {isUploading ? "Uploading & Analyzing PCAP..." : "Upload PCAP to Dashboard"}
              </p>
              <p className="text-xs text-[#8A8A8E] mt-1">
                Drag & drop or click to browse (.pcap, .pcapng supported)
              </p>
            </div>

            {isUploading && (
              <div className="absolute inset-0 bg-black/80 rounded-[14px] flex items-center justify-center backdrop-blur-xs">
                <div className="flex items-center space-x-2 text-[#C6F432] text-xs font-medium">
                  <RefreshCwIcon className="w-4 h-4 animate-spin" />
                  <span>Parsing Network Packets & Running Detectors...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SELECT & SOLID LIME ANALYZE BUTTON */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-3 bg-[#111111] p-4 sm:p-5 rounded-[14px] border border-white/[0.06]">
          <div>
            <label className="block text-[11px] font-medium text-[#8A8A8E] tracking-[0.04em] uppercase mb-1.5">
              Available PCAP Repository
            </label>
            <div className="relative">
              <select
                value={selectedPcap}
                onChange={(e) => setSelectedPcap(e.target.value)}
                disabled={isAnalyzing || isUploading || pcapsList.length === 0}
                className="w-full bg-[#111111] border border-white/[0.08] rounded-[10px] px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#C6F432] focus:ring-1 focus:ring-[#C6F432]/50 disabled:opacity-50 appearance-none pr-8 cursor-pointer"
              >
                {pcapsList.length === 0 ? (
                  <option value="">No PCAP files found in storage</option>
                ) : (
                  pcapsList.map((filename) => (
                    <option key={filename} value={filename}>
                      {filename}
                    </option>
                  ))
                )}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-[#8A8A8E]">
                <FileTextIcon className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 pt-1">
            {/* SOLID LIME BUTTON WITH BLACK TEXT AND SOFT LIME GLOW */}
            <button
              onClick={handleAnalyzeSelected}
              disabled={isAnalyzing || !selectedPcap}
              className="flex-1 inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-[10px] font-semibold text-xs tracking-wide uppercase transition-all duration-150 bg-[#C6F432] hover:bg-[#b8e52a] text-[#0A0A0A] shadow-[0_0_20px_rgba(198,244,50,0.22)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <RefreshCwIcon className={`w-3.5 h-3.5 ${isAnalyzing ? "animate-spin" : ""}`} />
              <span>{isAnalyzing ? "Analyzing..." : "Analyze PCAP"}</span>
            </button>

            <button
              onClick={fetchPcaps}
              title="Refresh PCAP list"
              className="p-2.5 rounded-[10px] bg-[#161616] hover:bg-[#202020] border border-white/[0.08] text-[#8A8A8E] hover:text-white transition-colors cursor-pointer"
            >
              <RefreshCwIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* FEEDBACK STATUS BANNER */}
      {uploadFeedback && (
        <div
          className={`mt-4 px-3.5 py-2.5 rounded-[10px] text-xs font-mono flex items-center justify-between border ${
            uploadFeedback.type === "success"
              ? "bg-[#3DDC84]/10 border-[#3DDC84]/25 text-[#3DDC84]"
              : uploadFeedback.type === "error"
              ? "bg-[#FF5A4F]/10 border-[#FF5A4F]/25 text-[#FF5A4F]"
              : "bg-[#E0B52B]/10 border-[#E0B52B]/25 text-[#E0B52B]"
          }`}
        >
          <div className="flex items-center space-x-2">
            {uploadFeedback.type === "success" && <CheckCircleIcon className="w-4 h-4 shrink-0" />}
            {uploadFeedback.type === "error" && <XCircleIcon className="w-4 h-4 shrink-0" />}
            {uploadFeedback.type === "info" && <ZapIcon className="w-4 h-4 shrink-0 animate-pulse" />}
            <span>{uploadFeedback.message}</span>
          </div>
          <button
            onClick={() => setUploadFeedback(null)}
            className="text-[#8A8A8E] hover:text-white ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
