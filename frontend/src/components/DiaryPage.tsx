"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, Trash2, ArrowLeft, ArrowRight, Save, Download, 
  RotateCcw, Sparkles, AlertCircle, FileText, CheckCircle, Wifi, WifiOff, ArrowRightLeft 
} from "lucide-react";
import { 
  DayBook, Entry, SoldItem, PhonePeEntry, OldGoldEntry, 
  OldSilverEntry, PledgeEntry, ReleaseEntry, addSubEntry, 
  deleteSubEntry, saveDayBookCash, fetchOutstandingUdhar, OutstandingUdhar 
} from "../utils/api";
import MoneySwapModal from "./MoneySwapModal";

interface DiaryPageProps {
  daybook: DayBook;
  dateStr: string;
  onRefresh: () => void;
  isSynced: boolean;
  onEditOpening: () => void;
  onSelectPrintPledge?: (pledge: PledgeEntry) => void;
  onSelectPrintBill?: (item: SoldItem) => void;
  showNotification?: (msg: string, type: "success" | "info" | "error") => void;
}

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

const cleanCustomerName = (name: string) => {
  return name
    .replace(/\[CUST:[^\]]+\]/g, "")
    .replace(/\[EXCHANGE:[^\]]+\]/g, "")
    .trim();
};

const formatDisplayDate = (rawDateStr: string) => {
  if (!rawDateStr) return "";
  const parts = rawDateStr.split("T")[0].split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [yyyy, mm, dd] = parts;
    return `${dd}/${mm}/${yyyy}`;
  }
  return rawDateStr;
};

