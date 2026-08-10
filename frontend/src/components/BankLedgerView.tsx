"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, Printer, Calendar, ArrowUpRight, ArrowDownLeft, 
  Wallet, Landmark, RefreshCw, AlertCircle
} from "lucide-react";
import { API_BASE, DayBook } from "../utils/api";

const isBrowser = typeof window !== "undefined";

const ACCOUNTS = [
  { key: "CASH", label: "💵 Cash Drawer", type: "CASH" },
  { key: "hdfc_192", label: "🏦 HDFC Bank CA - 192", type: "UPI" },
  { key: "hdfc_od_7442", label: "🏦 HDFC OD - 7442", type: "UPI" },
  { key: "pooja_068", label: "🏦 Pooja Jewellers - 068", type: "UPI" },
  { key: "shankarlal_832", label: "🏦 Shankarlal - 832", type: "UPI" },
  { key: "vikash", label: "👤 Vikash Account", type: "UPI" },
  { key: "vikram", label: "👤 Vikram Account", type: "UPI" },
  { key: "deepak", label: "👤 Deepak Account", type: "UPI" },
  { key: "kavitha", label: "👤 Kavitha Account", type: "UPI" },
  { key: "OTHER", label: "🔄 Other UPI / Bank", type: "OTHER" },
];

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
  return val.replace(/^\[(UPI|OTHER)(:[^\]]+)?\]\s*/i, "");
};

const cleanCustomerName = (val: string) => {
  return val.replace(/^\[(UPI|OTHER)(:[^\]]+)?\]\s*/i, "");
};

interface TransactionItem {
  id: string;
  date: string;
  type: "IN" | "OUT";
  particulars: string;
  partyName: string;
  amount: number;
  remarks: string;
}

