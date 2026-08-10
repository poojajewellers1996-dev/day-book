"use client";

import React, { useState } from "react";
import { AlertTriangle, Clock, RefreshCw, RotateCcw, ShieldAlert, CheckCircle2, Monitor, ArrowRight, Settings, ExternalLink } from "lucide-react";
import { TimeCheckResult } from "../utils/timeUtils";

interface SystemTimeAlertModalProps {
  timeResult: TimeCheckResult | null;
  loading: boolean;
  onContinue: () => void;
  onRestart: () => void;
  onRecheck: () => void;
}

export default function SystemTimeAlertModal({
  timeResult,
  loading,
  onContinue,
  onRestart,
  onRecheck,
}: SystemTimeAlertModalProps) {
  const [rechecking, setRechecking] = useState(false);

  const handleRecheckClick = async () => {
    setRechecking(true);
    await onRecheck();
    setRechecking(false);
  };

  const handleOpenSettings = async () => {
    try {
      await fetch("http://localhost:8000/api/system/open-date-settings", { method: "POST" });
    } catch (e) {
      console.warn("Could not trigger open-date-settings via backend:", e);
    }
    try {
      window.open("ms-settings:dateandtime", "_self");
    } catch (e) {}
  };

  const isMismatch = timeResult?.mismatch ?? false;
  const isChecked = timeResult?.checked ?? false;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: "rgba(20, 12, 6, 0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        className={`w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl font-sans border transition-all duration-300 ${
          isMismatch ? "border-rose-500/30" : "border-emerald-500/30"
        }`}
        style={{
          background: "linear-gradient(145deg, #1e130c, #140b06)",
          boxShadow: isMismatch
            ? "0 25px 60px -15px rgba(225, 29, 72, 0.3)"
            : "0 25px 60px -15px rgba(16, 185, 129, 0.25)",
        }}
      >
        {/* Top Accent Line */}
        <div
          className={`h-2 w-full ${
            isMismatch
              ? "bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 animate-pulse"
              : "bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400"
          }`}
        />

        <div className="p-7 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border ${
                isMismatch
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              }`}
            >
              {loading ? (
                <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
              ) : isMismatch ? (
                <ShieldAlert className="w-8 h-8 text-rose-500 animate-bounce" />
              ) : (
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              )}
            </div>

            <div>
              <div
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold tracking-wider uppercase mb-1 ${
                  isMismatch
                    ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
                    : "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                }`}
              >
                {loading ? (
                  <>Checking Time Verification...</>
                ) : isMismatch ? (
                  <>
                    <AlertTriangle size={12} /> Time Mismatch Detected
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={12} /> System Time Verified
                  </>
                )}
              </div>

              <h2 className="text-xl font-bold text-amber-100 font-serif tracking-tight">
                {loading
                  ? "Verifying Time Synchronization"
                  : isMismatch
                  ? "Please Alter Computer System Time"
                  : "Device Time Verified Correct"}
              </h2>

              <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
                {loading
                  ? "Fetching authoritative Google network time to verify system clock accuracy..."
                  : isMismatch
                  ? "Your computer system clock does not match Google standard time. Please alter your computer time in Windows Settings."
                  : "Your computer system clock matches Google network standard time. Click continue to proceed to login."}
              </p>
            </div>
          </div>

          {/* Time Comparison Cards */}
          {isChecked && timeResult && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Computer Time */}
              <div
                className={`p-4 rounded-2xl border space-y-1.5 relative overflow-hidden ${
                  isMismatch
                    ? "bg-rose-950/40 border-rose-500/40"
                    : "bg-amber-950/30 border-amber-500/25"
                }`}
              >
                <div
                  className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${
                    isMismatch ? "text-rose-400" : "text-amber-400"
                  }`}
                >
                  <Monitor size={14} /> Computer Time
                </div>
                <div
                  className={`text-sm font-mono font-bold ${
                    isMismatch ? "text-rose-200" : "text-amber-100"
                  }`}
                >
                  {timeResult.system_formatted}
                </div>
                <span className="text-[10px] text-amber-300/70 font-medium block">
                  {isMismatch ? "⚠️ Incorrect System Clock" : "✓ Local Clock"}
                </span>
              </div>

              {/* Google Standard Time */}
              <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-1.5 relative overflow-hidden">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  <Clock size={14} /> Google Standard Time
                </div>
                <div className="text-sm font-mono font-bold text-emerald-200">
                  {timeResult.google_formatted}
                </div>
                <span className="text-[10px] text-emerald-400/80 font-medium block">
                  ✓ Authoritative Network Time
                </span>
              </div>
            </div>
          )}

          {/* Discrepancy / Success Notice */}
          {isChecked && timeResult && (
            <div
              className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                isMismatch
                  ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                  : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              }`}
            >
              <span className="font-medium">Verification Status:</span>
              <span
                className={`font-mono font-bold px-2.5 py-1 rounded-lg border text-xs ${
                  isMismatch
                    ? "bg-rose-500/20 border-rose-500/30 text-rose-200"
                    : "bg-emerald-500/20 border-emerald-500/30 text-emerald-200"
                }`}
              >
                {isMismatch
                  ? timeResult.diff_minutes > 0
                    ? `${timeResult.diff_minutes} minutes mismatch`
                    : `${Math.round(timeResult.diff_seconds)} seconds mismatch`
                  : "Time Synchronized & Accurate"}
              </span>
            </div>
          )}

          {/* Instructions for Mismatch */}
          {isMismatch && (
            <div className="space-y-2 text-xs text-amber-200/80 bg-amber-950/20 p-4 rounded-2xl border border-amber-500/15">
              <div className="font-bold text-amber-300 uppercase text-[10px] tracking-wider mb-1">
                How to alter your time in Windows:
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                <li>Click <b>"Open Date & Time Settings"</b> below (or go to Windows Settings → Date & Time).</li>
                <li>Toggle on <b>"Set time automatically"</b> or click <b>"Sync now"</b>.</li>
                <li>Verify computer time matches <b>{timeResult?.google_formatted}</b>.</li>
                <li>Click <b>"Restart App"</b> below after altering your system time.</li>
              </ol>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-3">
            {isMismatch ? (
              <>
                <button
                  onClick={handleOpenSettings}
                  className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-amber-950 font-extrabold text-xs shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wider border border-amber-400/40"
                >
                  <Settings size={18} />
                  Open Date & Time Settings
                  <ExternalLink size={14} className="ml-1 opacity-80" />
                </button>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={onRestart}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 text-white font-bold text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                  >
                    <RotateCcw size={16} />
                    Restart App
                  </button>

                  <button
                    onClick={handleRecheckClick}
                    disabled={rechecking || loading}
                    className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold text-xs border border-amber-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <RefreshCw size={14} className={rechecking || loading ? "animate-spin" : ""} />
                    {rechecking ? "Checking..." : "Re-check Time"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={onContinue}
                  disabled={loading}
                  className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500 text-amber-950 font-extrabold text-xs shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                >
                  Continue to Login
                  <ArrowRight size={16} />
                </button>

                <button
                  onClick={handleRecheckClick}
                  disabled={rechecking || loading}
                  className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-semibold text-xs border border-amber-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw size={14} className={rechecking || loading ? "animate-spin" : ""} />
                  Re-check
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
