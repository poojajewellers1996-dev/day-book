"use client";

import React, { useState, useEffect } from "react";
import { Save, RefreshCw, ShoppingCart, User, IndianRupee, Calculator, BookOpen, Plus, Trash2, Printer } from "lucide-react";
import { fetchDayBook, addSubEntry, SoldItem, fetchBarcodeItem, fetchAllSoldItems } from "../utils/api";
import { UPI_ACCOUNTS } from "./DiaryPage";

export function getNextGstInvoiceNo(salesList: SoldItem[]): { invoiceNo: string; bookNo: string } {
  const gstBills = salesList.filter((item) => {
    const typeMatch = item.item_name.match(/\[TYPE:([^\]]+)\]/);
    if (typeMatch) {
      return typeMatch[1].trim().toUpperCase() === "GST";
    }
    return item.item_name.includes("[GST]");
  });

  const uniqueGstInvoices = new Set<string>();
  let maxSeq = 0;

  gstBills.forEach((item) => {
    const invMatch = item.item_name.match(/\[INV:([^\]]+)\]/);
    const billMatch = item.item_name.match(/\[BILL:([^\]]+)\]/);
    if (invMatch && invMatch[1].trim()) {
      const invStr = invMatch[1].trim();
      uniqueGstInvoices.add(invStr);
      const numMatch = invStr.match(/(\d+)/g);
      if (numMatch) {
        const lastNum = parseInt(numMatch[numMatch.length - 1], 10);
        if (!isNaN(lastNum) && lastNum > maxSeq) {
          maxSeq = lastNum;
        }
      }
    } else if (billMatch && billMatch[1].trim()) {
      uniqueGstInvoices.add(billMatch[1].trim());
    } else {
      uniqueGstInvoices.add(`ITEM_${item.id}`);
    }
  });

  const nextSeq = Math.max(uniqueGstInvoices.size + 1, maxSeq + 1);
  const seqStr = nextSeq.toString().padStart(4, "0");

  return {
    invoiceNo: `PJ/2026-27/INV-${seqStr}`,
    bookNo: `B-${nextSeq}`,
  };
}

interface SaleFormViewProps {
  currentDate: string;
  onSuccess: (item: SoldItem, shouldPrint?: boolean) => void;
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
}

interface AddedItem {
  barcode: string;
  itemName: string;
  purity: string;
  metal: string;
  weight: number;
  qty: number;
  rate: string;
  wastage: string;
  making: string;
  amount: number;
}

interface ExchangeItem {
  itemName: string;
  purity: string;
  metal: "GOLD" | "SILVER";
  weight: number;
  ratePerGram: number;
  wastage: number; // in grams
  amount: number;
}