export default function BankLedgerView() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("CASH");
  const [daybooks, setDaybooks] = useState<DayBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [offlineMode, setOfflineMode] = useState(false);

  // Initialize dates: defaults to last 30 days
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }, []);

  // Fetch Daybooks for selected range
  const loadData = async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/range?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setDaybooks(data);
        setOfflineMode(false);
      } else {
        throw new Error("API failed");
      }
    } catch (err) {
      console.warn("Backend down, loading daybooks from offline storage...");
      setOfflineMode(true);
      loadOfflineDaybooks();
    } finally {
      setLoading(false);
    }
  };

  const loadOfflineDaybooks = () => {
    if (!isBrowser) return;
    const list: DayBook[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("daybook_")) {
        const dateStr = key.replace("daybook_", "");
        if (dateStr >= startDate && dateStr <= endDate) {
          try {
            list.push(JSON.parse(localStorage.getItem(key) || ""));
          } catch {}
        }
      }
    }
    list.sort((a, b) => a.date.localeCompare(b.date));
    setDaybooks(list);
  };

  useEffect(() => {
    if (startDate && endDate) {
      loadData();
    }
  }, [startDate, endDate]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  const formatDateDMY = (dateStr: string) => {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Helper to parse SPLIT format strings
  const parseSplitInfo = (str: string, defaultAmount: number) => {
    if (!str) return { isSplit: false, cash: defaultAmount, upi: 0, other: 0, account: "hdfc_192" };
    const match = str.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A([^\]]+))?\]/);
    if (match) {
      return {
        isSplit: true,
        cash: parseFloat(match[1]) || 0,
        upi: parseFloat(match[2]) || 0,
        other: parseFloat(match[3]) || 0,
        account: (match[4] || "hdfc_192").trim()
      };
    }
    return {
      isSplit: false,
      cash: defaultAmount,
      upi: 0,
      other: 0,
      account: "hdfc_192"
    };
  };

  // Compile detailed transaction logs for the selected account
  const compileLedger = () => {
    const ledgerItems: TransactionItem[] = [];

    if (daybooks.length === 0) return { items: [], startBal: 0, endBal: 0, totalIn: 0, totalOut: 0 };

    const matchesAccount = (particulars: string) => {
      if (!particulars) return false;
      if (selectedAccount === "CASH") {
        return !particulars.startsWith("[UPI") && !particulars.startsWith("[OTHER]");
      }
      if (selectedAccount === "OTHER") {
        return particulars.startsWith("[OTHER]");
      }
      if (selectedAccount === "hdfc_192") {
        return particulars.startsWith("[UPI:hdfc_192]") || (particulars.startsWith("[UPI") && !particulars.startsWith("[UPI:"));
      }
      return particulars.startsWith(`[UPI:${selectedAccount}]`);
    };

    // 1. Loop through daybooks chronologically and extract transactions
    daybooks.forEach((db) => {
      // Direct Credit Entries (filtering out Chhudai & Banda)
      const creditEntriesFiltered = db.credit_entries.filter((c: any) => {
        const nameLower = (c.name || "").toLowerCase();
        const partLower = (c.particulars || "").toLowerCase();
        return !nameLower.includes("chhudai no.") && 
               !nameLower.includes("banda no.") && 
               !partLower.includes("girvi release") &&
               !partLower.includes("girvi banda");
      });

      creditEntriesFiltered.forEach((e: any) => {
        const split = parseSplitInfo(`${e.particulars} ${e.name}`, e.amount);
        if (split.isSplit) {
          if (selectedAccount === "CASH" && split.cash > 0) {
            ledgerItems.push({
              id: `credit-split-c-${e.id}`,
              date: db.date,
              type: "IN",
              particulars: cleanParticulars(e.particulars) || "Split Credit (Cash)",
              partyName: e.name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim(),
              amount: split.cash,
              remarks: e.remarks || "Cash portion"
            });
          } else if (selectedAccount === split.account && split.upi > 0) {
            ledgerItems.push({
              id: `credit-split-u-${e.id}`,
              date: db.date,
              type: "IN",
              particulars: cleanParticulars(e.particulars) || "Split Credit (UPI)",
              partyName: e.name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim(),
              amount: split.upi,
              remarks: e.remarks || "UPI portion"
            });
          } else if (selectedAccount === "OTHER" && split.other > 0) {
            ledgerItems.push({
              id: `credit-split-o-${e.id}`,
              date: db.date,
              type: "IN",
              particulars: cleanParticulars(e.particulars) || "Split Credit (Other)",
              partyName: e.name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim(),
              amount: split.other,
              remarks: e.remarks || "Other portion"
            });
          }
        } else if (matchesAccount(e.particulars)) {
          ledgerItems.push({
            id: `credit-${e.id}`,
            date: db.date,
            type: "IN",
            particulars: cleanParticulars(e.particulars),
            partyName: e.name,
            amount: e.amount,
            remarks: e.remarks || ""
          });
        }
      });

      // Direct Debit Entries (filtering out Girvi pledge)
      const debitEntriesFiltered = db.debit_entries.filter((d: any) => {
        const nameLower = (d.name || "").toLowerCase();
        const partLower = (d.particulars || "").toLowerCase();
        return !nameLower.includes("girvi no.") && !partLower.includes("girvi pledge");
      });

      debitEntriesFiltered.forEach((e: any) => {
        const split = parseSplitInfo(`${e.particulars} ${e.name}`, e.amount);
        if (split.isSplit) {
          if (selectedAccount === "CASH" && split.cash > 0) {
            ledgerItems.push({
              id: `debit-split-c-${e.id}`,
              date: db.date,
              type: "OUT",
              particulars: cleanParticulars(e.particulars) || "Split Debit (Cash)",
              partyName: e.name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim(),
              amount: split.cash,
              remarks: e.remarks || "Cash portion"
            });
          } else if (selectedAccount === split.account && split.upi > 0) {
            ledgerItems.push({
              id: `debit-split-u-${e.id}`,
              date: db.date,
              type: "OUT",
              particulars: cleanParticulars(e.particulars) || "Split Debit (UPI)",
              partyName: e.name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim(),
              amount: split.upi,
              remarks: e.remarks || "UPI portion"
            });
          } else if (selectedAccount === "OTHER" && split.other > 0) {
            ledgerItems.push({
              id: `debit-split-o-${e.id}`,
              date: db.date,
              type: "OUT",
              particulars: cleanParticulars(e.particulars) || "Split Debit (Other)",
              partyName: e.name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim(),
              amount: split.other,
              remarks: e.remarks || "Other portion"
            });
          }
        } else if (matchesAccount(e.particulars)) {
          ledgerItems.push({
            id: `debit-${e.id}`,
            date: db.date,
            type: "OUT",
            particulars: cleanParticulars(e.particulars),
            partyName: e.name,
            amount: e.amount,
            remarks: e.remarks || ""
          });
        }
      });

      // Banda upfront interest credit entries
      const bandaEntries = db.credit_entries.filter((c: any) => {
        const nameLower = (c.name || "").toLowerCase();
        const partLower = (c.particulars || "").toLowerCase();
        return nameLower.includes("banda no.") || partLower.includes("girvi banda");
      });

      bandaEntries.forEach((e: any) => {
        if (matchesAccount(e.particulars)) {
          ledgerItems.push({
            id: `banda-${e.id}`,
            date: db.date,
            type: "IN",
            particulars: `Upfront Interest (Banda) - ${cleanParticulars(e.particulars)}`,
            partyName: e.name,
            amount: e.amount,
            remarks: e.remarks || ""
          });
        }
      });

      // Release entries (Chhudai principal + interest received)
      db.release_entries.forEach((e: any) => {
        const totalReceived = e.principal_amount + e.interest_received;
        const split = parseSplitInfo(e.customer_name, totalReceived);
        if (split.isSplit) {
          if (selectedAccount === "CASH" && split.cash > 0) {
            ledgerItems.push({
              id: `release-split-c-${e.id}`,
              date: db.date,
              type: "IN",
              particulars: `Girvi Chhudai Principal & Interest (Cash)`,
              partyName: `Pledge ${e.customer_name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim()}`,
              amount: split.cash,
              remarks: ""
            });
          } else if (selectedAccount === split.account && split.upi > 0) {
            ledgerItems.push({
              id: `release-split-u-${e.id}`,
              date: db.date,
              type: "IN",
              particulars: `Girvi Chhudai Principal & Interest (UPI)`,
              partyName: `Pledge ${e.customer_name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim()}`,
              amount: split.upi,
              remarks: ""
            });
          } else if (selectedAccount === "OTHER" && split.other > 0) {
            ledgerItems.push({
              id: `release-split-o-${e.id}`,
              date: db.date,
              type: "IN",
              particulars: `Girvi Chhudai Principal & Interest (Other)`,
              partyName: `Pledge ${e.customer_name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim()}`,
              amount: split.other,
              remarks: ""
            });
          }
        } else {
          let belongs = false;
          if (selectedAccount === "CASH") {
            belongs = !e.customer_name.startsWith("[UPI") && !e.customer_name.startsWith("[OTHER]");
          } else if (selectedAccount === "OTHER") {
            belongs = e.customer_name.startsWith("[OTHER]");
          } else if (selectedAccount === "hdfc_192") {
            belongs = e.customer_name.startsWith("[UPI:hdfc_192]") || (e.customer_name.startsWith("[UPI") && !e.customer_name.startsWith("[UPI:"));
          } else {
            belongs = e.customer_name.startsWith(`[UPI:${selectedAccount}]`);
          }

          if (belongs) {
            const pledgeNo = e.customer_name.replace(/^\[(UPI|OTHER)(:[^\]]+)?\]\s*/i, "");
            ledgerItems.push({
              id: `release-${e.id}`,
              date: db.date,
              type: "IN",
              particulars: `Girvi Chhudai Principal & Interest`,
              partyName: `Pledge ${pledgeNo}`,
              amount: totalReceived,
              remarks: ""
            });
          }
        }
      });

      // PhonePe Entries (Direct UPI sales)
      if (selectedAccount !== "CASH" && selectedAccount !== "OTHER") {
        db.phonepe_entries.forEach((e: any) => {
          let belongs = false;
          if (selectedAccount === "hdfc_192") {
            belongs = e.customer_name.startsWith("[UPI:hdfc_192]") || (e.customer_name.startsWith("[UPI") && !e.customer_name.startsWith("[UPI:"));
          } else {
            belongs = e.customer_name.startsWith(`[UPI:${selectedAccount}]`);
          }
          if (belongs) {
            ledgerItems.push({
              id: `phonepe-${e.id}`,
              date: db.date,
              type: "IN",
              particulars: "Sale UPI payment",
              partyName: e.customer_name.replace(/^\[UPI:[^\]]+\]\s*/i, ""),
              amount: e.amount,
              remarks: ""
            });
          }
        });
      }

      // Pledge entries (Girvi loans given)
      db.pledge_entries.forEach((e: any) => {
        const totalTopUps = (e.payments || []).filter((p: any) => p.payment_type === "TOP_UP").reduce((s: number, p: any) => s + p.amount, 0);
        const initialAmount = e.amount - totalTopUps;

        const split = parseSplitInfo(e.customer_name, initialAmount);
        if (split.isSplit) {
          if (selectedAccount === "CASH" && split.cash > 0) {
            ledgerItems.push({
              id: `pledge-split-c-${e.id}`,
              date: db.date,
              type: "OUT",
              particulars: `Girvi Loan Given (Pledge ${e.pledge_no || ""})`,
              partyName: e.customer_name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim(),
              amount: split.cash,
              remarks: "Cash portion"
            });
          } else if (selectedAccount === split.account && split.upi > 0) {
            ledgerItems.push({
              id: `pledge-split-u-${e.id}`,
              date: db.date,
              type: "OUT",
              particulars: `Girvi Loan Given (Pledge ${e.pledge_no || ""})`,
              partyName: e.customer_name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim(),
              amount: split.upi,
              remarks: "UPI portion"
            });
          } else if (selectedAccount === "OTHER" && split.other > 0) {
            ledgerItems.push({
              id: `pledge-split-o-${e.id}`,
              date: db.date,
              type: "OUT",
              particulars: `Girvi Loan Given (Pledge ${e.pledge_no || ""})`,
              partyName: e.customer_name.replace(/\[SPLIT:[^\]]+\]\s*/i, "").trim(),
              amount: split.other,
              remarks: "Other portion"
            });
          }
        } else {
          let belongs = false;
          let acc = "CASH";
          if (e.customer_name.startsWith("[UPI")) {
            const matchAcc = e.customer_name.match(/^\[UPI:([^\]]+)\]/);
            acc = matchAcc ? matchAcc[1] : "hdfc_192";
            belongs = (selectedAccount === acc);
          } else if (e.customer_name.startsWith("[OTHER]")) {
            belongs = (selectedAccount === "OTHER");
          } else {
            belongs = (selectedAccount === "CASH");
          }

          if (belongs) {
            const nameClean = e.customer_name.replace(/^\[(UPI|OTHER)(:[^\]]+)?\]\s*/i, "");
            ledgerItems.push({
              id: `pledge-flat-${e.id}`,
              date: db.date,
              type: "OUT",
              particulars: `Girvi Loan Given (Pledge ${e.pledge_no || ""})`,
              partyName: nameClean,
              amount: initialAmount,
              remarks: ""
            });
          }
        }
      });

      // Sold Items (Cash, UPI & Other split parts)
      db.sold_items.forEach((item: any) => {
        const split = parseSplitInfo(item.item_name, item.amount);
        const nameClean = cleanItemName(item.item_name);

        if (selectedAccount === "CASH" && split.cash > 0) {
          ledgerItems.push({
            id: `sold-cash-${item.id}`,
            date: db.date,
            type: "IN",
            particulars: `Sale: ${nameClean} (${item.quantity} pc)`,
            partyName: "Cash Customer",
            amount: split.cash,
            remarks: `Weight: ${item.weight}g`
          });
        } else if (selectedAccount === split.account && split.upi > 0) {
          ledgerItems.push({
            id: `sold-upi-${item.id}`,
            date: db.date,
            type: "IN",
            particulars: `Sale: ${nameClean} (${item.quantity} pc)`,
            partyName: "UPI Customer",
            amount: split.upi,
            remarks: `Weight: ${item.weight}g`
          });
        } else if (selectedAccount === "OTHER" && split.other > 0) {
          ledgerItems.push({
            id: `sold-other-${item.id}`,
            date: db.date,
            type: "IN",
            particulars: `Sale: ${nameClean} (${item.quantity} pc)`,
            partyName: "Customer (Other Payment)",
            amount: split.other,
            remarks: `Weight: ${item.weight}g`
          });
        }
      });
    });

    // Sort all transaction items chronologically
    ledgerItems.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.type === "IN" ? -1 : 1; // Put credits/inflows before debits/outflows
    });

    // Compute total IN and total OUT for selected account
    let totalIn = 0;
    let totalOut = 0;
    ledgerItems.forEach((item) => {
      if (item.type === "IN") {
        totalIn += item.amount;
      } else {
        totalOut += item.amount;
      }
    });

    // Determine target closing balance from last daybook
    const lastDb = daybooks[daybooks.length - 1];
    let targetClosingBalance = 0;
    if (selectedAccount === "CASH") {
      targetClosingBalance = lastDb.closing_cash;
    } else if (selectedAccount === "OTHER") {
      targetClosingBalance = lastDb.closing_other;
    } else {
      try {
        const upiDetails = JSON.parse(lastDb.closing_upi_details || "{}");
        targetClosingBalance = upiDetails[selectedAccount] || 0;
      } catch {
        targetClosingBalance = 0;
      }
    }

    // Mathematically derive exact Starting Carry-Forward Balance relative to current closing balance
    const startingBalance = targetClosingBalance - totalIn + totalOut;

    // Compute running balances
    let currentBalance = startingBalance;
    const itemsWithRunningBal = ledgerItems.map((item) => {
      if (item.type === "IN") {
        currentBalance += item.amount;
      } else {
        currentBalance -= item.amount;
      }
      return {
        ...item,
        runningBalance: currentBalance
      };
    });

    return {
      items: itemsWithRunningBal,
      startBal: startingBalance,
      endBal: targetClosingBalance,
      totalIn,
      totalOut
    };
  };

  const ledger = compileLedger();

  // Filter based on search term
  const filteredItems = ledger.items.filter((item) => {
    const rawSearch = searchTerm.toLowerCase();
    return (
      item.particulars.toLowerCase().includes(rawSearch) ||
      item.partyName.toLowerCase().includes(rawSearch) ||
      item.amount.toString().includes(rawSearch) ||
      item.date.includes(rawSearch)
    );
  });

  // Calculate current balances of all accounts for the summary cards
  const getAccountBalances = () => {
    if (daybooks.length === 0) return ACCOUNTS.map(a => ({ ...a, balance: 0 }));

    const lastDb = daybooks[daybooks.length - 1];
    let upiDetails: Record<string, number> = {};
    try {
      upiDetails = JSON.parse(lastDb.closing_upi_details || "{}");
    } catch {}

    return ACCOUNTS.map((acc) => {
      let bal = 0;
      if (acc.key === "CASH") {
        bal = lastDb.closing_cash;
      } else if (acc.key === "OTHER") {
        bal = lastDb.closing_other;
      } else {
        bal = upiDetails[acc.key] || 0;
      }
      return {
        ...acc,
        balance: bal
      };
    });
  };

  const balances = getAccountBalances();

  const handlePrint = () => {
    const printContent = document.getElementById("bank-ledger-print-area");
    if (!printContent) return;
    
    const style = document.createElement("style");
    style.innerHTML = `
      @media print {
        body { background: white; color: black; font-family: Georgia, serif; padding: 20px; }
        .no-print { display: none !important; }
        .print-only { display: block !important; }
        .ledger-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .ledger-table th, .ledger-table td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 11px; }
        .ledger-table th { background: #f5f5f5; font-weight: bold; }
        .color-green { color: green !important; font-weight: bold; }
        .color-red { color: red !important; font-weight: bold; }
        .print-header { text-align: center; border-bottom: 2px solid #2d1b0e; padding-bottom: 10px; margin-bottom: 20px; }
        .print-title { font-size: 18px; font-weight: bold; color: #2d1b0e; margin-bottom: 5px; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  const activeAccLabel = ACCOUNTS.find(a => a.key === selectedAccount)?.label || selectedAccount;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 md:px-4 py-2">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black font-serif text-amber-955">
            Cash & Bank Books
          </h2>
          <p className="text-xs font-serif text-amber-900/60 mt-0.5">
            Summaries and running statements of all cash and bank/UPI accounts
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-amber-100 shadow-sm print:hidden">
          <Calendar size={14} className="text-amber-800" />
          <input 
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs font-bold text-amber-950 focus:outline-none bg-transparent cursor-pointer"
          />
          <span className="text-amber-900/40 text-xs">to</span>
          <input 
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs font-bold text-amber-950 focus:outline-none bg-transparent cursor-pointer"
          />
          <button 
            onClick={loadData}
            className={`p-1.5 rounded-lg text-amber-850 hover:bg-amber-50 transition-colors ml-1 ${loading ? "animate-spin" : ""}`}
            title="Reload ledger data"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {offlineMode && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-850 rounded-2xl p-3.5 text-xs shadow-sm">
          <AlertCircle size={16} />
          <span><b>Offline Mode Enabled</b>: Showing data loaded from your local browser cache. Make sure the backend server is running for real-time summaries.</span>
        </div>
      )}

      {/* ACCOUNT BALANCES SUMMARY SUMMARY GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 print:hidden">
        {balances.map((acc) => (
          <div
            key={acc.key}
            onClick={() => setSelectedAccount(acc.key)}
            className={`flex flex-col gap-1.5 rounded-2xl p-4 border transition-all cursor-pointer shadow-xs ${
              selectedAccount === acc.key
                ? "bg-amber-950 text-white border-amber-950 transform scale-102 shadow-md"
                : "bg-white text-amber-950 border-amber-100 hover:bg-amber-50/50 hover:border-amber-200"
            }`}
          >
            <div className="flex justify-between items-start">
              <span className={`text-[10px] uppercase font-bold tracking-wider ${selectedAccount === acc.key ? "text-amber-200" : "text-amber-800/60"}`}>
                {acc.type === "CASH" ? "Drawer" : acc.type === "UPI" ? "Bank/UPI" : "Other"}
              </span>
              {acc.type === "CASH" ? (
                <Wallet size={14} className={selectedAccount === acc.key ? "text-amber-200" : "text-amber-850"} />
              ) : (
                <Landmark size={14} className={selectedAccount === acc.key ? "text-amber-200" : "text-amber-850"} />
              )}
            </div>
            <span className="text-xs font-serif font-extrabold truncate max-w-[130px]" title={acc.label}>
              {acc.label}
            </span>
            <span className="text-[15px] font-mono font-black mt-1">
              {formatCurrency(acc.balance)}
            </span>
          </div>
        ))}
      </div>

      {/* DETAILED STATEMENTS LOG */}
      <div className="bg-white rounded-3xl border border-amber-100 shadow-sm p-4 md:p-6 space-y-4">
        
        {/* Table Filter controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 print:hidden">
          <div className="flex items-center gap-2 bg-amber-900/5 px-3 py-2 rounded-xl border border-amber-900/10 w-full sm:max-w-xs">
            <Search size={14} className="text-amber-900/40" />
            <input 
              type="text"
              placeholder="Search statements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-xs bg-transparent focus:outline-none w-full text-amber-955 font-medium"
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-100 hover:bg-amber-200 border border-amber-900/15 text-amber-950 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer size={13} /> Print Statement
            </button>
          </div>
        </div>

        {/* printable content area */}
        <div id="bank-ledger-print-area" className="w-full">
          {/* Header block only visible when printing */}
          <div className="hidden print:block print-header">
            <div className="print-title">Pooja Jewellers Day Book Statements</div>
            <div className="text-xs italic" style={{ color: "#555" }}>
              Ledger Account: {activeAccLabel} | Period: {formatDateDMY(startDate)} to {formatDateDMY(endDate)}
            </div>
          </div>

          {/* Account Summary strip */}
          <div className="bg-amber-900/5 rounded-2xl border border-amber-900/10 p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-serif text-amber-950">
            <div className="space-y-0.5">
              <span className="text-amber-900/60 font-semibold block text-[10px] uppercase tracking-wider">Starting Balance</span>
              <span className="font-mono font-black text-sm">{formatCurrency(ledger.startBal)}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-emerald-800/80 font-semibold block text-[10px] uppercase tracking-wider">Total Received (In)</span>
              <span className="font-mono font-black text-sm text-emerald-800">+{formatCurrency(ledger.totalIn)}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-red-800/80 font-semibold block text-[10px] uppercase tracking-wider">Total Paid (Out)</span>
              <span className="font-mono font-black text-sm text-red-800">-{formatCurrency(ledger.totalOut)}</span>
            </div>
            <div className="space-y-0.5">
              <span className="text-amber-900/60 font-semibold block text-[10px] uppercase tracking-wider">Closing Balance</span>
              <span className="font-mono font-black text-base text-amber-950">{formatCurrency(ledger.endBal)}</span>
            </div>
          </div>

          {/* Passbook ledger table */}
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-xs text-amber-900/40 italic font-serif">
              No transactions recorded for this account in the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-left border-collapse ledger-table">
                <thead>
                  <tr className="border-b border-amber-100 text-[10px] font-bold text-amber-900/60 uppercase tracking-wider bg-amber-50/30">
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Particulars / Details</th>
                    <th className="py-3 px-3">Party / Ref</th>
                    <th className="py-3 px-3 text-right">Received (IN)</th>
                    <th className="py-3 px-3 text-right">Paid (OUT)</th>
                    <th className="py-3 px-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-50/50 text-[11px] font-serif text-amber-955">
                  {/* Opening Balance Row */}
                  <tr className="bg-slate-50/50 font-bold">
                    <td className="py-3.5 px-3 font-mono text-amber-900/60">{formatDateDMY(startDate)}</td>
                    <td className="py-3.5 px-3 uppercase tracking-wide">Starting Carry-Forward Balance</td>
                    <td className="py-3.5 px-3">—</td>
                    <td className="py-3.5 px-3 text-right text-emerald-700">—</td>
                    <td className="py-3.5 px-3 text-right text-red-700">—</td>
                    <td className="py-3.5 px-3 text-right font-mono">{formatCurrency(ledger.startBal)}</td>
                  </tr>

                  {/* Transaction Rows */}
                  {filteredItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3.5 px-3 font-mono text-amber-900/80">{formatDateDMY(item.date)}</td>
                      <td className="py-3.5 px-3">
                        <span className="font-semibold block">{item.particulars}</span>
                        {item.remarks && <span className="text-[9px] text-amber-900/50 font-mono block mt-0.5">*{item.remarks}</span>}
                      </td>
                      <td className="py-3.5 px-3 font-semibold font-sans">{item.partyName}</td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700 color-green">
                        {item.type === "IN" ? `+${formatCurrency(item.amount)}` : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold text-red-700 color-red">
                        {item.type === "OUT" ? `-${formatCurrency(item.amount)}` : "—"}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-extrabold text-amber-955">
                        {formatCurrency(item.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
