"use client";

import React, { useState, useEffect } from "react";
import { Plus, RefreshCw, Save, Camera, X } from "lucide-react";
import { PledgeEntry, fetchAllPledges, createPledgeEntry } from "../utils/api";
import { compressImageToWebP, compressCanvasToWebP } from "../utils/imageUtils";

const numberToWords = (num: number): string => {
  if (num === 0) return "Zero";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const convertLessThanOneThousand = (n: number): string => {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
    return a[Math.floor(n / 100)] + " Hundred" + (n % 100 === 0 ? "" : " and " + convertLessThanOneThousand(n % 100));
  };

  let result = "";

  // Crores
  const crores = Math.floor(num / 10000000);
  let remaining = num % 10000000;
  if (crores > 0) {
    result += convertLessThanOneThousand(crores) + " Crore ";
  }

  // Lakhs
  const lakhs = Math.floor(remaining / 100000);
  remaining = remaining % 100000;
  if (lakhs > 0) {
    result += convertLessThanOneThousand(lakhs) + " Lakh ";
  }

  // Thousands
  const thousands = Math.floor(remaining / 1000);
  remaining = remaining % 1000;
  if (thousands > 0) {
    result += convertLessThanOneThousand(thousands) + " Thousand ";
  }

  // Hundreds, tens, ones
  if (remaining > 0) {
    result += convertLessThanOneThousand(remaining);
  }

  return result.trim() + " only";
};

const compressImage = (file: File): Promise<string> => {
  return compressImageToWebP(file, { maxWidth: 400, maxHeight: 400, quality: 0.75 });
};

interface PledgeFormViewProps {
  currentDate: string;
  onSuccess: (pledge: PledgeEntry) => void;
  showNotification: (msg: string, type: "success" | "info" | "error") => void;
  isExisting?: boolean;
}

