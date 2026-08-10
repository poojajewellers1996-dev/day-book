"use client";

import React, { useState, useEffect } from "react";
import {
  Archive,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Tag,
  Scale,
  Percent,
  Printer,
} from "lucide-react";
import TagPrintPreview, { TagItem } from "./TagPrintPreview";
import { API_BASE } from "../utils/api";

interface InventoryItem {
  barcode_no: string;
  ornament_name: string;
  metal: "GOLD" | "SILVER";
  purity: string;
  qty: number;
  weight: number;
  net_weight: number;
  huid_no: string;
  is_sold: number; // 0 = Available, 1 = Sold
  sold_date?: string;
  source: "EXCEL" | "DB";
  bill_no: string;
  bill_date: string;
}

interface StockRegisterViewProps {
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

export default function StockRegisterView({ showNotification }: StockRegisterViewProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingBarcode, setTogglingBarcode] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printItems, setPrintItems] = useState<TagItem[]>([]);

  // Mark Sold Date Modal State
  const [showSoldDateModal, setShowSoldDateModal] = useState(false);
  const [soldDateBarcode, setSoldDateBarcode] = useState("");
  const [soldDateOrnament, setSoldDateOrnament] = useState("");
  const [selectedSoldDate, setSelectedSoldDate] = useState("");

  // Stock Check Audit States
  const [showStockCheck, setShowStockCheck] = useState(false);
  const [selectedAuditMetal, setSelectedAuditMetal] = useState<"GOLD" | "SILVER" | "">("");
  const [unscannedItems, setUnscannedItems] = useState<InventoryItem[]>([]);
  const [scannedItems, setScannedItems] = useState<InventoryItem[]>([]);
  const [scanInput, setScanInput] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [unscannedFilter, setUnscannedFilter] = useState("");
  const [auditStatus, setAuditStatus] = useState<{ message: string; type: "success" | "error" | "" }>({ message: "", type: "" });
  const scanInputRef = React.useRef<HTMLInputElement>(null);

  // Play audio sound feedback for barcode scanning verification
  const playBeep = (type: "success" | "error") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === "success") {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (err) {
      console.warn("Beep audio blocked or failed", err);
    }
  };

  // Start stock check audit: loads current active stock of metal
  const startAudit = async (metalType: "GOLD" | "SILVER") => {
    setSelectedAuditMetal(metalType);
    setAuditLoading(true);
    setAuditStatus({ message: "", type: "" });
    setUnscannedFilter("");
    try {
      const res = await fetch(`${API_BASE}/inventory?metal=${metalType}&status=available`);
      if (res.ok) {
        const data = await res.json();
        setUnscannedItems(data);
        setScannedItems([]);
        setAuditStatus({
          message: `Audit started for ${metalType}. Loaded ${data.length} available items. Scan to verify.`,
          type: "success"
        });
      } else {
        showNotification("Failed to fetch inventory for audit", "error");
      }
    } catch {
      showNotification("Error connecting to server for audit", "error");
    } finally {
      setAuditLoading(false);
    }
  };

  // Process barcode scan submit
  const handleBarcodeScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanInput.trim().toUpperCase();
    if (!code) return;

    // Check if item is in unscanned list
    const foundIdx = unscannedItems.findIndex(
      (it) => it.barcode_no.toUpperCase() === code
    );

    if (foundIdx !== -1) {
      const matchedItem = unscannedItems[foundIdx];
      setScannedItems((prev) => [matchedItem, ...prev]);
      setUnscannedItems((prev) => prev.filter((_, idx) => idx !== foundIdx));
      setAuditStatus({
        message: `✓ Scanned: ${matchedItem.ornament_name} (${matchedItem.barcode_no}) - ${matchedItem.weight.toFixed(3)}g`,
        type: "success",
      });
      playBeep("success");
    } else {
      // Check if it was already scanned
      const alreadyScanned = scannedItems.some(
        (it) => it.barcode_no.toUpperCase() === code
      );
      if (alreadyScanned) {
        const matchedItem = scannedItems.find((it) => it.barcode_no.toUpperCase() === code);
        setAuditStatus({
          message: `⚠️ Already scanned: ${matchedItem?.ornament_name} (${code})`,
          type: "error",
        });
      } else {
        setAuditStatus({
          message: `❌ Not found: Barcode ${code} in active ${selectedAuditMetal} stock`,
          type: "error",
        });
      }
      playBeep("error");
    }
    
    // Clear input immediately so scanner doesn't double-paste or force manual clear
    setScanInput("");
    
    // Focus back on input
    setTimeout(() => {
      scanInputRef.current?.focus();
    }, 10);
  };

  // Export current audit results to CSV
  const exportAuditCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Barcode,Ornament Name,Metal,Weight,Purity,Status\n";
    
    scannedItems.forEach(item => {
      csvContent += `"${item.barcode_no}","${item.ornament_name}","${item.metal}",${item.weight},"${item.purity}","SCANNED"\n`;
    });
    
    unscannedItems.forEach(item => {
      csvContent += `"${item.barcode_no}","${item.ornament_name}","${item.metal}",${item.weight},"${item.purity}","MISSING (UNSCANNED)"\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Stock_Audit_${selectedAuditMetal}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Auto-focus barcode scan input after loading
  useEffect(() => {
    if (showStockCheck && selectedAuditMetal && !auditLoading) {
      const timer = setTimeout(() => {
        scanInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [showStockCheck, selectedAuditMetal, auditLoading]);

  // Click handler to re-focus scanner input
  const handleModalClick = () => {
    if (scanInputRef.current) {
      scanInputRef.current.focus();
    }
  };

  // Filter local unscanned items dynamically
  const unscannedFiltered = unscannedItems.filter(item => {
    if (!unscannedFilter.trim()) return true;
    const query = unscannedFilter.toLowerCase();
    return (
      item.barcode_no.toLowerCase().includes(query) ||
      item.ornament_name.toLowerCase().includes(query)
    );
  });

  // Filters
  const [search, setSearch] = useState("");
  const [metal, setMetal] = useState<string>("ALL");
  const [purity, setPurity] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("available");
  const [source, setSource] = useState<string>("ALL");

  useEffect(() => {
    fetchInventory();
  }, [metal, purity, status, source]); // trigger refetch on filter change or manually

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (metal !== "ALL") params.append("metal", metal);
      if (purity !== "ALL") params.append("purity", purity);
      if (status !== "all") params.append("status", status);
      if (source !== "ALL") params.append("source", source);
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`${API_BASE}/inventory?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        showNotification("Failed to fetch inventory", "error");
      }
    } catch {
      showNotification("Error connecting to server", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      fetchInventory();
    }
  };

  const openSoldDateModal = (barcodeNo: string, ornamentName: string) => {
    setSoldDateBarcode(barcodeNo);
    setSoldDateOrnament(ornamentName);
    setSelectedSoldDate(new Date().toISOString().split("T")[0]);
    setShowSoldDateModal(true);
  };

  const handleToggleSold = async (barcodeNo: string, currentStatus: number, customSoldDate?: string) => {
    setTogglingBarcode(barcodeNo);
    try {
      const res = await fetch(`${API_BASE}/inventory/${barcodeNo}/toggle-sold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sold_date: customSoldDate }),
      });
      if (res.ok) {
        const data = await res.json();
        const dateMsg = data.is_sold === 1 && data.sold_date ? ` (Sold Date: ${data.sold_date})` : "";
        showNotification(
          `Item ${barcodeNo} marked as ${data.is_sold === 1 ? "SOLD" : "AVAILABLE"}${dateMsg}`,
          "success"
        );
        setShowSoldDateModal(false);
        // Update local items state
        setItems((prev) =>
          prev.map((item) =>
            item.barcode_no === barcodeNo ? { ...item, is_sold: data.is_sold, sold_date: data.sold_date } : item
          )
        );
        // If status filter is active, we might want to remove it from view
        if (status !== "all" && ((status === "available" && data.is_sold === 1) || (status === "sold" && data.is_sold === 0))) {
          setItems((prev) => prev.filter((item) => item.barcode_no !== barcodeNo));
        }
      } else {
        showNotification("Failed to toggle sold status", "error");
      }
    } catch {
      showNotification("Error toggling status", "error");
    } finally {
      setTogglingBarcode(null);
    }
  };

  // Get purities list dynamically based on metal selection
  const getPurityOptions = () => {
    if (metal === "GOLD") return ["916", "750", "KDM 75HM", "KDM 91.6", "999", "585"];
    if (metal === "SILVER") return ["92.5", "999"];
    return ["916", "750", "92.5", "999"];
  };

  // Calculate quick stats on current items list
  const totalCount = items.length;
  const totalWeight = items.reduce((acc, it) => acc + (it.weight || 0), 0);
  const goldItems = items.filter((it) => it.metal === "GOLD");
  const goldWeight = goldItems.reduce((acc, it) => acc + (it.weight || 0), 0);
  const silverItems = items.filter((it) => it.metal === "SILVER");
  const silverWeight = silverItems.reduce((acc, it) => acc + (it.weight || 0), 0);

  if (showStockCheck) {
    return (
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "16px 16px 80px" }} onClick={handleModalClick}>
        <div style={{ background: "white", borderRadius: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #1e1b4b 0%, #311042 100%)",
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "white",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <CheckCircle2 size={24} color="#34d399" />
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Stock Audit Manager</h2>
                <p style={{ margin: 0, fontSize: 11, color: "#93c5fd" }}>
                  Scan barcodes to verify stock counts and weights
                </p>
              </div>
            </div>

            {selectedAuditMetal && (
              <div style={{ display: "flex", gap: 10, background: "rgba(255,255,255,0.1)", padding: "4px 8px", borderRadius: 10 }}>
                <button
                  onClick={() => startAudit("GOLD")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: selectedAuditMetal === "GOLD" ? "gold" : "transparent",
                    color: selectedAuditMetal === "GOLD" ? "black" : "white",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🥇 Gold
                </button>
                <button
                  onClick={() => startAudit("SILVER")}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: selectedAuditMetal === "SILVER" ? "#cbd5e1" : "transparent",
                    color: selectedAuditMetal === "SILVER" ? "black" : "white",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  🥈 Silver
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setShowStockCheck(false);
                setSelectedAuditMetal("");
                setScannedItems([]);
                setUnscannedItems([]);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              ← Back to Register
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", background: "#f8fafc", minHeight: "550px" }}>
            {!selectedAuditMetal ? (
              <div
                style={{
                  minHeight: 400,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 20,
                  textAlign: "center",
                }}
              >
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1e293b" }}>
                  Select Metal to Start Audit
                </h3>
                <p style={{ margin: 0, fontSize: 14, color: "#64748b", maxWidth: 400 }}>
                  This will load all active, unsold items of the selected metal from your inventory database for verification.
                </p>
                <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                  <button
                    onClick={() => startAudit("GOLD")}
                    style={{
                      width: 180,
                      height: 120,
                      borderRadius: 16,
                      border: "2px solid #e2e8f0",
                      background: "white",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#1e293b",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                    }}
                  >
                    <span style={{ fontSize: 32 }}>🥇</span>
                    GOLD STOCK
                  </button>
                  <button
                    onClick={() => startAudit("SILVER")}
                    style={{
                      width: 180,
                      height: 120,
                      borderRadius: 16,
                      border: "2px solid #e2e8f0",
                      background: "white",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#1e293b",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                    }}
                  >
                    <span style={{ fontSize: 32 }}>🥈</span>
                    SILVER STOCK
                  </button>
                </div>
              </div>
            ) : auditLoading ? (
              <div style={{ minHeight: 400, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, border: "4px solid #f3f3f3", borderTop: "4px solid #7c3aed", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>Loading active stock inventory...</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Scanner bar */}
                <div
                  style={{
                    background: "white",
                    padding: "16px 20px",
                    borderRadius: 12,
                    border: "1px solid #e2e8f0",
                    marginBottom: 16,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                  }}
                >
                  <form onSubmit={handleBarcodeScanSubmit} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <input
                        type="text"
                        ref={scanInputRef}
                        placeholder="✦ SCAN BARCODE NOW (Auto-reset, keeps focus) ✦"
                        value={scanInput}
                        onChange={(e) => setScanInput(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          borderRadius: 10,
                          border: "2px solid #7c3aed",
                          fontSize: 16,
                          fontWeight: 700,
                          letterSpacing: "1px",
                          color: "#1e293b",
                          outline: "none",
                          boxShadow: "0 0 0 3px rgba(124,58,237,0.15)",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      style={{
                        padding: "12px 24px",
                        background: "#7c3aed",
                        color: "white",
                        border: "none",
                        borderRadius: 10,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Submit Scan
                    </button>
                  </form>

                  {auditStatus.message && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 14px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        background: auditStatus.type === "success" ? "#ecfdf5" : "#fef2f2",
                        color: auditStatus.type === "success" ? "#065f46" : "#991b1b",
                        border: auditStatus.type === "success" ? "1px solid #a7f3d0" : "1px solid #fecaca",
                      }}
                    >
                      {auditStatus.type === "success" ? "✓" : "⚠"} {auditStatus.message}
                    </div>
                  )}
                </div>

                {/* Left vs Right lists */}
                <div style={{ display: "flex", gap: 16, height: "450px" }}>
                  {/* Left Side: Unscanned */}
                  <div
                    style={{
                      flex: 1,
                      background: "white",
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "#f1f5f9",
                        borderBottom: "1px solid #e2e8f0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#475569" }}>
                          Unscanned Items ({unscannedFiltered.length})
                        </span>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          Weight: {unscannedFiltered.reduce((acc, it) => acc + it.weight, 0).toFixed(3)}g
                        </div>
                      </div>
                      <div style={{ position: "relative", width: 150 }}>
                        <Search size={12} color="#94a3b8" style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
                        <input
                          type="text"
                          placeholder="Filter list..."
                          value={unscannedFilter}
                          onChange={(e) => setUnscannedFilter(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: "100%",
                            padding: "4px 8px 4px 24px",
                            fontSize: 11,
                            borderRadius: 6,
                            border: "1px solid #cbd5e1",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                      {unscannedFiltered.length === 0 ? (
                        <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>
                          No unscanned items found
                        </div>
                      ) : (
                        <>
                          {unscannedFiltered.slice(0, 50).map((it) => (
                            <div
                              key={it.barcode_no}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "8px 12px",
                                borderRadius: 8,
                                background: "#f8fafc",
                                marginBottom: 6,
                                border: "1px solid #f1f5f9",
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                                  {it.ornament_name}
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", marginTop: 2 }}>
                                  {it.barcode_no}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#1e293b" }}>
                                  {it.weight.toFixed(3)}g
                                </div>
                                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                                  Purity: {it.purity}
                                </div>
                              </div>
                            </div>
                          ))}
                          {unscannedFiltered.length > 50 && (
                            <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "8px 0", borderTop: "1px dashed #cbd5e1", marginTop: 8 }}>
                              ... and {unscannedFiltered.length - 50} more items ...
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Scanned */}
                  <div
                    style={{
                      flex: 1,
                      background: "#f0fdf4",
                      borderRadius: 12,
                      border: "1px solid #bbf7d0",
                      display: "flex",
                      flexDirection: "column",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 16px",
                        background: "#dcfce7",
                        borderBottom: "1px solid #bbf7d0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#166534" }}>
                          Verified Scanned ({scannedItems.length})
                        </span>
                        <div style={{ fontSize: 11, color: "#166534", marginTop: 2 }}>
                          Weight: {scannedItems.reduce((acc, it) => acc + it.weight, 0).toFixed(3)}g
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "#15803d", fontWeight: 700, background: "#bbf7d0", padding: "2px 8px", borderRadius: 10 }}>
                        Audited
                      </span>
                    </div>

                    <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
                      {scannedItems.length === 0 ? (
                        <div style={{ textAlign: "center", color: "#86efac", fontSize: 13, padding: "20px 0", fontWeight: 600 }}>
                          Ready. Scan first item to begin verification.
                        </div>
                      ) : (
                        <>
                          {scannedItems.slice(0, 50).map((it) => (
                            <div
                              key={it.barcode_no}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "8px 12px",
                                borderRadius: 8,
                                background: "white",
                                marginBottom: 6,
                                border: "1px solid #bbf7d0",
                                boxShadow: "0 1px 2px rgba(22,101,52,0.02)",
                              }}
                            >
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  <span style={{ color: "#22c55e", fontSize: 12 }}>✓</span>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: "#14532d" }}>
                                    {it.ornament_name}
                                  </div>
                                </div>
                                <div style={{ fontSize: 11, color: "#166534", fontFamily: "monospace", marginTop: 2, paddingLeft: 12 }}>
                                  {it.barcode_no}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#14532d" }}>
                                  {it.weight.toFixed(3)}g
                                </div>
                                <div style={{ fontSize: 10, color: "#22c55e" }}>
                                  Purity: {it.purity}
                                </div>
                              </div>
                            </div>
                          ))}
                          {scannedItems.length > 50 && (
                            <div style={{ fontSize: 11, color: "#15803d", fontWeight: 700, textAlign: "center", padding: "8px 0", borderTop: "1px dashed #bbf7d0", marginTop: 8 }}>
                              ... and {scannedItems.length - 50} more scanned items ...
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "16px 24px",
              background: "#f1f5f9",
              borderTop: "1px solid #cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#475569" }}>
              <div>Total Loaded: <span style={{ fontWeight: 700 }}>{unscannedItems.length + scannedItems.length}</span></div>
              <div>Scanned: <span style={{ fontWeight: 700, color: "#166534" }}>{scannedItems.length}</span></div>
              <div>Missing: <span style={{ fontWeight: 700, color: "#b91c1c" }}>{unscannedItems.length}</span></div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {selectedAuditMetal && (
                <>
                  <button
                    onClick={exportAuditCSV}
                    disabled={unscannedItems.length === 0 && scannedItems.length === 0}
                    style={{
                      padding: "8px 16px",
                      background: "white",
                      color: "#334155",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: (unscannedItems.length === 0 && scannedItems.length === 0) ? "not-allowed" : "pointer",
                    }}
                  >
                    📥 Download Audit Report (CSV)
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Reset current audit? Scanned verification list will be cleared.")) {
                        setSelectedAuditMetal("");
                        setUnscannedItems([]);
                        setScannedItems([]);
                        setAuditStatus({ message: "", type: "" });
                      }
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "white",
                      color: "#ef4444",
                      border: "1px solid #fca5a5",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Reset Audit
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setShowStockCheck(false);
                  setSelectedAuditMetal("");
                  setScannedItems([]);
                  setUnscannedItems([]);
                }}
                style={{
                  padding: "8px 20px",
                  background: "#0f172a",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close & Done
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "0 16px 80px" }}>
      {/* Header */}
      <div
        style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, #1b1a2e 0%, #16213e 100%)",
          padding: "24px 28px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 8px 32px rgba(27,26,46,0.15)",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: "rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Archive size={26} color="#d8b4fe" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "white" }}>
            Stock Register
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#a78bfa" }}>
            Real-time unified inventory register (Excel + Purchases). Mark items sold or edit availability.
          </p>
        </div>
        <button
          onClick={() => setShowStockCheck(true)}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            boxShadow: "0 2px 6px rgba(16,185,129,0.2)",
          }}
        >
          <CheckCircle2 size={14} /> Check Stock
        </button>

        <button
          onClick={fetchInventory}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh Register
        </button>

        {items.length > 0 && (
          <button
            onClick={() => {
              setPrintItems(items.map(item => ({
                barcodeNo: item.barcode_no,
                ornamentName: item.ornament_name,
                metal: item.metal,
                purity: item.purity,
                qty: item.qty,
                weight: item.weight,
                netWeight: item.net_weight || item.weight,
                remark: "",
                huidNo: item.huid_no,
              })));
              setShowPrintPreview(true);
            }}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #059669, #10b981)",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              boxShadow: "0 2px 6px rgba(16,185,129,0.2)",
            }}
          >
            <Printer size={14} /> Print Filtered Tags ({items.length})
          </button>
        )}
      </div>

      {/* Quick Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <div style={STAT_CARD}>
          <div style={STAT_LABEL}>Filtered Items</div>
          <div style={STAT_VALUE}>{totalCount}</div>
          <div style={STAT_SUBTEXT}>Total weight: {totalWeight.toFixed(3)}g</div>
        </div>
        <div style={STAT_CARD}>
          <div style={STAT_LABEL}>🥇 Gold Stock</div>
          <div style={STAT_VALUE}>{goldItems.length}</div>
          <div style={STAT_SUBTEXT}>Total weight: {goldWeight.toFixed(3)}g</div>
        </div>
        <div style={STAT_CARD}>
          <div style={STAT_LABEL}>🥈 Silver Stock</div>
          <div style={STAT_VALUE}>{silverItems.length}</div>
          <div style={STAT_SUBTEXT}>Total weight: {silverWeight.toFixed(3)}g</div>
        </div>
      </div>

      {/* Filters Area */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "16px 20px",
          border: "1px solid rgba(0,0,0,0.05)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.02)",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
            borderBottom: "1px solid #f5f0e8",
            paddingBottom: 8,
          }}
        >
          <Filter size={16} color="#7c3aed" />
          <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b", textTransform: "uppercase" }}>
            Search & Filter Panel
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          {/* Search box */}
          <div style={{ gridColumn: "span 2" }}>
            <label style={FILTER_LABEL}>Search Name or Barcode</label>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                color="#64748b"
                style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                placeholder="Type and press Enter to search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyPress}
                style={{ ...FILTER_INPUT, paddingLeft: 34 }}
              />
            </div>
          </div>

          {/* Metal Filter */}
          <div>
            <label style={FILTER_LABEL}>Metal Type</label>
            <select
              value={metal}
              onChange={(e) => {
                setMetal(e.target.value);
                setPurity("ALL");
              }}
              style={FILTER_INPUT}
            >
              <option value="ALL">All Metals</option>
              <option value="GOLD">🥇 Gold Only</option>
              <option value="SILVER">🥈 Silver Only</option>
            </select>
          </div>

          {/* Purity Filter */}
          <div>
            <label style={FILTER_LABEL}>Purity</label>
            <select value={purity} onChange={(e) => setPurity(e.target.value)} style={FILTER_INPUT}>
              <option value="ALL">All Purities</option>
              {getPurityOptions().map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label style={FILTER_LABEL}>Availability</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={FILTER_INPUT}>
              <option value="all">All Items</option>
              <option value="available">Available in Stock</option>
              <option value="sold">Sold Items</option>
            </select>
          </div>

          {/* Source Filter */}
          <div>
            <label style={FILTER_LABEL}>Stock Source</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} style={FILTER_INPUT}>
              <option value="ALL">All Sources</option>
              <option value="EXCEL">Pre-Existing (Excel)</option>
              <option value="DB">New Purchases (DB)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Inventory Items List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
            <RefreshCw className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <p>Scanning stock registers...</p>
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              background: "white",
              borderRadius: 16,
              padding: "40px",
              textAlign: "center",
              color: "#9E8B78",
              border: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            No inventory items match the current filters.
          </div>
        ) : (
          items.map((item) => {
            const isSold = item.is_sold === 1;
            const isToggling = togglingBarcode === item.barcode_no;

            return (
              <div
                key={item.barcode_no}
                style={{
                  borderRadius: 14,
                  border: "1px solid #edf2f7",
                  padding: "14px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.01)",
                  opacity: isSold ? 0.75 : 1,
                  background: isSold ? "#fcfcfc" : "white",
                }}
              >
                {/* Left side: Item Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: isSold ? "#64748b" : "#1e293b",
                      }}
                    >
                      {item.ornament_name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: item.metal === "GOLD" ? "#fff3c7" : "#e2e8f0",
                        color: item.metal === "GOLD" ? "#b45309" : "#475569",
                      }}
                    >
                      {item.metal}
                    </span>
                    {item.huid_no && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: "1px 5px",
                          borderRadius: 4,
                          background: "#e0f2fe",
                          color: "#0369a1",
                        }}
                      >
                        HUID: {item.huid_no}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 4,
                        background: item.source === "EXCEL" ? "#f3e8ff" : "#dcfce7",
                        color: item.source === "EXCEL" ? "#6b21a8" : "#166534",
                      }}
                    >
                      {item.source === "EXCEL" ? "EXCEL" : `PURCHASED: ${item.bill_no}`}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginTop: 6,
                      fontSize: 12,
                      color: "#64748b",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Scale size={12} /> {item.weight.toFixed(3)}g
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Percent size={12} /> Purity: {item.purity}
                    </span>
                    {item.bill_date && <span>Bill Date: {item.bill_date}</span>}
                  </div>
                </div>

                {/* Barcode representation */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#1e293b",
                    padding: "6px 12px",
                    borderRadius: 8,
                    color: "white",
                  }}
                >
                  <Tag size={12} color="#a78bfa" />
                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                    {item.barcode_no}
                  </span>
                </div>

                {/* Status Toggler / Indicator */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        color: isSold ? "#ef4444" : "#10b981",
                      }}
                    >
                      {isSold ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                      <span>{isSold ? "SOLD" : "AVAILABLE"}</span>
                    </div>
                    {isSold && item.sold_date && (
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          color: "#991b1b",
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          padding: "1px 6px",
                          borderRadius: 4,
                          marginTop: 2,
                        }}
                      >
                        🗓️ Sold: {new Date(item.sold_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>

                  <button
                    disabled={isToggling}
                    onClick={() => {
                      if (isSold) {
                        handleToggleSold(item.barcode_no, 0);
                      } else {
                        openSoldDateModal(item.barcode_no, item.ornament_name);
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: isSold ? "#f8fafc" : "#ffeeef",
                      color: isSold ? "#475569" : "#ef4444",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: isToggling ? "not-allowed" : "pointer",
                      minWidth: 92,
                      textAlign: "center",
                    }}
                  >
                    {isToggling ? "Saving..." : isSold ? "Mark Available" : "Mark Sold"}
                  </button>

                  <button
                    onClick={() => {
                      setPrintItems([{
                        barcodeNo: item.barcode_no,
                        ornamentName: item.ornament_name,
                        metal: item.metal,
                        purity: item.purity,
                        qty: item.qty,
                        weight: item.weight,
                        netWeight: item.net_weight || item.weight,
                        remark: "",
                        huidNo: item.huid_no,
                      }]);
                      setShowPrintPreview(true);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid #7c3aed",
                      background: "white",
                      color: "#7c3aed",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                    title="Print tag"
                  >
                    <Printer size={13} /> Print Tag
                  </button>
                </div>
              </div>
            );
          })
        )}
        {showPrintPreview && (
          <TagPrintPreview
            items={printItems}
            onClose={() => setShowPrintPreview(false)}
          />
        )}

        {/* ── MARK AS SOLD DATE PICKER MODAL ── */}
        {showSoldDateModal && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center px-4"
            style={{ background: "rgba(15,23,42,0.65)", backdropFilter: "blur(4px)", position: "fixed", left: 0, top: 0, right: 0, bottom: 0 }}
          >
            <div
              style={{
                background: "white",
                borderRadius: 20,
                maxWidth: 400,
                width: "100%",
                boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
                overflow: "hidden",
              }}
            >
              <div style={{ height: 4, background: "#ef4444" }} />
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-base text-gray-900">Mark Item as Sold</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {soldDateOrnament} (<b>{soldDateBarcode}</b>)
                  </p>
                </div>
                <button onClick={() => setShowSoldDateModal(false)} className="text-gray-400 hover:text-gray-600 font-bold">
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleToggleSold(soldDateBarcode, 1, selectedSoldDate);
                }}
                className="p-6 space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Select Date of Sale *
                  </label>
                  <input
                    type="date"
                    required
                    value={selectedSoldDate}
                    onChange={(e) => setSelectedSoldDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 outline-none text-sm font-semibold"
                    style={{ background: "#f8fafc" }}
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowSoldDateModal(false)}
                    className="w-1/3 py-2.5 rounded-xl border border-gray-300 font-bold text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={togglingBarcode === soldDateBarcode}
                    className="w-2/3 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2"
                  >
                    {togglingBarcode === soldDateBarcode ? <RefreshCw className="animate-spin" size={14} /> : "Confirm Sold Date"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Inline styles
const STAT_CARD: React.CSSProperties = {
  background: "white",
  borderRadius: 14,
  padding: "14px 18px",
  border: "1px solid rgba(0,0,0,0.05)",
  boxShadow: "0 1px 4px rgba(0,0,0,0.01)",
};

const STAT_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#9E8B78",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
};

const STAT_VALUE: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#1e293b",
  margin: "4px 0",
};

const STAT_SUBTEXT: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
};

const FILTER_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#64748b",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
};

const FILTER_INPUT: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: 13,
  color: "#334155",
  background: "white",
  outline: "none",
  boxSizing: "border-box",
};

const auditModalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(15, 23, 42, 0.75)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "20px",
};

const auditModalContainerStyle: React.CSSProperties = {
  background: "white",
  width: "100%",
  maxWidth: "1100px",
  height: "90vh",
  maxHeight: "850px",
  borderRadius: "20px",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};
