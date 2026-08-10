"use client";

import React, { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import {
  Calendar, ArrowLeft, ArrowRight, Download, Upload,
  RefreshCw, FileText, CheckCircle2, TrendingUp,
  BookOpen, LayoutDashboard, Settings, LogOut,
  ChevronLeft, ChevronRight, Wallet, Coins, Smartphone,
  BarChart3, Menu, X, CloudOff, CloudCheck, Plus, ShoppingCart, Package,
  Archive, FolderOpen, Users, History, Calculator, Landmark, ShieldCheck,
} from "lucide-react";
import {
  DayBook, fetchDayBook, syncOfflineQueue, PledgeEntry, saveDayBookCash, SoldItem, fetchAllSoldItems,
  OldGoldEntry, OldSilverEntry, downloadDatabaseBackup, restoreDatabaseBackup, API_BASE,
} from "../utils/api";
import { exportBackup, importBackup } from "../utils/backup";
import { exportToPDF } from "../utils/pdf";
import { fetchInternetTime, getSyncedDate, getSyncedDateString, getIsInternetTimeSynced, checkSystemVsGoogleTime, TimeCheckResult } from "../utils/timeUtils";
import DiaryPage from "../components/DiaryPage";
import LuxuryLogin from "../components/LuxuryLogin";
import OpeningSetupModal from "../components/OpeningSetupModal";
import GirviLedgerView from "../components/GirviLedgerView";
import PledgeFormView from "../components/PledgeFormView";
import SalesLedgerView from "../components/SalesLedgerView";
import SaleFormView from "../components/SaleFormView";
import PurchaseBillView from "../components/PurchaseBillView";
import PurchaseLedgerView from "../components/PurchaseLedgerView";
import StockRegisterView from "../components/StockRegisterView";
import PurchasePartyView from "../components/PurchasePartyView";
import SystemLogsView from "../components/SystemLogsView";
import BankLedgerView from "../components/BankLedgerView";
import BankRePledgeLedgerView from "../components/BankRePledgeLedgerView";
import AavakJaavakView from "../components/AavakJaavakView";
import BackupAuditView from "../components/BackupAuditView";
import TimeSyncModal from "../components/TimeSyncModal";
import SystemTimeAlertModal from "../components/SystemTimeAlertModal";




// ─── helpers ───────────────────────────────────────────────────────────────
const fmt = (val: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(val);

const fmtDateFriendly = (d: string) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";

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


// ─── Sidebar nav items ──────────────────────────────────────────────────────
const NAV = [
  { id: "daybook", icon: BookOpen, label: "Day Book", active: true },
  { id: "aavak_jaavak", icon: TrendingUp, label: "Given & Taken", active: false },
  { id: "bank_ledger", icon: Wallet, label: "Bank Ledger", active: false },
  { id: "bank_repledge", icon: Landmark, label: "Bank Re-Pledge", active: false },

  { id: "pledge_form", icon: Plus, label: "Girvi Form", active: false },
  { id: "pledges", icon: Coins, label: "Girvi Ledger", active: false },
  { id: "existing_girvi", icon: Plus, label: "Existing Girvi", active: false },
  { id: "sale_form", icon: ShoppingCart, label: "Sale Form", active: false },
  { id: "sales", icon: TrendingUp, label: "Sales Ledger", active: false },
  { id: "purchase_bill", icon: Package, label: "Purchase Bill", active: false },
  { id: "purchase_ledger", icon: FolderOpen, label: "Purchase Ledger", active: false },
  { id: "purchase_parties", icon: Users, label: "Purchase Party", active: false },
  { id: "stock_register", icon: Archive, label: "Stock Register", active: false },
  { id: "backup_audit", icon: ShieldCheck, label: "Data & Backups", active: false },
  { id: "system_logs", icon: History, label: "System Logs", active: false },
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", active: false },
  { id: "reports", icon: BarChart3, label: "Reports", active: false },
  { id: "settings", icon: Settings, label: "Settings", active: false },
];

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, color, sub,
}: { label: string; value: string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div
      className="flex flex-col gap-1 rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: "white",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      <div
        className="absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-10"
        style={{ background: color }}
      />
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: color + "20" }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: "#9E8B78" }}>{label}</span>
      </div>
      <span className="font-black text-lg font-mono" style={{ color: "#2D1B0E" }}>{value}</span>
      {sub && <span className="text-[10px] font-medium" style={{ color: "#C8A87A" }}>{sub}</span>}
    </div>
  );
}

