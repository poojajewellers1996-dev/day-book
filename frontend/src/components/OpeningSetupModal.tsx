"use client";

import React, { useState } from "react";

interface OpeningSetupModalProps {
  date: string;
  onComplete: (cash: number, upi: number, other: number, upiDetails?: string) => void;
  initialCash?: number;
  initialUpi?: number;
  initialOther?: number;
  initialUpiDetails?: string;
}

const fmt = (v: number) =>
  v > 0
    ? "₹" + new Intl.NumberFormat("en-IN").format(v)
    : "—";

const UPI_ACCOUNTS = [
  { key: "hdfc_192", label: "HDFC Bank CA - 192" },
  { key: "hdfc_od_7442", label: "HDFC OD - 7442" },
  { key: "pooja_068", label: "Pooja Jewellers - 068" },
  { key: "shankarlal_832", label: "Shankarlal - 832" },
  { key: "vikash", label: "Vikash" },
  { key: "vikram", label: "Vikram" },
  { key: "deepak", label: "Deepak" },
  { key: "kavitha", label: "Kavitha" }
];

export default function OpeningSetupModal({ date, onComplete, initialCash, initialUpi, initialOther, initialUpiDetails }: OpeningSetupModalProps) {
  const [cash,  setCash]  = useState(() => initialCash ? initialCash.toString() : "");
  const [other, setOther] = useState(() => initialOther ? initialOther.toString() : "");
  const [upiAccounts, setUpiAccounts] = useState<Record<string, string>>(() => {
    let parsed: Record<string, string> = {
      hdfc_192: "",
      hdfc_od_7442: "",
      pooja_068: "",
      shankarlal_832: "",
      vikash: "",
      vikram: "",
      deepak: "",
      kavitha: ""
    };
    if (initialUpiDetails) {
      try {
        const obj = JSON.parse(initialUpiDetails);
        Object.keys(parsed).forEach(k => {
          if (obj[k] !== undefined && obj[k] !== null) {
            parsed[k] = obj[k].toString();
          }
        });
      } catch {}
    } else if (initialUpi) {
      parsed.hdfc_192 = initialUpi.toString();
    }
    return parsed;
  });
  
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1|2>(1); // 1=input, 2=confirm

  const cashNum  = parseFloat(cash)  || 0;
  const upiNum   = Object.values(upiAccounts).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const otherNum = parseFloat(other) || 0;
  const total    = cashNum + upiNum + otherNum;

  const dateLabel = new Date(date).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const handleConfirm = async () => {
    setSaving(true);
    let detailsObj: Record<string, number> = {};
    if (initialUpiDetails) {
      try {
        detailsObj = JSON.parse(initialUpiDetails);
      } catch {}
    }
    Object.keys(upiAccounts).forEach(k => {
      const val = upiAccounts[k];
      if (val !== "") {
        detailsObj[k] = parseFloat(val) || 0;
      } else if (detailsObj[k] === undefined) {
        detailsObj[k] = 0;
      }
    });
    await onComplete(cashNum, upiNum, otherNum, JSON.stringify(detailsObj));
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 py-6 md:py-10"
      style={{ background: "rgba(45,27,14,0.55)", backdropFilter: "blur(6px)" }}
    >
      <style>{`
        @keyframes modal-in {
          from { opacity:0; transform:scale(0.92) translateY(20px); }
          to   { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes gold-shimmer {
          0%   { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        .setup-input {
          width: 100%;
          padding: 10px 14px 10px 38px;
          border: 1.5px solid #E8D8C0;
          border-radius: 10px;
          background: #FFFBF5;
          color: #2D1B0E;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Courier New', monospace;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .setup-input:focus {
          border-color: #D4AF37;
          box-shadow: 0 0 0 3px rgba(212,175,55,0.18);
        }
        .setup-input::placeholder { color: #C8B090; font-weight: 400; font-family: 'Segoe UI', sans-serif; font-size:13px; }
      `}</style>

      <div
        style={{
          background: "white",
          borderRadius: 24,
          maxWidth: 460,
          width: "100%",
          boxShadow: "0 32px 80px rgba(0,0,0,0.2), 0 4px 16px rgba(212,175,55,0.15)",
          animation: "modal-in 0.4s cubic-bezier(0.22,1,0.36,1) forwards",
          overflow: "hidden",
        }}
      >
        {/* Gold top bar */}
        <div
          style={{
            height: 5,
            backgroundImage: "linear-gradient(90deg,#c8960c,#f5d060 35%,#D4AF37 50%,#f5d060 65%,#c8960c)",
            backgroundSize: "200% auto",
            animation: "gold-shimmer 2.5s linear infinite",
          }}
        />

        <div className="px-6 py-5">
          {/* Header */}
          <div className="text-center mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2.5 text-2xl shadow-md"
              style={{ background: "linear-gradient(135deg,#FFF9E6,#FFF0C0)", border: "1px solid rgba(212,175,55,0.3)" }}
            >
              💰
            </div>
            <h2
              className="font-black text-lg mb-0.5"
              style={{ color: "#2D1B0E", fontFamily: "Georgia, serif" }}
            >
              Opening Balance Setup
            </h2>
            <p className="text-[11px] font-semibold" style={{ color: "#C8A87A" }}>
              {dateLabel}
            </p>
            <p className="text-[11px] mt-1.5" style={{ color: "#8B7355" }}>
              Enter today's starting balance in each category.
              <br />This will carry forward automatically every day.
            </p>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(212,175,55,0.3),transparent)", marginBottom: 16 }} />

          {step === 1 ? (
            <>
              {/* Input fields */}
              <div className="space-y-4">
                {/* Cash */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#8B6914" }}>
                    💵 Opening Cash
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "#C8A87A" }}>₹</span>
                    <input
                      id="setup-cash"
                      type="number"
                      className="setup-input"
                      placeholder="e.g. 125000"
                      value={cash}
                      onChange={e => setCash(e.target.value)}
                      autoFocus
                      min={0}
                    />
                  </div>
                </div>

                {/* PhonePe / UPI accounts */}
                <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-900/10">
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 flex justify-between items-center" style={{ color: "#8B6914" }}>
                    <span>📱 UPI Accounts</span>
                    <span className="font-mono text-[11px] font-bold text-amber-900">Total: ₹{new Intl.NumberFormat("en-IN").format(upiNum)}</span>
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {UPI_ACCOUNTS.map(acc => (
                      <div key={acc.key} className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-amber-950/70 w-32 truncate">{acc.label}</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-600/70">₹</span>
                          <input
                            type="number"
                            placeholder="0"
                            value={upiAccounts[acc.key] || ""}
                            onChange={e => setUpiAccounts({
                              ...upiAccounts,
                              [acc.key]: e.target.value
                            })}
                            className="w-full pl-5 pr-2.5 py-1 border border-amber-900/15 rounded-lg text-xs font-bold bg-white text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
                            min={0}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Other */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#8B6914" }}>
                    🔄 Other Balance
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: "#C8A87A" }}>₹</span>
                    <input
                      id="setup-other"
                      type="number"
                      className="setup-input"
                      placeholder="e.g. 10000"
                      value={other}
                      onChange={e => setOther(e.target.value)}
                      min={0}
                    />
                  </div>
                </div>
              </div>

              {/* Live total preview */}
              {total > 0 && (
                <div
                  className="mt-3.5 px-3 py-2 rounded-xl flex items-center justify-between"
                  style={{ background: "#FFF9F0", border: "1px solid rgba(212,175,55,0.25)" }}
                >
                  <span className="text-[11px] font-semibold" style={{ color: "#9E8B78" }}>Total Opening Balance</span>
                  <span className="text-base font-black font-mono" style={{ color: "#2D1B0E" }}>
                    ₹{new Intl.NumberFormat("en-IN").format(total)}
                  </span>
                </div>
              )}

              {/* Next button */}
              <button
                onClick={() => setStep(2)}
                disabled={total === 0}
                className="w-full mt-4 py-3 rounded-xl font-black uppercase tracking-widest transition-all"
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 12,
                  backgroundImage: total > 0
                    ? "linear-gradient(135deg,#c8960c,#f5d060 40%,#D4AF37 60%,#c8960c)"
                    : "none",
                  backgroundColor: total > 0
                    ? "transparent"
                    : "#F0E8D8",
                  backgroundSize: "200% auto",
                  animation: total > 0 ? "gold-shimmer 2.5s linear infinite" : "none",
                  color: total > 0 ? "#4A2800" : "#B8A090",
                  border: "none",
                  cursor: total > 0 ? "pointer" : "not-allowed",
                  boxShadow: total > 0 ? "0 4px 12px rgba(212,175,55,0.25)" : "none",
                }}
              >
                Review & Confirm →
              </button>
            </>
          ) : (
            <>
              {/* Confirmation step */}
              <div className="space-y-3 mb-6">
                {[
                  { label: "💵 Cash", value: cashNum, color: "#16a34a" },
                  { label: "📱 PhonePe / UPI", value: upiNum, color: "#6366f1" },
                  { label: "🔄 Other", value: otherNum, color: "#f59e0b" },
                ].map(row => (
                  <div key={row.label} className="space-y-1">
                    <div
                      className="flex items-center justify-between px-4 py-3 rounded-xl"
                      style={{ background: "#FAFAF8", border: "1px solid rgba(212,175,55,0.15)" }}
                    >
                      <span className="text-sm font-semibold" style={{ color: "#7A6550" }}>{row.label}</span>
                      <span className="text-base font-black font-mono" style={{ color: row.value > 0 ? row.color : "#C0A888" }}>
                        {fmt(row.value)}
                      </span>
                    </div>
                    {row.label.includes("UPI") && row.value > 0 && (
                      <div className="mx-2 mt-1 mb-2 px-3.5 py-2.5 bg-amber-50/20 border border-amber-900/5 rounded-xl space-y-1">
                        {UPI_ACCOUNTS.map(acc => {
                          const val = parseFloat(upiAccounts[acc.key]) || 0;
                          if (val === 0) return null;
                          return (
                            <div key={acc.key} className="flex justify-between text-[11px] font-bold text-amber-900/80">
                              <span>{acc.label}</span>
                              <span className="font-mono">{fmt(val)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* Total */}
                <div
                  className="flex items-center justify-between px-4 py-4 rounded-xl"
                  style={{ background: "linear-gradient(135deg,#FFF9F0,#FFF5E0)", border: "1.5px solid rgba(212,175,55,0.3)" }}
                >
                  <span className="text-sm font-black uppercase tracking-wide" style={{ color: "#8B6914" }}>
                    Total Opening Balance
                  </span>
                  <span className="text-xl font-black font-mono" style={{ color: "#2D1B0E" }}>
                    ₹{new Intl.NumberFormat("en-IN").format(total)}
                  </span>
                </div>
              </div>

              <p className="text-center text-xs mb-6" style={{ color: "#9E8B78" }}>
                This balance will be set for <strong>{dateLabel}</strong>.<br />
                It will carry forward automatically every day.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm transition-colors"
                  style={{
                    background: "white",
                    border: "1.5px solid rgba(212,175,55,0.3)",
                    color: "#8B6914",
                  }}
                >
                  ← Edit
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-2 py-3 px-6 rounded-2xl font-black text-sm uppercase tracking-wider transition-all"
                  style={{
                    background: saving ? "#F0E8D8" : "linear-gradient(135deg,#c8960c,#D4AF37)",
                    color: saving ? "#B8A090" : "#4A2800",
                    border: "none",
                    boxShadow: saving ? "none" : "0 4px 16px rgba(212,175,55,0.35)",
                    cursor: saving ? "not-allowed" : "pointer",
                    flex: 2,
                  }}
                >
                  {saving ? "Saving…" : "✓ Confirm & Start"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
