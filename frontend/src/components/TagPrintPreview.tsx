"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Printer, X } from "lucide-react";
import QRCode from "qrcode";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface TagItem {
  barcodeNo: string;
  ornamentName: string;
  metal: "GOLD" | "SILVER";
  purity: string;
  qty: number;
  weight: number;
  netWeight: number;
  making?: string;
  remark: string; // size/remark
  huidNo?: string;
}

// ─── Code 128B Barcode Encoder ────────────────────────────────────────────────

const CODE128_PATTERNS: Record<number, string> = {
  0: "11011001100", 1: "11001101100", 2: "11001100110", 3: "10010011000",
  4: "10010001100", 5: "10001001100", 6: "10011001000", 7: "10011000100",
  8: "10001100100", 9: "11001001000", 10: "11001000100", 11: "11000100100",
  12: "10110011100", 13: "10011011100", 14: "10011001110", 15: "10111001100",
  16: "10011101100", 17: "10011100110", 18: "11001110010", 19: "11001011100",
  20: "11001001110", 21: "11011100100", 22: "11001110100", 23: "11101101110",
  24: "11101001100", 25: "11100101100", 26: "11100100110", 27: "11101100100",
  28: "11100110100", 29: "11100110010", 30: "11011011000", 31: "11011000110",
  32: "11000110110", 33: "10100011000", 34: "10001011000", 35: "10001000110",
  36: "10110001000", 37: "10001101000", 38: "10001100010", 39: "11010001000",
  40: "11000101000", 41: "11000100010", 42: "10110111000", 43: "10110001110",
  44: "10001101110", 45: "10111011000", 46: "10111000110", 47: "10001110110",
  48: "11101110110", 49: "11010001110", 50: "11000101110", 51: "11011101000",
  52: "11011100010", 53: "11011101110", 54: "11101011000", 55: "11101000110",
  56: "11100010110", 57: "11101101000", 58: "11101100010", 59: "11100011010",
  60: "11101111010", 61: "11001000010", 62: "11110001010", 63: "1010110000",
  64: "10100001100", 65: "10010110000", 66: "10010000110", 67: "10000101100",
  68: "10000100110", 69: "10110010000", 70: "10110000100", 71: "10011010000",
  72: "10011000010", 73: "10000110100", 74: "10000110010", 75: "11000010010",
  76: "11001010000", 77: "11110111010", 78: "11000010100", 79: "10001111010",
  80: "10100111100", 81: "10010111100", 82: "10010011110", 83: "10111100100",
  84: "10011110100", 85: "10011110010", 86: "11110100100", 87: "11110010100",
  88: "11110010010", 89: "11011011110", 90: "11011110110", 91: "11110110110",
  92: "10101111000", 93: "10100011110", 94: "10001011110", 95: "10111101000",
  96: "10111100010", 97: "11110101000", 98: "11110100010", 99: "10111011110",
  100: "10111101110", 101: "11101011110", 102: "11110101110",
  103: "11010000100", // START A
  104: "11010010000", // START B
  105: "11010011100", // START C
  106: "11000111010", // STOP
};

function code128BEncode(text: string): string {
  const chars = text.split("").map((c) => c.charCodeAt(0));
  const values: number[] = [];
  for (const c of chars) {
    if (c < 32 || c > 127) continue;
    values.push(c - 32);
  }
  let checksum = 104;
  values.forEach((v, i) => {
    checksum += v * (i + 1);
  });
  checksum = checksum % 103;

  let bits = CODE128_PATTERNS[104];
  for (const v of values) {
    bits += CODE128_PATTERNS[v] || "";
  }
  bits += CODE128_PATTERNS[checksum];
  bits += CODE128_PATTERNS[106];
  bits += "11";

  return bits;
}