function numberToWordsIndian(num: number): string {
  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function g(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
  }

  function h(n: number): string {
    if (n === 0) return "";
    let str = "";
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + " Hundred";
      const rem = n % 100;
      if (rem) str += " and " + g(rem);
    } else {
      str += g(n);
    }
    return str;
  }

  const integerPart = Math.floor(num);
  if (integerPart === 0) return "Zero Rupees Only";

  let result = "";
  const crores = Math.floor(integerPart / 10000000);
  let rem = integerPart % 10000000;
  const lakhs = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousands = Math.floor(rem / 1000);
  rem = rem % 1000;
  const hundreds = rem;

  if (crores > 0) result += h(crores) + " Crore ";
  if (lakhs > 0) result += h(lakhs) + " Lakh ";
  if (thousands > 0) result += h(thousands) + " Thousand ";
  if (hundreds > 0) result += h(hundreds);

  result = result.trim() + " Rupees";

  const paisa = Math.round((num - integerPart) * 100);
  if (paisa > 0) {
    result += " and " + g(paisa) + " Paise";
  }
  return result + " Only";
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const [timeCheckResult, setTimeCheckResult] = useState<TimeCheckResult | null>(null);
  const [timeChecking, setTimeChecking] = useState<boolean>(true);
  const [timeAlertConfirmed, setTimeAlertConfirmed] = useState<boolean>(false);

  const runSystemTimeCheck = async () => {
    setTimeChecking(true);
    const res = await checkSystemVsGoogleTime();
    setTimeCheckResult(res);
    setTimeChecking(false);
  };

  useEffect(() => {
    runSystemTimeCheck();
  }, []);

  const [currentDate, setCurrentDate] = useState<string>(() => getSyncedDateString());
  const [daybook, setDaybook] = useState<DayBook | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [showTimeSyncModal, setShowTimeSyncModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [selectedPrintPledge, setSelectedPrintPledge] = useState<PledgeEntry | null>(null);
  const [printBackSide, setPrintBackSide] = useState<boolean>(false);
  const [selectedPrintBill, setSelectedPrintBill] = useState<SoldItem | null>(null);
  const [billType, setBillType] = useState<"estimate" | "gst">("gst");
  const [billCustomerName, setBillCustomerName] = useState("");
  const [billCustomerMobile, setBillCustomerMobile] = useState("");
  const [billCustomerAddress, setBillCustomerAddress] = useState("");
  const [billItemName, setBillItemName] = useState("");
  const [billWeight, setBillWeight] = useState("");
  const [billQuantity, setBillQuantity] = useState("1");
  const [billTotalAmount, setBillTotalAmount] = useState("");
  const [billMetal, setBillMetal] = useState<"GOLD" | "SILVER">("GOLD");
  const [billDate, setBillDate] = useState("");
  const [billRatePerGram, setBillRatePerGram] = useState("");
  const [billWastage, setBillWastage] = useState("");
  const [billMaking, setBillMaking] = useState("");
  const [billCustomerAadhar, setBillCustomerAadhar] = useState("");
  const [billCustomerPan, setBillCustomerPan] = useState("");
  const [billInvoiceNo, setBillInvoiceNo] = useState("");
  const [billBookNo, setBillBookNo] = useState("");
  const [billPurity, setBillPurity] = useState("");
  const [billItems, setBillItems] = useState<SoldItem[]>([]);
  const [billOldGoldItems, setBillOldGoldItems] = useState<OldGoldEntry[]>([]);
  const [billOldSilverItems, setBillOldSilverItems] = useState<OldSilverEntry[]>([]);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [billCashAmount, setBillCashAmount] = useState(0);
  const [billUpiAmount, setBillUpiAmount] = useState(0);
  const [billOtherAmount, setBillOtherAmount] = useState(0);

  // Bank and Shop configuration states
  const [billBankName, setBillBankName] = useState("HDFC Bank");
  const [billBankBranch, setBillBankBranch] = useState("Budigere");
  const [billBankAccountNo, setBillBankAccountNo] = useState("5020000192192");
  const [billBankIfsc, setBillBankIfsc] = useState("HDFC0000192");
  const [billGstin, setBillGstin] = useState("29AXMPS9006P1ZF");
  const [billPropName, setBillPropName] = useState("Shankar Lal");

  // Fetch daybook for the selected print bill date if not currently active
  useEffect(() => {
    if (selectedPrintBill && selectedPrintBill.date) {
      if (!daybook || daybook.date !== selectedPrintBill.date) {
        fetchDayBook(selectedPrintBill.date).then(res => {
          if (res && res.data) {
            setDaybook(res.data);
          }
        });
      }
    }
  }, [selectedPrintBill]);

  useEffect(() => {
    if (selectedPrintBill) {
      let name = selectedPrintBill.item_name || "";
      const metal = name.includes("SILVER") ? "SILVER" : "GOLD";

      // Parse customer metadata
      let custName = "";
      let custMobile = "";
      let custAddress = "";
      let custAadhar = "";
      let custPan = "";
      const custMatch = name.match(/\[CUST:([^\]]+)\]/);
      if (custMatch) {
        const parts = custMatch[1].split("|");
        custName = parts[0] || "";
        custMobile = parts[1] || "";
        custAddress = parts[2] || "";
        custAadhar = parts[3] || "";
        custPan = parts[4] || "";
      }

      // Grouped items: find all items belonging to this exact bill transaction in the daybook
      let grouped: SoldItem[] = [];
      let groupedOldGold: OldGoldEntry[] = [];
      let groupedOldSilver: OldSilverEntry[] = [];

      const billMatch = name.match(/\[BILL:([^\]]+)\]/);
      const invMatch = name.match(/\[INV:([^\]]+)\]/);

      if (daybook) {
        if (billMatch) {
          const billPattern = billMatch[0];
          if (daybook.sold_items) {
            grouped = daybook.sold_items.filter(item => item.item_name.includes(billPattern));
          }
        } else if (invMatch) {
          const invPattern = invMatch[0];
          if (daybook.sold_items) {
            grouped = daybook.sold_items.filter(item => item.item_name.includes(invPattern));
          }
        } else if (custMatch) {
          const parts = custMatch[1].split("|");
          const custNamePart = parts[0]?.trim();
          if (custNamePart) {
            const custPattern = custMatch[0];
            if (daybook.sold_items) {
              grouped = daybook.sold_items.filter(item => item.item_name.includes(custPattern));
            }
          }
        }

        if (custMatch) {
          const custPattern = custMatch[0];
          if (daybook.old_gold_entries) {
            groupedOldGold = daybook.old_gold_entries.filter(item => item.customer_name.includes(custPattern));
          }
          if (daybook.old_silver_entries) {
            groupedOldSilver = daybook.old_silver_entries.filter(item => item.customer_name.includes(custPattern));
          }
        }
      }

      if (grouped.length === 0) {
        grouped = [selectedPrintBill];
      }
      setBillItems(grouped);
      setBillOldGoldItems(groupedOldGold);
      setBillOldSilverItems(groupedOldSilver);

      // Parse price metadata
      let rate = "";
      let wastage = "";
      let making = "";
      let purity = "";
      const priceMatch = name.match(/\[PRICE:([^\]]+)\]/);
      if (priceMatch) {
        const parts = priceMatch[1].split("|");
        rate = parts[0] || "";
        wastage = parts[1] || "";
        making = parts[2] || "";
        purity = parts[3] || "";
      }

      // Parse SPLIT payment metadata — format: [SPLIT:C<cash>:U<upi>:O<other>]
      const splitMatch = name.match(/\[SPLIT:C([\d.]+):U([\d.]+):O([\d.]+)\]/);
      if (splitMatch) {
        setBillCashAmount(parseFloat(splitMatch[1]) || 0);
        setBillUpiAmount(parseFloat(splitMatch[2]) || 0);
        setBillOtherAmount(parseFloat(splitMatch[3]) || 0);
      } else {
        setBillCashAmount(0);
        setBillUpiAmount(0);
        setBillOtherAmount(0);
      }

      // Parse INVOICE & BOOK metadata
      const typeMatch = name.match(/\[TYPE:([^\]]+)\]/);
      const isGst = typeMatch ? typeMatch[1].trim().toUpperCase() === "GST" : name.includes("[GST]");

      let invNo = invMatch ? invMatch[1].trim() : "";

      const bookMatch = name.match(/\[BOOK:([^\]]+)\]/);
      let bookNo = bookMatch ? bookMatch[1].trim() : "";

      // Clean item name
      name = name
        .replace(/^\[(GOLD|SILVER)\]\s*/i, "")
        .replace(/\[SPLIT:[^\]]+\]\s*/i, "")
        .replace(/\[CUST:[^\]]+\]\s*/i, "")
        .replace(/\[INV:[^\]]+\]\s*/i, "")
        .replace(/\[BOOK:[^\]]+\]\s*/i, "")
        .replace(/\[PRICE:[^\]]+\]\s*/i, "")
        .replace(/\[BARCODE:[^\]]+\]\s*/i, "")
        .trim();

      setBillItemName(name);
      setBillWeight(selectedPrintBill.weight ? selectedPrintBill.weight.toString() : "");
      setBillQuantity(selectedPrintBill.quantity ? selectedPrintBill.quantity.toString() : "1");
      setBillTotalAmount(selectedPrintBill.amount ? selectedPrintBill.amount.toString() : "");
      setBillMetal(metal);
      setBillCustomerName(custName);
      setBillCustomerMobile(custMobile);
      setBillCustomerAddress(custAddress);
      setBillCustomerAadhar(custAadhar);
      setBillCustomerPan(custPan);
      setBillInvoiceNo(invNo);
      setBillBookNo(bookNo);
      setBillPurity(purity);
      setBillRatePerGram(rate);
      setBillWastage(wastage);
      setBillMaking(making);
      setBillDate(selectedPrintBill.date || currentDate || new Date().toISOString().split("T")[0]);
      setBillType("gst");
    }
  }, [selectedPrintBill, currentDate, daybook]);

  const isMultiItem = billItems.length > 1;
  const totalVal = isMultiItem
    ? billItems.reduce((sum, item) => sum + (item.amount || 0), 0)
    : (parseFloat(billTotalAmount) || 0);
  const weightVal = parseFloat(billWeight) || 0;
  const rateVal = parseFloat(billRatePerGram) || 0;
  const wastageVal = parseFloat(billWastage) || 0;
  const makingVal = parseFloat(billMaking) || 0;

  const calculatedBase = totalVal / 1.03;
  const cgstVal = Math.round(calculatedBase * 0.015 * 100) / 100;
  const sgstVal = Math.round(calculatedBase * 0.015 * 100) / 100;
  const baseAmount = Math.round((totalVal - cgstVal - sgstVal) * 100) / 100;

  const oldExchangeTotal = [...billOldGoldItems, ...billOldSilverItems].reduce((sum, item) => sum + item.amount, 0);
  const netPayableVal = Math.max(0, totalVal - oldExchangeTotal);

  // Generate dynamic QR Code for Invoice Verification
  useEffect(() => {
    if (selectedPrintBill) {
      const activeInvNo = billInvoiceNo || "—";
      const activeClient = billCustomerName || "Cash Customer";
      const activeDate = billDate || selectedPrintBill.date || "";
      const activeTotal = netPayableVal || selectedPrintBill.amount || 0;

      const qrPayload = `POOJA JEWELLERS - SALE INVOICE\nInvoice No: ${activeInvNo}\nBook No: ${billBookNo || '—'}\nDate: ${activeDate}\nClient: ${activeClient}\nNet Amount: ₹${activeTotal.toFixed(2)}\nGSTIN: ${billGstin}\nStatus: VERIFIED PAID`;

      QRCode.toDataURL(qrPayload, {
        width: 140,
        margin: 1,
        color: {
          dark: "#0b5c33",
          light: "#ffffff",
        },
      })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error("Failed to generate invoice QR Code:", err));
    }
  }, [selectedPrintBill, billInvoiceNo, billBookNo, billDate, billCustomerName, netPayableVal, billGstin]);

  const rawMetalValue = weightVal * rateVal;
  const computedWastageAndMaking = rateVal > 0 ? Math.max(0, baseAmount - rawMetalValue) : 0;
  const displayRate = rateVal > 0 ? rateVal : (weightVal > 0 ? (baseAmount / weightVal) : 0);

  const ratePerGram = displayRate;

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showSetup, setShowSetup] = useState<boolean>(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<string>("daybook");
  const [currentTime, setCurrentTime] = useState(() => getSyncedDate());

  // Global Interest Calculator States
  const [showGlobalCalcModal, setShowGlobalCalcModal] = useState<boolean>(false);
  const [calcAmount, setCalcAmount] = useState<string>("");
  const [calcPledgeDate, setCalcPledgeDate] = useState<string>("");
  const [calcReleaseDate, setCalcReleaseDate] = useState<string>("");
  const [calcMetal, setCalcMetal] = useState<"GOLD" | "SILVER">("GOLD");
  const [calcResult, setCalcResult] = useState<{ months: number; days: number; chargeMonths: number; interest: number; total: number } | null>(null);

  // Sync calculator dates with current date when current date changes
  useEffect(() => {
    const todayStr = currentDate || getSyncedDateString();
    setCalcPledgeDate(todayStr);
    setCalcReleaseDate(todayStr);
  }, [currentDate]);

  // Global Interest Calculation Logic
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

    // Custom Rounding Logic with Grace Days:
    // 1. If remaining days > graceDays:
    //    - If remaining days > 7, we round up to next full month (months + 1).
    //    - If remaining days <= 7:
    //       - If months is 0, charge minimum of 1 month.
    //       - Otherwise, charge completed months (months).
    // 2. If remaining days <= graceDays:
    //    - If months is 0, charge minimum of 1 month.
    //    - Otherwise, charge completed months (months).
    const storedGoldRate = typeof window !== "undefined" ? localStorage.getItem("gold_interest_rate") : null;
    const storedSilverRate = typeof window !== "undefined" ? localStorage.getItem("silver_interest_rate") : null;
    const storedGraceDays = typeof window !== "undefined" ? localStorage.getItem("grace_days") : null;

    const goldRateVal = storedGoldRate ? parseFloat(storedGoldRate) / 100 : 0.03;
    const silverRateVal = storedSilverRate ? parseFloat(storedSilverRate) / 100 : 0.10;
    const graceDaysVal = storedGraceDays ? parseInt(storedGraceDays, 10) : 0;

    let chargeMonths = months;
    if (months === 0) {
      chargeMonths = 1;
    } else {
      if (days > graceDaysVal) {
        if (days > 7) {
          chargeMonths += 1;
        }
      }
    }

    const ratePerMonth = calcMetal === "SILVER" ? silverRateVal : goldRateVal;
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

  // Prevent number inputs from changing on scroll/wheel
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (
        document.activeElement &&
        document.activeElement.tagName === "INPUT" &&
        (document.activeElement as HTMLInputElement).type === "number"
      ) {
        (document.activeElement as HTMLInputElement).blur();
      }
    };
    document.addEventListener("wheel", handleWheel);
    return () => {
      document.removeEventListener("wheel", handleWheel);
    };
  }, []);

  // Global Keyboard Shortcuts (Ctrl+S, Ctrl+P, Ctrl+D)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (!isCtrl) return;

      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        setActiveNav("sale_form");
        showNotification("Switched to New Sale Form via Shortcut", "success");
      } else if (key === "p") {
        e.preventDefault();
        setActiveNav("pledge_form");
        showNotification("Switched to New Girvi Form via Shortcut", "success");
      } else if (key === "d") {
        e.preventDefault();
        setActiveNav("daybook");
        showNotification("Switched to Day Book via Shortcut", "success");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState<boolean>(false);

  interface LiveRates {
    gold_24k: string;
    gold_22k: string;
    gold_18k: string;
    silver: string;
  }
  const [liveRates, setLiveRates] = useState<LiveRates | null>(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        const res = await fetch(`${API_BASE}/live-rates`);
        if (res.ok) {
          const data = await res.json();
          setLiveRates(data);
        }
      } catch (err) {
        console.warn("Could not fetch live rates:", err);
      }
    };
    fetchRates();
    const interval = setInterval(fetchRates, 600000); // every 10 minutes
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Live clock (synced with Internet IST)
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(getSyncedDate()), 1000);
    return () => clearInterval(id);
  }, []);

  // Global Fetch Interceptor to inject JWT token
  useEffect(() => {
    if (typeof window === "undefined") return;
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const token = localStorage.getItem("pooja_daybook_token");
      if (token) {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        init.headers = headers;
      }
      return originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Check auth + first-time setup + server run ID check
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkServerRunId = async () => {
      try {
        const res = await fetch(`${API_BASE}/system/run-id`);
        if (!res.ok) return;
        const data = await res.json();
        const runId = data.run_id;
        const storedRunId = localStorage.getItem("pooja_daybook_server_run_id");

        if (storedRunId && storedRunId !== runId) {
          // Server restarted! Force logout
          localStorage.removeItem("pooja_daybook_auth");
          localStorage.removeItem("pooja_daybook_token");
          setIsAuthenticated(false);
          showNotification("Server restarted. Please log in again.", "info");
        }
        localStorage.setItem("pooja_daybook_server_run_id", runId);
      } catch (err: any) {
        console.warn("Could not check server run ID:", err.message || err);
      }
    };

    // Run check immediately
    checkServerRunId();

    if (localStorage.getItem("pooja_daybook_auth") === "true") {
      setIsAuthenticated(true);
      // Check if this is first-time use (no opening balance ever set)
      if (localStorage.getItem("pooja_daybook_setup_done") !== "true") {
        fetch(`${API_BASE}/setup/is-first-time`)
          .then(r => r.json())
          .then(data => { if (data.first_time) setShowSetup(true); })
          .catch(() => { }); // ignore if backend down
      }
    }

    // Check server run ID every 5 seconds to detect restarts in real-time
    const interval = setInterval(checkServerRunId, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) return false;

      const data = await res.json();
      const token = data.access_token;

      localStorage.setItem("pooja_daybook_token", token);
      localStorage.setItem("pooja_daybook_auth", "true");
      setIsAuthenticated(true);

      // Check first-time setup after login
      if (localStorage.getItem("pooja_daybook_setup_done") !== "true") {
        const setupRes = await fetch(`${API_BASE}/setup/is-first-time`);
        if (setupRes.ok) {
          const setupData = await setupRes.json();
          if (setupData.first_time) setShowSetup(true);
        }
      }
      return true;
    } catch (err) {
      console.error("Login request error:", err);
      return false;
    }
  };

  // Handle opening balance setup completion
  const handleSetupComplete = async (cash: number, upi: number, other: number, upiDetails?: string) => {
    if (!currentDate) return;
    const res = await fetchDayBook(currentDate);
    const db = res.data;
    const isNew = !db || (!db.debit_entries?.length && !db.credit_entries?.length && !db.sold_items?.length && !db.phonepe_entries?.length && !db.pledge_entries?.length && !db.release_entries?.length);
    await saveDayBookCash(
      db.id, currentDate,
      cash, upi, other,
      isNew ? cash : db.closing_cash,
      isNew ? upi : db.closing_upi,
      isNew ? other : db.closing_other,
      upiDetails,
      isNew ? upiDetails : undefined
    );
    localStorage.setItem("pooja_daybook_setup_done", "true");
    setShowSetup(false);
    showNotification("Opening balance saved! Aaj ka hisaab shuru karo. 🙏", "success");
    loadDayBookData(currentDate);
  };

  // Verify password before allowing opening balance edit
  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput.toLowerCase() === "pooja" || passwordInput === "pooja123") {
      setShowPasswordPrompt(false);
      setPasswordInput("");
      setPasswordError("");
      setShowSetup(true); // Open setup modal
    } else {
      setPasswordError("Incorrect password. Please try again!");
    }
  };

  // Internet IST Date & Time sync on mount & periodic re-sync
  useEffect(() => {
    const syncTime = async () => {
      const info = await fetchInternetTime();
      if (info) {
        setCurrentDate((prev) => prev || info.date);
        setCurrentTime(getSyncedDate());
      } else {
        setCurrentDate((prev) => prev || getSyncedDateString());
        setCurrentTime(getSyncedDate());
      }
    };

    syncTime();
    const interval = setInterval(syncTime, 60000); // re-sync every 1 min
    return () => clearInterval(interval);
  }, []);

  // Load daybook
  const loadDayBookData = async (dateStr: string) => {
    if (!dateStr) return;
    const res = await fetchDayBook(dateStr);
    setDaybook(res.data);
    setIsSynced(res.synced);
  };

  useEffect(() => {
    if (currentDate && isAuthenticated) loadDayBookData(currentDate);
  }, [currentDate, isAuthenticated]);

  // Auto-sync
  useEffect(() => {
    const interval = setInterval(async () => {
      if (navigator.onLine && isAuthenticated) {
        try {
          const count = await syncOfflineQueue();
          if (count > 0) {
            showNotification(`Synced ${count} offline records`, "success");
            if (currentDate) loadDayBookData(currentDate);
          }
        } catch (e: any) {
          console.warn("Auto-sync interval error:", e.message || e);
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [currentDate, isAuthenticated]);

  function showNotification(message: string, type: "success" | "info" | "error" = "info") {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  }

  const changeDate = (days: number) => {
    if (!currentDate) return;
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setCurrentDate(d.toISOString().split("T")[0]);
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.targetTouches[0].clientX; };
  const handleTouchMove = (e: React.TouchEvent) => { touchEndX.current = e.targetTouches[0].clientX; };
  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const dist = touchStartX.current - touchEndX.current;
    if (dist > 75) changeDate(1);
    else if (dist < -75) changeDate(-1);
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await importBackup(file);
    showNotification(ok ? "Backup imported!" : "Import failed.", ok ? "success" : "error");
    if (ok && currentDate) loadDayBookData(currentDate);
  };

  const triggerPDFExport = async () => {
    if (!currentDate) return;
    showNotification("Generating Day Book PDF…", "info");
    await exportToPDF("daybook-print-area", currentDate);
    showNotification("PDF Exported!", "success");
  };

  const triggerManualSync = async () => {
    setSyncing(true);
    showNotification("Syncing with cloud…", "info");
    const count = await syncOfflineQueue();
    setSyncing(false);
    showNotification(count > 0 ? `Synced ${count} records` : "All data up to date", "success");
    if (currentDate) loadDayBookData(currentDate);
  };

  // ── Calculations ──────────────────────────────────────────────────────────
  const parseSoldSplit = (name: string, totalAmount: number) => {
    const match = name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?\]/);
    if (match) return { cash: parseFloat(match[1]) || 0, upi: parseFloat(match[2]) || 0, other: parseFloat(match[3]) || 0 };
    return { cash: totalAmount, upi: 0, other: 0 };
  };

  const soldTotal = daybook?.sold_items.reduce((s, i) => s + i.amount, 0) || 0;
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
  const groupedSoldItems = getGroupedSoldItems(daybook?.sold_items || []);
  const soldCash = groupedSoldItems.reduce((s, i) => s + parseSoldSplit(i.item_name, i.amount).cash, 0);
  const soldUpi = groupedSoldItems.reduce((s, i) => s + parseSoldSplit(i.item_name, i.amount).upi, 0);
  const soldOther = groupedSoldItems.reduce((s, i) => s + parseSoldSplit(i.item_name, i.amount).other, 0);

  const pledgeTotal = daybook?.pledge_entries.reduce((s, i) => {
    const totalTopUps = (i.payments || []).filter(p => p.payment_type === "TOP_UP").reduce((sum, p) => sum + p.amount, 0);
    return s + (i.amount - totalTopUps);
  }, 0) || 0;
  const releaseTotal = daybook?.release_entries.reduce((s, i) => s + i.principal_amount, 0) || 0;
  const releaseInt = daybook?.release_entries.reduce((s, i) => s + i.interest_received, 0) || 0;
  const interestEarned = releaseInt;

  // Filter out auto-posted Girvi entries from page totals
  const filteredDebitEntries = daybook?.debit_entries.filter(item => {
    const nameLower = item.name.toLowerCase();
    const partLower = item.particulars.toLowerCase();
    return !nameLower.includes("girvi no.") && !partLower.includes("girvi pledge");
  }) || [];

  const filteredCreditEntries = daybook?.credit_entries.filter(item => {
    const nameLower = item.name.toLowerCase();
    const partLower = item.particulars.toLowerCase();
    return !nameLower.includes("chhudai no.") &&
      !nameLower.includes("banda no.") &&
      !partLower.includes("girvi release") &&
      !partLower.includes("girvi banda");
  }) || [];

  const bandaTotal = daybook?.credit_entries
    .filter(item => item.name.toLowerCase().includes("banda no.") || item.particulars.toLowerCase().includes("girvi banda"))
    .reduce((s, i) => s + i.amount, 0) || 0;

  const bandaCash = daybook?.credit_entries
    .filter(item => item.name.toLowerCase().includes("banda no.") || item.particulars.toLowerCase().includes("girvi banda"))
    .filter(i => !i.particulars.startsWith("[UPI") && !i.particulars.startsWith("[OTHER]"))
    .reduce((s, i) => s + i.amount, 0) || 0;

  const bandaUpi = daybook?.credit_entries
    .filter(item => item.name.toLowerCase().includes("banda no.") || item.particulars.toLowerCase().includes("girvi banda"))
    .filter(i => i.particulars.startsWith("[UPI"))
    .reduce((s, i) => s + i.amount, 0) || 0;

  const bandaOther = daybook?.credit_entries
    .filter(item => item.name.toLowerCase().includes("banda no.") || item.particulars.toLowerCase().includes("girvi banda"))
    .filter(i => i.particulars.startsWith("[OTHER]"))
    .reduce((s, i) => s + i.amount, 0) || 0;

  const debitTotal = (filteredDebitEntries.reduce((s, i) => s + i.amount, 0) || 0) + pledgeTotal;
  const creditTotal = (filteredCreditEntries.reduce((s, i) => s + i.amount, 0) || 0) + soldTotal + releaseTotal + interestEarned + bandaTotal;

  const isUpiEntry = (item: any) => {
    const combined = `${item.particulars || ''} ${item.remarks || ''} ${item.name || ''}`;
    return (
      combined.startsWith("[UPI") ||
      /\[UPI(?::[^\]]+)?\]/i.test(combined) ||
      /\[(hdfc_192|hdfc_od_7442|pooja_068|shankarlal_832|vikash|vikram|deepak|kavitha)\]/i.test(combined) ||
      /Payment Method:\s*(HDFC|HDFC_192|HDFC_OD|UPI)/i.test(combined) ||
      /\((HDFC Bank|HDFC OD|PhonePe|UPI)\)/i.test(combined)
    );
  };
  const isOtherEntry = (item: any) => {
    const combined = `${item.particulars || ''} ${item.remarks || ''} ${item.name || ''}`;
    return combined.startsWith("[OTHER]") || /Payment Method:\s*OTHER/i.test(combined);
  };

  const debitUPI = filteredDebitEntries.filter(i => isUpiEntry(i)).reduce((s, i) => s + i.amount, 0) || 0;
  const creditUPI = filteredCreditEntries.filter(i => isUpiEntry(i)).reduce((s, i) => s + i.amount, 0) || 0;
  const debitOther = filteredDebitEntries.filter(i => isOtherEntry(i)).reduce((s, i) => s + i.amount, 0) || 0;
  const creditOther = filteredCreditEntries.filter(i => isOtherEntry(i)).reduce((s, i) => s + i.amount, 0) || 0;

  const pledgeCash = daybook?.pledge_entries.reduce((sum, item) => {
    const totalTopUps = (item.payments || []).filter(p => p.payment_type === "TOP_UP").reduce((s, p) => s + p.amount, 0);
    const initialAmount = item.amount - totalTopUps;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[1]) || 0);
    if (!item.customer_name.startsWith("[UPI") && !item.customer_name.startsWith("[OTHER]")) return sum + initialAmount;
    return sum;
  }, 0) || 0;

  const pledgeUpi = daybook?.pledge_entries.reduce((sum, item) => {
    const totalTopUps = (item.payments || []).filter(p => p.payment_type === "TOP_UP").reduce((s, p) => s + p.amount, 0);
    const initialAmount = item.amount - totalTopUps;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[2]) || 0);
    if (item.customer_name.startsWith("[UPI")) return sum + initialAmount;
    return sum;
  }, 0) || 0;

  const pledgeOther = daybook?.pledge_entries.reduce((sum, item) => {
    const totalTopUps = (item.payments || []).filter(p => p.payment_type === "TOP_UP").reduce((s, p) => s + p.amount, 0);
    const initialAmount = item.amount - totalTopUps;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[3]) || 0);
    if (item.customer_name.startsWith("[OTHER]")) return sum + initialAmount;
    return sum;
  }, 0) || 0;

  const releaseCash = daybook?.release_entries.reduce((sum, item) => {
    const total = item.principal_amount + item.interest_received;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[1]) || 0);
    if (!item.customer_name.startsWith("[UPI") && !item.customer_name.startsWith("[OTHER]")) return sum + total;
    return sum;
  }, 0) || 0;

  const releaseUpi = daybook?.release_entries.reduce((sum, item) => {
    const total = item.principal_amount + item.interest_received;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[2]) || 0);
    if (item.customer_name.startsWith("[UPI")) return sum + total;
    return sum;
  }, 0) || 0;

  const releaseOther = daybook?.release_entries.reduce((sum, item) => {
    const total = item.principal_amount + item.interest_received;
    const match = item.customer_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A[^\]]*)?\]/);
    if (match) return sum + (parseFloat(match[3]) || 0);
    if (item.customer_name.startsWith("[OTHER]")) return sum + total;
    return sum;
  }, 0) || 0;

  const debitCash = filteredDebitEntries.filter(i => !isUpiEntry(i.particulars) && !isOtherEntry(i.particulars)).reduce((s, i) => s + i.amount, 0) || 0;
  const creditCash = filteredCreditEntries.filter(i => !isUpiEntry(i.particulars) && !isOtherEntry(i.particulars)).reduce((s, i) => s + i.amount, 0) || 0;
  const upiTotal = daybook?.phonepe_entries.reduce((s, i) => s + i.amount, 0) || 0;

  const totalUPIRec = upiTotal + creditUPI + releaseUpi + bandaUpi;
  const totalUPIGiven = debitUPI + pledgeUpi;
  const totalOtherRec = creditOther + soldOther + releaseOther + bandaOther;
  const totalOtherGiven = debitOther + pledgeOther;
  const cashRec = Math.max(0, creditCash + soldCash + releaseCash + bandaCash);
  const cashGiven = debitCash + pledgeCash;

  const openingCash = daybook?.opening_cash || 0;
  const openingUpi = daybook?.opening_upi || 0;
  const openingOther = daybook?.opening_other || 0;
  const openingTotal = openingCash + openingUpi + openingOther;

  const closingCash = openingCash + cashRec - cashGiven;
  const closingUpi = openingUpi + totalUPIRec - totalUPIGiven;
  const closingOther = openingOther + totalOtherRec - totalOtherGiven;
  const closingTotal = closingCash + closingUpi + closingOther;

  const goldSold = daybook?.sold_items.filter(i => i.item_name.includes("GOLD")).reduce((s, i) => s + i.weight, 0) || 0;
  const silverSold = daybook?.sold_items.filter(i => i.item_name.includes("SILVER")).reduce((s, i) => s + i.weight, 0) || 0;

  // ── Guard: System Time Check Alert (Before Login) ──────────────────────────────────
  if (!timeAlertConfirmed) {
    return (
      <SystemTimeAlertModal
        timeResult={timeCheckResult}
        loading={timeChecking}
        onContinue={() => setTimeAlertConfirmed(true)}
        onRestart={() => window.location.reload()}
        onRecheck={runSystemTimeCheck}
      />
    );
  }

  // ── Guard: Login ──────────────────────────────────────────────────────────
  if (!isAuthenticated) return <LuxuryLogin onLogin={handleLogin} />;

  // ── Sidebar width ─────────────────────────────────────────────────────────
  const SW = sidebarOpen ? 220 : 68;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F5F0E8", fontFamily: "'Segoe UI', sans-serif" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        @keyframes slide-down { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fade-in    { from { opacity:0; } to { opacity:1; } }
        .nav-item { transition: background 0.15s, color 0.15s; }
        .nav-item:hover { background: rgba(212,175,55,0.12); }
        .sidebar-transition { transition: width 0.25s cubic-bezier(0.4,0,0.2,1); }
        @media print {
          .print-hidden { display: none !important; }
        }
      `}</style>

      {/* ── Main App Content (hidden when printing modal overlay) ── */}
      <div className={`flex flex-col flex-1 ${selectedPrintPledge || selectedPrintBill ? "print:hidden" : ""}`}>
        {/* ════════════════════════════════
            TOP NAVBAR
        ════════════════════════════════ */}
        <header
        className="print-hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: 60,
          background: "white",
          borderBottom: "1px solid rgba(212,175,55,0.25)",
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
        }}
      >
        {/* Left: toggle + brand */}
        <div className="flex items-center gap-3">
          {/* sidebar toggle (desktop) */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="hidden md:flex w-9 h-9 rounded-xl items-center justify-center transition-colors hover:bg-amber-50"
            style={{ border: "1px solid rgba(212,175,55,0.2)" }}
          >
            <Menu size={18} style={{ color: "#8B6914" }} />
          </button>
          {/* mobile sidebar toggle */}
          <button
            onClick={() => setMobileSidebarOpen(v => !v)}
            className="flex md:hidden w-9 h-9 rounded-xl items-center justify-center transition-colors hover:bg-amber-50"
            style={{ border: "1px solid rgba(212,175,55,0.2)" }}
          >
            {mobileSidebarOpen ? <X size={18} style={{ color: "#8B6914" }} /> : <Menu size={18} style={{ color: "#8B6914" }} />}
          </button>

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-base shadow-sm"
              style={{ background: "linear-gradient(135deg,#c8960c,#D4AF37)" }}
            >
              ॐ
            </div>
            <div className="leading-tight hidden sm:block">
              <p className="font-black text-sm tracking-wide" style={{ color: "#2D1B0E", fontFamily: "Georgia, serif" }}>
                POTHA BAHI
              </p>
              <p className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: "#C8A87A" }}>
                Pooja Jewellers
              </p>
            </div>
          </div>
        </div>

        {/* Centre: Date navigator */}
        {["daybook", "pledges", "pledge_form", "existing_girvi", "sale_form"].includes(activeNav) && (
          <div
            className="h-9 flex items-center gap-1 px-3 rounded-xl"
            style={{ background: "#FFF9F0", border: "1px solid rgba(212,175,55,0.25)" }}
          >
            <button
              onClick={() => changeDate(-1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-amber-100 transition-colors"
            >
              <ChevronLeft size={16} style={{ color: "#8B6914" }} />
            </button>
            <div className="relative flex items-center gap-1.5 px-2 cursor-pointer">
              <Calendar size={13} style={{ color: "#D4AF37" }} />
              <span className="text-sm font-bold" style={{ color: "#2D1B0E", minWidth: 140, textAlign: "center" }}>
                {fmtDateFriendly(currentDate)}
              </span>
              <input
                type="date"
                value={currentDate}
                onChange={e => setCurrentDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
                title="Pick Date"
              />
            </div>
            <button
              onClick={() => changeDate(1)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-amber-100 transition-colors"
            >
              <ChevronRight size={16} style={{ color: "#8B6914" }} />
            </button>
          </div>
        )}

        {/* Live Rates Badge */}
        {liveRates && (
          <div
            className="hidden lg:flex h-9 items-center gap-3 px-3.5 rounded-xl text-[10px] font-bold font-sans"
            style={{
              background: "linear-gradient(135deg, #FFFDF9, #FFF5E6)",
              border: "1px solid rgba(212, 175, 55, 0.3)",
              color: "#8B6914",
              boxShadow: "0 1px 6px rgba(212, 175, 55, 0.08)"
            }}
            title="Live Bangalore Gold & Silver Rates"
          >
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[8px] uppercase tracking-wider text-amber-700 font-extrabold">Blr Rates:</span>
            </div>
            <div className="flex items-center gap-2.5 divide-x divide-amber-250/30">
              <span className="font-mono">24K: <b className="text-amber-950 font-black">₹{liveRates.gold_24k}/g</b></span>
              <span className="pl-2.5 font-mono">22K: <b className="text-amber-950 font-black">₹{liveRates.gold_22k}/g</b></span>
              <span className="pl-2.5 font-mono">18K: <b className="text-amber-950 font-black">₹{liveRates.gold_18k}/g</b></span>
              <span className="pl-2.5 font-mono">Silver: <b className="text-amber-950 font-black">₹{liveRates.silver}/kg</b></span>
            </div>
          </div>
        )}

        {/* Right: actions + clock + user */}
        <div className="flex items-center gap-2">
          {/* Interactive Clock & Real-Time Sync Status Badge */}
          <button
            onClick={() => setShowTimeSyncModal(true)}
            className="hidden lg:flex h-9 items-center gap-2 px-3 rounded-xl text-xs font-mono transition-all hover:border-amber-400 cursor-pointer shadow-2xs"
            style={{ background: "#FFF9F0", border: "1px solid rgba(212,175,55,0.3)", color: "#9A7010" }}
            title={`Real-Time & Date Status: ${getIsInternetTimeSynced() ? "Synced via Internet (IST)" : "Using Saved Offset / System"}. Click to inspect or adjust.`}
          >
            <div className={`w-2 h-2 rounded-full ${getIsInternetTimeSynced() ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
            <span className="font-bold">{currentTime.toLocaleTimeString("en-IN")}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-sans font-bold bg-amber-100/70 text-amber-900">
              {getIsInternetTimeSynced() ? "IST" : "Offset"}
            </span>
          </button>

          {/* Sync status */}
          <div
            className="hidden sm:flex h-9 items-center gap-1.5 px-2.5 rounded-xl text-xs font-semibold"
            style={{
              background: isSynced ? "#f0fdf4" : "#fff7ed",
              border: `1px solid ${isSynced ? "#86efac" : "#fdba74"}`,
              color: isSynced ? "#16a34a" : "#c2410c",
            }}
          >
            {isSynced ? <CloudCheck size={13} /> : <CloudOff size={13} />}
            <span className="hidden md:inline">{isSynced ? "Synced" : "Offline"}</span>
          </div>

          {/* Global Interest Calculator button */}
          <button
            onClick={() => setShowGlobalCalcModal(true)}
            className="h-9 flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold transition-all hover:bg-amber-50 cursor-pointer"
            style={{
              border: "1px solid rgba(212,175,55,0.3)",
              background: "white",
              color: "#8B6914",
              boxShadow: "0 1px 4px rgba(212,175,55,0.08)",
            }}
            title="Open Interest Calculator"
          >
            <Calculator size={14} className="text-amber-800" />
            <span>Calculator</span>
          </button>

          {/* Action buttons */}
          {["daybook", "pledges", "pledge_form", "existing_girvi", "sales", "sale_form"].includes(activeNav) && (
            <>
              <button
                onClick={triggerPDFExport}
                title="Export Full Page PDF"
                className="h-9 flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-colors hover:bg-amber-50 cursor-pointer"
                style={{ border: "1px solid rgba(212,175,55,0.25)", color: "#8B6914" }}
              >
                <FileText size={14} />
                <span className="hidden sm:inline">PDF</span>
              </button>

              <button
                onClick={exportBackup}
                title="Download Backup"
                className="h-9 flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-colors hover:bg-amber-50 cursor-pointer"
                style={{ border: "1px solid rgba(212,175,55,0.25)", color: "#8B6914" }}
              >
                <Download size={14} />
                <span className="hidden sm:inline">Backup</span>
              </button>

              <label
                title="Import Backup"
                className="h-9 flex items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-colors hover:bg-amber-50 cursor-pointer"
                style={{ border: "1px solid rgba(212,175,55,0.25)", color: "#8B6914" }}
              >
                <Upload size={14} />
                <span className="hidden sm:inline">Import</span>
                <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
              </label>

              <button
                onClick={triggerManualSync}
                title="Sync Now"
                className="h-9 flex items-center gap-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer"
                style={{
                  background: "linear-gradient(135deg,#c8960c,#D4AF37)",
                  color: "#fff",
                  border: "none",
                  boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
                }}
              >
                <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            </>
          )}

          {/* User avatar / logout */}
          <div className="relative" ref={profileDropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen(v => !v)}
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-transform active:scale-95"
              style={{
                background: "linear-gradient(135deg,#7c3d0a,#c8960c)",
                color: "white",
                border: "2px solid rgba(212,175,55,0.4)",
              }}
            >
              P
            </button>
            {/* Dropdown */}
            <div
              className={`absolute right-0 top-11 w-44 rounded-xl overflow-hidden transition-all duration-200 ${profileDropdownOpen ? "opacity-100 pointer-events-auto translate-y-0" : "opacity-0 pointer-events-none translate-y-1"
                }`}
              style={{
                background: "white",
                border: "1px solid rgba(212,175,55,0.2)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(212,175,55,0.1)" }}>
                <p className="text-xs font-bold" style={{ color: "#2D1B0E" }}>Pooja Jewellers</p>
                <p className="text-[10px]" style={{ color: "#9E8B78" }}>Admin</p>
              </div>
              <button
                onClick={() => {
                  setProfileDropdownOpen(false);
                  localStorage.removeItem("pooja_daybook_auth");
                  localStorage.removeItem("pooja_daybook_token");
                  setIsAuthenticated(false);
                }}
                className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold hover:bg-red-50 transition-colors"
                style={{ color: "#dc2626" }}
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════
          BODY (sidebar + content)
      ════════════════════════════════ */}
      <div className="flex" style={{ marginTop: 60, minHeight: "calc(100vh - 60px)" }}>

        {/* ── SIDEBAR (desktop) ── */}
        <aside
          className="print-hidden hidden md:flex flex-col fixed left-0 bottom-0 sidebar-transition overflow-hidden"
          style={{
            top: 60,
            width: SW,
            background: "white",
            borderRight: "1px solid rgba(212,175,55,0.2)",
            boxShadow: "2px 0 16px rgba(0,0,0,0.04)",
            zIndex: 40,
          }}
        >
          {/* Nav items */}
          <nav className="flex-1 py-4 px-2 space-y-1">
            {NAV.map(item => {
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                  style={{
                    background: isActive ? "rgba(212,175,55,0.12)" : "transparent",
                    color: isActive ? "#8B6914" : "#7A6550",
                    border: isActive ? "1px solid rgba(212,175,55,0.25)" : "1px solid transparent",
                  }}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <item.icon size={18} style={{ minWidth: 18 }} />
                  {sidebarOpen && (
                    <span className="text-sm font-semibold truncate">{item.label}</span>
                  )}
                  {isActive && sidebarOpen && (
                    <div
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: "#D4AF37" }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          {sidebarOpen && (
            <div
              className="mx-2 mb-4 p-3 rounded-xl"
              style={{ background: "#FFF9F0", border: "1px solid rgba(212,175,55,0.2)" }}
            >
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#C8A87A" }}>
                Today
              </p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: "#7A6550" }}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long" })}
              </p>
              <p className="text-[10px] font-mono mt-1" style={{ color: "#D4AF37" }}>
                {currentTime.toLocaleTimeString("en-IN")}
              </p>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className="mx-2 mb-4 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-colors hover:bg-amber-50"
            style={{ border: "1px solid rgba(212,175,55,0.2)", color: "#8B6914" }}
          >
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            {sidebarOpen && "Collapse"}
          </button>
        </aside>

        {/* ── MOBILE SIDEBAR OVERLAY ── */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex print-hidden">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <aside
              className="relative flex flex-col"
              style={{
                width: 240, background: "white", borderRight: "1px solid rgba(212,175,55,0.2)",
                boxShadow: "4px 0 24px rgba(0,0,0,0.12)", zIndex: 50,
              }}
            >
              <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid rgba(212,175,55,0.15)" }}>
                <span className="font-black text-sm" style={{ color: "#2D1B0E", fontFamily: "Georgia, serif" }}>POTHA BAHI</span>
                <button onClick={() => setMobileSidebarOpen(false)}>
                  <X size={18} style={{ color: "#8B6914" }} />
                </button>
              </div>
              <nav className="flex-1 py-4 px-2 space-y-1">
                {NAV.map(item => {
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveNav(item.id); setMobileSidebarOpen(false); }}
                      className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                      style={{
                        background: isActive ? "rgba(212,175,55,0.12)" : "transparent",
                        color: isActive ? "#8B6914" : "#7A6550",
                      }}
                    >
                      <item.icon size={18} />
                      <span className="text-sm font-semibold">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
              <button
                onClick={() => {
                  localStorage.removeItem("pooja_daybook_auth");
                  localStorage.removeItem("pooja_daybook_token");
                  setIsAuthenticated(false);
                }}
                className="mx-3 mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors"
                style={{ color: "#dc2626", border: "1px solid rgba(220,38,38,0.15)" }}
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </aside>
          </div>
        )}

        {/* ── MAIN CONTENT ── */}
        <main
          className="flex-1 min-w-0"
          style={{
            marginLeft: 0,
            transition: "margin-left 0.25s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {/* Push content right on desktop based on sidebar width */}
          <style>{`
            @media (min-width: 768px) {
              .main-content { margin-left: ${SW}px; transition: margin-left 0.25s cubic-bezier(0.4,0,0.2,1); }
            }
          `}</style>

          <div className="main-content px-4 py-6">
            {activeNav === "daybook" && (
              <>
                {/* ── STAT CARDS ── */}
                {daybook && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 print-hidden">
                    <StatCard
                      label="Opening" value={fmt(openingTotal)}
                      icon={Wallet} color="#8B6914"
                      sub={`Cash ${fmt(openingCash)}`}
                    />
                    <StatCard
                      label="Given (Debit)" value={fmt(debitTotal)}
                      icon={ArrowRight} color="#dc2626"
                      sub={`Cash ${fmt(debitCash)}`}
                    />
                    <StatCard
                      label="Received" value={fmt(creditTotal)}
                      icon={ArrowLeft} color="#16a34a"
                      sub={`Cash ${fmt(creditCash)}`}
                    />
                    <StatCard
                      label="Closing" value={fmt(closingTotal)}
                      icon={TrendingUp} color="#D4AF37"
                      sub={`Cash ${fmt(closingCash)}`}
                    />
                    <StatCard
                      label="UPI Balance" value={fmt(closingUpi)}
                      icon={Smartphone} color="#6366f1"
                      sub={`In: ${fmt(totalUPIRec)}`}
                    />
                    <StatCard
                      label="Gold Sold" value={`${goldSold.toFixed(3)}g`}
                      icon={Coins} color="#f59e0b"
                      sub={`Silver: ${silverSold.toFixed(3)}g`}
                    />
                  </div>
                )}

                {/* ── DAY BOOK ── */}
                {daybook ? (
                  <DiaryPage
                    daybook={daybook}
                    dateStr={currentDate}
                    onRefresh={() => loadDayBookData(currentDate)}
                    isSynced={isSynced}
                    onEditOpening={() => setShowPasswordPrompt(true)}
                    onSelectPrintPledge={(p) => setSelectedPrintPledge(p)}
                    onSelectPrintBill={(item) => setSelectedPrintBill(item)}
                    showNotification={showNotification}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-24" style={{ color: "#C8A87A" }}>
                    <RefreshCw className="animate-spin mb-4" size={36} />
                    <p className="font-serif text-base font-semibold">Opening Potha Bahi…</p>
                  </div>
                )}
              </>
            )}
            {activeNav === "pledge_form" && (
              <PledgeFormView
                currentDate={currentDate}
                daybookId={daybook?.id || 0}
                onSuccess={(pledge) => {
                  setSelectedPrintPledge(pledge);
                  setActiveNav("pledges");
                }}
                showNotification={showNotification}
              />
            )}
            {activeNav === "existing_girvi" && (
              <PledgeFormView
                currentDate={currentDate}
                daybookId={daybook?.id || 0}
                isExisting={true}
                onSuccess={(pledge) => {
                  setSelectedPrintPledge(pledge);
                  setActiveNav("pledges");
                }}
                showNotification={showNotification}
              />
            )}
            {activeNav === "sale_form" && (
              <SaleFormView
                currentDate={currentDate}
                onSuccess={(soldItem, shouldPrint = true) => {
                  setSelectedPrintBill(soldItem);
                  setActiveNav("sales");
                  if (shouldPrint) {
                    setTimeout(() => {
                      window.print();
                    }, 400);
                  }
                }}
                showNotification={showNotification}
              />
            )}
            {activeNav === "purchase_bill" && (
              <PurchaseBillView
                showNotification={showNotification}
              />
            )}
            {activeNav === "purchase_ledger" && (
              <PurchaseLedgerView
                showNotification={showNotification}
              />
            )}
            {activeNav === "purchase_parties" && (
              <PurchasePartyView
                currentDate={currentDate}
                showNotification={showNotification}
              />
            )}
            {activeNav === "stock_register" && (
              <StockRegisterView
                showNotification={showNotification}
              />
            )}
            {activeNav === "backup_audit" && (
              <BackupAuditView
                showNotification={showNotification}
              />
            )}
            {activeNav === "system_logs" && (
              <SystemLogsView
                showNotification={showNotification}
              />
            )}
            {activeNav === "pledges" && (
              <GirviLedgerView
                currentDate={currentDate}
                daybookId={daybook?.id || 0}
                onRefreshDaybook={() => loadDayBookData(currentDate)}
                onSelectPrintPledge={(p) => setSelectedPrintPledge(p)}
                showNotification={showNotification}
                onSwitchToForm={() => setActiveNav("pledge_form")}
              />
            )}

            {activeNav === "sales" && (
              <SalesLedgerView
                onSelectPrintBill={(item) => setSelectedPrintBill(item)}
                showNotification={showNotification}
              />
            )}

            {activeNav === "aavak_jaavak" && (
              <AavakJaavakView />
            )}

            {activeNav === "bank_ledger" && (
              <BankLedgerView />
            )}


            {activeNav === "bank_repledge" && (
              <BankRePledgeLedgerView
                currentDate={currentDate}
                onRefreshDaybook={() => loadDayBookData(currentDate)}
                showNotification={showNotification}
              />
            )}

            {activeNav === "dashboard" && <DashboardView />}

            {activeNav === "reports" && (
              <ReportsView
                onSelectDate={(date) => {
                  setCurrentDate(date);
                  setActiveNav("daybook");
                }}
              />
            )}

            {activeNav === "settings" && (
              <SettingsView
                currentDate={currentDate}
                onRefresh={loadDayBookData}
                showNotification={showNotification}
              />
            )}
          </div>
        </main>
      </div>

      {/* ── TOAST NOTIFICATION ── */}
      {notification && (
        <div
          className="print-hidden fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl text-sm font-semibold"
          style={{
            animation: "slide-down 0.3s ease forwards",
            background: notification.type === "success" ? "#f0fdf4" : notification.type === "error" ? "#fff5f5" : "#fffbf0",
            border: `1px solid ${notification.type === "success" ? "#86efac" : notification.type === "error" ? "#fca5a5" : "#fde68a"}`,
            color: notification.type === "success" ? "#16a34a" : notification.type === "error" ? "#dc2626" : "#92400e",
            maxWidth: 320,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{notification.message}</span>
        </div>
      )}

      {/* ── FIRST-TIME SETUP MODAL ── */}
      {showSetup && (
        <div className="print-hidden">
          <OpeningSetupModal
            date={currentDate}
            onComplete={handleSetupComplete}
            initialCash={daybook?.opening_cash}
            initialUpi={daybook?.opening_upi}
            initialOther={daybook?.opening_other}
            initialUpiDetails={daybook?.opening_upi_details}
          />
        </div>
      )}

      {/* ── SECURITY VERIFICATION MODAL ── */}
      {showPasswordPrompt && (
        <div
          className="print-hidden fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}
        >
          <div
            style={{
              background: "white",
              borderRadius: 24,
              maxWidth: 380,
              width: "100%",
              boxShadow: "0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(212,175,55,0.1)",
              overflow: "hidden",
            }}
          >
            <div style={{ height: 4, background: "#D4AF37" }} />
            <div className="px-6 py-6 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-200 mx-auto mb-3 text-xl">
                🔑
              </div>
              <h3 className="font-bold text-base mb-1" style={{ color: "#2D1B0E", fontFamily: "Georgia, serif" }}>
                Admin Authentication
              </h3>
              <p className="text-xs mb-4" style={{ color: "#8B7355" }}>
                Enter the password to adjust opening balances.
              </p>

              <form onSubmit={handleVerifyPassword} className="space-y-3">
                <div>
                  <input
                    type="password"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError("");
                    }}
                    autoFocus
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-200 outline-none font-bold text-center text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20"
                    style={{ background: "#FFFBF5" }}
                  />
                  {passwordError && (
                    <p className="text-[10px] text-red-600 font-semibold mt-1.5">{passwordError}</p>
                  )}
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordPrompt(false);
                      setPasswordInput("");
                      setPasswordError("");
                    }}
                    className="flex-1 py-2.5 rounded-xl font-bold text-xs transition-colors bg-white hover:bg-amber-50/50"
                    style={{ border: "1px solid rgba(212,175,55,0.3)", color: "#8B6914" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all"
                    style={{
                      background: "linear-gradient(135deg,#c8960c,#D4AF37)",
                      color: "#4A2800",
                      boxShadow: "0 2px 8px rgba(212,175,55,0.25)",
                      border: "none",
                    }}
                  >
                    Verify
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── STANDALONE REFERENCE INTEREST CALCULATOR MODAL (GLOBAL) ── */}
      {showGlobalCalcModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-amber-200" style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ height: 4, background: "#D4AF37" }} />

            <div className="px-6 py-5 flex justify-between items-center border-b border-amber-50">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧮</span>
                <h3 className="font-bold text-base font-serif text-amber-955">
                  Interest Calculator
                </h3>
              </div>
              <button onClick={() => setShowGlobalCalcModal(false)} className="text-amber-900/40 hover:text-amber-900 transition-colors">
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
                <div className="bg-amber-50/40 border border-amber-200/50 rounded-2xl p-4 space-y-2.5 text-xs text-amber-955 font-serif">
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
      </div>

      {/* ── PINK VOUCHER PRINT PREVIEW OVERLAY ── */}
      {selectedPrintPledge && (
        <div id="print-overlay-wrapper" className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-start justify-center p-4 py-12 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0 print:shadow-none">
          <style>{`
            @media print {
              html, body {
                background: white !important;
                background-color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-hidden {
                display: none !important;
              }
              #print-overlay-wrapper {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 297mm !important;
                height: 210mm !important;
                overflow: visible !important;
                display: block !important;
                background: white !important;
                background-color: white !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              #print-overlay-wrapper > div {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 297mm !important;
                height: 210mm !important;
                background: white !important;
                background-color: white !important;
                padding: 0 !important;
                margin: 0 !important;
                border-radius: 0 !important;
                box-shadow: none !important;
                max-width: none !important;
              }
              #print-voucher-area {
                position: absolute !important;
                left: 10mm !important;
                top: 10mm !important;
                width: 277mm !important;
                height: 190mm !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box !important;
                display: grid !important;
                grid-template-columns: 1fr 1fr !important;
                gap: 16mm !important;
              }
              .print-voucher-copy {
                height: 190mm !important;
                padding: 4.5mm !important;
                box-sizing: border-box !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                background-color: #ffffff !important;
                background: #ffffff !important;
                border: none !important;
                border-radius: 16px !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-voucher-copy * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              /* Print color overrides to enforce Black & White for text/borders/lines */
              .print-voucher-copy h2,
              .print-voucher-copy p,
              .print-voucher-copy span,
              .print-voucher-copy div,
              .print-voucher-copy td,
              .print-voucher-copy th,
              .print-voucher-copy table,
              .print-voucher-copy b,
              .print-voucher-copy strong,
              .print-voucher-copy font {
                color: #000000 !important;
              }
              .print-voucher-copy,
              .print-voucher-copy *,
              #print-voucher-area,
              #print-voucher-area * {
                border-color: #000000 !important;
              }
              .print-voucher-copy div,
              .print-voucher-copy table,
              .print-voucher-copy tr,
              .print-voucher-copy td,
              .print-voucher-copy th {
                background-color: transparent !important;
              }
              .print-voucher-copy .bg-pink-100 {
                background-color: #e5e7eb !important;
              }
              .print-voucher-copy .bg-pink-200 {
                background-color: #d1d5db !important;
              }
              #print-voucher-area span {
                color: #000000 !important;
              }
              .print-voucher-copy img {
                filter: none !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              @page {
                size: A4 landscape;
                margin: 0 !important;
              }
            }
          `}</style>
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl p-6 relative print:p-0 print:shadow-none print:w-full print:max-w-none print:bg-white">
            {/* Close / Action bar */}
            <div className="flex justify-between items-center mb-4 border-b pb-3 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌸</span>
                <span className="font-bold text-amber-950 font-serif">Girvi Pawn Ticket Print Preview</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPrintBackSide(false);
                    setTimeout(() => window.print(), 150);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 ${!printBackSide ? "bg-diary-red text-white hover:bg-diary-crimson" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                >
                  🖨️ Print Front Side
                </button>
                <button
                  onClick={() => {
                    setPrintBackSide(true);
                    setTimeout(() => window.print(), 150);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all flex items-center gap-1.5 ${printBackSide ? "bg-diary-red text-white hover:bg-diary-crimson" : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                >
                  🖨️ Print Back Side (Rules)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintBackSide(prev => !prev)}
                  className="px-3 py-2 border border-amber-300 hover:bg-amber-50 rounded-xl text-xs font-bold text-amber-900 transition-colors"
                >
                  {printBackSide ? "👁️ View Front" : "👁️ View Back"}
                </button>
                <button
                  onClick={() => {
                    setSelectedPrintPledge(null);
                    setPrintBackSide(false);
                  }}
                  className="px-4 py-2 border border-amber-300 hover:bg-amber-50 rounded-xl text-xs font-bold text-amber-900 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Print Area */}
            <div id="print-voucher-area" className="relative grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2 print:gap-4 print:w-full">
              {/* Center tear guide for landscape A4 print */}
              <div className="absolute top-0 bottom-0 left-1/2 w-[20mm] print:flex hidden flex-col justify-between items-center py-6 -translate-x-1/2 select-none pointer-events-none z-20">
                <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l-2 border-dashed border-pink-400/70 -translate-x-1/2 z-10" />
                <span className="text-xs bg-white px-1.5 select-none z-20 relative">✂</span>
                <div className="my-auto z-20 relative flex items-center justify-center h-[50mm]">
                  <span className="text-[7px] font-sans font-black tracking-[0.2em] text-pink-500/80 rotate-90 bg-white py-2 px-1 select-none whitespace-nowrap uppercase inline-block">
                    TEAR / FOLD HERE
                  </span>
                </div>
                <span className="text-xs bg-white px-1.5 select-none z-20 relative">✂</span>
              </div>

              {!printBackSide ? (
                [
                  { title: "OFFICE COPY (BRANCH)", subtitle: "BRANCH COPY" },
                  { title: "CUSTOMER COPY (PAWNER)", subtitle: "CUSTOMER COPY" }
                ].map((copy, index) => {
                  const p = selectedPrintPledge;
                  const pDate = p.date || (p.due_date ? getPledgeDateFromDueDate(p.due_date) : currentDate);
                  const cleanName = (p.customer_name || "")
                    .replace(/^\[(UPI|OTHER)(:[^\]]+)?\]\s*/i, "")
                    .replace(/^\[SPLIT:[^\]]+\]\s*/i, "")
                    .trim();

                  return (
                    <div
                      key={`voucher-copy-${index}`}
                      className="p-4.5 border border-pink-250 rounded-2xl print-voucher-copy flex flex-col justify-between"
                      style={{
                        backgroundColor: "#FFF3F6",
                        color: "#4A0012",
                        fontFamily: "Georgia, serif",
                        height: "190mm",
                        boxSizing: "border-box",
                      }}
                    >
                      {/* Top Header */}
                      <div className="flex justify-between items-center text-[9.5px] font-bold text-pink-700/80 mb-1 border-b border-pink-300/40 pb-1 uppercase tracking-wider print:mb-0">
                        <span className="whitespace-nowrap">Form 'F' (See Rule 12)</span>
                        <span className="text-[11.5px] font-black text-pink-900 tracking-widest whitespace-nowrap">PAWN TICKET</span>
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span>PBL NO. DRB/R/PB/2026-27</span>
                          <span className="bg-pink-200 text-pink-900 px-1.5 py-0.5 rounded text-[8px] font-sans print:bg-pink-100 font-bold whitespace-nowrap">{copy.subtitle}</span>
                        </div>
                      </div>

                      {/* Shop Title */}
                      <div className="relative flex justify-center items-center mb-1.5 print:mb-0 min-h-[48px]">
                        <div className="absolute left-2 flex items-center">
                          <img src="/logo.png" alt="Pooja Jewellers Logo" className="w-[48px] h-[48px] object-contain mix-blend-multiply" />
                        </div>
                        <div className="text-center">
                          <h2 className="text-xl font-black tracking-wide text-pink-900 uppercase leading-none mb-0.5">
                            Pooja Bankers & Jewellers
                          </h2>
                          <p className="text-[9px] font-black tracking-wider text-pink-850 uppercase leading-none mb-1">PAWN BROKERS</p>
                          <p className="text-[9px] font-bold text-pink-800 leading-tight">Main Road, Budigere, Devanahalli Taluk, Bangalore Rural - 562129</p>
                          <p className="text-[8.5px] text-pink-850/80 font-sans leading-none mt-0.5">Mob - 9448969674</p>
                        </div>
                      </div>

                      {/* No & Date row */}
                      <div className="flex justify-between items-center text-[11px] font-bold text-pink-900 border-b border-pink-300 pb-1.5 mb-2 print:mb-0">
                        <div>
                          No. <span className="font-mono text-red-650 font-black text-sm">{p.pledge_no || "—"}</span>
                        </div>
                        <div>
                          Date : <span className="font-mono text-red-650 font-bold text-xs">{formatDateDMY(pDate)}</span>
                        </div>
                      </div>

                      {/* Pawner Details Box (with Photos) */}
                      <div className="border border-pink-300 rounded-xl overflow-hidden bg-white/70 text-[10.5px] mb-2.5 print:mb-0 font-sans grid grid-cols-12">
                        <div className="col-span-8 border-r border-pink-200 flex flex-col justify-between">
                          <div className="grid grid-cols-12 border-b border-pink-100 py-1.5 px-3 items-center">
                            <span className="col-span-4 font-bold text-pink-900 uppercase text-[8.5px] tracking-wider">Name of Pawner</span>
                            <span className="col-span-8 font-black text-pink-955 font-serif text-[12.5px]">: {cleanName}</span>
                          </div>
                          <div className="grid grid-cols-12 border-b border-pink-100 py-1.5 px-3 items-center">
                            <span className="col-span-4 font-bold text-pink-900 uppercase text-[8.5px] tracking-wider">S/o W/o D/o</span>
                            <span className="col-span-8 font-bold text-pink-955">: {p.pawner_relation} {p.pawner_relation_name || "—"}</span>
                          </div>
                          <div className="grid grid-cols-12 border-b border-pink-100 py-1.5 px-3 items-center">
                            <span className="col-span-4 font-bold text-pink-900 uppercase text-[8.5px] tracking-wider">Residence (Own/Rental)</span>
                            <span className="col-span-8 font-bold text-pink-950">: {p.address || "Budigere"}</span>
                          </div>
                          <div className="grid grid-cols-12 border-b border-pink-100 py-1.5 px-3 items-center">
                            <span className="col-span-4 font-bold text-pink-900 uppercase text-[8.5px] tracking-wider">Occupation Address</span>
                            <span className="col-span-8 font-bold text-pink-955">: —</span>
                          </div>
                          <div className="grid grid-cols-12 py-1.5 px-3 items-center">
                            <div className="col-span-6 flex items-center pr-2">
                              <span className="font-bold text-pink-900 uppercase text-[8.5px] tracking-wider w-10 flex-shrink-0">Mob</span>
                              <span className="font-bold text-pink-955 font-sans">: {p.mobile || "—"}</span>
                            </div>
                            <div className="col-span-6 flex items-center pl-2 border-l border-pink-100">
                              <span className="font-bold text-pink-900 uppercase text-[8.5px] tracking-wider w-10 flex-shrink-0">Inc</span>
                              <span className="font-bold text-pink-955 font-sans">: {p.income ? String(p.income).replace(" Monthly", "") : "—"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Photos Section (Right column, 4 spans) */}
                        <div className="col-span-4 p-1.5 flex gap-1.5 justify-center items-center bg-pink-50/20">
                          {/* Customer photo */}
                          <div className="w-[20mm] h-[27mm] border border-pink-200 rounded bg-white flex flex-col items-center justify-center overflow-hidden relative shadow-xs">
                            {p.customer_photo ? (
                              <img src={p.customer_photo} alt="Pawner" className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-[7px] text-pink-500/60 font-semibold select-none">
                                <span className="text-[12px] mb-0.5">👤</span>
                                <span className="scale-[0.8] leading-none mt-0.5 font-sans">PAWNER</span>
                              </div>
                            )}
                          </div>

                          {/* Item photo */}
                          <div className="w-[20mm] h-[27mm] border border-pink-200 rounded bg-white flex flex-col items-center justify-center overflow-hidden relative shadow-xs">
                            {p.item_photo ? (
                              <img src={p.item_photo} alt="Item" className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-[7px] text-pink-500/60 font-semibold select-none">
                                <span className="text-[12px] mb-0.5">💍</span>
                                <span className="scale-[0.8] leading-none mt-0.5 font-sans">ITEM</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Principal & Value Section */}
                      <div className="grid grid-cols-12 gap-2 mb-2.5 print:mb-0">
                        {/* Principal Amount Card */}
                        <div className="col-span-5 border border-pink-300 rounded-xl p-2.5 bg-white/70 flex flex-col justify-between">
                          <span className="block text-[8px] font-black text-pink-900 uppercase tracking-wider mb-0.5">Principal Loan Amount</span>
                          <span className="font-mono text-sm font-black text-red-700">{fmt(p.amount)}</span>
                        </div>

                        {/* Rupees in Words Card */}
                        <div className="col-span-7 border border-pink-300 rounded-xl p-2.5 bg-white/70 flex flex-col justify-between">
                          <span className="block text-[8px] font-black text-pink-900 uppercase tracking-wider mb-0.5">Rupees in Words</span>
                          <span className="font-bold text-pink-955 italic text-[10.5px] leading-tight">{p.rupees_in_words || "—"}</span>
                        </div>
                      </div>

                      {/* Terms text (borderless bold italic) */}
                      <div className="text-[8.5px] font-bold italic text-pink-955 font-serif mb-2.5 print:mb-0 leading-relaxed px-1">
                        <p>Rate of interest {p.interest_rate_text || `${p.interest_percentage}% per month`} &nbsp;&nbsp; Time of redemption {p.redemption_period_months || 12} months</p>
                        <p>The following article / articles is / are pawned with me / us</p>
                      </div>

                      {/* Table of Articles */}
                      <div className="border border-pink-300 rounded-xl overflow-hidden bg-white/90 text-[10px] mb-2.5 print:mb-0 font-sans shadow-xs">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-pink-100 text-pink-900 border-b border-pink-300 text-center font-bold text-[8.5px] uppercase tracking-wider">
                              <th className="py-1 px-1 border-r border-pink-250 w-8" rowSpan={2}>Sl No</th>
                              <th className="py-1 px-2 border-r border-pink-250 text-left" rowSpan={2}>Description of Articles Pledged</th>
                              <th className="py-0.5 px-1 border-b border-pink-250 border-r border-pink-250" colSpan={2}>Gross Wt</th>
                              <th className="py-1 px-1 border-r border-pink-250 w-11" rowSpan={2}>Less Wt</th>
                              <th className="py-1 px-1 border-r border-pink-250 w-11" rowSpan={2}>Net Wt</th>
                              <th className="py-1 px-1 w-18" rowSpan={2}>Present Value</th>
                            </tr>
                            <tr className="bg-pink-100 text-pink-900 border-b border-pink-300 text-center font-bold text-[7.5px] uppercase">
                              <th className="py-0.5 px-1 border-r border-pink-250 w-8">Gms.</th>
                              <th className="py-0.5 px-1 border-r border-pink-250 w-8">Mgs.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const rowsData = [
                                { no: 1, ornament: p.ornament, gross: p.gross_weight || p.weight || 0, less: p.less_weight || 0, net: p.net_weight || p.weight || 0, val: p.estimated_value || 0 },
                                { no: 2, ornament: p.ornament_2, gross: p.gross_weight_2 || 0, less: p.less_weight_2 || 0, net: p.net_weight_2 || 0, val: p.estimated_value_2 || 0 },
                                { no: 3, ornament: p.ornament_3, gross: p.gross_weight_3 || 0, less: p.less_weight_3 || 0, net: p.net_weight_3 || 0, val: p.estimated_value_3 || 0 },
                              ];

                              return rowsData.map((row) => {
                                const grossWt = row.gross;
                                const gmsVal = Math.floor(grossWt);
                                const mgsVal = Math.round((grossWt - gmsVal) * 1000);

                                return (
                                  <tr key={`article-row-${row.no}`} className="text-center font-semibold text-pink-955 border-b border-pink-200 h-7.5">
                                    <td className="py-1.5 px-1 border-r border-pink-200 text-pink-300/60">{row.no}</td>
                                    <td className="py-1.5 px-2 border-r border-pink-200 text-left font-serif text-[11px] font-black">{row.ornament || ""}</td>
                                    <td className="py-1.5 px-1 border-r border-pink-200 font-mono text-[10.5px]">{row.ornament ? gmsVal : ""}</td>
                                    <td className="py-1.5 px-1 border-r border-pink-200 font-mono text-[10.5px]">{row.ornament && mgsVal > 0 ? mgsVal : ""}</td>
                                    <td className="py-1.5 px-1 border-r border-pink-200 font-mono text-[10.5px]">{row.ornament ? row.less.toFixed(3) : ""}</td>
                                    <td className="py-1.5 px-1 border-r border-pink-200 font-mono text-[10.5px] font-bold">{row.ornament ? row.net.toFixed(3) : ""}</td>
                                    <td className="py-1.5 px-1 font-mono text-[10.5px]">{row.ornament ? (row.val ? row.val.toFixed(2) : "0.00") : ""}</td>
                                  </tr>
                                );
                              });
                            })()}
                            {/* Kannada statutory warning text inside the table row span */}
                            <tr className="bg-pink-50/20 text-center text-pink-900">
                              <td colSpan={7} className="py-2.5 px-2 text-center font-serif text-[10px] font-bold leading-relaxed whitespace-nowrap">
                                (ಪ್ರತಿ ಮೂರು ತಿಂಗಳಿಗೊಮ್ಮೆ ಬಡ್ಡಿ ಹಣ ಕಟ್ಟಬೇಕು)
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Summary Box Row */}
                      <div className="border border-pink-300 rounded-xl overflow-hidden bg-white/90 grid grid-cols-12 text-center text-[10.5px] font-bold mb-3 print:mb-0">
                        <div className="col-span-4 py-2 border-r border-pink-300 text-red-650 font-black">
                          Rs. {p.amount.toFixed(2)}
                        </div>
                        <div className="col-span-5 py-2 border-r border-pink-300 font-mono text-pink-950">
                          Date: {formatDateDMY(pDate)}
                        </div>
                        <div className="col-span-3 py-2 text-pink-950 font-mono">
                          No. of PIECES: {(p.quantity || 0) + (p.quantity_2 || 0) + (p.quantity_3 || 0) || 1}
                        </div>
                      </div>

                      {/* Bottom notes and signatures */}
                      <div className="grid grid-cols-12 gap-2 font-bold">
                        <div className="col-span-6 flex flex-col justify-between h-28 border border-pink-300 rounded-xl p-2.5 bg-white/70">
                          <div className="text-left font-serif text-[10px] font-black text-pink-900 tracking-wider">
                            For POOJA BANKERS & JEWELLERS
                          </div>
                          <div className="text-center text-[7.5px] text-pink-900/60 pt-1.5 border-t border-pink-300/40 font-sans uppercase">
                            Signature of P.B. or His Agent
                          </div>
                        </div>

                        <div className="col-span-6 border border-pink-300 rounded-xl p-2.5 bg-white/70 flex flex-col justify-between h-28">
                          <div className="text-left text-[8.5px] text-pink-955 font-serif leading-tight font-bold">
                            I declare that the above articles are my own property. The above statement is true to the best of my knowledge and belief.
                          </div>
                          <div className="text-right text-[7.5px] text-pink-900/60 pt-1.5 border-t border-pink-300/40 font-sans uppercase">
                            Signature / LTI of Pawner
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                [
                  { title: "OFFICE COPY (BRANCH) - BACK", subtitle: "BRANCH COPY" },
                  { title: "CUSTOMER COPY (PAWNER) - BACK", subtitle: "CUSTOMER COPY" }
                ].map((copy, index) => {
                  return (
                    <div
                      key={`back-voucher-copy-${index}`}
                      className="p-3.5 border border-pink-250 rounded-2xl print-voucher-copy flex flex-col justify-between"
                      style={{
                        backgroundColor: "#ffffff",
                        color: "#000000",
                        fontFamily: "Georgia, serif",
                        height: "190mm",
                        boxSizing: "border-box",
                      }}
                    >
                      <div className="border border-black rounded-xl py-3 px-4 flex-1 flex flex-col justify-between mb-2 print:mb-0">
                        <h3 className="text-center font-black text-[12px] uppercase tracking-wider border-b border-black pb-1.5 mb-1.5">
                          CONDITION
                        </h3>
                        <ol className="space-y-3.5 list-decimal pl-5 text-black text-[9.8px] leading-relaxed my-auto">
                          <li>
                            Every pledge shall be redeemable within a period of one year or such longer period as may be provided in the contract between the parties, from the day of pawning (exclusive of that day) and shall continue to be redeemable during 7 days of grace following the said period.
                          </li>
                          <li>
                            The holder of this ticket is presumed to be the person entitled to redeem the pledge.
                          </li>
                          <li>
                            The rate of interest on any pledge shall not exceed to fourteen percent per annum.
                          </li>
                          <li>
                            If this ticket is lost, mislaid, destroyed, stolen or fraudulently obtained from the pawner, the pawner should at once apply to the pawn-broker for the supply free of cost, of a printed form of declaration to be made before a magistrate or a judge, complete it and deliver it back to the pawn-broker not later than fifteen days after the due date of the form by the pawn-broker. The pawn-broker shall have then the same rights and remedies as if he had produced the pawn tickets.
                          </li>
                          <li>
                            Where the loan exceeds two hundred and fifty rupees the applicant shall before applying to the pawn broker cause to be published a notice containing the following particulars namely:
                            <div className="pl-4 space-y-1 mt-1 text-[9px] leading-relaxed list-none">
                              <p>a) The name place of business and licence number of the pawn broker concerned</p>
                              <p>b) Full and detailed description of the articles (weight to be noted in the case of jewels)</p>
                              <p>c) Name and address of the pawner and</p>
                              <p>d) The basis on which the applicant make his claim that is whether as the owner of the pledge but not holding the pawn ticket, as a person claiming to be entitled to hold the pawn ticket but alleging that it has been lost mislaid destroyed stolen or fraudulently obtained from him. Such notice shall be published on two successive days in a newspaper circulating in the place where the pawn broker carries on his business and approved by the Licensing authority or the inspector of Money Lender's and Pawn Brokers.</p>
                            </div>
                            <p className="mt-1">The application for the form of declaration shall be made 21 days after the publication of the notice.</p>
                          </li>
                          <li>
                            Change of address immediately be made known to the Pawn Brokers.
                          </li>
                        </ol>

                        <div className="text-center font-bold border-t border-black pt-1.5 mt-1.5 text-[8.5px] uppercase tracking-wider">
                          Business will remain closed on every Amavasya, Festivals &amp; Weekly Holidays
                        </div>
                      </div>

                      {/* Bottom Receipt Box */}
                      <div className="border border-black rounded-xl py-2.5 px-4 text-[9.5px] flex flex-col justify-between h-20 bg-white">
                        <div className="text-center font-black uppercase tracking-wider border-b border-black pb-1 mb-1 text-[9.5px]">
                          received the pledges articles in Original Condition
                        </div>
                        <div className="flex justify-between items-end mt-1.5">
                          <span className="font-bold text-black text-[9.5px]">Date: ...........................</span>
                          <span className="font-bold border-t border-dashed border-black/50 pt-1 px-3 text-[9px] text-black">
                            Signature or TI of the person Redeeming the pledge
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SALES BILL PRINT PREVIEW OVERLAY ── */}
      {selectedPrintBill && (
        <div id="print-bill-overlay-wrapper" className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-xs flex items-start justify-center p-4 py-8 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0 print:shadow-none">
          <style>{`
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 10mm;
              }

              /* Step 1: Make EVERYTHING invisible */
              body {
                visibility: hidden !important;
                background: white !important;
                background-color: white !important;
              }
              body * {
                visibility: hidden !important;
              }

              /* Step 2: Make ONLY the bill overlay visible */
              #print-bill-overlay-wrapper,
              #print-bill-overlay-wrapper * {
                visibility: visible !important;
              }

              /* Step 3: Position the overlay to fill the page from top */
              #print-bill-overlay-wrapper {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                background: white !important;
                background-color: white !important;
                padding: 0 !important;
                margin: 0 !important;
                display: flex !important;
                align-items: flex-start !important;
                justify-content: center !important;
              }

              /* Step 4: Hide the settings panel */
              .print-hidden {
                display: none !important;
                visibility: hidden !important;
              }

              /* Step 5: Style the invoice area */
              #print-bill-preview-area {
                width: 100% !important;
                max-width: 190mm !important;
                margin: 0 auto !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                border-radius: 0 !important;
                background-color: white !important;
                background: white !important;
                display: block !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              #print-bill-preview-area * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .green-print-header {
                background-color: #0b5c33 !important;
                color: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .green-print-header th {
                background-color: #0b5c33 !important;
                color: #ffffff !important;
              }
              .final-amount-row {
                background-color: #0b5c33 !important;
                color: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .final-amount-row span {
                color: #ffffff !important;
              }
            }
          `}</style>
          <div className="bg-amber-50/15 max-w-6xl w-full rounded-3xl shadow-2xl p-6 relative flex flex-col md:flex-row gap-6 print:p-0 print:shadow-none print:w-full print:max-w-none print:bg-white print:flex-col print:gap-0" style={{ backgroundColor: "#FFFBF4", border: "1px solid rgba(212,175,55,0.25)" }}>

            {/* Left Panel: Settings Form (Hidden in print) */}
            <div className="w-full md:w-5/12 bg-white rounded-2xl p-4 border border-amber-900/10 shadow-sm print:hidden flex flex-col justify-between">
              <div>
                <h3 className="font-serif font-bold text-base text-amber-950 mb-3 pb-2 border-b border-amber-900/10 flex items-center gap-1.5">
                  📝 Sales Bill Settings
                </h3>

                {/* Bill Type Toggle */}
                <div className="mb-4">
                  <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider mb-1">Bill Type</label>
                  <div className="grid grid-cols-2 gap-2 bg-amber-50/50 p-1.5 rounded-xl border border-amber-900/10">
                    <button
                      type="button"
                      onClick={() => setBillType("estimate")}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${billType === "estimate"
                        ? "bg-amber-800 text-white shadow-xs"
                        : "text-amber-900 hover:bg-amber-100/50"
                        }`}
                    >
                      Estimate Bill
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillType("gst")}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${billType === "gst"
                        ? "bg-diary-red text-white shadow-xs"
                        : "text-amber-900 hover:bg-amber-100/50"
                        }`}
                    >
                      GST Invoice (3%)
                    </button>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="mb-4 space-y-2.5">
                  <h4 className="text-[10px] font-bold text-amber-900 uppercase tracking-widest border-b border-dotted pb-1">Customer Info</h4>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Customer Name</label>
                    <input
                      type="text"
                      value={billCustomerName}
                      onChange={(e) => setBillCustomerName(e.target.value)}
                      placeholder="Enter Customer Name"
                      className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none focus:ring-1 focus:ring-amber-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Mobile No</label>
                      <input
                        type="text"
                        value={billCustomerMobile}
                        onChange={(e) => setBillCustomerMobile(e.target.value)}
                        placeholder="Enter Mobile"
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none focus:ring-1 focus:ring-amber-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Bill Date</label>
                      <input
                        type="date"
                        value={billDate}
                        onChange={(e) => setBillDate(e.target.value)}
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none focus:ring-1 focus:ring-amber-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Address</label>
                    <input
                      type="text"
                      value={billCustomerAddress}
                      onChange={(e) => setBillCustomerAddress(e.target.value)}
                      placeholder="Enter Address"
                      className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none focus:ring-1 focus:ring-amber-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Aadhar No</label>
                      <input
                        type="text"
                        value={billCustomerAadhar}
                        onChange={(e) => setBillCustomerAadhar(e.target.value)}
                        placeholder="Aadhar No"
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">PAN No</label>
                      <input
                        type="text"
                        value={billCustomerPan}
                        onChange={(e) => setBillCustomerPan(e.target.value)}
                        placeholder="PAN No"
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Item Details */}
                <div className="mb-4 space-y-2.5">
                  <h4 className="text-[10px] font-bold text-amber-900 uppercase tracking-widest border-b border-dotted pb-1">Item Info</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Item Description</label>
                      <input
                        type="text"
                        value={billItemName}
                        onChange={(e) => setBillItemName(e.target.value)}
                        placeholder="Item name"
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-950 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Purity</label>
                      <input
                        type="text"
                        value={billPurity}
                        onChange={(e) => setBillPurity(e.target.value)}
                        placeholder="Purity"
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Weight (g)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={billWeight}
                        onChange={(e) => setBillWeight(e.target.value)}
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2 py-1.5 text-xs text-amber-950 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Quantity (pc)</label>
                      <input
                        type="number"
                        value={billQuantity}
                        onChange={(e) => setBillQuantity(e.target.value)}
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2 py-1.5 text-xs text-amber-950 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Metal</label>
                      <select
                        value={billMetal}
                        onChange={(e) => setBillMetal(e.target.value as any)}
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2 py-1.5 text-xs text-amber-950 focus:outline-none font-bold"
                      >
                        <option value="GOLD">Gold</option>
                        <option value="SILVER">Silver</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">Total Amount Paid (₹)</label>
                    <input
                      type="number"
                      value={billTotalAmount}
                      onChange={(e) => setBillTotalAmount(e.target.value)}
                      placeholder="Enter amount customer paid"
                      className="w-full bg-amber-100/30 border border-amber-900/20 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-955 focus:outline-none focus:ring-1 focus:ring-amber-800"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Rate / g (₹)</label>
                      <input
                        type="number"
                        value={billRatePerGram}
                        onChange={(e) => setBillRatePerGram(e.target.value)}
                        placeholder="Rate"
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Wastage (%)</label>
                      <input
                        type="number"
                        value={billWastage}
                        onChange={(e) => setBillWastage(e.target.value)}
                        placeholder="Wastage %"
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Making (₹)</label>
                      <input
                        type="number"
                        value={billMaking}
                        onChange={(e) => setBillMaking(e.target.value)}
                        placeholder="Making"
                        className="w-full bg-amber-50/20 border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Auto Calculated Preview */}
                <div className="bg-amber-50/40 border border-amber-900/10 rounded-xl p-3 text-[11px] space-y-1 text-amber-950 font-serif font-semibold">
                  <div className="flex justify-between">
                    <span>Base Taxable Amount:</span>
                    <span className="font-sans font-bold">₹{baseAmount.toFixed(2)}</span>
                  </div>
                  <>
                    <div className="flex justify-between text-amber-900/80">
                      <span>CGST (1.5%):</span>
                      <span className="font-sans font-bold">+ ₹{cgstVal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-amber-900/80">
                      <span>SGST (1.5%):</span>
                      <span className="font-sans font-bold">+ ₹{sgstVal.toFixed(2)}</span>
                    </div>
                  </>
                  <div className="flex justify-between border-t border-amber-900/10 pt-1 mt-1 text-xs text-diary-red font-bold">
                    <span>Grand Total:</span>
                    <span className="font-sans">₹{totalVal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-amber-900/60 pt-0.5">
                    <span>Rate/Gram:</span>
                    <span className="font-sans">₹{ratePerGram.toFixed(2)}/g</span>
                  </div>
                </div>

                {/* Shop & Bank Configuration */}
                <div className="mt-4 p-3 bg-amber-50/20 border border-amber-900/10 rounded-xl space-y-2 text-amber-950 font-sans">
                  <h4 className="text-[10px] font-bold text-amber-900 uppercase tracking-widest border-b border-dashed pb-1">Shop &amp; Bank Settings</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold text-amber-900">Invoice No</label>
                      <input
                        type="text"
                        value={billInvoiceNo}
                        onChange={(e) => setBillInvoiceNo(e.target.value)}
                        placeholder="Invoice No"
                        className="w-full bg-white border border-amber-900/15 rounded px-2 py-1 text-[10px] focus:outline-none font-mono font-bold text-emerald-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-amber-900">Book No</label>
                      <input
                        type="text"
                        value={billBookNo}
                        onChange={(e) => setBillBookNo(e.target.value)}
                        className="w-full bg-white border border-amber-900/15 rounded px-2 py-1 text-[10px] focus:outline-none font-mono font-bold"
                        placeholder="Book No"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold text-amber-900">GSTIN No</label>
                      <input
                        type="text"
                        value={billGstin}
                        onChange={(e) => setBillGstin(e.target.value)}
                        className="w-full bg-white border border-amber-900/15 rounded px-2 py-1 text-[10px] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-amber-900">Prop Name</label>
                      <input
                        type="text"
                        value={billPropName}
                        onChange={(e) => setBillPropName(e.target.value)}
                        className="w-full bg-white border border-amber-900/15 rounded px-2 py-1 text-[10px] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold text-amber-900">Bank Name</label>
                      <input
                        type="text"
                        value={billBankName}
                        onChange={(e) => setBillBankName(e.target.value)}
                        className="w-full bg-white border border-amber-900/15 rounded px-2 py-1 text-[10px] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-amber-900">Bank Branch</label>
                      <input
                        type="text"
                        value={billBankBranch}
                        onChange={(e) => setBillBankBranch(e.target.value)}
                        className="w-full bg-white border border-amber-900/15 rounded px-2 py-1 text-[10px] focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold text-amber-900">Account No</label>
                      <input
                        type="text"
                        value={billBankAccountNo}
                        onChange={(e) => setBillBankAccountNo(e.target.value)}
                        className="w-full bg-white border border-amber-900/15 rounded px-2 py-1 text-[10px] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-amber-900">IFSC Code</label>
                      <input
                        type="text"
                        value={billBankIfsc}
                        onChange={(e) => setBillBankIfsc(e.target.value)}
                        className="w-full bg-white border border-amber-900/15 rounded px-2 py-1 text-[10px] focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 mt-5 font-sans">
                <button
                  onClick={() => window.print()}
                  className="flex-1 bg-diary-red text-white py-2 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-diary-crimson transition-all"
                >
                  🖨️ Print Bill
                </button>
                <button
                  onClick={() => setSelectedPrintBill(null)}
                  className="px-4 py-2 border border-amber-300 hover:bg-amber-50 rounded-xl text-xs font-bold text-amber-900 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Right Panel: Printable Bill Invoice Preview */}
            <div
              id="print-bill-preview-area"
              className="w-full md:w-7/12 bg-white shadow-md rounded-2xl border border-amber-900/10 print:border-none print:shadow-none print:w-full print:bg-white"
              style={{
                padding: "8mm 10mm",
                fontFamily: "Georgia, serif",
                color: "#000000",
                boxSizing: "border-box",
                fontSize: "13px",
              }}
            >
              {/* Invoice Layout */}
              {/* Header (GSTIN, Tax Invoice title, Prop Name) */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontFamily: "times new roman", fontWeight: 700, borderBottom: "1px solid black", paddingBottom: "4px", marginBottom: "6px" }}>
                <span>GSTIN : {billGstin}</span>
                <span style={{ fontSize: "16px", textTransform: "uppercase", fontFamily: "times new roman", fontWeight: 900, textDecoration: "underline", letterSpacing: "2px" }}>SALE INVOICE</span>
                <span>Prop : {billPropName}</span>
              </div>

              {/* Main Shop Info Header */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 4.6fr 1.2fr", alignItems: "center", gap: "8px", marginBottom: "6px", borderBottom: "2px solid black", paddingBottom: "6px" }}>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <img src="/bis_logo.png" alt="BIS Hallmark Logo" style={{ width: "120px", height: "120px", objectFit: "contain" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <h1 style={{ margin: 0, fontSize: "28px", fontWeight: 900, fontFamily: "Times New Roman, serif", textTransform: "uppercase", letterSpacing: "3px" }}>Pooja Jewellers</h1>
                  <p style={{ margin: "2px 0 0", fontSize: "10px", fontFamily: "times new roman", fontWeight: 800, textTransform: "uppercase" }}>MFRS.IN HIGH CLASS GOLD &amp; SILVER ORNAMENTS, 916, KDM, 75 HALL MARK JEWELLERY</p>
                  <p style={{ margin: "1px 0 0", fontSize: "10px", fontFamily: "times new roman", fontWeight: 600 }}>Ground Floor, Manjushree Complex, Main Road, Near Busstand, Budigere, Devanhalli taluk 562129</p>
                  <p style={{ margin: "1px 0 0", fontSize: "9px", fontFamily: "times new roman", fontWeight: 700 }}>Mobile: +91 8660100547, +91 9880518013 | Gmail: poojajewellers1996@gmail.com</p>
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <img src="/logo.png" alt="Pooja Jewellers Logo" style={{ width: "100px", height: "100px", objectFit: "contain" }} />
                </div>
              </div>

              {/* Invoice No, Book No & Date Header Row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontFamily: "sans-serif", fontWeight: 700, borderBottom: "2px double black", paddingBottom: "5px", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "rgba(0,0,0,0.6)", textTransform: "uppercase" }}>INVOICE NO :</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "13px", color: "#0b5c33", background: "rgba(11,92,51,0.06)", padding: "1px 6px", borderRadius: "4px" }}>
                    {billInvoiceNo || "—"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "rgba(0,0,0,0.6)", textTransform: "uppercase" }}>BOOK NO :</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "12px" }}>{billBookNo || "—"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ fontSize: "10px", color: "rgba(0,0,0,0.6)", textTransform: "uppercase" }}>DATE :</span>
                  <span style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "13px" }}>{formatDateDMY(billDate)}</span>
                </div>
              </div>

              {/* Customer Details Box */}
              <div style={{ border: "1px solid black", borderRadius: "6px", overflow: "hidden", marginBottom: "10px", fontSize: "13px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", borderBottom: "1px solid rgba(0,0,0,0.2)", padding: "7px 10px", gap: "6px", background: "rgba(0,0,0,0.01)" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "4px" }}>
                    <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: "11px", color: "rgba(0,0,0,0.55)", textTransform: "uppercase", whiteSpace: "nowrap" }}>Client Name :</span>
                    <span style={{ flex: 1, fontFamily: "Georgia, serif", fontWeight: 900, paddingLeft: "4px", color: "black", fontSize: "13px" }}>{billCustomerName || "Cash Customer"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", paddingLeft: "8px", borderLeft: "1px solid rgba(0,0,0,0.1)" }}>
                    <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: "11px", color: "rgba(0,0,0,0.55)", textTransform: "uppercase", whiteSpace: "nowrap" }}>Phone :</span>
                    <span style={{ flex: 1, fontFamily: "monospace", fontWeight: 700, paddingLeft: "4px", fontSize: "13px" }}>{billCustomerMobile || "—"}</span>
                  </div>
                </div>
                <div style={{ padding: "6px 10px", display: "grid", gridTemplateColumns: "7fr 5fr", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "4px" }}>
                    <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: "11px", color: "rgba(0,0,0,0.55)", textTransform: "uppercase", whiteSpace: "nowrap" }}>Address :</span>
                    <span style={{ flex: 1, fontFamily: "Georgia, serif", fontWeight: 600, paddingLeft: "4px", fontSize: "13px" }}>{billCustomerAddress || "—"}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", paddingLeft: "8px", borderLeft: "1px solid rgba(0,0,0,0.1)" }}>
                    <span style={{ fontFamily: "sans-serif", fontWeight: 700, fontSize: "11px", color: "rgba(0,0,0,0.55)", textTransform: "uppercase", whiteSpace: "nowrap" }}>Aadhar :</span>
                    <span style={{ flex: 1, fontFamily: "monospace", fontWeight: 700, paddingLeft: "4px", fontSize: "13px" }}>{billCustomerAadhar || "—"}</span>
                  </div>
                </div>
              </div>

              {/* Items Description Table */}
              <table style={{ width: "100%", textAlign: "left", fontSize: "13px", border: "1px solid black", borderRadius: "6px", overflow: "hidden", marginBottom: "10px", borderCollapse: "collapse" }}>
                <thead>
                  <tr className="green-print-header" style={{ background: "#0b5c33", backgroundColor: "#0b5c33", color: "white", textAlign: "center", fontWeight: 800, fontSize: "12px", textTransform: "uppercase" }}>
                    <th colSpan={7} style={{ padding: "6px 8px", borderBottom: "1px solid black", color: "white", backgroundColor: "#0b5c33" }}>New Purchase</th>
                  </tr>
                  <tr className="green-print-header" style={{ background: "#0b5c33", backgroundColor: "#0b5c33", color: "white", borderBottom: "1px solid black", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>
                    <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "36px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Sr.</th>
                    <th style={{ padding: "6px 8px", borderRight: "1px solid black", textAlign: "left", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Description of Goods</th>
                    <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "65px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Wastage %</th>
                    <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "90px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Making Charge</th>
                    <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "85px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Weight (g)</th>
                    <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "75px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Rate/g</th>
                    <th style={{ padding: "6px 8px", width: "95px", textAlign: "right", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {billItems.map((item, index) => {
                    let itemName = item.item_name || "";
                    let rate = "", wastage = "", making = "", purity = "";
                    const priceMatch = itemName.match(/\[PRICE:([^\]]+)\]/);
                    if (priceMatch) {
                      const parts = priceMatch[1].split("|");
                      rate = parts[0] || ""; wastage = parts[1] || ""; making = parts[2] || ""; purity = parts[3] || "";
                    }
                    const cleanName = itemName
                      .replace(/^\[(GOLD|SILVER)\]\s*/i, "").replace(/\[SPLIT:[^\]]+\]\s*/i, "").replace(/\[CUST:[^\]]+\]\s*/i, "")
                      .replace(/\[PRICE:[^\]]+\]\s*/i, "").replace(/\[BARCODE:[^\]]+\]\s*/i, "").trim();
                    const rateValRow = isMultiItem ? (parseFloat(rate) || 0) : (parseFloat(billRatePerGram) || 0);
                    const wastageValRow = isMultiItem ? (parseFloat(wastage) || 0) : (parseFloat(billWastage) || 0);
                    let makingValRow = isMultiItem ? (parseFloat(making) || 0) : (parseFloat(billMaking) || 0);
                    const weightValRow = isMultiItem ? (item.weight || 0) : (parseFloat(billWeight) || 0);
                    const itemAmount = isMultiItem ? (item.amount || 0) : totalVal;
                    const itemBaseAmount = itemAmount / 1.03;
                    if (makingValRow <= 0 && rateValRow > 0 && weightValRow > 0 && itemAmount > 0) {
                      const metalBase = weightValRow * rateValRow;
                      const wastageAmt = metalBase * (wastageValRow / 100);
                      const derived = itemBaseAmount - metalBase - wastageAmt;
                      if (derived > 0) makingValRow = derived;
                    }
                    return (
                      <tr key={item.id || index} style={{ borderBottom: "1px solid rgba(0,0,0,0.15)", textAlign: "center", minHeight: "44px", color: "black", fontWeight: 600 }}>
                        <td style={{ padding: "10px 4px", borderRight: "1px solid black", color: "rgba(0,0,0,0.45)" }}>{index + 1}</td>
                        <td style={{ padding: "10px 8px", borderRight: "1px solid black", textAlign: "left", fontFamily: "Georgia, serif", fontWeight: 900, textTransform: "uppercase" }}>
                          <div style={{ fontSize: "14px" }}>{cleanName || "Gold/Silver Ornament"}</div>
                          {purity && <div style={{ fontSize: "10px", fontFamily: "sans-serif", fontWeight: 700, color: "rgba(0,0,0,0.55)", marginTop: "2px" }}>Purity: {purity}</div>}
                        </td>
                        <td style={{ padding: "10px 4px", borderRight: "1px solid black", fontFamily: "sans-serif", fontWeight: 700 }}>{wastageValRow > 0 ? `${wastageValRow}%` : "—"}</td>
                        <td style={{ padding: "10px 4px", borderRight: "1px solid black", fontFamily: "sans-serif", fontWeight: 700 }}>{makingValRow > 0 ? `₹${makingValRow.toFixed(2)}` : "—"}</td>
                        <td style={{ padding: "10px 4px", borderRight: "1px solid black", fontFamily: "sans-serif", fontWeight: 700 }}>{weightValRow.toFixed(3)}</td>
                        <td style={{ padding: "10px 4px", borderRight: "1px solid black", fontFamily: "sans-serif", fontWeight: 700 }}>{rateValRow > 0 ? `₹${rateValRow.toFixed(0)}` : "—"}</td>
                        <td style={{ padding: "10px 8px", fontFamily: "sans-serif", fontWeight: 900, textAlign: "right", fontSize: "14px" }}>₹{itemBaseAmount.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 3 - billItems.length) }).map((_, idx) => (
                    <tr key={idx} style={{ height: "36px", borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                      <td style={{ borderRight: "1px solid rgba(0,0,0,0.15)" }}></td>
                      <td style={{ borderRight: "1px solid rgba(0,0,0,0.15)" }}></td>
                      <td style={{ borderRight: "1px solid rgba(0,0,0,0.15)" }}></td>
                      <td style={{ borderRight: "1px solid rgba(0,0,0,0.15)" }}></td>
                      <td style={{ borderRight: "1px solid rgba(0,0,0,0.15)" }}></td>
                      <td style={{ borderRight: "1px solid rgba(0,0,0,0.15)" }}></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Old Gold/Silver Exchange Table */}
              {(billOldGoldItems.length > 0 || billOldSilverItems.length > 0) && (
                <div style={{ marginTop: "10px" }}>
                  <table style={{ width: "100%", textAlign: "left", fontSize: "13px", border: "1px solid black", borderRadius: "6px", overflow: "hidden", marginBottom: "10px", borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="green-print-header" style={{ background: "#0b5c33", backgroundColor: "#0b5c33", color: "white", textAlign: "center", fontWeight: 800, fontSize: "12px", textTransform: "uppercase" }}>
                        <th colSpan={7} style={{ padding: "6px 8px", borderBottom: "1px solid black", color: "white", backgroundColor: "#0b5c33" }}>Old Gold Exchange</th>
                      </tr>
                      <tr className="green-print-header" style={{ background: "#0b5c33", backgroundColor: "#0b5c33", color: "white", borderBottom: "1px solid black", fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center" }}>
                        <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "36px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Sr.</th>
                        <th style={{ padding: "6px 8px", borderRight: "1px solid black", textAlign: "left", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Description of Exchange Item</th>
                        <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "65px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Purity</th>
                        <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "90px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Wastage (g)</th>
                        <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "85px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Weight (g)</th>
                        <th style={{ padding: "6px 4px", borderRight: "1px solid black", width: "75px", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Rate/g</th>
                        <th style={{ padding: "6px 8px", width: "95px", textAlign: "right", fontFamily: "Georgia, serif", color: "white", backgroundColor: "#0b5c33" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...billOldGoldItems.map(x => ({ ...x, metal: "GOLD" })), ...billOldSilverItems.map(x => ({ ...x, metal: "SILVER" }))].map((item, index) => {
                        let itemName = "Old Gold/Silver Item";
                        let purity = "";
                        let rate = 0;
                        let wastage = 0;
                        const exMatch = item.customer_name.match(/\[EXCHANGE:([^\]]+)\]/);
                        if (exMatch) {
                          const parts = exMatch[1].split("|");
                          itemName = parts[0] || "";
                          purity = parts[1] || "";
                          rate = parseFloat(parts[2]) || 0;
                          wastage = parseFloat(parts[3]) || 0;
                        }
                        return (
                          <tr key={item.id || index} style={{ borderBottom: "1px solid rgba(0,0,0,0.15)", textAlign: "center", minHeight: "44px", color: "black", fontWeight: 600 }}>
                            <td style={{ padding: "10px 4px", borderRight: "1px solid black", color: "rgba(0,0,0,0.45)" }}>{index + 1}</td>
                            <td style={{ padding: "10px 8px", borderRight: "1px solid black", textAlign: "left", fontFamily: "Georgia, serif", fontWeight: 900, textTransform: "uppercase" }}>
                              <div style={{ fontSize: "14px" }}>{itemName} ({item.metal})</div>
                            </td>
                            <td style={{ padding: "10px 4px", borderRight: "1px solid black", fontFamily: "sans-serif", fontWeight: 700 }}>{purity || "—"}</td>
                            <td style={{ padding: "10px 4px", borderRight: "1px solid black", fontFamily: "sans-serif", fontWeight: 700 }}>{wastage > 0 ? `${wastage.toFixed(3)}g` : "—"}</td>
                            <td style={{ padding: "10px 4px", borderRight: "1px solid black", fontFamily: "sans-serif", fontWeight: 700 }}>{item.weight.toFixed(3)}</td>
                            <td style={{ padding: "10px 4px", borderRight: "1px solid black", fontFamily: "sans-serif", fontWeight: 700 }}>{rate > 0 ? `₹${rate.toFixed(0)}` : "—"}</td>
                            <td style={{ padding: "10px 8px", fontFamily: "sans-serif", fontWeight: 900, textAlign: "right", fontSize: "14px" }}>₹{item.amount.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Bottom Summary: Words + GST + Payment */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                {/* Left: Amount in words + payment mode */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ border: "1px solid black", borderRadius: "6px", padding: "6px 8px", fontSize: "10px", lineHeight: 1.4 }}>
                    <div style={{ fontSize: "8px", color: "rgba(0,0,0,0.5)", textTransform: "uppercase", fontFamily: "sans-serif", fontWeight: 700, marginBottom: "2px" }}>Rupees in Words:</div>
                    <div style={{ fontFamily: "Georgia, serif", fontStyle: "italic", fontWeight: 700, textTransform: "uppercase", fontSize: "10px" }}>{numberToWordsIndian(netPayableVal)}</div>
                  </div>

                  {/* Payment Mode & Invoice QR Box */}
                  <div style={{ border: "1px solid black", borderRadius: "6px", padding: "6px 8px", fontSize: "10.5px", display: "grid", gridTemplateColumns: "1fr 90px", gap: "6px", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: "8.5px", color: "rgba(0,0,0,0.5)", textTransform: "uppercase", fontFamily: "sans-serif", fontWeight: 700, marginBottom: "4px" }}>Payment Mode:</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        {billCashAmount > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "sans-serif", fontWeight: 700 }}>
                            <span>💵 Cash</span><span style={{ fontFamily: "monospace" }}>₹{billCashAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {billUpiAmount > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "sans-serif", fontWeight: 700 }}>
                            <span>📱 UPI / Online</span><span style={{ fontFamily: "monospace" }}>₹{billUpiAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {billOtherAmount > 0 && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "sans-serif", fontWeight: 700 }}>
                            <span>🏦 Other</span><span style={{ fontFamily: "monospace" }}>₹{billOtherAmount.toFixed(2)}</span>
                          </div>
                        )}
                        {(billCashAmount === 0 && billUpiAmount === 0 && billOtherAmount === 0) && (
                          <div style={{ fontFamily: "sans-serif", fontWeight: 700, color: "#000000" }}>💵 Cash ₹{netPayableVal.toFixed(2)}</div>
                        )}
                      </div>
                    </div>

                    {/* Invoice QR Code Container */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderLeft: "1px solid rgba(0,0,0,0.15)", paddingLeft: "4px" }}>
                      {qrCodeDataUrl ? (
                        <img src={qrCodeDataUrl} alt="Invoice QR Code" style={{ width: "70px", height: "70px", objectFit: "contain", border: "1px solid rgba(0,0,0,0.15)", borderRadius: "4px", padding: "2px", background: "white" }} />
                      ) : (
                        <div style={{ width: "70px", height: "70px", border: "1px border-dashed text-center flex items-center justify-center font-mono text-[8px]" }}>QR CODE</div>
                      )}
                      <span style={{ fontSize: "7px", fontFamily: "sans-serif", fontWeight: 800, textTransform: "uppercase", color: "#0b5c33", marginTop: "2px" }}>Invoice QR</span>
                    </div>
                  </div>
                </div>

                {/* Right: GST Summary Table */}
                <div style={{ border: "1px solid black", borderRadius: "6px", overflow: "hidden", fontSize: "11px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "1px solid rgba(0,0,0,0.15)", background: "rgba(0,0,0,0.02)", fontFamily: "sans-serif", fontWeight: 700 }}>
                    <span style={{ fontSize: "9px", textTransform: "uppercase", color: "rgba(0,0,0,0.55)" }}>Total Before GST</span>
                    <span>₹{baseAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "1px solid rgba(0,0,0,0.1)", fontFamily: "sans-serif", fontWeight: 700, color: "rgba(0,0,0,0.7)" }}>
                    <span style={{ fontSize: "9px", textTransform: "uppercase" }}>Add SGST 1.5%</span>
                    <span>+ ₹{sgstVal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "1px solid rgba(0,0,0,0.1)", fontFamily: "sans-serif", fontWeight: 700, color: "rgba(0,0,0,0.7)" }}>
                    <span style={{ fontSize: "9px", textTransform: "uppercase" }}>Add CGST 1.5%</span>
                    <span>+ ₹{cgstVal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid rgba(0,0,0,0.15)", fontFamily: "sans-serif", fontWeight: 700, color: "rgba(0,0,0,0.7)" }}>
                    <span style={{ fontSize: "9px", textTransform: "uppercase" }}>Total After GST</span>
                    <span>₹{totalVal.toFixed(2)}</span>
                  </div>
                  {oldExchangeTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 10px", borderBottom: "1px solid rgba(0,0,0,0.15)", fontFamily: "sans-serif", fontWeight: 700, color: "green" }}>
                      <span style={{ fontSize: "9px", textTransform: "uppercase" }}>Old Gold/Silver Exchange</span>
                      <span>- ₹{oldExchangeTotal.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid rgba(0,0,0,0.15)", fontFamily: "sans-serif", fontWeight: 700, color: "rgba(0,0,0,0.7)" }}>
                    <span style={{ fontSize: "9px", textTransform: "uppercase" }}>Amount Paid</span>
                    <span>₹{(billCashAmount + billUpiAmount + billOtherAmount).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "1px solid rgba(0,0,0,0.15)", fontFamily: "sans-serif", fontWeight: 700, color: "red" }}>
                    <span style={{ fontSize: "9px", textTransform: "uppercase" }}>Due Amount</span>
                    <span>₹{Math.max(0, netPayableVal - (billCashAmount + billUpiAmount + billOtherAmount)).toFixed(2)}</span>
                  </div>
                  <div className="final-amount-row" style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", background: "#0b5c33", backgroundColor: "#0b5c33", color: "white", fontFamily: "sans-serif", fontWeight: 900, fontSize: "12px" }}>
                    <span style={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", color: "white" }}>Final Net Amount</span>
                    <span style={{ color: "white" }}>₹{netPayableVal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Bill Footer & Signatures */}
              <div style={{ borderTop: "1px solid rgba(0,0,0,0.4)", paddingTop: "6px", marginTop: "4px" }}>
                {/* Terms & Conditions */}
                <div style={{ marginBottom: "6px" }}>
                  <h4 style={{ fontFamily: "Georgia, serif", fontWeight: 900, textTransform: "uppercase", fontSize: "8.5px", marginBottom: "4px" }}>Terms &amp; Conditions :</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px", fontSize: "7px", color: "rgba(0,0,0,0.75)", fontFamily: "sans-serif", fontWeight: 600, lineHeight: 1.5 }}>
                    <p style={{ margin: "1px 0" }}>1. Minimum 80% advance payment is required for all custom orders.</p>
                    <p style={{ margin: "1px 0" }}>2. Exchange or return is accepted only within 10–12 days of purchase.</p>
                    <p style={{ margin: "1px 0" }}>3. No guarantee or warranty is provided against breakage or damage after delivery.</p>
                    <p style={{ margin: "1px 0" }}>4. Quality and purity of the jewellery are guaranteed as specified on the invoice.</p>
                    <p style={{ margin: "1px 0" }}>5. Making charges, GST, and other applicable charges are non-refundable.</p>
                    <p style={{ margin: "1px 0" }}>6. Exchange value based on prevailing gold rate and jewellery condition.</p>
                    <p style={{ margin: "1px 0" }}>7. Please verify the weight, design, and invoice details before leaving the store.</p>
                    <p style={{ margin: "1px 0" }}>8. This invoice is mandatory for any exchange, buyback, or service request.</p>
                    <p style={{ margin: "1px 0" }}>9. Hallmarked jewellery complies with BIS standards wherever applicable.</p>
                    <p style={{ margin: "1px 0" }}>10. All disputes are subject to the jurisdiction of the local courts only.</p>
                  </div>
                </div>

                {/* Signatures */}
                <div style={{ display: "grid", gridTemplateColumns: "7fr 5fr", borderTop: "1px solid rgba(0,0,0,0.15)", paddingTop: "4px" }}>
                  <div />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", textAlign: "center", fontSize: "9px", fontFamily: "sans-serif", fontWeight: 700, paddingTop: "28px" }}>
                    <div style={{ borderTop: "1px solid black", paddingTop: "4px", color: "rgba(0,0,0,0.7)" }}>
                      Customer Signature
                      <div style={{ fontSize: "7px", color: "rgba(0,0,0,0.45)" }}>Buyer Sign</div>
                    </div>
                    <div style={{ position: "relative", textAlign: "center" }}>
                      <div style={{ position: "absolute", top: "-16px", right: 0, fontFamily: "Georgia, serif", fontWeight: 900, fontSize: "7px", textTransform: "uppercase", letterSpacing: "0.5px" }}>FOR: POOJA JEWELLERS</div>
                      <div style={{ borderTop: "1px solid black", paddingTop: "4px", color: "rgba(0,0,0,0.7)" }}>
                        Auth. Signature
                        <div style={{ fontSize: "7px", color: "rgba(0,0,0,0.45)" }}>Seller Sign</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <TimeSyncModal
        isOpen={showTimeSyncModal}
        onClose={() => setShowTimeSyncModal(false)}
        showNotification={showNotification}
        onTimeUpdated={() => {
          setCurrentTime(getSyncedDate());
          setCurrentDate(getSyncedDateString());
        }}
      />
    </div>
  );
}

// ════════════════════════════════
// SUB-VIEWS FOR OTHER NAV TABS
// ════════════════════════════════

interface DashboardStats {
  recent_days: {
    date: string;
    closing_cash: number;
    closing_upi: number;
    closing_other: number;
    total: number;
  }[];
  total_days: number;
  gold_sold: number;
  silver_sold: number;
  outstanding_girvi: number;
  total_gold_stock?: number;
  total_silver_stock?: number;
  total_stock_valuation?: number;
  total_supplier_credit?: number;
  active_gold_val?: number;
  active_silver_val?: number;
  active_gold_wt?: number;
  active_silver_wt?: number;
}

function DashboardView() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/dashboard/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20" style={{ color: "#C8A87A" }}>
        <RefreshCw className="animate-spin mb-3" size={32} style={{ color: "#D4AF37" }} />
        <p className="font-serif text-sm font-semibold">Loading dashboard statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-10" style={{ color: "#8B6914" }}>
        <p className="font-bold">Failed to load statistics.</p>
        <p className="text-xs">Please ensure the backend server is running.</p>
      </div>
    );
  }

  const maxTotal = Math.max(...stats.recent_days.map(d => d.total), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black font-serif" style={{ color: "#2D1B0E" }}>
          Dashboard Overview
        </h2>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#FFF9F0", border: "1px solid rgba(212,175,55,0.25)", color: "#8B6914" }}>
          Live Stats
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Days */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-200 text-amber-700">
            <Calendar size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800/60 uppercase tracking-wider">Days Tracked</p>
            <p className="text-xl font-bold font-mono text-amber-950 mt-0.5">{stats.total_days} Days</p>
          </div>
        </div>

        {/* Gold */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-200 text-yellow-600">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800/60 uppercase tracking-wider">Total Gold Sold</p>
            <p className="text-xl font-bold font-mono text-amber-950 mt-0.5">{stats.gold_sold.toFixed(3)}g</p>
          </div>
        </div>

        {/* Silver */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-200 text-slate-400">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800/60 uppercase tracking-wider">Total Silver Sold</p>
            <p className="text-xl font-bold font-mono text-amber-950 mt-0.5">{(stats.silver_sold / 1000).toFixed(3)} kg</p>
          </div>
        </div>

        {/* Outstanding Girvi */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-200 text-amber-700">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800/60 uppercase tracking-wider">Outstanding Girvi</p>
            <p className="text-xl font-bold font-mono text-amber-950 mt-0.5">{fmt(stats.outstanding_girvi)}</p>
          </div>
        </div>
      </div>

      {/* Stock Valuation & Liabilities Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gold in Stock */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-200 text-yellow-600">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800/60 uppercase tracking-wider">Gold in Stock</p>
            <p className="text-xl font-bold font-mono text-amber-955 mt-0.5">{(stats.total_gold_stock || 0).toFixed(3)}g</p>
          </div>
        </div>

        {/* Silver in Stock */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-200 text-slate-400">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800/60 uppercase tracking-wider">Silver in Stock</p>
            <p className="text-xl font-bold font-mono text-amber-955 mt-0.5">{((stats.total_silver_stock || 0) / 1000).toFixed(3)} kg</p>
          </div>
        </div>

        {/* Current Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-700">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-800/60 uppercase tracking-wider">Inventory Valuation</p>
            <p className="text-xl font-bold font-mono text-emerald-955 mt-0.5">{fmt(stats.total_stock_valuation || 0)}</p>
          </div>
        </div>

        {/* Supplier Liabilities */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-50 border border-red-200 text-red-650">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-red-800/60 uppercase tracking-wider">Supplier Liabilities</p>
            <p className="text-xl font-bold font-mono text-red-955 mt-0.5">{fmt(stats.total_supplier_credit || 0)}</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Closing Balance Trends (7 cols) */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm font-serif mb-1" style={{ color: "#2D1B0E" }}>
              Closing Balance Trends (Last 7 Days)
            </h3>
            <p className="text-[10px] text-amber-800/60 font-medium mb-6">Historical trends of total assets in cash, UPI, and other accounts.</p>
          </div>

          {stats.recent_days.length === 0 ? (
            <p className="text-xs text-center py-10" style={{ color: "#9E8B78" }}>No data to display. Start creating daily sheets.</p>
          ) : (
            <div>
              {/* Visual Bars */}
              <div className="flex items-end justify-between gap-2 h-48 border-b border-amber-100 pb-2 overflow-x-auto sm:overflow-x-visible">
                {stats.recent_days.map((day) => {
                  const totalVal = day.total || 1;
                  const heightCash = (day.closing_cash / totalVal) * 100;
                  const heightUpi = (day.closing_upi / totalVal) * 100;
                  const heightOther = (day.closing_other / totalVal) * 100;

                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center min-w-[50px] group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 bg-amber-955 text-white text-[10px] rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg min-w-[120px]">
                        <p className="font-bold border-b border-white/20 pb-0.5 mb-1 text-center">{fmtDateFriendly(day.date)}</p>
                        <p className="flex justify-between"><span>Cash:</span> <span>{fmt(day.closing_cash)}</span></p>
                        <p className="flex justify-between"><span>UPI:</span> <span>{fmt(day.closing_upi)}</span></p>
                        <p className="flex justify-between"><span>Other:</span> <span>{fmt(day.closing_other)}</span></p>
                        <p className="flex justify-between border-t border-white/20 pt-0.5 mt-1 font-bold"><span>Total:</span> <span>{fmt(day.total)}</span></p>
                      </div>

                      {/* Visual stacked bar */}
                      <div className="w-8 sm:w-10 flex flex-col justify-end rounded-t-md overflow-hidden" style={{ height: `${(day.total / maxTotal) * 150}px`, minHeight: 4 }}>
                        <div className="bg-amber-600 transition-all hover:brightness-110" style={{ height: `${heightOther}%`, width: '100%' }} />
                        <div className="bg-indigo-500 transition-all hover:brightness-110" style={{ height: `${heightUpi}%`, width: '100%' }} />
                        <div className="bg-amber-400 transition-all hover:brightness-110" style={{ height: `${heightCash}%`, width: '100%' }} />
                      </div>

                      <span className="text-[9px] font-bold text-amber-800 mt-2 font-mono whitespace-nowrap">
                        {day.date.substring(5)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 justify-center text-[10px] font-bold uppercase tracking-wider text-amber-900/80">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-amber-400" />
                  <span>Cash</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-indigo-500" />
                  <span>UPI</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded bg-amber-600" />
                  <span>Other</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pledge Metal Valuation Gauge (3 cols) */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm lg:col-span-3 flex flex-col justify-between text-center">
          <div>
            <h3 className="font-bold text-sm font-serif mb-1 text-left" style={{ color: "#2D1B0E" }}>
              Pledge Valuation Distribution
            </h3>
            <p className="text-[10px] text-amber-800/60 font-medium mb-6 text-left">Proportion of Gold vs Silver in active pledges.</p>
          </div>

          {(() => {
            const goldVal = stats.active_gold_val || 0;
            const silverVal = stats.active_silver_val || 0;
            const totalVal = goldVal + silverVal || 1;
            const goldPct = (goldVal / totalVal) * 100;
            const silverPct = (silverVal / totalVal) * 100;

            const radius = 32;
            const circ = 2 * Math.PI * radius; // ~201.06
            const goldOffset = circ - (goldPct / 100) * circ;

            return (
              <div className="space-y-4">
                <div className="relative flex items-center justify-center">
                  <svg width="120" height="120" className="transform -rotate-90 select-none" viewBox="0 0 100 100">
                    {/* Gray track for Silver */}
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#E2E8F0"
                      strokeWidth="10"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#94A3B8"
                      strokeWidth="10"
                      strokeDasharray={`${circ}`}
                      strokeDashoffset={`${circ - (silverPct / 100) * circ}`}
                      strokeLinecap="round"
                    />
                    {/* Gold active stroke */}
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#D4AF37"
                      strokeWidth="10"
                      strokeDasharray={`${circ}`}
                      strokeDashoffset={`${goldOffset}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-[8px] font-black text-amber-800/60 uppercase tracking-widest">Active</span>
                    <span className="text-xs font-black font-mono text-amber-955">₹{(stats.outstanding_girvi / 1000).toFixed(0)}k</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left pt-2">
                  <div className="p-2 rounded-xl bg-amber-50/40 border border-amber-100/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                      <span className="text-[9px] font-bold text-amber-850 uppercase">Gold Pledges</span>
                    </div>
                    <span className="font-extrabold font-mono text-[11px] text-amber-955">₹{goldVal.toLocaleString("en-IN")}</span>
                    <span className="block text-[8px] font-bold text-amber-800/60 mt-0.5">{goldPct.toFixed(0)}% of total</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50/50 border border-slate-200/40">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                      <span className="text-[9px] font-bold text-slate-700 uppercase">Silver Pledges</span>
                    </div>
                    <span className="font-extrabold font-mono text-[11px] text-slate-800">₹{silverVal.toLocaleString("en-IN")}</span>
                    <span className="block text-[8px] font-bold text-slate-500 mt-0.5">{silverPct.toFixed(0)}% of total</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Pledge Metal Weight Gauge (3 cols) */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm lg:col-span-3 flex flex-col justify-between text-center">
          <div>
            <h3 className="font-bold text-sm font-serif mb-1 text-left" style={{ color: "#2D1B0E" }}>
              Pledge Weight Distribution
            </h3>
            <p className="text-[10px] text-amber-800/60 font-medium mb-6 text-left">Proportion of Gold vs Silver by weight in active pledges.</p>
          </div>

          {(() => {
            const goldWt = stats.active_gold_wt || 0;
            const silverWt = stats.active_silver_wt || 0;
            const totalWt = goldWt + silverWt || 1;
            const goldPct = (goldWt / totalWt) * 100;
            const silverPct = (silverWt / totalWt) * 100;

            const radius = 32;
            const circ = 2 * Math.PI * radius; // ~201.06
            const goldOffset = circ - (goldPct / 100) * circ;

            // Format total weight nicely (kg if >= 1000g, else g)
            const totalWtStr = (goldWt + silverWt) >= 1000
              ? `${((goldWt + silverWt) / 1000).toFixed(2)} kg`
              : `${(goldWt + silverWt).toFixed(1)} g`;

            return (
              <div className="space-y-4">
                <div className="relative flex items-center justify-center">
                  <svg width="120" height="120" className="transform -rotate-90 select-none" viewBox="0 0 100 100">
                    {/* Gray track for Silver */}
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#E2E8F0"
                      strokeWidth="10"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#94A3B8"
                      strokeWidth="10"
                      strokeDasharray={`${circ}`}
                      strokeDashoffset={`${circ - (silverPct / 100) * circ}`}
                      strokeLinecap="round"
                    />
                    {/* Gold active stroke */}
                    <circle
                      cx="50"
                      cy="50"
                      r={radius}
                      fill="transparent"
                      stroke="#D4AF37"
                      strokeWidth="10"
                      strokeDasharray={`${circ}`}
                      strokeDashoffset={`${goldOffset}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-[8px] font-black text-amber-800/60 uppercase tracking-widest">Total Wt</span>
                    <span className="text-xs font-black font-mono text-amber-955">{totalWtStr}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-left pt-2">
                  <div className="p-2 rounded-xl bg-amber-50/40 border border-amber-100/50">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                      <span className="text-[9px] font-bold text-amber-850 uppercase">Gold Wt</span>
                    </div>
                    <span className="font-extrabold font-mono text-[11px] text-amber-955">{goldWt.toFixed(2)}g</span>
                    <span className="block text-[8px] font-bold text-amber-800/60 mt-0.5">{goldPct.toFixed(0)}% of total</span>
                  </div>

                  <div className="p-2 rounded-xl bg-slate-50/50 border border-slate-200/40">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                      <span className="text-[9px] font-bold text-slate-700 uppercase">Silver Wt</span>
                    </div>
                    <span className="font-extrabold font-mono text-[11px] text-slate-800">{(silverWt / 1000).toFixed(2)}kg</span>
                    <span className="block text-[8px] font-bold text-slate-500 mt-0.5">{silverPct.toFixed(0)}% of total</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Charts Grid Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Comparative Cash vs UPI (6 cols) */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm font-serif mb-1" style={{ color: "#2D1B0E" }}>
              Cash vs UPI Balance Comparison
            </h3>
            <p className="text-[10px] text-amber-800/60 font-medium mb-6">Daily comparative breakdown of store cash vs bank UPI reserves.</p>
          </div>

          {(() => {
            const maxCashOrUpi = Math.max(...stats.recent_days.map(d => Math.max(d.closing_cash, d.closing_upi)), 1);

            return (
              <div>
                <div className="flex items-end justify-between gap-3 h-44 border-b border-amber-100 pb-2">
                  {stats.recent_days.map((day) => {
                    const cashH = (day.closing_cash / maxCashOrUpi) * 120;
                    const upiH = (day.closing_upi / maxCashOrUpi) * 120;

                    return (
                      <div key={day.date} className="flex-1 flex flex-col items-center group relative min-w-[50px]">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 bg-amber-955 text-white text-[9px] rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg min-w-[110px]">
                          <p className="font-bold border-b border-white/20 pb-0.5 mb-1 text-center font-mono">{day.date}</p>
                          <p className="flex justify-between text-yellow-400"><span>Cash:</span> <span>₹{Math.round(day.closing_cash).toLocaleString("en-IN")}</span></p>
                          <p className="flex justify-between text-indigo-300"><span>UPI:</span> <span>₹{Math.round(day.closing_upi).toLocaleString("en-IN")}</span></p>
                        </div>

                        {/* Comparative double bars */}
                        <div className="flex items-end gap-1">
                          <div className="w-3.5 bg-amber-400 hover:brightness-105 rounded-t" style={{ height: `${cashH}px`, minHeight: 2 }} />
                          <div className="w-3.5 bg-indigo-500 hover:brightness-105 rounded-t" style={{ height: `${upiH}px`, minHeight: 2 }} />
                        </div>

                        <span className="text-[9px] font-bold text-amber-800 mt-2 font-mono">
                          {day.date.substring(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-center gap-4 mt-3 text-[10px] font-bold uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded bg-amber-400" />
                    <span className="text-amber-850">Cash Balance</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2.5 h-2.5 rounded bg-indigo-500" />
                    <span className="text-amber-850">UPI Reserve</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Outstanding Pawn Weight (6 cols) */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm lg:col-span-6 flex flex-col justify-between text-left">
          <div>
            <h3 className="font-bold text-sm font-serif mb-1" style={{ color: "#2D1B0E" }}>
              Active Pawned Metal Inventory
            </h3>
            <p className="text-[10px] text-amber-800/60 font-medium mb-6">Total weight of active gold and silver ornaments held in physical safe custody.</p>
          </div>

          <div className="space-y-4 pt-2">
            {/* Gold Weight Row */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-amber-955">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                  <span>Gold Ornaments Weight</span>
                </div>
                <span className="font-mono">{(stats.active_gold_wt || 0).toFixed(3)} g</span>
              </div>
              <div className="w-full bg-amber-100/30 border border-amber-150/20 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-[#D4AF37] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(((stats.active_gold_wt || 0) / 1000) * 100, 100)}%` }}
                />
              </div>
              <span className="block text-[8px] text-amber-800/50 font-bold uppercase tracking-wider">Estimated capacity percentage (max threshold: 1 kg)</span>
            </div>

            {/* Silver Weight Row */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-800">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#94A3B8]" />
                  <span>Silver Ornaments Weight</span>
                </div>
                <span className="font-mono">{((stats.active_silver_wt || 0) / 1000).toFixed(3)} kg</span>
              </div>
              <div className="w-full bg-slate-100/50 border border-slate-200/40 h-3 rounded-full overflow-hidden">
                <div
                  className="bg-[#94A3B8] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(((stats.active_silver_wt || 0) / 15000) * 100, 100)}%` }}
                />
              </div>
              <span className="block text-[8px] text-slate-400 font-bold uppercase tracking-wider">Estimated capacity percentage (max threshold: 15 kg)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReportsViewProps {
  onSelectDate: (dateStr: string) => void;
}

function ReportsView({ onSelectDate }: ReportsViewProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [daybooks, setDaybooks] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    // Set default range to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setStartDate(start.toISOString().split("T")[0]);
    setEndDate(end.toISOString().split("T")[0]);
  }, []);

  const handleSearch = async () => {
    if (!startDate || !endDate) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch(`${API_BASE}/reports/range?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setDaybooks(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const totalOpening = daybooks[0] ? (daybooks[0].opening_cash + daybooks[0].opening_upi + daybooks[0].opening_other) : 0;
  const totalClosing = daybooks[daybooks.length - 1] ? (daybooks[daybooks.length - 1].closing_cash + daybooks[daybooks.length - 1].closing_upi + daybooks[daybooks.length - 1].closing_other) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black font-serif" style={{ color: "#2D1B0E" }}>
          Range Reports
        </h2>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#FFF9F0", border: "1px solid rgba(212,175,55,0.25)", color: "#8B6914" }}>
          Audit Ledger
        </span>
      </div>

      {/* Date Filter Box */}
      <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex flex-col md:flex-row items-end gap-4">
        <div className="flex-1 space-y-1.5 w-full">
          <label className="text-xs font-semibold text-amber-800">From Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-amber-200 outline-none text-sm focus:border-amber-500 font-medium"
            style={{ background: "#FFFBF5" }}
          />
        </div>
        <div className="flex-1 space-y-1.5 w-full">
          <label className="text-xs font-semibold text-amber-800">To Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-amber-200 outline-none text-sm focus:border-amber-500 font-medium"
            style={{ background: "#FFFBF5" }}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching}
          className="w-full md:w-auto px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all text-white flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg,#c8960c,#D4AF37)",
            boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
          }}
        >
          {searching ? <RefreshCw className="animate-spin" size={14} /> : <FileText size={14} />}
          Get Report
        </button>
      </div>

      {/* Report results */}
      {searched && (
        <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden">
          {daybooks.length === 0 ? (
            <div className="text-center py-12 text-amber-800/60 font-serif">
              No daybook entries found in this date range.
            </div>
          ) : (
            <div className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-amber-50 pb-4 mb-6">
                <div>
                  <h3 className="font-bold text-sm font-serif text-amber-950">Summary For Selected Range</h3>
                  <p className="text-[10px] text-amber-800/65 font-medium mt-0.5">
                    {fmtDateFriendly(startDate)} to {fmtDateFriendly(endDate)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-amber-800/60 uppercase">Period Start Bal</p>
                    <p className="text-sm font-bold text-amber-950 font-mono">{fmt(totalOpening)}</p>
                  </div>
                  <div className="w-[1px] h-8 bg-amber-100" />
                  <div className="text-right">
                    <p className="text-[10px] font-semibold text-amber-800/60 uppercase">Period End Bal</p>
                    <p className="text-sm font-bold text-amber-950 font-mono">{fmt(totalClosing)}</p>
                  </div>
                </div>
              </div>

              {/* Table list */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-amber-100" style={{ color: "#8B6914" }}>
                      <th className="py-3 px-2 font-bold font-serif">Date</th>
                      <th className="py-3 px-2 font-bold font-serif text-right">Opening Cash</th>
                      <th className="py-3 px-2 font-bold font-serif text-right">Opening UPI</th>
                      <th className="py-3 px-2 font-bold font-serif text-right">Closing Cash</th>
                      <th className="py-3 px-2 font-bold font-serif text-right">Closing UPI</th>
                      <th className="py-3 px-2 font-bold font-serif text-right">Closing Total</th>
                      <th className="py-3 px-2 font-bold font-serif text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daybooks.map((db) => {
                      const totalCloseVal = db.closing_cash + db.closing_upi + db.closing_other;
                      return (
                        <tr key={db.id} className="border-b border-amber-50 hover:bg-amber-50/20 transition-colors">
                          <td className="py-3 px-2 font-bold text-amber-950 font-mono">{db.date}</td>
                          <td className="py-3 px-2 text-right font-mono">{fmt(db.opening_cash)}</td>
                          <td className="py-3 px-2 text-right font-mono text-indigo-600">{fmt(db.opening_upi)}</td>
                          <td className="py-3 px-2 text-right font-mono font-bold text-amber-900">{fmt(db.closing_cash)}</td>
                          <td className="py-3 px-2 text-right font-mono text-indigo-700 font-bold">{fmt(db.closing_upi)}</td>
                          <td className="py-3 px-2 text-right font-mono font-black text-amber-950">{fmt(totalCloseVal)}</td>
                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={() => onSelectDate(db.date)}
                              className="px-3 py-1 rounded-lg text-[10px] font-bold border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors"
                            >
                              Open Ledger
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SettingsViewProps {
  currentDate: string;
  onRefresh: (dateStr: string) => void;
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

function SettingsView({ currentDate, onRefresh, showNotification }: SettingsViewProps) {
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dbFileInputRef = useRef<HTMLInputElement>(null);

  const [goldRate, setGoldRate] = useState("3");
  const [silverRate, setSilverRate] = useState("10");
  const [graceDays, setGraceDays] = useState("0");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setGoldRate(localStorage.getItem("gold_interest_rate") || "3");
      setSilverRate(localStorage.getItem("silver_interest_rate") || "10");
      setGraceDays(localStorage.getItem("grace_days") || "0");
    }
  }, []);

  const handleSaveSchemeSettings = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("gold_interest_rate", goldRate);
      localStorage.setItem("silver_interest_rate", silverRate);
      localStorage.setItem("grace_days", graceDays);
      showNotification("Pledge scheme settings saved successfully!", "success");
    }
  };

  const triggerManualSync = async () => {
    setSyncing(true);
    showNotification("Syncing with cloud…", "info");
    const count = await syncOfflineQueue();
    setSyncing(false);
    showNotification(count > 0 ? `Synced ${count} offline records` : "All data up to date", "success");
    if (currentDate) onRefresh(currentDate);
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showNotification("Importing backup...", "info");
    const ok = await importBackup(file);
    showNotification(ok ? "Backup imported successfully!" : "Import failed. Invalid file format.", ok ? "success" : "error");
    if (ok && currentDate) onRefresh(currentDate);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSqliteBackup = () => {
    const pw = prompt("Enter Admin Password:");
    if (!pw) return;
    if (pw !== "pooja123") {
      showNotification("Incorrect password", "error");
      return;
    }
    downloadDatabaseBackup(pw);
    showNotification("Downloading database file backup...", "success");
  };

  const handleSqliteRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const pw = prompt("Enter Admin Password to RESTORE (This will overwrite all active data!):");
    if (!pw) {
      if (dbFileInputRef.current) dbFileInputRef.current.value = "";
      return;
    }
    if (pw !== "pooja123") {
      showNotification("Incorrect password", "error");
      if (dbFileInputRef.current) dbFileInputRef.current.value = "";
      return;
    }

    const confirmRestore = confirm("WARNING: Restoring will overwrite the current database and replace it. Are you absolutely sure?");
    if (!confirmRestore) {
      if (dbFileInputRef.current) dbFileInputRef.current.value = "";
      return;
    }

    try {
      const ok = await restoreDatabaseBackup(pw, file);
      if (ok) {
        showNotification("Database file restored successfully!", "success");
        if (currentDate) onRefresh(currentDate);
      } else {
        showNotification("Database restore failed. Make sure the file is a valid SQLite .db file.", "error");
      }
    } catch (err: any) {
      showNotification(`Restore failed: ${err.message}`, "error");
    } finally {
      if (dbFileInputRef.current) dbFileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black font-serif" style={{ color: "#2D1B0E" }}>
          Settings & Utilities
        </h2>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#FFF9F0", border: "1px solid rgba(212,175,55,0.25)", color: "#8B6914" }}>
          System
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Backup and Restore */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <Download size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-amber-955 font-serif">JSON Backup</h3>
              <p className="text-[10px] text-amber-800/60 font-medium">Export all ledgers to local JSON storage or import them back.</p>
            </div>
          </div>

          <div className="border-t border-amber-50 pt-4 flex flex-col gap-3">
            <button
              onClick={exportBackup}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
            >
              <Download size={14} />
              Export JSON Backup
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold border border-amber-200 text-amber-800 hover:bg-amber-50 transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={14} />
              Import JSON Backup
            </button>
            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleImportBackup}
              className="hidden"
            />
          </div>
        </div>

        {/* Database Synchronization */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              <RefreshCw size={20} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-amber-955 font-serif">Sync Manager</h3>
              <p className="text-[10px] text-amber-800/60 font-medium">Manually push any local offline records to the cloud database.</p>
            </div>
          </div>

          <div className="border-t border-amber-50 pt-4">
            <button
              onClick={triggerManualSync}
              disabled={syncing}
              className="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wide transition-all text-white flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg,#c8960c,#D4AF37)",
                boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
              }}
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : "Sync Offline Queue Now"}
            </button>
          </div>
        </div>

        {/* Interest & Grace Settings */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
              ⚙️
            </div>
            <div>
              <h3 className="font-bold text-sm text-amber-955 font-serif">Pledge Schemes</h3>
              <p className="text-[10px] text-amber-800/60 font-medium">Default interest rates and grace periods for pledge releases.</p>
            </div>
          </div>

          <div className="border-t border-amber-50 pt-4 space-y-3">
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-amber-850 mb-1">Gold Interest Rate (% / month)</label>
              <input
                type="number"
                step="0.1"
                value={goldRate}
                onChange={(e) => setGoldRate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold focus:border-amber-500"
                style={{ background: "#FFFBF5" }}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-amber-850 mb-1">Silver Interest Rate (% / month)</label>
              <input
                type="number"
                step="0.1"
                value={silverRate}
                onChange={(e) => setSilverRate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold focus:border-amber-500"
                style={{ background: "#FFFBF5" }}
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold uppercase tracking-wider text-amber-850 mb-1">Grace Period (Days)</label>
              <input
                type="number"
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold focus:border-amber-500"
                style={{ background: "#FFFBF5" }}
              />
            </div>
            <button
              onClick={handleSaveSchemeSettings}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wide transition-all text-white flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg,#c8960c,#D4AF37)",
                boxShadow: "0 2px 8px rgba(212,175,55,0.3)",
              }}
            >
              Save Scheme Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
