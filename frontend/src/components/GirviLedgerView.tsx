"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, Printer, CheckCircle, Trash2, X, RefreshCw, AlertCircle, Coins, BookOpen, Pencil, Undo2 } from "lucide-react";
import { PledgeEntry, fetchAllPledges, updatePledgeEntry, addSubEntry, fetchDayBook, PledgePayment, addPledgePayment, deletePledgePayment, revertPledgeRelease, API_BASE } from "../utils/api";
import { formatGirviReminderMsg, formatGirviReleaseMsg, openWhatsApp, sanitizePhoneNumber } from "../utils/whatsapp";


const formatDateDMY = (dateStr: string | undefined) => {
  if (!dateStr) return "—";
  if (dateStr.includes("/")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

// Subtract exactly 1 year from due date in a timezone-safe manner
const getPledgeDateFromDueDate = (dueDateStr: string | undefined): string => {
  if (!dueDateStr) return "";
  const parts = dueDateStr.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parts[1];
    const d = parts[2];
    return `${y - 1}-${m}-${d}`;
  }
  return dueDateStr;
};


const calculateRedemptionInterest = (
  pledgeDateStr: string | undefined,
  releaseDateStr: string,
  principal: number,
  ornament: string
) => {
  if (!pledgeDateStr || !releaseDateStr) return { months: 0, days: 0, chargeMonths: 0, interest: 0, total: principal };

  const start = new Date(pledgeDateStr);
  const end = new Date(releaseDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return { months: 0, days: 0, chargeMonths: 0, interest: 0, total: principal };
  }

  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    const prevMonthDate = new Date(end.getFullYear(), end.getMonth(), 0);
    days += prevMonthDate.getDate();
  }

  // Determine metal from ornament name (default to Gold)
  const isSilver = /silver|chandi|sil/i.test(ornament);
  
  // Read customized rates & grace days
  const storedGoldRate = typeof window !== "undefined" ? localStorage.getItem("gold_interest_rate") : null;
  const storedSilverRate = typeof window !== "undefined" ? localStorage.getItem("silver_interest_rate") : null;
  const storedGraceDays = typeof window !== "undefined" ? localStorage.getItem("grace_days") : null;

  const goldRateVal = storedGoldRate ? parseFloat(storedGoldRate) / 100 : 0.03;
  const silverRateVal = storedSilverRate ? parseFloat(storedSilverRate) / 100 : 0.10;
  const graceDaysVal = storedGraceDays ? parseInt(storedGraceDays, 10) : 0;

  const ratePerMonth = isSilver ? silverRateVal : goldRateVal;

  let chargeMonths = months;
  if (months === 0) {
    chargeMonths = 1; // minimum 1 month
  } else {
    if (days > graceDaysVal) {
      if (days > 7) {
        chargeMonths += 1;
      }
    }
  }

  const interest = Math.round(principal * ratePerMonth * chargeMonths);
  const total = principal + interest;

  return {
    months,
    days,
    chargeMonths,
    interest,
    total,
  };
};

interface GirviLedgerViewProps {
  currentDate: string;
  onRefreshDaybook?: () => void;
  onSelectPrintPledge: (pledge: PledgeEntry) => void;
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
  onSwitchToForm: () => void;
}

