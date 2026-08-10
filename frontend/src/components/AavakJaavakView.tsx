"use client";

import React, { useState, useEffect, useMemo } from "react";
import { fetchAavakJaavakReport, AavakJaavakReport, AavakJaavakItem } from "../utils/api";

export default function AavakJaavakView() {
  const [report, setReport] = useState<AavakJaavakReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [dateQuick, setDateQuick] = useState<string>("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [flowType, setFlowType] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [paymentMode, setPaymentMode] = useState<string>("ALL");
  const [udharFilter, setUdharFilter] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const loadData = async () => {
    setLoading(true);
    let sDate = startDate;
    let eDate = endDate;

    if (dateQuick === "TODAY") {
      const today = new Date().toISOString().split("T")[0];
      sDate = today;
      eDate = today;
    } else if (dateQuick === "YESTERDAY") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yest = d.toISOString().split("T")[0];
      sDate = yest;
      eDate = yest;
    } else if (dateQuick === "LAST_7") {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      sDate = d.toISOString().split("T")[0];
      eDate = new Date().toISOString().split("T")[0];
    } else if (dateQuick === "THIS_MONTH") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      sDate = firstDay;
      eDate = new Date().toISOString().split("T")[0];
    } else if (dateQuick === "ALL") {
      sDate = "";
      eDate = "";
    }

    const data = await fetchAavakJaavakReport({
      startDate: sDate,
      endDate: eDate,
      flowType,
      paymentMode,
      category,
      search,
      udharFilter
    });

    setReport(data);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [dateQuick, startDate, endDate, flowType, category, paymentMode, search, udharFilter]);


  const categoryLabels: Record<string, { label: string; color: string }> = {
    INTEREST: { label: "Interest (Vyaj)", color: "bg-amber-100 text-amber-800 border-amber-300" },
    GIRVI_PLEDGE: { label: "Girvi Pledge", color: "bg-purple-100 text-purple-800 border-purple-300" },
    GIRVI_RELEASE: { label: "Girvi Release", color: "bg-teal-100 text-teal-800 border-teal-300" },
    SALES: { label: "Sales (Jewellery)", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    EXPENSE: { label: "Shop Expense", color: "bg-rose-100 text-rose-800 border-rose-300" },
    UDHAR: { label: "Udhar / Loan", color: "bg-blue-100 text-blue-800 border-blue-300" },
    CREDIT_JAMA: { label: "Credit / Jama", color: "bg-indigo-100 text-indigo-800 border-indigo-300" },
    DEBIT_NAAVE: { label: "Debit / Naave", color: "bg-orange-100 text-orange-800 border-orange-300" },
    OLD_METAL: { label: "Old Metal Exch.", color: "bg-stone-100 text-stone-800 border-stone-300" },
  };

  const summary = report?.summary || {
    total_taken: 0,
    total_given: 0,
    net_flow: 0,
    interest_taken: 0,
    interest_given: 0,
    net_interest: 0,
    count: 0
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Title & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-200/60 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-amber-950 flex items-center gap-2">
            <span>📥📤</span> Master Given & Taken (Aavak - Jaavak) Register
          </h1>
          <p className="text-sm text-amber-800 mt-1">
            Complete real-time ledger of all Inflows (Taken) and Outflows (Given) across Cash & UPI accounts.
          </p>
        </div>

        <button
          onClick={() => window.print()}
          className="self-start md:self-auto px-4 py-2 bg-amber-900 hover:bg-amber-950 text-white font-medium text-sm rounded-lg shadow transition-all flex items-center gap-2"
        >
          🖨️ Print Statement
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Taken Card */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Total Taken (Aavak / Jama)</span>
            <span className="text-lg">📥</span>
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-2">
            {formatCurrency(summary.total_taken)}
          </p>
          <span className="text-xs text-emerald-600 font-medium">All Inflows (Sales, Releases, Jama)</span>
        </div>

        {/* Total Given Card */}
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Total Given (Jaavak / Naave)</span>
            <span className="text-lg">📤</span>
          </div>
          <p className="text-2xl font-black text-rose-900 mt-2">
            {formatCurrency(summary.total_given)}
          </p>
          <span className="text-xs text-rose-600 font-medium">All Outflows (Girvi, Debits, Expenses)</span>
        </div>

        {/* Net Flow Card */}
        <div className={`border rounded-xl p-4 shadow-sm ${summary.net_flow >= 0 ? "bg-indigo-50 border-indigo-200" : "bg-orange-50 border-orange-200"}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase tracking-wider ${summary.net_flow >= 0 ? "text-indigo-700" : "text-orange-700"}`}>
              Net Flow Surplus / Deficit
            </span>
            <span className="text-lg">⚖️</span>
          </div>
          <p className={`text-2xl font-black mt-2 ${summary.net_flow >= 0 ? "text-indigo-950" : "text-orange-950"}`}>
            {formatCurrency(summary.net_flow)}
          </p>
          <span className={`text-xs font-medium ${summary.net_flow >= 0 ? "text-indigo-600" : "text-orange-600"}`}>
            {summary.net_flow >= 0 ? "Positive Net Cashflow" : "Negative Net Cashflow"}
          </span>
        </div>

        {/* Interest Summary Card */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Interest Summary</span>
            <span className="text-lg">💰</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-emerald-700">Received (Aavak):</span>
              <span className="font-bold text-emerald-800">{formatCurrency(summary.interest_taken)}</span>
            </div>
            <div className="flex justify-between text-xs font-medium">
              <span className="text-rose-700">Paid Out (Jaavak):</span>
              <span className="font-bold text-rose-800">{formatCurrency(summary.interest_given)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold border-t border-amber-300 pt-1 text-amber-950">
              <span>Net Interest Earned:</span>
              <span>{formatCurrency(summary.net_interest)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls & Filter Panel */}
      <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm space-y-4">
        {/* Date Filter Quick Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase text-amber-900 mr-2">Date Filter:</span>
          {[
            { id: "ALL", label: "All Dates" },
            { id: "TODAY", label: "Today" },
            { id: "YESTERDAY", label: "Yesterday" },
            { id: "LAST_7", label: "Last 7 Days" },
            { id: "THIS_MONTH", label: "This Month" },
          ].map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setDateQuick(b.id);
                setStartDate("");
                setEndDate("");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                dateQuick === b.id
                  ? "bg-amber-900 text-white shadow-sm"
                  : "bg-amber-100/70 text-amber-900 hover:bg-amber-200"
              }`}
            >
              {b.label}
            </button>
          ))}

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDateQuick("CUSTOM");
              }}
              className="px-2 py-1 text-xs border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-xs text-amber-700">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDateQuick("CUSTOM");
              }}
              className="px-2 py-1 text-xs border border-amber-300 rounded-md focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2 border-t border-amber-100">
          {/* Flow Type Selector */}
          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">Flow Type</label>
            <select
              value={flowType}
              onChange={(e) => setFlowType(e.target.value)}
              className="w-full text-xs p-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="ALL">All (Taken & Given)</option>
              <option value="TAKEN">📥 Taken / Inflow (Aavak)</option>
              <option value="GIVEN">📤 Given / Outflow (Jaavak)</option>
            </select>
          </div>

          {/* Udhar Filter Selector */}
          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">Udhar (Borrow/Lend)</label>
            <select
              value={udharFilter}
              onChange={(e) => setUdharFilter(e.target.value)}
              className="w-full text-xs p-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:border-amber-500 font-medium text-amber-950"
            >
              <option value="ALL">All Transactions</option>
              <option value="ONLY_UDHAR">🤝 Udhar Only (Loans & Debt)</option>
              <option value="NON_UDHAR">💼 Regular Non-Udhar Flow</option>
            </select>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full text-xs p-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="ALL">All Categories</option>
              <option value="INTEREST">💰 Interest Only (Vyaj)</option>
              <option value="GIRVI_PLEDGE">🔒 New Girvi Pledges</option>
              <option value="GIRVI_RELEASE">🔓 Girvi Releases</option>
              <option value="SALES">🛍️ Sales (Gold/Silver)</option>
              <option value="UDHAR">🤝 Udhar / Loans</option>
              <option value="EXPENSE">💸 Shop Expenses</option>
              <option value="CREDIT_JAMA">📥 Credit / Jama</option>
              <option value="DEBIT_NAAVE">📤 Debit / Naave</option>
            </select>
          </div>

          {/* Payment Mode Selector */}
          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">Payment Method</label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full text-xs p-2 border border-amber-300 rounded-lg bg-white focus:outline-none focus:border-amber-500 font-medium"
            >
              <option value="ALL">All Modes (Cash & UPI)</option>
              <option value="CASH">💵 Cash Only</option>
              <option value="UPI">📱 All UPI</option>
              <option value="hdfc_192">🏦 HDFC Bank (-192)</option>
              <option value="hdfc_od_7442">🏦 HDFC OD (-7442)</option>
              <option value="pooja_068">🏦 Pooja Jewellers (-068)</option>
              <option value="vikash">🏦 Vikash</option>
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-bold text-amber-900 mb-1">Search Keyword</label>
            <input
              type="text"
              placeholder="Search party name, details..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs p-2 border border-amber-300 rounded-lg focus:outline-none focus:border-amber-500 font-medium"
            />
          </div>
        </div>
      </div>

      {/* Master Table */}
      <div className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 bg-amber-50/50 border-b border-amber-200 flex items-center justify-between">
          <span className="text-sm font-bold text-amber-950">
            Statement Records ({report?.items?.length || 0} entries)
          </span>
          {loading && <span className="text-xs text-amber-700 animate-pulse">Loading data...</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-amber-100/60 text-amber-900 font-bold uppercase tracking-wider border-b border-amber-200">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Category</th>
                <th className="p-3">Udhar?</th>
                <th className="p-3">Party / Name</th>
                <th className="p-3">Particulars & Remarks</th>
                <th className="p-3">Payment Mode</th>
                <th className="p-3 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-amber-800">
                    Loading Given & Taken records...
                  </td>
                </tr>
              ) : !report?.items || report.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center p-8 text-amber-800">
                    No matching transactions found for the selected filters.
                  </td>
                </tr>
              ) : (
                report.items.map((item) => {
                  const catMeta = categoryLabels[item.category] || {
                    label: item.category,
                    color: "bg-gray-100 text-gray-800 border-gray-200"
                  };

                  return (
                    <tr key={item.id} className="hover:bg-amber-50/50 transition-colors">
                      <td className="p-3 font-mono font-medium text-amber-950 whitespace-nowrap">
                        {item.date}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {item.flow_type === "TAKEN" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            📥 TAKEN (Aavak)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            📤 GIVEN (Jaavak)
                          </span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${catMeta.color}`}>
                          {catMeta.label}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {item.is_udhar ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                            🤝 Udhar
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            ⚪ Regular
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-semibold text-amber-950">
                        {item.party_name}
                      </td>
                      <td className="p-3 text-amber-800 max-w-xs truncate">
                        {item.particulars}
                      </td>
                      <td className="p-3 font-medium text-amber-900 whitespace-nowrap">
                        {item.mode.includes("CASH") ? (
                          <span className="text-amber-800">💵 Cash</span>
                        ) : (
                          <span className="text-indigo-800">📱 {item.mode}</span>
                        )}
                      </td>
                      <td className={`p-3 text-right font-mono font-bold text-sm whitespace-nowrap ${
                        item.flow_type === "TAKEN" ? "text-emerald-700" : "text-rose-700"
                      }`}>
                        {item.flow_type === "TAKEN" ? "+" : "-"}{formatCurrency(item.amount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