export default function PledgeFormView({
  currentDate, onSuccess, showNotification, isExisting = false,
}: PledgeFormViewProps) {
  const [pledges, setPledges] = useState<PledgeEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Camera States
  const [cameraTarget, setCameraTarget] = useState<"customer" | "item" | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Start Camera
  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    setCameraLoading(true);
    // Stop any existing stream first
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      showNotification("Could not access camera. Please check permissions.", "error");
      setCameraTarget(null);
    } finally {
      setCameraLoading(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraTarget(null);
  };

  // Switch Camera Mode
  const toggleFacingMode = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    if (cameraTarget) {
      startCamera(nextMode);
    }
  };

  // Capture Frame from Video with WebP compression
  const handleCapture = () => {
    if (videoRef.current && videoRef.current.readyState === 4) {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const compressedDataUrl = compressCanvasToWebP(canvas, { maxWidth: 400, maxHeight: 400, quality: 0.75 });

        if (cameraTarget === "customer") {
          setForm((prev) => ({ ...prev, customer_photo: compressedDataUrl }));
        } else if (cameraTarget === "item") {
          setForm((prev) => ({ ...prev, item_photo: compressedDataUrl }));
        }
        stopCamera();
        showNotification("Photo captured & compressed to WebP!", "success");
      }
    } else {
      showNotification("Camera not ready. Please wait.", "info");
    }
  };

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Set srcObject whenever videoRef or stream updates
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, cameraTarget]);

  // Split & UPI Payment States
  const [splitCash, setSplitCash] = useState("");
  const [splitUpi, setSplitUpi] = useState("");
  const [splitUpiAccount, setSplitUpiAccount] = useState("hdfc_192");
  const [upiAccount, setUpiAccount] = useState("hdfc_192");

  // Form State
  const [form, setForm] = useState({
    pledge_no: "",
    date: currentDate || new Date().toISOString().split("T")[0],
    due_date: "",
    customer_name: "",
    pawner_relation: "W/O",
    pawner_relation_name: "",
    mobile: "",
    income: "",
    address: "",
    ornament: "Gold",
    gross_weight: "",
    less_weight: "",
    net_weight: "0",
    quantity: "1",
    estimated_value: "",

    ornament_2: "",
    gross_weight_2: "",
    less_weight_2: "",
    net_weight_2: "0",
    quantity_2: "",
    estimated_value_2: "",

    ornament_3: "",
    gross_weight_3: "",
    less_weight_3: "",
    net_weight_3: "0",
    quantity_3: "",
    estimated_value_3: "",

    amount: "",
    rupees_in_words: "",
    interest_percentage: "2",
    interest_rate_text: "Fourteen percent per annum",
    redemption_period_months: 12,
    interest_payment_frequency: "every 3 Months",
    method: "CASH",
    interest_taken_upfront: false,
    interest_taken_amount: "",
    customer_photo: "",
    item_photo: "",
    is_repledged: 0,
  });

  // Dynamic bank entries for multi-bank re-pledge
  // linked_girvies: comma-separated girvi nos. bundled together in this bank loan
  const [bankEntries, setBankEntries] = useState<Array<{
    name: string; bank: string; loan_no?: string; date: string; amount: string; linked_girvies: string;
  }>>([{ name: "", bank: "", loan_no: "", date: "", amount: "", linked_girvies: "" }]);

  const addBankEntry = () =>
    setBankEntries((prev) => [...prev, { name: "", bank: "", loan_no: "", date: "", amount: "", linked_girvies: "" }]);

  const removeBankEntry = (i: number) =>
    setBankEntries((prev) => prev.filter((_, idx) => idx !== i));

  const updateBankEntry = (i: number, field: string, value: string) =>
    setBankEntries((prev) => prev.map((e, idx) => idx === i ? { ...e, [field]: value } : e));

  const [activeArticleTab, setActiveArticleTab] = useState(1);
  const [activeSuggestionField, setActiveSuggestionField] = useState<"customer_name" | "pawner_relation_name" | "address" | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [form.customer_name, form.pawner_relation_name, form.address]);

  const handleEnterToNext = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA"
      ) {
        if (target.getAttribute("type") === "file" || target.getAttribute("type") === "submit") return;
        e.preventDefault();

        let container: HTMLElement | null = e.currentTarget;
        if (container.tagName !== "FORM") {
          container = container.closest("form");
        }
        if (!container) return;

        const inputs = Array.from(
          container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
            "input:not([disabled]):not([type=hidden]):not([type=file]), select:not([disabled]), textarea:not([disabled])"
          )
        );
        const index = inputs.indexOf(target as any);
        if (index > -1 && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      }
    }
  };

  const handleKeyDown = handleEnterToNext as any;

  const handleKeyDownWithSuggestions = (
    e: React.KeyboardEvent<HTMLInputElement>,
    fieldName: "customer_name" | "pawner_relation_name" | "address",
    suggestions: string[],
    onSelect: (val: string) => void
  ) => {
    if (activeSuggestionField === fieldName && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          e.preventDefault();
          onSelect(suggestions[highlightedIndex]);
          setHighlightedIndex(-1);
          return;
        }
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const formElement = e.currentTarget.form;
      if (!formElement) return;

      const focusable = Array.from(
        formElement.querySelectorAll("input:not([readonly]):not([type=file]), select, textarea")
      ) as HTMLElement[];

      const index = focusable.indexOf(e.currentTarget);
      if (index > -1 && index < focusable.length - 1) {
        focusable[index + 1].focus();
      }
    }
  };

  const cleanCustomerName = (name: string) => {
    if (!name) return "";
    return name.replace(/^\[(UPI|OTHER)(:[^\]]+)?\]\s*/i, "").trim();
  };

  const uniqueCustomerNames = React.useMemo(() => {
    const names = pledges.map(p => cleanCustomerName(p.customer_name)).filter(Boolean);
    return Array.from(new Set(names));
  }, [pledges]);

  const uniqueRelationNames = React.useMemo(() => {
    const names = pledges.map(p => p.pawner_relation_name?.trim()).filter(Boolean) as string[];
    return Array.from(new Set(names));
  }, [pledges]);

  const uniqueAddresses = React.useMemo(() => {
    const addrs = pledges.map(p => p.address?.trim()).filter(Boolean) as string[];
    return Array.from(new Set(addrs));
  }, [pledges]);

  const customerNameSuggestions = React.useMemo(() => {
    if (!form.customer_name || form.customer_name.trim().length === 0) return [];
    const query = form.customer_name.trim().toLowerCase();
    return uniqueCustomerNames.filter(name => name.toLowerCase().includes(query) && name.toLowerCase() !== query);
  }, [form.customer_name, uniqueCustomerNames]);

  const relationNameSuggestions = React.useMemo(() => {
    if (!form.pawner_relation_name || form.pawner_relation_name.trim().length === 0) return [];
    const query = form.pawner_relation_name.trim().toLowerCase();
    return uniqueRelationNames.filter(name => name.toLowerCase().includes(query) && name.toLowerCase() !== query);
  }, [form.pawner_relation_name, uniqueRelationNames]);

  const addressSuggestions = React.useMemo(() => {
    if (!form.address || form.address.trim().length === 0) return [];
    const query = form.address.trim().toLowerCase();
    return uniqueAddresses.filter(addr => addr.toLowerCase().includes(query) && addr.toLowerCase() !== query);
  }, [form.address, uniqueAddresses]);

  const handleSelectCustomerName = (selectedName: string) => {
    const cleanSelected = selectedName.trim().toLowerCase();
    const matchedPledge = pledges.find(p => {
      const pName = cleanCustomerName(p.customer_name).toLowerCase();
      return pName === cleanSelected;
    });

    setForm((prev) => {
      const updated = { ...prev, customer_name: selectedName };
      if (matchedPledge) {
        if (matchedPledge.pawner_relation) updated.pawner_relation = matchedPledge.pawner_relation;
        if (matchedPledge.pawner_relation_name) updated.pawner_relation_name = matchedPledge.pawner_relation_name;
        if (matchedPledge.mobile) updated.mobile = matchedPledge.mobile;
        if (matchedPledge.income) updated.income = matchedPledge.income;
        if (matchedPledge.address) updated.address = matchedPledge.address;
        if (matchedPledge.customer_photo) updated.customer_photo = matchedPledge.customer_photo;
      }
      return updated;
    });
    setActiveSuggestionField(null);
  };

  const handleMobileChange = (val: string) => {
    setForm((prev) => ({ ...prev, mobile: val }));
    const cleanMobile = val.trim();
    if (cleanMobile.length >= 10) {
      const matchedPledge = pledges.find(p => p.mobile && p.mobile.trim() === cleanMobile);
      if (matchedPledge) {
        setForm((prev) => {
          const updated = { ...prev };
          if (matchedPledge.customer_name) updated.customer_name = cleanCustomerName(matchedPledge.customer_name);
          if (matchedPledge.pawner_relation) updated.pawner_relation = matchedPledge.pawner_relation;
          if (matchedPledge.pawner_relation_name) updated.pawner_relation_name = matchedPledge.pawner_relation_name;
          if (matchedPledge.address) updated.address = matchedPledge.address;
          if (matchedPledge.income) updated.income = matchedPledge.income;
          if (matchedPledge.customer_photo) updated.customer_photo = matchedPledge.customer_photo;
          return updated;
        });
        showNotification(`Found customer: ${cleanCustomerName(matchedPledge.customer_name)}! Details autofilled.`, "success");
      }
    }
  };

  const getArticleField = (fieldName: string) => {
    if (activeArticleTab === 1) return (form as any)[fieldName];
    return (form as any)[`${fieldName}_${activeArticleTab}`];
  };

  const setArticleField = (fieldName: string, value: any) => {
    const key = activeArticleTab === 1 ? fieldName : `${fieldName}_${activeArticleTab}`;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Load pledges
  useEffect(() => {
    const loadPledges = async () => {
      const data = await fetchAllPledges();
      setPledges(data);
    };
    loadPledges();
  }, []);

  // Auto-suggest next pledge number based on selected date
  useEffect(() => {
    if (isExisting) return;
    if (!form.date) return;

    // Parse year suffix from form.date (e.g. 2026 -> 26)
    const dateParts = form.date.split("-");
    const yrStr = dateParts[0] ? dateParts[0].slice(-2) : new Date().getFullYear().toString().slice(-2);

    const defaultPledgeNo = `PJ-${yrStr}-0001`;

    if (pledges.length > 0) {
      let maxSeq = 0;
      for (const item of pledges) {
        if (item.pledge_no) {
          const match = item.pledge_no.match(/^PJ-(\d+)-(\d+)$/);
          if (match) {
            const yr = match[1];
            const seq = parseInt(match[2], 10);
            if (yr === yrStr && seq > maxSeq) {
              maxSeq = seq;
            }
          }
        }
      }

      if (maxSeq > 0) {
        const nextSeq = maxSeq + 1;
        const paddedSeq = String(nextSeq).padStart(4, "0");
        setForm((prev) => ({ ...prev, pledge_no: `PJ-${yrStr}-${paddedSeq}` }));
      } else {
        // Look at the absolute last entry in the list as fallback
        const lastNo = pledges[0].pledge_no;
        const matchGeneric = lastNo?.match(/(\d+)$/);
        if (matchGeneric) {
          const nextSeq = parseInt(matchGeneric[1], 10) + 1;
          const paddedSeq = String(nextSeq).padStart(4, "0");
          setForm((prev) => ({ ...prev, pledge_no: `PJ-${yrStr}-${paddedSeq}` }));
        } else {
          setForm((prev) => ({ ...prev, pledge_no: defaultPledgeNo }));
        }
      }
    } else {
      setForm((prev) => ({ ...prev, pledge_no: defaultPledgeNo }));
    }
  }, [form.date, pledges]);

  // Auto-calculate Net Weight
  useEffect(() => {
    const gross = parseFloat(form.gross_weight) || 0;
    const less = parseFloat(form.less_weight) || 0;
    const net = Math.max(0, gross - less);
    setForm((prev) => ({ ...prev, net_weight: net.toFixed(3) }));
  }, [form.gross_weight, form.less_weight]);

  // Auto-calculate Net Weight 2
  useEffect(() => {
    const gross = parseFloat(form.gross_weight_2) || 0;
    const less = parseFloat(form.less_weight_2) || 0;
    const net = Math.max(0, gross - less);
    setForm((prev) => ({ ...prev, net_weight_2: net.toFixed(3) }));
  }, [form.gross_weight_2, form.less_weight_2]);

  // Auto-calculate Net Weight 3
  useEffect(() => {
    const gross = parseFloat(form.gross_weight_3) || 0;
    const less = parseFloat(form.less_weight_3) || 0;
    const net = Math.max(0, gross - less);
    setForm((prev) => ({ ...prev, net_weight_3: net.toFixed(3) }));
  }, [form.gross_weight_3, form.less_weight_3]);

  // Auto-calculate Due Date (1 Year later)
  useEffect(() => {
    if (form.date) {
      const d = new Date(form.date);
      d.setFullYear(d.getFullYear() + 1);
      setForm((prev) => ({ ...prev, due_date: d.toISOString().split("T")[0] }));
    }
  }, [form.date]);

  // Auto-convert Loan Amount to Words
  useEffect(() => {
    const amt = parseFloat(form.amount);
    if (!isNaN(amt) && amt > 0) {
      setForm((prev) => ({ ...prev, rupees_in_words: numberToWords(amt) }));
    } else {
      setForm((prev) => ({ ...prev, rupees_in_words: "" }));
    }
  }, [form.amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pledge_no || !form.customer_name || !form.amount) {
      showNotification("Please fill in required fields", "error");
      return;
    }

    const isSplit = form.method === "SPLIT";
    const cashAmt = parseFloat(splitCash) || 0;
    const upiAmt = parseFloat(splitUpi) || 0;
    const totalAmt = parseFloat(form.amount) || 0;

    if (isSplit && (cashAmt + upiAmt !== totalAmt)) {
      showNotification(`Split amounts (Cash ₹${cashAmt.toLocaleString()} + UPI ₹${upiAmt.toLocaleString()}) must sum up to the total Pledge Amount (₹${totalAmt.toLocaleString()})!`, "error");
      return;
    }

    setLoading(true);
    try {
      const isUpi = form.method === "UPI";
      const isOther = form.method === "OTHER";
      const prefix = isSplit ? `[SPLIT:C${cashAmt}:U${upiAmt}:A${splitUpiAccount}] ` : isUpi ? `[UPI:${upiAccount}] ` : isOther ? "[OTHER] " : "";

      const weightSum = (parseFloat(form.net_weight) || 0) + (parseFloat(form.net_weight_2) || 0) + (parseFloat(form.net_weight_3) || 0);

      const pledgeData = {
        customer_name: prefix + form.customer_name,
        ornament: form.ornament,
        weight: weightSum,
        amount: parseFloat(form.amount),
        interest_percentage: parseFloat(form.interest_percentage) || 2,
        date: form.date,
        pledge_no: form.pledge_no,
        pawner_relation: form.pawner_relation,
        pawner_relation_name: form.pawner_relation_name,
        mobile: form.mobile,
        income: form.income,
        address: form.address,
        rupees_in_words: form.rupees_in_words,
        interest_rate_text: form.interest_rate_text,
        redemption_period_months: parseInt(form.redemption_period_months as any) || 12,
        interest_payment_frequency: form.interest_payment_frequency,
        gross_weight: parseFloat(form.gross_weight) || 0,
        less_weight: parseFloat(form.less_weight) || 0,
        net_weight: parseFloat(form.net_weight) || 0,
        quantity: parseInt(form.quantity) || 1,
        estimated_value: parseFloat(form.estimated_value) || 0,

        ornament_2: form.ornament_2 || null,
        quantity_2: parseInt(form.quantity_2) || null,
        gross_weight_2: parseFloat(form.gross_weight_2) || null,
        less_weight_2: parseFloat(form.less_weight_2) || null,
        net_weight_2: parseFloat(form.net_weight_2) || null,
        estimated_value_2: parseFloat(form.estimated_value_2) || null,

        ornament_3: form.ornament_3 || null,
        quantity_3: parseInt(form.quantity_3) || null,
        gross_weight_3: parseFloat(form.gross_weight_3) || null,
        less_weight_3: parseFloat(form.less_weight_3) || null,
        net_weight_3: parseFloat(form.net_weight_3) || null,
        estimated_value_3: parseFloat(form.estimated_value_3) || null,

        due_date: form.due_date,
        status: "ACTIVE",
        release_date: "",
        customer_photo: form.customer_photo || "",
        item_photo: form.item_photo || "",
        is_existing: isExisting ? 1 : 0,
        is_repledged: form.is_repledged === 1 ? 1 : 0,
        repledged_entries: form.is_repledged === 1
          ? JSON.stringify(bankEntries.filter(e => e.bank && e.amount))
          : null,
        repledged_bank: form.is_repledged === 1 && bankEntries[0]?.bank ? bankEntries[0].bank : null,
        repledged_receipt_no: form.is_repledged === 1 && bankEntries[0]?.loan_no ? bankEntries[0].loan_no : null,
        repledged_amount: form.is_repledged === 1 && bankEntries[0]?.amount ? parseFloat(bankEntries[0].amount) : null,
        repledged_date: form.is_repledged === 1 && bankEntries[0]?.date ? bankEntries[0].date : null,
        repledged_name: form.is_repledged === 1 && bankEntries[0]?.name ? bankEntries[0].name : null,
      };

      const res = await createPledgeEntry(pledgeData);

      showNotification(`Pledge ${form.pledge_no} saved successfully!`, "success");
      setLoading(false);

      if (res.item) {
        onSuccess(res.item);
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      showNotification("Failed to save pledge", "error");
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-amber-100 shadow-sm overflow-hidden p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center border-b border-amber-100 pb-3 mb-5">
        <h3 className="font-bold text-lg font-serif text-amber-955">
          {isExisting ? "Add Existing Girvi (Past Pledges)" : "Pledge Form (Girvi Entry)"}
        </h3>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
          Pooja Jewellers Standard Layout
        </span>
      </div>

      <form onSubmit={handleSubmit} onKeyDown={handleEnterToNext} className="space-y-5">
        {/* Core details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Pledge No. (Required)</label>
            <input
              type="text"
              required
              value={form.pledge_no}
              onChange={(e) => setForm((prev) => ({ ...prev, pledge_no: e.target.value }))}
              onKeyDown={handleKeyDown}
              placeholder="e.g. A3248"
              className="w-full px-3.5 py-2.5 rounded-xl border border-amber-250 outline-none text-xs focus:border-amber-500 font-bold"
              style={{ background: "#FFFBF5" }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Pledge Date</label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              onKeyDown={handleKeyDown}
              className="w-full px-3.5 py-2.5 rounded-xl border border-amber-250 outline-none text-xs focus:border-amber-500 font-medium"
              style={{ background: "#FFFBF5" }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1">Due Date</label>
            <input
              type="date"
              required
              value={form.due_date}
              onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
              onKeyDown={handleKeyDown}
              className="w-full px-3.5 py-2.5 rounded-xl border border-amber-250 outline-none text-xs focus:border-amber-500 font-medium"
              style={{ background: "#FFFBF5" }}
            />
          </div>
        </div>

        {/* Pawner Details */}
        <div className="border border-amber-100 rounded-2xl p-5 bg-amber-50/10 space-y-4">
          <h4 className="text-xs font-bold text-amber-950 font-serif border-b border-amber-150 pb-1.5 uppercase tracking-wider">Pawner Information</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Name of Pawner (Required)</label>
              <input
                type="text"
                required
                value={form.customer_name}
                onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                onFocus={() => setActiveSuggestionField("customer_name")}
                onBlur={() => setActiveSuggestionField(null)}
                onKeyDown={(e) => handleKeyDownWithSuggestions(e, "customer_name", customerNameSuggestions, handleSelectCustomerName)}
                placeholder="e.g. Manjula"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs"
              />
              {activeSuggestionField === "customer_name" && customerNameSuggestions.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-amber-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {customerNameSuggestions.map((name, idx) => (
                    <li
                      key={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectCustomerName(name);
                      }}
                      className={`px-3.5 py-2 cursor-pointer text-xs border-b border-amber-50 last:border-0 font-medium ${idx === highlightedIndex ? "bg-amber-100 font-bold text-amber-955" : "text-amber-900 hover:bg-amber-50"
                        }`}
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex gap-3">
              <div className="w-28">
                <label className="block text-[10px] font-semibold text-amber-850 mb-1">Relation</label>
                <select
                  value={form.pawner_relation}
                  onChange={(e) => setForm((prev) => ({ ...prev, pawner_relation: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  className="w-full px-2 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold text-amber-900"
                >
                  <option value="W/O">W/O (Wife of)</option>
                  <option value="S/O">S/O (Son of)</option>
                  <option value="D/O">D/O (Daughter of)</option>
                </select>
              </div>
              <div className="flex-1 relative">
                <label className="block text-[10px] font-semibold text-amber-850 mb-1">Relation Name</label>
                <input
                  type="text"
                  value={form.pawner_relation_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, pawner_relation_name: e.target.value }))}
                  onFocus={() => setActiveSuggestionField("pawner_relation_name")}
                  onBlur={() => setActiveSuggestionField(null)}
                  onKeyDown={(e) => handleKeyDownWithSuggestions(e, "pawner_relation_name", relationNameSuggestions, (val) => {
                    setForm(prev => ({ ...prev, pawner_relation_name: val }));
                    setActiveSuggestionField(null);
                  })}
                  placeholder="e.g. Manjunath"
                  className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-medium"
                />
                {activeSuggestionField === "pawner_relation_name" && relationNameSuggestions.length > 0 && (
                  <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-amber-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {relationNameSuggestions.map((name, idx) => (
                      <li
                        key={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setForm((prev) => ({ ...prev, pawner_relation_name: name }));
                          setActiveSuggestionField(null);
                        }}
                        className={`px-3.5 py-2 cursor-pointer text-xs border-b border-amber-50 last:border-0 font-medium ${idx === highlightedIndex ? "bg-amber-100 font-bold text-amber-955" : "text-amber-900 hover:bg-amber-50"
                          }`}
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Mobile No.</label>
              <input
                type="text"
                value={form.mobile}
                onChange={(e) => handleMobileChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 9448969674"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Monthly Income</label>
              <input
                type="text"
                value={form.income}
                onChange={(e) => setForm((prev) => ({ ...prev, income: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 15000 Monthly"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-medium"
              />
            </div>
            <div className="relative">
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                onFocus={() => setActiveSuggestionField("address")}
                onBlur={() => setActiveSuggestionField(null)}
                onKeyDown={(e) => handleKeyDownWithSuggestions(e, "address", addressSuggestions, (val) => {
                  setForm(prev => ({ ...prev, address: val }));
                  setActiveSuggestionField(null);
                })}
                placeholder="e.g. Batrmarnhali, Budigere"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-medium"
              />
              {activeSuggestionField === "address" && addressSuggestions.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-amber-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {addressSuggestions.map((addr, idx) => (
                    <li
                      key={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setForm((prev) => ({ ...prev, address: addr }));
                        setActiveSuggestionField(null);
                      }}
                      className={`px-3.5 py-2 cursor-pointer text-xs border-b border-amber-50 last:border-0 font-medium ${idx === highlightedIndex ? "bg-amber-100 font-bold text-amber-955" : "text-amber-900 hover:bg-amber-50"
                        }`}
                    >
                      {addr}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="border-t border-amber-100/50 pt-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1.5">Pawner Photo (Customer)</label>
            <div className="flex items-center gap-4">
              {form.customer_photo ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-amber-250 bg-amber-50/50 flex-shrink-0 group">
                  <img src={form.customer_photo} alt="Customer Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, customer_photo: "" }))}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border border-dashed border-amber-200 bg-amber-50/10 flex items-center justify-center text-amber-600/40 text-xl flex-shrink-0 select-none">
                  👤
                </div>
              )}
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const compressed = await compressImage(file);
                          setForm(prev => ({ ...prev, customer_photo: compressed }));
                        } catch (err) {
                          showNotification("Failed to process image", "error");
                        }
                      }
                    }}
                    className="w-full text-xs text-amber-800 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-amber-200 file:text-xs file:font-bold file:bg-white file:text-amber-900 hover:file:bg-amber-50 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCameraTarget("customer");
                      startCamera("user");
                    }}
                    className="px-4 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl text-xs font-bold text-amber-950 flex items-center gap-1.5 whitespace-nowrap transition-all"
                  >
                    <Camera size={14} /> Capture Photo
                  </button>
                </div>
                <p className="text-[9px] text-amber-800/60 mt-1">Accepts PNG, JPG. Downscaled automatically.</p>
              </div>
            </div>
          </div>
        </div>
        {/* Article Details */}
        <div className="border border-amber-100 rounded-2xl p-5 bg-amber-50/10 space-y-4">
          <div className="flex justify-between items-center border-b border-amber-150 pb-1.5 mb-2">
            <h4 className="text-xs font-bold text-amber-950 font-serif uppercase tracking-wider">Article Details</h4>
            <div className="flex gap-1 bg-amber-100/50 p-0.5 rounded-lg border border-amber-900/10">
              {[1, 2, 3].map((num) => {
                const hasData = num === 1
                  ? form.ornament || form.gross_weight
                  : (form as any)[`ornament_${num}`] || (form as any)[`gross_weight_${num}`];
                const isActive = activeArticleTab === num;
                return (
                  <button
                    key={`article-tab-${num}`}
                    type="button"
                    onClick={() => setActiveArticleTab(num)}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all relative ${isActive
                        ? "bg-amber-950 text-white shadow-sm"
                        : "text-amber-800 hover:bg-amber-100"
                      }`}
                  >
                    Article {num}
                    {hasData && (
                      <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isActive ? "bg-amber-300" : "bg-amber-600"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Description of Articles</label>
              <input
                type="text"
                value={getArticleField("ornament")}
                onChange={(e) => setArticleField("ornament", e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Impure Gold F Vale"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Quantity (PCS)</label>
              <input
                type="number"
                value={getArticleField("quantity")}
                onChange={(e) => setArticleField("quantity", e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Gross Wt (gms)</label>
              <input
                type="number"
                step="0.001"
                value={getArticleField("gross_weight")}
                onChange={(e) => setArticleField("gross_weight", e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 0.900"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold font-mono text-center"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Less Wt (gms)</label>
              <input
                type="number"
                step="0.001"
                value={getArticleField("less_weight")}
                onChange={(e) => setArticleField("less_weight", e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 0.200"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold font-mono text-center"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Net Wt (gms)</label>
              <input
                type="text"
                readOnly
                value={getArticleField("net_weight")}
                className="w-full px-3.5 py-2 rounded-lg border border-amber-300 outline-none text-xs font-black font-mono bg-amber-50 text-amber-955 text-center"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Est. Value (₹)</label>
              <input
                type="number"
                value={getArticleField("estimated_value")}
                onChange={(e) => setArticleField("estimated_value", e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 5000"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold font-mono text-center"
              />
            </div>
          </div>

          <div className="border-t border-amber-100/50 pt-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-850 mb-1.5">Ornament Photo (Item)</label>
            <div className="flex items-center gap-4">
              {form.item_photo ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-amber-250 bg-amber-50/50 flex-shrink-0 group">
                  <img src={form.item_photo} alt="Item Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, item_photo: "" }))}
                    className="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl border border-dashed border-amber-200 bg-amber-50/10 flex items-center justify-center text-amber-600/40 text-xl flex-shrink-0 select-none">
                  💍
                </div>
              )}
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const compressed = await compressImage(file);
                          setForm(prev => ({ ...prev, item_photo: compressed }));
                        } catch (err) {
                          showNotification("Failed to process image", "error");
                        }
                      }
                    }}
                    className="w-full text-xs text-amber-800 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border file:border-amber-200 file:text-xs file:font-bold file:bg-white file:text-amber-900 hover:file:bg-amber-50 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCameraTarget("item");
                      startCamera("environment"); // default to environment/rear camera for ornaments!
                    }}
                    className="px-4 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl text-xs font-bold text-amber-955 flex items-center gap-1.5 whitespace-nowrap transition-all"
                  >
                    <Camera size={14} /> Capture Photo
                  </button>
                </div>
                <p className="text-[9px] text-amber-800/60 mt-1">Accepts PNG, JPG. Downscaled automatically.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Loan & Interest terms */}
        <div className="border border-amber-100 rounded-2xl p-5 bg-amber-50/10 space-y-4">
          <h4 className="text-xs font-bold text-amber-950 font-serif border-b border-amber-150 pb-1.5 uppercase tracking-wider">Loan &amp; Interest Terms</h4>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Loan Amount (₹, Required)</label>
              <input
                type="number"
                required
                value={form.amount}
                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 1000"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-black font-mono text-diary-crimson"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold text-amber-850 mb-1">Rupees in Words</label>
              <input
                type="text"
                value={form.rupees_in_words}
                onChange={(e) => setForm((prev) => ({ ...prev, rupees_in_words: e.target.value }))}
                onKeyDown={handleKeyDown}
                placeholder="e.g. One Thousand only"
                className="w-full px-3.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-medium"
              />
            </div>
          </div>


          {/* Upfront Interest (Banda) Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-amber-50/20 border border-dashed border-amber-200/50 rounded-xl p-3.5 mt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.interest_taken_upfront}
                onChange={(e) => setForm((prev) => ({ ...prev, interest_taken_upfront: e.target.checked }))}
                className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-amber-850">
                💰 Interest Taken Upfront (Banda)?
              </span>
            </label>

            {form.interest_taken_upfront && (
              <div className="flex-1 flex items-center gap-3 animate-fadeIn">
                <span className="text-xs text-amber-900/60">→</span>
                <div className="w-full max-w-[200px]">
                  <label className="block text-[9px] font-bold text-amber-800 uppercase tracking-wider mb-0.5">Interest Amount (₹)</label>
                  <input
                    type="number"
                    required={form.interest_taken_upfront}
                    value={form.interest_taken_amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, interest_taken_amount: e.target.value }))}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. 150"
                    className="w-full px-3 py-1.5 rounded-lg border border-amber-250 outline-none text-xs font-bold font-mono focus:border-amber-500 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Re-pledge/Bank details (Only for Existing Girvi) */}
        {isExisting && (
          <div className="border border-amber-200 rounded-2xl p-5 bg-amber-50/20 space-y-4">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <h4 className="text-xs font-bold text-amber-950 font-serif uppercase tracking-wider">
                🏦 Re-Pledge / Bank Deposit Details
              </h4>
              {form.is_repledged === 1 && (
                <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                  {bankEntries.length} {bankEntries.length === 1 ? "Bank" : "Banks"}
                </span>
              )}
            </div>

            {/* Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.is_repledged === 1}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, is_repledged: e.target.checked ? 1 : 0 }));
                  if (e.target.checked && bankEntries.length === 0)
                    setBankEntries([{ name: "", bank: "", date: "", amount: "", linked_girvies: "" }]);
                }}
                className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <span className="text-xs font-bold text-amber-850">
                Item(s) currently kept / pledged at a Bank or Finance Company?
              </span>
            </label>

            {form.is_repledged === 1 && (
              <div className="space-y-3 animate-fadeIn">
                {bankEntries.map((entry, i) => {
                  const KNOWN_BANKS = ["Kosamattam Finance", "Muthoot Money", "Bank of Baroda", "SBI"];
                  const isCustomBank = entry.bank !== "" && !KNOWN_BANKS.includes(entry.bank);
                  return (
                    <div
                      key={i}
                      className="relative rounded-xl border border-amber-200 bg-white p-4 space-y-3"
                      style={{ boxShadow: "0 1px 4px rgba(212,175,55,0.08)" }}
                    >
                      {/* Row header */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                          Bank Entry #{i + 1}
                        </span>
                        {bankEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBankEntry(i)}
                            className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>

                      {/* 4 fields: Name | Bank | Date | Amount */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Pledger Name */}
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-850 mb-1">
                            Pledger Name at Bank
                          </label>
                          <input
                            type="text"
                            value={entry.name}
                            onChange={(e) => updateBankEntry(i, "name", e.target.value)}
                            placeholder="e.g. Vikram Chand"
                            className="w-full px-3 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold focus:border-amber-500"
                          />
                        </div>

                        {/* Bank Select */}
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-850 mb-1">
                            Bank / Finance Company
                          </label>
                          <select
                            value={isCustomBank ? "Other" : entry.bank}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateBankEntry(i, "bank", val === "Other" ? "" : val);
                            }}
                            className="w-full px-2.5 py-2 rounded-lg border border-amber-250 outline-none text-xs font-black text-amber-950 focus:border-amber-500"
                          >
                            <option value="">-- Select --</option>
                            <option value="Kosamattam Finance">Kosamattam Finance</option>
                            <option value="Muthoot Money">Muthoot Money</option>
                            <option value="Bank of Baroda">Bank of Baroda</option>
                            <option value="SBI">SBI (State Bank of India)</option>
                            <option value="Other">Other (Write Name)</option>
                          </select>
                          {isCustomBank && (
                            <input
                              type="text"
                              placeholder="Enter bank / company name"
                              value={entry.bank}
                              onChange={(e) => updateBankEntry(i, "bank", e.target.value)}
                              className="w-full mt-2 px-3 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold focus:border-amber-500"
                            />
                          )}
                        </div>

                        {/* Bank Loan No */}
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-850 mb-1">
                            Bank Loan No. / Receipt No.
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 15252 or LN-8840"
                            value={entry.loan_no || ""}
                            onChange={(e) => updateBankEntry(i, "loan_no", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-amber-250 outline-none text-xs font-mono font-bold focus:border-amber-500"
                          />
                        </div>

                        {/* Re-pledge Date */}
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-850 mb-1">
                            Re-Pledge Date
                          </label>
                          <input
                            type="date"
                            value={entry.date}
                            onChange={(e) => updateBankEntry(i, "date", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold focus:border-amber-500"
                          />
                        </div>

                        {/* Loan Amount */}
                        <div>
                          <label className="block text-[10px] font-semibold text-amber-850 mb-1">
                            Loan Amount (₹)
                          </label>
                          <input
                            type="number"
                            value={entry.amount}
                            onChange={(e) => updateBankEntry(i, "amount", e.target.value)}
                            placeholder="e.g. 8500"
                            className="w-full px-3 py-2 rounded-lg border border-amber-250 outline-none text-xs font-black font-mono text-amber-900 focus:border-amber-500"
                          />
                        </div>

                        {/* Linked Girvi Nos — full width */}
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] font-semibold text-amber-850 mb-1">
                            Other Girvi Nos. bundled in this Bank Loan
                            <span className="ml-1 font-normal text-amber-600">(comma separated, e.g. 1120, 1130)</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={entry.linked_girvies}
                              onChange={(e) => updateBankEntry(i, "linked_girvies", e.target.value)}
                              placeholder="e.g. 1120, 1130, 1145"
                              className="w-full px-3 py-2 rounded-lg border border-amber-250 outline-none text-xs font-bold focus:border-amber-500 pr-8"
                            />
                            {entry.linked_girvies && (
                              <div className="absolute right-0 top-0 h-full flex items-center px-2 pointer-events-none">
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                  {entry.linked_girvies.split(",").filter(s => s.trim()).length} items
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Tag preview */}
                          {entry.linked_girvies && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {entry.linked_girvies.split(",").filter(s => s.trim()).map((no, ni) => (
                                <span
                                  key={ni}
                                  className="px-2 py-0.5 rounded-full bg-amber-900 text-white text-[9px] font-bold"
                                >
                                  #{no.trim()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add Another Bank button */}
                <button
                  type="button"
                  onClick={addBankEntry}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-amber-300 text-xs font-bold text-amber-700 hover:bg-amber-50 hover:border-amber-400 transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-base leading-none">+</span>
                  Add Another Bank / Finance Company
                </button>

                {/* Total summary if more than 1 entry */}
                {bankEntries.length > 1 && (
                  <div className="flex justify-end items-center gap-2 pt-1 border-t border-amber-100">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Total Bank Loans:</span>
                    <span className="text-sm font-black text-amber-950 font-mono">
                      ₹{bankEntries.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-4 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all shadow-md flex items-center justify-center gap-2"
            style={{
              background: loading ? "#F0E8D8" : "linear-gradient(135deg,#c8960c,#D4AF37)",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Saving Pledge...
              </>
            ) : (
              <>
                <Save size={14} /> ✓ Save Pledge &amp; Generate Print Slip
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── CAMERA CAPTURE MODAL ── */}
      {cameraTarget && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center px-4"
          style={{ background: "rgba(45,27,14,0.75)", backdropFilter: "blur(5px)" }}
        >
          <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl relative border border-amber-200">
            <div className="flex justify-between items-center mb-4 border-b border-amber-100 pb-2.5">
              <h4 className="font-bold text-sm font-serif text-amber-950 flex items-center gap-1.5">
                📷 Capture {cameraTarget === "customer" ? "Pawner" : "Ornament"} Photo
              </h4>
              <button
                type="button"
                onClick={stopCamera}
                className="p-1 rounded-full hover:bg-amber-50 text-amber-900 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative aspect-video rounded-2xl overflow-hidden border border-amber-250 bg-black flex items-center justify-center">
              {cameraLoading && (
                <div className="absolute inset-0 bg-amber-950/20 backdrop-blur-xs flex flex-col items-center justify-center text-amber-950 font-serif text-xs z-10">
                  <RefreshCw className="animate-spin mb-2" size={24} />
                  Connecting camera stream...
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={toggleFacingMode}
                className="flex-1 py-3 rounded-xl border border-amber-250 font-bold text-xs bg-white text-amber-950 hover:bg-amber-50 transition-all flex items-center justify-center gap-1.5"
              >
                🔄 Flip Camera
              </button>
              <button
                type="button"
                onClick={handleCapture}
                className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider text-white transition-all shadow-md flex items-center justify-center gap-1.5"
                style={{
                  background: "linear-gradient(135deg,#c8960c,#D4AF37)",
                }}
              >
                ✓ Take Photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