export default function GirviLedgerView({
  currentDate,
  onRefreshDaybook,
  onSelectPrintPledge,
  showNotification,
  onSwitchToForm,
}: GirviLedgerViewProps) {
  const [pledges, setPledges] = useState<PledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "RELEASED">("ALL");
  const [metalFilter, setMetalFilter] = useState<"ALL" | "GOLD" | "SILVER">("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "OLDEST" | "AMOUNT_HIGH_TO_LOW" | "AMOUNT_LOW_TO_HIGH" | "NAME_AZ" | "NAME_ZA" | "WEIGHT_HIGH_TO_LOW">("NEWEST");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  const [minWeightFilter, setMinWeightFilter] = useState("");
  const [maxWeightFilter, setMaxWeightFilter] = useState("");

  // Detailed Modal States
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showBandaModal, setShowBandaModal] = useState(false);
  const [selectedPledge, setSelectedPledge] = useState<PledgeEntry | null>(null);

  // Payment Ledger Modal States
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerPledge, setLedgerPledge] = useState<PledgeEntry | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    payment_type: "INTEREST" as "INTEREST" | "PRINCIPAL" | "TOP_UP",
    amount: "",
    payment_method: "CASH" as "CASH" | "UPI" | "OTHER",
    date: currentDate || new Date().toISOString().split("T")[0],
  });
  const [paymentUpiAccount, setPaymentUpiAccount] = useState("hdfc_192");

  // Form State - Release Pledge
  const [releaseForm, setReleaseForm] = useState({
    release_date: currentDate || new Date().toISOString().split("T")[0],
    interest_received: "",
    method: "CASH",
    splitCash: "",
    splitUpi: "",
    splitUpiAccount: "hdfc_192",
  });

  // Form State - Banda (Interest Taken)
  const [bandaForm, setBandaForm] = useState({
    date: currentDate || new Date().toISOString().split("T")[0],
    interest_received: "",
    method: "CASH",
  });

  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [parsedRecords, setParsedRecords] = useState<any[]>([]);

  const handleExportCSV = () => {
    const headers = [
      "Pledge No", "Date", "Customer Name", "Relation", "Relation Name", "Mobile", "Income", "Address", 
      "Ornament", "Quantity", "Gross Weight (g)", "Less Weight (g)", "Net Weight (g)", "Estimated Value (₹)",
      "Principal Amount (₹)", "Interest Rate (%)", "Interest Rate Text", "Redemption Period (Months)",
      "Interest Payment Frequency", "Due Date", "Status", "Release Date", "Is Repledged", "Repledged Bank",
      "Repledged Amount (₹)", "Repledged Date", "Repledged Name", "Repledged Receipt No", "Repledged Interest Rate"
    ];
    
    const rows = pledges.map(p => {
      const payDetails = parsePledgePaymentDetails(p.customer_name);
      return [
        p.pledge_no || "",
        p.date || "",
        payDetails.cleanName || "",
        p.pawner_relation || "",
        p.pawner_relation_name || "",
        p.mobile || "",
        p.income || "",
        p.address || "",
        p.ornament || "",
        p.quantity || 1,
        p.gross_weight || 0,
        p.less_weight || 0,
        p.net_weight || p.weight || 0,
        p.estimated_value || 0,
        p.amount || 0,
        p.interest_percentage || 0,
        p.interest_rate_text || "",
        p.redemption_period_months || 12,
        p.interest_payment_frequency || "",
        p.due_date || "",
        p.status || "",
        p.release_date || "",
        p.is_repledged ? "YES" : "NO",
        p.repledged_bank || "",
        p.repledged_amount || 0,
        p.repledged_date || "",
        p.repledged_name || "",
        p.repledged_receipt_no || "",
        p.repledged_interest_rate || ""
      ];
    });
    
    // Add BOM header to support UTF-8 characters correctly in Excel
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `girvi_ledger_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Ledger exported successfully!", "success");
  };

  const handleCSVFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError("");
    setParsedRecords([]);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length <= 1) {
          setImportError("CSV file is empty or missing data rows.");
          return;
        }

        const parseCSVLine = (line: string) => {
          const result = [];
          let current = "";
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[\s_()₹]/g, ""));
        
        const pledgeNoIdx = headers.findIndex(h => h.includes("pledge") || h.includes("no") || h.includes("num"));
        const dateIdx = headers.findIndex(h => h.includes("date") || h.includes("registered"));
        const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("customer") || h.includes("owner") || h.includes("pawner"));
        const mobileIdx = headers.findIndex(h => h.includes("mobile") || h.includes("phone") || h.includes("contact"));
        const addressIdx = headers.findIndex(h => h.includes("address") || h.includes("location"));
        const ornamentIdx = headers.findIndex(h => h.includes("ornament") || h.includes("item") || h.includes("article"));
        const weightIdx = headers.findIndex(h => h.includes("weight") && !h.includes("gross") && !h.includes("less") && !h.includes("net"));
        const amountIdx = headers.findIndex(h => h.includes("amount") || h.includes("principal") || h.includes("loan") || h.includes("price"));
        const statusIdx = headers.findIndex(h => h.includes("status"));

        const relationIdx = headers.findIndex(h => h.includes("relation") && !h.includes("relationname"));
        const relationNameIdx = headers.findIndex(h => h.includes("relationname") || h.includes("relation_name"));
        const incomeIdx = headers.findIndex(h => h.includes("income"));
        const qtyIdx = headers.findIndex(h => h.includes("quantity") || h.includes("qty") || h.includes("pieces") || h.includes("pcs"));
        const grossWeightIdx = headers.findIndex(h => h.includes("gross"));
        const lessWeightIdx = headers.findIndex(h => h.includes("less"));
        const netWeightIdx = headers.findIndex(h => h.includes("net"));
        const estValueIdx = headers.findIndex(h => h.includes("estimated") || h.includes("value") || h.includes("val"));

        if (nameIdx === -1 || amountIdx === -1 || ornamentIdx === -1) {
          setImportError("Required columns (Customer Name, Ornament, Principal/Amount) could not be identified.");
          return;
        }

        const records: any[] = [];
        const parseRobustFloat = (val: string | null | undefined): number => {
          if (!val) return 0;
          const clean = val.replace(/[₹$,\s"]/g, "");
          const num = parseFloat(clean);
          return isNaN(num) ? 0 : num;
        };
        const cleanString = (val: string | null | undefined): string => {
          if (!val) return "";
          let s = val.trim();
          if (s.startsWith('"') && s.endsWith('"')) {
            s = s.slice(1, -1);
          }
          return s.trim();
        };
        const parseRobustDate = (val: string | null | undefined): string => {
          if (!val) return new Date().toISOString().split("T")[0];
          let s = cleanString(val);
          const ddmmyyyyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
          const match = s.match(ddmmyyyyRegex);
          if (match) {
            const day = match[1].padStart(2, "0");
            const month = match[2].padStart(2, "0");
            const year = match[3];
            return `${year}-${month}-${day}`;
          }
          return s;
        };

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;

          const pledge_no = pledgeNoIdx !== -1 && cols[pledgeNoIdx] ? cleanString(cols[pledgeNoIdx]) : `IMP-${Date.now().toString().slice(-4)}-${i}`;
          const date = dateIdx !== -1 && cols[dateIdx] ? parseRobustDate(cols[dateIdx]) : new Date().toISOString().split("T")[0];
          const customer_name = nameIdx !== -1 ? cleanString(cols[nameIdx]) : "";
          const mobile = mobileIdx !== -1 ? cleanString(cols[mobileIdx]) : "";
          const address = addressIdx !== -1 ? cleanString(cols[addressIdx]) : "";
          const ornament = ornamentIdx !== -1 ? cleanString(cols[ornamentIdx]) : "";
          const amount = amountIdx !== -1 ? parseRobustFloat(cols[amountIdx]) : 0.0;
          const status = statusIdx !== -1 ? cleanString(cols[statusIdx]).toUpperCase() : "ACTIVE";

          const pawner_relation = relationIdx !== -1 ? cleanString(cols[relationIdx]) : "";
          const pawner_relation_name = relationNameIdx !== -1 ? cleanString(cols[relationNameIdx]) : "";
          const income = incomeIdx !== -1 ? cleanString(cols[incomeIdx]) : "";
          const quantity = qtyIdx !== -1 ? parseRobustFloat(cols[qtyIdx]) || 1 : 1;
          const gross_weight = grossWeightIdx !== -1 ? parseRobustFloat(cols[grossWeightIdx]) : 0.0;
          const less_weight = lessWeightIdx !== -1 ? parseRobustFloat(cols[lessWeightIdx]) : 0.0;
          const net_weight = netWeightIdx !== -1 ? parseRobustFloat(cols[netWeightIdx]) : 0.0;
          const estimated_value = estValueIdx !== -1 ? parseRobustFloat(cols[estValueIdx]) : 0.0;

          const parsedWeight = weightIdx !== -1 ? parseRobustFloat(cols[weightIdx]) : 0.0;
          const finalNetWeight = net_weight || parsedWeight || 0.0;

          if (!customer_name || amount <= 0) continue;

          records.push({
            pledge_no,
            date,
            customer_name,
            pawner_relation,
            pawner_relation_name,
            mobile,
            income,
            address,
            ornament: ornament || "Ornament",
            quantity,
            gross_weight,
            less_weight,
            net_weight: finalNetWeight,
            weight: finalNetWeight,
            estimated_value,
            amount,
            status: status === "RELEASED" ? "RELEASED" : "ACTIVE",
            interest_percentage: 3.0,
            is_repledged: 0,
            repledged_amount: 0,
            interest_received_till_date: 0,
            remarks: "Imported via CSV file upload"
          });
        }

        if (records.length === 0) {
          setImportError("No valid rows could be parsed. Check that amounts are positive numbers.");
        } else {
          setParsedRecords(records);
        }
      } catch (err: any) {
        setImportError("Error reading file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (parsedRecords.length === 0) return;
    setImporting(true);
    try {
      const response = await fetch(`${API_BASE}/pledges/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
        },
        body: JSON.stringify(parsedRecords)
      });
      
      if (response.ok) {
        showNotification(`Successfully imported ${parsedRecords.length} pledges!`, "success");
        setShowImportModal(false);
        setParsedRecords([]);
        loadPledges();
      } else {
        const errData = await response.json();
        setImportError(errData.detail || "Bulk import endpoint failed.");
      }
    } catch (err: any) {
      setImportError("Failed to connect to backend import API: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const [zoomPhoto, setZoomPhoto] = useState<{ url: string; title: string } | null>(null);

  // Customer Profile Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState<{
    name: string;
    mobile: string;
    address: string;
    relation: string;
    relationName: string;
  } | null>(null);

  const handleViewCustomerProfile = (pledge: PledgeEntry) => {
    const payDetails = parsePledgePaymentDetails(pledge.customer_name);
    setProfileCustomer({
      name: payDetails.cleanName,
      mobile: pledge.mobile || "",
      address: pledge.address || "",
      relation: pledge.pawner_relation || "",
      relationName: pledge.pawner_relation_name || "",
    });
    setShowProfileModal(true);
  };

  // WhatsApp Preview Modal State
  const [whatsappModal, setWhatsappModal] = useState<{
    phone: string;
    message: string;
    customerName: string;
  } | null>(null);

  const handleOpenWhatsAppReminder = (item: PledgeEntry) => {
    const cleanName = cleanCustomerName(item.customer_name);
    const pDate = item.date || getPledgeDateFromDueDate(item.due_date);
    const rDate = currentDate || new Date().toISOString().split("T")[0];
    const calc = calculateRedemptionInterest(pDate, rDate, item.amount, item.ornament);
    
    const msg = formatGirviReminderMsg({
      customerName: cleanName,
      pledgeNo: item.pledge_no,
      ornament: item.ornament,
      principalAmount: item.amount,
      interestDue: calc.interest,
      dueDate: formatDateDMY(item.due_date)
    });

    setWhatsappModal({
      phone: item.mobile || "",
      message: msg,
      customerName: cleanName
    });
  };

  const handleOpenWhatsAppRelease = (item: PledgeEntry) => {
    const cleanName = cleanCustomerName(item.customer_name);
    const pDate = item.date || getPledgeDateFromDueDate(item.due_date);
    const rDate = item.release_date || currentDate || new Date().toISOString().split("T")[0];
    const calc = calculateRedemptionInterest(pDate, rDate, item.amount, item.ornament);

    const msg = formatGirviReleaseMsg({
      customerName: cleanName,
      pledgeNo: item.pledge_no,
      ornament: item.ornament,
      principalAmount: item.amount,
      interestPaid: calc.interest,
      releaseDate: formatDateDMY(rDate)
    });

    setWhatsappModal({
      phone: item.mobile || "",
      message: msg,
      customerName: cleanName
    });
  };


  // Standalone calculator states
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcAmount, setCalcAmount] = useState("");
  const [calcPledgeDate, setCalcPledgeDate] = useState(currentDate || new Date().toISOString().split("T")[0]);
  const [calcReleaseDate, setCalcReleaseDate] = useState(currentDate || new Date().toISOString().split("T")[0]);
  const [calcMetal, setCalcMetal] = useState<"GOLD" | "SILVER">("GOLD");
  const [calcResult, setCalcResult] = useState<{ months: number; days: number; chargeMonths: number; interest: number; total: number } | null>(null);

  useEffect(() => {
    const principal = parseFloat(calcAmount) || 0;
    if (principal <= 0 || !calcPledgeDate || !calcReleaseDate) {
      setCalcResult(null);
      return;
    }
    const start = new Date(calcPledgeDate);
    const end = new Date(calcReleaseDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      setCalcResult(null);
      return;
    }
    
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    let days = end.getDate() - start.getDate();

    if (days < 0) {
      months -= 1;
      const prevMonthDate = new Date(end.getFullYear(), end.getMonth(), 0);
      days += prevMonthDate.getDate();
    }

    // Custom Rounding Logic:
    // 1. If remaining days > 7, round up to next full month.
    // 2. If remaining days <= 7:
    //    - If completed months is 0, charge a minimum of 1 month.
    //    - Otherwise, charge only the completed months (round down).
    let chargeMonths = months;
    if (days > 7) {
      chargeMonths += 1;
    } else if (months === 0) {
      chargeMonths = 1;
    }

    const ratePerMonth = calcMetal === "SILVER" ? 0.10 : 0.03; // 10% for Silver, 3% for Gold
    const interest = Math.round(principal * ratePerMonth * chargeMonths);
    const total = principal + interest;

    setCalcResult({
      months,
      days,
      chargeMonths,
      interest,
      total,
    });
  }, [calcAmount, calcPledgeDate, calcReleaseDate, calcMetal]);

  // Interest calculation states
  const [releaseCalc, setReleaseCalc] = useState({ months: 0, days: 0, interest: 0, total: 0 });
  const [bandaCalc, setBandaCalc] = useState({ months: 0, days: 0, interest: 0, total: 0 });

  // ── Edit Pledge Modal ──
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPledge, setEditPledge] = useState<PledgeEntry | null>(null);
  const [editForm, setEditForm] = useState<Partial<PledgeEntry>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [editMethod, setEditMethod] = useState<"CASH" | "UPI" | "SPLIT" | "OTHER">("CASH");
  const [editUpiAccount, setEditUpiAccount] = useState<string>("hdfc_192");
  const [editSplitCash, setEditSplitCash] = useState<string>("");
  const [editSplitUpi, setEditSplitUpi] = useState<string>("");

  // Bank entries for edit modal
  type BankEntry = { name: string; bank: string; loan_no?: string; date: string; amount: string; linked_girvies: string; };
  const [editBankEntries, setEditBankEntries] = useState<BankEntry[]>([{ name: "", bank: "", loan_no: "", date: "", amount: "", linked_girvies: "" }]);

  const addEditBankEntry = () =>
    setEditBankEntries(prev => [...prev, { name: "", bank: "", loan_no: "", date: "", amount: "", linked_girvies: "" }]);
  const removeEditBankEntry = (i: number) =>
    setEditBankEntries(prev => prev.filter((_, idx) => idx !== i));
  const updateEditBankEntry = (i: number, field: string, value: string) =>
    setEditBankEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

  const handleOpenEdit = (pledge: PledgeEntry) => {
    const details = parsePledgePaymentDetails(pledge.customer_name);
    setEditPledge(pledge);
    setEditForm({
      ...pledge,
      customer_name: details.cleanName,
    });
    setEditMethod(details.method);
    setEditUpiAccount(details.upiAccount);
    setEditSplitCash(details.splitCash);
    setEditSplitUpi(details.splitUpi);

    // Parse bank entries from JSON or fall back to single legacy field
    if (pledge.repledged_entries) {
      try {
        const parsed = JSON.parse(pledge.repledged_entries);
        setEditBankEntries(parsed.length ? parsed : [{ name: "", bank: "", loan_no: "", date: "", amount: "", linked_girvies: "" }]);
      } catch { setEditBankEntries([{ name: pledge.repledged_name ?? "", bank: pledge.repledged_bank ?? "", loan_no: pledge.repledged_receipt_no ?? "", date: pledge.repledged_date ?? "", amount: pledge.repledged_amount ? String(pledge.repledged_amount) : "", linked_girvies: "" }]); }
    } else if (pledge.repledged_bank || pledge.repledged_name) {
      setEditBankEntries([{ name: pledge.repledged_name ?? "", bank: pledge.repledged_bank ?? "", loan_no: pledge.repledged_receipt_no ?? "", date: pledge.repledged_date ?? "", amount: pledge.repledged_amount ? String(pledge.repledged_amount) : "", linked_girvies: "" }]);
    } else {
      setEditBankEntries([{ name: "", bank: "", loan_no: "", date: "", amount: "", linked_girvies: "" }]);
    }
    setShowEditModal(true);
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPledge) return;
    setEditSaving(true);
    try {
      const oldDate = editPledge.date || currentDate;
      const targetDate = editForm.date || oldDate;
      const isRepledged = editForm.is_repledged ?? 0;

      const rawName = editForm.customer_name || "";
      const cleanName = cleanCustomerName(rawName);
      let prefix = "";
      if (editMethod === "UPI") {
        prefix = `[UPI:${editUpiAccount || "hdfc_192"}] `;
      } else if (editMethod === "OTHER") {
        prefix = "[OTHER] ";
      } else if (editMethod === "SPLIT") {
        const c = parseFloat(editSplitCash || "0") || 0;
        const u = parseFloat(editSplitUpi || "0") || 0;
        prefix = `[SPLIT:C${c}:U${u}:A${editUpiAccount || "hdfc_192"}] `;
      }

      const fullCustomerName = prefix + cleanName;

      const payload: Partial<PledgeEntry> = {
        ...editForm,
        customer_name: fullCustomerName,
        date: targetDate,
        is_repledged: isRepledged,
        repledged_entries: isRepledged ? JSON.stringify(editBankEntries.filter(e => e.bank && e.amount)) : null,
        repledged_bank: isRepledged && editBankEntries[0]?.bank ? editBankEntries[0].bank : null,
        repledged_receipt_no: isRepledged && editBankEntries[0]?.loan_no ? editBankEntries[0].loan_no : null,
        repledged_amount: isRepledged && editBankEntries[0]?.amount ? parseFloat(editBankEntries[0].amount) : null,
        repledged_date: isRepledged && editBankEntries[0]?.date ? editBankEntries[0].date : null,
        repledged_name: isRepledged && editBankEntries[0]?.name ? editBankEntries[0].name : null,
      };
      const ok = await updatePledgeEntry(editPledge.id, payload, oldDate);
      if (ok) {
        showNotification(`Pledge ${editPledge.pledge_no} updated successfully!`, "success");
        setShowEditModal(false);
        setEditPledge(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem(`daybook_${oldDate}`);
          localStorage.removeItem(`daybook_${targetDate}`);
        }
        loadPledges();
        onRefreshDaybook?.();
      } else {
        showNotification("Failed to save changes", "error");
      }
    } catch (err) {
      console.error(err);
      showNotification("Error saving pledge", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const setEF = (field: keyof PledgeEntry, value: string | number | null) =>
    setEditForm(prev => ({ ...prev, [field]: value }));

  // Calculate interest on release date change
  useEffect(() => {
    if (showReleaseModal && selectedPledge) {
      const pledgeDate = selectedPledge.date || getPledgeDateFromDueDate(selectedPledge.due_date) || currentDate;
      
      const calc = calculateRedemptionInterest(
        pledgeDate,
        releaseForm.release_date,
        selectedPledge.amount,
        selectedPledge.ornament
      );
      setReleaseCalc(calc);
      setReleaseForm(prev => ({ ...prev, interest_received: calc.interest.toString() }));
    }
  }, [releaseForm.release_date, selectedPledge, showReleaseModal]);


  // Calculate interest on banda date change
  useEffect(() => {
    if (showBandaModal && selectedPledge) {
      const pledgeDate = selectedPledge.date || getPledgeDateFromDueDate(selectedPledge.due_date) || currentDate;
      
      const calc = calculateRedemptionInterest(
        pledgeDate,
        bandaForm.date,
        selectedPledge.amount,
        selectedPledge.ornament
      );
      setBandaCalc(calc);
      setBandaForm(prev => ({ ...prev, interest_received: calc.interest.toString() }));
    }
  }, [bandaForm.date, selectedPledge, showBandaModal]);


  // Load pledges
  const loadPledges = async () => {
    setLoading(true);
    const data = await fetchAllPledges();
    setPledges(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPledges();
  }, []);



  const handleOpenBandaModal = (pledge: PledgeEntry) => {
    setSelectedPledge(pledge);
    setBandaForm({
      date: currentDate || new Date().toISOString().split("T")[0],
      interest_received: "",
      method: "CASH",
    });
    setShowBandaModal(true);
  };

  const handleBandaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPledge) return;

    try {
      const bandaDate = bandaForm.date;
      const interestRec = parseFloat(bandaForm.interest_received) || 0;
      const method = bandaForm.method;

      if (interestRec <= 0) {
        showNotification("Please enter a valid interest amount", "error");
        return;
      }

      const res = await addPledgePayment(selectedPledge.id, {
        payment_type: "INTEREST",
        amount: interestRec,
        payment_method: method,
        date: bandaDate,
      });

      if (res) {
        showNotification(`Banda interest of ₹${interestRec} for Pledge ${selectedPledge.pledge_no} recorded!`, "success");
        setShowBandaModal(false);
        setSelectedPledge(null);
        loadPledges();
      } else {
        showNotification("Failed to record Banda interest", "error");
      }
    } catch (err) {
      console.error(err);
      showNotification("Failed to record Banda interest", "error");
    }
  };

  const handleOpenReleaseModal = (pledge: PledgeEntry) => {
    setSelectedPledge(pledge);
    setReleaseForm({
      release_date: currentDate || new Date().toISOString().split("T")[0],
      interest_received: "",
      method: "CASH",
      splitCash: "",
      splitUpi: "",
      splitUpiAccount: "hdfc_192",
    });
    setShowReleaseModal(true);
  };

  const handleReleasePledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPledge) return;

    try {
      const releaseDate = releaseForm.release_date;
      const interestRec = parseFloat(releaseForm.interest_received) || 0;
      const method = releaseForm.method;

      // 1. Update Pledge status to RELEASED in database
      const ok = await updatePledgeEntry(
        selectedPledge.id,
        { status: "RELEASED", release_date: releaseDate },
        selectedPledge.due_date || currentDate
      );

      if (!ok) throw new Error("Update status failed");

      // 2. If interest received, record it as a payment
      if (interestRec > 0) {
        await addPledgePayment(selectedPledge.id, {
          payment_type: "INTEREST",
          amount: interestRec,
          payment_method: method,
          date: releaseDate,
        });
      }

      showNotification(`Pledge ${selectedPledge.pledge_no} released successfully!`, "success");

      setShowReleaseModal(false);
      setSelectedPledge(null);
      loadPledges();
    } catch (err) {
      console.error(err);
      showNotification("Failed to release pledge", "error");
    }
  };

  const handleRevertRelease = async (pledge: PledgeEntry) => {
    if (!confirm(`Are you sure you want to revert the release of Pledge ${pledge.pledge_no}? This will change its status back to ACTIVE.`)) {
      return;
    }

    try {
      const ok = await revertPledgeRelease(pledge.id);
      if (ok) {
        showNotification(`Pledge ${pledge.pledge_no} release reverted back to ACTIVE!`, "success");
        loadPledges();
      } else {
        showNotification("Failed to revert pledge release", "error");
      }
    } catch (err) {
      console.error(err);
      showNotification("Failed to revert pledge release", "error");
    }
  };

  const handleOpenLedgerModal = (pledge: PledgeEntry) => {
    setLedgerPledge(pledge);
    setPaymentForm({
      payment_type: "INTEREST",
      amount: "",
      payment_method: "CASH",
      date: currentDate || new Date().toISOString().split("T")[0],
    });
    setPaymentUpiAccount("hdfc_192");
    setShowLedgerModal(true);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ledgerPledge) return;

    const amt = parseFloat(paymentForm.amount) || 0;
    if (amt <= 0) {
      showNotification("Please enter a valid amount", "error");
      return;
    }

    try {
      const finalMethod = paymentForm.payment_method === "UPI" ? `UPI:${paymentUpiAccount}` : paymentForm.payment_method;
      const res = await addPledgePayment(ledgerPledge.id, {
        payment_type: paymentForm.payment_type,
        amount: amt,
        payment_method: finalMethod,
        date: paymentForm.date,
      });

      if (res) {
        showNotification("Payment recorded successfully!", "success");
        const updatedPledges = await fetchAllPledges();
        setPledges(updatedPledges);
        
        const updatedPledge = updatedPledges.find(p => p.id === ledgerPledge.id);
        if (updatedPledge) {
          setLedgerPledge(updatedPledge);
        }
        
        setPaymentForm(prev => ({ ...prev, amount: "" }));
        onRefreshDaybook?.();
      } else {
        showNotification("Failed to record payment", "error");
      }
    } catch (err) {
      console.error(err);
      showNotification("Failed to record payment", "error");
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm("Are you sure you want to delete this payment record? This will also remove the entry from the Day Book.")) {
      return;
    }

    try {
      const ok = await deletePledgePayment(paymentId);
      if (ok) {
        showNotification("Payment deleted successfully!", "success");
        const updatedPledges = await fetchAllPledges();
        setPledges(updatedPledges);
        
        if (ledgerPledge) {
          const updatedPledge = updatedPledges.find(p => p.id === ledgerPledge.id);
          if (updatedPledge) {
            setLedgerPledge(updatedPledge);
          }
        }
        onRefreshDaybook?.();
      } else {
        showNotification("Failed to delete payment", "error");
      }
    } catch (err) {
      console.error(err);
      showNotification("Failed to delete payment", "error");
    }
  };

  const handleDeletePledge = async (pledge: PledgeEntry) => {
    if (!confirm(`Are you sure you want to delete Pledge ${pledge.pledge_no}? This will also delete its associated Release and auto-posted entries.`)) return;

    try {
      const res = await fetch(`${API_BASE}/pledge/${pledge.id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification(`Pledge ${pledge.pledge_no} deleted`, "success");
        loadPledges();
        onRefreshDaybook?.();
      } else {
        showNotification("Failed to delete from server", "error");
      }
    } catch {
      showNotification("Offline deletion not supported for ledger list", "error");
    }
  };

  const parsePledgePaymentDetails = (rawName: string | undefined) => {
    const name = rawName || "";
    let cleanName = name;
    let method: "CASH" | "UPI" | "SPLIT" | "OTHER" = "CASH";
    let upiAccount = "hdfc_192";
    let splitCash = "";
    let splitUpi = "";

    const splitMatch = name.match(/^\[SPLIT:C([\d.]+):U([\d.]+)(?::A([^\]]+))?\]\s*/i);
    if (splitMatch) {
      method = "SPLIT";
      splitCash = splitMatch[1] || "";
      splitUpi = splitMatch[2] || "";
      upiAccount = splitMatch[3] || "hdfc_192";
      cleanName = name.replace(/^\[SPLIT:[^\]]+\]\s*/i, "").trim();
      return { method, upiAccount, splitCash, splitUpi, cleanName };
    }

    const upiMatch = name.match(/^\[UPI(?::([^\]]+))?\]\s*/i);
    if (upiMatch) {
      method = "UPI";
      upiAccount = upiMatch[1] || "hdfc_192";
      cleanName = name.replace(/^\[UPI(?::[^\]]+)?\]\s*/i, "").trim();
      return { method, upiAccount, splitCash, splitUpi, cleanName };
    }

    const otherMatch = name.match(/^\[OTHER(?::([^\]]+))?\]\s*/i);
    if (otherMatch) {
      method = "OTHER";
      cleanName = name.replace(/^\[OTHER(?::[^\]]+)?\]\s*/i, "").trim();
      return { method, upiAccount, splitCash, splitUpi, cleanName };
    }

    cleanName = name.replace(/^\[CASH\]\s*/i, "").trim();

    return { method, upiAccount, splitCash, splitUpi, cleanName };
  };

  const UPI_ACCOUNT_OPTIONS = [
    { key: "hdfc_192", label: "🏦 HDFC Bank (..192)" },
    { key: "hdfc_od_7442", label: "🏦 HDFC OD (..7442)" },
    { key: "pooja_068", label: "🏦 Pooja (..068)" },
    { key: "shankarlal_832", label: "🏦 Shankarlal (..832)" },
    { key: "vikash", label: "👤 Vikash Account" },
    { key: "vikram", label: "👤 Vikram Account" },
    { key: "deepak", label: "👤 Deepak Account" },
    { key: "kavitha", label: "👤 Kavitha Account" },
  ];

  const cleanCustomerName = (name: string) => {
    return (name || "")
      .replace(/^\[(UPI|OTHER)(:[^\]]+)?\]\s*/i, "")
      .replace(/^\[SPLIT:[^\]]+\]\s*/i, "")
      .replace(/^\[CASH\]\s*/i, "")
      .trim();
  };

  // Filter and Search logic
  const filteredPledges = pledges
    .filter((item) => {
      const rawName = cleanCustomerName(item.customer_name);
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        rawName.toLowerCase().includes(q) ||
        (item.pledge_no || "").toLowerCase().includes(q) ||
        (item.address || "").toLowerCase().includes(q) ||
        (item.mobile || "").toLowerCase().includes(q) ||
        (item.ornament || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && item.status !== "RELEASED") ||
        (statusFilter === "RELEASED" && item.status === "RELEASED");

      const ornamentText = (item.ornament || "").toLowerCase();
      const isSilver = /silver|chandi|sil/i.test(ornamentText);
      const matchesMetal =
        metalFilter === "ALL" ||
        (metalFilter === "SILVER" && isSilver) ||
        (metalFilter === "GOLD" && !isSilver);

      const itemDateStr = item.date || getPledgeDateFromDueDate(item.due_date) || "";
      let matchesDate = true;
      if (fromDateFilter && itemDateStr) {
        matchesDate = matchesDate && itemDateStr >= fromDateFilter;
      }
      if (toDateFilter && itemDateStr) {
        matchesDate = matchesDate && itemDateStr <= toDateFilter;
      }

      const netWt = item.net_weight || item.weight || 0.0;
      let matchesWeight = true;
      if (minWeightFilter) {
        matchesWeight = matchesWeight && netWt >= parseFloat(minWeightFilter);
      }
      if (maxWeightFilter) {
        matchesWeight = matchesWeight && netWt <= parseFloat(maxWeightFilter);
      }

      return matchesSearch && matchesStatus && matchesMetal && matchesDate && matchesWeight;
    })
    .sort((a, b) => {
      if (sortBy === "NEWEST") {
        const dateA = a.date || getPledgeDateFromDueDate(a.due_date) || "";
        const dateB = b.date || getPledgeDateFromDueDate(b.due_date) || "";
        if (dateA !== dateB) return dateB.localeCompare(dateA);
        return b.id - a.id;
      }
      if (sortBy === "OLDEST") {
        const dateA = a.date || getPledgeDateFromDueDate(a.due_date) || "";
        const dateB = b.date || getPledgeDateFromDueDate(b.due_date) || "";
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return a.id - b.id;
      }
      if (sortBy === "AMOUNT_HIGH_TO_LOW") {
        return (b.amount || 0) - (a.amount || 0);
      }
      if (sortBy === "AMOUNT_LOW_TO_HIGH") {
        return (a.amount || 0) - (b.amount || 0);
      }
      if (sortBy === "NAME_AZ") {
        const nameA = cleanCustomerName(a.customer_name);
        const nameB = cleanCustomerName(b.customer_name);
        return nameA.localeCompare(nameB);
      }
      if (sortBy === "NAME_ZA") {
        const nameA = cleanCustomerName(a.customer_name);
        const nameB = cleanCustomerName(b.customer_name);
        return nameB.localeCompare(nameA);
      }
      if (sortBy === "WEIGHT_HIGH_TO_LOW") {
        const wtA = (a.net_weight || a.weight || 0);
        const wtB = (b.net_weight || b.weight || 0);
        return wtB - wtA;
      }
      return 0;
    });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  // Live Summary Cards calculations
  const activePledgesList = filteredPledges.filter((p) => p.status !== "RELEASED");
  const releasedPledgesList = filteredPledges.filter((p) => p.status === "RELEASED");

  const totalActiveAmount = activePledgesList.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalReleasedAmount = releasedPledgesList.reduce((acc, p) => acc + (p.amount || 0), 0);

  let activeGoldNetWt = 0;
  let activeSilverNetWt = 0;

  activePledgesList.forEach((p) => {
    const ornamentText = (p.ornament || "").toLowerCase();
    const wt = p.net_weight || p.weight || 0;
    if (/silver|chandi|sil/i.test(ornamentText)) {
      activeSilverNetWt += wt;
    } else {
      activeGoldNetWt += wt;
    }
  });

  const hasActiveFilters = Boolean(
    searchTerm ||
    statusFilter !== "ALL" ||
    metalFilter !== "ALL" ||
    fromDateFilter ||
    toDateFilter ||
    sortBy !== "NEWEST" ||
    minWeightFilter ||
    maxWeightFilter
  );

  const clearAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("ALL");
    setMetalFilter("ALL");
    setSortBy("NEWEST");
    setFromDateFilter("");
    setToDateFilter("");
    setMinWeightFilter("");
    setMaxWeightFilter("");
  };

  return (
    <div className="space-y-5">
      {/* Live Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 p-4 rounded-2xl border border-amber-200/60 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-amber-900/70 text-xs font-bold font-serif">
            <span>Active Girvi (Gahan)</span>
            <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-mono font-black">{activePledgesList.length}</span>
          </div>
          <div className="text-xl font-black text-amber-950 font-sans mt-1">
            {formatCurrency(totalActiveAmount)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 p-4 rounded-2xl border border-emerald-200/60 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-center text-emerald-900/70 text-xs font-bold font-serif">
            <span>Released (Chhudaya)</span>
            <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-mono font-black">{releasedPledgesList.length}</span>
          </div>
          <div className="text-xl font-black text-emerald-950 font-sans mt-1">
            {formatCurrency(totalReleasedAmount)}
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 p-4 rounded-2xl border border-yellow-200/60 shadow-sm flex flex-col justify-between">
          <div className="text-yellow-900/70 text-xs font-bold font-serif">
            Active Gold Net Wt
          </div>
          <div className="text-xl font-black text-yellow-950 font-mono mt-1">
            {activeGoldNetWt.toFixed(2)} <span className="text-xs font-normal">g</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 p-4 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
          <div className="text-slate-900/70 text-xs font-bold font-serif">
            Active Silver Net Wt
          </div>
          <div className="text-xl font-black text-slate-950 font-mono mt-1">
            {activeSilverNetWt.toFixed(2)} <span className="text-xs font-normal">g</span>
          </div>
        </div>
      </div>

      {/* Comprehensive Search & Filter Controls Suite */}
      <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm space-y-4">
        {/* Row 1: Search + Status Tabs + Quick Action Buttons */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 justify-between">
          {/* Search Bar */}
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-900/40">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search Pawner Name, Pledge No, Ornament, Address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-amber-200 outline-none text-xs focus:border-amber-500 font-medium"
              style={{ background: "#FFFBF5" }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-800/40 hover:text-amber-900 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex bg-amber-50/70 p-1 rounded-xl border border-amber-200/60 text-xs font-bold text-amber-900 self-start lg:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "ALL" ? "bg-white text-amber-950 shadow-sm font-black" : "hover:text-amber-950"}`}
            >
              All Pledges ({pledges.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("ACTIVE")}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "ACTIVE" ? "bg-white text-amber-950 shadow-sm font-black" : "hover:text-amber-950"}`}
            >
              Active ({pledges.filter(p => p.status !== "RELEASED").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("RELEASED")}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "RELEASED" ? "bg-white text-emerald-950 shadow-sm font-black" : "hover:text-emerald-950"}`}
            >
              Released ({pledges.filter(p => p.status === "RELEASED").length})
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={loadPledges}
              className="p-2.5 rounded-xl border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors"
              title="Refresh Ledger"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => setShowCalcModal(true)}
              className="px-3.5 py-2.5 rounded-xl border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors flex items-center gap-1.5 font-bold text-xs"
            >
              🧮 Calculator
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 rounded-xl border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors flex items-center gap-1.5 font-bold text-xs"
              title="Export Ledger to Excel / CSV"
            >
              📤 Export
            </button>
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2.5 rounded-xl border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors flex items-center gap-1.5 font-bold text-xs"
              title="Import Pledges from Excel / CSV"
            >
              📥 Import
            </button>
            <button
              onClick={onSwitchToForm}
              className="px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all text-white flex items-center justify-center gap-1.5"
              style={{
                background: "linear-gradient(135deg,#c8960c,#D4AF37)",
                boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
              }}
            >
              <Plus size={14} />
              New Girvi
            </button>
          </div>
        </div>

        {/* Row 2: Metal Filter + Sort By Dropdown + Date Range Filters */}
        <div className="pt-3 border-t border-amber-100/80 flex flex-wrap items-center gap-3 text-xs">
          {/* Metal Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-amber-900/70 font-serif">Metal:</span>
            <select
              value={metalFilter}
              onChange={(e: any) => setMetalFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-950 outline-none focus:border-amber-500"
              style={{ background: "#FFFBF5" }}
            >
              <option value="ALL">All Metals (Gold & Silver)</option>
              <option value="GOLD">🪙 Gold Girvi Only</option>
              <option value="SILVER">🥈 Silver Girvi Only</option>
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-amber-900/70 font-serif">Sort By:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-950 outline-none focus:border-amber-500"
              style={{ background: "#FFFBF5" }}
            >
              <option value="NEWEST">📅 Newest Date First</option>
              <option value="OLDEST">📅 Oldest Date First</option>
              <option value="AMOUNT_HIGH_TO_LOW">💰 Amount: High to Low</option>
              <option value="AMOUNT_LOW_TO_HIGH">💵 Amount: Low to High</option>
              <option value="NAME_AZ">🔤 Name: A to Z</option>
              <option value="NAME_ZA">🔤 Name: Z to A</option>
              <option value="WEIGHT_HIGH_TO_LOW">⚖️ Net Weight: High to Low</option>
            </select>
          </div>

          {/* Date Range: From Date & To Date */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-amber-900/70 font-serif">From:</span>
            <input
              type="date"
              value={fromDateFilter}
              onChange={(e) => setFromDateFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-950 outline-none focus:border-amber-500 font-mono"
              style={{ background: "#FFFBF5" }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-amber-900/70 font-serif">To:</span>
            <input
              type="date"
              value={toDateFilter}
              onChange={(e) => setToDateFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-950 outline-none focus:border-amber-500 font-mono"
              style={{ background: "#FFFBF5" }}
            />
          </div>

          {/* Weight Range Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-amber-900/70 font-serif">Min Wt (g):</span>
            <input
              type="number"
              step="any"
              placeholder="e.g. 5"
              value={minWeightFilter}
              onChange={(e) => setMinWeightFilter(e.target.value)}
              className="w-16 px-2 py-1.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-950 outline-none focus:border-amber-500 font-mono"
              style={{ background: "#FFFBF5" }}
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-amber-900/70 font-serif">Max Wt (g):</span>
            <input
              type="number"
              step="any"
              placeholder="e.g. 50"
              value={maxWeightFilter}
              onChange={(e) => setMaxWeightFilter(e.target.value)}
              className="w-16 px-2 py-1.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-950 outline-none focus:border-amber-500 font-mono"
              style={{ background: "#FFFBF5" }}
            />
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto px-3 py-1.5 rounded-xl bg-amber-800/10 text-amber-900 border border-amber-800/20 font-bold hover:bg-amber-800/20 transition-all flex items-center gap-1"
            >
              <X size={13} /> Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Grid Sheet Pledges */}
      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-amber-900/60 font-serif">
            <RefreshCw className="animate-spin mx-auto mb-3" size={28} />
            Loading Girvi Ledger...
          </div>
        ) : filteredPledges.length === 0 ? (
          <div className="text-center py-16 text-amber-900/50 font-serif italic">
            No pledge records found matching filter constraints.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-amber-100 bg-amber-50/20" style={{ color: "#8B6914" }}>
                  <th className="py-4 px-4 font-bold font-serif">Pledge No</th>
                  <th className="py-4 px-4 font-bold font-serif">Pledge Date</th>
                  <th className="py-4 px-4 font-bold font-serif">Pawner Name</th>
                  <th className="py-4 px-4 font-bold font-serif">Mobile</th>
                  <th className="py-4 px-4 font-bold font-serif">Ornament</th>
                  <th className="py-4 px-4 font-bold font-serif text-right">Net Wt</th>
                  <th className="py-4 px-4 font-bold font-serif text-right">Principal</th>
                  <th className="py-4 px-4 font-bold font-serif text-center">Status</th>
                  <th className="py-4 px-4 font-bold font-serif">Release Date</th>
                  <th className="py-4 px-4 font-bold font-serif text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPledges.map((item) => {
                  const isReleased = item.status === "RELEASED";
                  const payDetails = parsePledgePaymentDetails(item.customer_name);
                  const cleanName = payDetails.cleanName;
                  const accountObj = UPI_ACCOUNT_OPTIONS.find(a => a.key === payDetails.upiAccount);
                  const accountLabel = accountObj ? accountObj.label.replace("🏦 ", "").replace("👤 ", "") : payDetails.upiAccount;

                  return (
                    <tr key={item.id} className="border-b border-amber-50 hover:bg-amber-50/10 transition-colors">
                      <td className="py-4.5 px-4 font-bold text-amber-950 font-mono">{item.pledge_no}</td>
                      <td className="py-4.5 px-4 font-mono text-amber-900">{item.date || item.due_date ? formatDateDMY(item.date || getPledgeDateFromDueDate(item.due_date)) : ""}</td>
                      <td className="py-4.5 px-4">
                        <div className="flex items-center gap-3">
                          {item.customer_photo ? (
                            <img
                              src={item.customer_photo}
                              alt="Customer"
                              className="w-8 h-8 rounded-full object-cover border border-amber-250 cursor-zoom-in flex-shrink-0"
                              onClick={() => setZoomPhoto({ url: item.customer_photo!, title: `${cleanName}'s Photo` })}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500/60 text-[10px] flex-shrink-0 select-none">
                              👤
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold text-amber-950 flex items-center gap-1.5 flex-wrap">
                              {payDetails.method === "UPI" && (
                                <span className="bg-blue-100 text-blue-900 text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 shadow-xs" title={`Debited via UPI from ${accountLabel}`}>
                                  📱 UPI <span className="text-[8px] font-semibold opacity-90 font-mono">({accountLabel})</span>
                                </span>
                              )}
                              {payDetails.method === "OTHER" && (
                                <span className="bg-purple-100 text-purple-800 text-[9px] px-1.5 py-0.5 rounded font-bold">Other</span>
                              )}
                              {payDetails.method === "SPLIT" && (
                                <span className="bg-emerald-100 text-emerald-900 text-[9px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1" title={`Split: Cash ₹${payDetails.splitCash} + UPI ₹${payDetails.splitUpi} (${accountLabel})`}>
                                  🥞 Split <span className="text-[8px] font-semibold opacity-90">({payDetails.splitCash ? `₹${payDetails.splitCash} Cash` : ''} + UPI {accountLabel})</span>
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleViewCustomerProfile(item)}
                                className="font-bold text-amber-950 hover:text-amber-600 hover:underline text-left outline-none transition-colors"
                              >
                                {cleanName}
                              </button>
                            </span>
                            {item.pawner_relation_name && (
                              <span className="text-[10px] text-amber-800/60 font-serif">
                                {item.pawner_relation} {item.pawner_relation_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4.5 px-4 font-mono text-amber-900">{item.mobile || "—"}</td>
                      <td className="py-4.5 px-4">
                        <div className="flex items-center gap-3">
                          {item.item_photo ? (
                            <img
                              src={item.item_photo}
                              alt="Item"
                              className="w-8 h-8 rounded-lg object-cover border border-amber-250 cursor-zoom-in flex-shrink-0"
                              onClick={() => setZoomPhoto({ url: item.item_photo!, title: `${item.ornament} Photo` })}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500/60 text-[10px] flex-shrink-0 select-none">
                              💍
                            </div>
                          )}
                          <div className="flex flex-col text-left">
                            <span className="text-amber-900 font-semibold leading-tight">
                              {item.ornament} {item.quantity ? `(${item.quantity} pc)` : ""}
                            </span>
                            {item.ornament_2 && (
                              <span className="text-[10px] text-amber-800/75 leading-none mt-0.5">
                                {item.ornament_2} {item.quantity_2 ? `(${item.quantity_2} pc)` : ""}
                              </span>
                            )}
                            {item.ornament_3 && (
                              <span className="text-[10px] text-amber-800/75 leading-none mt-0.5">
                                {item.ornament_3} {item.quantity_3 ? `(${item.quantity_3} pc)` : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4.5 px-4 text-right font-mono font-bold text-amber-950">{(item.weight || 0).toFixed(3)} g</td>
                      <td className="py-4.5 px-4 text-right font-mono font-black text-amber-950">{formatCurrency(item.amount)}</td>
                      <td className="py-4.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase ${
                            isReleased
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : "bg-red-100 text-red-800 border border-red-200"
                          }`}
                        >
                          {isReleased ? "Released" : "Active"}
                        </span>
                      </td>
                      <td className="py-4.5 px-4 font-mono text-amber-900">{formatDateDMY(item.release_date)}</td>
                      <td className="py-4.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                            title="Edit Pledge"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => onSelectPrintPledge(item)}
                            className="p-1.5 rounded-lg border border-amber-200 text-amber-800 hover:bg-amber-50 hover:border-amber-400 transition-colors"
                            title="Print Pooja Jewellers Pink Voucher"
                          >
                            <Printer size={13} />
                          </button>
                          {isReleased ? (
                            <>
                              <button
                                onClick={() => handleOpenWhatsAppRelease(item)}
                                className="p-1.5 rounded-lg border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors font-bold text-xs"
                                title="Send WhatsApp Release Confirmation"
                              >
                                💬
                              </button>
                              <button
                                onClick={() => handleRevertRelease(item)}
                                className="p-1.5 rounded-lg border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors"
                                title="Revert Release (Make Active again)"
                              >
                                <Undo2 size={13} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenWhatsAppReminder(item)}
                              className="p-1.5 rounded-lg border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors font-bold text-xs"
                              title="Send WhatsApp Interest Reminder"
                            >
                              💬
                            </button>
                          )}

                          {!isReleased && (
                            <>
                              <button
                                onClick={() => handleOpenBandaModal(item)}
                                className="p-1.5 rounded-lg border border-amber-250 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
                                title="Banda / Interest Taken"
                              >
                                <Coins size={13} />
                              </button>
                              <button
                                onClick={() => handleOpenReleaseModal(item)}
                                className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors animate-pulse"
                                title="Release Pledge (Chhudana)"
                              >
                                <CheckCircle size={13} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleOpenLedgerModal(item)}
                            className="p-1.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                            title="Pledge Payment Ledger"
                          >
                            <BookOpen size={13} />
                          </button>
                          <button
                            onClick={() => handleDeletePledge(item)}
                            className="p-1.5 rounded-lg border border-red-100 text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete Pledge record"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── EDIT PLEDGE MODAL ── */}
      {showEditModal && editPledge && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden border border-amber-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div style={{ height: 4, background: "linear-gradient(90deg,#c8960c,#D4AF37)" }} />
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-amber-100">
              <div>
                <h3 className="font-bold text-base font-serif text-amber-950 flex items-center gap-2">
                  <Pencil size={15} className="text-amber-600" />
                  Edit Pledge — <span className="font-mono">{editPledge.pledge_no}</span>
                </h3>
                <p className="text-xs text-amber-800/60 mt-0.5">{cleanCustomerName(editPledge.customer_name)}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 rounded-xl hover:bg-amber-50 text-amber-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Scrollable body */}
            <form onSubmit={handleEditSave} className="overflow-y-auto px-6 py-5 space-y-5 flex-1">

              {/* Basic Details & Payment Mode */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 border-b border-amber-100 pb-1">Basic Details &amp; Payment Mode</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Pledge No.</label>
                    <input type="text" value={editForm.pledge_no ?? ""}
                      onChange={e => setEF("pledge_no", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs font-mono font-bold outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Pawner Name</label>
                    <input type="text" value={editForm.customer_name ?? ""}
                      onChange={e => setEF("customer_name", e.target.value)}
                      placeholder="e.g. Munranthan"
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs font-bold outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Mobile</label>
                    <input type="text" value={editForm.mobile ?? ""}
                      onChange={e => setEF("mobile", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs font-mono outline-none focus:border-amber-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Address</label>
                    <input type="text" value={editForm.address ?? ""}
                      onChange={e => setEF("address", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Pledge Date</label>
                    <input type="date" value={editForm.date ?? ""}
                      onChange={e => setEF("date", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs outline-none focus:border-amber-500" />
                  </div>


                </div>
              </div>

              {/* Article 1 */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 border-b border-amber-100 pb-1">Article 1</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Ornament Description</label>
                    <input type="text" value={editForm.ornament ?? ""}
                      onChange={e => setEF("ornament", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs font-bold outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Qty (pcs)</label>
                    <input type="number" value={editForm.quantity ?? ""}
                      onChange={e => setEF("quantity", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs font-mono outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Gross Wt (g)</label>
                    <input type="number" step="0.001" value={editForm.gross_weight ?? ""}
                      onChange={e => { const g = parseFloat(e.target.value)||0; const l = parseFloat(String(editForm.less_weight))||0; setEditForm(p=>({...p, gross_weight:g, net_weight:Math.max(0,g-l), weight:Math.max(0,g-l)})); }}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs font-mono outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Less Wt (g)</label>
                    <input type="number" step="0.001" value={editForm.less_weight ?? ""}
                      onChange={e => { const l = parseFloat(e.target.value)||0; const g = parseFloat(String(editForm.gross_weight))||0; setEditForm(p=>({...p, less_weight:l, net_weight:Math.max(0,g-l), weight:Math.max(0,g-l)})); }}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs font-mono outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Net Wt (g)</label>
                    <input type="number" step="0.001" readOnly value={editForm.net_weight ?? ""}
                      className="w-full px-3 py-2 rounded-lg border border-amber-100 bg-amber-50 text-xs font-mono font-bold text-amber-950 outline-none" />
                  </div>
                </div>
              </div>



              {/* Loan Terms */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700 border-b border-amber-100 pb-1">Loan Terms</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Loan Amount (₹)</label>
                    <input type="number" value={editForm.amount ?? ""}
                      onChange={e => setEF("amount", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs font-mono font-black text-amber-950 outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Interest % / Month</label>
                    <input type="number" step="0.01" value={editForm.interest_percentage ?? ""}
                      onChange={e => setEF("interest_percentage", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs font-mono outline-none focus:border-amber-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-800 mb-1">Due Date</label>
                    <input type="date" value={editForm.due_date ?? ""}
                      onChange={e => setEF("due_date", e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-amber-200 text-xs outline-none focus:border-amber-500" />
                  </div>
                </div>
              </div>

              {/* 🏦 Re-Pledge / Bank Deposit Details */}
              <div className="border border-amber-200 rounded-2xl p-4 bg-amber-50/20 space-y-3">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                    🏦 Re-Pledge / Bank Deposit Details
                  </h4>
                  {(editForm.is_repledged ?? 0) === 1 && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {editBankEntries.length} {editBankEntries.length === 1 ? "Bank" : "Banks"}
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={(editForm.is_repledged ?? 0) === 1}
                    onChange={e => setEF("is_repledged", e.target.checked ? 1 : 0)}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-amber-850">Item(s) kept / pledged at a Bank or Finance Company?</span>
                </label>

                {(editForm.is_repledged ?? 0) === 1 && (
                  <div className="space-y-3">
                    {editBankEntries.map((entry, i) => {
                      const KNOWN_BANKS = ["Kosamattam Finance", "Muthoot Money", "Bank of Baroda", "SBI"];
                      const isCustomBank = entry.bank !== "" && !KNOWN_BANKS.includes(entry.bank);
                      return (
                        <div key={i} className="rounded-xl border border-amber-200 bg-white p-3 space-y-3" style={{ boxShadow: "0 1px 4px rgba(212,175,55,0.08)" }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-amber-700">Bank Entry #{i + 1}</span>
                            {editBankEntries.length > 1 && (
                              <button type="button" onClick={() => removeEditBankEntry(i)}
                                className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors">✕ Remove</button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2.5">
                            {/* Name */}
                            <div>
                              <label className="block text-[9px] font-semibold text-amber-800 mb-1">Pledger Name at Bank</label>
                              <input type="text" value={entry.name}
                                onChange={e => updateEditBankEntry(i, "name", e.target.value)}
                                placeholder="e.g. Vikram Chand"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs font-bold outline-none focus:border-amber-500" />
                            </div>
                            {/* Bank */}
                            <div>
                              <label className="block text-[9px] font-semibold text-amber-800 mb-1">Bank / Finance Company</label>
                              <select value={isCustomBank ? "Other" : entry.bank}
                                onChange={e => updateEditBankEntry(i, "bank", e.target.value === "Other" ? "" : e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-amber-200 text-xs font-black text-amber-950 outline-none focus:border-amber-500">
                                <option value="">-- Select --</option>
                                <option value="Kosamattam Finance">Kosamattam Finance</option>
                                <option value="Muthoot Money">Muthoot Money</option>
                                <option value="Bank of Baroda">Bank of Baroda</option>
                                <option value="SBI">SBI</option>
                                <option value="Other">Other (Write Name)</option>
                              </select>
                              {isCustomBank && (
                                <input type="text" placeholder="Bank name" value={entry.bank}
                                  onChange={e => updateEditBankEntry(i, "bank", e.target.value)}
                                  className="w-full mt-1.5 px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs font-bold outline-none focus:border-amber-500" />
                              )}
                            </div>
                            {/* Loan No */}
                            <div>
                              <label className="block text-[9px] font-semibold text-amber-800 mb-1">Bank Loan No. / Receipt No.</label>
                              <input type="text" value={entry.loan_no || ""}
                                onChange={e => updateEditBankEntry(i, "loan_no", e.target.value)}
                                placeholder="e.g. 15252 or LN-8840"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs font-mono font-bold outline-none focus:border-amber-500" />
                            </div>
                            {/* Date */}
                            <div>
                              <label className="block text-[9px] font-semibold text-amber-800 mb-1">Re-Pledge Date</label>
                              <input type="date" value={entry.date}
                                onChange={e => updateEditBankEntry(i, "date", e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs outline-none focus:border-amber-500" />
                            </div>
                            {/* Amount */}
                            <div>
                              <label className="block text-[9px] font-semibold text-amber-800 mb-1">Loan Amount (₹)</label>
                              <input type="number" value={entry.amount}
                                onChange={e => updateEditBankEntry(i, "amount", e.target.value)}
                                placeholder="e.g. 8500"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs font-mono font-black text-amber-900 outline-none focus:border-amber-500" />
                            </div>
                            {/* Linked Girvies */}
                            <div className="col-span-2">
                              <label className="block text-[9px] font-semibold text-amber-800 mb-1">
                                Other Girvi Nos. bundled in this loan
                                <span className="ml-1 font-normal text-amber-600">(comma-separated, e.g. 1120, 1130)</span>
                              </label>
                              <input type="text" value={entry.linked_girvies}
                                onChange={e => updateEditBankEntry(i, "linked_girvies", e.target.value)}
                                placeholder="e.g. 1120, 1130, 1145"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs font-bold outline-none focus:border-amber-500" />
                              {entry.linked_girvies && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {entry.linked_girvies.split(",").filter(s => s.trim()).map((no, ni) => (
                                    <span key={ni} className="px-2 py-0.5 rounded-full bg-amber-900 text-white text-[9px] font-bold">#{no.trim()}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <button type="button" onClick={addEditBankEntry}
                      className="w-full py-2 rounded-xl border-2 border-dashed border-amber-300 text-xs font-bold text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-all flex items-center justify-center gap-1.5">
                      <span className="text-sm leading-none">+</span> Add Another Bank / Finance Company
                    </button>
                    {editBankEntries.length > 1 && (
                      <div className="flex justify-end items-center gap-2 border-t border-amber-100 pt-1.5">
                        <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider">Total:</span>
                        <span className="text-xs font-black text-amber-950 font-mono">
                          ₹{editBankEntries.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving}
                  className="flex-1 py-2.5 rounded-xl text-xs font-black text-white transition-all flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg,#c8960c,#D4AF37)", boxShadow: "0 2px 8px rgba(212,175,55,0.3)" }}>
                  {editSaving ? <RefreshCw size={13} className="animate-spin" /> : <Pencil size={13} />}
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── RELEASE PLEDGE MODAL ── */}
      {showReleaseModal && selectedPledge && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-amber-200">
            <div style={{ height: 4, background: "#10b981" }} />
            
            <div className="px-6 py-6 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-200 mx-auto mb-3 text-xl">
                🔓
              </div>
              <h3 className="font-bold text-base mb-1 font-serif text-amber-950">
                Release Pledge ({selectedPledge.pledge_no})
              </h3>
              <p className="text-xs text-amber-800/70 mb-4 font-serif">
                Record payment to release ornament for Pawner <b>{cleanCustomerName(selectedPledge.customer_name)}</b>.
              </p>

              <form onSubmit={handleReleasePledge} className="space-y-3.5 text-left">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Release Date</label>
                  <input
                    type="date"
                    required
                    value={releaseForm.release_date}
                    onChange={(e) => setReleaseForm({ ...releaseForm, release_date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs focus:border-emerald-500 font-medium"
                    style={{ background: "#F9FAF6" }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Principal (Read-only)</label>
                  <input
                    type="text"
                    readOnly
                    value={formatCurrency(selectedPledge.amount)}
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs font-black font-mono bg-emerald-50/20 text-emerald-800"
                  />
                </div>

                {/* Interest Calculation Info Box */}
                <div className="bg-emerald-50/45 border border-emerald-100 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-amber-900/60 font-medium">Pledge Date:</span>
                    <span className="font-bold text-amber-950 font-mono">
                      {formatDateDMY(selectedPledge.date || getPledgeDateFromDueDate(selectedPledge.due_date))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-900/60 font-medium">Elapsed Time:</span>
                    <span className="font-bold text-amber-950 font-serif">
                      {releaseCalc.months} Months, {releaseCalc.days} Days
                    </span>
                  </div>
                  <div className="border-t border-emerald-100/50 my-1.5" />
                  <div className="flex justify-between">
                    <span className="text-amber-900/60 font-medium">Interest Amount:</span>
                    <span className="font-extrabold text-emerald-700 font-mono">
                      ₹{releaseCalc.interest.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-900/60 font-medium">Total Collection:</span>
                    <span className="font-black text-amber-950 font-mono">
                      ₹{releaseCalc.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Interest Received (₹)</label>
                  <input
                    type="number"
                    value={releaseForm.interest_received}
                    onChange={(e) => setReleaseForm({ ...releaseForm, interest_received: e.target.value })}
                    placeholder="e.g. 140"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs font-bold font-mono focus:border-emerald-500"
                    style={{ background: "#F9FAF6" }}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReleaseModal(false);
                      setSelectedPledge(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs border border-amber-200 text-amber-800 bg-white hover:bg-amber-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide text-white transition-all shadow-md bg-emerald-600 hover:bg-emerald-700"
                  >
                    Release &amp; Post
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── BANDA / INTEREST TAKEN MODAL ── */}
      {showBandaModal && selectedPledge && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-amber-200">
            <div style={{ height: 4, background: "#d97706" }} />
            
            <div className="px-6 py-6 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-200 mx-auto mb-3 text-xl">
                💰
              </div>
              <h3 className="font-bold text-base mb-1 font-serif text-amber-950">
                Banda / Interest Taken ({selectedPledge.pledge_no})
              </h3>
              <p className="text-xs text-amber-800/70 mb-4 font-serif">
                Record interest payment received without releasing the ornament for Pawner <b>{cleanCustomerName(selectedPledge.customer_name)}</b>.
              </p>

              <form onSubmit={handleBandaSubmit} className="space-y-3.5 text-left">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={bandaForm.date}
                    onChange={(e) => setBandaForm({ ...bandaForm, date: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs focus:border-amber-500 font-medium"
                    style={{ background: "#F9FAF6" }}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Principal (Read-only)</label>
                  <input
                    type="text"
                    readOnly
                    value={formatCurrency(selectedPledge.amount)}
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs font-black font-mono bg-amber-50/20 text-amber-850"
                  />
                </div>

                {/* Interest Calculation Info Box */}
                <div className="bg-amber-50/45 border border-amber-100 rounded-2xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-amber-900/60 font-medium">Pledge Date:</span>
                    <span className="font-bold text-amber-950 font-mono">
                      {formatDateDMY(selectedPledge.date || getPledgeDateFromDueDate(selectedPledge.due_date))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-900/60 font-medium">Elapsed Time:</span>
                    <span className="font-bold text-amber-950 font-serif">
                      {bandaCalc.months} Months, {bandaCalc.days} Days
                    </span>
                  </div>
                  <div className="border-t border-amber-100/50 my-1.5" />
                  <div className="flex justify-between">
                    <span className="text-amber-900/60 font-medium">Interest Amount:</span>
                    <span className="font-extrabold text-amber-600 font-mono">
                      ₹{bandaCalc.interest.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Interest Amount Taken (₹)</label>
                  <input
                    type="number"
                    required
                    value={bandaForm.interest_received}
                    onChange={(e) => setBandaForm({ ...bandaForm, interest_received: e.target.value })}
                    placeholder="e.g. 150"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs font-bold font-mono focus:border-amber-500"
                    style={{ background: "#F9FAF6" }}
                  />
                </div>



                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowBandaModal(false);
                      setSelectedPledge(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs border border-amber-200 text-amber-800 bg-white hover:bg-amber-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide text-white transition-all shadow-md bg-amber-600 hover:bg-amber-700"
                  >
                    Post Interest
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── PHOTO ZOOM MODAL ── */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.7)", backdropFilter: "blur(5px)" }}
          onClick={() => setZoomPhoto(null)}
        >
          <div
            className="bg-white rounded-3xl p-4 max-w-sm w-full shadow-2xl relative border border-amber-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3 border-b border-amber-100 pb-2">
              <h4 className="font-bold text-sm font-serif text-amber-950">{zoomPhoto.title}</h4>
              <button
                onClick={() => setZoomPhoto(null)}
                className="p-1 rounded-full hover:bg-amber-50 text-amber-900 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="w-full aspect-square rounded-2xl overflow-hidden border border-amber-200 bg-amber-50/10">
              <img src={zoomPhoto.url} alt={zoomPhoto.title} className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* ── STANDALONE REFERENCE INTEREST CALCULATOR MODAL ── */}
      {showCalcModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-amber-200" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ height: 4, background: "#D4AF37" }} />
            
            <div className="px-6 py-5 flex justify-between items-center border-b border-amber-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧮</span>
                <h3 className="font-bold text-base font-serif text-amber-955">
                  Girvi Interest Calculator
                </h3>
              </div>
              <button onClick={() => setShowCalcModal(false)} className="text-amber-900/40 hover:text-amber-900 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Metal Type</label>
                  <select
                    value={calcMetal}
                    onChange={(e: any) => setCalcMetal(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs font-bold text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  >
                    <option value="GOLD">Gold (3% per month)</option>
                    <option value="SILVER">Silver (10% per month)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Principal Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 10000"
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs font-bold text-amber-955 focus:border-amber-500 font-mono"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Pledge Date</label>
                  <input
                    type="date"
                    value={calcPledgeDate}
                    onChange={(e) => setCalcPledgeDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs font-medium text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Release Date</label>
                  <input
                    type="date"
                    value={calcReleaseDate}
                    onChange={(e) => setCalcReleaseDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-amber-200 outline-none text-xs font-medium text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
              </div>

              {calcResult ? (
                <div className="bg-amber-50/40 border border-amber-200/50 rounded-2xl p-4 space-y-2.5 text-xs text-amber-950 font-serif">
                  <div className="flex justify-between border-b border-amber-900/5 pb-2">
                    <span className="text-amber-900/60 font-semibold">Elapsed Duration:</span>
                    <span className="font-extrabold text-amber-955">
                      {calcResult.months} Months, {calcResult.days} Days
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-amber-900/5 pb-2">
                    <span className="text-amber-900/60 font-semibold">Interest Charged For:</span>
                    <span className="font-extrabold text-amber-955">
                      {calcResult.chargeMonths} {calcResult.chargeMonths === 1 ? "Month" : "Months"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-900/60">Pledge Principal:</span>
                    <span className="font-bold text-amber-955 font-mono">
                      ₹{parseFloat(calcAmount).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-900/60 font-medium">Interest (Gold 3% / Silver 10%):</span>
                    <span className="font-extrabold text-red-650 font-mono">
                      + ₹{calcResult.interest.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="border-t border-amber-200/50 my-2 pt-2 flex justify-between font-black text-sm text-amber-955">
                    <span>Total To Collect:</span>
                    <span className="font-mono text-emerald-700">
                      ₹{calcResult.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-amber-200 rounded-2xl text-[11px] text-amber-800/50 italic font-serif">
                  Enter Principal Amount and Dates to view calculation.
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setCalcAmount("");
                  setCalcResult(null);
                }}
                className="w-full py-2.5 rounded-xl border border-amber-300 hover:bg-amber-50 font-bold text-xs text-amber-900 transition-colors uppercase tracking-wider text-center"
              >
                Clear Calculator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PLEDGE PAYMENT LEDGER MODAL ── */}
      {showLedgerModal && ledgerPledge && (() => {
        const currentPrincipal = ledgerPledge.amount;
        const payments = ledgerPledge.payments || [];
        const totalInterestPaid = payments.filter(p => p.payment_type === 'INTEREST').reduce((sum, p) => sum + p.amount, 0);
        const totalPrincipalPaid = payments.filter(p => p.payment_type === 'PRINCIPAL').reduce((sum, p) => sum + p.amount, 0);
        const totalTopUps = payments.filter(p => p.payment_type === 'TOP_UP').reduce((sum, p) => sum + p.amount, 0);
        const initialPrincipal = currentPrincipal - totalTopUps;
        const remainingPrincipal = currentPrincipal - totalPrincipalPaid;

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.6)", backdropFilter: "blur(4px)" }}>
            <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden border border-amber-200 flex flex-col" style={{ maxHeight: "90vh" }}>
              <div style={{ height: 4, background: "#3b82f6" }} />
              
              {/* Header */}
              <div className="px-6 py-4 flex justify-between items-center border-b border-amber-100 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📄</span>
                  <div className="text-left">
                    <h3 className="font-bold text-base font-serif text-amber-955">
                      Pledge Payment Ledger
                    </h3>
                    <p className="text-[10px] text-amber-800/70 font-mono">
                      Pledge No: {ledgerPledge.pledge_no} | Pawner: {cleanCustomerName(ledgerPledge.customer_name)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowLedgerModal(false);
                    setLedgerPledge(null);
                  }}
                  className="text-amber-900/40 hover:text-amber-900 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
                {/* Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-amber-50/30 border border-amber-100/50 p-4 rounded-2xl text-left">
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-amber-850">Initial Principal</span>
                    <span className="font-black text-amber-955 font-mono text-[11px]">{formatCurrency(initialPrincipal)}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-rose-800">Total Top-Ups (+)</span>
                    <span className="font-bold text-rose-700 font-mono text-[11px]">₹{totalTopUps.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-emerald-800">Total Interest Paid</span>
                    <span className="font-bold text-emerald-700 font-mono text-[11px]">₹{totalInterestPaid.toLocaleString("en-IN")}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-blue-850">Total Principal Paid (-)</span>
                    <span className="font-bold text-blue-700 font-mono text-[11px]">₹{totalPrincipalPaid.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="bg-amber-100/30 p-2 rounded-xl border border-amber-200/30">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-amber-900">Remaining Principal</span>
                    <span className="font-black text-amber-950 font-mono text-[11px]">{formatCurrency(remainingPrincipal)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  {/* Left Column: Payment History (7 cols) */}
                  <div className="md:col-span-7 space-y-3">
                    <h4 className="font-bold font-serif text-amber-955 text-xs border-b border-amber-50 pb-1.5 flex items-center gap-1.5 text-left">
                      📜 Payment History
                    </h4>
                    
                    {payments.length === 0 ? (
                      <div className="text-center py-10 border border-dashed border-amber-150 rounded-2xl text-[11px] text-amber-800/40 italic font-serif">
                        No payments recorded yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-amber-100 rounded-xl">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-amber-50/20 text-amber-900 border-b border-amber-100 font-serif">
                              <th className="py-2.5 px-3 font-bold">Date</th>
                              <th className="py-2.5 px-3 font-bold">Type</th>
                              <th className="py-2.5 px-3 font-bold text-right">Amount</th>
                              <th className="py-2.5 px-3 font-bold text-center">Method</th>
                              <th className="py-2.5 px-3 font-bold text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((p) => {
                              const showMethod = p.payment_method.startsWith("UPI:")
                                ? `UPI (${p.payment_method.split(":")[1].replace("_", " ").toUpperCase()})`
                                : p.payment_method;
                              return (
                                <tr key={p.id} className="border-b border-amber-50 hover:bg-amber-50/10">
                                  <td className="py-2.5 px-3 font-mono">{formatDateDMY(p.date)}</td>
                                  <td className="py-2.5 px-3 font-medium">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                      p.payment_type === "INTEREST"
                                        ? "bg-emerald-50 text-emerald-800 border border-emerald-150"
                                        : p.payment_type === "TOP_UP"
                                          ? "bg-rose-50 text-rose-800 border border-rose-150"
                                          : "bg-blue-50 text-blue-800 border border-blue-150"
                                    }`}>
                                      {p.payment_type === "INTEREST"
                                        ? "Interest (Banda)"
                                        : p.payment_type === "TOP_UP"
                                          ? "Top-Up (+)"
                                          : "Principal (-)"}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-bold font-mono text-right text-amber-955">
                                    {p.payment_type === "TOP_UP" ? "+" : "—"} ₹{p.amount.toLocaleString("en-IN")}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold text-amber-800">{showMethod}</td>
                                  <td className="py-2.5 px-3 text-center">
                                    <button
                                      onClick={() => handleDeletePayment(p.id)}
                                      className="p-1 rounded text-red-650 hover:bg-red-50 transition-colors"
                                      title="Delete Payment record"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Add Payment Form (5 cols) */}
                  <div className="md:col-span-5 bg-amber-50/10 border border-amber-200/50 p-4 rounded-2xl space-y-3.5 text-left">
                    <h4 className="font-bold font-serif text-amber-955 text-xs border-b border-amber-100 pb-1.5 flex items-center gap-1.5">
                      ➕ Add Payment
                    </h4>
                    
                    <form onSubmit={handlePaymentSubmit} className="space-y-3">
                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-amber-850 mb-1">Payment Type</label>
                        <select
                          value={paymentForm.payment_type}
                          onChange={(e: any) => setPaymentForm({ ...paymentForm, payment_type: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold text-amber-955 focus:border-blue-500"
                          style={{ background: "#FFFBF5" }}
                        >
                          <option value="INTEREST">Interest Payment (Banda)</option>
                          <option value="PRINCIPAL">Partial Principal Payment</option>
                          <option value="TOP_UP">➕ Principal Top-Up (Given Out)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-amber-850 mb-1">Date</label>
                        <input
                          type="date"
                          required
                          value={paymentForm.date}
                          onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-medium text-amber-955 focus:border-blue-500"
                          style={{ background: "#FFFBF5" }}
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] font-bold uppercase tracking-wider text-amber-850 mb-1">Amount (₹)</label>
                        <input
                          type="number"
                          required
                          placeholder="e.g. 500"
                          value={paymentForm.amount}
                          onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                          className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold font-mono text-amber-955 focus:border-blue-500"
                          style={{ background: "#FFFBF5" }}
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wide transition-all text-white flex items-center justify-center gap-2 mt-2 shadow-sm"
                        style={{
                          background: "linear-gradient(135deg,#3b82f6,#2563eb)",
                          border: "none",
                        }}
                      >
                        Add &amp; Post Payment
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── WHATSAPP MESSAGE PREVIEW MODAL ── */}
      {whatsappModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-emerald-200 flex flex-col">
            <div style={{ height: 5, background: "linear-gradient(90deg,#059669,#10B981)" }} />
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-emerald-100">
              <div>
                <h3 className="font-bold text-base text-emerald-950 flex items-center gap-2">
                  <span>📲</span> WhatsApp Message Preview
                </h3>
                <p className="text-xs text-emerald-800/70 mt-0.5">Recipient: {whatsappModal.customerName}</p>
              </div>
              <button onClick={() => setWhatsappModal(null)} className="p-2 rounded-xl hover:bg-emerald-50 text-emerald-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">Customer Mobile Number</label>
                <input
                  type="text"
                  value={whatsappModal.phone}
                  onChange={(e) => setWhatsappModal({ ...whatsappModal, phone: e.target.value })}
                  placeholder="Enter 10-digit phone number"
                  className="w-full text-xs p-2.5 border border-emerald-300 rounded-xl focus:ring-1 focus:ring-emerald-500 font-mono"
                />
                <p className="text-[11px] text-emerald-700 mt-1">Formatted with India code: +{sanitizePhoneNumber(whatsappModal.phone) || '91...'}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">Message Text</label>
                <textarea
                  rows={8}
                  value={whatsappModal.message}
                  onChange={(e) => setWhatsappModal({ ...whatsappModal, message: e.target.value })}
                  className="w-full text-xs p-3 border border-emerald-300 rounded-xl focus:ring-1 focus:ring-emerald-500 font-sans leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setWhatsappModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 hover:bg-amber-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openWhatsApp(whatsappModal.phone, whatsappModal.message);
                    setWhatsappModal(null);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                >
                  <span>📲 Send via WhatsApp</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── CSV IMPORT PREVIEW MODAL ── */}
      {showImportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.45)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-amber-250 flex flex-col max-h-[90vh]">
            <div style={{ height: 4, background: "linear-gradient(90deg, #d4af37, #c8960c)" }} />
            <div className="flex items-center justify-between px-6 py-5 border-b border-amber-100 bg-amber-50/15">
              <div>
                <h3 className="font-bold text-base text-amber-955 font-serif flex items-center gap-2">
                  📥 Bulk Import Pledges
                </h3>
                <p className="text-xs text-amber-800/60 mt-0.5 font-medium">Select a CSV spreadsheet file to import pledges in bulk.</p>
              </div>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setParsedRecords([]);
                  setImportError("");
                }}
                className="p-2 rounded-xl hover:bg-amber-50 text-amber-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-left">
              <div className="border-2 border-dashed border-amber-200 hover:border-amber-400 transition-colors rounded-2xl p-6 text-center bg-amber-50/5">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVFileChange}
                  className="hidden"
                  id="csv-file-upload-input"
                />
                <label htmlFor="csv-file-upload-input" className="cursor-pointer flex flex-col items-center">
                  <span className="text-3xl mb-2">📄</span>
                  <span className="text-xs font-bold text-amber-900">Click to upload or drag & drop CSV file</span>
                  <span className="text-[10px] text-amber-800/50 mt-1">Requires headers: Customer Name, Ornament, Amount/Principal</span>
                </label>
              </div>

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-750 text-xs rounded-xl font-bold flex items-start gap-2">
                  <span>⚠️</span>
                  <span>{importError}</span>
                </div>
              )}

              {parsedRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-amber-100 pb-1.5">
                    <h4 className="font-bold font-serif text-amber-955 text-xs">
                      🔍 Preview Imported Data ({parsedRecords.length} records parsed)
                    </h4>
                    <span className="text-[10px] bg-emerald-50 text-emerald-805 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">Valid</span>
                  </div>
                  <div className="border border-amber-100 rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                    <table className="w-full text-[10px] text-left border-collapse">
                      <thead>
                        <tr className="bg-amber-50/30 text-amber-900 border-b border-amber-100 font-bold font-serif">
                          <th className="py-2 px-3">Pledge No</th>
                          <th className="py-2 px-3">Customer Name</th>
                          <th className="py-2 px-3">Ornament</th>
                          <th className="py-2 px-3 text-right">Weight (g)</th>
                          <th className="py-2 px-3 text-right">Principal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-50">
                        {parsedRecords.map((rec, index) => (
                          <tr key={index} className="text-amber-955 hover:bg-amber-50/10 font-medium">
                            <td className="py-2 px-3 font-mono">{rec.pledge_no}</td>
                            <td className="py-2 px-3 font-bold">{rec.customer_name}</td>
                            <td className="py-2 px-3">{rec.ornament}</td>
                            <td className="py-2 px-3 text-right font-mono">{rec.weight.toFixed(2)} g</td>
                            <td className="py-2 px-3 text-right font-mono font-bold">₹{rec.amount.toLocaleString("en-IN")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-amber-100 flex items-center justify-end gap-3 bg-amber-50/5">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setParsedRecords([]);
                  setImportError("");
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 hover:bg-amber-50 border border-amber-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={parsedRecords.length === 0 || importing}
                onClick={handleImportSubmit}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2"
                style={{ background: "linear-gradient(135deg,#c8960c,#d4af37)" }}
              >
                {importing ? (
                  <>
                    <RefreshCw className="animate-spin" size={13} />
                    Importing...
                  </>
                ) : (
                  <>
                    <span>📥</span>
                    Confirm Import
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {showProfileModal && profileCustomer && (
        <div className="fixed inset-0 z-[120] flex items-center justify-end" style={{ background: "rgba(45,27,14,0.4)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white h-full w-full max-w-lg shadow-2xl flex flex-col relative border-l border-amber-100">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
            <div className="flex items-center justify-between px-6 py-5 border-b border-amber-100 bg-amber-50/10">
              <div>
                <h3 className="font-bold text-base text-amber-955 font-serif flex items-center gap-2">
                  👤 Pawner Profile
                </h3>
                <p className="text-xs text-amber-800/60 mt-0.5 font-medium">Customer ledger summary and pledge history.</p>
              </div>
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setProfileCustomer(null);
                }}
                className="p-2 rounded-xl hover:bg-amber-50 text-amber-800 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Profile Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Header Info */}
              <div className="flex items-start gap-4 bg-amber-50/20 border border-amber-200/50 p-5 rounded-2xl">
                <div className="w-14 h-14 rounded-full bg-amber-100/60 border border-amber-300 flex items-center justify-center text-amber-600 font-black text-xl select-none flex-shrink-0">
                  {profileCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="space-y-1 text-left">
                  <h4 className="font-bold text-sm text-amber-955">{profileCustomer.name}</h4>
                  {profileCustomer.relationName && (
                    <p className="text-xs text-amber-800/70 font-medium">
                      {profileCustomer.relation}: {profileCustomer.relationName}
                    </p>
                  )}
                  {profileCustomer.mobile && (
                    <p className="text-xs text-amber-900 font-mono flex items-center gap-1.5">
                      <span>📱</span> {profileCustomer.mobile}
                    </p>
                  )}
                  {profileCustomer.address && (
                    <p className="text-xs text-amber-800/80 font-serif leading-snug">
                      <span>📍</span> {profileCustomer.address}
                    </p>
                  )}
                </div>
              </div>

              {/* Statistics Panel */}
              {(() => {
                const customerPledges = pledges.filter(p => {
                  const cleanName = cleanCustomerName(p.customer_name);
                  const hasSamePhone = profileCustomer.mobile && p.mobile === profileCustomer.mobile;
                  const hasSameName = cleanName.toLowerCase() === profileCustomer.name.toLowerCase();
                  return hasSamePhone || hasSameName;
                });

                const activePledges = customerPledges.filter(p => p.status !== "RELEASED");
                const closedPledges = customerPledges.filter(p => p.status === "RELEASED");
                
                const outstandingAmt = activePledges.reduce((acc, p) => acc + (p.amount || 0), 0);
                const releasedAmt = closedPledges.reduce((acc, p) => acc + (p.amount || 0), 0);

                let goldWt = 0;
                let silverWt = 0;
                
                customerPledges.forEach(p => {
                  const isSilver = /silver|chandi|sil/i.test(p.ornament || "");
                  const wt = p.net_weight || p.weight || 0.0;
                  if (isSilver) silverWt += wt;
                  else goldWt += wt;
                });

                return (
                  <div className="space-y-4">
                    <h4 className="font-bold font-serif text-amber-955 text-xs uppercase tracking-wider border-b border-amber-100 pb-1 text-left">
                      📊 Summary Statistics
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-left">
                      <div className="bg-white border border-amber-100 p-4 rounded-xl shadow-xs">
                        <span className="text-[10px] text-amber-800/60 uppercase font-semibold">Total Pledges</span>
                        <p className="text-lg font-black text-amber-950 font-mono mt-0.5">{customerPledges.length}</p>
                      </div>
                      <div className="bg-white border border-amber-100 p-4 rounded-xl shadow-xs">
                        <span className="text-[10px] text-amber-800/60 uppercase font-semibold">Active Loans</span>
                        <p className="text-lg font-black text-amber-950 font-mono mt-0.5">{activePledges.length}</p>
                      </div>
                      <div className="bg-white border border-amber-100 p-4 rounded-xl shadow-xs">
                        <span className="text-[10px] text-amber-800/60 uppercase font-semibold">Outstanding Loan</span>
                        <p className="text-lg font-black text-amber-950 font-mono mt-0.5">₹{outstandingAmt.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="bg-white border border-amber-100 p-4 rounded-xl shadow-xs">
                        <span className="text-[10px] text-amber-800/60 uppercase font-semibold">Released Principal</span>
                        <p className="text-lg font-black text-emerald-700 font-mono mt-0.5">₹{releasedAmt.toLocaleString("en-IN")}</p>
                      </div>
                      <div className="bg-white border border-amber-100 p-4 rounded-xl shadow-xs col-span-2">
                        <span className="text-[10px] text-amber-800/60 uppercase font-semibold">Accumulated Weight In Custody</span>
                        <div className="flex gap-4 mt-1 font-mono text-xs font-bold text-amber-950">
                          <span>🟡 Gold: {goldWt.toFixed(2)} g</span>
                          <span>⚪ Silver: {silverWt.toFixed(2)} g</span>
                        </div>
                      </div>
                    </div>

                    {/* History List */}
                    <div className="space-y-3 pt-2">
                      <h4 className="font-bold font-serif text-amber-955 text-xs uppercase tracking-wider border-b border-amber-100 pb-1 text-left">
                        📜 Loan & Pledge History
                      </h4>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                        {customerPledges.length === 0 ? (
                          <p className="text-xs text-amber-800/50 italic text-center py-4">No transactions recorded.</p>
                        ) : (
                          customerPledges.map(p => {
                            const isPledgeReleased = p.status === "RELEASED";
                            return (
                              <div
                                key={p.id}
                                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${isPledgeReleased ? 'bg-emerald-50/10 border-emerald-100' : 'bg-amber-50/10 border-amber-100'}`}
                              >
                                <div className="text-left space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-amber-955">#{p.pledge_no}</span>
                                    <span className="text-[10px] text-amber-800/60 font-semibold">{formatDateDMY(p.date || getPledgeDateFromDueDate(p.due_date))}</span>
                                  </div>
                                  <div className="text-[11px] text-amber-900 leading-tight font-medium">
                                    {p.ornament} (Wt: {p.net_weight || p.weight || 0.0}g)
                                  </div>
                                </div>
                                <div className="text-right space-y-1">
                                  <span className="font-mono font-black text-amber-955 block">₹{p.amount.toLocaleString("en-IN")}</span>
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${isPledgeReleased ? 'bg-emerald-100 text-emerald-850' : 'bg-amber-100 text-amber-850'}`}>
                                    {p.status}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

