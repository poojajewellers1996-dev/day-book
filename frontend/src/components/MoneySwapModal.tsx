"use client";

import React, { useState } from "react";
import { X, ArrowRightLeft, Check, RefreshCw, Layers, Plus, Trash2 } from "lucide-react";
import { addSubEntry } from "../utils/api";
import { UPI_ACCOUNTS } from "./DiaryPage";

interface MoneySwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  daybookId: number;
  dateStr: string;
  onRefresh: () => void;
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

interface SplitAccountItem {
  id: string;
  upiAccount: string;
  amount: string;
}

export default function MoneySwapModal({
  isOpen,
  onClose,
  daybookId,
  dateStr,
  onRefresh,
  showNotification,
}: MoneySwapModalProps) {
  const [swapDirection, setSwapDirection] = useState<"cash_to_upi" | "upi_to_cash">("cash_to_upi");
  const [isSplitMode, setIsSplitMode] = useState<boolean>(false);
  const [personName, setPersonName] = useState("");

  // Single Account Mode
  const [singleAmount, setSingleAmount] = useState("");
  const [singleUpiAccount, setSingleUpiAccount] = useState("hdfc_192");

  // Dynamic Multi-Account Split Mode (Unlimited Accounts)
  const [splitItems, setSplitItems] = useState<SplitAccountItem[]>([
    { id: "1", upiAccount: "hdfc_192", amount: "" },
    { id: "2", upiAccount: "pooja_068", amount: "" },
  ]);

  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const totalSplitAmount = splitItems.reduce(
    (sum, item) => sum + (parseFloat(item.amount) || 0),
    0
  );

  const addSplitRow = () => {
    const defaultAcc = UPI_ACCOUNTS[splitItems.length % UPI_ACCOUNTS.length]?.key || "hdfc_192";
    setSplitItems((prev) => [
      ...prev,
      { id: Date.now().toString(), upiAccount: defaultAcc, amount: "" },
    ]);
  };

  const removeSplitRow = (id: string) => {
    if (splitItems.length <= 1) return;
    setSplitItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateSplitItem = (id: string, field: "upiAccount" | "amount", value: string) => {
    setSplitItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      showNotification("Please enter the person or party name", "error");
      return;
    }

    const nameTag = personName.trim();
    const refRemark = remarks.trim() ? ` [Ref: ${remarks.trim()}]` : "";

    setLoading(true);
    try {
      if (!isSplitMode) {
        // ── SINGLE ACCOUNT SWAP ──
        const numericAmt = parseFloat(singleAmount);
        if (isNaN(numericAmt) || numericAmt <= 0) {
          showNotification("Please enter a valid swap amount", "error");
          setLoading(false);
          return;
        }

        const accLabel = UPI_ACCOUNTS.find((a) => a.key === singleUpiAccount)?.label || singleUpiAccount;

        if (swapDirection === "cash_to_upi") {
          // 1. Customer gave CASH -> Record Jama (Cash In)
          await addSubEntry(daybookId, dateStr, "credit", {
            name: `${nameTag} (Money Swap)`,
            particulars: `Cash Received (Swap for UPI Transfer)${refRemark}`,
            amount: numericAmt,
            remarks: `Swapped for UPI transfer via ${accLabel}`,
          });

          // 2. Shopkeeper transferred UPI -> Record Udhar (UPI Out)
          const prefix = `[UPI:${singleUpiAccount}] `;
          await addSubEntry(daybookId, dateStr, "debit", {
            name: `${nameTag} (Money Swap)`,
            particulars: `${prefix}UPI Transferred (Swap for Cash Received)${refRemark}`,
            amount: numericAmt,
            remarks: `UPI sent via ${accLabel}`,
          });

          showNotification(
            `Money Swap Recorded: +₹${numericAmt} Cash Jama & -₹${numericAmt} UPI Udhar (${accLabel})`,
            "success"
          );
        } else {
          // 1. Customer transferred UPI -> Record Jama (UPI In)
          const prefix = `[UPI:${singleUpiAccount}] `;
          await addSubEntry(daybookId, dateStr, "credit", {
            name: `${nameTag} (Money Swap)`,
            particulars: `${prefix}UPI Received (Swap for Cash Exchange)${refRemark}`,
            amount: numericAmt,
            remarks: `UPI received via ${accLabel}`,
          });

          // 2. Shopkeeper gave Cash -> Record Udhar (Cash Out)
          await addSubEntry(daybookId, dateStr, "debit", {
            name: `${nameTag} (Money Swap)`,
            particulars: `Cash Given from Drawer (Swap for UPI Received)${refRemark}`,
            amount: numericAmt,
            remarks: `Cash handed to customer`,
          });

          showNotification(
            `Money Swap Recorded: +₹${numericAmt} UPI Jama (${accLabel}) & -₹${numericAmt} Cash Udhar`,
            "success"
          );
        }
      } else {
        // ── DYNAMIC MULTI-ACCOUNT SPLIT SWAP ──
        const validItems = splitItems.map((item) => ({
          ...item,
          numericAmt: parseFloat(item.amount) || 0,
          label: UPI_ACCOUNTS.find((a) => a.key === item.upiAccount)?.label || item.upiAccount,
        }));

        const hasInvalid = validItems.some((item) => item.numericAmt <= 0);
        if (hasInvalid || validItems.length === 0) {
          showNotification("Please enter valid positive amounts for all selected accounts", "error");
          setLoading(false);
          return;
        }

        const grandTotal = validItems.reduce((s, i) => s + i.numericAmt, 0);
        const breakdownStr = validItems.map((i) => `₹${i.numericAmt} via ${i.label}`).join(" + ");

        if (swapDirection === "cash_to_upi") {
          // Customer gave Cash -> 1 Total Cash Jama Entry + N Separate UPI Udhar Entries
          await addSubEntry(daybookId, dateStr, "credit", {
            name: `${nameTag} (Money Swap)`,
            particulars: `Cash Received (Swap for ${validItems.length}-Account Split UPI: ${breakdownStr})${refRemark}`,
            amount: grandTotal,
            remarks: `Split transfer across ${validItems.length} accounts`,
          });

          // Create separate Udhar entry for each UPI account
          for (let idx = 0; idx < validItems.length; idx++) {
            const item = validItems[idx];
            await addSubEntry(daybookId, dateStr, "debit", {
              name: `${nameTag} (Money Swap)`,
              particulars: `[UPI:${item.upiAccount}] UPI Transferred Part ${idx + 1}/${validItems.length} (${item.label})${refRemark}`,
              amount: item.numericAmt,
              remarks: `Part ${idx + 1} of split swap for ${nameTag}`,
            });
          }

          showNotification(
            `Multi-Account Swap Recorded: +₹${grandTotal} Cash Jama across ${validItems.length} UPI accounts`,
            "success"
          );
        } else {
          // Customer sent UPI from N accounts -> N Separate UPI Jama Entries + 1 Total Cash Udhar Entry
          for (let idx = 0; idx < validItems.length; idx++) {
            const item = validItems[idx];
            await addSubEntry(daybookId, dateStr, "credit", {
              name: `${nameTag} (Money Swap)`,
              particulars: `[UPI:${item.upiAccount}] UPI Received Part ${idx + 1}/${validItems.length} (${item.label})${refRemark}`,
              amount: item.numericAmt,
              remarks: `Part ${idx + 1} of split swap from ${nameTag}`,
            });
          }

          await addSubEntry(daybookId, dateStr, "debit", {
            name: `${nameTag} (Money Swap)`,
            particulars: `Cash Given from Drawer (Swap for ${validItems.length}-Account Split UPI Received: ${breakdownStr})${refRemark}`,
            amount: grandTotal,
            remarks: `Cash handed for split UPI exchange`,
          });

          showNotification(
            `Multi-Account Swap Recorded: +₹${grandTotal} UPI Jama across ${validItems.length} accounts & -₹${grandTotal} Cash Udhar`,
            "success"
          );
        }
      }

      setPersonName("");
      setSingleAmount("");
      setSplitItems([
        { id: "1", upiAccount: "hdfc_192", amount: "" },
        { id: "2", upiAccount: "pooja_068", amount: "" },
      ]);
      setRemarks("");
      setLoading(false);
      onRefresh();
      onClose();
    } catch (err: any) {
      console.error(err);
      showNotification("Failed to record money swap entry", "error");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs print:hidden">
      <div className="bg-white rounded-3xl border border-amber-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-900 via-amber-850 to-amber-950 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-sm font-serif tracking-wide">
                1-Click Money Swap / Exchange
              </h3>
              <p className="text-[10px] text-amber-200/80 font-medium">
                Supports single or multi-account split transfers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-amber-200 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
          {/* Swap Direction Toggle */}
          <div>
            <label className="block text-[10px] font-black text-amber-900 uppercase tracking-widest mb-1.5">
              Select Exchange Direction
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSwapDirection("cash_to_upi")}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex flex-col justify-between ${
                  swapDirection === "cash_to_upi"
                    ? "bg-amber-50 border-amber-500 text-amber-950 shadow-xs ring-1 ring-amber-500"
                    : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-base">💵 ➔ 📱</span>
                  {swapDirection === "cash_to_upi" && (
                    <Check size={14} className="text-amber-700 font-extrabold" />
                  )}
                </div>
                <div>
                  <p className="font-black leading-tight text-[11px]">Cash Received ➔ UPI Sent</p>
                  <p className="text-[9px] font-normal opacity-80 mt-0.5">
                    Customer gave Cash; Shopkeeper sent UPI
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSwapDirection("upi_to_cash")}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex flex-col justify-between ${
                  swapDirection === "upi_to_cash"
                    ? "bg-blue-50 border-blue-500 text-blue-950 shadow-xs ring-1 ring-blue-500"
                    : "bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-base">📱 ➔ 💵</span>
                  {swapDirection === "upi_to_cash" && (
                    <Check size={14} className="text-blue-700 font-extrabold" />
                  )}
                </div>
                <div>
                  <p className="font-black leading-tight text-[11px]">UPI Received ➔ Cash Given</p>
                  <p className="text-[9px] font-normal opacity-80 mt-0.5">
                    Customer sent UPI; Shopkeeper gave Cash
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Account Mode Switcher (Single Account vs Multi-Account Split) */}
          <div className="flex items-center justify-between bg-slate-100/70 p-1.5 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider pl-1 flex items-center gap-1">
              <Layers size={13} className="text-amber-800" /> UPI Transfer Mode:
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setIsSplitMode(false)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                  !isSplitMode
                    ? "bg-white text-amber-950 shadow-xs border border-amber-300"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                1 Account
              </button>
              <button
                type="button"
                onClick={() => setIsSplitMode(true)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                  isSplitMode
                    ? "bg-amber-800 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                🔀 Multi-Account Split
              </button>
            </div>
          </div>

          {/* Form Input Fields */}
          <div className="space-y-3 pt-0.5">
            <div>
              <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                Person / Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar / Friends Exchange"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                required
                className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-500 font-medium"
              />
            </div>

            {!isSplitMode ? (
              /* SINGLE ACCOUNT FORM */
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                    Swap Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={singleAmount}
                    onChange={(e) => setSingleAmount(e.target.value)}
                    required
                    step="any"
                    className="w-full bg-amber-50/30 border border-amber-300 rounded-xl px-3 py-1.5 text-xs text-amber-955 font-mono font-bold focus:outline-none focus:bg-white focus:ring-1 focus:ring-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                    UPI Bank Account
                  </label>
                  <select
                    value={singleUpiAccount}
                    onChange={(e) => setSingleUpiAccount(e.target.value)}
                    className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:bg-white"
                  >
                    {UPI_ACCOUNTS.map((acc) => (
                      <option key={acc.key} value={acc.key}>
                        {acc.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* DYNAMIC MULTI-ACCOUNT SPLIT FORM */
              <div className="space-y-2.5 bg-amber-50/30 border border-amber-200 p-3 rounded-2xl">
                <div className="flex justify-between items-center border-b border-dashed border-amber-900/20 pb-1.5">
                  <span className="text-[10px] font-black text-amber-950 uppercase tracking-wide">
                    Multi-Account Split Breakdown ({splitItems.length} Accounts)
                  </span>
                  <span className="text-[11px] font-mono font-black text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded">
                    Total: ₹{totalSplitAmount.toLocaleString("en-IN")}
                  </span>
                </div>

                {/* Dynamic Split Rows */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {splitItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-amber-900/10 shadow-2xs"
                    >
                      <div className="col-span-6">
                        <label className="block text-[8px] font-bold text-amber-900 uppercase mb-0.5">
                          Account {idx + 1}
                        </label>
                        <select
                          value={item.upiAccount}
                          onChange={(e) => updateSplitItem(item.id, "upiAccount", e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-none"
                        >
                          {UPI_ACCOUNTS.map((acc) => (
                            <option key={acc.key} value={acc.key}>
                              {acc.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={splitItems.length > 1 ? "col-span-5" : "col-span-6"}>
                        <label className="block text-[8px] font-bold text-amber-900 uppercase mb-0.5">
                          Amount (₹)
                        </label>
                        <input
                          type="number"
                          placeholder="Amount"
                          value={item.amount}
                          onChange={(e) => updateSplitItem(item.id, "amount", e.target.value)}
                          step="any"
                          required
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-amber-950 focus:outline-none"
                        />
                      </div>

                      {splitItems.length > 1 && (
                        <div className="col-span-1 flex justify-center pt-3">
                          <button
                            type="button"
                            onClick={() => removeSplitRow(item.id)}
                            className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                            title="Remove account row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Account Button */}
                <button
                  type="button"
                  onClick={addSplitRow}
                  className="w-full py-1.5 rounded-xl bg-white border border-dashed border-amber-400 text-amber-900 hover:bg-amber-100/50 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Plus size={12} className="text-amber-800" /> + Add Another Bank Account
                </button>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                Remarks / Ref UTR <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. GPay Ref #129481 or Mobile No"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-slate-50/80 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-800 to-amber-950 text-white text-xs font-black hover:from-amber-900 hover:to-black transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Recording...
                </>
              ) : (
                <>
                  <ArrowRightLeft size={14} /> Confirm Money Swap
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