export function renderBarcodeSVG(barcodeText: string): string {
  const bits = code128BEncode(barcodeText);
  const totalBits = bits.length;
  const height = 40;

  let rects = "";
  let currentBarWidth = 0;
  let startX = 0;

  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === "1") {
      if (currentBarWidth === 0) {
        startX = i;
      }
      currentBarWidth++;
    } else {
      if (currentBarWidth > 0) {
        rects += `<rect x="${startX}" y="0" width="${currentBarWidth}" height="${height}"/>`;
        currentBarWidth = 0;
      }
    }
  }
  if (currentBarWidth > 0) {
    rects += `<rect x="${startX}" y="0" width="${currentBarWidth}" height="${height}"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalBits} ${height}" width="100%" height="100%" preserveAspectRatio="none" shape-rendering="crispEdges">
    <rect width="${totalBits}" height="${height}" fill="#fff"/>
    <g fill="#000">${rects}</g>
  </svg>`;
}

// ─── Single Tag Component ────────────────────────────────────────────────────

export function JewelleryTag({
  item,
  qrUrl,
  barcodeUrl,
}: {
  item: TagItem;
  qrUrl?: string;
  barcodeUrl?: string;
}) {
  const isGold = item.metal === "GOLD";
  const tagStyle: React.CSSProperties = {
    width: "81mm",
    height: "12mm",
    background: "white",
    display: "flex",
    flexDirection: "row",
    overflow: "hidden",
    pageBreakInside: "avoid",
    breakInside: "avoid",
    boxSizing: "border-box",
    fontFamily: "Times New Roman, serif",
  };

  const leftStyle: React.CSSProperties = {
    width: "30mm", // Spans physical left sticker (15mm) and neck spacer (15mm)
    height: "12mm",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "flex-start", // Align items left to control positioning on physical left sticker
    paddingTop: "0.4mm",
    paddingBottom: "0.2mm",
    paddingLeft: "0px",
    paddingRight: "0px",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  const neckStyle: React.CSSProperties = {
    width: "0mm", // Set to 0 because the neck spacer is covered by the left 30mm container
    height: "12mm",
    flexShrink: 0,
    boxSizing: "border-box",
  };

  const rightStyle: React.CSSProperties = {
    width: "30mm", // Set to 15mm to match the physical right sticker
    height: "12mm",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingTop: "0.4mm",
    paddingBottom: "0.2mm",
    paddingLeft: "1mm",
    paddingRight: "0.5mm",
    overflow: "hidden",
    boxSizing: "border-box",
  };

  return (
    <div className="jewellery-tag" style={tagStyle}>
      {/* LEFT COLUMN: Barcode/QR (30mm container, spans 0 to 30mm) */}
      <div style={leftStyle}>
        {/* Row 1: Company Name (Centered on the 15mm physical left sticker) */}
        <div style={{
          fontSize: "6pt",
          fontFamily: "time-new-roman",
          fontWeight: "bold",
          color: "#000",
          textAlign: "center",
          width: "25mm",
          marginBottom: "0.3mm",
          lineHeight: 1.0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flexShrink: 0,
        }}>
          Pooja Jewellers
        </div>

        {/* Row 2: Barcode / QR Image and text */}
        <div style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "flex-start",
          width: "26mm",
          gap: "3mm",
          flexShrink: 0,
        }}>
          {isGold ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.2mm", width: "30mm" }}>
              {barcodeUrl ? (
                <img
                  src={barcodeUrl}
                  alt={item.barcodeNo}
                  style={{
                    width: "30mm", // Barcode stretches full 30mm width
                    height: "5.5mm",
                    objectFit: "fill",
                    imageRendering: "crisp-edges",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{ fontSize: "4pt", color: "#aaa" }}>Barcode…</div>
              )}
              {/* Barcode number text centered on physical left sticker */}
              <div style={{
                fontSize: "6pt",
                fontWeight: "bold",
                fontFamily: "time-new-roman",
                color: "#000",
                marginTop: "0.2mm",
                textAlign: "center",
                width: "25mm",
                lineHeight: 1.0,
                flexShrink: 0,
              }}>
                {item.barcodeNo}
              </div>
            </div>
          ) : (
            <>
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={item.barcodeNo}
                  style={{
                    width: "8.5mm",
                    height: "8.5mm",
                    imageRendering: "crisp-edges",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{ fontSize: "4pt", color: "#aaa" }}>QR…</div>
              )}
              <div style={{
                fontSize: "7.5pt",
                fontWeight: "bold",
                fontFamily: "times-new-roman",
                color: "#000",
                lineHeight: 1.0,
                flexShrink: 0,
              }}>
                {item.barcodeNo}
              </div>
            </>
          )}
        </div>
      </div>

      {/* MIDDLE COLUMN: Spacer neck (0mm, since neck is handled by left container width) */}
      <div style={neckStyle} />

      {/* RIGHT COLUMN: Details (15mm physical sticker) */}
      <div style={rightStyle}>
        <div style={{
          fontSize: "6.5pt",
          fontFamily: "times-new-roman",
          fontWeight: "bold",
          color: "#000",
          marginBottom: "0.4mm",
          width: "100%",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          lineHeight: 1.0,
        }}>
          {item.ornamentName}
          {!isGold && item.remark ? ` ${item.remark}` : ""}
        </div>

        <div style={{ fontSize: "6pt", color: "#000", marginBottom: "0.3mm", lineHeight: 1.0 }}>
          Wt.:<span style={{ fontFamily: "times-new-roman", fontWeight: "bold" }}>{item.weight.toFixed(3)}</span>
        </div>

        <div style={{ fontSize: "6pt", color: "#000", marginBottom: "0.3mm", lineHeight: 1.0 }}>
          Size:<span style={{ fontFamily: "times-new-roman", fontWeight: "bold" }}>{item.remark || ""}</span>
        </div>

        <div style={{ fontSize: "6pt", color: "#000", lineHeight: 1.0 }}>
          N.Wt:<span style={{ fontFamily: "times-new-roman", fontWeight: "bold" }}>{item.netWeight.toFixed(3)} / Purity: {item.purity}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Component ─────────────────────────────────────────────────────────

