"use client";

import React, { useState, useEffect } from "react";
import { Clock, RefreshCw, AlertTriangle, CheckCircle, Wifi, Save, X, Settings } from "lucide-react";
import {
  fetchInternetTime,
  getSyncedDate,
  getSyncedDateString,
  getTimeOffsetMs,
  getSyncSource,
  setManualTimeOffset,
  getIsInternetTimeSynced
} from "../utils/timeUtils";

interface TimeSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeUpdated?: () => void;
  showNotification?: (msg: string, type: "success" | "info" | "error") => void;
}

export default function TimeSyncModal({
  isOpen,
  onClose,
  onTimeUpdated,
  showNotification
}: TimeSyncModalProps) {
  const [systemTime, setSystemTime] = useState<Date>(new Date());
  const [syncedTime, setSyncedTime] = useState<Date>(getSyncedDate());
  const [offsetMs, setOffsetMs] = useState<number>(getTimeOffsetMs());
  const [syncSource, setSyncSource] = useState<string>(getSyncSource());
  const [isSynced, setIsSynced] = useState<boolean>(getIsInternetTimeSynced());

  const [customDate, setCustomDate] = useState<string>(getSyncedDateString());
  const [customTime, setCustomTime] = useState<string>(
    getSyncedDate().toTimeString().slice(0, 5)
  );
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    const updateTimes = () => {
      setSystemTime(new Date());
      setSyncedTime(getSyncedDate());
      setOffsetMs(getTimeOffsetMs());
      setSyncSource(getSyncSource());
      setIsSynced(getIsInternetTimeSynced());
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleForceResync = async () => {
    setLoading(true);
    try {
      const data = await fetchInternetTime();
      if (data) {
        setCustomDate(data.date);
        setCustomTime(data.time.slice(0, 5));
        if (showNotification) {
          showNotification(`Successfully synced with ${data.source}`, "success");
        }
      } else {
        if (showNotification) {
          showNotification("Could not reach internet time servers. Offset unchanged.", "info");
        }
      }
      if (onTimeUpdated) onTimeUpdated();
    } catch (err: any) {
      if (showNotification) {
        showNotification("Failed to fetch internet time: " + (err.message || err), "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApplyManualOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customDate || !customTime) return;
    setLoading(true);
    try {
      await setManualTimeOffset(customDate, customTime);
      setOffsetMs(getTimeOffsetMs());
      setSyncSource("manual_override");
      setIsSynced(true);
      if (showNotification) {
        showNotification(`Time offset set to ${customDate} ${customTime}`, "success");
      }
      if (onTimeUpdated) onTimeUpdated();
    } catch (err: any) {
      if (showNotification) {
        showNotification("Failed to apply time override: " + err.message, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const formatOffsetHuman = (ms: number) => {
    if (Math.abs(ms) < 1000) return "0 Seconds (Perfect Sync)";
    const totalSec = Math.abs(Math.round(ms / 1000));
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    const sign = ms > 0 ? "+" : "-";
    return `${sign}${parts.join(" ")} (${ms > 0 ? "Ahead of PC clock" : "Behind PC clock"})`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-amber-200/40"
        style={{
          background: "linear-gradient(145deg, #FFFFFF, #FFFDF8)"
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{
            background: "linear-gradient(135deg, #2D1B0E, #4A321A)",
            color: "#D4AF37"
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
              <Clock size={18} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white tracking-wide">
                Real-Time & Date Manager
              </h3>
              <p className="text-[11px] text-amber-200/80 font-mono">
                BIOS / Hardware Clock Drift Resilience
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-200/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5">
          {/* Active Time Status Summary */}
          <div className="grid grid-cols-2 gap-3">
            {/* Real Synced Time Card */}
            <div className="p-3.5 rounded-xl border border-amber-300/40 bg-amber-50/50 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-bold text-amber-900 mb-1">
                <span>Calculated Real IST</span>
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle size={12} /> Live
                </span>
              </div>
              <div className="text-lg font-black font-mono text-amber-950">
                {syncedTime.toLocaleTimeString("en-IN")}
              </div>
              <div className="text-[11px] font-medium text-amber-800 font-mono">
                {getSyncedDateString()}
              </div>
            </div>

            {/* PC Hardware Clock Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
                <span>PC Hardware Clock</span>
                {Math.abs(offsetMs) > 60000 && (
                  <span className="flex items-center gap-1 text-amber-600" title="BIOS time differs from real time">
                    <AlertTriangle size={12} /> Drifted
                  </span>
                )}
              </div>
              <div className="text-lg font-black font-mono text-slate-800">
                {systemTime.toLocaleTimeString("en-IN")}
              </div>
              <div className="text-[11px] font-medium text-slate-500 font-mono">
                {systemTime.toISOString().split("T")[0]}
              </div>
            </div>
          </div>

          {/* Sync Metadata Details */}
          <div className="p-3.5 rounded-xl border border-amber-200/50 bg-white text-xs space-y-2 font-sans shadow-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Clock Offset Applied:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatOffsetHuman(offsetMs)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Time Source:</span>
              <span className="font-mono font-semibold text-amber-900 bg-amber-100/60 px-2 py-0.5 rounded text-[11px]">
                {syncSource}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleForceResync}
              disabled={loading}
              className="flex-1 h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #FFFDF8, #FFF5E6)",
                border: "1px solid rgba(212,175,55,0.4)",
                color: "#8B6914"
              }}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Force Internet Re-Sync
            </button>
          </div>

          {/* Manual Date & Time Override Section */}
          <form onSubmit={handleApplyManualOverride} className="pt-3 border-t border-slate-150 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Settings size={14} className="text-amber-600" />
                Manual Date & Time Override
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                Use if computer is offline & BIOS clock is wrong
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Correct Today Date
                </label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  required
                  className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 font-mono bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Correct Current Time
                </label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  required
                  className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-amber-500 font-mono bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md text-white disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #8B6914, #2D1B0E)",
                border: "1px solid rgba(212,175,55,0.4)"
              }}
            >
              <Save size={14} />
              Save & Apply Manual Override
            </button>
          </form>
        </div>

        {/* Footer info banner */}
        <div className="px-6 py-2.5 bg-amber-500/10 border-t border-amber-200/30 flex items-center gap-2 text-[11px] text-amber-900 font-medium">
          <Wifi size={13} className="text-amber-700 shrink-0" />
          <span>
            Real-time synchronization ensures daybook vouchers, pledge slips, and database backups always log true dates.
          </span>
        </div>
      </div>
    </div>
  );
}
