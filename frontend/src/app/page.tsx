"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import QRCode from "qrcode";
import {
  Calendar, ArrowLeft, ArrowRight, Download, Upload,
  RefreshCw, FileText, CheckCircle2, TrendingUp,
  BookOpen, LayoutDashboard, Settings, LogOut,
  ChevronLeft, ChevronRight, Wallet, Coins, Smartphone,
  BarChart3, Menu, X, CloudOff, CloudCheck, Plus, ShoppingCart, Package,
  Archive, FolderOpen, Users, History, Calculator, Landmark, ShieldCheck, Layers,
} from "lucide-react";
import {
  PledgeEntry, downloadDatabaseBackup, restoreDatabaseBackup, API_BASE,
} from "../utils/api";
import { exportBackup, importBackup } from "../utils/backup";
import { fetchInternetTime, getSyncedDate, getSyncedDateString, getIsInternetTimeSynced, checkSystemVsGoogleTime, TimeCheckResult } from "../utils/timeUtils";
import LuxuryLogin from "../components/LuxuryLogin";
import GirviLedgerView from "../components/GirviLedgerView";
import PledgeFormView from "../components/PledgeFormView";
import SystemLogsView from "../components/SystemLogsView";
import BankRePledgeLedgerView from "../components/BankRePledgeLedgerView";
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
  { id: "pledge_form", icon: Plus, label: "Girvi Form", active: true },
  { id: "existing_girvi", icon: Plus, label: "Existing Girvi", active: false },
  { id: "pledges", icon: Coins, label: "Girvi Ledger", active: false },
  { id: "bank_repledge", icon: Landmark, label: "Bank Re-Pledge", active: false },
  { id: "backup_audit", icon: ShieldCheck, label: "Data & Backups", active: false },
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard", active: false },
  { id: "system_logs", icon: History, label: "System Logs", active: false },
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
  const [timeAlertConfirmed, setTimeAlertConfirmed] = useState<boolean>(true);

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
  const [daybook, setDaybook] = useState<any>(null);
  const [isSynced, setIsSynced] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [showTimeSyncModal, setShowTimeSyncModal] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);
  const [selectedPrintPledge, setSelectedPrintPledge] = useState<PledgeEntry | null>(null);
  const [printBackSide, setPrintBackSide] = useState<boolean>(false);

  const pathname = usePathname();
  const router = useRouter();

  const [unlockedTabs, setUnlockedTabs] = useState<string[]>([]);
  const [lockPassword, setLockPassword] = useState("");
  const [lockError, setLockError] = useState("");

  const handleUnlockTab = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockPassword === "pooja123") {
      setUnlockedTabs([...unlockedTabs, activeNav]);
      setLockPassword("");
      setLockError("");
    } else {
      setLockError("Incorrect password. Please try again.");
    }
  };

  const isTabLocked = (tabId: string) => {
    if (tabId === "dashboard" || tabId === "system_logs") {
      return !unlockedTabs.includes(tabId);
    }
    return false;
  };

  const getNavFromPath = (path: string) => {
    const clean = path.replace(/^\//, "");
    if (!clean) return "pledge_form";
    return NAV.some(item => item.id === clean) ? clean : "pledge_form";
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [showSetup, setShowSetup] = useState<boolean>(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [passwordError, setPasswordError] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const clean = window.location.pathname.replace(/^\//, "");
      if (clean && NAV.some(item => item.id === clean)) {
        return clean;
      }
    }
    return "pledge_form";
  });
  const [currentTime, setCurrentTime] = useState(() => getSyncedDate());

  // Sync activeNav state with path changes (Back/Forward browser buttons)
  useEffect(() => {
    if (pathname) {
      const nav = getNavFromPath(pathname);
      if (nav !== activeNav) {
        setActiveNav(nav);
      }
    }
  }, [pathname]);

  // Logout if user goes back to the root page '/'
  useEffect(() => {
    if (pathname === "/" && isAuthenticated) {
      localStorage.removeItem("pooja_daybook_auth");
      localStorage.removeItem("pooja_daybook_token");
      setIsAuthenticated(false);
    }
  }, [pathname, isAuthenticated]);

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
      const response = await originalFetch(input, init);
      
      if (response.status === 401) {
        try {
          const clone = response.clone();
          const body = await clone.json();
          if (body.detail === "SESSION_SUPERSEDED") {
            localStorage.removeItem("pooja_daybook_auth");
            localStorage.removeItem("pooja_daybook_token");
            setIsAuthenticated(false);
            window.alert("Another login was detected on a different device. You have been logged out.");
          }
        } catch (e) {
          // ignore non-json or failed parses
        }
      }
      return response;
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
      
      if (data.status === "session_active") {
        const proceed = window.confirm(
          "Another device is currently logged in. Logging in here will log out the other device. Do you want to continue?"
        );
        if (proceed) {
          const forceRes = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, force: true })
          });
          if (!forceRes.ok) return false;
          const forceData = await forceRes.json();
          if (forceData.access_token) {
            localStorage.setItem("pooja_daybook_token", forceData.access_token);
            localStorage.setItem("pooja_daybook_auth", "true");
            setIsAuthenticated(true);
            router.push("/pledge_form");
            return true;
          }
        }
        return false;
      }

      const token = data.access_token;

      localStorage.setItem("pooja_daybook_token", token);
      localStorage.setItem("pooja_daybook_auth", "true");
      setIsAuthenticated(true);
      router.push("/pledge_form");
      return true;
    } catch (err) {
      console.error("Login request error:", err);
      return false;
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

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = await importBackup(file);
    showNotification(ok ? "Backup imported!" : "Import failed.", ok ? "success" : "error");
  };


  // ── Guard: Login ──────────────────────────────────────────────────────────
  if (!isAuthenticated) return <LuxuryLogin onLogin={handleLogin} />;

  // ── Sidebar width ─────────────────────────────────────────────────────────
  const SW = sidebarOpen ? 220 : 68;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "#F5F0E8", fontFamily: "'Segoe UI', sans-serif" }}
    >
      <style>{`
        @keyframes slide-down { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fade-in    { from { opacity:0; } to { opacity:1; } }
        .nav-item { transition: background 0.15s, color 0.15s; }
        .nav-item:hover { background: rgba(212,175,55,0.12); }
        .sidebar-transition { transition: width 0.25s cubic-bezier(0.4,0,0.2,1); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @media print {
          .print-hidden { display: none !important; }
        }
      `}</style>

      {/* ── Main App Content (hidden when printing modal overlay) ── */}
      <div className={`flex flex-col flex-1 ${selectedPrintPledge ? "print:hidden" : ""}`}>
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
                GIRVI MANAGER
              </p>
              <p className="text-[9px] font-semibold tracking-widest uppercase" style={{ color: "#C8A87A" }}>
                Pooja Jewellers
              </p>
            </div>
          </div>
        </div>



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
            <span className="hidden md:inline">Calculator</span>
          </button>

          {/* Action buttons (Desktop only) */}
          <button
            onClick={exportBackup}
            title="Download Backup"
            className="hidden md:flex h-9 items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-colors hover:bg-amber-50 cursor-pointer"
            style={{ border: "1px solid rgba(212,175,55,0.25)", color: "#8B6914" }}
          >
            <Download size={14} />
            <span className="hidden sm:inline">Backup</span>
          </button>

          <label
            title="Import Backup"
            className="hidden md:flex h-9 items-center gap-1.5 px-3 rounded-xl text-xs font-semibold transition-colors hover:bg-amber-50 cursor-pointer"
            style={{ border: "1px solid rgba(212,175,55,0.25)", color: "#8B6914" }}
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Import</span>
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>

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
          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto no-scrollbar">
            {NAV.map(item => {
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveNav(item.id); router.push(`/${item.id}`); }}
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
                boxShadow: "4px 0 24px rgba(0,0,0,0.12)", zIndex: 50, height: "100%"
              }}
            >
              <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid rgba(212,175,55,0.15)" }}>
                <span className="font-black text-sm" style={{ color: "#2D1B0E", fontFamily: "Georgia, serif" }}>GIRVI MANAGER</span>
                <button onClick={() => setMobileSidebarOpen(false)}>
                  <X size={18} style={{ color: "#8B6914" }} />
                </button>
              </div>
              <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto no-scrollbar">
                {NAV.map(item => {
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setActiveNav(item.id); setMobileSidebarOpen(false); router.push(`/${item.id}`); }}
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

          <div className="main-content px-2 py-3 sm:px-4 sm:py-6">



            {isTabLocked(activeNav) ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] max-w-sm mx-auto p-8 bg-white rounded-3xl border border-amber-100 shadow-md text-center my-12 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl mb-4 select-none">
                  🔒
                </div>
                <h3 className="font-bold text-sm font-serif mb-1" style={{ color: "#2D1B0E" }}>
                  Locked Section
                </h3>
                <p className="text-[11px] text-amber-800/60 font-semibold mb-6 leading-relaxed">
                  The {activeNav === "dashboard" ? "Dashboard" : "System Logs"} contains sensitive information. Please enter the security password to unlock.
                </p>
                
                <form onSubmit={handleUnlockTab} className="w-full space-y-4">
                  <div>
                    <input
                      type="password"
                      value={lockPassword}
                      onChange={(e) => { setLockPassword(e.target.value); setLockError(""); }}
                      placeholder="Enter password"
                      className="w-full text-xs p-3 border border-amber-200 rounded-xl outline-none focus:border-amber-500 font-sans"
                      style={{ background: "#FFFBF5" }}
                      required
                      autoFocus
                    />
                    {lockError && (
                      <p className="text-[10px] text-red-650 font-bold text-left mt-1.5">⚠️ {lockError}</p>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer"
                    style={{ background: "linear-gradient(135deg,#c8960c,#d4af37)" }}
                  >
                    Unlock Section
                  </button>
                </form>
              </div>
            ) : (
              <>
                {activeNav === "pledge_form" && (
                  <PledgeFormView
                    currentDate={currentDate}
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
                    isExisting={true}
                    onSuccess={(pledge) => {
                      setSelectedPrintPledge(pledge);
                      setActiveNav("pledges");
                    }}
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
                    onSelectPrintPledge={(p) => setSelectedPrintPledge(p)}
                    showNotification={showNotification}
                    onSwitchToForm={() => setActiveNav("pledge_form")}
                  />
                )}
                {activeNav === "bank_repledge" && (
                  <BankRePledgeLedgerView
                    currentDate={currentDate}
                    showNotification={showNotification}
                  />
                )}
                {activeNav === "dashboard" && <DashboardView />}
                {activeNav === "settings" && (
                  <SettingsView
                    currentDate={currentDate}
                    showNotification={showNotification}
                  />
                )}
              </>
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
                                { no: 1, ornament: p.ornament, gross: p.gross_weight || p.weight || 0, less: p.less_weight || 0, net: p.net_weight || p.weight || 0, val: p.estimated_value || 0 }
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
                          No. of PIECES: {p.quantity || 1}
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

interface DashboardStats {
  outstanding_girvi: number;
  active_girvi_count: number;
  total_released_girvi_amount: number;
  total_released_girvi_count: number;
  total_repledged_amount: number;
  total_repledged_count: number;
  active_gold_wt_safe: number;
  active_gold_wt_bank: number;
  active_silver_wt_safe: number;
  active_silver_wt_bank: number;
  upcoming_due_pledges: {
    id: number;
    pledge_no: string;
    customer_name: string;
    amount: number;
    due_date: string;
    mobile: string;
    ornament: string;
    weight: number;
  }[];
  recent_logs: {
    id: number;
    timestamp: string;
    action: string;
    details: string;
    module: string;
  }[];
  monthly_trends?: {
    month_key: string;
    label: string;
    principal: number;
    count: number;
  }[];
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

  const handleWhatsAppNotification = (p: any) => {
    const cleanPhone = p.mobile ? p.mobile.replace(/\D/g, "") : "";
    if (!cleanPhone) {
      alert("Customer mobile number not found!");
      return;
    }
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `ॐ.
प्रिय ग्राहक,
आपका गिरवी खाता क्रमांक (Pledge No): *${p.pledge_no || "N/A"}* दिनांक *${formatDateDMY(p.due_date)}* को पूर्ण हो रहा है। कृपया दुकान पर आकर अपना ब्याज एवं मूलधन जमा करवाएं।
निवेदक: पूजा ज्वेलर्स (9829562725)`;
    const url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const isOverdue = (dueDateStr: string) => {
    const today = new Date().toISOString().split("T")[0];
    return dueDateStr < today;
  };

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

  const safeGold = stats.active_gold_wt_safe || 0;
  const bankGold = stats.active_gold_wt_bank || 0;
  const totalGold = safeGold + bankGold || 1;
  const goldSafePct = (safeGold / totalGold) * 100;

  const safeSilver = stats.active_silver_wt_safe || 0;
  const bankSilver = stats.active_silver_wt_bank || 0;
  const totalSilver = safeSilver + bankSilver || 1;
  const silverSafePct = (safeSilver / totalSilver) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black font-serif" style={{ color: "#2D1B0E" }}>
          Girvi & Bank Dashboard
        </h2>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: "#FFF9F0", border: "1px solid rgba(212,175,55,0.25)", color: "#8B6914" }}>
          Live Monitor
        </span>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outstanding Girvi */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-amber-50 border border-amber-250/30 text-amber-700">
            <Coins size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-800/60 uppercase tracking-wider">Active Girvi Loan</p>
            <p className="text-xl font-bold font-mono text-amber-950 mt-0.5">{fmt(stats.outstanding_girvi)}</p>
            <p className="text-[10px] text-amber-600 font-bold mt-0.5">{stats.active_girvi_count} Active Pledges</p>
          </div>
        </div>

        {/* Bank Re-pledge */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50 border border-indigo-150 text-indigo-750">
            <Landmark size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-850/60 uppercase tracking-wider">Bank Re-Pledge Loan</p>
            <p className="text-xl font-bold font-mono text-indigo-950 mt-0.5">{fmt(stats.total_repledged_amount)}</p>
            <p className="text-[10px] text-indigo-600 font-bold mt-0.5">{stats.total_repledged_count} Pledges Re-pledged</p>
          </div>
        </div>

        {/* Released Girvi */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-200 text-emerald-700">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-800/60 uppercase tracking-wider">Released Principal</p>
            <p className="text-xl font-bold font-mono text-emerald-955 mt-0.5">{fmt(stats.total_released_girvi_amount)}</p>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{stats.total_released_girvi_count} Released Loans</p>
          </div>
        </div>

        {/* Total Custody Weight */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-650">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800/60 uppercase tracking-wider">Total Active Gold Wt</p>
            <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">{(safeGold + bankGold).toFixed(2)} g</p>
            <p className="text-[10px] text-slate-650 font-bold mt-0.5">Silver: {((safeSilver + bankSilver) / 1000).toFixed(2)} kg</p>
          </div>
        </div>
      </div>

      {/* Visual Analytics Row */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Trend Chart (8 cols) */}
          <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm lg:col-span-8 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-bold text-sm font-serif" style={{ color: "#2D1B0E" }}>
                  Monthly Pledge Trends
                </h3>
                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Last 6 Months</span>
              </div>
              <p className="text-[10px] text-amber-800/60 font-medium mb-4">Volume of principal sum and count of loans registered.</p>
            </div>

            <div className="relative w-full h-[160px]">
              {(() => {
                const trends = stats.monthly_trends || [];
                if (trends.length === 0) {
                  return (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-amber-800/50 font-semibold italic">
                      No trend data available
                    </div>
                  );
                }
                const maxVal = Math.max(...trends.map(t => t.principal || 0), 100000);
                const chartW = 600;
                const chartH = 150;
                const marginL = 65;
                const marginR = 20;
                const marginT = 15;
                const marginB = 25;
                const plotW = chartW - marginL - marginR;
                const plotH = chartH - marginT - marginB;

                const points = trends.map((t, idx) => {
                  const x = marginL + (idx / (trends.length - 1 || 1)) * plotW;
                  const y = marginT + plotH - ((t.principal || 0) / maxVal) * plotH;
                  return { x, y, label: t.label, val: t.principal, count: t.count };
                });

                let pathD = "";
                let areaD = "";
                if (points.length > 0) {
                  pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(" ");
                  areaD = `${pathD} L ${points[points.length - 1].x} ${marginT + plotH} L ${points[0].x} ${marginT + plotH} Z`;
                }

                // Y-Axis tick points (3 ticks: 0, max/2, max)
                const yTicks = [0, maxVal / 2, maxVal];

                return (
                  <svg className="w-full h-full" viewBox={`0 0 ${chartW} ${chartH}`} preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#D4AF37" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Gridlines */}
                    {yTicks.map((tick, idx) => {
                      const y = marginT + plotH - (tick / maxVal) * plotH;
                      return (
                        <g key={idx}>
                          <line
                            x1={marginL}
                            y1={y}
                            x2={chartW - marginR}
                            y2={y}
                            stroke="#f5ebe0"
                            strokeWidth="1"
                            strokeDasharray="4,4"
                          />
                          <text
                            x={marginL - 10}
                            y={y + 4}
                            textAnchor="end"
                            className="font-mono text-[9px] font-bold fill-amber-900/60"
                          >
                            ₹{(tick / 1000).toFixed(0)}k
                          </text>
                        </g>
                      );
                    })}

                    {/* Area path */}
                    {areaD && <path d={areaD} fill="url(#chartGrad)" />}

                    {/* Line path */}
                    {pathD && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#c8960c"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Interactive points & labels */}
                    {points.map((p, idx) => (
                      <g key={idx} className="group cursor-pointer">
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="4"
                          fill="white"
                          stroke="#c8960c"
                          strokeWidth="2.5"
                        />
                        {/* Hover circle indicator */}
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="8"
                          fill="#c8960c"
                          fillOpacity="0"
                          className="hover:fill-opacity-20 transition-all"
                        />
                        {/* X-Axis Labels */}
                        <text
                          x={p.x}
                          y={chartH - 5}
                          textAnchor="middle"
                          className="text-[9px] font-bold fill-amber-900/70"
                        >
                          {p.label}
                        </text>
                        {/* Tooltip on point hover */}
                        <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <rect
                            x={p.x - 45}
                            y={p.y - 35}
                            width="90"
                            height="24"
                            rx="6"
                            fill="#4A2800"
                            style={{ filter: "drop-shadow(0px 2px 4px rgba(0,0,0,0.15))" }}
                          />
                          <text
                            x={p.x}
                            y={p.y - 25}
                            textAnchor="middle"
                            fill="white"
                            className="font-mono text-[8px] font-black"
                          >
                            ₹{p.val.toLocaleString("en-IN")} ({p.count})
                          </text>
                        </g>
                      </g>
                    ))}
                  </svg>
                );
              })()}
            </div>
          </div>

          {/* Safe vs Bank Valuation Doughnut Chart (4 cols) */}
          <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm lg:col-span-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-sm font-serif mb-1" style={{ color: "#2D1B0E" }}>
                Loan Book Distribution
              </h3>
              <p className="text-[10px] text-amber-800/60 font-medium mb-4">Book value allocation of Safe vs Bank.</p>
            </div>

            <div className="flex items-center justify-center py-2">
              {(() => {
                const total = stats.outstanding_girvi || 1;
                const bankVal = stats.total_repledged_amount || 0;
                const safeVal = Math.max(total - bankVal, 0);
                const safePct = (safeVal / total) * 100;
                const bankPct = (bankVal / total) * 100;

                const radius = 36;
                const circ = 2 * Math.PI * radius;
                const safeStrokeOffset = circ - (safePct / 100) * circ;
                const bankStrokeOffset = circ - (bankPct / 100) * circ;

                return (
                  <div className="relative w-[130px] h-[130px] flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="transparent"
                        stroke="#f5ebe0"
                        strokeWidth="10"
                      />
                      {bankVal > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke="#6366f1"
                          strokeWidth="10"
                          strokeDasharray={circ}
                          strokeDashoffset={bankStrokeOffset}
                          strokeLinecap="round"
                          className="transition-all duration-700"
                        />
                      )}
                      {safeVal > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="transparent"
                          stroke="#D4AF37"
                          strokeWidth="10"
                          strokeDashoffset={safeStrokeOffset}
                          strokeDasharray={`${(safePct / 100) * circ} ${circ}`}
                          className="transition-all duration-700"
                        />
                      )}
                    </svg>
                    <div className="absolute flex flex-col items-center text-center">
                      <span className="text-[10px] font-bold text-amber-800/60 uppercase tracking-widest leading-none">Safe</span>
                      <span className="text-lg font-black text-amber-950 leading-tight mt-1">{safePct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="border-t border-amber-50 pt-4 mt-2 space-y-2 text-xs font-bold font-sans">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37]" />
                  <span className="text-amber-900/80">In-Store Safe</span>
                </div>
                <span className="font-mono text-amber-950">₹{Math.max(stats.outstanding_girvi - stats.total_repledged_amount, 0).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-indigo-900/80">Bank Re-Pledge</span>
                </div>
                <span className="font-mono text-indigo-950">₹{stats.total_repledged_amount.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custody Distribution Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gold Custody */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm font-serif mb-1" style={{ color: "#2D1B0E" }}>
              Gold Custody Distribution
            </h3>
            <p className="text-[10px] text-amber-800/60 font-medium mb-6">Physical safe custody (shop) vs bank re-pledged custody.</p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex justify-between text-xs font-bold text-amber-955">
              <span>Safe Custody (Shop)</span>
              <span className="font-mono">{safeGold.toFixed(2)} g ({goldSafePct.toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-amber-50 h-3 rounded-full overflow-hidden border border-amber-200/30">
              <div
                className="bg-[#D4AF37] h-full rounded-full transition-all duration-500"
                style={{ width: `${goldSafePct}%` }}
              />
            </div>

            <div className="flex justify-between text-xs font-bold text-indigo-750">
              <span>Bank Custody</span>
              <span className="font-mono">{bankGold.toFixed(2)} g ({(100 - goldSafePct).toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-indigo-50 h-3 rounded-full overflow-hidden border border-indigo-150">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${100 - goldSafePct}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between border-t border-amber-50 pt-4 mt-6 text-xs text-amber-900/80 font-bold">
            <span>Total Active Gold Weight</span>
            <span className="font-mono">{(safeGold + bankGold).toFixed(2)} g</span>
          </div>
        </div>

        {/* Silver Custody */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm font-serif mb-1" style={{ color: "#2D1B0E" }}>
              Silver Custody Distribution
            </h3>
            <p className="text-[10px] text-amber-800/60 font-medium mb-6">Physical safe custody (shop) vs bank re-pledged custody.</p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="flex justify-between text-xs font-bold text-amber-955">
              <span>Safe Custody (Shop)</span>
              <span className="font-mono">{(safeSilver / 1000).toFixed(2)} kg ({silverSafePct.toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-amber-50 h-3 rounded-full overflow-hidden border border-amber-200/30">
              <div
                className="bg-slate-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${silverSafePct}%` }}
              />
            </div>

            <div className="flex justify-between text-xs font-bold text-indigo-750">
              <span>Bank Custody</span>
              <span className="font-mono">{(bankSilver / 1000).toFixed(2)} kg ({(100 - silverSafePct).toFixed(1)}%)</span>
            </div>
            <div className="w-full bg-indigo-50 h-3 rounded-full overflow-hidden border border-indigo-150">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${100 - silverSafePct}%` }}
              />
            </div>
          </div>

          <div className="flex justify-between border-t border-amber-50 pt-4 mt-6 text-xs text-amber-900/80 font-bold">
            <span>Total Active Silver Weight</span>
            <span className="font-mono">{((safeSilver + bankSilver) / 1000).toFixed(2)} kg</span>
          </div>
        </div>
      </div>

      {/* Row 2: Upcoming Due Dates & Recent Audits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upcoming Due Pledges (7 cols) */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm lg:col-span-7 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm font-serif mb-1" style={{ color: "#2D1B0E" }}>
              Pledges Nearing Due Date (12-Month Limit)
            </h3>
            <p className="text-[10px] text-amber-800/60 font-medium mb-4">Immediate attention required: pledges expiring soon or overdue.</p>
          </div>

          <div className="overflow-x-auto flex-1 min-h-[220px]">
            {stats.upcoming_due_pledges.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-amber-800/50">
                <CheckCircle2 size={36} className="text-emerald-500 mb-2" />
                <p className="text-xs font-semibold">No pledges nearing their due date.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-amber-100 text-amber-800">
                    <th className="py-2.5 px-1 font-bold">Pledge No</th>
                    <th className="py-2.5 px-2 font-bold">Customer Name</th>
                    <th className="py-2.5 px-2 font-bold text-right">Principal</th>
                    <th className="py-2.5 px-2 font-bold text-center">Due Date</th>
                    <th className="py-2.5 px-2 font-bold text-center">Status</th>
                    <th className="py-2.5 px-1 font-bold text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.upcoming_due_pledges.map((p) => {
                    const overdue = isOverdue(p.due_date);
                    return (
                      <tr key={p.id} className="border-b border-amber-50 hover:bg-amber-50/10">
                        <td className="py-3 px-1 font-bold text-amber-955 font-mono">{p.pledge_no}</td>
                        <td className="py-3 px-2 font-semibold text-amber-955 max-w-[120px] truncate" title={p.customer_name}>{p.customer_name}</td>
                        <td className="py-3 px-2 font-bold font-mono text-right text-amber-900">{fmt(p.amount)}</td>
                        <td className="py-3 px-2 font-semibold font-mono text-center text-amber-850">{formatDateDMY(p.due_date)}</td>
                        <td className="py-3 px-2 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${overdue ? "bg-red-50 text-red-650 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                            {overdue ? "Overdue" : "Nearing"}
                          </span>
                        </td>
                        <td className="py-3 px-1 text-center">
                          <button
                            onClick={() => handleWhatsAppNotification(p)}
                            title="Send WhatsApp Notification"
                            className="p-1.5 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 active:scale-90 transition-all cursor-pointer"
                          >
                            💬
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent System Audits (5 cols) */}
        <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm lg:col-span-5 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm font-serif mb-1" style={{ color: "#2D1B0E" }}>
              Recent System Audits
            </h3>
            <p className="text-[10px] text-amber-800/60 font-medium mb-4">Latest ledger modifications and system actions recorded.</p>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[250px] pr-1">
            {stats.recent_logs.length === 0 ? (
              <p className="text-xs text-center py-12 text-amber-800/40">No audits logged yet.</p>
            ) : (
              stats.recent_logs.map((log) => {
                let badgeColor = "bg-amber-50 text-amber-700 border border-amber-200";
                if (log.action.includes("DELETE")) badgeColor = "bg-red-50 text-red-650 border border-red-200";
                if (log.action.includes("CREATE")) badgeColor = "bg-emerald-50 text-emerald-700 border border-emerald-250";
                
                return (
                  <div key={log.id} className="p-3 rounded-xl bg-amber-50/20 border border-amber-100/50 space-y-1.5 hover:shadow-xs transition-all">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-md text-[8px] font-black tracking-wide uppercase ${badgeColor}`}>
                        {log.action}
                      </span>
                      <span className="text-[9px] font-medium font-mono text-amber-800/50">
                        {log.timestamp ? log.timestamp.split(" ")[1] || log.timestamp : ""}
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-amber-955 leading-tight font-serif">
                      {log.details}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingsViewProps {
  currentDate: string;
  onRefresh?: (dateStr: string) => void;
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



  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showNotification("Importing backup...", "info");
    const ok = await importBackup(file);
    showNotification(ok ? "Backup imported successfully!" : "Import failed. Invalid file format.", ok ? "success" : "error");
    if (ok && currentDate) onRefresh?.(currentDate);
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
        if (currentDate) onRefresh?.(currentDate);
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