interface TagPrintPreviewProps {
  items: TagItem[];
  onClose: () => void;
}

export default function TagPrintPreview({ items, onClose }: TagPrintPreviewProps) {
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [barcodeSvgs, setBarcodeSvgs] = useState<Record<string, string>>({});
  const [printReady, setPrintReady] = useState(false);
  const [printCols, setPrintCols] = useState<1 | 2>(1); // Default to 1-column single tag roll
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateAll = async () => {
      const qrs: Record<string, string> = {};
      const barcodes: Record<string, string> = {};

      for (const item of items) {
        if (item.metal === "SILVER") {
          try {
            const url = await QRCode.toDataURL(item.barcodeNo, {
              width: 140,
              margin: 1,
              color: { dark: "#000", light: "#fff" },
            });
            qrs[item.barcodeNo] = url;
          } catch (e) {
            console.warn("QR gen failed:", e);
          }
        } else {
          try {
            const svg = renderBarcodeSVG(item.barcodeNo);
            const svgUrl = "data:image/svg+xml;base64," + btoa(svg);
            barcodes[item.barcodeNo] = svgUrl;
          } catch (e) {
            console.warn("Barcode gen failed:", e);
          }
        }
      }

      setQrDataUrls(qrs);
      setBarcodeSvgs(barcodes);
      setPrintReady(true);
    };

    generateAll();
  }, [items]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const itemPairs: TagItem[][] = [];
  if (printCols === 2) {
    for (let i = 0; i < items.length; i += 2) {
      itemPairs.push(items.slice(i, i + 2));
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div
      id="print-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-start",
        overflowY: "auto",
        padding: "20px",
      }}
    >
      {/* Header controls – hidden when printing */}
      <div
        className="no-print"
        style={{
          background: "white",
          borderRadius: 16,
          padding: "16px 24px",
          marginBottom: 20,
          display: "flex",
          gap: 12,
          alignItems: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          width: "100%",
          maxWidth: 860,
        }}
      >
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#2d3748" }}>
            🖨️ Tag Print Preview — {items.length} tags
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9E8B78" }}>
            TSC TTP-244 Pro · 81mm x 30mm Tag
          </p>
        </div>

        {/* Column layout toggle */}
        <div style={{ display: "flex", gap: 6, background: "#f5f0e8", borderRadius: 10, padding: 3 }}>
          {([1, 2] as const).map((cols) => (
            <button
              key={cols}
              type="button"
              onClick={() => setPrintCols(cols)}
              style={{
                padding: "6px 12px",
                borderRadius: 7,
                border: "none",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 11,
                background: printCols === cols ? "white" : "transparent",
                color: printCols === cols ? "#7c3aed" : "#9e8b78",
                boxShadow: printCols === cols ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                transition: "all 0.2s",
              }}
            >
              {cols === 1 ? "📄 1 Column (81mm)" : "📄📄 2 Columns (162mm)"}
            </button>
          ))}
        </div>

        {!printReady && (
          <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>
            Generating codes…
          </span>
        )}
        <button
          onClick={handlePrint}
          disabled={!printReady}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: "none",
            cursor: printReady ? "pointer" : "not-allowed",
            background: printReady
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "#ccc",
            color: "white",
            fontWeight: 700,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Printer size={16} /> Print All Tags
        </button>
        <button
          onClick={onClose}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1.5px solid #e8e0d4",
            cursor: "pointer",
            background: "white",
            color: "#7A6550",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <X size={15} /> Close
        </button>
      </div>

      {/* Tag container – this is what prints */}
      <div
        ref={printAreaRef}
        id="tag-print-area"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4mm",
          background: "#f0ebe3",
          padding: "4mm",
          borderRadius: 8,
          width: "fit-content",
        }}
      >
        {printCols === 1 ? (
          items.map((item) => (
            <div key={item.barcodeNo} className="tag-print-wrapper">
              <JewelleryTag
                item={item}
                qrUrl={qrDataUrls[item.barcodeNo]}
                barcodeUrl={barcodeSvgs[item.barcodeNo]}
              />
            </div>
          ))
        ) : (
          itemPairs.map((pair, idx) => (
            <div key={idx} className="tag-print-wrapper" style={{ display: "flex", gap: "4mm" }}>
              <JewelleryTag
                item={pair[0]}
                qrUrl={qrDataUrls[pair[0].barcodeNo]}
                barcodeUrl={barcodeSvgs[pair[0].barcodeNo]}
              />
              {pair[1] ? (
                <JewelleryTag
                  item={pair[1]}
                  qrUrl={qrDataUrls[pair[1].barcodeNo]}
                  barcodeUrl={barcodeSvgs[pair[1].barcodeNo]}
                />
              ) : (
                <div style={{ width: "81mm", height: "12mm" }} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Print CSS injected globally */}
      <style>{`
        @media print {
          /* Hide all other direct children of body during print */
          body > :not(#print-modal-backdrop) {
            display: none !important;
          }

          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            display: block !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Print Modal Styles - static flow */
          #print-modal-backdrop {
            display: block !important;
            visibility: visible !important;
            position: static !important;
            inset: auto !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            z-index: 999999 !important;
          }

          .no-print, .no-print * {
            display: none !important;
            height: 0 !important;
            overflow: hidden !important;
          }

          #tag-print-area {
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            border-radius: 0 !important;
            width: ${printCols === 1 ? "81mm" : "162mm"} !important;
          }

          .tag-print-wrapper {
            display: flex !important;
            flex-direction: row !important;
            width: ${printCols === 1 ? "81mm" : "162mm"} !important;
            height: 11.5mm !important;
            max-height: 11.5mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            gap: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .tag-print-wrapper:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          .jewellery-tag {
            height: 11.5mm !important;
            max-height: 11.5mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            border: none !important;
          }

          @page {
            size: ${printCols === 1 ? "81mm 12mm" : "162mm 12mm"};
            margin: 0;
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