export default function SaleFormView({
  currentDate,
  onSuccess,
  showNotification,
}: SaleFormViewProps) {
  const [loading, setLoading] = useState(false);
  const [barcodeSearchLoading, setBarcodeSearchLoading] = useState(false);
  const [addedItems, setAddedItems] = useState<AddedItem[]>([]);
  const [exchangeItems, setExchangeItems] = useState<ExchangeItem[]>([]);
  const [isBarcodeAlreadySold, setIsBarcodeAlreadySold] = useState(false);
  const [barcodeSoldDate, setBarcodeSoldDate] = useState("");
  const [isContinuousScan, setIsContinuousScan] = useState(false);
  const [billType, setBillType] = useState<"GST" | "ESTIMATE">("GST");

  const [form, setForm] = useState({
    date: currentDate || new Date().toISOString().split("T")[0],
    barcode: "",
    purity: "",
    itemName: "",
    weight: "",
    metal: "GOLD",
    qty: "1",
    itemAmount: "", // Manual total override for this item
    invoiceNo: "", // Manual GST Invoice Number
    bookNo: "", // Manual Book Number
    // Customer details
    custName: "",
    custMobile: "",
    custAddress: "",
    custAadhar: "",
    custPan: "",
    // Calculator for current item
    ratePerGram: "",
    wastageCharges: "",
    makingCharges: "",
    // Payment split
    cashAmount: "",
    upiAmount: "",
    otherAmount: "",
    upiAccount: "hdfc_192",
  });

  const [metalValue, setMetalValue] = useState(0);
  const [calculatedTotal, setCalculatedTotal] = useState(0);
  const [splitTotal, setSplitTotal] = useState(0);

  const [exForm, setExForm] = useState({
    itemName: "",
    purity: "",
    metal: "GOLD" as "GOLD" | "SILVER",
    weight: "",
    ratePerGram: "",
    wastage: "",
    amount: "",
  });
  const [calculatedExTotal, setCalculatedExTotal] = useState(0);

  // Compute calculated pricing for current item
  useEffect(() => {
    const w = parseFloat(form.weight) || 0;
    const r = parseFloat(form.ratePerGram) || 0;
    const wastage = parseFloat(form.wastageCharges) || 0;
    const making = parseFloat(form.makingCharges) || 0;

    const baseVal = w * r;
    setMetalValue(baseVal);
    
    const wastageAmt = baseVal * (wastage / 100);
    const total = baseVal + wastageAmt + making;
    setCalculatedTotal(total);
  }, [form.weight, form.ratePerGram, form.wastageCharges, form.makingCharges]);

  // Compute calculated pricing for current exchange item
  useEffect(() => {
    const w = parseFloat(exForm.weight) || 0;
    const r = parseFloat(exForm.ratePerGram) || 0;
    const wastage = parseFloat(exForm.wastage) || 0;
    setCalculatedExTotal(Math.max(0, (w - wastage) * r));
  }, [exForm.weight, exForm.ratePerGram, exForm.wastage]);

  // Compute payment split total
  useEffect(() => {
    const cash = parseFloat(form.cashAmount) || 0;
    const upi = parseFloat(form.upiAmount) || 0;
    const other = parseFloat(form.otherAmount) || 0;
    setSplitTotal(cash + upi + other);
  }, [form.cashAmount, form.upiAmount, form.otherAmount]);

  const grandTotal = addedItems.reduce((sum, item) => sum + item.amount, 0);
  const exchangeTotal = exchangeItems.reduce((sum, item) => sum + item.amount, 0);
  const netPayableTotal = Math.max(0, grandTotal - exchangeTotal);

  const applyCalculatedTotal = () => {
    if (netPayableTotal <= 0) {
      showNotification("Net payable total is 0. Please add items to the list first.", "info");
      return;
    }
    setForm((prev) => ({
      ...prev,
      cashAmount: netPayableTotal.toFixed(2),
      upiAmount: "",
      otherAmount: "",
    }));
    showNotification("Applied net payable total to Cash Payment", "success");
  };

  const handleAddExchangeItem = () => {
    if (!exForm.itemName) {
      showNotification("Please enter exchange item description first", "error");
      return;
    }
    const weightVal = parseFloat(exForm.weight) || 0;
    if (weightVal <= 0) {
      showNotification("Please enter a valid exchange weight", "error");
      return;
    }

    const calculatedAmt = parseFloat(exForm.amount) || calculatedExTotal;
    if (calculatedAmt <= 0) {
      showNotification("Please enter rate and weight or set a valid amount for exchange", "error");
      return;
    }

    const newItem: ExchangeItem = {
      itemName: exForm.itemName,
      metal: exForm.metal,
      purity: exForm.purity,
      weight: weightVal,
      ratePerGram: parseFloat(exForm.ratePerGram) || 0,
      wastage: parseFloat(exForm.wastage) || 0,
      amount: calculatedAmt,
    };

    setExchangeItems((prev) => [...prev, newItem]);

    setExForm({
      itemName: "",
      purity: "",
      metal: "GOLD",
      weight: "",
      ratePerGram: "",
      wastage: "",
      amount: "",
    });

    showNotification("Exchange item added to list!", "success");
  };

  const handleBarcodeLookup = async (barcodeVal: string) => {
    const cleanBarcode = barcodeVal.trim();
    if (!cleanBarcode) return;

    setBarcodeSearchLoading(true);
    setIsBarcodeAlreadySold(false);
    setBarcodeSoldDate("");

    try {
      const res = await fetchBarcodeItem(cleanBarcode);
      if (res.found && res.item) {
        const { metal, itemName, purity, qty, weight, huid } = res.item;
        
        setIsBarcodeAlreadySold(!!res.is_sold);
        setBarcodeSoldDate(res.sold_date || "");

        if (res.is_sold) {
          showNotification(`⚠️ Barcode ${cleanBarcode} is ALREADY sold on ${res.sold_date}!`, "error");
          setBarcodeSearchLoading(false);
          return;
        }

        if (isContinuousScan) {
          const rateVal = parseFloat(form.ratePerGram) || 0;
          const wastageVal = parseFloat(form.wastageCharges) || 0;
          const makingVal = parseFloat(form.makingCharges) || 0;
          
          if (rateVal === 0) {
            showNotification("⚠️ Please set a Rate per Gram first for automatic pricing!", "info");
          }

          const baseVal = weight * rateVal;
          const wastageAmt = baseVal * (wastageVal / 100);
          const computedAmount = baseVal + wastageAmt + makingVal;

          const newItem: AddedItem = {
            barcode: cleanBarcode.toUpperCase(),
            itemName: huid ? `${itemName} (HUID: ${huid})` : itemName,
            purity: purity,
            metal: metal,
            weight: weight,
            qty: qty,
            rate: rateVal.toString(),
            wastage: wastageVal.toString(),
            making: makingVal.toString(),
            amount: computedAmount,
          };

          setAddedItems((prev) => [...prev, newItem]);
          showNotification(`Added ${itemName} (${weight}g) to list!`, "success");

          // Reset only the scanned barcode
          setForm((prev) => ({
            ...prev,
            barcode: "",
          }));
        } else {
          // Normal manual review flow
          setForm((prev) => ({
            ...prev,
            metal: metal,
            itemName: huid ? `${itemName} (HUID: ${huid})` : itemName,
            purity: purity,
            qty: qty.toString(),
            weight: weight.toString(),
          }));
          showNotification(`Barcode details loaded: ${itemName}`, "success");
        }
      } else {
        showNotification("Barcode not found in stock sheets", "error");
      }
    } catch (e: any) {
      console.warn("Failed to lookup barcode:", e.message || e);
      showNotification("Failed to lookup barcode", "error");
    } finally {
      setBarcodeSearchLoading(false);
    }
  };

  const handleAddItem = () => {
    if (isBarcodeAlreadySold) {
      showNotification(`Cannot add item: Barcode ${form.barcode} was already sold on ${barcodeSoldDate}`, "error");
      return;
    }
    if (!form.itemName) {
      showNotification("Please enter item description first", "error");
      return;
    }
    const weightVal = parseFloat(form.weight) || 0;
    if (weightVal <= 0) {
      showNotification("Please enter a valid weight", "error");
      return;
    }

    const calculatedItemAmt = parseFloat(form.itemAmount) || calculatedTotal;
    if (calculatedItemAmt <= 0) {
      showNotification("Please enter rate and weight or set a valid amount", "error");
      return;
    }

    // If making charge is empty, derive it from (total - metalBase - wastageAmt)
    const weightVal2 = parseFloat(form.weight) || 0;
    const rateVal = parseFloat(form.ratePerGram) || 0;
    const wastageVal = parseFloat(form.wastageCharges) || 0;
    const metalBase = weightVal2 * rateVal;
    const wastageAmt = metalBase * (wastageVal / 100);
    let effectiveMaking = parseFloat(form.makingCharges) || 0;
    if (effectiveMaking <= 0 && form.itemAmount) {
      effectiveMaking = Math.max(0, calculatedItemAmt - metalBase - wastageAmt);
    }

    const newItem: AddedItem = {
      barcode: form.barcode,
      itemName: form.itemName,
      purity: form.purity,
      metal: form.metal,
      weight: weightVal,
      qty: parseInt(form.qty) || 1,
      rate: form.ratePerGram || "0",
      wastage: form.wastageCharges || "0",
      making: effectiveMaking > 0 ? effectiveMaking.toFixed(2) : (form.makingCharges || "0"),
      amount: calculatedItemAmt,
    };

    setAddedItems((prev) => [...prev, newItem]);

    // Reset item input fields only
    setIsBarcodeAlreadySold(false);
    setBarcodeSoldDate("");
    setForm((prev) => ({
      ...prev,
      barcode: "",
      purity: "",
      itemName: "",
      weight: "",
      qty: "1",
      itemAmount: "",
      ratePerGram: "",
      wastageCharges: "",
      makingCharges: "",
    }));

    showNotification("Item added to bill list!", "success");
  };

  const handleRemoveItem = (index: number) => {
    setAddedItems((prev) => prev.filter((_, i) => i !== index));
    showNotification("Item removed from bill list", "info");
  };

  const handleSubmit = async (e: React.FormEvent, shouldPrint: boolean = true) => {
    e.preventDefault();
    if (addedItems.length === 0) {
      showNotification("Please add at least one item to the list before saving.", "error");
      return;
    }

    const cashAmt = parseFloat(form.cashAmount || "0");
    const upiAmt = parseFloat(form.upiAmount || "0");
    const otherAmt = parseFloat(form.otherAmount || "0");
    const totalAmt = cashAmt + upiAmt + otherAmt;

    if (totalAmt <= 0 && netPayableTotal > 0) {
      showNotification("Total split amount must be greater than 0", "error");
      return;
    }

    // Check if the split total matches the net total
    if (Math.abs(totalAmt - netPayableTotal) > 0.05) {
      showNotification(`Warning: Payment split (₹${totalAmt.toFixed(2)}) does not match Net Payable Total (₹${netPayableTotal.toFixed(2)})`, "info");
    }

    setLoading(true);
    try {
      // 1. Fetch or create DayBook for the sale date
      const dbRes = await fetchDayBook(form.date);
      const db = dbRes.data;

      // Register each item
      let lastRes: any = null;
      const billGroupId = `BILL-${Date.now()}`;
      const billMeta = `[BILL:${billGroupId}]`;

      let sharedInvNo = "";
      let sharedBookNo = "";

      if (billType === "GST") {
        if (form.invoiceNo && form.invoiceNo.trim()) {
          sharedInvNo = form.invoiceNo.trim();
        } else {
          try {
            const allItems = await fetchAllSoldItems();
            const { invoiceNo, bookNo } = getNextGstInvoiceNo(allItems || []);
            sharedInvNo = invoiceNo;
            if (!form.bookNo) sharedBookNo = bookNo;
          } catch {
            sharedInvNo = `PJ/2026-27/INV-${Date.now().toString().slice(-4)}`;
          }
        }
        if (form.bookNo && form.bookNo.trim()) {
          sharedBookNo = form.bookNo.trim();
        }
      }

      const invMeta = sharedInvNo ? `[INV:${sharedInvNo}]${sharedBookNo ? `[BOOK:${sharedBookNo}]` : ""}` : "";

      for (const item of addedItems) {
        // Encode customer info, price info, and bill type in item_name metadata blocks
        const custMeta = `[CUST:${form.custName}|${form.custMobile}|${form.custAddress}|${form.custAadhar}|${form.custPan}]`;
        const priceMeta = `[PRICE:${item.rate || "0"}|${item.wastage || "0"}|${item.making || "0"}|${item.purity || ""}]`;
        const typeMeta = `[TYPE:${billType}]`;
        const barcodePrefix = item.barcode ? `[BARCODE:${item.barcode}] ` : "";
        const item_name = `[${item.metal}]${typeMeta}${billMeta}${invMeta}[SPLIT:C${cashAmt}:U${upiAmt}:O${otherAmt}]${custMeta}${priceMeta} ${barcodePrefix}${item.itemName}`;

        const soldData = {
          item_name,
          quantity: item.qty,
          weight: item.weight,
          amount: item.amount,
        };

        lastRes = await addSubEntry(db.id, form.date, "sold-item", soldData);
        if (!lastRes.success) {
          throw new Error(`Failed to save sold item: ${item.itemName}`);
        }
      }

      // Save exchange items (old gold/silver)
      for (const item of exchangeItems) {
        const custMeta = `[CUST:${form.custName}|${form.custMobile}|${form.custAddress}|${form.custAadhar}|${form.custPan}]`;
        const exchangeMeta = `[EXCHANGE:${item.itemName}|${item.purity}|${item.ratePerGram}|${item.wastage}]`;
        const customer_name = `${custMeta}${exchangeMeta} ${form.custName || "Cash Customer"}`;

        const exchangeData = {
          customer_name,
          weight: item.weight,
          amount: item.amount,
        };

        const section = item.metal === "GOLD" ? "old-gold" : "old-silver";
        const exRes = await addSubEntry(db.id, form.date, section, exchangeData);
        if (!exRes.success) {
          throw new Error(`Failed to save exchange item: ${item.itemName}`);
        }
      }

      // 3. Post corresponding UPI/PhonePe entry if upiAmt > 0
      if (upiAmt > 0) {
        const itemNamesDesc = addedItems.map(i => i.itemName).join(", ");
        await addSubEntry(db.id, form.date, "phonepe", {
          customer_name: `[UPI:${form.upiAccount}] ${itemNamesDesc} (Sale)`,
          amount: upiAmt,
        });
      }

      showNotification("Sale registered successfully!", "success");
      setLoading(false);
      setAddedItems([]);
      setExchangeItems([]);

      // Reset form
      setForm((prev) => ({
        ...prev,
        barcode: "",
        purity: "",
        itemName: "",
        weight: "",
        metal: "GOLD",
        qty: "1",
        itemAmount: "",
        custName: "",
        custMobile: "",
        custAddress: "",
        custAadhar: "",
        custPan: "",
        ratePerGram: "",
        wastageCharges: "",
        makingCharges: "",
        cashAmount: "",
        upiAmount: "",
        otherAmount: "",
      }));

      // Trigger print slip overlay
      if (lastRes && lastRes.data) {
        onSuccess(lastRes.data, shouldPrint);
      }
    } catch (e) {
      console.error(e);
      showNotification("Failed to register sale", "error");
      setLoading(false);
    }
  };

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
    <div onKeyDown={handleEnterToNext} className="bg-white rounded-3xl p-6 border border-amber-900/10 shadow-lg font-serif">
      <div className="flex items-center gap-2 mb-4 border-b border-amber-900/10 pb-3">
        <div className="w-8 h-8 rounded-xl bg-diary-red flex items-center justify-center text-white">
          <ShoppingCart size={16} />
        </div>
        <div>
          <h2 className="text-lg font-black text-amber-955 uppercase tracking-wide">New Sale Entry</h2>
          <p className="text-[10px] font-sans font-bold text-amber-900/60 uppercase">Register customer purchase &amp; print invoice</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs">
        
        {/* 1ST OPTION: Bill Type Selector (Required First Choice) */}
        <div className="bg-amber-100/60 border border-amber-900/20 rounded-2xl p-3.5 space-y-2 shadow-xs">
          <label className="block text-[10px] font-black text-amber-950 uppercase tracking-widest flex items-center justify-between">
            <span>1️⃣ Select Bill Type (First Step)</span>
            <span className="text-[9px] text-amber-900/70 font-bold lowercase">choose GST Tax Bill or Estimate Counter Sale</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setBillType("GST")}
              className={`py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                billType === "GST"
                  ? "bg-emerald-800 text-white border-emerald-900 shadow-md scale-[1.01]"
                  : "bg-white text-amber-950 border-amber-900/20 hover:bg-emerald-50"
              }`}
            >
              <span className="text-base">🧾</span>
              <div className="text-left">
                <p className="font-extrabold leading-tight">GST INVOICE (3%)</p>
                <p className={`text-[9px] ${billType === "GST" ? "text-emerald-100" : "text-amber-800/70"}`}>Official Tax Invoice with GST</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setBillType("ESTIMATE")}
              className={`py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border ${
                billType === "ESTIMATE"
                  ? "bg-amber-800 text-white border-amber-900 shadow-md scale-[1.01]"
                  : "bg-white text-amber-950 border-amber-900/20 hover:bg-amber-50"
              }`}
            >
              <span className="text-base">📋</span>
              <div className="text-left">
                <p className="font-extrabold leading-tight">ESTIMATE BILL</p>
                <p className={`text-[9px] ${billType === "ESTIMATE" ? "text-amber-100" : "text-amber-800/70"}`}>Rough Bill / Daily Counter Sale</p>
              </div>
            </button>
          </div>

          {billType === "GST" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-dashed border-amber-900/15 mt-3">
              <div>
                <label className="block text-[10px] font-bold text-emerald-900 uppercase mb-0.5">
                  GST Invoice Number <span className="text-amber-800 font-normal">(Manual Entry)</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter manual invoice no (e.g. 101, INV-502)"
                  value={form.invoiceNo}
                  onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })}
                  className="w-full bg-white border border-emerald-900/30 rounded-xl px-3 py-1.5 text-xs text-emerald-950 font-mono font-bold focus:outline-none focus:border-emerald-600 shadow-2xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-amber-900 uppercase mb-0.5">
                  Book No / Serial <span className="text-amber-800/60 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter book no (e.g. B-1)"
                  value={form.bookNo}
                  onChange={(e) => setForm({ ...form, bookNo: e.target.value })}
                  className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-1.5 text-xs text-amber-955 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Row 2: Customer Details */}
        <div className="bg-amber-50/25 border border-amber-900/10 rounded-2xl p-4 space-y-3">
          <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest border-b border-dashed border-amber-900/20 pb-1 flex items-center gap-1.5">
            <User size={13} className="text-amber-800" /> Customer Details
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Customer Name</label>
              <input
                type="text"
                placeholder="Enter customer name"
                value={form.custName}
                onChange={(e) => setForm({ ...form, custName: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-1.5 text-xs text-amber-955 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Mobile Number</label>
              <input
                type="text"
                placeholder="Enter 10-digit mobile"
                value={form.custMobile}
                onChange={(e) => setForm({ ...form, custMobile: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-1.5 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Address</label>
            <input
              type="text"
              placeholder="Enter customer address"
              value={form.custAddress}
              onChange={(e) => setForm({ ...form, custAddress: e.target.value })}
              className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-1.5 text-xs text-amber-955 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Aadhar Card No</label>
              <input
                type="text"
                placeholder="Enter Aadhar No"
                value={form.custAadhar}
                onChange={(e) => setForm({ ...form, custAadhar: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-1.5 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">PAN Card No</label>
              <input
                type="text"
                placeholder="Enter PAN No"
                value={form.custPan}
                onChange={(e) => setForm({ ...form, custPan: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-1.5 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Row 2: Scan Stock Barcode card */}
        <div className="bg-amber-50/15 border border-amber-900/10 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-dashed border-amber-900/20 pb-1">
            <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest flex items-center gap-1.5">
              🏷️ Add Item to Bill
            </span>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-[10px] font-bold text-amber-900 uppercase cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isContinuousScan}
                  onChange={(e) => setIsContinuousScan(e.target.checked)}
                  className="rounded border-amber-300 text-amber-850 focus:ring-amber-550 w-3.5 h-3.5"
                />
                🔄 Continuous Scan
              </label>
              {barcodeSearchLoading && <RefreshCw size={12} className="animate-spin text-amber-800" />}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Scan or Enter Barcode (e.g. B0000009)"
              value={form.barcode}
              onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleBarcodeLookup(form.barcode);
                }
              }}
              className="flex-1 bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none font-mono uppercase"
            />
            <button
              type="button"
              onClick={() => handleBarcodeLookup(form.barcode)}
              className="bg-amber-800 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs hover:bg-amber-950 transition-all uppercase"
            >
              Lookup
            </button>
          </div>

          {isBarcodeAlreadySold && (
            <div style={{
              background: "#fff5f5",
              border: "1px solid #fca5a5",
              color: "#dc2626",
              padding: "10px 14px",
              borderRadius: "12px",
              fontWeight: 750,
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              ⚠️ Alert: Barcode is already marked as SOLD on {barcodeSoldDate}.
            </div>
          )}

          {/* Form details for current item */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Sale Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none focus:ring-1 focus:ring-amber-800"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Item Description</label>
              <input
                type="text"
                placeholder="e.g. Gold Ring, Silver Chain"
                value={form.itemName}
                onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1 flex items-center gap-1">
                ✨ Purity / Quality
              </label>
              <input
                type="text"
                placeholder="e.g. KDM 75HM, 916, 92.5"
                value={form.purity}
                onChange={(e) => setForm({ ...form, purity: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Metal</label>
              <select
                value={form.metal}
                onChange={(e) => setForm({ ...form, metal: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 font-bold focus:outline-none"
              >
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Weight (g)</label>
              <input
                type="number"
                step="0.001"
                placeholder="0.000"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Qty (pcs)</label>
              <input
                type="number"
                placeholder="1"
                value={form.qty}
                onChange={(e) => setForm({ ...form, qty: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Pricing Calculator */}
          <div className="border border-amber-900/10 p-3 rounded-xl bg-amber-50/5 space-y-2 mt-2">
            <div className="flex justify-between items-center pb-1 border-b border-dotted border-amber-900/10">
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-widest flex items-center gap-1.5">
                <Calculator size={12} className="text-amber-800" /> Item Pricing
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[9px] font-semibold text-amber-900">Rate per Gram (₹)</label>
                <input
                  type="number"
                  placeholder="Rate per gram"
                  value={form.ratePerGram}
                  onChange={(e) => setForm({ ...form, ratePerGram: e.target.value })}
                  className="w-full bg-white border border-amber-900/15 rounded-lg px-2.5 py-1 text-xs text-amber-955 focus:outline-none font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-amber-900">Wastage Charges (%)</label>
                <input
                  type="number"
                  placeholder="Wastage % (e.g. 10)"
                  value={form.wastageCharges}
                  onChange={(e) => setForm({ ...form, wastageCharges: e.target.value })}
                  className="w-full bg-white border border-amber-900/15 rounded-lg px-2.5 py-1 text-xs text-amber-955 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[9px] font-semibold text-amber-900">Making Charges (₹)</label>
                <input
                  type="number"
                  placeholder="Making charges"
                  value={form.makingCharges}
                  onChange={(e) => setForm({ ...form, makingCharges: e.target.value })}
                  className="w-full bg-white border border-amber-900/15 rounded-lg px-2.5 py-1 text-xs text-amber-955 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-amber-900">Custom Total Item Price (₹)</label>
                <input
                  type="number"
                  placeholder="Negotiated Total"
                  value={form.itemAmount}
                  onChange={(e) => setForm({ ...form, itemAmount: e.target.value })}
                  className="w-full bg-white border border-amber-900/20 rounded-lg px-2.5 py-1 text-xs text-amber-955 focus:outline-none font-mono font-black placeholder:font-normal"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 text-[10px]">
              <div className="flex gap-3 text-amber-900/70 font-sans font-bold">
                <span>Metal: ₹{metalValue.toFixed(2)}</span>
                <span>Wastage/Making: ₹{((metalValue * (parseFloat(form.wastageCharges) || 0) / 100) + (parseFloat(form.makingCharges) || 0)).toFixed(2)}</span>
                <span>Calculated: ₹{calculatedTotal.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="bg-amber-800 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm hover:bg-amber-950 transition-all flex items-center gap-1 uppercase"
              >
                <Plus size={13} /> Add Item to Bill
              </button>
            </div>
          </div>
        </div>

        {/* Old Gold/Silver Exchange Card */}
        <div className="bg-amber-50/15 border border-amber-900/10 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-dashed border-amber-900/20 pb-1">
            <span className="text-[10px] font-black text-amber-900 uppercase tracking-widest flex items-center gap-1.5">
              🔄 Old Gold/Silver Exchange
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Item Description</label>
              <input
                type="text"
                placeholder="e.g. Old Chain, Old Earrings"
                value={exForm.itemName}
                onChange={(e) => setExForm({ ...exForm, itemName: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Metal</label>
              <select
                value={exForm.metal}
                onChange={(e) => setExForm({ ...exForm, metal: e.target.value as any })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 font-bold focus:outline-none"
              >
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">Purity</label>
              <input
                type="text"
                placeholder="e.g. 18kt, 22kt"
                value={exForm.purity}
                onChange={(e) => setExForm({ ...exForm, purity: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Weight (g)</label>
              <input
                type="number"
                step="0.001"
                placeholder="0.000"
                value={exForm.weight}
                onChange={(e) => setExForm({ ...exForm, weight: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Rate per Gram (₹)</label>
              <input
                type="number"
                placeholder="Rate"
                value={exForm.ratePerGram}
                onChange={(e) => setExForm({ ...exForm, ratePerGram: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Wastage (g)</label>
              <input
                type="number"
                step="0.001"
                placeholder="0.000"
                value={exForm.wastage}
                onChange={(e) => setExForm({ ...exForm, wastage: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-amber-900 mb-0.5">Custom Exchange Value (₹)</label>
              <input
                type="number"
                placeholder="Negotiated Value"
                value={exForm.amount}
                onChange={(e) => setExForm({ ...exForm, amount: e.target.value })}
                className="w-full bg-white border border-amber-900/20 rounded-lg px-2.5 py-1.5 text-xs text-amber-955 focus:outline-none font-mono font-black"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-1 text-[10px]">
            <div className="text-amber-900/70 font-sans font-bold">
              Calculated Value: ₹{calculatedExTotal.toFixed(2)}
            </div>
            <button
              type="button"
              onClick={handleAddExchangeItem}
              className="bg-amber-800 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm hover:bg-amber-950 transition-all flex items-center gap-1 uppercase"
            >
              <Plus size={13} /> Add Exchange Item
            </button>
          </div>
        </div>

        {/* Row 3: Added Items List */}
        <div className="bg-white border border-amber-900/10 rounded-2xl p-4 space-y-2">
          <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest border-b border-dashed border-amber-900/20 pb-1 flex items-center gap-1.5">
            <ShoppingCart size={13} className="text-amber-800" /> Items Added to Bill ({addedItems.length})
          </h4>
          
          {addedItems.length === 0 ? (
            <div className="text-center py-6 text-amber-900/40 font-bold uppercase tracking-wider text-[10px]">
              No items added yet. Enter details above and click "Add Item to Bill"
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-amber-900/10 text-amber-900 uppercase text-[9px] font-black">
                    <th className="py-2">#</th>
                    <th className="py-2">Description</th>
                    <th className="py-2">Purity</th>
                    <th className="py-2">Metal</th>
                    <th className="py-2 text-right">Weight (g)</th>
                    <th className="py-2 text-right">Qty</th>
                    <th className="py-2 text-right">Rate (/g)</th>
                    <th className="py-2 text-right">Total Price</th>
                    <th className="py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-900/5">
                  {addedItems.map((item, idx) => (
                    <tr key={idx} className="text-amber-955 font-semibold">
                      <td className="py-2 text-amber-900/50">{idx + 1}</td>
                      <td className="py-2 font-bold">{item.itemName}</td>
                      <td className="py-2">{item.purity || "—"}</td>
                      <td className="py-2">
                        <span className="text-[9px] bg-amber-100/50 text-amber-900 px-1.5 py-0.5 rounded font-black">
                          {item.metal}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono">{item.weight.toFixed(3)}g</td>
                      <td className="py-2 text-right font-mono">{item.qty}</td>
                      <td className="py-2 text-right font-mono">₹{parseFloat(item.rate).toFixed(2)}</td>
                      <td className="py-2 text-right font-mono font-bold text-diary-red">₹{item.amount.toFixed(2)}</td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-diary-red hover:text-red-700 transition-colors p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Row 3.5: Exchange Items List */}
        {exchangeItems.length > 0 && (
          <div className="bg-white border border-amber-900/10 rounded-2xl p-4 space-y-2">
            <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest border-b border-dashed border-amber-900/20 pb-1 flex items-center gap-1.5">
              🔄 Old Gold/Silver Exchange Items ({exchangeItems.length})
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead>
                  <tr className="border-b border-amber-900/10 text-amber-900 uppercase text-[9px] font-black">
                    <th className="py-2">#</th>
                    <th className="py-2">Description</th>
                    <th className="py-2">Purity</th>
                    <th className="py-2">Metal</th>
                    <th className="py-2 text-right">Weight (g)</th>
                    <th className="py-2 text-right">Wastage (g)</th>
                    <th className="py-2 text-right">Rate (/g)</th>
                    <th className="py-2 text-right">Total Exchange Value</th>
                    <th className="py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-900/5">
                  {exchangeItems.map((item, idx) => (
                    <tr key={idx} className="text-amber-955 font-semibold">
                      <td className="py-2 text-amber-900/50">{idx + 1}</td>
                      <td className="py-2 font-bold">{item.itemName}</td>
                      <td className="py-2">{item.purity || "—"}</td>
                      <td className="py-2">
                        <span className="text-[9px] bg-amber-100/50 text-amber-900 px-1.5 py-0.5 rounded font-black">
                          {item.metal}
                        </span>
                      </td>
                      <td className="py-2 text-right font-mono">{item.weight.toFixed(3)}g</td>
                      <td className="py-2 text-right font-mono">{item.wastage.toFixed(3)}g</td>
                      <td className="py-2 text-right font-mono">₹{item.ratePerGram.toFixed(2)}</td>
                      <td className="py-2 text-right font-mono font-bold text-green-700">₹{item.amount.toFixed(2)}</td>
                      <td className="py-2 text-center">
                        <button
                          type="button"
                          onClick={() => setExchangeItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-diary-red hover:text-red-700 transition-colors p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Totals Summary */}
        {(addedItems.length > 0 || exchangeItems.length > 0) && (
          <div className="bg-white border border-amber-900/10 rounded-2xl p-4 space-y-2">
            <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest border-b border-dashed border-amber-900/20 pb-1 flex items-center gap-1.5">
              📊 Bill Summary Totals
            </h4>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-amber-900 uppercase">New Items Total:</span>
                <span className="font-mono font-bold text-amber-950 text-sm">₹{grandTotal.toFixed(2)}</span>
              </div>
              {exchangeTotal > 0 && (
                <div className="flex justify-between items-center text-green-800">
                  <span className="font-bold uppercase">Old Gold/Silver Exchange Total:</span>
                  <span className="font-mono font-bold text-sm">- ₹{exchangeTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-dashed border-amber-900/10">
                <span className="font-black text-amber-900 uppercase">Net Payable Total:</span>
                <span className="font-mono font-black text-diary-red text-lg">₹{netPayableTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Row 4: Split Payments */}
        <div className="bg-amber-50/25 border border-amber-900/10 rounded-2xl p-4 space-y-3.5">
          <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-widest border-b border-dashed border-amber-900/20 pb-1 flex items-center gap-1.5">
            <IndianRupee size={13} className="text-amber-800" /> Payment Method Split
          </h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Cash Paid (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={form.cashAmount}
                onChange={(e) => setForm({ ...form, cashAmount: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">UPI Paid (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={form.upiAmount}
                onChange={(e) => setForm({ ...form, upiAmount: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-900 mb-0.5">Other Paid (₹)</label>
              <input
                type="number"
                placeholder="0"
                value={form.otherAmount}
                onChange={(e) => setForm({ ...form, otherAmount: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs text-amber-955 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* UPI Account Select */}
          {(parseFloat(form.upiAmount) || 0) > 0 && (
            <div className="mt-2.5">
              <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">Select UPI Account</label>
              <select
                value={form.upiAccount}
                onChange={(e) => setForm({ ...form, upiAccount: e.target.value })}
                className="w-full bg-white border border-amber-900/15 rounded-xl px-3 py-2 text-xs font-bold text-amber-900 focus:outline-none"
              >
                {UPI_ACCOUNTS.map((acc) => (
                  <option key={acc.key} value={acc.key}>
                    UPI Acc: {acc.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Form Submission */}
        <div className="flex justify-between items-center pt-3 border-t border-amber-100">
          <div className="text-xs font-semibold text-amber-955 font-serif">
            Paid Total: <span className="font-sans font-black text-diary-red text-sm">₹{splitTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyCalculatedTotal}
              className="bg-amber-800/10 text-amber-900 border border-amber-800/20 py-2.5 px-3 rounded-xl text-xs font-black uppercase hover:bg-amber-800/20 transition-all"
            >
              Fill Total
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={(e) => handleSubmit(e, false)}
              className="bg-emerald-800 text-white py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-emerald-900 transition-all flex items-center gap-1.5"
            >
              <Save size={14} /> Save Only
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-diary-red text-white py-2.5 px-5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-diary-crimson transition-all flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Printer size={14} /> Save &amp; Print Bill
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
