"use client";

import React, { useState, useEffect } from "react";
import { Search, Printer, Trash2, RefreshCw, AlertCircle, Coins, FileText, Edit, X, Save, User, Tag, FileSpreadsheet, Phone, MapPin } from "lucide-react";
import * as XLSX from "xlsx";
import { SoldItem, fetchAllSoldItems, deleteSubEntry, updateSoldItem, sendBackendWhatsAppPdfInvoice } from "../utils/api";
import { formatSaleInvoiceMsg, openWhatsApp, sanitizePhoneNumber } from "../utils/whatsapp";
import { generateAndDownloadInvoicePDF, shareOrDownloadPDF, copyInvoiceToClipboardAndOpenWhatsApp } from "../utils/pdf";






const formatDateDMY = (dateStr: string | undefined) => {
  if (!dateStr) return "—";
  if (dateStr.includes("/")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

interface SalesLedgerViewProps {
  onSelectPrintBill: (item: SoldItem) => void;
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

export interface GroupedSaleBill {
  billKey: string;
  invoiceNo: string;
  bookNo: string;
  billType: string;
  date: string;
  customerName: string;
  mobile: string;
  address: string;
  aadhar: string;
  pan: string;
  items: SoldItem[];
  totalQty: number;
  totalWeight: number;
  totalAmount: number;
  cashAmount: number;
  upiAmount: number;
  otherAmount: number;
  hasBarcode: boolean;
  metals: string[];
}

export default function SalesLedgerView({
  onSelectPrintBill,
  showNotification,
}: SalesLedgerViewProps) {
  const [sales, setSales] = useState<SoldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [metalFilter, setMetalFilter] = useState<"ALL" | "GOLD" | "SILVER">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"BARCODE_ONLY" | "SMALL_ONLY" | "ALL">("BARCODE_ONLY");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "GST" | "ESTIMATE">("ALL");

  // Excel Export Modal state
  const [showExcelExportModal, setShowExcelExportModal] = useState(false);
  const [exportFromDate, setExportFromDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]
  );
  const [exportToDate, setExportToDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // WhatsApp Invoice Modal state
  const [whatsappModal, setWhatsappModal] = useState<{
    bill: GroupedSaleBill;
    phone: string;
    message: string;
  } | null>(null);

  // Edit Modal state

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SoldItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    customerName: "",
    mobile: "",
    address: "",
    aadhar: "",
    pan: "",
    invoiceNo: "",
    bookNo: "",
    barcode: "",
    rate: "",
    metal: "GOLD",
    billType: "GST",
    qty: "1",
    weight: "",
    cashAmount: "",
    upiAmount: "",
    otherAmount: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const loadSales = async () => {
    setLoading(true);
    const data = await fetchAllSoldItems();
    setSales(data);
    setLoading(false);
  };

  useEffect(() => {
    loadSales();
  }, []);

  const handleDelete = async (item: SoldItem) => {
    if (confirm("Are you sure you want to delete this sale entry?")) {
      const dateStr = item.date || new Date().toISOString().split("T")[0];
      const success = await deleteSubEntry(dateStr, "sold-item", item.id);
      if (success) {
        showNotification("Sale entry deleted successfully", "success");
        loadSales();
      } else {
        showNotification("Failed to delete entry", "error");
      }
    }
  };

  const cleanItemName = (name: string) => {
    return name
      .replace(/^\[(GOLD|SILVER)\]\s*/i, "")
      .replace(/\[TYPE:[^\]]+\]\s*/i, "")
      .replace(/\[SPLIT:[^\]]+\]\s*/i, "")
      .replace(/\[CUST:[^\]]+\]\s*/i, "")
      .replace(/\[INV:[^\]]+\]\s*/i, "")
      .replace(/\[BOOK:[^\]]+\]\s*/i, "")
      .replace(/\[PRICE:[^\]]+\]\s*/i, "")
      .replace(/\[BARCODE:[^\]]+\]\s*/i, "")
      .trim();
  };

  const parseSoldItemDetails = (item_name: string) => {
    const metal = item_name.includes("SILVER") ? "SILVER" : "GOLD";
    
    const typeMatch = item_name.match(/\[TYPE:([^\]]+)\]/);
    let billType = "ESTIMATE";
    if (typeMatch) {
      billType = typeMatch[1].trim().toUpperCase();
    } else if (item_name.includes("[GST]")) {
      billType = "GST";
    }

    const billMatch = item_name.match(/\[BILL:([^\]]+)\]/);
    const billGroupId = billMatch ? billMatch[1].trim() : "";

    const splitMatch = item_name.match(/\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?\]/);
    const cash = splitMatch ? parseFloat(splitMatch[1]) || 0 : 0;
    const upi = splitMatch ? parseFloat(splitMatch[2]) || 0 : 0;
    const other = splitMatch ? parseFloat(splitMatch[3]) || 0 : 0;

    const custMatch = item_name.match(/\[CUST:([^\]]+)\]/);
    let customerName = "";
    let mobile = "";
    let address = "";
    let aadhar = "";
    let pan = "";
    if (custMatch) {
      const parts = custMatch[1].split("|");
      customerName = parts[0] || "";
      mobile = parts[1] || "";
      address = parts[2] || "";
      aadhar = parts[3] || "";
      pan = parts[4] || "";
    }

    const invMatch = item_name.match(/\[INV:([^\]]+)\]/);
    const invoiceNo = invMatch ? invMatch[1].trim() : "";

    const bookMatch = item_name.match(/\[BOOK:([^\]]+)\]/);
    const bookNo = bookMatch ? bookMatch[1].trim() : "";

    const barcodeMatch = item_name.match(/\[BARCODE:([^\]]+)\]/);
    const barcode = barcodeMatch ? barcodeMatch[1].trim() : "";

    const priceMatch = item_name.match(/\[PRICE:([^\]]+)\]/);
    const rate = priceMatch ? priceMatch[1].trim() : "";

    const name = cleanItemName(item_name);
    return { metal, billType, billGroupId, cash, upi, other, customerName, mobile, address, aadhar, pan, invoiceNo, bookNo, barcode, rate, name };
  };

  const groupSalesByBill = (salesList: SoldItem[]): GroupedSaleBill[] => {
    const groupsMap = new Map<string, GroupedSaleBill>();

    salesList.forEach((item) => {
      const parsed = parseSoldItemDetails(item.item_name);
      const date = item.date || "";

      let billKey = "";
      if (parsed.invoiceNo) {
        billKey = `${date}_INV_${parsed.invoiceNo}`;
      } else if (parsed.billGroupId) {
        billKey = `${date}_GROUP_${parsed.billGroupId}`;
      } else if (parsed.customerName) {
        billKey = `${date}_CUST_${parsed.customerName}_${parsed.billType}_${parsed.cash}_${parsed.upi}_${parsed.other}`;
      } else {
        billKey = `${date}_ITEM_${item.id}`;
      }

      const hasBarcode = Boolean(parsed.barcode || item.item_name.includes("[BARCODE:"));

      if (!groupsMap.has(billKey)) {
        groupsMap.set(billKey, {
          billKey,
          invoiceNo: parsed.invoiceNo || "",
          bookNo: parsed.bookNo || "",
          billType: parsed.billType,
          date,
          customerName: parsed.customerName || "Cash Customer",
          mobile: parsed.mobile,
          address: parsed.address,
          aadhar: parsed.aadhar,
          pan: parsed.pan,
          items: [item],
          totalQty: item.quantity || 1,
          totalWeight: item.weight || 0,
          totalAmount: item.amount || 0,
          cashAmount: parsed.cash,
          upiAmount: parsed.upi,
          otherAmount: parsed.other,
          hasBarcode,
          metals: [parsed.metal],
        });
      } else {
        const group = groupsMap.get(billKey)!;
        group.items.push(item);
        group.totalQty += item.quantity || 1;
        group.totalWeight += item.weight || 0;
        group.totalAmount += item.amount || 0;
        if (hasBarcode) group.hasBarcode = true;
        if (!group.metals.includes(parsed.metal)) group.metals.push(parsed.metal);
      }
    });

    const billsList = Array.from(groupsMap.values());

    // Respect manual invoice numbers and do not auto-override
    billsList.forEach((bill) => {
      if (bill.billType === "ESTIMATE" && !bill.items.some(it => it.item_name.includes("[INV:"))) {
        bill.invoiceNo = "";
        bill.bookNo = "";
      }
    });

    return billsList;
  };

  const handleDeleteBillGroup = async (bill: GroupedSaleBill) => {
    if (confirm(`Are you sure you want to delete this bill (${bill.invoiceNo}) with ${bill.items.length} item(s)?`)) {
      let successCount = 0;
      for (const item of bill.items) {
        const dateStr = item.date || new Date().toISOString().split("T")[0];
        const success = await deleteSubEntry(dateStr, "sold-item", item.id);
        if (success) successCount++;
      }
      if (successCount > 0) {
        showNotification(`Deleted ${successCount} item(s) in bill ${bill.invoiceNo}`, "success");
        loadSales();
      } else {
        showNotification("Failed to delete entry", "error");
      }
    }
  };

  const exportBarcodeBillsToExcel = (salesList: SoldItem[], fromDate: string, toDate: string) => {
    const grouped = groupSalesByBill(salesList);
    const filtered = grouped.filter((bill) => {
      const d = bill.date || "";
      const isGstInvoice = bill.billType === "GST";
      const inDateRange = (!fromDate || d >= fromDate) && (!toDate || d <= toDate);
      return bill.hasBarcode && isGstInvoice && inDateRange;
    });

    if (filtered.length === 0) {
      showNotification("No GST barcode stock bills found for the selected date range", "error");
      return;
    }

    let grandBase = 0;
    let grandCgst = 0;
    let grandSgst = 0;
    let grandTotal = 0;

    const rows = filtered.map((bill) => {
      const invNo = bill.invoiceNo;
      const custName = bill.customerName || "Cash Customer";

      const totalAmt = bill.totalAmount || 0;
      const baseAmt = Math.round((totalAmt / 1.03) * 100) / 100;
      const cgst = Math.round((baseAmt * 0.015) * 100) / 100;
      const sgst = Math.round((baseAmt * 0.015) * 100) / 100;

      grandBase += baseAmt;
      grandCgst += cgst;
      grandSgst += sgst;
      grandTotal += totalAmt;

      let modeOfPayment = "Cash";
      if (bill.cashAmount > 0 && bill.upiAmount > 0 && bill.otherAmount > 0) {
        modeOfPayment = `Cash: ₹${bill.cashAmount}, UPI: ₹${bill.upiAmount}, Other: ₹${bill.otherAmount}`;
      } else if (bill.cashAmount > 0 && bill.upiAmount > 0) {
        modeOfPayment = `Cash: ₹${bill.cashAmount}, UPI: ₹${bill.upiAmount}`;
      } else if (bill.upiAmount > 0) {
        modeOfPayment = "UPI";
      } else if (bill.otherAmount > 0) {
        modeOfPayment = "Other";
      } else {
        modeOfPayment = "Cash";
      }

      return {
        "Date": formatDateDMY(bill.date),
        "Invoice Number": invNo,
        "Name of Customer": custName,
        "Amount Without GST (₹)": baseAmt,
        "CGST (1.5%) (₹)": cgst,
        "SGST (1.5%) (₹)": sgst,
        "Total Amount (₹)": totalAmt,
        "Mode of Payment": modeOfPayment,
      };
    });

    // Append Total Row at the bottom
    rows.push({
      "Date": "TOTAL",
      "Invoice Number": "",
      "Name of Customer": `${filtered.length} Bills Total`,
      "Amount Without GST (₹)": Math.round(grandBase * 100) / 100,
      "CGST (1.5%) (₹)": Math.round(grandCgst * 100) / 100,
      "SGST (1.5%) (₹)": Math.round(grandSgst * 100) / 100,
      "Total Amount (₹)": Math.round(grandTotal * 100) / 100,
      "Mode of Payment": "",
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Barcode Stock Bills");

    worksheet["!cols"] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 26 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 30 },
    ];

    const fileName = `Barcode_Stock_Bills_${fromDate || "Start"}_to_${toDate || "End"}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    showNotification(`Exported ${filtered.length} barcode stock bills to Excel!`, "success");
  };

  const handleOpenEdit = (item: SoldItem) => {
    setEditingItem(item);
    const parsed = parseSoldItemDetails(item.item_name);
    setEditForm({
      name: parsed.name,
      customerName: parsed.customerName,
      mobile: parsed.mobile,
      address: parsed.address,
      aadhar: parsed.aadhar,
      pan: parsed.pan,
      invoiceNo: parsed.invoiceNo || "",
      bookNo: parsed.bookNo || "",
      barcode: parsed.barcode,
      rate: parsed.rate,
      metal: parsed.metal,
      billType: parsed.billType || "GST",
      qty: item.quantity.toString(),
      weight: item.weight.toString(),
      cashAmount: (parsed.cash > 0 || parsed.upi > 0 || parsed.other > 0) ? parsed.cash.toString() : item.amount.toString(),
      upiAmount: parsed.upi > 0 ? parsed.upi.toString() : "",
      otherAmount: parsed.other > 0 ? parsed.other.toString() : "",
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const cashAmt = parseFloat(editForm.cashAmount || "0");
    const upiAmt = parseFloat(editForm.upiAmount || "0");
    const otherAmt = parseFloat(editForm.otherAmount || "0");
    const totalAmt = cashAmt + upiAmt + otherAmt;

    setSavingEdit(true);
    try {
      const dateStr = editingItem.date || new Date().toISOString().split("T")[0];
      
      let newItemName = `[${editForm.metal}][TYPE:${editForm.billType}][SPLIT:C${cashAmt}:U${upiAmt}:O${otherAmt}]`;
      
      const custParts = [
        editForm.customerName.trim(),
        editForm.mobile.trim(),
        editForm.address.trim(),
        editForm.aadhar.trim(),
        editForm.pan.trim()
      ].join("|");

      if (custParts.replace(/\|/g, "").trim()) {
        newItemName += ` [CUST:${custParts}]`;
      }
      if (editForm.invoiceNo.trim()) {
        newItemName += ` [INV:${editForm.invoiceNo.trim()}]`;
      }
      if (editForm.bookNo.trim()) {
        newItemName += ` [BOOK:${editForm.bookNo.trim()}]`;
      }
      if (editForm.barcode.trim()) {
        newItemName += ` [BARCODE:${editForm.barcode.trim()}]`;
      }
      if (editForm.rate.trim()) {
        newItemName += ` [PRICE:${editForm.rate.trim()}]`;
      }
      newItemName += ` ${editForm.name.trim()}`;

      const success = await updateSoldItem(editingItem.id, dateStr, {
        item_name: newItemName,
        quantity: parseInt(editForm.qty) || 1,
        weight: parseFloat(editForm.weight) || 0,
        amount: totalAmt,
      });

      if (success) {
        showNotification("Sale entry updated successfully", "success");
        setShowEditModal(false);
        setEditingItem(null);
        loadSales();
      } else {
        showNotification("Failed to update sale entry", "error");
      }
    } catch (err) {
      console.error(err);
      showNotification("Error updating sale entry", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const getMetalType = (name: string): "Gold" | "Silver" => {
    return name.toUpperCase().includes("SILVER") ? "Silver" : "Gold";
  };

  const barcodeCount = sales.filter((item) => {
    const parsed = parseSoldItemDetails(item.item_name);
    return Boolean(parsed.barcode || item.item_name.includes("[BARCODE:"));
  }).length;

  const smallCount = sales.length - barcodeCount;

  const gstCount = sales.filter(item => parseSoldItemDetails(item.item_name).billType === "GST").length;
  const estimateCount = sales.filter(item => parseSoldItemDetails(item.item_name).billType === "ESTIMATE").length;

  // Filter logic
  const filteredSales = sales.filter((item) => {
    const termClean = searchTerm.trim().toLowerCase();
    
    // QR Code bill tracking match
    if (termClean.startsWith("bill-")) {
      const targetId = termClean.replace("bill-", "");
      return item.id?.toString() === targetId;
    }

    const parsed = parseSoldItemDetails(item.item_name);
    const hasBarcode = Boolean(parsed.barcode || item.item_name.includes("[BARCODE:"));

    const categoryMatch =
      categoryFilter === "ALL" ||
      (categoryFilter === "BARCODE_ONLY" && hasBarcode) ||
      (categoryFilter === "SMALL_ONLY" && !hasBarcode);

    const typeMatchCheck =
      typeFilter === "ALL" ||
      (typeFilter === "GST" && parsed.billType === "GST") ||
      (typeFilter === "ESTIMATE" && parsed.billType === "ESTIMATE");

    const searchTarget = `${parsed.name} ${parsed.customerName} ${parsed.mobile} ${parsed.bookNo} ${parsed.invoiceNo} ${parsed.barcode}`.toLowerCase();
    const nameMatch = searchTarget.includes(termClean);
    
    const type = getMetalType(item.item_name);
    const metalMatch = 
      metalFilter === "ALL" || 
      (metalFilter === "GOLD" && type === "Gold") || 
      (metalFilter === "SILVER" && type === "Silver");

    return categoryMatch && typeMatchCheck && nameMatch && metalMatch;
  });

  // Totals calculations
  const totalAmount = filteredSales.reduce((sum, item) => sum + item.amount, 0);
  const totalQty = filteredSales.reduce((sum, item) => sum + item.quantity, 0);
  const goldWeight = filteredSales
    .filter((item) => getMetalType(item.item_name) === "Gold")
    .reduce((sum, item) => sum + item.weight, 0);
  const silverWeight = filteredSales
    .filter((item) => getMetalType(item.item_name) === "Silver")
    .reduce((sum, item) => sum + item.weight, 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-4">
      {/* Category Selection Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-amber-100/50 p-1.5 rounded-2xl border border-amber-900/10 shadow-2xs">
        <button
          onClick={() => setCategoryFilter("BARCODE_ONLY")}
          className={`flex-1 sm:flex-initial py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            categoryFilter === "BARCODE_ONLY"
              ? "bg-emerald-800 text-white shadow-md"
              : "text-amber-900 hover:bg-amber-100/60"
          }`}
        >
          🏷️ Barcode Stock Bills ({barcodeCount})
        </button>
        <button
          onClick={() => setCategoryFilter("SMALL_ONLY")}
          className={`flex-1 sm:flex-initial py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            categoryFilter === "SMALL_ONLY"
              ? "bg-amber-800 text-white shadow-md"
              : "text-amber-900 hover:bg-amber-100/60"
          }`}
        >
          💵 Small Counter Sales ({smallCount})
        </button>
        <button
          onClick={() => setCategoryFilter("ALL")}
          className={`flex-1 sm:flex-initial py-2 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
            categoryFilter === "ALL"
              ? "bg-amber-950 text-white shadow-md"
              : "text-amber-900 hover:bg-amber-100/60"
          }`}
        >
          📋 All Sales Combined ({sales.length})
        </button>
      </div>

      {/* Search and Secondary Filters Bar */}
      <div 
        className="flex flex-col md:flex-row gap-3 items-center justify-between p-4 rounded-2xl bg-white border border-amber-900/10 shadow-xs"
        style={{ background: "#FFFDF9" }}
      >
        <div className="flex flex-col lg:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-amber-900/40" />
            <input
              type="text"
              placeholder="Search by customer, invoice no, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full bg-white border border-amber-900/15 rounded-xl text-xs text-amber-955 focus:outline-none focus:ring-1 focus:ring-amber-800"
            />
          </div>

          {/* Bill Type Filter Toggle (GST vs ESTIMATE) */}
          <div className="flex bg-amber-50/70 p-1 rounded-xl border border-amber-900/10 w-full sm:w-auto">
            <button
              onClick={() => setTypeFilter("ALL")}
              className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                typeFilter === "ALL"
                  ? "bg-amber-950 text-white shadow-xs"
                  : "text-amber-900 hover:bg-amber-100/40"
              }`}
            >
              🌐 All Types
            </button>
            <button
              onClick={() => setTypeFilter("GST")}
              className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                typeFilter === "GST"
                  ? "bg-emerald-800 text-white shadow-xs"
                  : "text-amber-900 hover:bg-amber-100/40"
              }`}
            >
              🧾 GST Invoices ({gstCount})
            </button>
            <button
              onClick={() => setTypeFilter("ESTIMATE")}
              className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1 ${
                typeFilter === "ESTIMATE"
                  ? "bg-amber-800 text-white shadow-xs"
                  : "text-amber-900 hover:bg-amber-100/40"
              }`}
            >
              📋 Estimate Bills ({estimateCount})
            </button>
          </div>

          {/* Metal Toggle Filter */}
          <div className="flex bg-amber-50/50 p-1 rounded-xl border border-amber-900/10 w-full sm:w-auto">
            {["ALL", "GOLD", "SILVER"].map((metal) => (
              <button
                key={metal}
                onClick={() => setMetalFilter(metal as any)}
                className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  metalFilter === metal
                    ? "bg-amber-800 text-white shadow-xs"
                    : "text-amber-900 hover:bg-amber-100/35"
                }`}
              >
                {metal === "ALL" ? "All Metals" : metal === "GOLD" ? "Gold Only" : "Silver Only"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowExcelExportModal(true)}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            title="Download Excel Report for Barcode Stock Bills"
          >
            <FileSpreadsheet size={14} />
            Export Excel
          </button>
          <button
            onClick={loadSales}
            disabled={loading}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 border border-amber-300 hover:bg-amber-50 rounded-xl text-xs font-bold text-amber-900 transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-amber-900/10 rounded-2xl p-4 shadow-xs" style={{ background: "#FFFDF9" }}>
          <p className="text-[10px] font-bold text-amber-900/60 uppercase tracking-wider mb-1">Total Sales Amount</p>
          <p className="text-lg font-black text-amber-955 font-sans">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="bg-white border border-amber-900/10 rounded-2xl p-4 shadow-xs" style={{ background: "#FFFDF9" }}>
          <p className="text-[10px] font-bold text-amber-900/60 uppercase tracking-wider mb-1">Items Quantity</p>
          <p className="text-lg font-black text-amber-955 font-sans">{totalQty} pcs</p>
        </div>
        <div className="bg-white border border-amber-900/10 rounded-2xl p-4 shadow-xs" style={{ background: "#FFFDF9" }}>
          <p className="text-[10px] font-bold text-amber-900/60 uppercase tracking-wider mb-1">Gold Sold Weight</p>
          <p className="text-lg font-black text-amber-955 font-sans">{goldWeight.toFixed(3)} g</p>
        </div>
        <div className="bg-white border border-amber-900/10 rounded-2xl p-4 shadow-xs" style={{ background: "#FFFDF9" }}>
          <p className="text-[10px] font-bold text-amber-900/60 uppercase tracking-wider mb-1">Silver Sold Weight</p>
          <p className="text-lg font-black text-amber-955 font-sans">{silverWeight.toFixed(3)} g</p>
        </div>
      </div>

      {/* Main Ledger List */}
      <div className="bg-white rounded-2xl border border-amber-900/10 overflow-hidden shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-amber-800">
            <RefreshCw className="animate-spin mb-3" size={28} />
            <p className="font-serif text-sm font-semibold">Loading sales ledger...</p>
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-amber-800/60">
            <AlertCircle className="mb-2" size={32} />
            <p className="font-serif text-sm font-semibold">No sales entries found for selected filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-medium">
              <thead className="bg-amber-50/50 border-b border-amber-900/10 font-bold text-amber-955 uppercase tracking-wider text-[10px]">
                <tr className="h-10 text-center">
                  <th className="px-4 text-left">Date</th>
                  <th className="px-4 text-left">Invoice &amp; Customer Details</th>
                  <th className="px-4">Qty</th>
                  <th className="px-4">Weight</th>
                  <th className="px-4 w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {groupSalesByBill(filteredSales).map((bill) => {
                  const displayInvNo = bill.invoiceNo;
                  const displayBookNo = bill.bookNo;

                  return (
                    <tr 
                      key={bill.billKey} 
                      className="border-b border-amber-900/5 hover:bg-amber-50/20 text-center py-2 text-amber-955"
                    >
                      <td className="px-4 text-left font-semibold text-amber-900 align-top py-3 whitespace-nowrap">
                        {formatDateDMY(bill.date)}
                      </td>
                      <td className="px-4 text-left align-top py-3">
                        {/* Header Badges & Customer Info */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {bill.metals.map(m => (
                            <span key={m} className={`inline-block text-[8px] px-1 py-0.5 rounded-sm font-bold uppercase ${
                              m === "GOLD" ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-800"
                            }`}>
                              {m}
                            </span>
                          ))}
                          <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-mono font-bold text-white ${
                            bill.billType === "GST" ? "bg-emerald-800" : "bg-amber-800"
                          }`}>
                            {bill.billType === "GST" ? "🧾 GST INVOICE" : "📋 ESTIMATE"}
                          </span>
                          {displayInvNo && (
                            <span className="bg-emerald-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-0.5">
                              🧾 {displayInvNo}
                            </span>
                          )}
                          {displayBookNo && (
                            <span className="bg-amber-900 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-0.5">
                              📜 {displayBookNo}
                            </span>
                          )}
                        </div>

                        {/* Customer Details */}
                        {bill.customerName && (
                          <div className="text-[11px] text-amber-900/80 font-sans font-semibold flex items-center gap-2 mt-1 flex-wrap">
                            <span className="flex items-center gap-0.5 text-amber-955 font-black">
                              <User size={11} className="text-amber-700" /> {bill.customerName}
                            </span>
                            {bill.mobile && (
                              <span className="text-[10px] text-amber-800/80 font-mono font-bold flex items-center gap-0.5">
                                <Phone size={10} /> {bill.mobile}
                              </span>
                            )}
                            {bill.address && (
                              <span className="text-[10px] text-amber-800/70 italic flex items-center gap-0.5">
                                <MapPin size={10} /> {bill.address}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Listed items inside this bill */}
                        <div className="mt-2 space-y-1 bg-amber-50/40 p-2 rounded-xl border border-amber-900/5">
                          {bill.items.map((it, idx) => {
                            const p = parseSoldItemDetails(it.item_name);
                            return (
                              <div key={it.id || idx} className="text-[11px] flex items-center justify-between text-amber-950 font-serif border-b border-amber-900/5 last:border-0 pb-0.5 last:pb-0">
                                <span className="font-semibold flex items-center gap-1">
                                  <span className="text-[9px] font-mono text-amber-800/60 font-bold">#{idx + 1}</span>
                                  {p.name}
                                  {p.barcode && (
                                    <span className="bg-amber-100/80 text-amber-900 text-[8px] px-1 py-0.2 rounded font-mono font-bold inline-flex items-center gap-0.5">
                                      <Tag size={8} /> {p.barcode}
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono text-[10px] text-amber-900/80 ml-2 whitespace-nowrap">
                                  {it.weight} g • {it.quantity} pc • ₹{it.amount.toLocaleString("en-IN")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-4 font-bold align-top py-3 font-mono text-xs">{bill.totalQty} pc</td>
                      <td className="px-4 font-mono font-bold text-amber-900/80 align-top py-3 text-xs">{bill.totalWeight.toFixed(2)} g</td>
                      <td className="px-4 font-mono font-black text-amber-955 align-top py-3 text-sm">{formatCurrency(bill.totalAmount)}</td>
                      <td className="px-4 flex items-center justify-center gap-1.5 align-top py-3">
                        <button
                          onClick={() => handleOpenEdit(bill.items[0])}
                          className="p-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 text-blue-600 hover:text-blue-800 transition-colors shadow-2xs"
                          title="Edit Bill"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => onSelectPrintBill(bill.items[0])}
                          className="p-1.5 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-850 hover:text-amber-955 transition-colors shadow-2xs"
                          title="Print Bill"
                        >
                          <Printer size={13} />
                        </button>
                        <button
                          onClick={() => {
                            const msg = formatSaleInvoiceMsg({
                              customerName: bill.customerName || "Valued Customer",
                              invoiceNo: bill.invoiceNo || "N/A",
                              bookNo: bill.bookNo || "",
                              date: formatDateDMY(bill.date),
                              billType: bill.billType,
                              amount: bill.totalAmount,
                              weight: bill.totalWeight,
                              items: bill.items.map((it) => ({
                                name: it.item_name,
                                weight: it.weight,
                                qty: it.quantity,
                                amount: it.amount,
                              })),
                            });
                            setWhatsappModal({
                              bill,
                              phone: bill.mobile || "",
                              message: msg,
                            });
                          }}
                          className="p-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-50 text-emerald-800 transition-colors shadow-2xs font-bold text-xs"
                          title="Send PDF Bill on WhatsApp"
                        >
                          💬
                        </button>



                        <button
                          onClick={() => handleDeleteBillGroup(bill)}
                          className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors shadow-2xs"
                          title="Delete Bill"
                        >
                          <Trash2 size={13} />
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

      {/* ── EXCEL EXPORT DATE RANGE MODAL ── */}
      {showExcelExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-amber-200">
            <div style={{ height: 4, background: "#0b5c33" }} />
            
            <div className="px-6 py-4 flex justify-between items-center border-b border-amber-100">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-800" size={20} />
                <h3 className="font-bold text-base font-serif text-amber-955">
                  Export Barcode GST Invoices (Excel)
                </h3>
              </div>
              <button onClick={() => setShowExcelExportModal(false)} className="text-amber-900/40 hover:text-amber-900 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-left text-xs">
              <p className="text-amber-900/70 text-xs font-sans">
                Select date range to download custom Excel report (`.xlsx`) for <strong>Barcode Stock GST Invoices ONLY</strong> (Estimate bills excluded).
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">From Date</label>
                  <input
                    type="date"
                    value={exportFromDate}
                    onChange={(e) => setExportFromDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold text-amber-955 bg-amber-50/30 focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">To Date</label>
                  <input
                    type="date"
                    value={exportToDate}
                    onChange={(e) => setExportToDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold text-amber-955 bg-amber-50/30 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="bg-emerald-50/60 p-3 rounded-2xl border border-emerald-200/60 text-[11px] text-emerald-950 font-sans space-y-1">
                <p className="font-bold uppercase text-[9px] text-emerald-900">Included Columns in Excel:</p>
                <p className="text-[10px] text-emerald-900/80">
                  Date • Invoice Number • Customer Name • Amount w/o GST • CGST (1.5%) • SGST (1.5%) • Total Amount • Mode of Payment
                </p>
                <p className="font-bold text-[10px] text-emerald-950 pt-1 border-t border-emerald-200/50">
                  ➕ Includes Grand Totals summary row at the bottom.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExcelExportModal(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs border border-amber-200 text-amber-800 bg-white hover:bg-amber-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    exportBarcodeBillsToExcel(sales, exportFromDate, exportToDate);
                    setShowExcelExportModal(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide text-white transition-all shadow-md bg-emerald-800 hover:bg-emerald-900 flex items-center justify-center gap-1.5"
                >
                  <FileSpreadsheet size={14} />
                  Download Excel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT SALE MODAL ── */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-amber-200 max-h-[90vh] overflow-y-auto">
            <div style={{ height: 4, background: "#d97706" }} />
            
            <div className="px-6 py-4 flex justify-between items-center border-b border-amber-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <h3 className="font-bold text-base font-serif text-amber-955">
                  Edit Sale Entry #{editingItem.id}
                </h3>
              </div>
              <button onClick={() => { setShowEditModal(false); setEditingItem(null); }} className="text-amber-900/40 hover:text-amber-900 transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-3.5 text-left text-xs">
              <div className="bg-amber-50/50 p-2.5 rounded-2xl border border-amber-200/60">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900 mb-1">Bill Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, billType: "GST" })}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      editForm.billType === "GST"
                        ? "bg-emerald-800 text-white shadow-xs"
                        : "bg-white text-amber-900 border border-amber-200"
                    }`}
                  >
                    🧾 GST Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, billType: "ESTIMATE" })}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all ${
                      editForm.billType === "ESTIMATE"
                        ? "bg-amber-800 text-white shadow-xs"
                        : "bg-white text-amber-900 border border-amber-200"
                    }`}
                  >
                    📋 Estimate Bill
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-emerald-800 mb-1">Invoice No.</label>
                  <input
                    type="text"
                    value={editForm.invoiceNo}
                    onChange={(e) => setEditForm({ ...editForm, invoiceNo: e.target.value })}
                    placeholder="e.g. PJ/2026-27/INV-0001"
                    className="w-full px-2.5 py-2 rounded-xl border border-emerald-300 outline-none text-xs font-bold font-mono text-emerald-950 focus:border-emerald-600 bg-emerald-50/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Book No.</label>
                  <input
                    type="text"
                    value={editForm.bookNo}
                    onChange={(e) => setEditForm({ ...editForm, bookNo: e.target.value })}
                    placeholder="e.g. B-101"
                    className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold font-mono text-amber-955 focus:border-amber-500 bg-amber-50/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={editForm.customerName}
                    onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-semibold text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Mobile / Phone</label>
                  <input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    placeholder="Mobile No."
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-medium text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Address"
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-medium text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Aadhar No.</label>
                  <input
                    type="text"
                    value={editForm.aadhar}
                    onChange={(e) => setEditForm({ ...editForm, aadhar: e.target.value })}
                    placeholder="Aadhar No."
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-medium text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">PAN No.</label>
                  <input
                    type="text"
                    value={editForm.pan}
                    onChange={(e) => setEditForm({ ...editForm, pan: e.target.value })}
                    placeholder="PAN No."
                    className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-medium text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Item Description / Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g. Gold Ring 22K"
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 outline-none text-xs font-semibold text-amber-955 focus:border-amber-500"
                  style={{ background: "#FFFBF5" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Metal</label>
                  <select
                    value={editForm.metal}
                    onChange={(e) => setEditForm({ ...editForm, metal: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  >
                    <option value="GOLD">Gold</option>
                    <option value="SILVER">Silver</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Barcode / Tag No.</label>
                  <input
                    type="text"
                    value={editForm.barcode}
                    onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                    placeholder="e.g. P00123"
                    className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold font-mono text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Qty (pc)</label>
                  <input
                    type="number"
                    required
                    value={editForm.qty}
                    onChange={(e) => setEditForm({ ...editForm, qty: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold font-mono text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Weight (g)</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={editForm.weight}
                    onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold font-mono text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Rate (₹/g)</label>
                  <input
                    type="number"
                    value={editForm.rate}
                    onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })}
                    placeholder="Rate"
                    className="w-full px-2.5 py-2 rounded-xl border border-amber-200 outline-none text-xs font-bold font-mono text-amber-955 focus:border-amber-500"
                    style={{ background: "#FFFBF5" }}
                  />
                </div>
              </div>

              <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200/50 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">Payment Breakdown</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Cash (₹)</label>
                    <input
                      type="number"
                      value={editForm.cashAmount}
                      onChange={(e) => setEditForm({ ...editForm, cashAmount: e.target.value })}
                      placeholder="0"
                      className="w-full px-2 py-1.5 rounded-lg border border-amber-200 text-xs font-mono font-bold text-amber-955 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-amber-800 mb-0.5">UPI (₹)</label>
                    <input
                      type="number"
                      value={editForm.upiAmount}
                      onChange={(e) => setEditForm({ ...editForm, upiAmount: e.target.value })}
                      placeholder="0"
                      className="w-full px-2 py-1.5 rounded-lg border border-amber-200 text-xs font-mono font-bold text-amber-955 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-amber-800 mb-0.5">Other (₹)</label>
                    <input
                      type="number"
                      value={editForm.otherAmount}
                      onChange={(e) => setEditForm({ ...editForm, otherAmount: e.target.value })}
                      placeholder="0"
                      className="w-full px-2 py-1.5 rounded-lg border border-amber-200 text-xs font-mono font-bold text-amber-955 bg-white"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-amber-200/40 pt-1.5 text-xs font-bold text-amber-950">
                  <span>Total Amount:</span>
                  <span className="font-mono text-amber-900 font-extrabold">
                    {formatCurrency((parseFloat(editForm.cashAmount || "0") + parseFloat(editForm.upiAmount || "0") + parseFloat(editForm.otherAmount || "0")))}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingItem(null); }}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs border border-amber-200 text-amber-800 bg-white hover:bg-amber-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs uppercase tracking-wide text-white transition-all shadow-md bg-amber-700 hover:bg-amber-800 flex items-center justify-center gap-1.5"
                >
                  <Save size={14} />
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── WHATSAPP SALE INVOICE & REAL PDF MODAL ── */}
      {whatsappModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4" style={{ background: "rgba(45,27,14,0.65)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-emerald-200 flex flex-col">
            <div style={{ height: 5, background: "linear-gradient(90deg,#059669,#10B981)" }} />
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-emerald-100">
              <div>
                <h3 className="font-bold text-base text-emerald-950 flex items-center gap-2">
                  <span>📲</span> WhatsApp Sale Bill &amp; PDF Invoice
                </h3>
                <p className="text-xs text-emerald-800/70 mt-0.5">Invoice: {whatsappModal.bill.invoiceNo || "PJ Sale Bill"}</p>
              </div>
              <button onClick={() => setWhatsappModal(null)} className="p-2 rounded-xl hover:bg-emerald-50 text-emerald-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const targetPhone = sanitizePhoneNumber(whatsappModal.phone);
                showNotification(`Opening chat for +${targetPhone || 'customer'}...`, "info");
                
                // 1. Copy bill image to clipboard & download PDF bill & open customer chat directly
                await copyInvoiceToClipboardAndOpenWhatsApp(
                  {
                    invoiceNo: whatsappModal.bill.invoiceNo,
                    bookNo: whatsappModal.bill.bookNo,
                    date: formatDateDMY(whatsappModal.bill.date),
                    customerName: whatsappModal.bill.customerName,
                    mobile: whatsappModal.bill.mobile,
                    address: whatsappModal.bill.address,
                    items: whatsappModal.bill.items.map((it) => ({
                      name: it.item_name,
                      weight: it.weight,
                      qty: it.quantity,
                      amount: it.amount,
                    })),
                    totalAmount: whatsappModal.bill.totalAmount,
                    totalWeight: whatsappModal.bill.totalWeight,
                    totalQty: whatsappModal.bill.totalQty,
                  },
                  whatsappModal.phone,
                  whatsappModal.message
                );

                // 2. Post to backend service for record
                await sendBackendWhatsAppPdfInvoice({
                  invoice_no: whatsappModal.bill.invoiceNo,
                  book_no: whatsappModal.bill.bookNo,
                  date: formatDateDMY(whatsappModal.bill.date),
                  customer_name: whatsappModal.bill.customerName,
                  phone: whatsappModal.phone,
                  address: whatsappModal.bill.address,
                  items: whatsappModal.bill.items.map((it) => ({
                    name: it.item_name,
                    weight: it.weight,
                    qty: it.quantity,
                    amount: it.amount,
                  })),
                  total_amount: whatsappModal.bill.totalAmount,
                  message: whatsappModal.message,
                });

                showNotification("Customer chat opened! Press Ctrl+V in WhatsApp to paste bill.", "success");
                setWhatsappModal(null);
              }}
              className="p-6 space-y-4"
            >




              {/* PDF Download Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                    <span>📄</span> Download Real PDF Bill File
                  </p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Generates printable PDF invoice file to attach directly in WhatsApp.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    generateAndDownloadInvoicePDF({
                      invoiceNo: whatsappModal.bill.invoiceNo,
                      bookNo: whatsappModal.bill.bookNo,
                      date: formatDateDMY(whatsappModal.bill.date),
                      customerName: whatsappModal.bill.customerName,
                      mobile: whatsappModal.bill.mobile,
                      address: whatsappModal.bill.address,
                      items: whatsappModal.bill.items.map(it => ({
                        name: it.item_name,
                        weight: it.weight,
                        qty: it.quantity,
                        amount: it.amount
                      })),
                      totalAmount: whatsappModal.bill.totalAmount,
                      totalWeight: whatsappModal.bill.totalWeight,
                      totalQty: whatsappModal.bill.totalQty
                    });
                    showNotification("Downloading PDF Bill... Attach this file in WhatsApp!", "success");
                  }}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all whitespace-nowrap flex items-center gap-1.5"
                >
                  <span>📥 Download PDF</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">Customer Mobile Number (Press Enter to Send)</label>
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
                <label className="block text-xs font-bold text-emerald-900 mb-1">WhatsApp Message Summary (Ctrl+Enter to Send)</label>
                <textarea
                  rows={7}
                  value={whatsappModal.message}
                  onChange={(e) => setWhatsappModal({ ...whatsappModal, message: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      (e.target as HTMLElement).closest('form')?.requestSubmit();
                    }
                  }}
                  className="w-full text-xs p-3 border border-emerald-300 rounded-xl focus:ring-1 focus:ring-emerald-500 font-sans leading-relaxed"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900 flex items-center gap-2">
                <span>💡</span>
                <span>Choose <strong>Direct Chat</strong> to open the customer's chat directly, or <strong>Windows Share App</strong> to share with auto-attached PDF!</span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setWhatsappModal(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-amber-900 hover:bg-amber-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    generateAndDownloadInvoicePDF({
                      invoiceNo: whatsappModal.bill.invoiceNo,
                      bookNo: whatsappModal.bill.bookNo,
                      date: formatDateDMY(whatsappModal.bill.date),
                      customerName: whatsappModal.bill.customerName,
                      mobile: whatsappModal.bill.mobile,
                      address: whatsappModal.bill.address,
                      items: whatsappModal.bill.items.map(it => ({
                        name: it.item_name,
                        weight: it.weight,
                        qty: it.quantity,
                        amount: it.amount
                      })),
                      totalAmount: whatsappModal.bill.totalAmount,
                      totalWeight: whatsappModal.bill.totalWeight,
                      totalQty: whatsappModal.bill.totalQty
                    });
                    openWhatsApp(whatsappModal.phone, whatsappModal.message);
                    setWhatsappModal(null);
                  }}
                  className="px-4 py-2.5 bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>📲 Direct Customer Chat (Web)</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>📎 Share PDF via Windows App</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}


