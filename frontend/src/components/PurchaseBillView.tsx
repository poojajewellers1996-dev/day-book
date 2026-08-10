"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Barcode,
  ChevronDown,
  ChevronUp,
  Tag,
  FileText,
  ShoppingBag,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Copy,
  Printer,
  Eye,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import TagPrintPreview, { TagItem } from "./TagPrintPreview";
import { API_BASE } from "../utils/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PurchaseItem {
  id: string;
  ornamentName: string;
  huidNo: string;
  purity: string;
  qty: number;
  weight: number;
  netWeight: number;
  rate: number;
  making: string;
  amount: number;
  remark: string;
  barcodeNo: string;
}

interface PurchaseBillViewProps {
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function emptyItem(): PurchaseItem {
  return {
    id: uid(),
    ornamentName: "",
    huidNo: "",
    purity: "",
    qty: 1,
    weight: 0,
    netWeight: 0,
    rate: 0,
    making: "",
    amount: 0,
    remark: "",
    barcodeNo: "",
  };
}

const PURITIES_GOLD = ["916", "750", "KDM 75HM", "KDM 91.6", "999", "100%", "585", "Other"];
const PURITIES_SILVER = ["92.5", "999", "100%", "Other"];

// ══════════════════════════════════════════════════════════════════════════════
// CODE 128B Barcode Generator (native SVG – no external deps)
// ══════════════════════════════════════════════════════════════════════════════

const CODE128_PATTERNS: Record<number, string> = {
  0:"11011001100",1:"11001101100",2:"11001100110",3:"10010011000",
  4:"10010001100",5:"10001001100",6:"10011001000",7:"10011000100",
  8:"10001100100",9:"11001001000",10:"11001000100",11:"11000100100",
  12:"10110011100",13:"10011011100",14:"10011001110",15:"10111001100",
  16:"10011101100",17:"10011100110",18:"11001110010",19:"11001011100",
  20:"11001001110",21:"11011100100",22:"11001110100",23:"11101101110",
  24:"11101001100",25:"11100101100",26:"11100100110",27:"11101100100",
  28:"11100110100",29:"11100110010",30:"11011011000",31:"11011000110",
  32:"11000110110",33:"10100011000",34:"10001011000",35:"10001000110",
  36:"10110001000",37:"10001101000",38:"10001100010",39:"11010001000",
  40:"11000101000",41:"11000100010",42:"10110111000",43:"10110001110",
  44:"10001101110",45:"10111011000",46:"10111000110",47:"10001110110",
  48:"11101110110",49:"11010001110",50:"11000101110",51:"11011101000",
  52:"11011100010",53:"11011101110",54:"11101011000",55:"11101000110",
  56:"11100010110",57:"11101101000",58:"11101100010",59:"11100011010",
  60:"11101111010",61:"11001000010",62:"11110001010",63:"10100110000",
  64:"10100001100",65:"10010110000",66:"10010000110",67:"10000101100",
  68:"10000100110",69:"10110010000",70:"10110000100",71:"10011010000",
  72:"10011000010",73:"10000110100",74:"10000110010",75:"11000010010",
  76:"11001010000",77:"11110111010",78:"11000010100",79:"10001111010",
  80:"10100111100",81:"10010111100",82:"10010011110",83:"10111100100",
  84:"10011110100",85:"10011110010",86:"11110100100",87:"11110010100",
  88:"11110010010",89:"11011011110",90:"11011110110",91:"11110110110",
  92:"10101111000",93:"10100011110",94:"10001011110",95:"10111101000",
  96:"10111100010",97:"11110101000",98:"11110100010",99:"10111011110",
  100:"10111101110",101:"11101011110",102:"11110101110",
  // Special codes
  103:"11010000100", // START A
  104:"11010010000", // START B
  105:"11010011100", // START C
  106:"11000111010", // STOP
};

function code128BEncode(text: string): string {
  // Validate all chars are Code128-B compatible (ASCII 32-127)
  const chars = text.split("").map(c => c.charCodeAt(0));
  const values: number[] = [];
  for (const c of chars) {
    if (c < 32 || c > 127) continue;
    values.push(c - 32); // Code128-B value
  }
  // Compute checksum
  let checksum = 104; // START B value
  values.forEach((v, i) => { checksum += v * (i + 1); });
  checksum = checksum % 103;

  // Build bit pattern
  let bits = CODE128_PATTERNS[104]; // START B
  for (const v of values) {
    bits += CODE128_PATTERNS[v] || "";
  }
  bits += CODE128_PATTERNS[checksum];
  bits += CODE128_PATTERNS[106]; // STOP
  bits += "11"; // final bar

  return bits;
}

function renderBarcodeSVG(
  barcodeText: string,
  svgWidth: number,
  svgHeight: number,
  showText: boolean = false,
): string {
  const bits = code128BEncode(barcodeText);
  const quietZone = 6;
  const totalBits = bits.length;
  const barWidth = (svgWidth - quietZone * 2) / totalBits;

  let rects = "";
  let x = quietZone;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") {
      rects += `<rect x="${x.toFixed(2)}" y="0" width="${(barWidth + 0.5).toFixed(2)}" height="${showText ? svgHeight - 8 : svgHeight}"/>`;
    }
    x += barWidth;
  }

  const textEl = showText
    ? `<text x="${svgWidth / 2}" y="${svgHeight}" text-anchor="middle" font-family="monospace" font-size="5" fill="#000">${barcodeText}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
    <g fill="#000">${rects}</g>${textEl}</svg>`;
}


// ══════════════════════════════════════════════════════════════════════════════
// MAIN PURCHASE BILL VIEW
// ══════════════════════════════════════════════════════════════════════════════

