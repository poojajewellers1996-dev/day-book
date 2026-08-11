"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, Landmark, RefreshCw, Pencil, CheckCircle, 
  Building2, Calendar, Coins, User, Layers, ArrowUpRight,
  Filter, ArrowUpDown, XCircle, RotateCcw, SlidersHorizontal,
  Plus, History, Check, DollarSign, ArrowDownRight, Trash2
} from "lucide-react";
import { PledgeEntry, fetchAllPledges, updatePledgeEntry, fetchDayBook, addSubEntry } from "../utils/api";
export const UPI_ACCOUNTS = [
  { key: "hdfc_192", label: "HDFC Bank CA - 192" },
  { key: "hdfc_od_7442", label: "HDFC OD - 7442" },
  { key: "pooja_068", label: "Pooja Jewellers - 068" },
  { key: "shankarlal_832", label: "Shankarlal - 832" },
  { key: "vikash", label: "Vikash" },
  { key: "vikram", label: "Vikram" },
  { key: "deepak", label: "Deepak" },
  { key: "kavitha", label: "Kavitha" }
];

const formatDateDMY = (dateStr: string | undefined) => {
  if (!dateStr) return "—";
  if (dateStr.includes("/")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

interface BankRePledgeLedgerViewProps {
  currentDate: string;
  onRefreshDaybook: () => void;
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

export interface BankInterestPayment {
  id?: string;
  date: string;
  amount: number;
  payment_method?: string;
  remarks?: string;
}

export interface BankSubEntry {
  name: string;
  bank: string;
  loan_no?: string;
  date: string;
  amount: string;
  linked_girvies: string;
  interest_payments?: BankInterestPayment[];
  interest_amount?: string;
  interest_rate?: string;
  status?: string;
  release_date?: string;
  release_amount?: number;
}

export interface GroupedRePledgeRecord {
  primaryPledgeId: number;
  pledgeNos: string[];
  customerNames: string[];
  ornamentsList: Array<{ no: string; name: string; weight: number }>;
  totalWeight: number;
  bankName: string;
  bankPledgerName: string;
  bankLoanNo: string;
  repledgeDate: string;
  loanAmount: number;
  interestPayments: BankInterestPayment[];
  totalInterestPaid: number;
  status: string;

  // Primary pledge object & all linked pledges for edit/view
  originalPledge: PledgeEntry;
  allPledgesInGroup: PledgeEntry[];
}

export default function BankRePledgeLedgerView({
  currentDate,
  onRefreshDaybook,
  showNotification,
}: BankRePledgeLedgerViewProps) {
  const [pledges, setPledges] = useState<PledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "RELEASED" | "ALL">("ACTIVE");

  // Advanced Filters State
  const [selectedPledgerFilter, setSelectedPledgerFilter] = useState<string>("ALL");
  const [datePresetFilter, setDatePresetFilter] = useState<"ALL" | "TODAY" | "THIS_MONTH" | "CUSTOM">("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minAmount, setMinAmount] = useState<string>("");
  const [maxAmount, setMaxAmount] = useState<string>("");
  const [sortBy, setSortBy] = useState<"DATE_DESC" | "DATE_ASC" | "AMOUNT_DESC" | "AMOUNT_ASC" | "WEIGHT_DESC" | "BANK_AZ">("DATE_DESC");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);


  // Edit Modal State
  const [editingPledge, setEditingPledge] = useState<PledgeEntry | null>(null);
  const [editBankEntries, setEditBankEntries] = useState<BankSubEntry[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Bundled Girvi Full Details Modal State
  const [viewPledgeModal, setViewPledgeModal] = useState<PledgeEntry | null>(null);

  // Add Bank Interest Payment Modal State
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [selectedRecordForInterest, setSelectedRecordForInterest] = useState<GroupedRePledgeRecord | null>(null);
  const [interestPayDate, setInterestPayDate] = useState("");
  const [interestPayAmount, setInterestPayAmount] = useState("");
  const [interestPayMode, setInterestPayMode] = useState("CASH");
  const [interestPayRemarks, setInterestPayRemarks] = useState("");
  const [interestSubmitting, setInterestSubmitting] = useState(false);

  // View Interest History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedRecordForHistory, setSelectedRecordForHistory] = useState<GroupedRePledgeRecord | null>(null);

  // Release Bank Loan Modal State
  const [showReleaseBankModal, setShowReleaseBankModal] = useState(false);
  const [selectedRecordForRelease, setSelectedRecordForRelease] = useState<GroupedRePledgeRecord | null>(null);
  const [releaseBankDate, setReleaseBankDate] = useState("");
  const [releaseBankAmount, setReleaseBankAmount] = useState("");
  const [releaseBankInterest, setReleaseBankInterest] = useState("");
  const [releaseBankMode, setReleaseBankMode] = useState("CASH");
  const [releaseSplitCash, setReleaseSplitCash] = useState("");
  const [releaseSplitUpi, setReleaseSplitUpi] = useState("");
  const [releaseSplitAccount, setReleaseSplitAccount] = useState("vikram");
  const [releaseSplitOther, setReleaseSplitOther] = useState("");
  const [releaseSplitAccount2, setReleaseSplitAccount2] = useState("hdfc_192");
  const [releaseSubmitting, setReleaseSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAllPledges();
      setPledges(data || []);
    } catch (e: any) {
      showNotification("Failed to load pledge records", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Group all repledged items by bank loan bundle
  const groupedRecords: GroupedRePledgeRecord[] = [];
  const processedPledgeIds = new Set<number>();

  pledges.forEach((p) => {
    if (processedPledgeIds.has(p.id)) return;
    if ((p.is_repledged ?? 0) === 0) return;
    const hasRepledgeEntries = Boolean(p.repledged_entries && p.repledged_entries !== "[]");
    if ((p.is_repledged ?? 0) !== 1 && !hasRepledgeEntries) return;

    let subEntries: BankSubEntry[] = [];
    if (p.repledged_entries) {
      try {
        const parsed = JSON.parse(p.repledged_entries);
        if (Array.isArray(parsed) && parsed.length > 0) {
          subEntries = parsed;
        }
      } catch (e) {}
    }

    if (subEntries.length === 0) {
      subEntries.push({
        name: p.repledged_name || "",
        bank: p.repledged_bank || "",
        loan_no: p.repledged_receipt_no || "",
        date: p.repledged_date || "",
        amount: p.repledged_amount ? p.repledged_amount.toString() : "",
        linked_girvies: "",
        interest_amount: p.repledged_interest_amount ? p.repledged_interest_amount.toString() : "",
        interest_rate: p.repledged_interest_rate || "",
      });
    }

    subEntries.forEach((sub) => {
      // Find all linked pledge entries mentioned in linked_girvies
      const linkedNos = (sub.linked_girvies || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const groupPledges: PledgeEntry[] = [p];
      processedPledgeIds.add(p.id);

      linkedNos.forEach((noStr) => {
        const cleanNo = noStr.toLowerCase().replace(/^#/, "");
        const matched = pledges.find((otherP) => {
          const otherNo = (otherP.pledge_no || "").toLowerCase().replace(/^#/, "");
          return (otherNo === cleanNo || otherP.id.toString() === cleanNo) && !processedPledgeIds.has(otherP.id);
        });
        if (matched) {
          groupPledges.push(matched);
          processedPledgeIds.add(matched.id);
        }
      });

      const pledgeNos = groupPledges.map((gp) => gp.pledge_no || `#${gp.id}`);
      const customerNames = groupPledges.map((gp) => gp.customer_name || "");
      const ornamentsList = groupPledges.map((gp) => ({
        no: gp.pledge_no || `#${gp.id}`,
        name: gp.ornament || "",
        weight: gp.net_weight || gp.weight || 0,
      }));
      const totalWeight = ornamentsList.reduce((s, o) => s + o.weight, 0);

      let interestPayments: BankInterestPayment[] = [];
      if (Array.isArray(sub.interest_payments) && sub.interest_payments.length > 0) {
        interestPayments = sub.interest_payments;
      } else if (p.repledged_interest_amount && p.repledged_interest_amount > 0) {
        interestPayments = [{ date: p.repledged_date || p.date || "", amount: p.repledged_interest_amount }];
      } else if (sub.interest_amount && parseFloat(sub.interest_amount) > 0) {
        interestPayments = [{ date: sub.date || p.repledged_date || p.date || "", amount: parseFloat(sub.interest_amount) }];
      }

      const totalInterestPaid = interestPayments.reduce((s, pay) => s + (pay.amount || 0), 0);
      const recordStatus = sub.status || "ACTIVE";

      groupedRecords.push({
        primaryPledgeId: p.id,
        pledgeNos,
        customerNames,
        ornamentsList,
        totalWeight,
        bankName: sub.bank || p.repledged_bank || "Other Bank",
        bankPledgerName: sub.name || p.repledged_name || p.customer_name || "",
        bankLoanNo: sub.loan_no || p.repledged_receipt_no || "",
        repledgeDate: sub.date || p.repledged_date || p.date || "",
        loanAmount: parseFloat(sub.amount) || p.repledged_amount || 0,
        interestPayments,
        totalInterestPaid,
        status: recordStatus,
        originalPledge: p,
        allPledgesInGroup: groupPledges,
      });
    });
  });

  // Extract unique bank names and pledger names for filters
  const knownBanksSet = new Set<string>();
  const knownPledgersSet = new Set<string>();
  groupedRecords.forEach((r) => {
    if (r.bankName) knownBanksSet.add(r.bankName);
    if (r.bankPledgerName) knownPledgersSet.add(r.bankPledgerName);
  });
  const availableBanks = Array.from(knownBanksSet);
  const availablePledgers = Array.from(knownPledgersSet);

  // Filter records
  const filteredRecords = groupedRecords.filter((r) => {
    // Status filter
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;

    // Bank filter
    if (selectedBankFilter !== "ALL" && r.bankName !== selectedBankFilter) return false;

    // Pledger filter
    if (selectedPledgerFilter !== "ALL" && r.bankPledgerName !== selectedPledgerFilter) return false;

    // Date Preset filter
    if (datePresetFilter === "TODAY") {
      const todayStr = new Date().toISOString().split("T")[0];
      if (r.repledgeDate && !r.repledgeDate.includes(todayStr) && formatDateDMY(r.repledgeDate) !== formatDateDMY(todayStr)) return false;
    } else if (datePresetFilter === "THIS_MONTH") {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, "0");
      const monthPrefix = `${yr}-${mo}`;
      if (r.repledgeDate && !r.repledgeDate.startsWith(monthPrefix)) return false;
    } else if (datePresetFilter === "CUSTOM") {
      if (startDate && r.repledgeDate && r.repledgeDate < startDate) return false;
      if (endDate && r.repledgeDate && r.repledgeDate > endDate) return false;
    }

    // Min & Max Amount filter
    if (minAmount && r.loanAmount < parseFloat(minAmount)) return false;
    if (maxAmount && r.loanAmount > parseFloat(maxAmount)) return false;

    // Search filter
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const nosCombined = r.pledgeNos.join(" ").toLowerCase();
    const custsCombined = r.customerNames.join(" ").toLowerCase();
    const ornamentsCombined = r.ornamentsList.map((o) => o.name).join(" ").toLowerCase();

    return (
      nosCombined.includes(q) ||
      custsCombined.includes(q) ||
      r.bankPledgerName.toLowerCase().includes(q) ||
      r.bankName.toLowerCase().includes(q) ||
      r.bankLoanNo.toLowerCase().includes(q) ||
      ornamentsCombined.includes(q)
    );
  });

  // Sorting
  filteredRecords.sort((a, b) => {
    if (sortBy === "DATE_DESC") return (b.repledgeDate || "").localeCompare(a.repledgeDate || "");
    if (sortBy === "DATE_ASC") return (a.repledgeDate || "").localeCompare(b.repledgeDate || "");
    if (sortBy === "AMOUNT_DESC") return b.loanAmount - a.loanAmount;
    if (sortBy === "AMOUNT_ASC") return a.loanAmount - b.loanAmount;
    if (sortBy === "WEIGHT_DESC") return b.totalWeight - a.totalWeight;
    if (sortBy === "BANK_AZ") return (a.bankName || "").localeCompare(b.bankName || "");
    return 0;
  });

  const resetAllFilters = () => {
    setSearchTerm("");
    setSelectedBankFilter("ALL");
    setStatusFilter("ACTIVE");
    setSelectedPledgerFilter("ALL");
    setDatePresetFilter("ALL");
    setStartDate("");
    setEndDate("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("DATE_DESC");
  };


  // Calculations
  const totalLoanAmount = filteredRecords.reduce((sum, r) => sum + r.loanAmount, 0);
  const totalInterestAmount = filteredRecords.reduce((sum, r) => sum + r.totalInterestPaid, 0);
  const activeCount = filteredRecords.filter((r) => r.status === "ACTIVE").length;

  // Open Add Interest Payment Modal
  const handleOpenAddInterest = (record: GroupedRePledgeRecord) => {
    setSelectedRecordForInterest(record);
    setInterestPayDate(currentDate || new Date().toISOString().split("T")[0]);
    setInterestPayAmount("");
    setInterestPayMode("CASH");
    setInterestPayRemarks("");
    setShowInterestModal(true);
  };

  // Submit Interest Payment & Auto Add Debit to Day Book
  const handleAddInterestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForInterest) return;
    const amt = parseFloat(interestPayAmount);
    if (isNaN(amt) || amt <= 0) {
      showNotification("Please enter a valid interest amount", "error");
      return;
    }
    const payDate = interestPayDate || currentDate || new Date().toISOString().split("T")[0];

    setInterestSubmitting(true);
    try {
      const origPledge = selectedRecordForInterest.originalPledge;
      let entries: BankSubEntry[] = [];
      if (origPledge.repledged_entries) {
        try {
          const parsed = JSON.parse(origPledge.repledged_entries);
          if (Array.isArray(parsed) && parsed.length > 0) entries = parsed;
        } catch (e) {}
      }

      if (entries.length === 0) {
        entries.push({
          name: origPledge.repledged_name || "",
          bank: origPledge.repledged_bank || "",
          date: origPledge.repledged_date || "",
          amount: origPledge.repledged_amount ? origPledge.repledged_amount.toString() : "",
          linked_girvies: "",
        });
      }

      const newPay: BankInterestPayment = {
        id: Date.now().toString(),
        date: payDate,
        amount: amt,
        payment_method: interestPayMode,
        remarks: interestPayRemarks.trim(),
      };

      if (!entries[0].interest_payments) {
        entries[0].interest_payments = [];
      }
      entries[0].interest_payments.push(newPay);

      const totalPaid = entries[0].interest_payments.reduce((s, p) => s + (p.amount || 0), 0);

      const payload: Partial<PledgeEntry> = {
        repledged_entries: JSON.stringify(entries),
        repledged_interest_amount: totalPaid,
      };

      const dateStr = origPledge.date || currentDate;
      const ok = await updatePledgeEntry(origPledge.id, payload, dateStr);

      if (ok) {
        // Auto-Add Debit Entry (Javak) in Day Book for payDate
        try {
          const upiPrefix =
            interestPayMode === "HDFC"
              ? "[UPI:hdfc_192] "
              : interestPayMode === "HDFC_OD"
              ? "[UPI:hdfc_od_7442] "
              : interestPayMode === "UPI"
              ? "[UPI:hdfc_192] "
              : interestPayMode === "OTHER"
              ? "[OTHER] "
              : "";

          const modeLabel =
            interestPayMode === "HDFC"
              ? " (HDFC Bank)"
              : interestPayMode === "HDFC_OD"
              ? " (HDFC OD)"
              : interestPayMode === "UPI"
              ? " (UPI/PhonePe)"
              : interestPayMode === "OTHER"
              ? " (Other Bank)"
              : " (Cash)";

          const dbRes = await fetchDayBook(payDate);
          if (dbRes && dbRes.data) {
            await addSubEntry(dbRes.data.id, payDate, "debit", {
              name: interestPayMode === "HDFC" || interestPayMode === "HDFC_OD" ? "HDFC Bank" : interestPayMode === "UPI" ? "PhonePe/UPI" : "Bank Interest",
              particulars: `${upiPrefix}Bank Interest Paid: Loan #${selectedRecordForInterest.bankLoanNo || selectedRecordForInterest.pledgeNos.join("/")} (${selectedRecordForInterest.bankName})${modeLabel}`,
              amount: amt,
              remarks: `Payment Method: ${interestPayMode}`,
            });
          }
        } catch (err) {
          console.warn("Failed to auto-add Debit entry to Day Book:", err);
        }

        showNotification(
          `Added ₹${amt.toLocaleString("en-IN")} Bank Interest payment for Loan #${selectedRecordForInterest.bankLoanNo || selectedRecordForInterest.pledgeNos.join("/")} & recorded Debit in Day Book!`,
          "success"
        );
        setShowInterestModal(false);
        setSelectedRecordForInterest(null);
        setInterestPayAmount("");
        setInterestPayRemarks("");
        loadData();
        onRefreshDaybook();
      } else {
        showNotification("Failed to save interest payment", "error");
      }
    } catch (e) {
      showNotification("Error saving interest payment", "error");
    } finally {
      setInterestSubmitting(false);
    }
  };

  // Delete Interest Payment Entry from Log
  const handleDeleteInterestPayment = async (payIndex: number) => {
    if (!selectedRecordForHistory) return;
    if (!window.confirm("Are you sure you want to delete this bank interest payment entry?")) return;

    try {
      const origPledge = selectedRecordForHistory.originalPledge;
      let entries: BankSubEntry[] = [];
      if (origPledge.repledged_entries) {
        try {
          const parsed = JSON.parse(origPledge.repledged_entries);
          if (Array.isArray(parsed) && parsed.length > 0) entries = parsed;
        } catch (e) {}
      }

      if (entries.length > 0 && Array.isArray(entries[0].interest_payments)) {
        const deletedItem = entries[0].interest_payments[payIndex];
        entries[0].interest_payments.splice(payIndex, 1);

        const totalPaid = entries[0].interest_payments.reduce((s, p) => s + (p.amount || 0), 0);

        const payload: Partial<PledgeEntry> = {
          repledged_entries: JSON.stringify(entries),
          repledged_interest_amount: totalPaid,
        };

        const dateStr = origPledge.date || currentDate;
        const ok = await updatePledgeEntry(origPledge.id, payload, dateStr);

        if (ok) {
          showNotification(
            `Deleted Bank Interest payment of ₹${deletedItem ? deletedItem.amount.toLocaleString("en-IN") : ""}!`,
            "success"
          );
          setSelectedRecordForHistory((prev) => {
            if (!prev) return null;
            const updatedList = [...prev.interestPayments];
            updatedList.splice(payIndex, 1);
            return {
              ...prev,
              interestPayments: updatedList,
              totalInterestPaid: totalPaid,
            };
          });
          loadData();
          onRefreshDaybook();
        } else {
          showNotification("Failed to delete interest payment", "error");
        }
      }
    } catch (e) {
      showNotification("Error deleting interest payment", "error");
    }
  };

  // Open Release Bank Loan Modal
  const handleOpenReleaseBank = (record: GroupedRePledgeRecord) => {
    setSelectedRecordForRelease(record);
    setReleaseBankDate(currentDate || new Date().toISOString().split("T")[0]);
    setReleaseBankAmount(record.loanAmount ? record.loanAmount.toString() : "");
    setReleaseBankInterest("");
    setReleaseBankMode("CASH");
    setReleaseSplitCash("");
    setReleaseSplitUpi("");
    setReleaseSplitAccount("vikram");
    setReleaseSplitOther("");
    setReleaseSplitAccount2("hdfc_192");
    setShowReleaseBankModal(true);
  };

  // Submit Manual Bank Loan Release & Auto Add Debit to Day Book
  const handleReleaseBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordForRelease) return;

    const isSplitMode = releaseBankMode === "SPLIT";
    const splitCashVal = isSplitMode ? (parseFloat(releaseSplitCash) || 0) : 0;
    const splitUpiVal = isSplitMode ? (parseFloat(releaseSplitUpi) || 0) : 0;
    const splitOtherVal = isSplitMode ? (parseFloat(releaseSplitOther) || 0) : 0;
    const splitSum = splitCashVal + splitUpiVal + splitOtherVal;

    const relPrincipal = parseFloat(releaseBankAmount) || selectedRecordForRelease.loanAmount;
    const relInterest = parseFloat(releaseBankInterest) || 0;
    const requiredTotal = relPrincipal + relInterest;

    if (isSplitMode && splitSum <= 0) {
      showNotification("Please enter split amounts for Cash and Accounts.", "error");
      return;
    }

    const totalPaidBack = isSplitMode ? splitSum : requiredTotal;
    const relDate = releaseBankDate || currentDate || new Date().toISOString().split("T")[0];

    setReleaseSubmitting(true);
    try {
      const origPledge = selectedRecordForRelease.originalPledge;
      let entries: BankSubEntry[] = [];
      if (origPledge.repledged_entries) {
        try {
          const parsed = JSON.parse(origPledge.repledged_entries);
          if (Array.isArray(parsed) && parsed.length > 0) entries = parsed;
        } catch (e) {}
      }

      if (entries.length === 0) {
        entries.push({
          name: origPledge.repledged_name || "",
          bank: origPledge.repledged_bank || "",
          date: origPledge.repledged_date || "",
          amount: origPledge.repledged_amount ? origPledge.repledged_amount.toString() : "",
          linked_girvies: "",
        });
      }

      const splitTag = isSplitMode
        ? `[SPLIT:C${splitCashVal}:U${splitUpiVal}:O${splitOtherVal}:A${releaseSplitAccount}]`
        : releaseBankMode;

      entries = entries.map((entryItem) => {
        const existingPayments = Array.isArray(entryItem.interest_payments) ? [...entryItem.interest_payments] : [];
        if (relInterest > 0) {
          existingPayments.push({
            date: relDate,
            amount: relInterest,
            remarks: "Release Interest Paid",
          });
        }
        return {
          ...entryItem,
          status: "RELEASED",
          release_date: relDate,
          release_amount: relPrincipal,
          release_interest: relInterest,
          release_total_paid: totalPaidBack,
          release_mode: splitTag,
          interest_payments: existingPayments,
        };
      });

      const payload: Partial<PledgeEntry> = {
        is_repledged: 1,
        repledged_entries: JSON.stringify(entries),
      };

      const dateStr = origPledge.date || currentDate;
      const ok = await updatePledgeEntry(origPledge.id, payload, dateStr);

      if (ok) {
        // Auto-Add Debit Entry (Javak) in Day Book for releaseBankDate
        try {
          const dbRes = await fetchDayBook(relDate);
          if (dbRes && dbRes.data) {
            const loanLabel = `Loan #${selectedRecordForRelease.bankLoanNo || selectedRecordForRelease.pledgeNos.join("/")} (${selectedRecordForRelease.bankName})`;

            if (isSplitMode) {
              const acc1Obj = UPI_ACCOUNTS.find(a => a.key === releaseSplitAccount);
              const acc1Label = acc1Obj ? acc1Obj.label : releaseSplitAccount;
              const acc2Obj = UPI_ACCOUNTS.find(a => a.key === releaseSplitAccount2);
              const acc2Label = acc2Obj ? acc2Obj.label : releaseSplitAccount2;

              if (splitCashVal > 0) {
                await addSubEntry(dbRes.data.id, relDate, "debit", {
                  name: "Bank Loan Release (Cash)",
                  particulars: `Bank Loan Paid & Released (Cash): ${loanLabel}`,
                  amount: splitCashVal,
                  remarks: `Split Release Cash | Principal: ₹${relPrincipal} | Interest: ₹${relInterest}`,
                });
              }

              if (splitUpiVal > 0) {
                await addSubEntry(dbRes.data.id, relDate, "debit", {
                  name: acc1Label,
                  particulars: `[UPI:${releaseSplitAccount}] Bank Loan Paid & Released (${acc1Label}): ${loanLabel}`,
                  amount: splitUpiVal,
                  remarks: `Split Release Account 1 (${acc1Label})`,
                });
              }

              if (splitOtherVal > 0) {
                await addSubEntry(dbRes.data.id, relDate, "debit", {
                  name: acc2Label,
                  particulars: `[UPI:${releaseSplitAccount2}] Bank Loan Paid & Released (${acc2Label}): ${loanLabel}`,
                  amount: splitOtherVal,
                  remarks: `Split Release Account 2 (${acc2Label})`,
                });
              }
            } else {
              const upiPrefix =
                releaseBankMode === "HDFC"
                  ? "[UPI:hdfc_192] "
                  : releaseBankMode === "HDFC_OD"
                  ? "[UPI:hdfc_od_7442] "
                  : releaseBankMode === "UPI"
                  ? "[UPI:hdfc_192] "
                  : releaseBankMode === "OTHER"
                  ? "[OTHER] "
                  : "";

              const modeLabel =
                releaseBankMode === "HDFC"
                  ? " (HDFC Bank)"
                  : releaseBankMode === "HDFC_OD"
                  ? " (HDFC OD)"
                  : releaseBankMode === "UPI"
                  ? " (UPI/PhonePe)"
                  : releaseBankMode === "OTHER"
                  ? " (Other Bank)"
                  : " (Cash)";

              const detailStr = relInterest > 0
                ? `${loanLabel} - Principal ₹${relPrincipal.toLocaleString("en-IN")} + Interest ₹${relInterest.toLocaleString("en-IN")}`
                : loanLabel;

              await addSubEntry(dbRes.data.id, relDate, "debit", {
                name: releaseBankMode === "HDFC" || releaseBankMode === "HDFC_OD" ? "HDFC Bank" : releaseBankMode === "UPI" ? "PhonePe/UPI" : "Bank Loan Release",
                particulars: `${upiPrefix}Bank Loan Paid & Released: ${detailStr}${modeLabel}`,
                amount: totalPaidBack,
                remarks: `Release Payment Method: ${releaseBankMode} | Principal: ₹${relPrincipal} | Interest: ₹${relInterest}`,
              });
            }
          }
        } catch (err) {
          console.warn("Failed to auto-add Debit entry to Day Book:", err);
        }

        showNotification(
          `Released Bank Loan #${selectedRecordForRelease.bankLoanNo || selectedRecordForRelease.pledgeNos.join("/")} (Total ₹${totalPaidBack.toLocaleString("en-IN")}) & recorded Debit in Day Book!`,
          "success"
        );
        setShowReleaseBankModal(false);
        setSelectedRecordForRelease(null);
        loadData();
        onRefreshDaybook();
      } else {
        showNotification("Failed to release bank loan", "error");
      }
    } catch (e) {
      showNotification("Error releasing bank loan", "error");
    } finally {
      setReleaseSubmitting(false);
    }
  };

  // Open Edit Bank Modal for a record
  const handleOpenEdit = (record: GroupedRePledgeRecord) => {
    setEditingPledge(record.originalPledge);
    let entries: BankSubEntry[] = [];
    if (record.originalPledge.repledged_entries) {
      try {
        const parsed = JSON.parse(record.originalPledge.repledged_entries);
        if (Array.isArray(parsed) && parsed.length > 0) {
          entries = parsed.map((e: any) => ({
            name: e.name || "",
            bank: e.bank || "",
            loan_no: e.loan_no || record.originalPledge.repledged_receipt_no || "",
            date: e.date || "",
            amount: e.amount ? e.amount.toString() : "",
            linked_girvies: e.linked_girvies || "",
            interest_payments: e.interest_payments || [],
            interest_amount: e.interest_amount ? e.interest_amount.toString() : "",
            interest_rate: e.interest_rate || "",
          }));
        }
      } catch (e) {}
    }

    if (entries.length === 0) {
      entries.push({
        name: record.originalPledge.repledged_name || "",
        bank: record.originalPledge.repledged_bank || "",
        loan_no: record.originalPledge.repledged_receipt_no || "",
        date: record.originalPledge.repledged_date || "",
        amount: record.originalPledge.repledged_amount ? record.originalPledge.repledged_amount.toString() : "",
        linked_girvies: "",
        interest_amount: record.originalPledge.repledged_interest_amount ? record.originalPledge.repledged_interest_amount.toString() : "",
        interest_rate: record.originalPledge.repledged_interest_rate || "",
      });
    }

    setEditBankEntries(entries);
  };

  const handleSaveBankDetails = async () => {
    if (!editingPledge) return;
    setEditSaving(true);
    try {
      const validEntries = editBankEntries.filter((e) => e.bank.trim() && e.amount);
      const isStillRepledged = validEntries.length > 0 ? 1 : 0;
      const firstEntry = validEntries[0];

      const payload: Partial<PledgeEntry> = {
        is_repledged: isStillRepledged,
        repledged_entries: isStillRepledged ? JSON.stringify(validEntries) : null,
        repledged_bank: isStillRepledged && firstEntry?.bank ? firstEntry.bank : null,
        repledged_receipt_no: isStillRepledged && firstEntry?.loan_no ? firstEntry.loan_no : null,
        repledged_amount: isStillRepledged && firstEntry?.amount ? parseFloat(firstEntry.amount) : null,
        repledged_interest_amount: isStillRepledged && firstEntry?.interest_amount ? parseFloat(firstEntry.interest_amount) : null,
        repledged_interest_rate: isStillRepledged && firstEntry?.interest_rate ? firstEntry.interest_rate : null,
        repledged_date: isStillRepledged && firstEntry?.date ? firstEntry.date : null,
        repledged_name: isStillRepledged && firstEntry?.name ? firstEntry.name : null,
      };

      const dateStr = editingPledge.date || currentDate;
      const ok = await updatePledgeEntry(editingPledge.id, payload, dateStr);
      if (ok) {
        showNotification(`Bank details updated for Girvi ${editingPledge.pledge_no}!`, "success");
        setEditingPledge(null);
        loadData();
        onRefreshDaybook();
      } else {
        showNotification("Failed to update bank details", "error");
      }
    } catch (e: any) {
      showNotification("Error saving bank details", "error");
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER & SEARCH BAR ── */}
      <div 
        className="rounded-3xl p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1e1b18 0%, #2d1b0e 100%)",
          boxShadow: "0 10px 30px rgba(45,27,14,0.15)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl text-amber-400">
              🏦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-wide" style={{ fontFamily: "Georgia, serif" }}>
                  Bank Re-Pledge Ledger
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {filteredRecords.length} Loans
                </span>
              </div>
              <p className="text-xs text-amber-200/60 mt-0.5">
                Track and manage all items pledged / deposited at Banks & Finance Companies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2.5 rounded-xl border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/10 transition-colors flex items-center gap-2"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="mt-5 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400/60" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Girvi Nos, Customer Names, Bank Pledger Name, or Bank Name..."
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-amber-500/20 bg-white/5 text-white placeholder-amber-200/40 text-xs font-medium outline-none focus:border-amber-400 focus:bg-white/10 transition-all"
          />
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Bank Loan */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Total Bank Loan Amount</span>
            <div className="text-2xl font-black text-amber-950 font-mono mt-1">
              ₹{totalLoanAmount.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] font-medium text-amber-700">Total principal borrowed from Banks</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
            <Landmark size={24} />
          </div>
        </div>

        {/* Total Bank Interest */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-850">Total Interest Amount</span>
            <div className="text-2xl font-black text-purple-950 font-mono mt-1">
              ₹{totalInterestAmount.toLocaleString("en-IN")}
            </div>
            <span className="text-[10px] font-medium text-purple-750">Tracked interest cost payable to Banks</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
            <Coins size={24} />
          </div>
        </div>

        {/* Active Items */}
        <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">Active Bank Loans</span>
            <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
              {activeCount} Bank Receipts
            </div>
            <span className="text-[10px] font-medium text-amber-700">Currently deposited in bank vaults</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <Building2 size={24} />
          </div>
        </div>
      </div>

      {/* ── FILTERS BAR ── */}
      <div className="bg-white rounded-3xl p-4 border border-amber-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Bank Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 mr-1 flex items-center gap-1">
              <Building2 size={12} /> Bank:
            </span>
            <button
              onClick={() => setSelectedBankFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedBankFilter === "ALL"
                  ? "bg-amber-900 text-white shadow-sm"
                  : "bg-amber-50 text-amber-850 hover:bg-amber-100 border border-amber-200"
              }`}
            >
              All Banks ({groupedRecords.length})
            </button>
            {availableBanks.map((bank) => {
              const count = groupedRecords.filter((r) => r.bankName === bank).length;
              return (
                <button
                  key={bank}
                  onClick={() => setSelectedBankFilter(bank)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedBankFilter === bank
                      ? "bg-amber-900 text-white shadow-sm"
                      : "bg-amber-50 text-amber-850 hover:bg-amber-100 border border-amber-200"
                  }`}
                >
                  {bank} ({count})
                </button>
              );
            })}
          </div>

          {/* Right Side: Status Filter & Toggle Advanced Filters */}
          <div className="flex flex-wrap items-center gap-2.5 self-end md:self-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-amber-50 p-1 rounded-xl border border-amber-200">
              <button
                onClick={() => setStatusFilter("ACTIVE")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === "ACTIVE" ? "bg-white text-amber-950 shadow-xs" : "text-amber-800 hover:text-amber-950"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter("RELEASED")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === "RELEASED" ? "bg-white text-amber-950 shadow-xs" : "text-amber-800 hover:text-amber-950"
                }`}
              >
                Released
              </button>
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === "ALL" ? "bg-white text-amber-950 shadow-xs" : "text-amber-800 hover:text-amber-950"
                }`}
              >
                All Status
              </button>
            </div>

            {/* Toggle Advanced Filters Button */}
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                showAdvancedFilters || datePresetFilter !== "ALL" || selectedPledgerFilter !== "ALL" || minAmount || maxAmount || sortBy !== "DATE_DESC"
                  ? "bg-amber-800 text-white border-amber-800 shadow-sm"
                  : "bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>More Filters & Sort</span>
            </button>
          </div>
        </div>

        {/* ── EXPANDABLE ADVANCED FILTERS PANEL ── */}
        {showAdvancedFilters && (
          <div className="pt-3 border-t border-amber-200/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-amber-50/50 p-3.5 rounded-2xl">
            {/* 1. Date Range Preset */}
            <div>
              <label className="block text-[10px] font-black uppercase text-amber-900 mb-1 flex items-center gap-1">
                <Calendar size={12} /> Date Filter
              </label>
              <select
                value={datePresetFilter}
                onChange={(e) => setDatePresetFilter(e.target.value as any)}
                className="w-full text-xs p-2 border border-amber-300 rounded-xl bg-white focus:ring-1 focus:ring-amber-500 font-medium text-amber-950"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="CUSTOM">Custom Date Range</option>
              </select>

              {datePresetFilter === "CUSTOM" && (
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-[11px] p-1.5 border border-amber-300 rounded-lg bg-white"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-[11px] p-1.5 border border-amber-300 rounded-lg bg-white"
                  />
                </div>
              )}
            </div>

            {/* 2. Pledger Name Dropdown */}
            <div>
              <label className="block text-[10px] font-black uppercase text-amber-900 mb-1 flex items-center gap-1">
                <User size={12} /> Bank Pledger Name
              </label>
              <select
                value={selectedPledgerFilter}
                onChange={(e) => setSelectedPledgerFilter(e.target.value)}
                className="w-full text-xs p-2 border border-amber-300 rounded-xl bg-white focus:ring-1 focus:ring-amber-500 font-medium text-amber-950"
              >
                <option value="ALL">All Pledgers ({availablePledgers.length})</option>
                {availablePledgers.map((pName) => (
                  <option key={pName} value={pName}>
                    {pName}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Min & Max Loan Amount */}
            <div>
              <label className="block text-[10px] font-black uppercase text-amber-900 mb-1 flex items-center gap-1">
                <Coins size={12} /> Loan Amount Range (₹)
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  placeholder="Min ₹"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="w-full text-xs p-2 border border-amber-300 rounded-xl bg-white font-mono placeholder:text-amber-400"
                />
                <input
                  type="number"
                  placeholder="Max ₹"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="w-full text-xs p-2 border border-amber-300 rounded-xl bg-white font-mono placeholder:text-amber-400"
                />
              </div>
            </div>

            {/* 4. Sort By */}
            <div>
              <label className="block text-[10px] font-black uppercase text-amber-900 mb-1 flex items-center gap-1">
                <ArrowUpDown size={12} /> Sort Records By
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full text-xs p-2 border border-amber-300 rounded-xl bg-white focus:ring-1 focus:ring-amber-500 font-medium text-amber-950"
                >
                  <option value="DATE_DESC">Date: Newest First</option>
                  <option value="DATE_ASC">Date: Oldest First</option>
                  <option value="AMOUNT_DESC">Loan Amount: High → Low</option>
                  <option value="AMOUNT_ASC">Loan Amount: Low → High</option>
                  <option value="WEIGHT_DESC">Gold Weight: Heaviest First</option>
                  <option value="BANK_AZ">Bank Name (A-Z)</option>
                </select>

                <button
                  type="button"
                  onClick={resetAllFilters}
                  title="Reset All Filters"
                  className="p-2 text-amber-800 hover:text-red-700 hover:bg-amber-100 rounded-xl transition-all border border-amber-200"
                >
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>


      {/* ── DATA TABLE ── */}
      <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-amber-800">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-amber-600" />
            <p className="text-xs font-bold">Loading bank re-pledge records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-12 text-center text-amber-800">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3 text-xl">
              🏦
            </div>
            <h3 className="font-bold text-sm text-amber-950">No Bank Deposit Records Found</h3>
            <p className="text-xs text-amber-700 mt-1 max-w-sm mx-auto">
              {searchTerm || selectedBankFilter !== "ALL"
                ? "Try clearing filters or search terms."
                : "Mark items as 'Kept at Bank' when creating or editing Girvi pledges to view them here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-amber-50/80 border-b border-amber-200 text-[10px] font-black uppercase tracking-wider text-amber-900">
                  <th className="py-3.5 px-4 font-serif">Girvi No.</th>
                  <th className="py-3.5 px-4 font-serif">Customer Name</th>
                  <th className="py-3.5 px-4 font-serif">Ornament & Net Wt</th>
                  <th className="py-3.5 px-4 font-serif">Bank / Finance Co.</th>
                  <th className="py-3.5 px-4 font-serif">Pledger at Bank</th>
                  <th className="py-3.5 px-4 font-serif">Re-Pledge Date</th>
                  <th className="py-3.5 px-4 font-serif text-right">Bank Loan Amount</th>
                  <th className="py-3.5 px-4 font-serif text-right">Bank Interest</th>
                  <th className="py-3.5 px-4 font-serif text-center">Status</th>
                  <th className="py-3.5 px-4 font-serif text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {filteredRecords.map((r, i) => (
                  <tr key={`${r.primaryPledgeId}-${i}`} className="hover:bg-amber-50/40 transition-colors">
                    {/* Girvi Nos (Combined: M1109 / M1279) */}
                    <td className="py-3.5 px-4 font-mono font-black text-amber-950">
                      <div className="flex flex-wrap items-center gap-1">
                        {r.pledgeNos.map((no, idx) => (
                          <React.Fragment key={idx}>
                            {idx > 0 && <span className="text-amber-400 font-bold">/</span>}
                            <span 
                              onClick={() => setViewPledgeModal(r.allPledgesInGroup[idx])}
                              className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-950 border border-amber-200 hover:bg-amber-200 cursor-pointer transition-colors"
                              title="Click to view full pledge details"
                            >
                              {no}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    </td>

                    {/* Customer Names (Combined: Venktesh / Anjanappa) */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-amber-950">
                        {r.customerNames.join(" / ")}
                      </div>
                    </td>

                    {/* Ornaments & Net Weights */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {r.ornamentsList.map((o, oIdx) => (
                          <div key={oIdx} className="text-amber-950">
                            {r.ornamentsList.length > 1 && (
                              <span className="font-mono font-bold text-[10px] text-amber-800 mr-1">#{o.no}:</span>
                            )}
                            <span className="font-medium text-amber-900">{o.name}</span>
                            <span className="ml-1 text-[10px] font-mono text-amber-700 font-bold">({o.weight} g)</span>
                          </div>
                        ))}
                        {r.ornamentsList.length > 1 && (
                          <div className="text-[10px] font-mono font-black text-amber-950 pt-0.5 border-t border-amber-100">
                            Total Net Wt: {r.totalWeight.toFixed(2)} g
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Bank Name & Loan No */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className="font-black text-amber-950 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200/80 inline-block">
                          🏦 {r.bankName}
                        </span>
                        {r.bankLoanNo && (
                          <div className="text-[10px] font-mono font-black text-amber-800 bg-amber-100/60 px-2 py-0.5 rounded-lg border border-amber-200/60 w-fit">
                            Loan #{r.bankLoanNo}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Bank Pledger */}
                    <td className="py-3.5 px-4 font-bold text-amber-900">
                      {r.bankPledgerName || "—"}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 font-mono text-amber-900">
                      {formatDateDMY(r.repledgeDate)}
                    </td>

                    {/* Bank Loan Amount */}
                    <td className="py-3.5 px-4 text-right font-mono font-black text-amber-950 text-sm">
                      ₹{r.loanAmount.toLocaleString("en-IN")}
                    </td>

                    {/* Bank Interest Column */}
                    <td className="py-3.5 px-4 text-right font-mono">
                      <div>
                        <div className="font-black text-purple-950 text-xs">
                          ₹{r.totalInterestPaid.toLocaleString("en-IN")}
                        </div>
                        <div className="flex justify-end gap-1 mt-1">
                          {r.status === "ACTIVE" && (
                            <button
                              onClick={() => handleOpenAddInterest(r)}
                              className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 border border-purple-200 hover:bg-purple-200 text-[10px] font-extrabold transition-colors flex items-center gap-0.5"
                              title="Pay / Add Bank Interest (Auto-adds Debit in Day Book)"
                            >
                              <Plus size={10} /> Pay Int
                            </button>
                          )}
                          {r.interestPayments.length > 0 && (
                            <button
                              onClick={() => {
                                setSelectedRecordForHistory(r);
                                setShowHistoryModal(true);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-200 hover:bg-amber-200 text-[10px] font-bold transition-colors flex items-center gap-0.5"
                              title="View Interest Payment History Log"
                            >
                              <History size={10} /> {r.interestPayments.length}
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          r.status === "RELEASED"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-amber-100 text-amber-850 border border-amber-200"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>

                    {/* Action Column */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="px-2.5 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-950 font-bold transition-all flex items-center gap-1 text-[11px]"
                          title="Edit Bank Details"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>

                        {r.status === "ACTIVE" ? (
                          <button
                            onClick={() => handleOpenReleaseBank(r)}
                            className="px-2.5 py-1.5 rounded-xl border border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold transition-all flex items-center gap-1 text-[11px] shadow-sm"
                            title="Release Bank Loan & Auto-add Debit in Day Book"
                          >
                            <CheckCircle size={12} />
                            Release Loan
                          </button>
                        ) : (
                          <span className="px-2 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                            Released
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── EDIT BANK DETAILS MODAL ── */}
      {editingPledge && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-amber-200">
            <div style={{ height: 4, background: "linear-gradient(90deg,#c8960c,#D4AF37)" }} />

            <div className="px-6 py-5 flex items-center justify-between border-b border-amber-100 bg-amber-50/40">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 text-lg">
                  🏦
                </div>
                <div>
                  <h3 className="font-bold text-sm text-amber-950">
                    Edit Bank Deposit Details
                  </h3>
                  <p className="text-[10px] text-amber-800 font-mono">
                    Girvi No: {editingPledge.pledge_no} | Customer: {editingPledge.customer_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPledge(null)}
                className="w-8 h-8 rounded-full hover:bg-amber-100 flex items-center justify-center text-amber-800 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {editBankEntries.map((entry, i) => {
                const KNOWN_BANKS = ["Kosamattam Finance", "Muthoot Money", "Bank of Baroda", "SBI"];
                const isCustomBank = entry.bank !== "" && !KNOWN_BANKS.includes(entry.bank);
                return (
                  <div
                    key={i}
                    className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                        Bank Entry #{i + 1}
                      </span>
                      {editBankEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEditBankEntries(editBankEntries.filter((_, idx) => idx !== i))}
                          className="text-[10px] font-bold text-red-500 hover:text-red-700 transition-colors"
                        >
                          ✕ Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Name */}
                      <div>
                        <label className="block text-[9px] font-semibold text-amber-800 mb-1">
                          Pledger Name at Bank
                        </label>
                        <input
                          type="text"
                          value={entry.name}
                          onChange={(e) => {
                            const updated = [...editBankEntries];
                            updated[i].name = e.target.value;
                            setEditBankEntries(updated);
                          }}
                          placeholder="e.g. Vikram Chand"
                          className="w-full px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-bold outline-none focus:border-amber-500 bg-white"
                        />
                      </div>

                      {/* Bank Dropdown */}
                      <div>
                        <label className="block text-[9px] font-semibold text-amber-800 mb-1">
                          Bank / Finance Company
                        </label>
                        <select
                          value={isCustomBank ? "Other" : entry.bank}
                          onChange={(e) => {
                            const updated = [...editBankEntries];
                            updated[i].bank = e.target.value === "Other" ? "" : e.target.value;
                            setEditBankEntries(updated);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs font-black text-amber-950 outline-none focus:border-amber-500 bg-white"
                        >
                          <option value="">-- Select Bank --</option>
                          <option value="Kosamattam Finance">Kosamattam Finance</option>
                          <option value="Muthoot Money">Muthoot Money</option>
                          <option value="Bank of Baroda">Bank of Baroda</option>
                          <option value="SBI">SBI</option>
                          <option value="Other">Other (Write Name)</option>
                        </select>
                        {isCustomBank && (
                          <input
                            type="text"
                            placeholder="Bank name"
                            value={entry.bank}
                            onChange={(e) => {
                              const updated = [...editBankEntries];
                              updated[i].bank = e.target.value;
                              setEditBankEntries(updated);
                            }}
                            className="w-full mt-1.5 px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-bold outline-none focus:border-amber-500 bg-white"
                          />
                        )}
                      </div>

                      {/* Bank Loan No */}
                      <div>
                        <label className="block text-[9px] font-semibold text-amber-850 mb-1">
                          Bank Loan No. / Receipt No.
                        </label>
                        <input
                          type="text"
                          value={entry.loan_no || ""}
                          onChange={(e) => {
                            const updated = [...editBankEntries];
                            updated[i].loan_no = e.target.value;
                            setEditBankEntries(updated);
                          }}
                          placeholder="e.g. 15252 or LN-8840"
                          className="w-full px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-mono font-bold text-amber-900 outline-none focus:border-amber-500 bg-white"
                        />
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-[9px] font-semibold text-amber-800 mb-1">
                          Re-Pledge Date
                        </label>
                        <input
                          type="date"
                          value={entry.date}
                          onChange={(e) => {
                            const updated = [...editBankEntries];
                            updated[i].date = e.target.value;
                            setEditBankEntries(updated);
                          }}
                          className="w-full px-3 py-1.5 rounded-lg border border-amber-200 text-xs outline-none focus:border-amber-500 bg-white"
                        />
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-[9px] font-semibold text-amber-800 mb-1">
                          Bank Loan Amount (₹) *
                        </label>
                        <input
                          type="number"
                          value={entry.amount}
                          onChange={(e) => {
                            const updated = [...editBankEntries];
                            updated[i].amount = e.target.value;
                            setEditBankEntries(updated);
                          }}
                          placeholder="e.g. 8500"
                          className="w-full px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-mono font-black text-amber-900 outline-none focus:border-amber-500 bg-white"
                        />
                      </div>

                      {/* Interest Amount */}
                      <div>
                        <label className="block text-[9px] font-semibold text-purple-900 mb-1">
                          Bank Interest Amount (₹)
                        </label>
                        <input
                          type="number"
                          value={entry.interest_amount || ""}
                          onChange={(e) => {
                            const updated = [...editBankEntries];
                            updated[i].interest_amount = e.target.value;
                            setEditBankEntries(updated);
                          }}
                          placeholder="e.g. 1200"
                          className="w-full px-3 py-1.5 rounded-lg border border-purple-200 text-xs font-mono font-bold text-purple-950 outline-none focus:border-purple-500 bg-purple-50/40"
                        />
                      </div>

                      {/* Interest Rate / Terms */}
                      <div>
                        <label className="block text-[9px] font-semibold text-purple-900 mb-1">
                          Interest Rate / Terms
                        </label>
                        <input
                          type="text"
                          value={entry.interest_rate || ""}
                          onChange={(e) => {
                            const updated = [...editBankEntries];
                            updated[i].interest_rate = e.target.value;
                            setEditBankEntries(updated);
                          }}
                          placeholder="e.g. 12% p.a. or 1.5% / mo"
                          className="w-full px-3 py-1.5 rounded-lg border border-purple-200 text-xs font-bold text-purple-950 outline-none focus:border-purple-500 bg-purple-50/40"
                        />
                      </div>

                      {/* Linked Girvies */}
                      <div className="col-span-2">
                        <label className="block text-[9px] font-semibold text-amber-800 mb-1">
                          Other Girvi Nos. bundled in this loan
                          <span className="ml-1 font-normal text-amber-600">
                            (comma-separated, e.g. 1120, 1130)
                          </span>
                        </label>
                        <input
                          type="text"
                          value={entry.linked_girvies}
                          onChange={(e) => {
                            const updated = [...editBankEntries];
                            updated[i].linked_girvies = e.target.value;
                            setEditBankEntries(updated);
                          }}
                          placeholder="e.g. 1120, 1130"
                          className="w-full px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-bold outline-none focus:border-amber-500 bg-white"
                        />
                        {entry.linked_girvies && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.linked_girvies
                              .split(",")
                              .filter((s) => s.trim())
                              .map((no, ni) => (
                                <span
                                  key={ni}
                                  className="px-2 py-0.5 rounded-full bg-amber-900 text-white text-[9px] font-bold"
                                >
                                  #{no.trim()}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() =>
                  setEditBankEntries([
                    ...editBankEntries,
                    { name: "", bank: "", date: currentDate, amount: "", linked_girvies: "" },
                  ])
                }
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-amber-300 text-xs font-bold text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-all flex items-center justify-center gap-1.5"
              >
                <span className="text-sm leading-none">+</span> Add Another Bank / Finance Company
              </button>
            </div>

            <div className="px-6 py-4 border-t border-amber-100 bg-amber-50/50 flex gap-3">
              <button
                type="button"
                onClick={() => setEditingPledge(null)}
                className="flex-1 py-2.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBankDetails}
                disabled={editSaving}
                className="flex-1 py-2.5 rounded-xl text-xs font-black text-white transition-all flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg,#c8960c,#D4AF37)",
                  boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
                }}
              >
                {editSaving ? <RefreshCw size={13} className="animate-spin" /> : <Pencil size={13} />}
                {editSaving ? "Saving..." : "Save Bank Details"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── BUNDLED GIRVI FULL DETAILS MODAL ── */}
      {viewPledgeModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-amber-200">
            <div style={{ height: 4, background: "linear-gradient(90deg,#c8960c,#D4AF37)" }} />

            <div className="px-6 py-5 flex items-center justify-between border-b border-amber-100 bg-amber-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-900 text-amber-300 flex items-center justify-center text-sm font-mono font-black border border-amber-800 shadow-sm">
                  #{viewPledgeModal.pledge_no || viewPledgeModal.id}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-amber-950">
                    Girvi Details
                  </h3>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      viewPledgeModal.status === "RELEASED"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : "bg-amber-100 text-amber-900 border border-amber-200"
                    }`}
                  >
                    {viewPledgeModal.status || "ACTIVE"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewPledgeModal(null)}
                className="w-8 h-8 rounded-full hover:bg-amber-100 flex items-center justify-center text-amber-800 font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Customer Details */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-3.5 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  👤 Customer Information
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-amber-700 block">Name:</span>
                    <span className="font-bold text-amber-950 text-sm">{viewPledgeModal.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 block">Mobile:</span>
                    <span className="font-mono font-bold text-amber-950">{viewPledgeModal.mobile || "—"}</span>
                  </div>
                  {viewPledgeModal.address && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-amber-700 block">Address:</span>
                      <span className="font-medium text-amber-900">{viewPledgeModal.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Ornament Details */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-3.5 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  💍 Ornament Articles
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-amber-100">
                    <span className="font-bold text-amber-950">{viewPledgeModal.ornament}</span>
                    <span className="font-mono font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-[11px]">
                      {viewPledgeModal.net_weight || viewPledgeModal.weight} g
                    </span>
                  </div>
                  {viewPledgeModal.ornament_2 && (
                    <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-amber-100">
                      <span className="font-bold text-amber-950">{viewPledgeModal.ornament_2}</span>
                      <span className="font-mono font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-[11px]">
                        {viewPledgeModal.net_weight_2 || 0} g
                      </span>
                    </div>
                  )}
                  {viewPledgeModal.ornament_3 && (
                    <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-amber-100">
                      <span className="font-bold text-amber-950">{viewPledgeModal.ornament_3}</span>
                      <span className="font-mono font-black text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 text-[11px]">
                        {viewPledgeModal.net_weight_3 || 0} g
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Terms */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-3.5 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                  💰 Loan & Interest Details
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-amber-700 block">Pledge Amount:</span>
                    <span className="font-mono font-black text-amber-950 text-base">
                      ₹{(viewPledgeModal.amount || 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 block">Interest Rate:</span>
                    <span className="font-mono font-bold text-amber-900">
                      {viewPledgeModal.interest_percentage || 2}% per month
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-700 block">Pledge Date:</span>
                    <span className="font-mono text-amber-900">
                      {formatDateDMY(viewPledgeModal.date || viewPledgeModal.due_date)}
                    </span>
                  </div>
                  {viewPledgeModal.due_date && (
                    <div>
                      <span className="text-[10px] text-amber-700 block">Due Date:</span>
                      <span className="font-mono text-amber-900">{formatDateDMY(viewPledgeModal.due_date)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-amber-100 bg-amber-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setViewPledgeModal(null)}
                className="w-full py-2.5 rounded-xl font-black text-white text-xs transition-all shadow-sm"
                style={{ background: "linear-gradient(135deg,#c8960c,#D4AF37)" }}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD BANK INTEREST PAYMENT MODAL ── */}
      {showInterestModal && selectedRecordForInterest && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-purple-200">
            <div style={{ height: 4, background: "linear-gradient(90deg,#7c3aed,#a855f7)" }} />

            <div className="px-6 py-4 flex items-center justify-between border-b border-purple-100 bg-purple-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-800 font-bold">
                  💸
                </div>
                <div>
                  <h3 className="font-bold text-sm text-purple-950">
                    Pay Bank Interest
                  </h3>
                  <p className="text-[10px] text-purple-800 font-mono">
                    Loan #{selectedRecordForInterest.pledgeNos.join("/")} | {selectedRecordForInterest.bankName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowInterestModal(false)}
                className="w-8 h-8 rounded-full hover:bg-purple-100 flex items-center justify-center text-purple-800 transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddInterestSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-purple-900 mb-1">
                  Payment Date *
                </label>
                <input
                  type="date"
                  required
                  value={interestPayDate}
                  onChange={(e) => setInterestPayDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-purple-200 text-xs font-semibold outline-none focus:border-purple-500 bg-purple-50/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-900 mb-1">
                  Payment Method / Account Used *
                </label>
                <select
                  value={interestPayMode}
                  onChange={(e) => setInterestPayMode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 text-xs font-black text-purple-950 outline-none focus:border-purple-500 bg-purple-50/30"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="HDFC">🏦 HDFC Bank (..192)</option>
                  <option value="HDFC_OD">🏦 HDFC OD (..7442)</option>
                  <option value="UPI">📱 PhonePe / UPI</option>
                  <option value="OTHER">💳 Other Bank / Online</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-900 mb-1">
                  Interest Amount Paid (₹) *
                </label>
                <input
                  type="number"
                  required
                  step="any"
                  placeholder="e.g. 1250"
                  value={interestPayAmount}
                  onChange={(e) => setInterestPayAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-purple-200 text-sm font-mono font-black text-purple-950 outline-none focus:border-purple-500 bg-purple-50/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-900 mb-1">
                  Remarks / Month (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Aug 2026 Interest"
                  value={interestPayRemarks}
                  onChange={(e) => setInterestPayRemarks(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-purple-200 text-xs font-medium outline-none focus:border-purple-500 bg-white"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-[11px] text-purple-900 font-medium">
                ⚡ <b>Auto-Day Book Entry:</b> Submitting this will automatically post a <b>Debit Entry (Javak)</b> of ₹{parseFloat(interestPayAmount || "0").toLocaleString("en-IN")} ({interestPayMode === "HDFC" ? "HDFC Bank" : interestPayMode === "HDFC_OD" ? "HDFC OD" : interestPayMode === "UPI" ? "PhonePe/UPI" : "Cash"}) in the Day Book for {formatDateDMY(interestPayDate)}.
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInterestModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-gray-300 font-bold text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={interestSubmitting}
                  className="w-2/3 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2"
                >
                  {interestSubmitting ? <RefreshCw className="animate-spin" size={14} /> : "Save & Add to Day Book"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW INTEREST PAYMENT HISTORY LOG MODAL ── */}
      {showHistoryModal && selectedRecordForHistory && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-amber-200">
            <div style={{ height: 4, background: "linear-gradient(90deg,#c8960c,#D4AF37)" }} />

            <div className="px-6 py-4 flex items-center justify-between border-b border-amber-100 bg-amber-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-800 font-bold">
                  📜
                </div>
                <div>
                  <h3 className="font-bold text-sm text-amber-950">
                    Bank Interest Payment Log
                  </h3>
                  <p className="text-[10px] text-amber-800 font-mono">
                    Loan #{selectedRecordForHistory.bankLoanNo || selectedRecordForHistory.pledgeNos.join("/")} | {selectedRecordForHistory.bankName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full hover:bg-amber-100 flex items-center justify-center text-amber-800 transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="flex justify-between items-center bg-purple-50 p-3 rounded-xl border border-purple-200">
                <span className="text-xs font-bold text-purple-900">Total Interest Paid:</span>
                <span className="font-mono font-black text-purple-950 text-base">
                  ₹{selectedRecordForHistory.totalInterestPaid.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="space-y-2">
                {selectedRecordForHistory.interestPayments.map((pay, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-amber-100 bg-amber-50/40 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-mono text-xs font-bold text-amber-950">
                        🗓️ {formatDateDMY(pay.date)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                          {pay.payment_method === "HDFC" || pay.payment_method === "HDFC_192"
                            ? "🏦 HDFC Bank"
                            : pay.payment_method === "HDFC_OD"
                            ? "🏦 HDFC OD"
                            : pay.payment_method === "UPI"
                            ? "📱 PhonePe / UPI"
                            : pay.payment_method === "OTHER"
                            ? "💳 Other Bank"
                            : "💵 Cash"}
                        </span>
                      </div>
                      {pay.remarks && (
                        <div className="text-[10px] text-amber-700 mt-1 font-medium">
                          {pay.remarks}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="font-mono font-black text-purple-900 text-sm text-right">
                        ₹{pay.amount.toLocaleString("en-IN")}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteInterestPayment(idx)}
                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 flex items-center justify-center transition-colors border border-red-200"
                        title="Delete this interest payment"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-amber-100 bg-amber-50/50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2.5 rounded-xl font-bold text-amber-900 text-xs bg-amber-100 hover:bg-amber-200 transition-colors border border-amber-300"
              >
                Close History Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MANUAL RELEASE BANK LOAN MODAL ── */}
      {showReleaseBankModal && selectedRecordForRelease && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-emerald-200">
            <div style={{ height: 4, background: "linear-gradient(90deg,#059669,#10b981)" }} />

            <div className="px-6 py-4 flex items-center justify-between border-b border-emerald-100 bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold">
                  🏦
                </div>
                <div>
                  <h3 className="font-bold text-sm text-emerald-950">
                    Manual Bank Loan Release
                  </h3>
                  <p className="text-[10px] text-emerald-800 font-mono">
                    Loan #{selectedRecordForRelease.bankLoanNo || selectedRecordForRelease.pledgeNos.join("/")} | {selectedRecordForRelease.bankName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReleaseBankModal(false)}
                className="w-8 h-8 rounded-full hover:bg-emerald-100 flex items-center justify-center text-emerald-800 transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReleaseBankSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Bank Release Date *
                </label>
                <input
                  type="date"
                  required
                  value={releaseBankDate}
                  onChange={(e) => setReleaseBankDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-emerald-200 text-xs font-semibold outline-none focus:border-emerald-500 bg-emerald-50/30"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Payment Method / Account Used *
                </label>
                <select
                  value={releaseBankMode}
                  onChange={(e) => setReleaseBankMode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 text-xs font-black text-emerald-950 outline-none focus:border-emerald-500 bg-emerald-50/30"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="HDFC">🏦 HDFC Bank (..192)</option>
                  <option value="HDFC_OD">🏦 HDFC OD (..7442)</option>
                  <option value="UPI">📱 PhonePe / UPI</option>
                  <option value="OTHER">💳 Other Bank / Online</option>
                  <option value="SPLIT">🔀 Split Payment (Cash + Multiple Accounts)</option>
                </select>
              </div>

              {releaseBankMode === "SPLIT" && (
                <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3 text-xs">
                  <p className="font-bold text-amber-950 flex items-center gap-1.5 text-xs">
                    <span>🔀</span> Split Outflow Amounts by Account
                  </p>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 mb-1">
                        Cash Paid (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 6100"
                        value={releaseSplitCash}
                        onChange={(e) => setReleaseSplitCash(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 font-mono font-bold text-amber-950 bg-white outline-none focus:border-amber-500 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 mb-1">
                        Account 1 Amount (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 100000"
                        value={releaseSplitUpi}
                        onChange={(e) => setReleaseSplitUpi(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 font-mono font-bold text-amber-950 bg-white outline-none focus:border-amber-500 shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 mb-1">
                      Select Account 1 Used
                    </label>
                    <select
                      value={releaseSplitAccount}
                      onChange={(e) => setReleaseSplitAccount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-amber-300 font-bold text-amber-950 bg-white outline-none focus:border-amber-500 shadow-xs text-xs"
                    >
                      {UPI_ACCOUNTS.map((acc) => (
                        <option key={acc.key} value={acc.key}>
                          💳 {acc.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t border-amber-200/70 pt-2.5 grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 mb-1">
                        Account 2 Amount (₹) (Optional)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="e.g. 100000"
                        value={releaseSplitOther}
                        onChange={(e) => setReleaseSplitOther(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 font-mono font-bold text-amber-950 bg-white outline-none focus:border-amber-500 shadow-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 mb-1">
                        Select Account 2 Used
                      </label>
                      <select
                        value={releaseSplitAccount2}
                        onChange={(e) => setReleaseSplitAccount2(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-amber-300 font-bold text-amber-950 bg-white outline-none focus:border-amber-500 shadow-xs text-xs"
                      >
                        {UPI_ACCOUNTS.map((acc) => (
                          <option key={acc.key} value={acc.key}>
                            💳 {acc.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Bank Principal Paid Back (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    step="any"
                    placeholder="e.g. 198950"
                    value={releaseBankAmount}
                    onChange={(e) => setReleaseBankAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 text-sm font-mono font-black text-emerald-950 outline-none focus:border-emerald-500 bg-emerald-50/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Release Interest Paid (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 5000"
                    value={releaseBankInterest}
                    onChange={(e) => setReleaseBankInterest(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-200 text-sm font-mono font-black text-emerald-950 outline-none focus:border-emerald-500 bg-emerald-50/30"
                  />
                </div>
              </div>

              {(() => {
                const principal = parseFloat(releaseBankAmount) || 0;
                const interest = parseFloat(releaseBankInterest) || 0;
                const targetTotal = principal + interest;
                const isSplit = releaseBankMode === "SPLIT";

                if (isSplit) {
                  const sCash = parseFloat(releaseSplitCash) || 0;
                  const sUpi = parseFloat(releaseSplitUpi) || 0;
                  const sOther = parseFloat(releaseSplitOther) || 0;
                  const splitSum = sCash + sUpi + sOther;
                  const isMatch = Math.abs(splitSum - targetTotal) < 0.01 && targetTotal > 0;

                  return (
                    <div className={`p-3 rounded-xl border text-[11px] font-medium space-y-1 ${isMatch ? "bg-emerald-50 border-emerald-200 text-emerald-900" : "bg-amber-50 border-amber-300 text-amber-900"}`}>
                      <div>⚡ <b>Auto-Day Book Split Entries:</b> Releasing this loan will post separate <b>Debit Entries (Javak)</b> in the Day Book for each account:</div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {sCash > 0 && <span className="bg-white px-2 py-0.5 rounded-md border border-amber-200 font-mono font-bold text-[10px] text-amber-950">💵 Cash: ₹{sCash.toLocaleString("en-IN")}</span>}
                        {sUpi > 0 && <span className="bg-white px-2 py-0.5 rounded-md border border-amber-200 font-mono font-bold text-[10px] text-amber-950">💳 {UPI_ACCOUNTS.find(a => a.key === releaseSplitAccount)?.label || releaseSplitAccount}: ₹{sUpi.toLocaleString("en-IN")}</span>}
                        {sOther > 0 && <span className="bg-white px-2 py-0.5 rounded-md border border-amber-200 font-mono font-bold text-[10px] text-amber-950">💳 {UPI_ACCOUNTS.find(a => a.key === releaseSplitAccount2)?.label || releaseSplitAccount2}: ₹{sOther.toLocaleString("en-IN")}</span>}
                      </div>
                      <div className="pt-1 text-[10px] font-bold">
                        {isMatch ? (
                          <span className="text-emerald-700">✅ Split Total (₹{splitSum.toLocaleString("en-IN")}) matches required outflow (₹{targetTotal.toLocaleString("en-IN")})</span>
                        ) : (
                          <span className="text-amber-800">⚠️ Total Split: ₹{splitSum.toLocaleString("en-IN")} | Required Outflow: ₹{targetTotal.toLocaleString("en-IN")} (Diff: ₹{(targetTotal - splitSum).toLocaleString("en-IN")})</span>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-medium">
                    ⚡ <b>Auto-Day Book Entry:</b> Releasing this loan will mark the Bank Re-Pledge status as <b>RELEASED</b> and automatically post a <b>Debit Entry (Javak)</b> of <b>₹{targetTotal.toLocaleString("en-IN")}</b> {interest > 0 ? `(Principal ₹${principal.toLocaleString("en-IN")} + Interest ₹${interest.toLocaleString("en-IN")})` : ""} in the Day Book for {formatDateDMY(releaseBankDate)}.
                  </div>
                );
              })()}

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowReleaseBankModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-gray-300 font-bold text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releaseSubmitting}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2"
                >
                  {releaseSubmitting ? <RefreshCw className="animate-spin" size={14} /> : "Confirm Bank Release"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