export default function DiaryPage({ daybook, dateStr, onRefresh, isSynced, onEditOpening, onSelectPrintPledge, onSelectPrintBill, showNotification }: DiaryPageProps) {
  const [showMoneySwapModal, setShowMoneySwapModal] = useState<boolean>(false);
  // Opening Cash/UPI/Other edit states
  const [openingCash, setOpeningCash] = useState<number>(daybook.opening_cash);
  const [openingUpi, setOpeningUpi] = useState<number>(daybook.opening_upi || 0);
  const [openingOther, setOpeningOther] = useState<number>(daybook.opening_other || 0);
  const [activeTabMobile, setActiveTabMobile] = useState<"front" | "back">("front");
  
  // Forms states
  const [debitForm, setDebitForm] = useState({ name: "", particulars: "", amount: "", remarks: "", method: "CASH", upiAccount: "hdfc_192", splitCash: "", splitUpi: "" });
  const [creditForm, setCreditForm] = useState({ name: "", particulars: "", amount: "", remarks: "", method: "CASH", upiAccount: "hdfc_192", splitCash: "", splitUpi: "" });
  const [soldForm, setSoldForm] = useState({ name: "", qty: "1", weight: "", metal: "GOLD", cashAmount: "", upiAmount: "", otherAmount: "", upiAccount: "hdfc_192" });
  const [upiForm, setUpiForm] = useState({ name: "", amount: "", upiAccount: "hdfc_192" });
  const [oldGoldForm, setOldGoldForm] = useState({ name: "", weight: "", amount: "" });
  const [oldSilverForm, setOldSilverForm] = useState({ name: "", weight: "", amount: "" });
  const [pledgeForm, setPledgeForm] = useState({ name: "", ornament: "", weight: "", amount: "", interest: "2", method: "CASH", upiAccount: "hdfc_192", splitCash: "", splitUpi: "" });
  const [releaseForm, setReleaseForm] = useState({ name: "", principal: "", interest: "", method: "CASH", upiAccount: "hdfc_192", splitCash: "", splitUpi: "" });

  const [savingStatus, setSavingStatus] = useState<"Saved" | "Saving..." | "Offline Safe">("Saved");

  const [outstandingUdharList, setOutstandingUdharList] = useState<OutstandingUdhar[]>([]);
  const [creditSuggestions, setCreditSuggestions] = useState<OutstandingUdhar[]>([]);
  const [showCreditSuggest, setShowCreditSuggest] = useState(false);
  const [activeCreditSuggestIdx, setActiveCreditSuggestIdx] = useState(-1);

  const [debitSuggestions, setDebitSuggestions] = useState<OutstandingUdhar[]>([]);
  const [showDebitSuggest, setShowDebitSuggest] = useState(false);
  const [activeDebitSuggestIdx, setActiveDebitSuggestIdx] = useState(-1);

  const creditSuggestRef = useRef<HTMLDivElement>(null);
  const debitSuggestRef = useRef<HTMLDivElement>(null);
  const creditAmountInputRef = useRef<HTMLInputElement>(null);
  const debitAmountInputRef = useRef<HTMLInputElement>(null);
  const [isUdharWidgetExpanded, setIsUdharWidgetExpanded] = useState(true);

  // Fetch outstanding udhar list
  useEffect(() => {
    const loadOutstandingUdhar = async () => {
      try {
        const list = await fetchOutstandingUdhar();
        setOutstandingUdharList(list);
      } catch (e: any) {
        console.warn("loadOutstandingUdhar failed:", e.message || e);
      }
    };
    loadOutstandingUdhar();
  }, [daybook]);

  // Click outside to dismiss suggestions dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (creditSuggestRef.current && !creditSuggestRef.current.contains(event.target as Node)) {
        setShowCreditSuggest(false);
      }
      if (debitSuggestRef.current && !debitSuggestRef.current.contains(event.target as Node)) {
        setShowDebitSuggest(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync state whenever daybook loads
  useEffect(() => {
    setOpeningCash(daybook.opening_cash);
    setOpeningUpi(daybook.opening_upi || 0);
    setOpeningOther(daybook.opening_other || 0);
  }, [daybook.opening_cash, daybook.opening_upi, daybook.opening_other, daybook.id, dateStr]);

  // Helper to parse split payment from Sold Item name (supports Cash, UPI, and Other)
  const parseSoldSplit = (name: string, totalAmount: number) => {
    const match = name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?\]/);
    if (match) {
      return {
        cash: parseFloat(match[1]) || 0,
        upi: parseFloat(match[2]) || 0,
        other: parseFloat(match[3]) || 0
      };
    }
    return { cash: totalAmount, upi: 0, other: 0 };
  };

  // Backside Sub-totals to merge into Frontside Ledger
  const soldTotalAmount = daybook.sold_items.reduce((sum, item) => sum + item.amount, 0);
  
  const getGroupedSoldItems = (items: SoldItem[]) => {
    const seen = new Set<string>();
    return items.filter(i => {
      const match = i.item_name.match(/\[BILL:([^\]]+)\]/);
      if (match) {
        const billId = match[1];
        if (seen.has(billId)) return false;
        seen.add(billId);
      }
      return true;
    });
  };

  const groupedSoldItems = getGroupedSoldItems(daybook.sold_items || []);

  const soldCashTotal = groupedSoldItems.reduce((sum, item) => {
    return sum + parseSoldSplit(item.item_name, item.amount).cash;
  }, 0);

  const soldUpiTotal = groupedSoldItems.reduce((sum, item) => {
    return sum + parseSoldSplit(item.item_name, item.amount).upi;
  }, 0);

  const soldOtherTotal = groupedSoldItems.reduce((sum, item) => {
    return sum + parseSoldSplit(item.item_name, item.amount).other;
  }, 0);

  const pledgeTotalAmount = daybook.pledge_entries.reduce((sum, item) => {
    const totalTopUps = (item.payments || []).filter(p => p.payment_type === "TOP_UP").reduce((s, p) => s + p.amount, 0);
    return sum + (item.amount - totalTopUps);
  }, 0);
  const releaseTotalAmount = daybook.release_entries.reduce((sum, item) => sum + item.principal_amount, 0);
  const releaseInterestTotal = daybook.release_entries.reduce((sum, item) => sum + item.interest_received, 0);
  const girviInterestTotal = releaseInterestTotal;

  const pledgeCashTotal = daybook.pledge_entries.reduce((sum, item) => {
    const totalTopUps = (item.payments || []).filter(p => p.payment_type === "TOP_UP").reduce((s, p) => s + p.amount, 0);
    const initialAmount = item.amount - totalTopUps;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[1]) || 0);
    if (!item.customer_name.startsWith("[UPI") && !item.customer_name.startsWith("[OTHER]")) return sum + initialAmount;
    return sum;
  }, 0);

  const pledgeUpiTotal = daybook.pledge_entries.reduce((sum, item) => {
    const totalTopUps = (item.payments || []).filter(p => p.payment_type === "TOP_UP").reduce((s, p) => s + p.amount, 0);
    const initialAmount = item.amount - totalTopUps;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[2]) || 0);
    if (item.customer_name.startsWith("[UPI")) return sum + initialAmount;
    return sum;
  }, 0);

  const pledgeOtherTotal = daybook.pledge_entries.reduce((sum, item) => {
    const totalTopUps = (item.payments || []).filter(p => p.payment_type === "TOP_UP").reduce((s, p) => s + p.amount, 0);
    const initialAmount = item.amount - totalTopUps;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[3]) || 0);
    if (item.customer_name.startsWith("[OTHER]")) return sum + initialAmount;
    return sum;
  }, 0);

  const releaseCashTotal = daybook.release_entries.reduce((sum, item) => {
    const total = item.principal_amount + item.interest_received;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[1]) || 0);
    if (!item.customer_name.startsWith("[UPI") && !item.customer_name.startsWith("[OTHER]")) return sum + total;
    return sum;
  }, 0);

  const releaseUpiTotal = daybook.release_entries.reduce((sum, item) => {
    const total = item.principal_amount + item.interest_received;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[2]) || 0);
    if (item.customer_name.startsWith("[UPI")) return sum + total;
    return sum;
  }, 0);

  const releaseOtherTotal = daybook.release_entries.reduce((sum, item) => {
    const total = item.principal_amount + item.interest_received;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[3]) || 0);
    if (item.customer_name.startsWith("[OTHER]")) return sum + total;
    return sum;
  }, 0);

  const releasePrincipalCashTotal = daybook.release_entries.reduce((sum, item) => {
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) {
      const c = parseFloat(match[1]) || 0;
      return sum + Math.min(item.principal_amount, c);
    }
    if (!item.customer_name.startsWith("[UPI") && !item.customer_name.startsWith("[OTHER]")) {
      return sum + item.principal_amount;
    }
    return sum;
  }, 0);

  const releasePrincipalUpiTotal = daybook.release_entries.reduce((sum, item) => {
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) {
      const c = parseFloat(match[1]) || 0;
      const u = parseFloat(match[2]) || 0;
      if (c >= item.principal_amount) return sum;
      return sum + Math.min(item.principal_amount - c, u);
    }
    if (item.customer_name.startsWith("[UPI")) {
      return sum + item.principal_amount;
    }
    return sum;
  }, 0);

  const releaseInterestCashTotal = daybook.release_entries.reduce((sum, item) => {
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) {
      const c = parseFloat(match[1]) || 0;
      if (c > item.principal_amount) {
        return sum + Math.min(item.interest_received, c - item.principal_amount);
      }
      return sum;
    }
    if (!item.customer_name.startsWith("[UPI") && !item.customer_name.startsWith("[OTHER]")) {
      return sum + item.interest_received;
    }
    return sum;
  }, 0);

  const releaseInterestUpiTotal = daybook.release_entries.reduce((sum, item) => {
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) {
      const c = parseFloat(match[1]) || 0;
      const u = parseFloat(match[2]) || 0;
      const remCash = Math.max(0, c - item.principal_amount);
      if (remCash >= item.interest_received) return sum;
      return sum + Math.min(item.interest_received - remCash, u);
    }
    if (item.customer_name.startsWith("[UPI")) {
      return sum + item.interest_received;
    }
    return sum;
  }, 0);

  // Filter out auto-posted Girvi/Banda/Chhudai entries from ledger views & totals to avoid double counting
  const filteredDebitEntries = daybook.debit_entries.filter(item => {
    const nameLower = item.name.toLowerCase();
    const partLower = item.particulars.toLowerCase();
    return !nameLower.includes("girvi no.") && !partLower.includes("girvi pledge");
  });

  const filteredCreditEntries = daybook.credit_entries.filter(item => {
    const nameLower = item.name.toLowerCase();
    const partLower = item.particulars.toLowerCase();
    return !nameLower.includes("chhudai no.") && 
           !nameLower.includes("banda no.") && 
           !partLower.includes("girvi release") &&
           !partLower.includes("girvi banda");
  });

  // Calculate Banda (Upfront interest) totals separately
  const bandaEntries = daybook.credit_entries.filter(item => {
    const nameLower = item.name.toLowerCase();
    const partLower = item.particulars.toLowerCase();
    return nameLower.includes("banda no.") || partLower.includes("girvi banda");
  });

  const bandaTotalAmount = bandaEntries.reduce((sum, item) => sum + item.amount, 0);
  
  const bandaCashTotal = bandaEntries
    .filter(item => !item.particulars.startsWith("[UPI") && !item.particulars.startsWith("[OTHER]"))
    .reduce((sum, item) => sum + item.amount, 0);

  const bandaUpiTotal = bandaEntries
    .filter(item => item.particulars.startsWith("[UPI"))
    .reduce((sum, item) => sum + item.amount, 0);

  const bandaOtherTotal = bandaEntries
    .filter(item => item.particulars.startsWith("[OTHER]"))
    .reduce((sum, item) => sum + item.amount, 0);

  const debitTotal = filteredDebitEntries.reduce((sum, item) => sum + item.amount, 0) + pledgeTotalAmount;
  const creditTotal = filteredCreditEntries.reduce((sum, item) => sum + item.amount, 0) + soldTotalAmount + releaseTotalAmount + girviInterestTotal + bandaTotalAmount;
  
  // Helper for parsing payment method tags & indicators in particulars/remarks/name
  const parseSplitTag = (particulars: string = "", remarks: string = "", name: string = "", defaultAmount: number = 0) => {
    const combined = `${particulars} ${remarks} ${name}`;

    const splitMatch = combined.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A([^\]]+))?\]/i);
    if (splitMatch) {
      const c = parseFloat(splitMatch[1]) || 0;
      const u = parseFloat(splitMatch[2]) || 0;
      const o = parseFloat(splitMatch[3]) || 0;
      const acc = splitMatch[4] || "hdfc_192";
      return { cash: c, upi: u, other: o, acc };
    }

    if (
      combined.startsWith("[UPI") ||
      /\[UPI(?::[^\]]+)?\]/i.test(combined) ||
      /Payment Method:\s*(HDFC|HDFC_192|HDFC_OD|UPI)/i.test(combined) ||
      /\((HDFC Bank|HDFC OD|PhonePe|UPI)\)/i.test(combined)
    ) {
      let acc = "hdfc_192";
      const accMatch = combined.match(/\[UPI:([^\]]+)\]/i);
      if (accMatch) {
        acc = accMatch[1].trim().toLowerCase();
      } else if (combined.includes("HDFC_OD") || combined.includes("HDFC OD")) {
        acc = "hdfc_od_7442";
      }
      return { cash: 0, upi: defaultAmount, other: 0, acc };
    }

    if (combined.startsWith("[OTHER]") || /Payment Method:\s*OTHER/i.test(combined)) {
      return { cash: 0, upi: 0, other: defaultAmount, acc: "hdfc_192" };
    }

    return { cash: defaultAmount, upi: 0, other: 0, acc: "hdfc_192" };
  };

  // Method-wise splits
  const upiTotal = daybook.phonepe_entries.reduce((sum, item) => sum + item.amount, 0);

  let debitCash = 0;
  let debitUPI = 0;
  let debitOther = 0;
  filteredDebitEntries.forEach(item => {
    const parsed = parseSplitTag(item.particulars, item.remarks || "", item.name, item.amount);
    debitCash += parsed.cash;
    debitUPI += parsed.upi;
    debitOther += parsed.other;
  });

  let creditCash = 0;
  let creditUPI = 0;
  let creditOther = 0;
  filteredCreditEntries.forEach(item => {
    const parsed = parseSplitTag(item.particulars, item.remarks || "", item.name, item.amount);
    creditCash += parsed.cash;
    creditUPI += parsed.upi;
    creditOther += parsed.other;
  });

  // Totals calculations
  const totalUPIReceived = upiTotal + creditUPI + releaseUpiTotal + bandaUpiTotal;
  const totalUPIGiven = debitUPI + pledgeUpiTotal;

  const totalOtherReceived = creditOther + soldOtherTotal + releaseOtherTotal + bandaOtherTotal;
  const totalOtherGiven = debitOther + pledgeOtherTotal;

  const cashReceived = Math.max(0, creditCash + soldCashTotal + releaseCashTotal + bandaCashTotal);
  const cashGiven = debitCash + pledgeCashTotal;

  // Closing balances
  const closingCash = openingCash + cashReceived - cashGiven;
  const closingUpi = openingUpi + totalUPIReceived - totalUPIGiven;
  const closingOther = openingOther + totalOtherReceived - totalOtherGiven;
  const totalClosingBalance = closingCash + closingUpi + closingOther;

  // ── Auto-save: debounced (500ms) ONLY when opening balance is manually edited ──
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSavingStatus("Saving...");
      const ok = await saveDayBookCash(
        daybook.id, 
        dateStr, 
        openingCash, 
        openingUpi,
        openingOther,
        closingCash,
        closingUpi,
        closingOther
      );
      setSavingStatus(ok ? (isSynced ? "Saved" : "Offline Safe") : "Offline Safe");
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [openingCash, openingUpi, openingOther]);


  // Sold Items weight totals (Check prefix [GOLD] or [SILVER] inside item_name)
  const goldSoldWeight = daybook.sold_items
    .filter(item => item.item_name.startsWith("[GOLD]"))
    .reduce((sum, item) => sum + item.weight, 0);

  const silverSoldWeight = daybook.sold_items
    .filter(item => item.item_name.startsWith("[SILVER]"))
    .reduce((sum, item) => sum + item.weight, 0);

  // UPI totals
  const oldGoldWeight = daybook.old_gold_entries.reduce((sum, item) => sum + item.weight, 0);
  const oldGoldAmount = daybook.old_gold_entries.reduce((sum, item) => sum + item.amount, 0);
  const oldSilverWeight = daybook.old_silver_entries.reduce((sum, item) => sum + item.weight, 0);
  const oldSilverAmount = daybook.old_silver_entries.reduce((sum, item) => sum + item.amount, 0);
  
  const pledgeTotal = daybook.pledge_entries.reduce((sum, item) => {
    const totalTopUps = (item.payments || []).filter(p => p.payment_type === "TOP_UP").reduce((s, p) => s + p.amount, 0);
    return sum + (item.amount - totalTopUps);
  }, 0);
  const releaseTotal = daybook.release_entries.reduce((sum, item) => sum + item.principal_amount, 0);
  const interestEarned = daybook.release_entries.reduce((sum, item) => sum + item.interest_received, 0);

  // Autocomplete and autofill helpers for Udhar
  const handleCreditNameChange = (val: string) => {
    setCreditForm(prev => ({ ...prev, name: val }));
    if (val.trim() === "") {
      setCreditSuggestions([]);
      setShowCreditSuggest(false);
      setActiveCreditSuggestIdx(-1);
    } else {
      const matches = outstandingUdharList.filter(item =>
        item.name.toLowerCase().includes(val.toLowerCase())
      );
      setCreditSuggestions(matches);
      setShowCreditSuggest(matches.length > 0);
      setActiveCreditSuggestIdx(-1);
    }
  };

  const handleDebitNameChange = (val: string) => {
    setDebitForm(prev => ({ ...prev, name: val }));
    if (val.trim() === "") {
      setDebitSuggestions([]);
      setShowDebitSuggest(false);
      setActiveDebitSuggestIdx(-1);
    } else {
      const matches = outstandingUdharList.filter(item =>
        item.name.toLowerCase().includes(val.toLowerCase())
      );
      setDebitSuggestions(matches);
      setShowDebitSuggest(matches.length > 0);
      setActiveDebitSuggestIdx(-1);
    }
  };

  const handleSelectCreditSuggest = (item: OutstandingUdhar) => {
    setCreditForm(prev => ({
      ...prev,
      name: item.name,
      particulars: "Udhar Return",
      amount: item.amount.toString(),
      remarks: "Repayment of outstanding udhar"
    }));
    setShowCreditSuggest(false);
    setCreditSuggestions([]);
    setActiveCreditSuggestIdx(-1);
  };

  const handleSelectDebitSuggest = (item: OutstandingUdhar) => {
    setDebitForm(prev => ({
      ...prev,
      name: item.name,
      particulars: "Udhar",
      amount: "", // Keep empty for user to enter new amount
      remarks: "Additional udhar given"
    }));
    setShowDebitSuggest(false);
    setDebitSuggestions([]);
    setActiveDebitSuggestIdx(-1);
  };

  const handleCreditNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showCreditSuggest || creditSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveCreditSuggestIdx(prev => 
        prev < creditSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveCreditSuggestIdx(prev => 
        prev > 0 ? prev - 1 : creditSuggestions.length - 1
      );
    } else if (e.key === "Enter") {
      if (activeCreditSuggestIdx >= 0 && activeCreditSuggestIdx < creditSuggestions.length) {
        e.preventDefault();
        handleSelectCreditSuggest(creditSuggestions[activeCreditSuggestIdx]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowCreditSuggest(false);
      setActiveCreditSuggestIdx(-1);
    }
  };

  const handleDebitNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDebitSuggest || debitSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveDebitSuggestIdx(prev => 
        prev < debitSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveDebitSuggestIdx(prev => 
        prev > 0 ? prev - 1 : debitSuggestions.length - 1
      );
    } else if (e.key === "Enter") {
      if (activeDebitSuggestIdx >= 0 && activeDebitSuggestIdx < debitSuggestions.length) {
        e.preventDefault();
        handleSelectDebitSuggest(debitSuggestions[activeDebitSuggestIdx]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowDebitSuggest(false);
      setActiveDebitSuggestIdx(-1);
    }
  };

  const handleCreditNameFocus = () => {
    if (creditForm.name.trim() !== "") {
      const matches = outstandingUdharList.filter(item =>
        item.name.toLowerCase().includes(creditForm.name.toLowerCase())
      );
      setCreditSuggestions(matches);
      setShowCreditSuggest(matches.length > 0);
    }
  };

  const handleDebitNameFocus = () => {
    if (debitForm.name.trim() !== "") {
      const matches = outstandingUdharList.filter(item =>
        item.name.toLowerCase().includes(debitForm.name.toLowerCase())
      );
      setDebitSuggestions(matches);
      setShowDebitSuggest(matches.length > 0);
    }
  };

  // Form submit handlers
  const handleAddDebit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entryName = debitForm.name.trim() || debitForm.particulars.trim() || "Debit Entry";
    setSavingStatus("Saving...");
    const isSplit = debitForm.method === "SPLIT";
    const isUpi = debitForm.method === "UPI";
    const isOther = debitForm.method === "OTHER";
    
    const cashAmt = parseFloat(debitForm.splitCash || "0");
    const upiAmt = parseFloat(debitForm.splitUpi || "0");
    const totalAmt = isSplit ? (cashAmt + upiAmt) : parseFloat(debitForm.amount || "0");

    if (totalAmt <= 0) {
      setSavingStatus(isSynced ? "Saved" : "Offline Safe");
      return;
    }

    const prefix = isSplit
      ? `[SPLIT:C${cashAmt}:U${upiAmt}:A${debitForm.upiAccount}] `
      : isUpi
      ? `[UPI:${debitForm.upiAccount}] `
      : isOther
      ? "[OTHER] "
      : "";

    const defaultPart = debitForm.particulars || (
      isSplit ? "Split Payment" :
      debitForm.method === "CASH" ? "Cash" :
      isUpi ? (UPI_ACCOUNTS.find(acc => acc.key === debitForm.upiAccount)?.label || "UPI") :
      "Other"
    );

    await addSubEntry(daybook.id, dateStr, "debit", {
      name: entryName,
      particulars: prefix + defaultPart,
      amount: totalAmt,
      remarks: debitForm.remarks || ""
    });
    setDebitForm({ name: "", particulars: "", amount: "", remarks: "", method: "CASH", upiAccount: "hdfc_192", splitCash: "", splitUpi: "" });
    setSavingStatus(isSynced ? "Saved" : "Offline Safe");
    onRefresh();
  };

  const handleAddCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entryName = creditForm.name.trim() || creditForm.particulars.trim() || "Credit Entry";
    setSavingStatus("Saving...");
    const isSplit = creditForm.method === "SPLIT";
    const isUpi = creditForm.method === "UPI";
    const isOther = creditForm.method === "OTHER";

    const cashAmt = parseFloat(creditForm.splitCash || "0");
    const upiAmt = parseFloat(creditForm.splitUpi || "0");
    const totalAmt = isSplit ? (cashAmt + upiAmt) : parseFloat(creditForm.amount || "0");

    if (totalAmt <= 0) {
      setSavingStatus(isSynced ? "Saved" : "Offline Safe");
      return;
    }

    const prefix = isSplit
      ? `[SPLIT:C${cashAmt}:U${upiAmt}:A${creditForm.upiAccount}] `
      : isUpi
      ? `[UPI:${creditForm.upiAccount}] `
      : isOther
      ? "[OTHER] "
      : "";

    const defaultPart = creditForm.particulars || (
      isSplit ? "Split Payment" :
      creditForm.method === "CASH" ? "Cash" :
      isUpi ? (UPI_ACCOUNTS.find(acc => acc.key === creditForm.upiAccount)?.label || "UPI") :
      "Other"
    );

    await addSubEntry(daybook.id, dateStr, "credit", {
      name: entryName,
      particulars: prefix + defaultPart,
      amount: totalAmt,
      remarks: creditForm.remarks || ""
    });
    setCreditForm({ name: "", particulars: "", amount: "", remarks: "", method: "CASH", upiAccount: "hdfc_192", splitCash: "", splitUpi: "" });
    setSavingStatus(isSynced ? "Saved" : "Offline Safe");
    onRefresh();
  };

  const handleAddSold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!soldForm.name || !soldForm.weight) return;
    setSavingStatus("Saving...");
    const cashAmt = parseFloat(soldForm.cashAmount || "0");
    const upiAmt = parseFloat(soldForm.upiAmount || "0");
    const otherAmt = parseFloat(soldForm.otherAmount || "0");
    const totalAmt = cashAmt + upiAmt + otherAmt;
    await addSubEntry(daybook.id, dateStr, "sold-item", {
      item_name: `[${soldForm.metal}][TYPE:ESTIMATE][SPLIT:C${cashAmt}:U${upiAmt}:O${otherAmt}] ${soldForm.name}`,
      quantity: parseInt(soldForm.qty),
      weight: parseFloat(soldForm.weight),
      amount: totalAmt
    });
    if (upiAmt > 0) {
      await addSubEntry(daybook.id, dateStr, "phonepe", {
        customer_name: `[UPI:${soldForm.upiAccount}] ${soldForm.name} (Sale)`,
        amount: upiAmt
      });
    }
    setSoldForm({ name: "", qty: "1", weight: "", metal: "GOLD", cashAmount: "", upiAmount: "", otherAmount: "", upiAccount: "hdfc_192" });
    setSavingStatus(isSynced ? "Saved" : "Offline Safe");
    onRefresh();
  };

  const handleAddUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!upiForm.name || !upiForm.amount) return;
    setSavingStatus("Saving...");
    await addSubEntry(daybook.id, dateStr, "phonepe", {
      customer_name: `[UPI:${upiForm.upiAccount}] ${upiForm.name}`,
      amount: parseFloat(upiForm.amount)
    });
    setUpiForm({ name: "", amount: "", upiAccount: "hdfc_192" });
    setSavingStatus(isSynced ? "Saved" : "Offline Safe");
    onRefresh();
  };

  const handleAddOldGold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldGoldForm.name || !oldGoldForm.amount) return;
    setSavingStatus("Saving...");
    await addSubEntry(daybook.id, dateStr, "old-gold", {
      customer_name: oldGoldForm.name,
      weight: parseFloat(oldGoldForm.weight || "0"),
      amount: parseFloat(oldGoldForm.amount)
    });
    setOldGoldForm({ name: "", weight: "", amount: "" });
    setSavingStatus(isSynced ? "Saved" : "Offline Safe");
    onRefresh();
  };

  const handleAddOldSilver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldSilverForm.name || !oldSilverForm.amount) return;
    setSavingStatus("Saving...");
    await addSubEntry(daybook.id, dateStr, "old-silver", {
      customer_name: oldSilverForm.name,
      weight: parseFloat(oldSilverForm.weight || "0"),
      amount: parseFloat(oldSilverForm.amount)
    });
    setOldSilverForm({ name: "", weight: "", amount: "" });
    setSavingStatus(isSynced ? "Saved" : "Offline Safe");
    onRefresh();
  };

  const handleAddPledge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pledgeForm.name) return;
    setSavingStatus("Saving...");
    const isSplit = pledgeForm.method === "SPLIT";
    const isUpi = pledgeForm.method === "UPI";
    const isOther = pledgeForm.method === "OTHER";

    const cashAmt = parseFloat(pledgeForm.splitCash || "0");
    const upiAmt = parseFloat(pledgeForm.splitUpi || "0");
    const totalAmt = isSplit ? (cashAmt + upiAmt) : parseFloat(pledgeForm.amount || "0");

    if (totalAmt <= 0) return;

    const prefix = isSplit
      ? `[SPLIT:C${cashAmt}:U${upiAmt}:A${pledgeForm.upiAccount}] `
      : isUpi
      ? `[UPI:${pledgeForm.upiAccount}] `
      : isOther
      ? "[OTHER] "
      : "";

    await addSubEntry(daybook.id, dateStr, "pledge", {
      customer_name: prefix + pledgeForm.name,
      pledge_no: pledgeForm.name,
      ornament: "Gold",
      weight: 0.0,
      amount: totalAmt,
      interest_percentage: parseFloat(pledgeForm.interest || "0")
    });
    setPledgeForm({ name: "", ornament: "", weight: "", amount: "", interest: "2", method: "CASH", upiAccount: "hdfc_192", splitCash: "", splitUpi: "" });
    setSavingStatus(isSynced ? "Saved" : "Offline Safe");
    onRefresh();
  };

  const handleAddRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseForm.name || !releaseForm.principal) return;
    setSavingStatus("Saving...");
    const isSplit = releaseForm.method === "SPLIT";
    const isUpi = releaseForm.method === "UPI";
    const isOther = releaseForm.method === "OTHER";

    const cashAmt = parseFloat(releaseForm.splitCash || "0");
    const upiAmt = parseFloat(releaseForm.splitUpi || "0");
    const principalAmt = parseFloat(releaseForm.principal || "0");
    const interestAmt = parseFloat(releaseForm.interest || "0");

    const prefix = isSplit
      ? `[SPLIT:C${cashAmt}:U${upiAmt}:A${releaseForm.upiAccount}] `
      : isUpi
      ? `[UPI:${releaseForm.upiAccount}] `
      : isOther
      ? "[OTHER] "
      : "";

    await addSubEntry(daybook.id, dateStr, "release", {
      customer_name: prefix + releaseForm.name,
      principal_amount: principalAmt,
      interest_received: interestAmt
    });
    setReleaseForm({ name: "", principal: "", interest: "", method: "CASH", upiAccount: "hdfc_192", splitCash: "", splitUpi: "" });
    setSavingStatus(isSynced ? "Saved" : "Offline Safe");
    onRefresh();
  };

  // Dual-Post Handlers (Posting back-side actions to Front-Side Debit/Credit ledger)
  const handleSoldAndPost = async () => {
    // With automatic split logic, the Sold split is automatically calculated in the Received totals,
    // so we just call standard add to avoid duplicate manual ledger posts!
    await handleAddSold({ preventDefault: () => {} } as any);
  };



  const handleDelete = async (section: string, itemId: number) => {
    if (confirm("Are you sure you want to delete this entry?")) {
      setSavingStatus("Saving...");
      await deleteSubEntry(dateStr, section, itemId);
      setSavingStatus(isSynced ? "Saved" : "Offline Safe");
      onRefresh();
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  const cleanItemName = (name: string) => {
    return name
      .replace(/^\[(GOLD|SILVER)\]\s*/i, "")
      .replace(/\[SPLIT:[^\]]+\]\s*/i, "")
      .replace(/\[CUST:[^\]]+\]\s*/i, "")
      .replace(/\[PRICE:[^\]]+\]\s*/i, "")
      .replace(/\[BARCODE:[^\]]+\]\s*/i, "")
      .trim();
  };

  const cleanParticulars = (val: string) => {
    const cleaned = val.replace(/^\[SPLIT:[^\]]+\]\s*/i, "").replace(/^\[(UPI|OTHER)(:[^\]]+)?\]\s*/i, "");
    if (cleaned === "Cash") {
      if (val.startsWith("[UPI")) {
        const match = val.match(/^\[UPI:([^\]]+)\]/);
        if (match) {
          const accKey = match[1];
          const acc = UPI_ACCOUNTS.find(a => a.key === accKey);
          return acc ? acc.label : "UPI";
        }
        return "UPI";
      }
      if (val.startsWith("[OTHER]")) {
        return "Other";
      }
    }
    return cleaned;
  };

  const cleanCustomerName = (val: string) => {
    return val.replace(/^\[SPLIT:[^\]]+\]\s*/i, "").replace(/^\[(UPI|OTHER)(:[^\]]+)?\]\s*/i, "");
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 md:px-4 py-2">
      {/* Sync and Save Status Info bar */}
      <div className="flex justify-between items-center bg-diary-cream border border-diary-grid rounded-lg p-2 mb-4 text-xs font-medium text-amber-900 shadow-sm print:hidden">
        <div className="flex items-center gap-1.5">
          {isSynced ? (
            <span className="flex items-center text-emerald-700 gap-1"><Wifi size={14}/> Cloud Connected</span>
          ) : (
            <span className="flex items-center text-amber-700 gap-1"><WifiOff size={14}/> Local Storage Only</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
            savingStatus === "Saved" ? "bg-emerald-100 text-emerald-800" :
            savingStatus === "Saving..." ? "bg-amber-100 text-amber-800 animate-pulse" :
            "bg-blue-100 text-blue-800"
          }`}>
            {savingStatus}
          </span>
        </div>
      </div>

      {/* Tabs for mobile layout */}
      <div className="flex md:hidden bg-diary-cream border border-diary-grid rounded-lg p-1 mb-4 print:hidden">
        <button 
          onClick={() => setActiveTabMobile("front")}
          className={`flex-1 py-2 text-center rounded-md font-semibold text-sm transition-all ${
            activeTabMobile === "front" 
              ? "bg-diary-red text-white shadow-sm" 
              : "text-amber-900/70 hover:text-amber-900"
          }`}
        >
          Aavak / Javak Ledger
        </button>
        <button 
          onClick={() => setActiveTabMobile("back")}
          className={`flex-1 py-2 text-center rounded-md font-semibold text-sm transition-all ${
            activeTabMobile === "back" 
              ? "bg-diary-red text-white shadow-sm" 
              : "text-amber-900/70 hover:text-amber-900"
          }`}
        >
          6 Sections
        </button>
      </div>

      {/* Main booklet diary layout */}
      <div id="daybook-print-area" className="ledger-page rounded-xl p-4 md:p-6 border-2 border-amber-900/10 print:w-full print:border-diary-red/30 print:shadow-none print:bg-diary-cream">
        
        {/* Document Header with Shop Name & Date (Prominently displayed on PDF & Screen) */}
        <div className="flex justify-between items-center border-b-2 border-amber-900/20 pb-3 mb-4 font-serif">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-amber-950 tracking-wide uppercase">
              POOJA JEWELLERS
            </h1>
            <p className="text-xs font-bold text-amber-900/70 tracking-widest uppercase">
              DAILY ROZAMEL / DAY BOOK STATEMENT
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block bg-amber-900/10 border border-amber-900/20 px-3.5 py-1.5 rounded-lg shadow-xs">
              <p className="text-[10px] font-sans font-bold uppercase text-amber-900/70 tracking-wider mb-0.5">
                📅 DATE / तारीख
              </p>
              <p className="text-base font-mono font-black text-diary-crimson">
                {formatDisplayDate(dateStr || daybook.date)}
              </p>
            </div>
          </div>
        </div>

        {/* Split grid for columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-start print:block print:w-full">
          
          {/* LEFT COLUMN - FRONT SIDE (DEBIT & CREDIT LEDGER) */}
          <div className={`relative print:block print:w-full ${
            activeTabMobile === "front" ? "block" : "hidden md:block"
          }`}>
            
            {/* Split Opening Balances at top - Read-only Display with Password Edit */}
            <div className="mt-3 bg-amber-900/5 p-3 rounded-lg border border-amber-900/10 font-serif text-[11px]">
              <div className="grid grid-cols-3 gap-2.5 text-center mb-2">
                <div className="p-1.5 bg-white/60 rounded border border-amber-900/5 shadow-sm">
                  <p className="text-amber-900/70 mb-0.5 font-medium">💵 Opening Cash</p>
                  <p className="font-mono font-black text-amber-950 text-xs">{formatCurrency(openingCash)}</p>
                </div>
                <div className="relative group p-1.5 bg-white/60 rounded border border-amber-900/5 shadow-sm cursor-help">
                  <p className="text-amber-900/70 mb-0.5 font-medium">📱 Opening UPI</p>
                  <p className="font-mono font-black text-amber-950 text-xs">{formatCurrency(openingUpi)}</p>
                  
                  {/* Print-visible inline account breakdown */}
                  {daybook.opening_upi_details && (
                    <div className="hidden print:block mt-1 pt-1 border-t border-amber-900/10 text-[9px] font-sans text-left space-y-0.5">
                      {(() => {
                        try {
                          const details = JSON.parse(daybook.opening_upi_details || "{}");
                          const accountsWithBal = UPI_ACCOUNTS.map(acc => ({
                            label: acc.label,
                            val: details[acc.key] || 0
                          })).filter(x => x.val > 0);
                          if (accountsWithBal.length === 0) return null;
                          return accountsWithBal.map(item => (
                            <div key={`open-print-${item.label}`} className="flex justify-between font-semibold text-amber-900/90 leading-tight">
                              <span className="truncate mr-1">{item.label}:</span>
                              <span className="font-mono">{formatCurrency(item.val)}</span>
                            </div>
                          ));
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  )}

                  {daybook.opening_upi_details && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block print:hidden bg-white border border-amber-900/20 shadow-lg rounded-lg p-2.5 z-50 w-52 text-left pointer-events-none font-sans">
                      <p className="text-[10px] font-bold text-amber-950 mb-1 border-b border-amber-900/10 pb-0.5 uppercase tracking-wider">UPI Accounts Setup</p>
                      <div className="space-y-1">
                        {(() => {
                          try {
                            const details = JSON.parse(daybook.opening_upi_details || "{}");
                            const accountsWithBal = UPI_ACCOUNTS.map(acc => ({
                              label: acc.label,
                              val: details[acc.key] || 0
                            })).filter(x => x.val > 0);
                            
                            if (accountsWithBal.length === 0) {
                              return <p className="text-[9px] text-amber-900/50 italic">No account opening balance</p>;
                            }
                            return accountsWithBal.map(item => (
                              <div key={item.label} className="flex justify-between text-[9px] font-semibold text-amber-900">
                                <span>{item.label}</span>
                                <span className="font-mono">{formatCurrency(item.val)}</span>
                              </div>
                            ));
                          } catch {
                            return null;
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-1.5 bg-white/60 rounded border border-amber-900/5 shadow-sm">
                  <p className="text-amber-900/70 mb-0.5 font-medium">🔄 Opening Other</p>
                  <p className="font-mono font-black text-amber-950 text-xs">{formatCurrency(openingOther)}</p>
                </div>
              </div>
              <div className="flex justify-between items-center text-xs font-bold text-amber-950 border-t border-amber-900/10 pt-2 px-2">
                <div className="flex items-center gap-1.5">
                  <span>Total Opening Balance:</span>
                  <span className="font-mono text-diary-crimson">{formatCurrency(openingCash + openingUpi + openingOther)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowMoneySwapModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black transition-all bg-gradient-to-r from-amber-800 to-amber-950 hover:from-amber-900 hover:to-black text-white border border-amber-900/40 shadow-xs cursor-pointer print:hidden"
                    title="1-Click Money Swap (Cash Received for UPI Transfer / UPI Received for Cash)"
                  >
                    <ArrowRightLeft size={12} className="text-amber-300" />
                    <span>🔄 Money Swap (Cash ↔ UPI)</span>
                  </button>
                  <button 
                    onClick={onEditOpening}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-900/20 shadow-sm print:hidden"
                    title="Adjust opening balances"
                  >
                    🔑 Adjust
                  </button>
                </div>
              </div>
            </div>

            {/* Outstanding Udhar Accounts Collapsible Widget */}
            <div className="mt-3 bg-white/70 backdrop-blur-xs border border-amber-900/15 rounded-lg p-3 shadow-xs font-serif print:hidden">
              <div 
                className="flex justify-between items-center cursor-pointer select-none"
                onClick={() => setIsUdharWidgetExpanded(!isUdharWidgetExpanded)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-amber-950 font-bold text-xs">👥 Outstanding Udhar Accounts</span>
                  {outstandingUdharList.length > 0 && (
                    <span className="bg-red-100 text-red-800 text-[9px] px-1.5 py-0.2 rounded-full font-bold font-sans">
                      {outstandingUdharList.length} Accounts
                    </span>
                  )}
                </div>
                <span className="text-amber-900/60 text-[10px] font-sans font-bold hover:text-amber-950 transition-colors">
                  {isUdharWidgetExpanded ? "▲ Collapse" : "▼ Expand"}
                </span>
              </div>
              
              {isUdharWidgetExpanded && (
                <div className="mt-2.5 pt-2.5 border-t border-amber-900/10 space-y-2 max-h-40 overflow-y-auto pr-1">
                  {outstandingUdharList.length === 0 ? (
                    <p className="text-[10px] text-amber-900/50 text-center italic py-2">🎉 No outstanding udhars!</p>
                  ) : (
                    outstandingUdharList.map((item, idx) => {
                      const weOweThem = item.amount < 0;
                      return (
                        <div key={`udhar-acc-${idx}`} className="flex justify-between items-center text-xs py-1 border-b border-dotted border-amber-900/5 hover:bg-amber-50/50 rounded px-1 transition-colors">
                          <div className="flex flex-col">
                            <span className="font-semibold text-amber-950">{item.name}</span>
                            <span className="text-[9px] text-amber-900/50 font-mono">
                              {weOweThem ? "We owe them" : "Lent to them"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold px-2 py-0.5 rounded border ${
                              weOweThem 
                                ? "text-emerald-700 bg-emerald-50/80 border-emerald-200/30" 
                                : "text-red-700 bg-red-50/80 border-red-200/30"
                            }`}>
                              {formatCurrency(Math.abs(item.amount))}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectCreditSuggest(item);
                                  setTimeout(() => {
                                    creditAmountInputRef.current?.focus();
                                    creditAmountInputRef.current?.select();
                                  }, 50);
                                }}
                                className="px-2 py-0.8 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[9px] font-sans font-bold transition-all shadow-xs cursor-pointer"
                                title={weOweThem ? "Autofill credit form to borrow more" : "Autofill credit form to receive payment"}
                              >
                                {weOweThem ? "Borrow" : "Receive"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleSelectDebitSuggest(item);
                                  setTimeout(() => {
                                    debitAmountInputRef.current?.focus();
                                  }, 50);
                                }}
                                className="px-2 py-0.8 bg-amber-600 hover:bg-amber-700 text-white rounded text-[9px] font-sans font-bold transition-all shadow-xs cursor-pointer"
                                title={weOweThem ? "Autofill debit form to pay back" : "Autofill debit form to lend more"}
                              >
                                {weOweThem ? "Pay" : "Lend"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>



          {/* Ledger split columns */}
          <div className="grid grid-cols-2 gap-4 min-h-[400px]">
            
            {/* LEFT COLUMN: RECEIVED (Credit / Aavak) */}
            <div className="ledger-line-y pr-2 md:pr-4 flex flex-col justify-between">
              <div>
                <h3 className="bg-emerald-50 text-emerald-800 text-center py-1 text-xs font-bold rounded border border-emerald-800/20 uppercase tracking-wide mb-3">
                  RECEIVED (Aavak / Credit)
                </h3>
                
                {/* List items */}
                <div className="space-y-2 pr-1">
                  {filteredCreditEntries.map((item) => (
                    <div key={item.id} className="ledger-row py-1.5 flex justify-between items-start text-xs group hover:bg-emerald-50/40 rounded px-1">
                      <div>
                        <p className="font-semibold text-amber-955 flex items-center gap-1">
                          {item.particulars.startsWith("[SPLIT") && (
                            <span className="bg-amber-100 text-amber-900 text-[8px] px-1 rounded font-bold uppercase tracking-wider">SPLIT</span>
                          )}
                          {item.particulars.startsWith("[UPI") && !item.particulars.startsWith("[SPLIT") && (
                            <span className="bg-blue-100 text-blue-800 text-[8px] px-1 rounded font-bold uppercase tracking-wider">UPI</span>
                          )}
                          {item.particulars.startsWith("[OTHER]") && (
                            <span className="bg-purple-100 text-purple-800 text-[8px] px-1 rounded font-bold uppercase tracking-wider">Other</span>
                          )}
                          {item.name}
                        </p>
                        <p className="text-[10px] text-amber-900/60 font-serif italic">{cleanParticulars(item.particulars)}</p>
                        {item.remarks && <p className="text-[9px] text-amber-900/40 font-mono">*{item.remarks}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-emerald-700">{formatCurrency(item.amount)}</span>
                        <button 
                          onClick={() => handleDelete("credit", item.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-0.5 print:hidden"
                        >
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Automatic Sold Items Summary Row */}
                  {soldTotalAmount > 0 && (
                    <div className="ledger-row py-1.5 flex justify-between items-start text-xs bg-emerald-800/5 rounded px-1.5 border-l-2 border-emerald-600">
                      <div>
                        <p className="font-semibold text-amber-950">Sold Items Total</p>
                        <p className="text-[10px] text-amber-900/50 italic">
                          Auto: Cash {formatCurrency(soldCashTotal)} + UPI {formatCurrency(soldUpiTotal)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-700">{formatCurrency(soldTotalAmount)}</span>
                    </div>
                  )}

                  {/* Automatic Chhudai Principal Summary Row */}
                  {releaseTotalAmount > 0 && (
                    <div className="ledger-row py-1.5 flex justify-between items-start text-xs bg-emerald-800/5 rounded px-1.5 border-l-2 border-emerald-600">
                      <div>
                        <p className="font-semibold text-amber-950 font-serif">Chhudai Total</p>
                        <p className="text-[10px] text-amber-900/50 italic">
                          Auto: Cash {formatCurrency(releasePrincipalCashTotal)} + UPI {formatCurrency(releasePrincipalUpiTotal)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-700">{formatCurrency(releaseTotalAmount)}</span>
                    </div>
                  )}

                  {/* Automatic Chhudai Interest Summary Row */}
                  {girviInterestTotal > 0 && (
                    <div className="ledger-row py-1.5 flex justify-between items-start text-xs bg-emerald-800/5 rounded px-1.5 border-l-2 border-emerald-600">
                      <div>
                        <p className="font-semibold text-amber-950 font-serif">Interest Total</p>
                        <p className="text-[10px] text-amber-900/50 italic">
                          Auto: Cash {formatCurrency(releaseInterestCashTotal)} + UPI {formatCurrency(releaseInterestUpiTotal)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-700">{formatCurrency(girviInterestTotal)}</span>
                    </div>
                  )}

                  {/* Automatic Banda Summary Row */}
                  {bandaTotalAmount > 0 && (
                    <div className="ledger-row py-1.5 flex justify-between items-start text-xs bg-emerald-800/5 rounded px-1.5 border-l-2 border-emerald-600">
                      <div>
                        <p className="font-semibold text-amber-950 font-serif">Banda Total</p>
                        <p className="text-[10px] text-amber-900/50 italic">
                          Auto: Cash {formatCurrency(bandaCashTotal)} + UPI {formatCurrency(bandaUpiTotal)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-emerald-700">{formatCurrency(bandaTotalAmount)}</span>
                    </div>
                  )}


                </div>
              </div>

              {/* Add form */}
              <form onSubmit={handleAddCredit} className="mt-4 pt-3 border-t border-diary-grid print:hidden">
                <div className="relative w-full mb-1.5" ref={creditSuggestRef}>
                  <input 
                    type="text" 
                    placeholder="Name"
                    value={creditForm.name}
                    onChange={(e) => handleCreditNameChange(e.target.value)}
                    onKeyDown={handleCreditNameKeyDown}
                    onFocus={handleCreditNameFocus}
                    className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                    required
                    autoComplete="off"
                  />
                  {showCreditSuggest && creditSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white/95 backdrop-blur-md border border-amber-900/15 rounded-xl shadow-xl py-1 text-xs">
                      {creditSuggestions.map((item, idx) => (
                        <div
                          key={`credit-sug-${idx}`}
                          onClick={() => handleSelectCreditSuggest(item)}
                          className={`flex justify-between items-center px-3 py-2 cursor-pointer transition-colors ${
                            idx === activeCreditSuggestIdx 
                              ? "bg-amber-100/70 text-amber-955 font-semibold" 
                              : "text-amber-900/90 hover:bg-amber-50"
                          }`}
                        >
                          <span className="font-medium">{item.name}</span>
                          <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            item.amount < 0 
                              ? "text-emerald-700 bg-emerald-50/80 border-emerald-200/30" 
                              : "text-red-700 bg-red-50/80 border-red-200/30"
                          }`}>
                            {item.amount < 0 ? `We owe: ${formatCurrency(Math.abs(item.amount))}` : `Owed: ${formatCurrency(item.amount)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outstanding Udhar Indicator Badge for Credit */}
                {(() => {
                  const matched = outstandingUdharList.find(
                    u => u.name.trim().toLowerCase() === creditForm.name.trim().toLowerCase()
                  );
                  if (matched) {
                    const weOweThem = matched.amount < 0;
                    return (
                      <div className={`mb-2 px-2.5 py-1.5 rounded-lg border text-[10px] flex justify-between items-center font-serif ${
                        weOweThem ? "bg-amber-50 border-amber-200/50 text-amber-850" : "bg-emerald-50 border-emerald-200/50 text-emerald-800"
                      }`}>
                        <span>{weOweThem ? "⚠️ We owe them (borrowed):" : "Customer paying off outstanding debt:"}</span>
                        <span className={`font-mono font-bold bg-white px-2 py-0.5 rounded border shadow-xs ${
                          weOweThem ? "text-red-700 border-amber-200" : "text-emerald-700 border-emerald-200"
                        }`}>
                          {formatCurrency(Math.abs(matched.amount))}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <input 
                    type="text" 
                    placeholder="Particulars"
                    value={creditForm.particulars}
                    onChange={(e) => setCreditForm({...creditForm, particulars: e.target.value})}
                    className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                  />
                  <select
                    value={creditForm.method}
                    onChange={(e) => setCreditForm({...creditForm, method: e.target.value})}
                    className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 focus:outline-none focus:ring-1 focus:ring-diary-red"
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="UPI">📱 PhonePe/UPI</option>
                    <option value="OTHER">🔄 Other</option>
                    <option value="SPLIT">🔀 Split Payment</option>
                  </select>
                </div>
                {creditForm.method === "SPLIT" ? (
                  <div className="space-y-1.5 mb-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input 
                        type="number" 
                        placeholder="Cash (₹)"
                        value={creditForm.splitCash}
                        onChange={(e) => setCreditForm({...creditForm, splitCash: e.target.value})}
                        className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                        required
                      />
                      <input 
                        type="number" 
                        placeholder="UPI (₹)"
                        value={creditForm.splitUpi}
                        onChange={(e) => setCreditForm({...creditForm, splitUpi: e.target.value})}
                        className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                        required
                      />
                    </div>
                    <select
                      value={creditForm.upiAccount}
                      onChange={(e) => setCreditForm({...creditForm, upiAccount: e.target.value})}
                      className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 focus:outline-none focus:ring-1 focus:ring-diary-red"
                    >
                      {UPI_ACCOUNTS.map(acc => (
                        <option key={acc.key} value={acc.key}>{acc.label}</option>
                      ))}
                    </select>
                    <button type="submit" className="w-full bg-diary-red hover:bg-diary-crimson text-white py-1 rounded text-xs font-bold transition-all flex items-center justify-center gap-1">
                      <Plus size={14}/> Add Split Credit
                    </button>
                  </div>
                ) : (
                  <>
                    {creditForm.method === "UPI" && (
                      <div className="mb-1.5">
                        <select
                          value={creditForm.upiAccount}
                          onChange={(e) => setCreditForm({...creditForm, upiAccount: e.target.value})}
                          className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 focus:outline-none focus:ring-1 focus:ring-diary-red"
                        >
                          {UPI_ACCOUNTS.map(acc => (
                            <option key={acc.key} value={acc.key}>{acc.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <input 
                        type="number" 
                        placeholder="Amount (₹)"
                        value={creditForm.amount}
                        onChange={(e) => setCreditForm({...creditForm, amount: e.target.value})}
                        ref={creditAmountInputRef}
                        className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                        required
                      />
                      <button type="submit" className="bg-diary-red hover:bg-diary-crimson text-white px-2.5 rounded text-xs font-bold transition-all flex items-center justify-center">
                        <Plus size={16}/>
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>

            {/* RIGHT COLUMN: GIVEN (Debit / Javak) */}
            <div className="pl-2 md:pl-4 flex flex-col justify-between">
              <div>
                <h3 className="bg-red-50 text-diary-red text-center py-1 text-xs font-bold rounded border border-diary-red/20 uppercase tracking-wide mb-3">
                  GIVEN (Javak / Debit)
                </h3>
                
                {/* List items */}
                <div className="space-y-2 pr-1">
                  {filteredDebitEntries.map((item) => (
                    <div key={item.id} className="ledger-row py-1.5 flex justify-between items-start text-xs group hover:bg-red-50/40 rounded px-1">
                      <div>
                        <p className="font-semibold text-amber-950 flex items-center gap-1">
                          {item.particulars.startsWith("[SPLIT") && (
                            <span className="bg-amber-100 text-amber-900 text-[8px] px-1 rounded font-bold uppercase tracking-wider">SPLIT</span>
                          )}
                          {item.particulars.startsWith("[UPI") && !item.particulars.startsWith("[SPLIT") && (
                            <span className="bg-blue-100 text-blue-800 text-[8px] px-1 rounded font-bold uppercase tracking-wider">UPI</span>
                          )}
                          {item.particulars.startsWith("[OTHER]") && (
                            <span className="bg-purple-100 text-purple-800 text-[8px] px-1 rounded font-bold uppercase tracking-wider">Other</span>
                          )}
                          {item.name}
                        </p>
                        <p className="text-[10px] text-amber-900/60 font-serif italic">{cleanParticulars(item.particulars)}</p>
                        {item.remarks && <p className="text-[9px] text-amber-900/40 font-mono">*{item.remarks}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-red-700">{formatCurrency(item.amount)}</span>
                        <button 
                          onClick={() => handleDelete("debit", item.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity p-0.5 print:hidden"
                        >
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Automatic Pledge (Girvi) Summary Row */}
                  {pledgeTotalAmount > 0 && (
                    <div className="ledger-row py-1.5 flex justify-between items-start text-xs bg-red-800/5 rounded px-1.5 border-l-2 border-red-650">
                      <div>
                        <p className="font-semibold text-amber-950 font-serif">Girvi Total</p>
                        <p className="text-[10px] text-amber-900/50 italic">
                          Auto: Cash {formatCurrency(pledgeCashTotal)} + UPI {formatCurrency(pledgeUpiTotal)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-red-700">{formatCurrency(pledgeTotalAmount)}</span>
                    </div>
                  )}


                </div>
              </div>

              <form onSubmit={handleAddDebit} className="mt-4 pt-3 border-t border-diary-grid print:hidden">
                <div className="relative w-full mb-1.5" ref={debitSuggestRef}>
                  <input 
                    type="text" 
                    placeholder="Name"
                    value={debitForm.name}
                    onChange={(e) => handleDebitNameChange(e.target.value)}
                    onKeyDown={handleDebitNameKeyDown}
                    onFocus={handleDebitNameFocus}
                    className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                    required
                    autoComplete="off"
                  />
                  {showDebitSuggest && debitSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto bg-white/95 backdrop-blur-md border border-amber-900/15 rounded-xl shadow-xl py-1 text-xs">
                      {debitSuggestions.map((item, idx) => (
                        <div
                          key={`debit-sug-${idx}`}
                          onClick={() => handleSelectDebitSuggest(item)}
                          className={`flex justify-between items-center px-3 py-2 cursor-pointer transition-colors ${
                            idx === activeDebitSuggestIdx 
                              ? "bg-amber-100/70 text-amber-955 font-semibold" 
                              : "text-amber-900/90 hover:bg-amber-50"
                          }`}
                        >
                          <span className="font-medium">{item.name}</span>
                          <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            item.amount < 0 
                              ? "text-emerald-700 bg-emerald-50/80 border-emerald-200/30" 
                              : "text-red-700 bg-red-50/80 border-red-200/30"
                          }`}>
                            {item.amount < 0 ? `We owe: ${formatCurrency(Math.abs(item.amount))}` : `Owed: ${formatCurrency(item.amount)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Outstanding Udhar Indicator Badge for Debit */}
                {(() => {
                  const matched = outstandingUdharList.find(
                    u => u.name.trim().toLowerCase() === debitForm.name.trim().toLowerCase()
                  );
                  if (matched) {
                    const weOweThem = matched.amount < 0;
                    return (
                      <div className={`mb-2 px-2.5 py-1.5 rounded-lg border text-[10px] flex justify-between items-center font-serif ${
                        weOweThem ? "bg-emerald-50 border-emerald-200/50 text-emerald-800" : "bg-amber-50 border-amber-200/50 text-amber-800"
                      }`}>
                        <span>{weOweThem ? "Paying back our debt to them:" : "⚠️ Customer already owes us:"}</span>
                        <span className={`font-mono font-bold bg-white px-2 py-0.5 rounded border shadow-xs ${
                          weOweThem ? "text-emerald-700 border-emerald-200" : "text-red-700 border-amber-200"
                        }`}>
                          {formatCurrency(Math.abs(matched.amount))}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <input 
                    type="text" 
                    placeholder="Particulars"
                    value={debitForm.particulars}
                    onChange={(e) => setDebitForm({...debitForm, particulars: e.target.value})}
                    className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                  />
                  <select
                    value={debitForm.method}
                    onChange={(e) => setDebitForm({...debitForm, method: e.target.value})}
                    className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 focus:outline-none focus:ring-1 focus:ring-diary-red"
                  >
                    <option value="CASH">💵 Cash</option>
                    <option value="UPI">📱 PhonePe/UPI</option>
                    <option value="OTHER">🔄 Other</option>
                    <option value="SPLIT">🔀 Split Payment</option>
                  </select>
                </div>
                {debitForm.method === "SPLIT" ? (
                  <div className="space-y-1.5 mb-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <input 
                        type="number" 
                        placeholder="Cash (₹)"
                        value={debitForm.splitCash}
                        onChange={(e) => setDebitForm({...debitForm, splitCash: e.target.value})}
                        className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                        required
                      />
                      <input 
                        type="number" 
                        placeholder="UPI (₹)"
                        value={debitForm.splitUpi}
                        onChange={(e) => setDebitForm({...debitForm, splitUpi: e.target.value})}
                        className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                        required
                      />
                    </div>
                    <select
                      value={debitForm.upiAccount}
                      onChange={(e) => setDebitForm({...debitForm, upiAccount: e.target.value})}
                      className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 focus:outline-none focus:ring-1 focus:ring-diary-red"
                    >
                      {UPI_ACCOUNTS.map(acc => (
                        <option key={acc.key} value={acc.key}>{acc.label}</option>
                      ))}
                    </select>
                    <button type="submit" className="w-full bg-diary-red hover:bg-diary-crimson text-white py-1 rounded text-xs font-bold transition-all flex items-center justify-center gap-1">
                      <Plus size={14}/> Add Split Debit
                    </button>
                  </div>
                ) : (
                  <>
                    {debitForm.method === "UPI" && (
                      <div className="mb-1.5">
                        <select
                          value={debitForm.upiAccount}
                          onChange={(e) => setDebitForm({...debitForm, upiAccount: e.target.value})}
                          className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 focus:outline-none focus:ring-1 focus:ring-diary-red"
                        >
                          {UPI_ACCOUNTS.map(acc => (
                            <option key={acc.key} value={acc.key}>{acc.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="flex gap-1.5">
                      <input 
                        type="number" 
                        placeholder="Amount (₹)"
                        value={debitForm.amount}
                        onChange={(e) => setDebitForm({...debitForm, amount: e.target.value})}
                        ref={debitAmountInputRef}
                        className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs focus:outline-none focus:ring-1 focus:ring-diary-red"
                        required
                      />
                      <button type="submit" className="bg-diary-red hover:bg-diary-crimson text-white px-2.5 rounded text-xs font-bold transition-all flex items-center justify-center">
                        <Plus size={16}/>
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>

          </div>

          {/* Ledger Bottom Totals */}
          <div className="mt-6 border-t-2 border-double border-diary-red/30 pt-4 bg-diary-cream/80 text-xs text-amber-950 font-semibold space-y-2">
            <div className="grid grid-cols-2 gap-4 pb-2 border-b border-diary-grid">
              <div className="flex justify-between items-center text-emerald-800">
                <span>RECEIVED TOTAL:</span>
                <span className="font-mono font-bold text-sm">{formatCurrency(creditTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-red-800">
                <span>GIVEN TOTAL:</span>
                <span className="font-mono font-bold text-sm">{formatCurrency(debitTotal)}</span>
              </div>
            </div>


            {/* Cash vs PhonePe breakdown block */}
            <div className="bg-amber-900/5 p-2.5 rounded border border-amber-900/10 space-y-1.5 font-serif text-[11px] text-amber-950">
              <div className="flex justify-between items-center">
                <span>(+) Cash Received (Credit - UPI):</span>
                <span className="font-mono">{formatCurrency(cashReceived)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>(-) Cash Given (Debit - UPI):</span>
                <span className="font-mono">{formatCurrency(cashGiven)}</span>
              </div>
              <div className="flex justify-between items-center text-blue-800">
                <span>(ℹ) PhonePe / UPI Received:</span>
                <span className="font-mono font-semibold">{formatCurrency(totalUPIReceived)}</span>
              </div>
              <div className="flex justify-between items-center text-red-800">
                <span>(ℹ) PhonePe / UPI Paid:</span>
                <span className="font-mono font-semibold">{formatCurrency(totalUPIGiven)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center bg-amber-100 p-2 rounded border border-amber-900/20 font-serif text-xs">
              <span className="font-bold text-amber-950">Closing Cash (Drawer):</span>
              <span className="font-mono font-black text-amber-900 text-sm">
                {formatCurrency(closingCash)}
              </span>
            </div>

            <div className="relative group flex flex-col bg-blue-50 p-2 rounded border border-blue-900/20 font-serif text-xs cursor-help">
              <div className="flex justify-between items-center w-full">
                <span className="font-bold text-blue-950">Closing PhonePe/UPI Balance:</span>
                <span className="font-mono font-black text-blue-900 text-sm">
                  {formatCurrency(closingUpi)}
                </span>
              </div>

              {/* Print-visible inline account breakdown */}
              {daybook.closing_upi_details && (
                <div className="hidden print:block mt-1 pt-1 border-t border-blue-900/15 text-[9px] font-sans text-left space-y-0.5">
                  {(() => {
                    try {
                      const details = JSON.parse(daybook.closing_upi_details || "{}");
                      const accountsWithBal = UPI_ACCOUNTS.map(acc => ({
                        label: acc.label,
                        val: details[acc.key] || 0
                      })).filter(x => x.val !== 0);
                      if (accountsWithBal.length === 0) return null;
                      return accountsWithBal.map(item => (
                        <div key={`close-print-${item.label}`} className="flex justify-between font-semibold text-blue-900/90 leading-tight">
                          <span className="truncate mr-1">{item.label}:</span>
                          <span className="font-mono">{formatCurrency(item.val)}</span>
                        </div>
                      ));
                    } catch {
                      return null;
                    }
                  })()}
                </div>
              )}

              {daybook.closing_upi_details && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block print:hidden bg-white border border-blue-900/20 shadow-lg rounded-lg p-2.5 z-50 w-52 text-left pointer-events-none font-sans">
                  <p className="text-[10px] font-bold text-blue-950 mb-1 border-b border-blue-900/10 pb-0.5 uppercase tracking-wider">Closing UPI Accounts</p>
                  <div className="space-y-1">
                    {(() => {
                      try {
                        const details = JSON.parse(daybook.closing_upi_details || "{}");
                        const accountsWithBal = UPI_ACCOUNTS.map(acc => ({
                          label: acc.label,
                          val: details[acc.key] || 0
                        })).filter(x => x.val !== 0);
                        
                        if (accountsWithBal.length === 0) {
                          return <p className="text-[9px] text-amber-900/50 italic">No account closing balance</p>;
                        }
                        return accountsWithBal.map(item => (
                          <div key={item.label} className="flex justify-between text-[9px] font-semibold text-blue-900">
                            <span>{item.label}</span>
                            <span className="font-mono">{formatCurrency(item.val)}</span>
                          </div>
                        ));
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center bg-purple-50 p-2 rounded border border-purple-900/20 font-serif text-xs">
              <span className="font-bold text-purple-950">Closing Other Balance:</span>
              <span className="font-mono font-black text-purple-900 text-sm">
                {formatCurrency(closingOther)}
              </span>
            </div>

            <div className="flex justify-between items-center bg-diary-red/5 p-2 rounded border border-diary-red/20 font-serif text-sm">
              <span className="font-bold text-amber-950">Total Closing Balance (All):</span>
              <span className="font-mono font-black text-diary-crimson text-base">
                {formatCurrency(totalClosingBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - BACK SIDE (6 SECTIONS) - ALWAYS SEPARATE PAGE IN PRINT */}
          <div className={`print:block print:w-full print:break-before-page ${activeTabMobile === "back" ? "block" : "hidden md:block"}`}>
            {/* Header on Page 2 in Print */}
            <div className="hidden print:flex justify-between items-center border-b-2 border-amber-900/20 pb-2 mb-4 font-serif">
              <div>
                <h2 className="text-base font-black text-amber-950 uppercase tracking-wide">
                  POOJA JEWELLERS — DAY BOOK (SECTIONS 1 TO 6)
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-black text-diary-crimson bg-amber-900/10 px-2.5 py-1 rounded border border-amber-900/20">
                  📅 DATE: {formatDisplayDate(dateStr || daybook.date)}
                </span>
              </div>
            </div>
            <div className="space-y-6">
            
            {/* SECTION 1 : SOLD ITEMS */}
            <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-900/10">
              <div className="flex justify-between items-center border-b border-diary-grid pb-1 mb-2">
                <span className="font-serif font-bold text-xs text-amber-950">1. SOLD ITEMS</span>
                <div className="flex gap-2 text-[10px] font-mono text-diary-red">
                  <span>Gold: <b className="font-sans font-bold">{goldSoldWeight.toFixed(3)}g</b></span>
                  <span>Silver: <b className="font-sans font-bold">{silverSoldWeight.toFixed(3)}g</b></span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 mb-3">
                {daybook.sold_items.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs items-center group py-0.5 border-b border-dotted border-amber-900/10">
                    <span className="text-amber-900">
                      <span className={`inline-block text-[9px] px-1 py-0.2 rounded font-bold mr-1.5 ${
                        item.item_name.includes("GOLD") ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-800"
                      }`}>
                        {item.item_name.includes("GOLD") ? "Gold" : "Silver"}
                      </span>
                      {cleanItemName(item.item_name)} <span className="text-amber-900/50">({item.quantity} pc)</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-900/60 text-[10px]">{item.weight} g</span>
                      <span className="font-mono text-amber-950 font-bold">{formatCurrency(item.amount)}</span>
                      {onSelectPrintBill && (
                        <button onClick={() => onSelectPrintBill(item)} className="text-amber-850 hover:text-amber-950 p-0.5 print:hidden ml-1" title="Print Sales Bill">
                          <FileText size={12}/>
                        </button>
                      )}
                      <button onClick={() => handleDelete("sold-item", item.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity print:hidden">
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleAddSold} className="grid grid-cols-4 gap-1 print:hidden">
                <input 
                  type="text" 
                  placeholder="Item"
                  value={soldForm.name}
                  onChange={(e) => setSoldForm({...soldForm, name: e.target.value})}
                  className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2"
                  required
                />
                <input 
                  type="number" 
                  placeholder="Wt (g)"
                  value={soldForm.weight}
                  onChange={(e) => setSoldForm({...soldForm, weight: e.target.value})}
                  className="bg-white border border-amber-900/20 rounded p-1 text-xs"
                  required
                  step="0.001"
                />
                <select 
                  value={soldForm.metal}
                  onChange={(e) => setSoldForm({...soldForm, metal: e.target.value})}
                  className="bg-white border border-amber-900/20 rounded p-1 text-[11px] font-bold text-amber-900"
                >
                  <option value="GOLD">Gold</option>
                  <option value="SILVER">Silver</option>
                </select>
                <div className="col-span-4 flex flex-col gap-1 mt-1">
                  <div className="grid grid-cols-4 gap-1">
                    <input 
                      type="number" 
                      placeholder="Qty"
                      value={soldForm.qty}
                      onChange={(e) => setSoldForm({...soldForm, qty: e.target.value})}
                      className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs"
                    />
                    <input 
                      type="number" 
                      placeholder="Cash"
                      value={soldForm.cashAmount}
                      onChange={(e) => setSoldForm({...soldForm, cashAmount: e.target.value})}
                      className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs"
                    />
                    <input 
                      type="number" 
                      placeholder="UPI"
                      value={soldForm.upiAmount}
                      onChange={(e) => setSoldForm({...soldForm, upiAmount: e.target.value})}
                      className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs"
                    />
                    <input 
                      type="number" 
                      placeholder="Other"
                      value={soldForm.otherAmount}
                      onChange={(e) => setSoldForm({...soldForm, otherAmount: e.target.value})}
                      className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs"
                    />
                  </div>
                  {parseFloat(soldForm.upiAmount || "0") > 0 && (
                    <div className="mt-1">
                      <select
                        value={soldForm.upiAccount}
                        onChange={(e) => setSoldForm({...soldForm, upiAccount: e.target.value})}
                        className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 focus:outline-none"
                      >
                        {UPI_ACCOUNTS.map(acc => (
                          <option key={acc.key} value={acc.key}>UPI Acc: {acc.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5 mt-1">
                    <button type="submit" className="bg-diary-red text-white py-1 rounded text-[11px] font-bold hover:bg-diary-crimson flex items-center justify-center gap-1">
                      <Plus size={12}/> Add Only
                    </button>
                    <button type="button" onClick={handleSoldAndPost} className="bg-amber-600 hover:bg-amber-700 text-white py-1 rounded text-[11px] font-bold flex items-center justify-center gap-1">
                      <Save size={11}/> Save &amp; Post Split
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* SECTION 2 : PHONEPE / UPI */}
            <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-900/10">
              <div className="flex justify-between items-center border-b border-diary-grid pb-1 mb-2">
                <span className="font-serif font-bold text-xs text-amber-950">2. PHONEPE / UPI</span>
                <span className="font-mono text-xs font-bold text-diary-red">Total: {formatCurrency(totalUPIReceived)}</span>
              </div>

              {/* Items List */}
              <div className="space-y-1.5 mb-3">
                {/* 1. Direct PhonePe entries */}
                {daybook.phonepe_entries.map((item) => (
                  <div key={item.id} className="flex justify-between text-xs items-center group py-0.5 border-b border-dotted border-amber-900/10">
                    <span className="text-amber-900">{item.customer_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-950 font-bold">{formatCurrency(item.amount)}</span>
                      <button onClick={() => handleDelete("phonepe", item.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity print:hidden">
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  </div>
                ))}


                {/* 3. Front ledger Credit entries transacted via UPI */}
                {daybook.credit_entries.map((item) => {
                  if (!item.particulars.startsWith("[UPI")) return null;
                  return (
                    <div key={`ledger-upi-${item.id}`} className="flex justify-between text-[11px] items-center py-0.5 border-b border-dotted border-amber-900/10 bg-blue-50/50 rounded px-1">
                      <span className="text-amber-900 truncate max-w-[150px]">
                        <span className="text-[8px] bg-blue-100 text-blue-800 px-1 rounded font-bold mr-1">LEDGER</span>
                        {item.name}
                      </span>
                      <span className="font-mono text-blue-800 font-bold">{formatCurrency(item.amount)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Account-wise Closing Balances */}
              {daybook.closing_upi_details && (
                <div className="mt-2.5 p-2 bg-blue-50/80 rounded border border-blue-900/20 text-[10px] font-serif">
                  <p className="font-bold text-blue-950 mb-1 border-b border-blue-900/20 pb-0.5 uppercase tracking-wider font-sans text-[9px]">
                    🏦 UPI Accounts Closing Balances
                  </p>
                  <div className="space-y-1">
                    {(() => {
                      try {
                        const details = JSON.parse(daybook.closing_upi_details || "{}");
                        return UPI_ACCOUNTS.map(acc => {
                          const bal = details[acc.key] || 0;
                          return (
                            <div key={`section2-${acc.key}`} className="flex justify-between items-center text-blue-900 font-semibold">
                              <span>{acc.label}</span>
                              <span className="font-mono font-bold">{formatCurrency(bal)}</span>
                            </div>
                          );
                        });
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleAddUpi} className="flex flex-col gap-1.5 print:hidden">
                <div className="flex gap-1.5">
                  <input 
                    type="text" 
                    placeholder="Customer Name"
                    value={upiForm.name}
                    onChange={(e) => setUpiForm({...upiForm, name: e.target.value})}
                    className="bg-white border border-amber-900/20 rounded p-1 text-xs flex-1"
                    required
                  />
                  <input 
                    type="number" 
                    placeholder="Amount (₹)"
                    value={upiForm.amount}
                    onChange={(e) => setUpiForm({...upiForm, amount: e.target.value})}
                    className="bg-white border border-amber-900/20 rounded p-1 text-xs w-28"
                    required
                  />
                  <button type="submit" className="bg-diary-red text-white px-2.5 rounded text-xs font-bold hover:bg-diary-crimson">
                    <Plus size={16}/>
                  </button>
                </div>
                <div>
                  <select
                    value={upiForm.upiAccount}
                    onChange={(e) => setUpiForm({...upiForm, upiAccount: e.target.value})}
                    className="w-full bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 focus:outline-none"
                  >
                    {UPI_ACCOUNTS.map(acc => (
                      <option key={acc.key} value={acc.key}>UPI Acc: {acc.label}</option>
                    ))}
                  </select>
                </div>
              </form>
            </div>

            {/* SECTION 3 & 4 : OLD GOLD & OLD SILVER */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              
              {/* OLD GOLD */}
              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-900/10">
                <div className="flex justify-between items-center border-b border-diary-grid pb-1 mb-2">
                  <span className="font-serif font-bold text-xs text-amber-950">3. OLD GOLD</span>
                  <div className="flex flex-col text-[10px] items-end font-mono text-diary-red">
                    <span>Wt: {oldGoldWeight}g</span>
                    <span>{formatCurrency(oldGoldAmount)}</span>
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  {daybook.old_gold_entries.map((item) => (
                    <div key={item.id} className="flex justify-between text-[11px] items-center group">
                      <span className="text-amber-900 truncate max-w-[80px]">{cleanCustomerName(item.customer_name)}</span>
                      <span className="font-mono text-amber-950 font-bold">{item.weight}g - {formatCurrency(item.amount)}</span>
                      <button onClick={() => handleDelete("old-gold", item.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 print:hidden">
                        <Trash2 size={10}/>
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddOldGold} className="space-y-1 print:hidden">
                  <input type="text" placeholder="Name" value={oldGoldForm.name} onChange={(e) => setOldGoldForm({...oldGoldForm, name: e.target.value})} className="bg-white border border-amber-900/20 rounded p-1 text-xs w-full" required/>
                  <div className="flex gap-1">
                    <input type="number" placeholder="Wt(g)" value={oldGoldForm.weight} onChange={(e) => setOldGoldForm({...oldGoldForm, weight: e.target.value})} className="bg-white border border-amber-900/20 rounded p-1 text-xs w-full" step="0.01"/>
                    <input type="number" placeholder="₹" value={oldGoldForm.amount} onChange={(e) => setOldGoldForm({...oldGoldForm, amount: e.target.value})} className="bg-white border border-amber-900/20 rounded p-1 text-xs w-full" required/>
                    <button type="submit" className="bg-diary-red text-white px-2 rounded hover:bg-diary-crimson"><Plus size={14}/></button>
                  </div>
                </form>
              </div>

              {/* OLD SILVER */}
              <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-900/10">
                <div className="flex justify-between items-center border-b border-diary-grid pb-1 mb-2">
                  <span className="font-serif font-bold text-xs text-amber-950">4. OLD SILVER</span>
                  <div className="flex flex-col text-[10px] items-end font-mono text-diary-red">
                    <span>Wt: {oldSilverWeight}g</span>
                    <span>{formatCurrency(oldSilverAmount)}</span>
                  </div>
                </div>

                <div className="space-y-1 mb-3">
                  {daybook.old_silver_entries.map((item) => (
                    <div key={item.id} className="flex justify-between text-[11px] items-center group">
                      <span className="text-amber-900 truncate max-w-[80px]">{cleanCustomerName(item.customer_name)}</span>
                      <span className="font-mono text-amber-950 font-bold">{item.weight}g - {formatCurrency(item.amount)}</span>
                      <button onClick={() => handleDelete("old-silver", item.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 print:hidden">
                        <Trash2 size={10}/>
                      </button>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleAddOldSilver} className="space-y-1 print:hidden">
                  <input type="text" placeholder="Name" value={oldSilverForm.name} onChange={(e) => setOldSilverForm({...oldSilverForm, name: e.target.value})} className="bg-white border border-amber-900/20 rounded p-1 text-xs w-full" required/>
                  <div className="flex gap-1">
                    <input type="number" placeholder="Wt(g)" value={oldSilverForm.weight} onChange={(e) => setOldSilverForm({...oldSilverForm, weight: e.target.value})} className="bg-white border border-amber-900/20 rounded p-1 text-xs w-full" step="0.01"/>
                    <input type="number" placeholder="₹" value={oldSilverForm.amount} onChange={(e) => setOldSilverForm({...oldSilverForm, amount: e.target.value})} className="bg-white border border-amber-900/20 rounded p-1 text-xs w-full" required/>
                    <button type="submit" className="bg-diary-red text-white px-2 rounded hover:bg-diary-crimson"><Plus size={14}/></button>
                  </div>
                </form>
              </div>

            </div>

            {/* SECTION 5 : PLEDGE (Gahan / Girvi) */}
            <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-900/10">
              <div className="flex justify-between items-center border-b border-diary-grid pb-1 mb-2">
                <span className="font-serif font-bold text-xs text-amber-950">5. PLEDGE (Girvi)</span>
                <span className="font-mono text-xs font-bold text-diary-red">Total: {formatCurrency(pledgeTotal)}</span>
              </div>

              {/* Pledge List */}
              <div className="space-y-1 mb-3">
                {daybook.pledge_entries.length > 0 && (
                  <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-amber-900/60 border-b border-amber-900/20 pb-1 mb-1 px-0.5 uppercase tracking-wider font-serif">
                    <div className="col-span-5">No.</div>
                    <div className="col-span-4 text-right">Amount</div>
                    <div className="col-span-3 text-right">Interest</div>
                  </div>
                )}
                {daybook.pledge_entries.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-1 text-xs items-center group py-1 border-b border-dotted border-amber-900/10">
                    <div className="col-span-5 truncate font-semibold text-amber-950 flex items-center gap-1">
                      {item.customer_name.startsWith("[SPLIT") && (
                        <span className="bg-amber-100 text-amber-900 text-[8px] px-1 rounded font-bold uppercase tracking-wider">SPLIT</span>
                      )}
                      {item.customer_name.startsWith("[UPI") && !item.customer_name.startsWith("[SPLIT") && (
                        <span className="bg-blue-100 text-blue-800 text-[8px] px-1 rounded font-bold uppercase tracking-wider">UPI</span>
                      )}
                      {item.customer_name.startsWith("[OTHER]") && (
                        <span className="bg-purple-100 text-purple-800 text-[8px] px-1 rounded font-bold uppercase tracking-wider">Other</span>
                      )}
                      {item.pledge_no || cleanCustomerName(item.customer_name)}
                    </div>
                    <div className="col-span-4 font-mono font-bold text-amber-950 text-right">
                      {formatCurrency(item.amount)}
                    </div>
                    <div className="col-span-3 font-mono font-bold text-red-700 text-right flex items-center justify-end gap-1">
                      <span>{formatCurrency(item.interest_percentage)}</span>
                      {onSelectPrintPledge && (
                        <button
                          onClick={() => onSelectPrintPledge(item)}
                          className="text-amber-850 hover:text-amber-950 p-0.5 print:hidden ml-1"
                          title="Print Pawn Ticket"
                        >
                          <FileText size={11}/>
                        </button>
                      )}
                      <button onClick={() => handleDelete("pledge", item.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 print:hidden ml-1">
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleAddPledge} className="grid grid-cols-4 gap-1.5 print:hidden">
                <input 
                  type="text" 
                  placeholder="Pledge No." 
                  value={pledgeForm.name} 
                  onChange={(e) => setPledgeForm({...pledgeForm, name: e.target.value})} 
                  className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2" 
                  required
                />
                <select
                  value={pledgeForm.method}
                  onChange={(e) => setPledgeForm({...pledgeForm, method: e.target.value})}
                  className="bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 col-span-2 focus:outline-none"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="UPI">📱 UPI</option>
                  <option value="OTHER">🔄 Other</option>
                  <option value="SPLIT">🔀 Split Payment</option>
                </select>

                {pledgeForm.method === "SPLIT" ? (
                  <>
                    <input 
                      type="number" 
                      placeholder="Cash (₹)" 
                      value={pledgeForm.splitCash} 
                      onChange={(e) => setPledgeForm({...pledgeForm, splitCash: e.target.value})} 
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2" 
                      required
                    />
                    <input 
                      type="number" 
                      placeholder="UPI (₹)" 
                      value={pledgeForm.splitUpi} 
                      onChange={(e) => setPledgeForm({...pledgeForm, splitUpi: e.target.value})} 
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2" 
                      required
                    />
                    <select
                      value={pledgeForm.upiAccount}
                      onChange={(e) => setPledgeForm({...pledgeForm, upiAccount: e.target.value})}
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 col-span-4 focus:outline-none"
                    >
                      {UPI_ACCOUNTS.map(acc => (
                        <option key={acc.key} value={acc.key}>UPI Acc: {acc.label}</option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      placeholder="Interest (%)" 
                      value={pledgeForm.interest} 
                      onChange={(e) => setPledgeForm({...pledgeForm, interest: e.target.value})} 
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-4"
                    />
                  </>
                ) : (
                  <>
                    {pledgeForm.method === "UPI" && (
                      <select
                        value={pledgeForm.upiAccount}
                        onChange={(e) => setPledgeForm({...pledgeForm, upiAccount: e.target.value})}
                        className="bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 col-span-4 focus:outline-none"
                      >
                        {UPI_ACCOUNTS.map(acc => (
                          <option key={acc.key} value={acc.key}>UPI Acc: {acc.label}</option>
                        ))}
                      </select>
                    )}
                    <input 
                      type="number" 
                      placeholder="Principal (₹)" 
                      value={pledgeForm.amount} 
                      onChange={(e) => setPledgeForm({...pledgeForm, amount: e.target.value})} 
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2" 
                      required
                    />
                    <input 
                      type="number" 
                      placeholder="Interest (%)" 
                      value={pledgeForm.interest} 
                      onChange={(e) => setPledgeForm({...pledgeForm, interest: e.target.value})} 
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2"
                    />
                  </>
                )}
                <div className="col-span-4 mt-1.5">
                  <button type="submit" className="w-full bg-diary-red text-white py-1.5 rounded text-xs font-bold hover:bg-diary-crimson flex items-center justify-center gap-1">
                    <Plus size={14}/> Add Pledge
                  </button>
                </div>
              </form>
            </div>

            {/* SECTION 6 : RELEASE (Chhudana) */}
            <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-900/10">
              <div className="flex justify-between items-center border-b border-diary-grid pb-1 mb-2">
                <span className="font-serif font-bold text-xs text-amber-950">6. RELEASE (Girvi Chhudai)</span>
                <div className="flex gap-2 text-[10px] font-mono text-diary-red">
                  <span>Pr: <b className="font-sans font-bold">{formatCurrency(releaseTotal)}</b></span>
                  <span>Int: <b className="font-sans font-bold">{formatCurrency(interestEarned)}</b></span>
                </div>
              </div>

              {/* Release List */}
              <div className="space-y-1 mb-3">
                {daybook.release_entries.length > 0 && (
                  <div className="grid grid-cols-12 gap-1 text-[10px] font-bold text-amber-900/60 border-b border-amber-900/20 pb-1 mb-1 px-0.5 uppercase tracking-wider font-serif">
                    <div className="col-span-5">No.</div>
                    <div className="col-span-4 text-right">Amount</div>
                    <div className="col-span-3 text-right">Interest</div>
                  </div>
                )}
                {daybook.release_entries.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-1 text-xs items-center group py-1 border-b border-dotted border-amber-900/10">
                    <div className="col-span-5 truncate font-semibold text-amber-950 flex items-center gap-1">
                      {item.customer_name.startsWith("[SPLIT") && (
                        <span className="bg-amber-100 text-amber-900 text-[8px] px-1 rounded font-bold uppercase tracking-wider">SPLIT</span>
                      )}
                      {item.customer_name.startsWith("[UPI") && !item.customer_name.startsWith("[SPLIT") && (
                        <span className="bg-blue-100 text-blue-800 text-[8px] px-1 rounded font-bold uppercase tracking-wider">UPI</span>
                      )}
                      {item.customer_name.startsWith("[OTHER]") && (
                        <span className="bg-purple-100 text-purple-800 text-[8px] px-1 rounded font-bold uppercase tracking-wider">Other</span>
                      )}
                      {cleanCustomerName(item.customer_name)}
                    </div>
                    <div className="col-span-4 font-mono font-bold text-amber-950 text-right">
                      {formatCurrency(item.principal_amount)}
                    </div>
                    <div className="col-span-3 font-mono font-bold text-emerald-700 text-right flex items-center justify-end gap-1">
                      <span>{formatCurrency(item.interest_received)}</span>
                      <button onClick={() => handleDelete("release", item.id)} className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 print:hidden ml-1">
                        <Trash2 size={11}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleAddRelease} className="grid grid-cols-4 gap-1.5 print:hidden">
                <input 
                  type="text" 
                  placeholder="Pledge No."
                  value={releaseForm.name}
                  onChange={(e) => setReleaseForm({...releaseForm, name: e.target.value})}
                  className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2"
                  required
                />
                <select
                  value={releaseForm.method}
                  onChange={(e) => setReleaseForm({...releaseForm, method: e.target.value})}
                  className="bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 col-span-2 focus:outline-none"
                >
                  <option value="CASH">💵 Cash</option>
                  <option value="UPI">📱 UPI</option>
                  <option value="OTHER">🔄 Other</option>
                  <option value="SPLIT">🔀 Split Payment</option>
                </select>

                {releaseForm.method === "SPLIT" ? (
                  <>
                    <input 
                      type="number" 
                      placeholder="Cash (₹)" 
                      value={releaseForm.splitCash} 
                      onChange={(e) => setReleaseForm({...releaseForm, splitCash: e.target.value})} 
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2" 
                      required
                    />
                    <input 
                      type="number" 
                      placeholder="UPI (₹)" 
                      value={releaseForm.splitUpi} 
                      onChange={(e) => setReleaseForm({...releaseForm, splitUpi: e.target.value})} 
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2" 
                      required
                    />
                    <select
                      value={releaseForm.upiAccount}
                      onChange={(e) => setReleaseForm({...releaseForm, upiAccount: e.target.value})}
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 col-span-4 focus:outline-none"
                    >
                      {UPI_ACCOUNTS.map(acc => (
                        <option key={acc.key} value={acc.key}>UPI Acc: {acc.label}</option>
                      ))}
                    </select>
                    <input 
                      type="number" 
                      placeholder="Principal"
                      value={releaseForm.principal}
                      onChange={(e) => setReleaseForm({...releaseForm, principal: e.target.value})}
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2"
                      required
                    />
                    <input 
                      type="number" 
                      placeholder="Interest"
                      value={releaseForm.interest}
                      onChange={(e) => setReleaseForm({...releaseForm, interest: e.target.value})}
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2"
                    />
                  </>
                ) : (
                  <>
                    {releaseForm.method === "UPI" && (
                      <select
                        value={releaseForm.upiAccount}
                        onChange={(e) => setReleaseForm({...releaseForm, upiAccount: e.target.value})}
                        className="bg-white border border-amber-900/20 rounded p-1 text-xs font-bold text-amber-950 col-span-4 focus:outline-none"
                      >
                        {UPI_ACCOUNTS.map(acc => (
                          <option key={acc.key} value={acc.key}>UPI Acc: {acc.label}</option>
                        ))}
                      </select>
                    )}
                    <input 
                      type="number" 
                      placeholder="Principal"
                      value={releaseForm.principal}
                      onChange={(e) => setReleaseForm({...releaseForm, principal: e.target.value})}
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2"
                      required
                    />
                    <input 
                      type="number" 
                      placeholder="Interest"
                      value={releaseForm.interest}
                      onChange={(e) => setReleaseForm({...releaseForm, interest: e.target.value})}
                      className="bg-white border border-amber-900/20 rounded p-1 text-xs col-span-2"
                    />
                  </>
                )}
                <div className="col-span-4 mt-1.5">
                  <button type="submit" className="w-full bg-diary-red text-white py-1.5 rounded text-xs font-bold hover:bg-diary-crimson flex items-center justify-center gap-1">
                    <Plus size={14}/> Add Release
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>

      </div>

      <MoneySwapModal
        isOpen={showMoneySwapModal}
        onClose={() => setShowMoneySwapModal(false)}
        daybookId={daybook.id}
        dateStr={dateStr}
        onRefresh={onRefresh}
        showNotification={showNotification || ((msg) => alert(msg))}
      />
    </div>
  </div>
  );
}
