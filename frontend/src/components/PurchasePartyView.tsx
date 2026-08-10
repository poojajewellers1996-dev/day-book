"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  DollarSign,
  Calendar,
  Phone,
  Tag,
  MapPin,
  ArrowRight,
  ChevronRight,
  TrendingDown,
  Coins,
  CheckCircle2,
  FileText,
  AlertCircle,
  X,
  CreditCard,
  Edit,
  Trash2,
  RotateCcw
} from "lucide-react";
import {
  PurchaseParty,
  PartyTransaction,
  fetchPurchaseParties,
  createPurchaseParty,
  fetchPartyTransactions,
  recordPartyPayment,
  updatePurchaseParty,
  deleteDebitEntry,
  deletePurchaseParty,
  convertDebitToRateCut,
  revertDebitRateCut
} from "../utils/api";

interface PurchasePartyViewProps {
  currentDate: string;
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

const fmtCurrency = (val: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);

const fmtDateFriendly = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";

export default function PurchasePartyView({ currentDate, showNotification }: PurchasePartyViewProps) {
  const [parties, setParties] = useState<PurchaseParty[]>([]);
  const [selectedParty, setSelectedParty] = useState<PurchaseParty | null>(null);
  const [transactions, setTransactions] = useState<PartyTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"CASH" | "UPI" | "OTHER">("CASH");
  const [paymentDate, setPaymentDate] = useState(currentDate || new Date().toISOString().split("T")[0]);
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Rate Cut Payment properties
  const [isRateCutPayment, setIsRateCutPayment] = useState(false);
  const [rateCutRate, setRateCutRate] = useState("");
  const [rateCutMetal, setRateCutMetal] = useState<"GOLD" | "SILVER">("GOLD");

  // Edit Party Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGstin, setEditGstin] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editOpeningCash, setEditOpeningCash] = useState("");
  const [editOpeningGold, setEditOpeningGold] = useState("");
  const [editOpeningSilver, setEditOpeningSilver] = useState("");
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // New Party Form State
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newGstin, setNewGstin] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newOpeningCash, setNewOpeningCash] = useState("");
  const [newOpeningGold, setNewOpeningGold] = useState("");
  const [newOpeningSilver, setNewOpeningSilver] = useState("");
  const [submittingParty, setSubmittingParty] = useState(false);

  // Convert Existing Payment to Rate Cut State
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertingTxnId, setConvertingTxnId] = useState<number | null>(null);
  const [convertingAmount, setConvertingAmount] = useState<number>(0);
  const [convertingRef, setConvertingRef] = useState<string>("");
  const [convertRate, setConvertRate] = useState<string>("");
  const [convertMetal, setConvertMetal] = useState<"GOLD" | "SILVER">("GOLD");
  const [submittingConvert, setSubmittingConvert] = useState(false);

  // Add Purchase Bill Modal State
  const [showAddBillModal, setShowAddBillModal] = useState(false);
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(currentDate || new Date().toISOString().split("T")[0]);
  const [billMetal, setBillMetal] = useState<"GOLD" | "SILVER">("GOLD");
  const [billTotalWeight, setBillTotalWeight] = useState("");
  const [billPurity, setBillPurity] = useState("91.6%");
  const [billIsRateCut, setBillIsRateCut] = useState(true);
  const [billRate, setBillRate] = useState("");
  const [billInvoiceTotal, setBillInvoiceTotal] = useState("");
  const [billRemarks, setBillRemarks] = useState("");
  const [billItemsText, setBillItemsText] = useState("");
  const [submittingBill, setSubmittingBill] = useState(false);

  const handleOpenAddBillModal = () => {
    if (!selectedParty) return;
    const randSeq = Math.floor(1000 + Math.random() * 9000);
    setBillNo(`BILL-${randSeq}`);
    setBillDate(currentDate || new Date().toISOString().split("T")[0]);
    setBillMetal("GOLD");
    setBillTotalWeight("");
    setBillPurity("91.6%");
    setBillIsRateCut(true);
    setBillRate("");
    setBillInvoiceTotal("");
    setBillRemarks("");
    setBillItemsText("");
    setShowAddBillModal(true);
  };

  const handleSavePurchaseBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) return;
    if (!billNo.trim()) {
      showNotification("Please enter a valid Bill Number", "error");
      return;
    }
    const weightVal = parseFloat(billTotalWeight) || 0;
    if (weightVal <= 0) {
      showNotification("Please enter a valid Total Weight in grams", "error");
      return;
    }

    setSubmittingBill(true);
    try {
      const rateVal = parseFloat(billRate) || 0;
      const invTotal = parseFloat(billInvoiceTotal) || (billIsRateCut ? weightVal * rateVal : 0);

      let purityFactor = 0.916;
      if (billPurity.includes("100")) {
        purityFactor = 1.0;
      } else if (billPurity.includes("99.9") || billPurity.includes("999") || billPurity.includes("24K")) {
        purityFactor = 0.999;
      } else if (billPurity.includes("91.6") || billPurity.includes("916") || billPurity.includes("22K")) {
        purityFactor = 0.916;
      } else if (billPurity.includes("75.0") || billPurity.includes("750") || billPurity.includes("18K")) {
        purityFactor = 0.750;
      } else if (billPurity.includes("92.5") || billPurity.includes("925")) {
        purityFactor = 0.925;
      } else {
        const numMatch = billPurity.match(/[\d.]+/);
        if (numMatch) {
          const parsedP = parseFloat(numMatch[0]);
          if (parsedP > 1) purityFactor = parsedP / 100;
          else purityFactor = parsedP;
        }
      }

      const pureWt = weightVal * purityFactor;
      const fullRemarks = (billRemarks.trim() + (billItemsText.trim() ? ` | Items: ${billItemsText.trim()}` : "")).trim();

      const payload = {
        bill_no: billNo.trim(),
        bill_date: billDate,
        supplier_name: selectedParty.name.trim(),
        supplier_gst: selectedParty.gstin || "",
        metal: billMetal,
        invoice_total: invTotal,
        remarks: fullRemarks,
        total_weight: weightVal,
        purity: billPurity,
        is_rate_cut: billIsRateCut ? 1 : 0,
        rate: billIsRateCut ? rateVal : 0,
        amount: billIsRateCut ? invTotal : 0,
        pure_weight: pureWt,
        items: []
      };

      const res = await fetch("http://localhost:8000/api/purchase/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).detail || "Failed to save purchase bill");
      }

      showNotification(`Purchase Bill '${billNo}' added for ${selectedParty.name}!`, "success");
      setShowAddBillModal(false);

      // Refresh Party & Ledger Statement
      await loadLedger(selectedParty.name);
      await loadParties();
    } catch (err: any) {
      showNotification(err.message || "Error saving purchase bill", "error");
    } finally {
      setSubmittingBill(false);
    }
  };

  useEffect(() => {
    loadParties();
  }, []);

  useEffect(() => {
    if (selectedParty) {
      loadLedger(selectedParty.name);
    }
  }, [selectedParty]);

  const loadParties = async () => {
    setLoading(true);
    try {
      const data = await fetchPurchaseParties();
      setParties(data);
      if (selectedParty) {
        // Update selected party data if it exists in the refreshed list
        const updated = data.find(p => p.name.toLowerCase() === selectedParty.name.toLowerCase());
        if (updated) {
          setSelectedParty(updated);
        }
      }
    } catch (e) {
      showNotification("Failed to load purchase parties", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadLedger = async (partyName: string) => {
    setLedgerLoading(true);
    try {
      const data = await fetchPartyTransactions(partyName);
      setTransactions(data);
    } catch (e) {
      showNotification("Failed to load ledger history", "error");
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showNotification("Supplier name is required", "error");
      return;
    }
    setSubmittingParty(true);
    try {
      const payload = {
        name: newName.trim(),
        phone: newPhone.trim(),
        gstin: newGstin.trim(),
        address: newAddress.trim(),
        opening_balance_cash: parseFloat(newOpeningCash) || 0.0,
        opening_balance_gold: parseFloat(newOpeningGold) || 0.0,
        opening_balance_silver: parseFloat(newOpeningSilver) || 0.0
      };
      const res = await createPurchaseParty(payload);
      if (res) {
        showNotification(`Supplier "${res.name}" registered successfully!`, "success");
        setNewName("");
        setNewPhone("");
        setNewGstin("");
        setNewAddress("");
        setNewOpeningCash("");
        setNewOpeningGold("");
        setNewOpeningSilver("");
        await loadParties();
      } else {
        showNotification("Failed to create supplier. Name might already exist.", "error");
      }
    } catch (e) {
      showNotification("Error registering supplier", "error");
    } finally {
      setSubmittingParty(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) return;
    const amountVal = parseFloat(paymentAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      showNotification("Please enter a valid payment amount (> 0)", "error");
      return;
    }
    if (!paymentDate) {
      showNotification("Please select a date", "error");
      return;
    }
    const rateVal = parseFloat(rateCutRate);
    if (isRateCutPayment && (isNaN(rateVal) || rateVal <= 0)) {
      showNotification("Please enter a valid rate (> 0) for rate cut conversion", "error");
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await recordPartyPayment(selectedParty.name, {
        amount: amountVal,
        payment_mode: paymentMode,
        date: paymentDate,
        remarks: paymentRemarks.trim() || `Supplier Payment to ${selectedParty.name}`,
        is_rate_cut: isRateCutPayment,
        rate: isRateCutPayment ? rateVal : undefined,
        metal: isRateCutPayment ? rateCutMetal : undefined
      });

      if (res) {
        const detailMsg = isRateCutPayment 
          ? `Payment of ${fmtCurrency(amountVal)} recorded and converted to ${(amountVal / rateVal).toFixed(3)}g of ${rateCutMetal.toLowerCase()}!` 
          : `Payment of ${fmtCurrency(amountVal)} recorded!`;
        showNotification(`${detailMsg} Logged in Day Book for ${paymentDate}.`, "success");
        setPaymentAmount("");
        setPaymentRemarks("");
        setIsRateCutPayment(false);
        setRateCutRate("");
        setRateCutMetal("GOLD");
        setShowPaymentModal(false);
        await loadParties();
        if (selectedParty) {
          await loadLedger(selectedParty.name);
        }
      } else {
        showNotification("Failed to record payment. Please try again.", "error");
      }
    } catch (e) {
      showNotification("Error recording payment", "error");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeleteTxn = async (tx: PartyTransaction) => {
    if (tx.type === "bill") {
      const billId = parseInt(tx.id.replace("bill_", ""));
      if (isNaN(billId)) return;
      if (!window.confirm(`Are you sure you want to delete Purchase Bill '${tx.reference}'? This will also remove the bill items.`)) {
        return;
      }
      
      try {
        const res = await fetch(`http://localhost:8000/api/purchase/bill/${billId}`, {
          method: "DELETE"
        });
        if (res.ok) {
          showNotification(`Purchase Bill '${tx.reference}' deleted successfully!`, "success");
          await loadParties();
          if (selectedParty) {
            await loadLedger(selectedParty.name);
          }
        } else {
          showNotification("Failed to delete purchase bill.", "error");
        }
      } catch (e) {
        showNotification("Error deleting purchase bill", "error");
      }
    } else {
      const numericId = parseInt(tx.id.replace("payment_", ""));
      if (isNaN(numericId)) return;
      if (!window.confirm(`Are you sure you want to delete Payment '${tx.reference}'? This will also remove it from the Day Book.`)) {
        return;
      }
      
      try {
        const ok = await deleteDebitEntry(numericId);
        if (ok) {
          showNotification("Payment deleted successfully!", "success");
          await loadParties();
          if (selectedParty) {
            await loadLedger(selectedParty.name);
          }
        } else {
          showNotification("Failed to delete payment.", "error");
        }
      } catch (e) {
        showNotification("Error deleting payment", "error");
      }
    }
  };

  const openConvertModal = (txnIdStr: string, amount: number, ref: string, currentRate?: number, currentMetal?: string) => {
    const numericId = parseInt(txnIdStr.replace("payment_", ""));
    if (isNaN(numericId)) return;
    setConvertingTxnId(numericId);
    setConvertingAmount(amount);
    setConvertingRef(ref);
    setConvertRate(currentRate ? currentRate.toString() : "");
    setConvertMetal((currentMetal === "SILVER" ? "SILVER" : "GOLD"));
    setShowConvertModal(true);
  };

  const handleConvertRateCutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingTxnId) return;
    const rateVal = parseFloat(convertRate);
    if (isNaN(rateVal) || rateVal <= 0) {
      showNotification("Please enter a valid rate (> 0) per gram", "error");
      return;
    }

    setSubmittingConvert(true);
    try {
      const res = await convertDebitToRateCut(convertingTxnId, rateVal, convertMetal);
      if (res && res.success) {
        showNotification(`Payment of ${fmtCurrency(convertingAmount)} converted to ${res.weight}g ${res.metal} @ ₹${res.rate}/g!`, "success");
        setShowConvertModal(false);
        await loadParties();
        if (selectedParty) {
          await loadLedger(selectedParty.name);
        }
      } else {
        showNotification("Failed to convert payment to rate cut.", "error");
      }
    } catch (e) {
      showNotification("Error converting payment", "error");
    } finally {
      setSubmittingConvert(false);
    }
  };

  const handleRevertRateCut = async (txnIdStr: string) => {
    const numericId = parseInt(txnIdStr.replace("payment_", ""));
    if (isNaN(numericId)) return;
    if (!window.confirm("Revert this Rate Cut back to a regular cash payment?")) return;

    try {
      const ok = await revertDebitRateCut(numericId);
      if (ok) {
        showNotification("Rate cut reverted to regular cash payment!", "success");
        await loadParties();
        if (selectedParty) {
          await loadLedger(selectedParty.name);
        }
      } else {
        showNotification("Failed to revert rate cut.", "error");
      }
    } catch (e) {
      showNotification("Error reverting rate cut", "error");
    }
  };

  const handleEditPartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParty) return;
    
    setSubmittingEdit(true);
    try {
      const payload = {
        name: editName.trim(),
        phone: editPhone.trim(),
        gstin: editGstin.trim(),
        address: editAddress.trim(),
        opening_balance_cash: parseFloat(editOpeningCash) || 0.0,
        opening_balance_gold: parseFloat(editOpeningGold) || 0.0,
        opening_balance_silver: parseFloat(editOpeningSilver) || 0.0
      };
      
      let res;
      if (selectedParty.id === 0) {
        res = await createPurchaseParty(payload);
      } else {
        res = await updatePurchaseParty(selectedParty.id, payload);
      }
      
      if (res) {
        showNotification(`Supplier details updated successfully!`, "success");
        setShowEditModal(false);
        await loadParties();
        setSelectedParty(res);
      } else {
        showNotification("Failed to update supplier details.", "error");
      }
    } catch (e) {
      showNotification("Error updating supplier", "error");
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleDeleteParty = async () => {
    if (!selectedParty) return;
    if (selectedParty.id === 0) {
      showNotification("Unregistered parties cannot be deleted as they do not have a database record.", "info");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the supplier "${selectedParty.name}"? This will delete their registered details and opening balances. Historical bills and day book payments will not be deleted.`)) {
      return;
    }
    
    try {
      const ok = await deletePurchaseParty(selectedParty.id);
      if (ok) {
        showNotification(`Supplier "${selectedParty.name}" deleted successfully.`, "success");
        setSelectedParty(null);
        await loadParties();
      } else {
        showNotification("Failed to delete supplier.", "error");
      }
    } catch (e) {
      showNotification("Error deleting supplier", "error");
    }
  };

  const openEditModal = () => {
    if (!selectedParty) return;
    setEditName(selectedParty.name);
    setEditPhone(selectedParty.phone || "");
    setEditGstin(selectedParty.gstin || "");
    setEditAddress(selectedParty.address || "");
    setEditOpeningCash(selectedParty.opening_balance_cash ? selectedParty.opening_balance_cash.toString() : "");
    setEditOpeningGold(selectedParty.opening_balance_gold ? selectedParty.opening_balance_gold.toString() : "");
    setEditOpeningSilver(selectedParty.opening_balance_silver ? selectedParty.opening_balance_silver.toString() : "");
    setShowEditModal(true);
  };

  const filteredParties = parties.filter((p) => {
    const query = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(query) ||
      (p.phone && p.phone.includes(query)) ||
      (p.gstin && p.gstin.toLowerCase().includes(query))
    );
  });

  const handleEnterToNext = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA"
      ) {
        e.preventDefault();
        const container = e.currentTarget;
        const inputs = Array.from(
          container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
            "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])"
          )
        );
        const index = inputs.indexOf(target as any);
        if (index > -1 && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      }
    }
  };

  return (
    <div onKeyDown={handleEnterToNext} style={{ maxWidth: 1120, margin: "0 auto", padding: "0 16px 80px" }}>
      {/* Premium Header */}
      <div style={{
        borderRadius: 20,
        background: "linear-gradient(135deg, #8B6914 0%, #D4AF37 100%)",
        padding: "24px 28px",
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 8px 32px rgba(139, 105, 20, 0.15)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Users size={26} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.3px" }}>
              Purchase Party & Supplier Ledger
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.8)" }}>
              Manage supplier balances · Unified ledgers · Direct Day Book payments integration
            </p>
          </div>
        </div>
        <button
          onClick={loadParties}
          disabled={loading}
          style={{
            background: "rgba(255,255,255,0.15)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 12,
            padding: "8px 12px",
            color: "white",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            transition: "all 0.2s"
          }}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Supplier List & Add Form */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Supplier Search & List Card */}
          <div style={{
            background: "white",
            borderRadius: 20,
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            padding: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#2D1B0E" }}>
                Registered Suppliers ({parties.length})
              </h3>
            </div>
            
            {/* Search Input */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9E8B78" }} size={16} />
              <input
                type="text"
                placeholder="Search by name, GSTIN, mobile..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 12px 10px 38px",
                  borderRadius: 12,
                  border: "1.5px solid #E8E0D4",
                  fontSize: 13,
                  outline: "none",
                  backgroundColor: "#FFFBF5",
                  fontFamily: "Outfit, sans-serif"
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9E8B78" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* List */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
              {loading && parties.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "#9E8B78" }}>
                  <RefreshCw className="animate-spin inline-block mb-2" size={24} />
                  <p style={{ fontSize: 12, fontWeight: 600 }}>Loading suppliers list...</p>
                </div>
              ) : filteredParties.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#9E8B78" }}>
                  <AlertCircle size={24} style={{ display: "inline-block", marginBottom: 8, color: "#C8A87A" }} />
                  <p style={{ fontSize: 13, fontWeight: 600 }}>No suppliers found</p>
                  <p style={{ fontSize: 11, color: "#C8A87A", marginTop: 2 }}>Create one using the form below</p>
                </div>
              ) : (
                filteredParties.map((p) => {
                  const isSelected = selectedParty && selectedParty.name === p.name;
                  const isVirtual = p.id === 0;
                  return (
                    <div
                      key={p.name}
                      onClick={() => setSelectedParty(p)}
                      style={{
                        padding: "12px 16px",
                        borderRadius: 14,
                        border: isSelected ? "1.5px solid #8B6914" : "1.5px solid rgba(0,0,0,0.05)",
                        background: isSelected ? "rgba(212,175,55,0.06)" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "all 0.2s"
                      }}
                      className="hover:shadow-md"
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#2D1B0E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {p.name}
                          </span>
                          {isVirtual && (
                            <span style={{ fontSize: 9, background: "#fef3c7", color: "#92400e", padding: "2px 6px", borderRadius: 6, fontWeight: 700 }}>
                              Unregistered
                            </span>
                          )}
                        </div>
                        {p.gstin && (
                          <span style={{ fontSize: 10, color: "#8B7355", fontFamily: "monospace" }}>
                            GST: {p.gstin}
                          </span>
                        )}
                        {p.phone && (
                          <span style={{ fontSize: 10, color: "#8B7355", display: "flex", alignItems: "center", gap: 3 }}>
                            <Phone size={10} /> {p.phone}
                          </span>
                        )}
                      </div>
                      
                      {/* Balance preview */}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                        <span style={{
                          fontSize: 13,
                          fontWeight: 800,
                          fontFamily: "monospace",
                          color: p.outstanding_cash > 0 ? "#dc2626" : p.outstanding_cash < 0 ? "#16a34a" : "#9E8B78"
                        }}>
                          {fmtCurrency(p.outstanding_cash)}
                        </span>
                        {(p.outstanding_gold > 0 || p.outstanding_silver > 0) && (
                          <div style={{ display: "flex", gap: 4 }}>
                            {p.outstanding_gold > 0 && (
                              <span style={{ fontSize: 9, background: "#fef3c7", color: "#92400e", fontWeight: 700, padding: "1px 4px", borderRadius: 4 }}>
                                🥇 {p.outstanding_gold.toFixed(3)}g
                              </span>
                            )}
                            {p.outstanding_silver > 0 && (
                              <span style={{ fontSize: 9, background: "#e2e8f0", color: "#475569", fontWeight: 700, padding: "1px 4px", borderRadius: 4 }}>
                                🥈 {p.outstanding_silver.toFixed(3)}g
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Add New Supplier Form */}
          <div style={{
            background: "white",
            borderRadius: 20,
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
            padding: 20,
          }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#2D1B0E", display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={18} color="#8B6914" />
              Add New Party (Supplier)
            </h3>
            
            <form onSubmit={handleAddParty} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8B7355", marginBottom: 4 }}>
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikash Gold"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  style={INPUT}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8B7355", marginBottom: 4 }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    style={INPUT}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8B7355", marginBottom: 4 }}>
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 29AAAAA0000A1Z1"
                    value={newGstin}
                    onChange={e => setNewGstin(e.target.value.toUpperCase())}
                    style={INPUT}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8B7355", marginBottom: 4 }}>
                  Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Avenue Road, Bangalore"
                  value={newAddress}
                  onChange={e => setNewAddress(e.target.value)}
                  style={INPUT}
                />
              </div>

              <div style={{ borderTop: "1px dashed rgba(0,0,0,0.06)", paddingTop: 10 }}>
                <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8B6914", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  Opening Outstanding Balances (We owe them)
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 8 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8B7355", marginBottom: 2 }}>
                      Cash (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={newOpeningCash}
                      onChange={e => setNewOpeningCash(e.target.value)}
                      style={INPUT}
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8B7355", marginBottom: 2 }}>
                        Gold (g)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={newOpeningGold}
                        onChange={e => setNewOpeningGold(e.target.value)}
                        style={INPUT}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#8B7355", marginBottom: 2 }}>
                        Silver (g)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={newOpeningSilver}
                        onChange={e => setNewOpeningSilver(e.target.value)}
                        style={INPUT}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingParty}
                style={{
                  width: "100%",
                  background: "linear-gradient(135deg, #8B6914 0%, #D4AF37 100%)",
                  color: "#4A2800",
                  fontWeight: 800,
                  fontSize: 13,
                  padding: "12px",
                  borderRadius: 12,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  boxShadow: "0 4px 12px rgba(139, 105, 20, 0.15)",
                  transition: "all 0.2s"
                }}
              >
                {submittingParty ? <RefreshCw className="animate-spin" size={16} /> : <Plus size={16} />}
                Add Supplier Party
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Detail Ledger */}
        <div className="lg:col-span-7">
          {selectedParty ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              {/* Supplier Info and Quick Stats Card */}
              <div style={{
                background: "white",
                borderRadius: 20,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                padding: 20,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, borderBottom: "1px solid rgba(0,0,0,0.05)", paddingBottom: 16, marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#2D1B0E" }}>
                      {selectedParty.name}
                    </h2>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6, fontSize: 12, color: "#8B7355" }}>
                      {selectedParty.phone && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Phone size={12} /> {selectedParty.phone}
                        </span>
                      )}
                      {selectedParty.gstin && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Tag size={12} /> GST: {selectedParty.gstin}
                        </span>
                      )}
                      {selectedParty.address && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <MapPin size={12} /> {selectedParty.address}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {selectedParty.id > 0 && (
                      <button
                        onClick={handleDeleteParty}
                        style={{
                          background: "#fef2f2",
                          border: "1.5px solid #ef4444",
                          color: "#ef4444",
                          borderRadius: 12,
                          padding: "9px 15px",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          transition: "all 0.2s"
                        }}
                        className="hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Delete Party
                      </button>
                    )}

                    <button
                      onClick={openEditModal}
                      style={{
                        background: "white",
                        border: "1.5px solid #8B6914",
                        color: "#8B6914",
                        borderRadius: 12,
                        padding: "9px 15px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        transition: "all 0.2s"
                      }}
                      className="hover:bg-amber-50/50"
                    >
                      <Edit size={14} />
                      {selectedParty.id === 0 ? "Register Party" : "Edit Details"}
                    </button>
                    
                    <button
                      onClick={handleOpenAddBillModal}
                      style={{
                        background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 16px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 12px rgba(5, 150, 105, 0.2)",
                        transition: "all 0.2s"
                      }}
                      className="hover:scale-[1.02]"
                    >
                      <FileText size={15} />
                      + Add Bill
                    </button>

                    <button
                      onClick={() => {
                        const cashPayments = transactions.filter(t => t.type === "payment" && !t.is_rate_cut);
                        if (cashPayments.length > 0) {
                          const latest = cashPayments[cashPayments.length - 1];
                          openConvertModal(latest.id, latest.amount, latest.reference);
                        } else {
                          setIsRateCutPayment(true);
                          setShowPaymentModal(true);
                        }
                      }}
                      style={{
                        background: "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 16px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 12px rgba(217, 119, 6, 0.2)",
                        transition: "all 0.2s"
                      }}
                      className="hover:scale-[1.02]"
                    >
                      <Coins size={15} />
                      Rate Cut (Fix Rate)
                    </button>

                    <button
                      onClick={() => setShowPaymentModal(true)}
                      style={{
                        background: "#dc2626",
                        color: "white",
                        border: "none",
                        borderRadius: 12,
                        padding: "10px 18px",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 12px rgba(220, 38, 38, 0.15)",
                        transition: "all 0.2s"
                      }}
                      className="hover:scale-[1.02]"
                    >
                      <CreditCard size={15} />
                      Give Amount (Pay)
                    </button>
                  </div>
                </div>

                {/* Balance Cards Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                  <div style={{ background: "rgba(220, 38, 38, 0.04)", border: "1.5px solid rgba(220, 38, 38, 0.1)", borderRadius: 16, padding: "14px 16px" }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Outstanding Cash
                    </span>
                    <span style={{ display: "block", fontSize: 20, fontWeight: 900, color: "#2D1B0E", fontFamily: "monospace", marginTop: 4 }}>
                      {fmtCurrency(selectedParty.outstanding_cash)}
                    </span>
                    <span style={{ display: "block", fontSize: 10, color: "#9E8B78", marginTop: 2 }}>
                      {selectedParty.outstanding_cash > 0 ? "We owe supplier" : selectedParty.outstanding_cash < 0 ? "Supplier owes us" : "All settled"}
                    </span>
                  </div>

                  <div style={{ background: "rgba(212, 175, 55, 0.04)", border: "1.5px solid rgba(212, 175, 55, 0.1)", borderRadius: 16, padding: "14px 16px" }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#8B6914", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Outstanding Gold
                    </span>
                    <span style={{ display: "block", fontSize: 20, fontWeight: 900, color: "#2D1B0E", fontFamily: "monospace", marginTop: 4 }}>
                      {selectedParty.outstanding_gold.toFixed(3)} g
                    </span>
                    <span style={{ display: "block", fontSize: 10, color: "#9E8B78", marginTop: 2 }}>
                      Pure metal balance
                    </span>
                  </div>

                  <div style={{ background: "rgba(71, 85, 105, 0.04)", border: "1.5px solid rgba(71, 85, 105, 0.1)", borderRadius: 16, padding: "14px 16px" }}>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Outstanding Silver
                    </span>
                    <span style={{ display: "block", fontSize: 20, fontWeight: 900, color: "#2D1B0E", fontFamily: "monospace", marginTop: 4 }}>
                      {selectedParty.outstanding_silver.toFixed(3)} g
                    </span>
                    <span style={{ display: "block", fontSize: 10, color: "#9E8B78", marginTop: 2 }}>
                      Pure metal balance
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Ledger Card */}
              <div style={{
                background: "white",
                borderRadius: 20,
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
                padding: 20,
                minHeight: 300,
              }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#2D1B0E", display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={18} color="#8B6914" />
                  Ledger Statement / Transaction History
                </h3>

                {ledgerLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, color: "#9E8B78" }}>
                    <RefreshCw className="animate-spin mb-2" size={24} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Loading ledger statement...</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, color: "#9E8B78", border: "1.5px dashed rgba(0,0,0,0.05)", borderRadius: 16 }}>
                    <AlertCircle size={26} style={{ color: "#C8A87A", marginBottom: 6 }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>No transactions recorded yet</span>
                    <span style={{ fontSize: 11, color: "#C8A87A", marginTop: 2 }}>Bills and Day Book payments will log here</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    
                    {/* Header line for statement */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 2.5fr 1.3fr",
                      fontSize: 10,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      color: "#8B7355",
                      borderBottom: "2px solid rgba(0,0,0,0.05)",
                      paddingBottom: 8,
                      fontFamily: "sans-serif"
                    }}>
                      <div>Date</div>
                      <div>Type</div>
                      <div>Particulars / Items</div>
                      <div style={{ textAlign: "right" }}>Amount (₹) / Metal</div>
                    </div>

                    {/* Timeline items */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: 450 }}>
                      {transactions.map((tx) => {
                        const isBill = tx.type === "bill";
                        return (
                          <div
                            key={tx.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1.2fr 1fr 2.5fr 1.3fr",
                              alignItems: "center",
                              padding: "10px 0",
                              borderBottom: "1px solid rgba(0,0,0,0.03)",
                              fontSize: 12.5,
                              fontFamily: "Outfit, sans-serif"
                            }}
                          >
                            <div style={{ fontWeight: 600, color: "#2D1B0E" }}>
                              {fmtDateFriendly(tx.date)}
                            </div>
                            
                            {/* Type tag */}
                            <div>
                              <span style={{
                                fontSize: 9.5,
                                fontWeight: 800,
                                textTransform: "uppercase",
                                padding: "2.5px 7px",
                                borderRadius: 6,
                                background: isBill ? "rgba(139, 105, 20, 0.08)" : tx.is_rate_cut ? "rgba(217, 119, 6, 0.1)" : "rgba(220, 38, 38, 0.08)",
                                color: isBill ? "#8B6914" : tx.is_rate_cut ? "#b45309" : "#dc2626"
                              }}>
                                {isBill ? "BILL" : tx.is_rate_cut ? "RATE CUT" : "PAYMENT"}
                              </span>
                            </div>

                            {/* Reference / Details */}
                            <div style={{ display: "flex", flexDirection: "column", paddingRight: 8 }}>
                              <span style={{ fontWeight: 700, color: "#2D1B0E" }}>
                                {tx.reference}
                              </span>
                              <span style={{ fontSize: 10.5, color: "#8B7355", marginTop: 1 }}>
                                {tx.details}
                              </span>
                              {!isBill && (
                                <div style={{ marginTop: 3 }}>
                                  {tx.is_rate_cut ? (
                                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                      <span style={{
                                        fontSize: 9.5,
                                        fontWeight: 800,
                                        background: tx.metal === "GOLD" ? "#fef3c7" : "#f1f5f9",
                                        border: `1px solid ${tx.metal === "GOLD" ? "#f59e0b" : "#94a3b8"}`,
                                        color: tx.metal === "GOLD" ? "#92400e" : "#334155",
                                        padding: "1px 5px",
                                        borderRadius: 4
                                      }}>
                                        ⚖️ {tx.pure_weight.toFixed(3)}g {tx.metal} @ ₹{tx.rate}/g
                                      </span>
                                      <button
                                        onClick={() => openConvertModal(tx.id, tx.amount, tx.reference, tx.rate, tx.metal)}
                                        title="Edit Rate Cut Rate"
                                        style={{ background: "none", border: "none", color: "#d97706", cursor: "pointer", padding: "1px 3px" }}
                                      >
                                        <Edit size={11} />
                                      </button>
                                      <button
                                        onClick={() => handleRevertRateCut(tx.id)}
                                        title="Revert to Regular Cash Payment"
                                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "1px 3px" }}
                                      >
                                        <RotateCcw size={11} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => openConvertModal(tx.id, tx.amount, tx.reference)}
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 800,
                                        color: "#b45309",
                                        background: "#fffbeb",
                                        border: "1px solid #fde68a",
                                        borderRadius: 6,
                                        padding: "2.5px 7px",
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 4,
                                        transition: "all 0.2s"
                                      }}
                                      className="hover:bg-amber-100 shadow-sm"
                                    >
                                      <Coins size={11} />
                                      Rate Cut (Convert to Metal)
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Amount / Weight */}
                            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{
                                  fontWeight: 800,
                                  color: isBill ? "#dc2626" : "#16a34a",
                                  fontFamily: "monospace"
                                }}>
                                  {isBill ? "+" : "—"} {fmtCurrency(tx.amount)}
                                </span>
                                <button
                                  onClick={() => handleDeleteTxn(tx)}
                                  title={isBill ? "Delete Purchase Bill" : "Delete Payment"}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#9ca3af",
                                    cursor: "pointer",
                                    padding: 2,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    transition: "color 0.2s"
                                  }}
                                  className="hover:text-red-600"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                              {isBill && !tx.is_rate_cut && tx.pure_weight > 0 && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, background: tx.metal === "GOLD" ? "#fef3c7" : "#e2e8f0", color: tx.metal === "GOLD" ? "#92400e" : "#475569", padding: "1px 4px", borderRadius: 4, marginTop: 2 }}>
                                  Pure Weight: {tx.pure_weight.toFixed(3)}g
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              background: "white",
              borderRadius: 20,
              border: "1px solid rgba(0,0,0,0.06)",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)",
              padding: "48px 24px",
              textAlign: "center",
              color: "#9E8B78",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              minHeight: 400
            }}>
              <Users size={48} style={{ color: "#C8A87A", marginBottom: 14 }} />
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#2D1B0E" }}>
                No Party Selected
              </h3>
              <p style={{ margin: 0, fontSize: 13, maxWidth: 300, lineHeight: 1.4 }}>
                Select a supplier from the list on the left to see their outstanding balance, transaction statement, or give payments.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── RECORD PAYMENT MODAL ── */}
      {showPaymentModal && selectedParty && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)", position: "fixed", left: 0, top: 0, right: 0, bottom: 0 }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 24,
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(212,175,55,0.1)",
              overflow: "hidden",
            }}
          >
            {/* Header banner */}
            <div style={{ height: 4, background: "#dc2626" }} />
            <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 className="font-bold text-base" style={{ color: "#2D1B0E", fontFamily: "Georgia, serif" }}>
                  Record Payment (Give Amount)
                </h3>
                <p className="text-xs" style={{ color: "#8B7355", marginTop: 2 }}>
                  Paying to: <b>{selectedParty.name}</b>
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9E8B78" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm"
                  style={{ background: "#FFFBF5" }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                  Amount Given (₹) *
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "#8B7355" }}>₹</span>
                  <input
                    type="number"
                    required
                    placeholder="Enter amount given"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm font-bold"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                  Payment Mode *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CASH", "UPI", "OTHER"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMode(m)}
                      className="py-2 rounded-xl text-xs font-bold transition-all"
                      style={{
                        border: `1.5px solid ${paymentMode === m ? "#dc2626" : "#E8E0D4"}`,
                        background: paymentMode === m ? "rgba(220, 38, 38, 0.05)" : "white",
                        color: paymentMode === m ? "#dc2626" : "#4a5568",
                        cursor: "pointer"
                      }}
                    >
                      {m === "CASH" ? "💵 Cash" : m === "UPI" ? "📱 UPI" : "🏦 Bank/Other"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via HDFC Bank / Cash in hand"
                  value={paymentRemarks}
                  onChange={e => setPaymentRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm"
                  style={{ background: "#FFFBF5" }}
                />
              </div>

              {/* Rate Cut / Metal Conversion Section */}
              <div style={{ borderTop: "1px dashed rgba(0,0,0,0.06)", paddingTop: 10 }}>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer" style={{ color: "#8B6914" }}>
                  <input
                    type="checkbox"
                    checked={isRateCutPayment}
                    onChange={e => {
                      setIsRateCutPayment(e.target.checked);
                      if (!e.target.checked) {
                        setRateCutRate("");
                      }
                    }}
                  />
                  <span>Convert Cash to Metal (Rate Cut)?</span>
                </label>
                
                {isRateCutPayment && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: "#8B7355" }}>
                          Select Metal
                        </label>
                        <div style={{ display: "flex", gap: 6 }}>
                          {(["GOLD", "SILVER"] as const).map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setRateCutMetal(m)}
                              style={{
                                flex: 1,
                                padding: "6px 0",
                                borderRadius: 8,
                                fontSize: 11,
                                fontWeight: 700,
                                border: `1.5px solid ${rateCutMetal === m ? "#8B6914" : "#E8E0D4"}`,
                                background: rateCutMetal === m ? "rgba(212,175,55,0.08)" : "white",
                                color: rateCutMetal === m ? "#8B6914" : "#4a5568",
                                cursor: "pointer"
                              }}
                            >
                              {m === "GOLD" ? "🥇 GOLD" : "🥈 SILVER"}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[11px] font-semibold mb-1" style={{ color: "#8B7355" }}>
                          Pure Rate (₹/g) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 14200"
                          value={rateCutRate}
                          onChange={e => setRateCutRate(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs"
                          style={{ background: "#FFFBF5" }}
                        />
                      </div>
                    </div>
                    
                    {parseFloat(paymentAmount) > 0 && parseFloat(rateCutRate) > 0 && (
                      <div style={{
                        padding: "8px 12px",
                        background: "rgba(22, 163, 74, 0.04)",
                        border: "1px solid rgba(22, 163, 74, 0.1)",
                        borderRadius: 10,
                        fontSize: 11,
                        color: "#166534",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}>
                        <span>✨ Deduct Weight:</span>
                        <b style={{ fontFamily: "monospace", fontSize: 12 }}>
                          {(parseFloat(paymentAmount) / parseFloat(rateCutRate)).toFixed(3)} g
                        </b>
                        <span>of pure {rateCutMetal.toLowerCase()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 10, paddingTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs transition-colors bg-white hover:bg-amber-50/50"
                  style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#8B6914" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-1.5"
                  style={{
                    background: "linear-gradient(135deg, #b91c1c, #dc2626)",
                    color: "white",
                    boxShadow: "0 2px 8px rgba(220, 38, 38, 0.25)",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  {submittingPayment ? <RefreshCw className="animate-spin" size={12} /> : "Record Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EDIT SUPPLIER DETAILS / REGISTER MODAL ── */}
      {showEditModal && selectedParty && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)", position: "fixed", left: 0, top: 0, right: 0, bottom: 0 }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 24,
              maxWidth: 420,
              width: "100%",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(212,175,55,0.1)",
              overflow: "hidden",
            }}
          >
            {/* Header banner */}
            <div style={{ height: 4, background: "#8B6914" }} />
            <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <h3 className="font-bold text-base" style={{ color: "#2D1B0E", fontFamily: "Georgia, serif", margin: 0 }}>
                  {selectedParty.id === 0 ? "Register Supplier Party" : "Edit Supplier Details"}
                </h3>
                <p className="text-xs" style={{ color: "#8B7355", margin: 0 }}>
                  Supplier: <b>{selectedParty.name}</b>
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9E8B78" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleEditPartySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                  Supplier Name (Read-Only)
                </label>
                <input
                  type="text"
                  disabled
                  value={editName}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none text-sm bg-gray-50 text-gray-500 font-bold"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                    Phone Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                    GSTIN
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 29AAAAA0000A1Z1"
                    value={editGstin}
                    onChange={e => setEditGstin(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                  Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Avenue Road, Bangalore"
                  value={editAddress}
                  onChange={e => setEditAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm"
                  style={{ background: "#FFFBF5" }}
                />
              </div>

              <div style={{ borderTop: "1px dashed rgba(0,0,0,0.06)", paddingTop: 10 }}>
                <span style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#8B6914", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  Opening Balances (We owe them)
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1" style={{ color: "#8B7355" }}>
                      Cash Opening Balance (₹)
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={editOpeningCash}
                      onChange={e => setEditOpeningCash(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm"
                      style={{ background: "#FFFBF5" }}
                    />
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: "#8B7355" }}>
                        Gold (g)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={editOpeningGold}
                        onChange={e => setEditOpeningGold(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm"
                        style={{ background: "#FFFBF5" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1" style={{ color: "#8B7355" }}>
                        Silver (g)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        placeholder="0.000"
                        value={editOpeningSilver}
                        onChange={e => setEditOpeningSilver(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm"
                        style={{ background: "#FFFBF5" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, paddingTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs transition-colors bg-white hover:bg-amber-50/50"
                  style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#8B6914" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEdit}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-1.5"
                  style={{
                    background: "linear-gradient(135deg,#c8960c,#D4AF37)",
                    color: "#4A2800",
                    boxShadow: "0 2px 8px rgba(212,175,55,0.25)",
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  {submittingEdit ? <RefreshCw className="animate-spin" size={12} /> : (selectedParty.id === 0 ? "Register Party" : "Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CONVERT PAYMENT TO RATE CUT MODAL ── */}
      {showConvertModal && selectedParty && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)", position: "fixed", left: 0, top: 0, right: 0, bottom: 0 }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 24,
              maxWidth: 440,
              width: "100%",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(212,175,55,0.1)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ height: 4, background: "linear-gradient(90deg, #d97706, #f59e0b)" }} />
            <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 className="font-bold text-base flex items-center gap-2" style={{ color: "#2D1B0E", fontFamily: "Georgia, serif" }}>
                  <Coins className="text-amber-600" size={20} />
                  Convert Cash Payment to Metal (Rate Cut)
                </h3>
                <p className="text-xs" style={{ color: "#8B7355", marginTop: 2 }}>
                  Supplier: <b>{selectedParty.name}</b>
                </p>
              </div>
              <button
                onClick={() => setShowConvertModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9E8B78" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleConvertRateCutSubmit} className="p-6 space-y-4">
              {/* Payment Summary Box */}
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: "12px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309", textTransform: "uppercase" }}>
                  Selected Payment Amount
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#78350f", fontFamily: "monospace", marginTop: 2 }}>
                  {fmtCurrency(convertingAmount)}
                </div>
                {convertingRef && (
                  <div style={{ fontSize: 11, color: "#92400e", marginTop: 2 }}>
                    Reference: {convertingRef}
                  </div>
                )}
              </div>

              {/* Select Metal */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                  Select Target Metal *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(["GOLD", "SILVER"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setConvertMetal(m)}
                      className="py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                      style={{
                        border: `1.5px solid ${convertMetal === m ? "#d97706" : "#E8E0D4"}`,
                        background: convertMetal === m ? "rgba(217, 119, 6, 0.08)" : "white",
                        color: convertMetal === m ? "#92400e" : "#4a5568",
                        cursor: "pointer"
                      }}
                    >
                      {m === "GOLD" ? "🪙 Pure Gold (24K)" : "🥈 Pure Silver"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rate Input */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#8B7355" }}>
                  Fix Rate (₹ per gram) *
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontWeight: 700, color: "#8B7355" }}>₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={convertMetal === "GOLD" ? "e.g. 7000 (rate per gram)" : "e.g. 100 (rate per gram)"}
                    value={convertRate}
                    onChange={e => setConvertRate(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-amber-200 outline-none text-sm font-bold"
                    style={{ background: "#FFFBF5" }}
                  />
                  <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: "#92400e" }}>
                    / gram
                  </span>
                </div>
              </div>

              {/* Calculated Weight Result Preview */}
              {parseFloat(convertRate) > 0 && (
                <div style={{ background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: 14, padding: "12px 16px" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#047857", display: "block" }}>
                    Calculated Metal Weight:
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "#065f46", fontFamily: "monospace", display: "block", marginTop: 2 }}>
                    {(convertingAmount / parseFloat(convertRate)).toFixed(3)} grams
                  </span>
                  <span style={{ fontSize: 10.5, color: "#047857", display: "block", marginTop: 2 }}>
                    {fmtCurrency(convertingAmount)} ÷ ₹{convertRate}/g = {(convertingAmount / parseFloat(convertRate)).toFixed(3)}g of pure {convertMetal.toLowerCase()}
                  </span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  className="w-1/3 py-3 rounded-xl border border-gray-300 font-bold text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingConvert}
                  className="w-2/3 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 text-white font-extrabold text-xs shadow-lg hover:brightness-110 flex items-center justify-center gap-2"
                >
                  {submittingConvert ? <RefreshCw className="animate-spin" size={16} /> : <Coins size={16} />}
                  Confirm Rate Cut
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Purchase Bill Modal */}
      {showAddBillModal && selectedParty && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(45, 27, 14, 0.6)",
          backdropFilter: "blur(4px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16
        }}>
          <div style={{
            background: "#FAF7F2",
            borderRadius: 24,
            width: "100%",
            maxWidth: 540,
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            border: "1.5px solid #E8E0D4",
            overflow: "hidden",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Modal Header */}
            <div style={{
              background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
              padding: "18px 24px",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={18} /> Add Purchase Bill
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 11, opacity: 0.9 }}>
                  Supplier: <strong>{selectedParty.name}</strong> {selectedParty.gstin ? `(${selectedParty.gstin})` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddBillModal(false)}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", borderRadius: "50%", width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePurchaseBill} style={{ padding: 20, overflowY: "auto" }} className="space-y-4">
              
              {/* Row 1: Bill No & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-emerald-950 uppercase tracking-wide">
                    Bill Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BILL-101, INV-502"
                    value={billNo}
                    onChange={(e) => setBillNo(e.target.value)}
                    style={INPUT}
                    className="font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1 text-emerald-950 uppercase tracking-wide">
                    Bill Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    style={INPUT}
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Metal Type & Purity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-emerald-950 uppercase tracking-wide">
                    Metal Type *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["GOLD", "SILVER"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setBillMetal(m)}
                        className={`py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border ${
                          billMetal === m
                            ? m === "GOLD" ? "bg-amber-600 text-white border-amber-700 shadow-xs" : "bg-slate-700 text-white border-slate-800 shadow-xs"
                            : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {m === "GOLD" ? "🪙 Gold" : "🥈 Silver"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-emerald-950 uppercase tracking-wide">
                    Purity / Touch *
                  </label>
                  <select
                    value={billPurity}
                    onChange={(e) => setBillPurity(e.target.value)}
                    style={INPUT}
                    className="font-bold"
                  >
                    {billMetal === "GOLD" ? (
                      <>
                        <option value="91.6%">91.6% (22K Hallmark)</option>
                        <option value="75.0%">75.0% (18K Hallmark)</option>
                        <option value="99.9%">99.9% (24K Pure)</option>
                        <option value="100%">100% (100.0% Pure)</option>
                        <option value="KDM 75HM">KDM 75HM</option>
                        <option value="58.5%">58.5% (14K)</option>
                      </>
                    ) : (
                      <>
                        <option value="92.5%">92.5% (Sterling Silver)</option>
                        <option value="99.9%">99.9% (Fine Silver)</option>
                        <option value="100%">100% (100.0% Pure Silver)</option>
                        <option value="80.0%">80.0% (Silver Ornaments)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Row 3: Total Weight & Rate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-emerald-950 uppercase tracking-wide">
                    Total Weight (grams) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    placeholder="e.g. 25.500"
                    value={billTotalWeight}
                    onChange={(e) => setBillTotalWeight(e.target.value)}
                    style={INPUT}
                    className="font-mono font-bold text-amber-950"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-emerald-950 uppercase tracking-wide">
                    Rate per Gram (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 7200"
                    value={billRate}
                    onChange={(e) => setBillRate(e.target.value)}
                    style={INPUT}
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Row 4: Total Amount override */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1 text-emerald-950 uppercase tracking-wide">
                    Invoice Total (₹)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={
                      parseFloat(billTotalWeight) > 0 && parseFloat(billRate) > 0
                        ? `₹${(parseFloat(billTotalWeight) * parseFloat(billRate)).toFixed(2)}`
                        : "Enter total amount"
                    }
                    value={billInvoiceTotal}
                    onChange={(e) => setBillInvoiceTotal(e.target.value)}
                    style={INPUT}
                    className="font-mono font-bold text-emerald-900"
                  />
                </div>

                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={billIsRateCut}
                      onChange={(e) => setBillIsRateCut(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 accent-emerald-700"
                    />
                    <span>Rate Cut (Fix Rate Bill)</span>
                  </label>
                </div>
              </div>

              {/* Row 5: Remarks / Items List */}
              <div>
                <label className="block text-xs font-bold mb-1 text-emerald-950 uppercase tracking-wide">
                  Items / Remarks (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gold Chain 15g, Ring 10.5g"
                  value={billItemsText}
                  onChange={(e) => setBillItemsText(e.target.value)}
                  style={INPUT}
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddBillModal(false)}
                  className="w-1/3 py-3 rounded-xl border border-gray-300 font-bold text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBill}
                  className="w-2/3 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-800 text-white font-extrabold text-xs shadow-lg hover:brightness-110 flex items-center justify-center gap-2"
                >
                  {submittingBill ? <RefreshCw className="animate-spin" size={16} /> : <FileText size={16} />}
                  Save Purchase Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline styles mirroring PurchaseBillView design
const INPUT = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: "11px",
  border: "1.5px solid #E8E0D4",
  outline: "none",
  fontSize: "12.5px",
  fontFamily: "Outfit, sans-serif",
  backgroundColor: "#FFFBF5",
  color: "#2D1B0E",
  transition: "all 0.2s",
};
