"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Calendar,
  User,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Tag,
  DollarSign,
} from "lucide-react";
import { API_BASE } from "../utils/api";

interface PurchaseItem {
  id: number;
  barcode_no: string;
  ornament_name: string;
  huid_no: string;
  purity: string;
  qty: number;
  weight: number;
  net_weight: number;
  rate: number;
  making: string;
  amount: number;
  remark: string;
}

interface PurchaseBill {
  id: number;
  bill_no: string;
  bill_date: string;
  supplier_name: string;
  metal: "GOLD" | "SILVER";
  invoice_total: number;
  item_count: number;
  created_at: string;
  total_weight?: number;
  purity?: string;
  is_rate_cut?: number;
  rate?: number;
  amount?: number;
  pure_weight?: number;
  making?: number;
  total_percent?: number;
}

interface PurchaseLedgerViewProps {
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

export default function PurchaseLedgerView({ showNotification }: PurchaseLedgerViewProps) {
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedBill, setSelectedBill] = useState<number | null>(null);
  const [billDetails, setBillDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/purchase/bills`);
      if (res.ok) {
        const data = await res.json();
        setBills(data);
      } else {
        showNotification("Failed to fetch purchase bills", "error");
      }
    } catch (e) {
      showNotification("Error connecting to server", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleBillClick = async (billId: number) => {
    if (selectedBill === billId) {
      setSelectedBill(null);
      setBillDetails(null);
      return;
    }
    setSelectedBill(billId);
    setDetailsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/purchase/bill/${billId}`);
      if (res.ok) {
        const data = await res.json();
        setBillDetails(data);
      } else {
        showNotification("Failed to load bill details", "error");
      }
    } catch {
      showNotification("Error loading bill details", "error");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDeleteBill = async (e: React.MouseEvent, billId: number, billNo: string) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete purchase bill ${billNo}? This will remove all its items from stock.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/purchase/bill/${billId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showNotification(`Bill ${billNo} deleted successfully`, "success");
        if (selectedBill === billId) {
          setSelectedBill(null);
          setBillDetails(null);
        }
        fetchBills();
      } else {
        showNotification("Failed to delete purchase bill", "error");
      }
    } catch {
      showNotification("Error deleting purchase bill", "error");
    }
  };

  const filteredBills = bills.filter((b) => {
    const s = search.toLowerCase();
    return (
      b.bill_no.toLowerCase().includes(s) ||
      b.supplier_name.toLowerCase().includes(s) ||
      b.bill_date.includes(s)
    );
  });

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 80px" }}>
      {/* Header */}
      <div
        style={{
          borderRadius: 20,
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          padding: "24px 28px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: "0 8px 32px rgba(15, 23, 42, 0.15)",
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
          <FileText size={26} color="#e2e8f0" />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "white" }}>
            Purchase Bill Ledger
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
            Search and view all registered supplier purchase bills and itemized details.
          </p>
        </div>
        <button
          onClick={fetchBills}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.05)",
            color: "#e2e8f0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          background: "white",
          borderRadius: 16,
          padding: "16px",
          border: "1px solid rgba(0,0,0,0.05)",
          boxShadow: "0 2px 12px rgba(0,0,0,0.02)",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Search size={18} color="#9E8B78" />
        <input
          type="text"
          placeholder="Search by Bill No, Supplier Name, or Date (YYYY-MM-DD)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            fontSize: 14,
            color: "#2d3748",
          }}
        />
      </div>

      {/* Bills List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9E8B78" }}>
            <RefreshCw className="animate-spin" style={{ margin: "0 auto 12px" }} />
            <p>Loading purchase bills...</p>
          </div>
        ) : filteredBills.length === 0 ? (
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
            No purchase bills found matching search query.
          </div>
        ) : (
          filteredBills.map((bill) => {
            const isOpen = selectedBill === bill.id;
            return (
              <div
                key={bill.id}
                style={{
                  background: "white",
                  borderRadius: 16,
                  border: `1.5px solid ${isOpen ? "#1e293b" : "#e8e0d4"}`,
                  overflow: "hidden",
                  boxShadow: isOpen ? "0 4px 20px rgba(30,41,59,0.08)" : "none",
                  transition: "all 0.2s",
                }}
              >
                {/* Bill Row Header */}
                <div
                  onClick={() => handleBillClick(bill.id)}
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    cursor: "pointer",
                    background: isOpen ? "#f8fafc" : "transparent",
                    userSelect: "none",
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      background: bill.metal === "GOLD" ? "#fef3c7" : "#e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                    }}
                  >
                    {bill.metal === "GOLD" ? "🥇" : "🥈"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>
                        {bill.bill_no}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: bill.metal === "GOLD" ? "#fffbeb" : "#f1f5f9",
                          color: bill.metal === "GOLD" ? "#b45309" : "#475569",
                        }}
                      >
                        {bill.metal}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 12, color: "#64748b" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <User size={12} /> {bill.supplier_name}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Calendar size={12} /> {bill.bill_date}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 16 }}>
                      ₹{bill.invoice_total.toLocaleString("en-IN")}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {bill.item_count} items
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={(e) => handleDeleteBill(e, bill.id, bill.bill_no)}
                      style={{
                        padding: 8,
                        borderRadius: 8,
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        color: "#ef4444",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 0.2s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#ffeeef")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                      title="Delete Bill"
                    >
                      <Trash2 size={16} />
                    </button>
                    {isOpen ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                  </div>
                </div>

                {/* Bill Row Details Dropdown */}
                {isOpen && (
                  <div
                    style={{
                      borderTop: "1px solid #e2e8f0",
                      padding: "20px",
                      background: "white",
                    }}
                  >
                    {detailsLoading ? (
                      <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>
                        <RefreshCw className="animate-spin" style={{ margin: "0 auto 8px" }} />
                        <p style={{ fontSize: 12 }}>Loading details...</p>
                      </div>
                    ) : billDetails ? (
                      <div>
                        {/* Summary metadata details */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                            gap: 16,
                            marginBottom: 20,
                            padding: "12px 16px",
                            borderRadius: 12,
                            background: "#f8fafc",
                            border: "1px solid #edf2f7",
                            fontSize: 13,
                          }}
                        >
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Supplier GST:</span>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>
                              {billDetails.supplier_gst || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Total Weight:</span>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>
                              {billDetails.total_weight ? `${billDetails.total_weight.toFixed(3)}g` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Purity:</span>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>
                              {billDetails.purity ? `${billDetails.purity}%` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Making Charge:</span>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>
                              {billDetails.making !== undefined ? `${billDetails.making}%` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Total Percent:</span>
                            <span style={{ fontWeight: 700, color: "#374151" }}>
                              {billDetails.total_percent !== undefined ? `${billDetails.total_percent}%` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Pure Weight:</span>
                            <span style={{ fontWeight: 700, color: "#1e40af" }}>
                              {billDetails.pure_weight ? `${billDetails.pure_weight.toFixed(3)}g (Pure)` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Rate Cut?</span>
                            <span style={{
                              fontWeight: 700,
                              color: billDetails.is_rate_cut !== 0 ? "#166534" : "#1e40af",
                              backgroundColor: billDetails.is_rate_cut !== 0 ? "#f0fdf4" : "#eff6ff",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              display: "inline-block",
                              fontSize: "11px",
                              marginTop: "2px"
                            }}>
                              {billDetails.is_rate_cut !== 0 ? "YES (Cut)" : "NO (Pure)"}
                            </span>
                          </div>
                          {billDetails.is_rate_cut !== 0 ? (
                            <>
                              <div>
                                <span style={{ color: "#64748b", display: "block" }}>Pure Rate:</span>
                                <span style={{ fontWeight: 600, color: "#1e293b" }}>
                                  {billDetails.rate ? `₹${billDetails.rate.toFixed(2)}/g` : "N/A"}
                                </span>
                              </div>
                              <div>
                                <span style={{ color: "#64748b", display: "block" }}>Calculated Amount:</span>
                                <span style={{ fontWeight: 700, color: "#166534" }}>
                                  {billDetails.amount ? `₹${billDetails.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "N/A"}
                                </span>
                              </div>
                            </>
                          ) : (
                            <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", background: "#fffbeb", border: "1px solid #fef3c7", borderRadius: 8, padding: "8px 12px", color: "#b45309", fontSize: "12px" }}>
                              Rate not cut. Outstanding balance of {billDetails.pure_weight ? billDetails.pure_weight.toFixed(3) : "0"}g pure metal.
                            </div>
                          )}
                          <div>
                            <span style={{ color: "#64748b", display: "block" }}>Registered Date:</span>
                            <span style={{ fontWeight: 600, color: "#1e293b" }}>
                              {billDetails.created_at ? new Date(billDetails.created_at).toLocaleString("en-IN") : "—"}
                            </span>
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <span style={{ color: "#64748b", display: "block" }}>Remarks:</span>
                            <span style={{ fontWeight: 500, color: "#475569" }}>
                              {billDetails.remarks || "No remarks added"}
                            </span>
                          </div>
                        </div>

                        {/* Items list */}
                        <h4
                          style={{
                            margin: "0 0 10px",
                            fontSize: 12,
                            fontWeight: 750,
                            color: "#475569",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Item List ({billDetails.items.length})
                        </h4>

                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {billDetails.items.map((item: PurchaseItem, index: number) => (
                            <div
                              key={item.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "12px",
                                borderRadius: 12,
                                border: "1px solid #e2e8f0",
                                background: "#fafafa",
                              }}
                            >
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  background: "#f1f5f9",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: "#64748b",
                                }}
                              >
                                {index + 1}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <span style={{ fontWeight: 600, fontSize: 13, color: "#1e293b" }}>
                                    {item.ornament_name}
                                  </span>
                                  {item.huid_no && (
                                    <span
                                      style={{
                                        fontSize: 9,
                                        fontWeight: 700,
                                        padding: "1px 6px",
                                        borderRadius: 4,
                                        background: "#e0f2fe",
                                        color: "#0369a1",
                                      }}
                                    >
                                      HUID: {item.huid_no}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                  Purity: {item.purity} · Wt: {item.weight}g{" "}
                                  {item.net_weight !== item.weight && `(Net: ${item.net_weight}g)`} · Rate: ₹
                                  {item.rate}/g · Making: {item.making || "0"}
                                </div>
                                {item.remark && (
                                  <div style={{ fontSize: 11, color: "#b45309", marginTop: 2, fontStyle: "italic" }}>
                                    Remark: {item.remark}
                                  </div>
                                )}
                              </div>
                              {/* Barcode badge */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  background: "#0f172a",
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
                              <div style={{ textAlign: "right", minWidth: 80 }}>
                                <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>
                                  ₹{item.amount.toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p style={{ textAlign: "center", color: "#ef4444" }}>Could not load bill details.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