export default function PurchaseBillView({ showNotification }: PurchaseBillViewProps) {
  const [billNo, setBillNo] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [supplierName, setSupplierName] = useState("");
  const [supplierGst, setSupplierGst] = useState("");
  const [metal, setMetal] = useState<"GOLD" | "SILVER">("GOLD");
  const [invoiceTotal, setInvoiceTotal] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextBarcode, setNextBarcode] = useState<number | null>(null);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [savedBill, setSavedBill] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"bill" | "items" | "summary">("bill");
  const [copiedBarcode, setCopiedBarcode] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printItems, setPrintItems] = useState<TagItem[]>([]);
  const [allSuppliers, setAllSuppliers] = useState<{ supplier_name: string; supplier_gst: string }[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<{ supplier_name: string; supplier_gst: string }[]>([]);

  // Add Item Entry Form State
  const [tempItem, setTempItem] = useState({
    ornamentName: "",
    huidNo: "",
    purity: "",
    qty: 1,
    weight: 0,
    netWeight: 0,
    rate: 0,
    making: "",
    amount: 0,
    remark: "",
    barcodeNo: ""
  });

  const updateTempItem = (field: keyof typeof tempItem, value: any) => {
    setTempItem(prev => {
      const updated = { ...prev, [field]: value };
      if (["weight", "rate", "qty"].includes(field as string)) {
        const w = field === "weight" ? parseFloat(value) || 0 : prev.weight;
        const r = field === "rate" ? parseFloat(value) || 0 : prev.rate;
        const q = field === "qty" ? parseInt(value) || 1 : prev.qty;
        updated.amount = parseFloat((w * r * q).toFixed(2));
        if (field === "weight") updated.netWeight = parseFloat(value) || 0;
      }
      return updated;
    });
  };

  // New bill-level fields
  const [totalWeight, setTotalWeight] = useState("");
  const [purity, setPurity] = useState(""); // wholesaler purity %, e.g. 92
  const [making, setMaking] = useState(""); // wholesaler making %, e.g. 4
  const [totalPercent, setTotalPercent] = useState(0); // purity + making
  const [isRateCut, setIsRateCut] = useState(true);
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState(0);
  const [pureWeight, setPureWeight] = useState(0);

  useEffect(() => {
    const wt = parseFloat(totalWeight) || 0;
    const purVal = parseFloat(purity) || 0;
    const makVal = parseFloat(making) || 0;
    const totPct = purVal + makVal;
    setTotalPercent(totPct);

    const pureWt = wt * (totPct / 100);
    setPureWeight(parseFloat(pureWt.toFixed(3)));

    if (isRateCut) {
      const r = parseFloat(rate) || 0;
      const amt = pureWt * r;
      const roundedAmt = parseFloat(amt.toFixed(2));
      setAmount(roundedAmt);
      setInvoiceTotal(roundedAmt > 0 ? roundedAmt.toString() : "");
    } else {
      setAmount(0);
      setInvoiceTotal("");
    }
  }, [totalWeight, purity, making, isRateCut, rate]);

  useEffect(() => {
    fetchNextBarcode();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (activeTab === "items" && !tempItem.purity && purity) {
      setTempItem(prev => ({
        ...prev,
        purity,
        rate: parseFloat(rate) || 0
      }));
    }
  }, [activeTab, purity, rate]);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch(`${API_BASE}/purchase/suppliers`);
      if (res.ok) {
        const data = await res.json();
        setAllSuppliers(data);
      }
    } catch (err) {
      console.error("Failed to fetch suppliers", err);
    }
  };

  const fetchNextBarcode = async () => {
    setBarcodeLoading(true);
    try {
      const res = await fetch(`${API_BASE}/purchase/next-barcode`);
      if (res.ok) {
        const data = await res.json();
        setNextBarcode(data.next_barcode_number);
      }
    } catch {
      setNextBarcode(null);
    } finally {
      setBarcodeLoading(false);
    }
  };

  const handleAddItemToTable = () => {
    if (!tempItem.ornamentName.trim()) {
      showNotification("Ornament Name is required", "error");
      return;
    }
    if (!tempItem.purity.trim()) {
      showNotification("Purity is required", "error");
      return;
    }
    if (tempItem.weight <= 0) {
      showNotification("Gross Weight must be greater than 0", "error");
      return;
    }

    let itemBarcode = tempItem.barcodeNo.trim();
    if (!itemBarcode) {
      if (nextBarcode !== null) {
        let maxCount = nextBarcode;
        items.forEach(it => {
          if (it.barcodeNo && it.barcodeNo.toUpperCase().startsWith("P")) {
            const num = parseInt(it.barcodeNo.substring(1));
            if (!isNaN(num) && num >= maxCount) {
              maxCount = num + 1;
            }
          }
        });
        itemBarcode = "P" + String(maxCount).padStart(5, "0");
        setNextBarcode(maxCount + 1);
      } else {
        showNotification("Warning: Barcode cannot be auto-assigned (server offline). Please type manually.", "info");
      }
    }

    const newItem: PurchaseItem = {
      id: uid(),
      ornamentName: tempItem.ornamentName.toUpperCase().trim(),
      huidNo: tempItem.huidNo.toUpperCase().trim(),
      purity: tempItem.purity,
      qty: tempItem.qty,
      weight: tempItem.weight,
      netWeight: tempItem.netWeight || tempItem.weight,
      rate: tempItem.rate,
      making: tempItem.making.trim(),
      amount: tempItem.amount,
      remark: tempItem.remark.trim(),
      barcodeNo: itemBarcode
    };

    setItems(prev => [...prev, newItem]);
    
    // Reset temp item keeping purity and rate for rapid repeated entry
    setTempItem(prev => ({
      ornamentName: "",
      huidNo: "",
      purity: prev.purity,
      qty: 1,
      weight: 0,
      netWeight: 0,
      rate: prev.rate,
      making: "",
      amount: 0,
      remark: "",
      barcodeNo: ""
    }));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const copyBarcode = (bc: string) => {
    navigator.clipboard.writeText(bc).then(() => {
      setCopiedBarcode(bc);
      setTimeout(() => setCopiedBarcode(null), 1500);
    });
  };

  const totalQty = items.reduce((s, it) => s + (it.qty || 0), 0);
  const totalItemsWeight = items.reduce((s, it) => s + (it.weight || 0), 0);
  const totalAmount = items.reduce((s, it) => s + (it.amount || 0), 0);

  const validate = () => {
    if (!billNo.trim()) { showNotification("Bill No is required", "error"); return false; }
    if (!billDate) { showNotification("Bill Date is required", "error"); return false; }
    if (!supplierName.trim()) { showNotification("Supplier Name is required", "error"); return false; }
    if (parseFloat(totalWeight) <= 0 || isNaN(parseFloat(totalWeight))) {
      showNotification("Total Weight of Item is required and must be > 0", "error");
      return false;
    }
    const purVal = parseFloat(purity);
    if (isNaN(purVal) || purVal <= 0 || purVal > 100) {
      showNotification("Purity must be a percentage between 0% and 100%", "error");
      return false;
    }
    const makVal = parseFloat(making) || 0;
    if (makVal < 0) {
      showNotification("Making charge percentage cannot be negative", "error");
      return false;
    }
    if (isRateCut && (parseFloat(rate) <= 0 || isNaN(parseFloat(rate)))) {
      showNotification("Rate is required when Rate Cut is YES", "error");
      return false;
    }
    if (items.length === 0) {
      showNotification("Please add at least one item to the table before saving.", "error");
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.ornamentName.trim()) { showNotification(`Item ${i + 1}: Ornament Name required`, "error"); return false; }
      if (!it.barcodeNo.trim()) { showNotification(`Item ${i + 1}: Barcode required`, "error"); return false; }
      if (!it.purity.trim()) { showNotification(`Item ${i + 1}: Purity required`, "error"); return false; }
      if (it.weight <= 0) { showNotification(`Item ${i + 1}: Weight must be > 0`, "error"); return false; }
    }

    const weightDiff = Math.abs(parseFloat(totalWeight) - totalItemsWeight);
    if (weightDiff > 0.020) {
      showNotification(`Cannot save bill. Sum of items (${totalItemsWeight.toFixed(3)}g) does not match Bill Weight (${parseFloat(totalWeight).toFixed(3)}g). Difference is ${weightDiff.toFixed(3)}g (Max allowed tolerance: ±0.020g).`, "error");
      return false;
    }

    return true;
  };

  const saveBill = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        bill_no: billNo.trim(),
        bill_date: billDate,
        supplier_name: supplierName.trim(),
        supplier_gst: supplierGst.trim(),
        metal,
        invoice_total: parseFloat(invoiceTotal) || 0,
        remarks: remarks.trim(),
        total_weight: parseFloat(totalWeight) || 0,
        purity: purity.trim(),
        making: parseFloat(making) || 0,
        total_percent: totalPercent,
        is_rate_cut: isRateCut ? 1 : 0,
        rate: isRateCut ? (parseFloat(rate) || 0) : 0,
        amount: isRateCut ? amount : 0,
        pure_weight: pureWeight,
        items: items.map((it) => ({
          ornament_name: it.ornamentName.trim(),
          huid_no: it.huidNo.trim(),
          purity: it.purity.trim(),
          qty: it.qty,
          weight: it.weight,
          net_weight: it.netWeight || it.weight,
          rate: it.rate,
          making: it.making.trim(),
          amount: it.amount,
          remark: it.remark.trim(),
          barcode_no: it.barcodeNo.trim(),
        })),
      };
      const res = await fetch(`${API_BASE}/purchase/bill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).detail || "Server error");
      }
      const saved = await res.json();
      setSavedBill(saved);
      setActiveTab("summary");
      showNotification(`Bill ${billNo} saved! ${items.length} items added to stock.`, "success");
      await fetchNextBarcode();
      fetchSuppliers();
    } catch (e: any) {
      showNotification(e.message || "Failed to save purchase bill", "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBillNo(""); setBillDate(new Date().toISOString().split("T")[0]);
    setSupplierName(""); setSupplierGst(""); setMetal("GOLD");
    setInvoiceTotal(""); setRemarks("");
    setTotalWeight(""); setPurity(""); setMaking(""); setTotalPercent(0); setIsRateCut(true); setRate(""); setAmount(0); setPureWeight(0);
    setItems([]);
    setTempItem({
      ornamentName: "",
      huidNo: "",
      purity: "",
      qty: 1,
      weight: 0,
      netWeight: 0,
      rate: 0,
      making: "",
      amount: 0,
      remark: "",
      barcodeNo: ""
    });
    setSavedBill(null);
    setActiveTab("bill");
    fetchNextBarcode();
  };

  // Build tag items for printing
  const tagItems: TagItem[] = items.map((it) => ({
    barcodeNo: it.barcodeNo,
    ornamentName: it.ornamentName,
    purity: it.purity,
    weight: it.weight,
    netWeight: it.netWeight || it.weight,
    making: it.making,
    remark: it.remark,
    huidNo: it.huidNo,
    qty: it.qty,
    metal,
    billNo: billNo,
  }));

  const metalColor = metal === "GOLD" ? "#B8860B" : "#4a5568";
  const metalBg = metal === "GOLD"
    ? "linear-gradient(135deg, #B8860B22, #FFD70011)"
    : "linear-gradient(135deg, #70809022, #C0C0C011)";
  const purities = metal === "GOLD" ? PURITIES_GOLD : PURITIES_SILVER;

  // ─── Render ───────────────────────────────────────────────────────────────

  const handleEnterToNext = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA"
      ) {
        e.preventDefault();
        const container = e.currentTarget;
        const inputs = Array.from(
          container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
            "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])"
          )
        );
        const index = inputs.indexOf(target as any);
        if (index > -1 && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      }
    }
  };

  return (
    <>
      {/* Print preview modal */}
      {showPrintPreview && (
        <TagPrintPreview
          items={tagItems.filter(it => it.barcodeNo)}
          onClose={() => setShowPrintPreview(false)}
        />
      )}

      <div onKeyDown={handleEnterToNext} style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px 80px" }}>

        {/* Header */}
        <div style={{
          borderRadius: 20,
          background: `linear-gradient(135deg, ${metal === "GOLD" ? "#B8860B" : "#4a5568"} 0%, ${metal === "GOLD" ? "#D4A017" : "#718096"} 100%)`,
          padding: "24px 28px",
          marginBottom: 24,
          display: "flex", alignItems: "center", gap: 16,
          boxShadow: `0 8px 32px ${metal === "GOLD" ? "#B8860B40" : "#71809640"}`,
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <ShoppingBag size={26} color="white" />
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.3px" }}>
              Purchase Bill Entry
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "rgba(255,255,255,0.75)" }}>
              Add new stock · Auto barcode generation · {metal} inventory · TSC TTP-244 Pro print
            </p>
          </div>
          {/* Metal toggle */}
          <div style={{ display: "flex", gap: 8, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 4 }}>
            {(["GOLD", "SILVER"] as const).map((m) => (
              <button key={m} onClick={() => { setMetal(m); setPurity(""); setItems(prev => prev.map(it => ({ ...it, purity: "" }))); }}
                style={{
                  padding: "6px 18px", borderRadius: 9, border: "none", cursor: "pointer",
                  fontWeight: 600, fontSize: 13,
                  background: metal === m ? "white" : "transparent",
                  color: metal === m ? (m === "GOLD" ? "#B8860B" : "#4a5568") : "rgba(255,255,255,0.8)",
                  transition: "all 0.2s",
                }}>
                {m === "GOLD" ? "🥇" : "🥈"} {m}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#f8f5f0", borderRadius: 14, padding: 4 }}>
          {(["bill", "items", "summary"] as const).map((tab) => (
            <button key={tab} onClick={() => {
              if (tab !== "bill") {
                if (!billNo.trim()) { showNotification("Bill No is required", "error"); return; }
                if (!billDate) { showNotification("Bill Date is required", "error"); return; }
                if (!supplierName.trim()) { showNotification("Supplier Name is required", "error"); return; }
                if (parseFloat(totalWeight) <= 0 || isNaN(parseFloat(totalWeight))) {
                  showNotification("Total Weight of Item is required and must be > 0", "error");
                  return;
                }
                const purVal = parseFloat(purity);
                if (isNaN(purVal) || purVal <= 0 || purVal > 100) {
                  showNotification("Purity must be a percentage between 0% and 100%", "error");
                  return;
                }
                if (isRateCut && (parseFloat(rate) <= 0 || isNaN(parseFloat(rate)))) {
                  showNotification("Rate is required when Rate Cut is YES", "error");
                  return;
                }
              }
              setActiveTab(tab);
            }}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer",
                fontWeight: 600, fontSize: 13,
                background: activeTab === tab ? "white" : "transparent",
                color: activeTab === tab ? metalColor : "#9E8B78",
                boxShadow: activeTab === tab ? "0 2px 8px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.2s",
              }}>
              {tab === "bill" ? "📋 Bill Details" : tab === "items" ? `📦 Items (${items.length})` : "✅ Summary"}
            </button>
          ))}
        </div>

        {/* ─── BILL TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "bill" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <FormCard title="Bill Information" icon={<FileText size={16} color={metalColor} />}>
              <div style={GRID}>
                <Field label="Bill No *">
                  <input id="purchase-bill-no" value={billNo}
                    onChange={e => setBillNo(e.target.value.toUpperCase())}
                    placeholder="e.g. EPB-300" style={INPUT} />
                </Field>
                <Field label="Bill Date *">
                  <input id="purchase-bill-date" type="date" value={billDate}
                    onChange={e => setBillDate(e.target.value)} style={INPUT} />
                </Field>
                <Field label="Metal">
                  <div style={{ ...INPUT, display: "flex", alignItems: "center", gap: 8, background: metalBg, border: `1.5px solid ${metalColor}40`, fontWeight: 700, color: metalColor }}>
                    <span>{metal === "GOLD" ? "🥇" : "🥈"}</span> {metal}
                  </div>
                </Field>
                <Field label="Total Weight of Item (g) *">
                  <input id="purchase-total-weight" type="number" step="0.001" value={totalWeight}
                    onChange={e => setTotalWeight(e.target.value)}
                    placeholder="0.000" style={INPUT} />
                </Field>
                <Field label="Purity (%) *">
                  <div style={{ position: "relative" }}>
                    <input id="purchase-purity" type="number" step="0.1" value={purity}
                      onChange={e => setPurity(e.target.value)}
                      placeholder="e.g. 92" style={INPUT} />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {metal === "GOLD" ? (
                        [
                          { label: "92% (916)", val: "92" },
                          { label: "75% (18K)", val: "75" },
                          { label: "99.9% (24K)", val: "99.9" }
                        ].map(badge => (
                          <button key={badge.label} type="button" onClick={() => setPurity(badge.val)}
                            style={{
                              padding: "4px 8px", borderRadius: 6, border: "1px solid #e8e0d4",
                              background: purity === badge.val ? metalBg : "#fafafa",
                              color: purity === badge.val ? metalColor : "#4a5568",
                              fontSize: "11px", fontWeight: 600, cursor: "pointer"
                            }}>
                            {badge.label}
                          </button>
                        ))
                      ) : (
                        [
                          { label: "92.5% (Sterling)", val: "92.5" },
                          { label: "99.9% (Fine)", val: "99.9" }
                        ].map(badge => (
                          <button key={badge.label} type="button" onClick={() => setPurity(badge.val)}
                            style={{
                              padding: "4px 8px", borderRadius: 6, border: "1px solid #e8e0d4",
                              background: purity === badge.val ? metalBg : "#fafafa",
                              color: purity === badge.val ? metalColor : "#4a5568",
                              fontSize: "11px", fontWeight: 600, cursor: "pointer"
                            }}>
                            {badge.label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </Field>
                <Field label="Making (%)">
                  <input id="purchase-making" type="number" step="0.1" value={making}
                    onChange={e => setMaking(e.target.value)}
                    placeholder="e.g. 4" style={INPUT} />
                </Field>
                <Field label="Total Percent (%)">
                  <div style={{
                    ...INPUT,
                    background: "#f9fafb",
                    fontWeight: 700,
                    color: "#374151"
                  }}>
                    {totalPercent}% <span style={{ color: "#9ca3af", fontSize: "11px", fontWeight: 500, marginLeft: 8 }}>({purity || 0}% + {making || 0}%)</span>
                  </div>
                </Field>
                <Field label="Calculated Pure Weight">
                  <div style={{
                    ...INPUT,
                    background: "#eff6ff",
                    border: "1.5px solid #bfdbfe",
                    fontWeight: 700,
                    color: "#1e40af"
                  }}>
                    {pureWeight.toFixed(3)}g (Pure)
                    {parseFloat(totalWeight) > 0 && (
                      <span style={{ color: "#60a5fa", fontSize: "11px", fontWeight: 500, marginLeft: 8 }}>
                        ({totalWeight}g × {totalPercent}%)
                      </span>
                    )}
                  </div>
                </Field>
                <Field label="Rate Cut?">
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { label: "YES (Cut)", val: true },
                      { label: "NO (Pure)", val: false }
                    ].map(opt => (
                      <button key={opt.label} onClick={() => setIsRateCut(opt.val)}
                        style={{
                          flex: 1, padding: "10px", borderRadius: 10,
                          border: `1.5px solid ${isRateCut === opt.val ? metalColor : "#e8e0d4"}`,
                          background: isRateCut === opt.val ? metalBg : "white",
                          color: isRateCut === opt.val ? metalColor : "#4a5568",
                          fontWeight: 700, fontSize: 13, cursor: "pointer",
                          transition: "all 0.2s",
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>
                {isRateCut ? (
                  <>
                    <Field label="Pure Rate (₹/g) *">
                      <input id="purchase-rate" type="number" step="0.01" value={rate}
                        onChange={e => setRate(e.target.value)}
                        placeholder="Rate per gram of pure metal" style={INPUT} />
                    </Field>
                    <Field label="Calculated Amount (₹)">
                      <div style={{
                        ...INPUT,
                        background: "#f0fdf4",
                        border: "1.5px solid #bbf7d0",
                        fontWeight: 700,
                        color: "#166534"
                      }}>
                        ₹{amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        {pureWeight > 0 && parseFloat(rate) > 0 && (
                          <span style={{ color: "#4ade80", fontSize: "11px", fontWeight: 500, marginLeft: 8 }}>
                            ({pureWeight.toFixed(3)}g × ₹{rate})
                          </span>
                        )}
                      </div>
                    </Field>
                  </>
                ) : (
                  <div style={{ gridColumn: "span 2", display: "flex", alignItems: "center", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 12, padding: "10px 14px", color: "#92400e", fontSize: "12px", fontWeight: 500 }}>
                    ℹ️ Rate is not cut. Bill tracks an outstanding balance of {pureWeight.toFixed(3)}g of pure {metal.toLowerCase()}.
                  </div>
                )}
                <Field label="Invoice Total (₹)">
                  <input id="purchase-invoice-total" type="number" step="0.01" value={invoiceTotal}
                    onChange={e => setInvoiceTotal(e.target.value)}
                    placeholder="Total on supplier invoice" style={INPUT} />
                </Field>
              </div>
            </FormCard>

            <FormCard title="Supplier Details" icon={<Tag size={16} color={metalColor} />}>
              <div style={GRID}>
                <Field label="Supplier Name *">
                  <div style={{ position: "relative" }}>
                    <input id="purchase-supplier-name" value={supplierName}
                      onChange={e => {
                        const val = e.target.value;
                        setSupplierName(val);
                        if (val.trim() === "") {
                          setFilteredSuggestions([]);
                        } else {
                          const filtered = allSuppliers.filter(s =>
                            s.supplier_name.toLowerCase().includes(val.toLowerCase())
                          );
                          setFilteredSuggestions(filtered);
                        }
                      }}
                      onFocus={() => {
                        const val = supplierName;
                        const filtered = allSuppliers.filter(s =>
                          s.supplier_name.toLowerCase().includes(val.toLowerCase())
                        );
                        setFilteredSuggestions(filtered);
                      }}
                      onBlur={() => {
                        // Delay closing the dropdown to allow clicks on options to register
                        setTimeout(() => {
                          setFilteredSuggestions([]);
                        }, 200);
                      }}
                      placeholder="Supplier / Manufacturer name" style={INPUT}
                      autoComplete="off" />
                    {filteredSuggestions.length > 0 && (
                      <div style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        backgroundColor: "white",
                        border: "1.5px solid #e8e0d4",
                        borderRadius: "10px",
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                        zIndex: 1000,
                        maxHeight: "200px",
                        overflowY: "auto",
                        marginTop: "4px"
                      }}>
                        {filteredSuggestions.map((s, index) => (
                          <div
                            key={index}
                            onMouseDown={e => {
                              // Prevent input blur before click event registers
                              e.preventDefault();
                            }}
                            onClick={() => {
                              setSupplierName(s.supplier_name);
                              setSupplierGst(s.supplier_gst || "");
                              setFilteredSuggestions([]);
                            }}
                            style={{
                              padding: "10px 14px",
                              cursor: "pointer",
                              borderBottom: index < filteredSuggestions.length - 1 ? "1px solid #f5f0e8" : "none",
                              fontSize: "13px",
                              color: "#2d3748",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center"
                            }}
                          >
                            <span style={{ fontWeight: 600 }}>{s.supplier_name}</span>
                            {s.supplier_gst && (
                              <span style={{ fontSize: "11px", color: "#9E8B78", backgroundColor: "#f5f0e8", padding: "2px 6px", borderRadius: "4px" }}>
                                GST: {s.supplier_gst}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Field>
                <Field label="Supplier GST No">
                  <input id="purchase-supplier-gst" value={supplierGst}
                    onChange={e => setSupplierGst(e.target.value.toUpperCase())}
                    placeholder="29XXXXX..." style={INPUT} />
                </Field>
                <Field label="Remarks" style={{ gridColumn: "1 / -1" }}>
                  <input id="purchase-remarks" value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Any notes about this purchase" style={INPUT} />
                </Field>
              </div>
            </FormCard>

            <button id="purchase-next-tab-btn" onClick={() => {
              if (!billNo.trim()) { showNotification("Bill No is required", "error"); return; }
              if (!billDate) { showNotification("Bill Date is required", "error"); return; }
              if (!supplierName.trim()) { showNotification("Supplier Name is required", "error"); return; }
              if (parseFloat(totalWeight) <= 0 || isNaN(parseFloat(totalWeight))) {
                showNotification("Total Weight of Item is required and must be > 0", "error");
                return;
              }
              const purVal = parseFloat(purity);
              if (isNaN(purVal) || purVal <= 0 || purVal > 100) {
                showNotification("Purity must be a percentage between 0% and 100%", "error");
                return;
              }
              if (isRateCut && (parseFloat(rate) <= 0 || isNaN(parseFloat(rate)))) {
                showNotification("Rate is required when Rate Cut is YES", "error");
                return;
              }
              setActiveTab("items");
            }}
              style={{ ...btnPrimary(metalColor), display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              Next: Add Items <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ─── ITEMS TAB ────────────────────────────────────────────────────── */}
        {activeTab === "items" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Weight Reconciliation Banner */}
            <div style={{
              borderRadius: 14,
              background: "white",
              border: `1.5px solid ${Math.abs(parseFloat(totalWeight) - totalItemsWeight) <= 0.020 ? "#10b981" : totalItemsWeight > parseFloat(totalWeight) + 0.020 ? "#ef4444" : "#f59e0b"}`,
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              boxShadow: "0 2px 12px rgba(0,0,0,0.03)"
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#2d3748" }}>Weight Reconciliation Balance</p>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                  Bill Total: <strong>{parseFloat(totalWeight).toFixed(3)}g</strong> · Sum of Items: <strong>{totalItemsWeight.toFixed(3)}g</strong>
                </p>
              </div>
              <div style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                backgroundColor: Math.abs(parseFloat(totalWeight) - totalItemsWeight) <= 0.020 ? "#f0fdf4" : totalItemsWeight > parseFloat(totalWeight) + 0.020 ? "#fef2f2" : "#fffbeb",
                color: Math.abs(parseFloat(totalWeight) - totalItemsWeight) <= 0.020 ? "#166534" : totalItemsWeight > parseFloat(totalWeight) + 0.020 ? "#991b1b" : "#92400e",
              }}>
                {Math.abs(parseFloat(totalWeight) - totalItemsWeight) <= 0.020 ? (
                  `✅ Ready (Remaining: ${(parseFloat(totalWeight) - totalItemsWeight).toFixed(3)}g)`
                ) : totalItemsWeight > parseFloat(totalWeight) + 0.020 ? (
                  `❌ Over Limit (Excess: ${(totalItemsWeight - parseFloat(totalWeight)).toFixed(3)}g)`
                ) : (
                  `⏳ Pending (Remaining: ${(parseFloat(totalWeight) - totalItemsWeight).toFixed(3)}g)`
                )}
              </div>
            </div>

            {/* Add Item Form Card */}
            <div style={{
              borderRadius: 16,
              background: "white",
              border: "1px solid #e8e0d4",
              padding: "20px 24px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.02)"
            }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 700, color: "#2d3748", borderBottom: "1px solid #f0ebe3", paddingBottom: 10 }}>
                ✨ Add Ornament Item Details
              </h3>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
                marginBottom: 16
              }}>
                <Field label="Ornament Name *">
                  <input value={tempItem.ornamentName}
                    onChange={e => updateTempItem("ornamentName", e.target.value.toUpperCase())}
                    placeholder="e.g. RING, CHAIN" style={INPUT} />
                </Field>
                <Field label="HUID No">
                  <input value={tempItem.huidNo}
                    onChange={e => updateTempItem("huidNo", e.target.value.toUpperCase())}
                    placeholder="6-char HUID" style={INPUT} maxLength={6} />
                </Field>
                <Field label="Purity *">
                  <select value={tempItem.purity}
                    onChange={e => updateTempItem("purity", e.target.value)}
                    style={{ ...INPUT, cursor: "pointer" }}>
                    <option value="">Select Purity</option>
                    {(metal === "GOLD" ? PURITIES_GOLD : PURITIES_SILVER).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Qty / Pcs">
                  <input type="number" value={tempItem.qty}
                    onChange={e => updateTempItem("qty", parseInt(e.target.value) || 1)}
                    style={INPUT} min={1} />
                </Field>
                <Field label="Gross Wt (g) *">
                  <input type="number" step="0.001" value={tempItem.weight || ""}
                    onChange={e => updateTempItem("weight", parseFloat(e.target.value) || 0)}
                    placeholder="0.000" style={INPUT} />
                </Field>
                <Field label="Net Wt (g)">
                  <input type="number" step="0.001" value={tempItem.netWeight || ""}
                    onChange={e => updateTempItem("netWeight", parseFloat(e.target.value) || 0)}
                    placeholder={tempItem.weight ? tempItem.weight.toFixed(3) : "0.000"} style={INPUT} />
                </Field>
                <Field label="Rate (₹/g)">
                  <input type="number" step="0.01" value={tempItem.rate || ""}
                    onChange={e => updateTempItem("rate", parseFloat(e.target.value) || 0)}
                    placeholder="0.00" style={INPUT} />
                </Field>
                <Field label="Making Charges">
                  <input value={tempItem.making}
                    onChange={e => updateTempItem("making", e.target.value)}
                    placeholder="e.g. 400 or 4%" style={INPUT} />
                </Field>
                <Field label="Barcode No">
                  <input value={tempItem.barcodeNo}
                    onChange={e => updateTempItem("barcodeNo", e.target.value.toUpperCase())}
                    placeholder={nextBarcode ? `Auto (P${String(nextBarcode).padStart(5, "0")})` : "Type barcode"} style={INPUT} />
                </Field>
                <Field label="Remark">
                  <input value={tempItem.remark}
                    onChange={e => updateTempItem("remark", e.target.value)}
                    placeholder="Notes" style={INPUT} />
                </Field>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f0ebe3", paddingTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
                  Calculated Amount: <span style={{ fontSize: 15, color: metalColor }}>₹{tempItem.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                </div>
                <button type="button" onClick={handleAddItemToTable}
                  style={{
                    padding: "10px 24px",
                    borderRadius: 12,
                    border: "none",
                    background: `linear-gradient(135deg, ${metalColor} 0%, #1e293b 100%)`,
                    color: "white",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
                  }}>
                  <Plus size={16} /> Add Item to Table
                </button>
              </div>
            </div>

            {/* Items Table Section */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#2d3748" }}>
                📋 Added Items Stock List ({items.length})
              </h4>
              {items.some(it => it.barcodeNo) && (
                <button
                  onClick={() => {
                    setPrintItems(items.filter(it => it.barcodeNo).map(it => ({
                      barcodeNo: it.barcodeNo,
                      ornamentName: it.ornamentName,
                      purity: it.purity,
                      weight: it.weight,
                      netWeight: it.netWeight || it.weight,
                      making: it.making,
                      remark: it.remark,
                      huidNo: it.huidNo,
                      qty: it.qty,
                      metal,
                    })));
                    setShowPrintPreview(true);
                  }}
                  style={{
                    padding: "6px 12px", borderRadius: 8, border: "none",
                    cursor: "pointer",
                    background: "linear-gradient(135deg, #059669, #10b981)",
                    color: "white", fontSize: 12, fontWeight: 700,
                    display: "flex", alignItems: "center", gap: 6,
                    boxShadow: "0 2px 6px rgba(16, 185, 129, 0.2)"
                  }}>
                  <Eye size={13} /> Preview Tags
                </button>
              )}
            </div>

            {/* Items Spreadsheet Table */}
            <div style={{
              background: "white",
              borderRadius: 14,
              border: "1px solid #e8e0d4",
              overflow: "hidden",
              boxShadow: "0 2px 12px rgba(0,0,0,0.03)"
            }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: "#2d3748", color: "white", fontSize: 12, textAlign: "left" }}>
                      <th style={{ padding: "12px 16px" }}>No</th>
                      <th style={{ padding: "12px 16px" }}>Barcode</th>
                      <th style={{ padding: "12px 16px" }}>Ornament Name</th>
                      <th style={{ padding: "12px 16px" }}>HUID No</th>
                      <th style={{ padding: "12px 16px" }}>Purity</th>
                      <th style={{ padding: "12px 16px" }}>Qty</th>
                      <th style={{ padding: "12px 16px" }}>Gross Wt</th>
                      <th style={{ padding: "12px 16px" }}>Net Wt</th>
                      <th style={{ padding: "12px 16px" }}>Rate</th>
                      <th style={{ padding: "12px 16px" }}>Making</th>
                      <th style={{ padding: "12px 16px" }}>Amount</th>
                      <th style={{ padding: "12px 16px" }}>Remark</th>
                      <th style={{ padding: "12px 16px", textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={13} style={{ padding: "32px", textAlign: "center", color: "#a0aec0", fontSize: 13, fontStyle: "italic" }}>
                          No items added yet. Fill out the details form above to add jewellry ornaments.
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={item.id} style={{
                          borderBottom: "1px solid #f0ebe3",
                          fontSize: 13,
                          color: "#2d3748",
                          background: index % 2 === 0 ? "#fafaf8" : "white"
                        }}>
                          <td style={{ padding: "10px 16px", fontWeight: 700 }}>{index + 1}</td>
                          <td style={{ padding: "10px 16px", fontFamily: "monospace", fontWeight: 700, color: "#7c3aed" }}>
                            {item.barcodeNo}
                            <button onClick={() => copyBarcode(item.barcodeNo)}
                              title="Copy Barcode"
                              style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 6, color: copiedBarcode === item.barcodeNo ? "#10b981" : "#a0aec0", padding: 0 }}>
                              <CheckCircle2 size={12} style={{ display: copiedBarcode === item.barcodeNo ? "inline" : "none" }} />
                              <FileText size={12} style={{ display: copiedBarcode === item.barcodeNo ? "none" : "inline" }} />
                            </button>
                          </td>
                          <td style={{ padding: "10px 16px", fontWeight: 600 }}>{item.ornamentName}</td>
                          <td style={{ padding: "10px 16px" }}>{item.huidNo || "—"}</td>
                          <td style={{ padding: "10px 16px" }}>{item.purity}</td>
                          <td style={{ padding: "10px 16px" }}>{item.qty}</td>
                          <td style={{ padding: "10px 16px" }}>{item.weight.toFixed(3)}g</td>
                          <td style={{ padding: "10px 16px" }}>{item.netWeight.toFixed(3)}g</td>
                          <td style={{ padding: "10px 16px" }}>{item.rate > 0 ? `₹${item.rate.toFixed(2)}/g` : "—"}</td>
                          <td style={{ padding: "10px 16px" }}>{item.making || "—"}</td>
                          <td style={{ padding: "10px 16px", fontWeight: 700, color: metalColor }}>₹{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                          <td style={{ padding: "10px 16px" }}>{item.remark || "—"}</td>
                          <td style={{ padding: "10px 16px", textAlign: "center" }}>
                            <button onClick={() => removeItem(item.id)}
                              title="Delete Item"
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 4 }}>
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals bar */}
            <div style={{
              borderRadius: 14, background: "white",
              border: `1.5px solid ${metalColor}30`,
              padding: "14px 20px", display: "flex", gap: 24, flexWrap: "wrap",
            }}>
              {[
                { label: "Items", val: items.length },
                { label: "Total Qty", val: totalQty },
                { label: "Total Weight", val: `${totalItemsWeight.toFixed(3)}g` },
                { label: "Total Amount", val: `₹${totalAmount.toLocaleString("en-IN")}` },
              ].map(({ label, val }) => (
                <div key={label} style={{ flex: 1, minWidth: 80 }}>
                  <p style={{ margin: 0, fontSize: 11, color: "#9E8B78", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: "#2d3748" }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Save */}
            <button id="purchase-save-btn" onClick={saveBill} disabled={loading}
              style={{ ...btnPrimary(metalColor), display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: loading ? 0.7 : 1 }}>
              {loading
                ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Saving...</>
                : <><Save size={16} /> Save Purchase Bill</>}
            </button>
          </div>
        )}

        {/* ─── SUMMARY TAB ──────────────────────────────────────────────────── */}
        {activeTab === "summary" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {savedBill ? (
              <>
                {/* Success banner */}
                <div style={{
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #065f4611, #10b98111)",
                  border: "1.5px solid #10b98140",
                  padding: "20px 24px",
                  display: "flex", gap: 14, alignItems: "flex-start",
                }}>
                  <CheckCircle2 size={32} color="#10b981" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#065f46" }}>
                      Purchase Bill Saved Successfully!
                    </h2>
                    <p style={{ margin: "6px 0 0", fontSize: 13, color: "#047857" }}>
                      Bill <strong>{savedBill.bill_no}</strong> · {items.length} items added to {metal} stock
                    </p>
                  </div>
                  {/* Print all tags button */}
                  <button
                    id="purchase-print-all-tags-btn"
                    onClick={() => {
                      setPrintItems(items.filter(it => it.barcodeNo).map(it => ({
                        barcodeNo: it.barcodeNo,
                        ornamentName: it.ornamentName,
                        purity: it.purity,
                        weight: it.weight,
                        netWeight: it.netWeight || it.weight,
                        making: it.making,
                        remark: it.remark,
                        huidNo: it.huidNo,
                        qty: it.qty,
                        metal,
                      })));
                      setShowPrintPreview(true);
                    }}
                    style={{
                      padding: "12px 20px", borderRadius: 12, border: "none",
                      cursor: "pointer",
                      background: "linear-gradient(135deg, #1a1a2e, #7c3aed)",
                      color: "white", fontWeight: 700, fontSize: 14,
                      display: "flex", alignItems: "center", gap: 8,
                      boxShadow: "0 4px 16px rgba(124,58,237,0.4)",
                      flexShrink: 0,
                    }}>
                    <Printer size={16} /> Print All Tags
                  </button>
                </div>

                {/* Tag type info */}
                <div style={{
                  borderRadius: 12,
                  background: metal === "GOLD" ? "#fffbeb" : "#f0f9ff",
                  border: `1.5px solid ${metal === "GOLD" ? "#fcd34d" : "#7dd3fc"}`,
                  padding: "12px 18px",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>{metal === "GOLD" ? "📊" : "◼️"}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: metal === "GOLD" ? "#92400e" : "#0c4a6e" }}>
                      {metal === "GOLD" ? "Gold Tags → Code128 Barcode" : "Silver Tags → QR Code"}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: metal === "GOLD" ? "#b45309" : "#0369a1" }}>
                      81mm × 30mm · TSC TTP-244 Pro · {items.length} tags ready
                    </p>
                  </div>
                </div>

                {/* Items list with individual print buttons */}
                <FormCard title="Items & Barcodes" icon={<Barcode size={16} color={metalColor} />}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {items.map((it, i) => (
                      <div key={it.id} style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 14px", borderRadius: 10,
                        background: i % 2 === 0 ? "#fafafa" : "white",
                        border: "1px solid #f0ebe3",
                      }}>
                        <span style={{ minWidth: 24, fontWeight: 700, color: "#9E8B78", fontSize: 12 }}>#{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#2d3748" }}>{it.ornamentName || "—"}</p>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9E8B78" }}>
                            {it.purity} · {it.weight}g · Qty {it.qty}
                          </p>
                        </div>
                        {/* Barcode display */}
                        <div style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "#1a1a2e", borderRadius: 8, padding: "6px 12px",
                        }}>
                          <Barcode size={14} color="#a78bfa" />
                          <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "white" }}>
                            {it.barcodeNo || "—"}
                          </span>
                          {it.barcodeNo && (
                            <button onClick={() => copyBarcode(it.barcodeNo)}
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                              {copiedBarcode === it.barcodeNo
                                ? <CheckCircle2 size={13} color="#10b981" />
                                : <Copy size={13} color="#a78bfa" />}
                            </button>
                          )}
                        </div>
                        {/* Single tag print */}
                        <button
                          onClick={() => {
                            setPrintItems([{
                              barcodeNo: it.barcodeNo,
                              ornamentName: it.ornamentName,
                              purity: it.purity,
                              weight: it.weight,
                              netWeight: it.netWeight || it.weight,
                              making: it.making,
                              remark: it.remark,
                              huidNo: it.huidNo,
                              qty: it.qty,
                              metal,
                            }]);
                            setShowPrintPreview(true);
                          }}
                          style={{
                            padding: "6px 10px", borderRadius: 8, border: "none",
                            cursor: "pointer", background: "#f3f4f6", color: "#374151",
                            display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
                          }}
                          title="Print this tag"
                        >
                          <Printer size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </FormCard>

                <button id="purchase-new-bill-btn" onClick={resetForm}
                  style={{ ...btnPrimary(metalColor), display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Plus size={16} /> Start New Purchase Bill
                </button>
              </>
            ) : (
              <div style={{
                borderRadius: 16, background: "#fff8e1",
                border: "1.5px solid #f59e0b40",
                padding: "32px", textAlign: "center",
              }}>
                <AlertCircle size={36} color="#f59e0b" style={{ marginBottom: 10 }} />
                <p style={{ margin: 0, fontSize: 14, color: "#92400e", fontWeight: 600 }}>
                  No bill saved yet. Fill in Bill Details and Items tabs, then click Save.
                </p>
                <button onClick={() => setActiveTab("bill")}
                  style={{ ...btnPrimary(metalColor), marginTop: 16, fontSize: 13, padding: "10px 20px", display: "inline-flex", alignItems: "center", gap: 8 }}>
                  Go to Bill Details
                </button>
              </div>
            )}
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        {showPrintPreview && (
          <TagPrintPreview
            items={printItems}
            onClose={() => setShowPrintPreview(false)}
          />
        )}
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: 16, background: "white",
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 2px 12px rgba(0,0,0,0.04)", overflow: "hidden",
    }}>
      <div style={{
        padding: "14px 20px", borderBottom: "1px solid #f5f0e8",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {icon}
        <span style={{ fontWeight: 700, fontSize: 14, color: "#2d3748" }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={style}>
      <label style={LABEL}>{label}</label>
      {children}
    </div>
  );
}

interface ItemCardProps {
  item: PurchaseItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onChange: (field: keyof PurchaseItem, value: any) => void;
  purities: string[];
  metalColor: string;
  copiedBarcode: string | null;
  onCopyBarcode: (bc: string) => void;
  metal: "GOLD" | "SILVER";
}

function ItemCard({ item, index, expanded, onToggle, onRemove, onChange, purities, metalColor, copiedBarcode, onCopyBarcode, metal }: ItemCardProps) {
  return (
    <div style={{
      borderRadius: 14, background: "white",
      border: `1.5px solid ${expanded ? metalColor + "60" : "#e8e0d4"}`,
      overflow: "hidden", transition: "border-color 0.2s",
      boxShadow: expanded ? `0 4px 20px ${metalColor}15` : "none",
    }}>
      {/* Header */}
      <div onClick={onToggle} style={{
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        background: expanded ? `${metalColor}08` : "transparent", transition: "background 0.2s",
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: `${metalColor}20`, display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: 12, fontWeight: 700, color: metalColor,
        }}>{index + 1}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: "#2d3748", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.ornamentName || <span style={{ color: "#bbb" }}>Untitled Item</span>}
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9E8B78" }}>
            {item.purity && <span>{item.purity} · </span>}
            {item.weight > 0 && <span>{item.weight}g · </span>}
            {item.barcodeNo && <span style={{ color: "#7c3aed", fontFamily: "monospace", fontWeight: 700 }}>{item.barcodeNo}</span>}
            {!item.barcodeNo && <span style={{ color: "#fbbf24", fontWeight: 600 }}>⚠ No barcode</span>}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {item.amount > 0 && (
            <span style={{ fontSize: 13, fontWeight: 700, color: metalColor }}>
              ₹{item.amount.toLocaleString("en-IN")}
            </span>
          )}
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#e57373", padding: 4, borderRadius: 6, display: "flex" }}>
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} color="#9E8B78" /> : <ChevronDown size={16} color="#9E8B78" />}
        </div>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div style={{ padding: "4px 16px 16px" }}>
          {/* Barcode row */}
          <div style={{ marginBottom: 14 }}>
            <label style={LABEL}>Barcode No {metal === "GOLD" ? "(Code128 Barcode)" : "(QR Code)"}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Barcode size={15} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#7c3aed" }} />
                <input id={`item-barcode-${index}`}
                  value={item.barcodeNo}
                  onChange={e => onChange("barcodeNo", e.target.value.toUpperCase())}
                  placeholder="Auto-assigned or type manually"
                  style={{ ...INPUT, paddingLeft: 34, fontFamily: "monospace", fontWeight: 700, color: "#7c3aed", letterSpacing: "0.5px" }}
                />
              </div>
              {item.barcodeNo && (
                <button onClick={() => onCopyBarcode(item.barcodeNo)}
                  style={{
                    padding: "8px 12px", borderRadius: 10, border: "1.5px solid #7c3aed40",
                    background: "#7c3aed10", cursor: "pointer", color: "#7c3aed",
                    display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
                  }}>
                  {copiedBarcode === item.barcodeNo ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              )}
            </div>
          </div>

          <div style={GRID}>
            <Field label="Ornament Name *">
              <input id={`item-name-${index}`} value={item.ornamentName}
                onChange={e => onChange("ornamentName", e.target.value.toUpperCase())}
                placeholder="e.g. RING IMS" style={INPUT} />
            </Field>
            <Field label="HUID No">
              <input id={`item-huid-${index}`} value={item.huidNo}
                onChange={e => onChange("huidNo", e.target.value.toUpperCase())}
                placeholder="HUID number" style={INPUT} />
            </Field>
            <Field label="Purity *">
              <select id={`item-purity-${index}`} value={item.purity}
                onChange={e => onChange("purity", e.target.value)}
                style={{ ...INPUT, cursor: "pointer" }}>
                <option value="">Select purity</option>
                {purities.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Qty">
              <input id={`item-qty-${index}`} type="number" min={1} value={item.qty}
                onChange={e => onChange("qty", parseInt(e.target.value) || 1)} style={INPUT} />
            </Field>
            <Field label="Gross Weight (g) *">
              <input id={`item-weight-${index}`} type="number" step="0.001"
                value={item.weight || ""}
                onChange={e => onChange("weight", parseFloat(e.target.value) || 0)}
                placeholder="0.000" style={INPUT} />
            </Field>
            <Field label="Net Weight (g)">
              <input id={`item-netweight-${index}`} type="number" step="0.001"
                value={item.netWeight || ""}
                onChange={e => onChange("netWeight", parseFloat(e.target.value) || 0)}
                placeholder="Same as gross if blank" style={INPUT} />
            </Field>
            <Field label="Rate (₹/g)">
              <input id={`item-rate-${index}`} type="number" step="0.01"
                value={item.rate || ""}
                onChange={e => onChange("rate", parseFloat(e.target.value) || 0)}
                placeholder="0.00" style={INPUT} />
            </Field>
            <Field label="Making Charges">
              <input id={`item-making-${index}`} value={item.making}
                onChange={e => onChange("making", e.target.value)}
                placeholder="e.g. 500 or 15%" style={INPUT} />
            </Field>
            <Field label="Amount (₹)">
              <input id={`item-amount-${index}`} type="number" step="0.01"
                value={item.amount || ""}
                onChange={e => onChange("amount", parseFloat(e.target.value) || 0)}
                placeholder="Auto-calculated"
                style={{ ...INPUT, background: "#fafaf5", fontWeight: 700, color: "#B8860B" }} />
            </Field>
            <Field label={metal === "SILVER" ? "Size / Remark" : "Remark"}>
              <input id={`item-remark-${index}`} value={item.remark}
                onChange={e => onChange("remark", e.target.value)}
                placeholder={metal === "SILVER" ? "Size info (shown on tag)" : "Optional note"} style={INPUT} />
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 10,
  border: "1.5px solid #e8e0d4", fontSize: 13, color: "#2d3748",
  background: "white", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s",
};

const LABEL: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700, color: "#9E8B78",
  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6,
};

const GRID: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14,
};

const btnPrimary = (color: string): React.CSSProperties => ({
  padding: "13px 24px", borderRadius: 12, border: "none", cursor: "pointer",
  fontWeight: 700, fontSize: 15,
  background: `linear-gradient(135deg, ${color}, ${color}cc)`,
  color: "white", boxShadow: `0 4px 16px ${color}40`, transition: "all 0.2s",
});
