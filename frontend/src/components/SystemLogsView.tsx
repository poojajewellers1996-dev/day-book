"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Clock,
  KeyRound,
  FileSpreadsheet
} from "lucide-react";
import { fetchSystemLogs, SystemLog } from "../utils/api";

interface SystemLogsViewProps {
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

const INPUT = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "12px",
  border: "1.5px solid #e8e0d4",
  outline: "none",
  fontSize: "14px",
  color: "#2D1B0E",
  background: "#FFFBF5",
  transition: "all 0.2s"
};

export default function SystemLogsView({ showNotification }: SystemLogsViewProps) {
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Check if authenticated in this tab session
  useEffect(() => {
    const savedAuth = sessionStorage.getItem("admin_logs_authenticated");
    const savedPass = sessionStorage.getItem("admin_logs_password");
    if (savedAuth === "true" && savedPass) {
      setPassword(savedPass);
      setIsAuthenticated(true);
      loadLogs(savedPass);
    }
  }, []);

  const loadLogs = async (pass: string) => {
    setLoading(true);
    try {
      const data = await fetchSystemLogs(pass);
      setLogs(data);
    } catch (e: any) {
      if (e.message === "Unauthorized") {
        showNotification("Incorrect password. Access denied.", "error");
        setIsAuthenticated(false);
        sessionStorage.removeItem("admin_logs_authenticated");
        sessionStorage.removeItem("admin_logs_password");
      } else {
        showNotification("Failed to load logs. Server error.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      showNotification("Please enter the password.", "error");
      return;
    }
    setVerifying(true);
    try {
      const data = await fetchSystemLogs(password);
      setLogs(data);
      setIsAuthenticated(true);
      sessionStorage.setItem("admin_logs_authenticated", "true");
      sessionStorage.setItem("admin_logs_password", password);
      showNotification("Authenticated successfully!", "success");
    } catch (e: any) {
      if (e.message === "Unauthorized") {
        showNotification("Incorrect admin password.", "error");
      } else {
        showNotification("Verification failed.", "error");
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    sessionStorage.removeItem("admin_logs_authenticated");
    sessionStorage.removeItem("admin_logs_password");
    showNotification("Logged out from system logs view.", "info");
  };

  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    return (
      log.action.toLowerCase().includes(q) ||
      log.details.toLowerCase().includes(q) ||
      log.timestamp.toLowerCase().includes(q)
    );
  });

  const getActionBadgeStyle = (action: string) => {
    const actionUpper = action.toUpperCase();
    if (actionUpper.includes("CREATE")) {
      return { background: "rgba(16, 185, 129, 0.08)", color: "#047857", border: "1px solid rgba(16, 185, 129, 0.2)" };
    }
    if (actionUpper.includes("DELETE")) {
      return { background: "rgba(239, 68, 68, 0.08)", color: "#b91c1c", border: "1px solid rgba(239, 68, 68, 0.2)" };
    }
    if (actionUpper.includes("UPDATE")) {
      return { background: "rgba(59, 130, 246, 0.08)", color: "#1d4ed8", border: "1px solid rgba(59, 130, 246, 0.2)" };
    }
    if (actionUpper.includes("RELEASE") || actionUpper.includes("PAYMENT")) {
      return { background: "rgba(139, 92, 246, 0.08)", color: "#6d28d9", border: "1px solid rgba(139, 92, 246, 0.2)" };
    }
    return { background: "rgba(139, 105, 20, 0.08)", color: "#8B6914", border: "1px solid rgba(139, 105, 20, 0.2)" };
  };

  if (!isAuthenticated) {
    return (
      <div
        style={{
          minHeight: "calc(100vh - 120px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #FAF8F5 0%, #F3EFE9 100%)",
          padding: 24
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 24,
            border: "1px solid rgba(212,175,55,0.2)",
            boxShadow: "0 20px 50px rgba(45,27,14,0.06), 0 4px 12px rgba(212,175,55,0.05)",
            width: "100%",
            maxWidth: 400,
            padding: 32,
            textAlign: "center"
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 18,
              background: "rgba(139,105,20,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px auto"
            }}
          >
            <ShieldAlert size={26} color="#8B6914" />
          </div>

          <h2
            style={{
              fontFamily: "Georgia, serif",
              fontWeight: 800,
              fontSize: 22,
              color: "#2D1B0E",
              margin: 0
            }}
          >
            System Logs Access
          </h2>
          <p style={{ fontSize: 13, color: "#8B7355", marginTop: 8, marginBottom: 24 }}>
            Only authorized administrators can view the audit log history. Enter the system password to proceed.
          </p>

          <form onSubmit={handleLoginSubmit} style={{ textAlign: "left" }}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#8B7355", marginBottom: 6 }}>
                Admin Password
              </label>
              <div style={{ position: "relative" }}>
                <KeyRound
                  size={16}
                  color="#8B7355"
                  style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ ...INPUT, paddingLeft: 40 }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={verifying}
              style={{
                width: "100%",
                background: "linear-gradient(135deg,#c8960c,#D4AF37)",
                color: "#4A2800",
                fontWeight: 800,
                fontSize: 14,
                padding: "12px",
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.2s"
              }}
              className="hover:scale-[1.02] active:scale-[0.98]"
            >
              {verifying ? <RefreshCw className="animate-spin" size={16} /> : "Verify & Unlock"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:px-6 sm:py-6" style={{ background: "#FAF8F5", minHeight: "calc(100vh - 80px)" }}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
        <div>
          <h1 className="font-serif font-black text-xl sm:text-2xl" style={{ color: "#2D1B0E", margin: 0 }}>
            System Audit Logs
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ margin: 0, color: "#8B7355" }}>
            Complete audit trail of modifications, creations, and deletions.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadLogs(password)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold hover:bg-amber-50/50 transition-colors"
            style={{ background: "white", border: "1.5px solid #8B6914", color: "#8B6914", cursor: "pointer" }}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-xl text-xs font-bold text-white"
            style={{ background: "#ef4444", border: "none", cursor: "pointer" }}
          >
            🔒 <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border overflow-hidden" style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
        {/* Filter bar */}
        <div className="px-3 py-3 sm:px-6 sm:py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: "#FFFBF7" }}>
          <div style={{ position: "relative" }}>
            <Search size={16} color="#8B7355" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ ...INPUT, paddingLeft: 38, background: "white", fontSize: 13 }}
            />
          </div>
        </div>

        {/* Mobile: Card List */}
        <div className="block sm:hidden divide-y" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
          {filteredLogs.length > 0 ? filteredLogs.map((log) => {
            const badgeStyle = getActionBadgeStyle(log.action);
            return (
              <div key={log.id} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.5px", padding: "2px 7px", borderRadius: 5, display: "inline-block", ...badgeStyle }}>
                    {log.action}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: "#8B7355" }}>{log.timestamp}</span>
                </div>
                <p className="text-xs font-medium mt-1" style={{ color: "#4A3B32", margin: 0 }}>{log.details}</p>
              </div>
            );
          }) : (
            <div className="py-12 text-center">
              <FileSpreadsheet size={32} color="#c8b090" style={{ margin: "0 auto 8px auto" }} />
              <p className="text-sm font-bold" style={{ color: "#8B7355" }}>{loading ? "Loading..." : "No logs found."}</p>
            </div>
          )}
        </div>

        {/* Desktop: Table */}
        <div className="hidden sm:block" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#F5EFE6", borderBottom: "2px solid rgba(139,105,20,0.1)" }}>
                <th style={{ padding: "14px 24px", fontSize: 12, fontWeight: 800, color: "#5C4033", width: 180 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Clock size={12} /> TIMESTAMP</span>
                </th>
                <th style={{ padding: "14px 24px", fontSize: 12, fontWeight: 800, color: "#5C4033", width: 220 }}>ACTION CATEGORY</th>
                <th style={{ padding: "14px 24px", fontSize: 12, fontWeight: 800, color: "#5C4033" }}>AUDIT DETAILS</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const badgeStyle = getActionBadgeStyle(log.action);
                  return (
                    <tr key={log.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }} className="hover:bg-amber-50/20 transition-colors">
                      <td style={{ padding: "16px 24px", fontSize: 13, color: "#2D1B0E", fontWeight: 600, fontFamily: "monospace" }}>{log.timestamp}</td>
                      <td style={{ padding: "16px 24px" }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.5px", padding: "3px 8px", borderRadius: 6, display: "inline-block", ...badgeStyle }}>{log.action}</span>
                      </td>
                      <td style={{ padding: "16px 24px", fontSize: 13.5, color: "#4A3B32", fontWeight: 500 }}>{log.details}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} style={{ padding: "64px 24px", textAlign: "center" }}>
                    <FileSpreadsheet size={40} color="#c8b090" style={{ margin: "0 auto 12px auto" }} />
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#8B7355" }}>{loading ? "Loading logs..." : "No system logs found."}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
