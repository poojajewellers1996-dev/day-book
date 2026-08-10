"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, Download, Upload, RefreshCw, Database, 
  Clock, FileText, Search, AlertTriangle, CheckCircle, 
  History, Server, Sparkles, Filter
} from "lucide-react";
import { 
  BackupSnapshot, SystemLogEntry, fetchBackupsList, 
  createDatabaseSnapshot, restoreDatabaseBackup, fetchSystemLogs, API_BASE 
} from "../utils/api";

interface BackupAuditViewProps {
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

export default function BackupAuditView({ showNotification }: BackupAuditViewProps) {
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  
  // Filter states for Audit Trail
  const [logModuleFilter, setLogModuleFilter] = useState("ALL");
  const [logSearch, setLogSearch] = useState("");

  // Restore Modal State
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedRestoreFile, setSelectedRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [backupsData, logsData] = await Promise.all([
        fetchBackupsList(),
        fetchSystemLogs({ limit: 150, module: logModuleFilter, search: logSearch }),
      ]);
      setBackups(backupsData || []);
      setLogs(logsData || []);
    } catch (e) {
      showNotification("Failed to load backup and audit records", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [logModuleFilter, logSearch]);

  const handleCreateSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      const res = await createDatabaseSnapshot();
      if (res && res.success) {
        showNotification(`Snapshot created: ${res.filename}!`, "success");
        loadData();
      } else {
        showNotification("Failed to create snapshot", "error");
      }
    } catch (e) {
      showNotification("Error creating database snapshot", "error");
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleDirectDownload = () => {
    window.location.href = `${API_BASE}/backup/download`;
    showNotification("Downloading active SQLite database backup file...", "info");
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRestoreFile) {
      showNotification("Please select a .db database backup file", "error");
      return;
    }

    setRestoring(true);
    try {
      const res = await restoreDatabaseBackup(selectedRestoreFile);
      if (res && res.success) {
        showNotification(res.message || "Database restored successfully!", "success");
        setShowRestoreModal(false);
        setSelectedRestoreFile(null);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        showNotification("Failed to restore database from file", "error");
      }
    } catch (e) {
      showNotification("Error restoring database", "error");
    } finally {
      setRestoring(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 py-4 animate-fadeIn">
      {/* ── TOP HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-amber-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 shadow-sm">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="font-serif font-black text-xl text-amber-950 flex items-center gap-2">
              🔒 Data Safety & Backup System
            </h1>
            <p className="text-xs text-amber-800 font-medium">
              1-Click database backup & restore, automated snapshots, and activity audit log history
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-amber-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider">
            <span>Saved Snapshots</span>
            <Server size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-950">
            {backups.length} Files
          </div>
          <div className="text-[11px] text-amber-700 font-medium">
            Stored in server backups folder
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider">
            <span>Last Backup Date</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="text-lg font-black font-mono text-amber-950 truncate">
            {backups.length > 0 ? backups[0].timestamp : "No backups yet"}
          </div>
          <div className="text-[11px] text-emerald-700 font-bold flex items-center gap-1">
            <CheckCircle size={12} /> Auto 24-hour backup active
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200/90 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-amber-800 text-xs font-bold uppercase tracking-wider">
            <span>Audit Log Events</span>
            <History size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black font-mono text-amber-950">
            {logs.length} Logged Actions
          </div>
          <div className="text-[11px] text-amber-700 font-medium">
            Tracking updates, releases & backups
          </div>
        </div>
      </div>

      {/* ── 1-CLICK BACKUP & RESTORE ACTIONS GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Direct Download */}
        <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-sm hover:border-amber-400 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center font-bold">
              📥
            </div>
            <h3 className="font-bold text-base text-amber-950 font-serif">
              Download Active Database
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              Directly download the live SQLite database file (<code className="font-mono bg-amber-50 px-1 py-0.5 rounded border border-amber-200">.db</code>) to your computer for offline safe-keeping.
            </p>
          </div>
          <button
            onClick={handleDirectDownload}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-700 to-amber-800 text-white font-extrabold text-xs hover:from-amber-800 hover:to-amber-900 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Download size={16} /> Download .DB Backup File
          </button>
        </div>

        {/* Card 2: Create Manual Snapshot */}
        <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-sm hover:border-amber-400 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-900 border border-purple-300 flex items-center justify-center font-bold">
              ⚡
            </div>
            <h3 className="font-bold text-base text-amber-950 font-serif">
              Create Server Snapshot
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              Save an instant timestamped copy of your database directly onto the server backups directory for quick recovery.
            </p>
          </div>
          <button
            onClick={handleCreateSnapshot}
            disabled={snapshotLoading}
            className="w-full py-3 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs transition-all shadow-sm flex items-center justify-center gap-2"
          >
            {snapshotLoading ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Create Snapshot Now
          </button>
        </div>

        {/* Card 3: Restore Database File */}
        <div className="bg-white rounded-3xl p-6 border border-amber-200 shadow-sm hover:border-amber-400 transition-all space-y-4 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center justify-center font-bold">
              📤
            </div>
            <h3 className="font-bold text-base text-amber-950 font-serif">
              Restore Database
            </h3>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              Restore your Day Book from a previously downloaded <code className="font-mono bg-amber-50 px-1 py-0.5 rounded border border-amber-200">.db</code> backup file. Auto-creates a safety pre-restore backup.
            </p>
          </div>
          <button
            onClick={() => setShowRestoreModal(true)}
            className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Upload size={16} /> Restore from File
          </button>
        </div>
      </div>

      {/* ── AUTOMATED SERVER SNAPSHOTS LIST ── */}
      <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-amber-100 pb-3">
          <h2 className="font-bold text-base text-amber-950 flex items-center gap-2 font-serif">
            <Database size={18} className="text-amber-700" /> Server Backup Snapshots Log
          </h2>
          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
            {backups.length} Snapshots
          </span>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center text-amber-800 text-xs font-medium">
            No server snapshots found yet. Click <b>"Create Snapshot Now"</b> above to save one.
          </div>
        ) : (
          <div className="divide-y divide-amber-100 max-h-64 overflow-y-auto pr-1">
            {backups.map((b, i) => (
              <div key={i} className="py-3 flex items-center justify-between hover:bg-amber-50/50 px-2 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 border border-amber-200 flex items-center justify-center font-mono font-bold text-xs">
                    #{i + 1}
                  </div>
                  <div>
                    <div className="font-mono font-bold text-xs text-amber-950">
                      {b.filename}
                    </div>
                    <div className="text-[11px] text-amber-700 font-mono flex items-center gap-2 mt-0.5">
                      <span>🗓️ {b.timestamp}</span>
                      <span>•</span>
                      <span>📦 {formatBytes(b.size_bytes)}</span>
                    </div>
                  </div>
                </div>

                <a
                  href={`${API_BASE}/backup/download`}
                  className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold text-[11px] transition-colors flex items-center gap-1"
                >
                  <Download size={12} /> Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── ACTIVITY AUDIT TRAIL ── */}
      <div className="bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-3">
          <div>
            <h2 className="font-bold text-base text-amber-950 flex items-center gap-2 font-serif">
              📜 Activity Audit Trail Log
            </h2>
            <p className="text-xs text-amber-800 font-medium">
              Real-time event logging of database edits, releases, payments, and system backups
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-amber-500" size={14} />
              <input
                type="text"
                placeholder="Search audit log..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-xl border border-amber-200 text-xs outline-none focus:border-amber-500 font-medium w-44"
              />
            </div>

            {/* Module Filter */}
            <select
              value={logModuleFilter}
              onChange={(e) => setLogModuleFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-amber-200 text-xs font-bold text-amber-950 outline-none focus:border-amber-500 bg-white"
            >
              <option value="ALL">All Modules</option>
              <option value="BACKUP">🔒 Backups</option>
              <option value="BANK_REPLEDGE">🏦 Bank Re-Pledge</option>
              <option value="GIRVI">💍 Girvi Ledger</option>
              <option value="DAYBOOK">📖 Day Book</option>
              <option value="STOCK">📦 Stock Register</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        {logs.length === 0 ? (
          <div className="p-8 text-center text-amber-800 text-xs font-medium">
            No audit log entries matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-amber-50/80 text-amber-900 border-b border-amber-200">
                <tr>
                  <th className="py-3 px-4 font-serif">Timestamp</th>
                  <th className="py-3 px-4 font-serif">Module</th>
                  <th className="py-3 px-4 font-serif">Action Event</th>
                  <th className="py-3 px-4 font-serif">Details & Description</th>
                  <th className="py-3 px-4 font-serif text-right">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-amber-50/40 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3 px-4 font-mono font-bold text-amber-900 whitespace-nowrap">
                      🗓️ {log.timestamp}
                    </td>

                    {/* Module Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border bg-amber-100 text-amber-900 border-amber-200">
                        {log.module || "GENERAL"}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 font-mono font-black text-amber-950 whitespace-nowrap">
                      {log.action}
                    </td>

                    {/* Details */}
                    <td className="py-3 px-4 text-amber-950 font-medium leading-relaxed">
                      {log.details}
                    </td>

                    {/* User */}
                    <td className="py-3 px-4 text-right font-bold text-amber-800">
                      {log.user_name || "admin"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── RESTORE DATABASE MODAL ── */}
      {showRestoreModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-emerald-200">
            <div style={{ height: 4, background: "linear-gradient(90deg,#059669,#10b981)" }} />

            <div className="px-6 py-4 flex items-center justify-between border-b border-emerald-100 bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold">
                  📤
                </div>
                <div>
                  <h3 className="font-bold text-sm text-emerald-950">
                    Restore Database from Backup
                  </h3>
                  <p className="text-[10px] text-emerald-800 font-mono">
                    Select a valid SQLite .db database backup file
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="w-8 h-8 rounded-full hover:bg-emerald-100 flex items-center justify-center text-emerald-800 transition-colors font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestoreSubmit} className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <AlertTriangle size={16} className="text-amber-600" /> Pre-Restore Safety Guard
                </div>
                <p className="text-[11px] text-amber-800">
                  Restoring will replace the live database with your uploaded file. A safety backup of your current database will be saved automatically beforehand.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Select Backup Database File (.db) *
                </label>
                <input
                  type="file"
                  accept=".db"
                  required
                  onChange={(e) => setSelectedRestoreFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-amber-900 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-emerald-200 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-900 hover:file:bg-emerald-100 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowRestoreModal(false)}
                  className="w-1/3 py-2.5 rounded-xl border border-gray-300 font-bold text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={restoring || !selectedRestoreFile}
                  className="w-2/3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2"
                >
                  {restoring ? <RefreshCw className="animate-spin" size={14} /> : "Confirm & Restore"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
