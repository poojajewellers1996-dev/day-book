import { openWhatsApp } from "./whatsapp";
import { sendBackendWhatsAppPdfInvoice } from "./api";

export const exportToPDF = async (elementId: string, dateStr: string) => {
  if (typeof window === "undefined") return;

  const originalTitle = document.title;
  document.title = `Marwadi_DayBook_${dateStr}`;
  window.print();
  document.title = originalTitle;
};

export interface InvoicePDFData {
  invoiceNo: string;
  bookNo?: string;
  date: string;
  customerName: string;
  mobile?: string;
  address?: string;
  items: Array<{ name: string; weight?: number; qty?: number; amount: number }>;
  totalAmount: number;
  totalWeight?: number;
  totalQty?: number;
}

export const generateAndDownloadInvoicePDF = async (billData: InvoicePDFData) => {
  if (typeof window === "undefined") return;

  const invNo = billData.invoiceNo || "Invoice";
  const filename = `Pooja_Jewellers_Invoice_${invNo.replace(/[/\\?%*:|"<>]/g, "_")}.pdf`;

  try {
    const res = await sendBackendWhatsAppPdfInvoice({
      invoice_no: billData.invoiceNo,
      book_no: billData.bookNo || "",
      date: billData.date,
      customer_name: billData.customerName,
      phone: billData.mobile || "",
      address: billData.address || "",
      items: billData.items,
      total_amount: billData.totalAmount,
    });

    if (res?.download_url) {
      const link = document.createElement("a");
      const baseUrl = typeof window !== "undefined" ? window.location.origin.replace(":3000", ":8000") : "http://localhost:8000";
      link.href = `${baseUrl}${res.download_url}`;
      link.download = res.file_name || filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
  } catch (e) {
    console.error("Backend PDF fetch error:", e);
  }
};


export const copyInvoiceToClipboardAndOpenWhatsApp = async (billData: InvoicePDFData, phone: string, textMessage: string) => {
  if (typeof window === "undefined") return;

  generateAndDownloadInvoicePDF(billData);

  try {
    const html2pdfModule = await import("html2pdf.js");
    const html2pdf = html2pdfModule.default || html2pdfModule;

    const invNo = billData.invoiceNo || "INV-0001";
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "0px";
    container.style.top = "0px";
    container.style.width = "650px";
    container.style.zIndex = "-9999";
    container.style.opacity = "1";
    container.style.pointerEvents = "none";
    container.style.background = "#ffffff";


    container.innerHTML = `
      <div style="border: 2px solid #b45309; padding: 24px; border-radius: 12px; background: #fffdfa; font-family: Arial, sans-serif; color: #2d1b0e;">
        <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 16px;">
          <h1 style="margin: 0; color: #78350f; font-size: 22px; font-weight: bold; letter-spacing: 1px;">POOJA JEWELLERS</h1>
          <p style="margin: 3px 0 0 0; font-size: 12px; color: #92400e; font-weight: bold;">Certified Gold & Silver Jewellery</p>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #b45309;">Budigere | 📞 Contact: 9164180406 / 9448587754</p>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; background: #fffbe6; padding: 12px; border-radius: 8px; border: 1px solid #fef3c7;">
          <div>
            <p style="margin: 2px 0;"><strong>Customer Name:</strong> ${billData.customerName || "Valued Customer"}</p>
            <p style="margin: 2px 0;"><strong>Mobile:</strong> ${billData.mobile || "—"}</p>
            ${billData.address ? `<p style="margin: 2px 0;"><strong>Address:</strong> ${billData.address}</p>` : ""}
          </div>
          <div style="text-align: right;">
            <p style="margin: 2px 0;"><strong>Invoice No:</strong> ${invNo}</p>
            ${billData.bookNo ? `<p style="margin: 2px 0;"><strong>Book No:</strong> ${billData.bookNo}</p>` : ""}
            <p style="margin: 2px 0;"><strong>Date:</strong> ${billData.date}</p>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px;">
          <thead>
            <tr style="background: #78350f; color: white;">
              <th style="padding: 8px; border: 1px solid #78350f; text-align: center; width: 35px;">#</th>
              <th style="padding: 8px; border: 1px solid #78350f; text-align: left;">Item Particulars</th>
              <th style="padding: 8px; border: 1px solid #78350f; text-align: center; width: 50px;">Qty</th>
              <th style="padding: 8px; border: 1px solid #78350f; text-align: right; width: 80px;">Weight</th>
              <th style="padding: 8px; border: 1px solid #78350f; text-align: right; width: 100px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${billData.items.map((it, idx) => `
              <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fffcf5'};">
                <td style="padding: 8px; border: 1px solid #fcd34d; text-align: center;">${idx + 1}</td>
                <td style="padding: 8px; border: 1px solid #fcd34d; font-weight: bold;">${it.name}</td>
                <td style="padding: 8px; border: 1px solid #fcd34d; text-align: center;">${it.qty || 1} pc</td>
                <td style="padding: 8px; border: 1px solid #fcd34d; text-align: right; font-family: monospace;">${(it.weight || 0).toFixed(2)} g</td>
                <td style="padding: 8px; border: 1px solid #fcd34d; text-align: right; font-weight: bold; font-family: monospace;">₹${(it.amount || 0).toLocaleString("en-IN")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: center; background: #ecfdf5; padding: 12px 16px; border-radius: 8px; border: 1px solid #a7f3d0; margin-bottom: 16px;">
          <span style="font-weight: bold; color: #065f46; font-size: 12px;">PAYMENT STATUS: VERIFIED PAID ✅</span>
          <span style="font-weight: 900; color: #064e3b; font-size: 15px;">NET TOTAL: ₹${(billData.totalAmount || 0).toLocaleString("en-IN")}</span>
        </div>

        <div style="text-align: center; font-size: 10px; color: #92400e; border-top: 1px dashed #fcd34d; padding-top: 10px;">
          <p style="margin: 0;">Thank you for shopping at Pooja Jewellers! Visit again for certified Hallmark Gold & Silver.</p>
        </div>
      </div>
    `;

    const h2p = (html2pdfModule as any).default || html2pdfModule;
    const canvas = await (h2p() as any).set({ margin: 8, image: { type: "png" as const, quality: 1.0 } }).from(container).toCanvas().get("canvas");

    if (container.parentNode) document.body.removeChild(container);


    if (canvas && navigator.clipboard && window.ClipboardItem) {
      canvas.toBlob(async (blob: Blob | null) => {
        if (blob) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          } catch (clipErr) {
            console.error("Clipboard write error:", clipErr);
          }
        }
      }, "image/png");
    }
  } catch (e) {
    console.log("Clipboard image copy info:", e);
  }

  openWhatsApp(phone, textMessage);
};


export const shareOrDownloadPDF = async (billData: InvoicePDFData, phone: string, textMessage: string) => {
  if (typeof window === "undefined") return;

  const html2pdfModule = await import("html2pdf.js");
  const html2pdf = html2pdfModule.default || html2pdfModule;

  const invNo = billData.invoiceNo || "INV-0001";
  const filename = `Pooja_Jewellers_Invoice_${invNo.replace(/[/\\?%*:|"<>]/g, "_")}.pdf`;

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "0px";
  container.style.top = "0px";
  container.style.width = "650px";
  container.style.zIndex = "-9999";
  container.style.opacity = "1";
  container.style.pointerEvents = "none";
  container.style.background = "#ffffff";


  container.innerHTML = `
    <div style="border: 2px solid #b45309; padding: 24px; border-radius: 12px; background: #fffdfa; font-family: Arial, sans-serif; color: #2d1b0e;">
      <div style="text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 16px;">
        <h1 style="margin: 0; color: #78350f; font-size: 22px; font-weight: bold; letter-spacing: 1px;">POOJA JEWELLERS</h1>
        <p style="margin: 3px 0 0 0; font-size: 12px; color: #92400e; font-weight: bold;">Certified Gold & Silver Jewellery</p>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #b45309;">Budigere | 📞 Contact: 9164180406 / 9448587754</p>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 16px; background: #fffbe6; padding: 12px; border-radius: 8px; border: 1px solid #fef3c7;">
        <div>
          <p style="margin: 2px 0;"><strong>Customer Name:</strong> ${billData.customerName || "Valued Customer"}</p>
          <p style="margin: 2px 0;"><strong>Mobile:</strong> ${billData.mobile || "—"}</p>
          ${billData.address ? `<p style="margin: 2px 0;"><strong>Address:</strong> ${billData.address}</p>` : ""}
        </div>
        <div style="text-align: right;">
          <p style="margin: 2px 0;"><strong>Invoice No:</strong> ${invNo}</p>
          ${billData.bookNo ? `<p style="margin: 2px 0;"><strong>Book No:</strong> ${billData.bookNo}</p>` : ""}
          <p style="margin: 2px 0;"><strong>Date:</strong> ${billData.date}</p>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px;">
        <thead>
          <tr style="background: #78350f; color: white;">
            <th style="padding: 8px; border: 1px solid #78350f; text-align: center; width: 35px;">#</th>
            <th style="padding: 8px; border: 1px solid #78350f; text-align: left;">Item Particulars</th>
            <th style="padding: 8px; border: 1px solid #78350f; text-align: center; width: 50px;">Qty</th>
            <th style="padding: 8px; border: 1px solid #78350f; text-align: right; width: 80px;">Weight</th>
            <th style="padding: 8px; border: 1px solid #78350f; text-align: right; width: 100px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${billData.items.map((it, idx) => `
            <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fffcf5'};">
              <td style="padding: 8px; border: 1px solid #fcd34d; text-align: center;">${idx + 1}</td>
              <td style="padding: 8px; border: 1px solid #fcd34d; font-weight: bold;">${it.name}</td>
              <td style="padding: 8px; border: 1px solid #fcd34d; text-align: center;">${it.qty || 1} pc</td>
              <td style="padding: 8px; border: 1px solid #fcd34d; text-align: right; font-family: monospace;">${(it.weight || 0).toFixed(2)} g</td>
              <td style="padding: 8px; border: 1px solid #fcd34d; text-align: right; font-weight: bold; font-family: monospace;">₹${(it.amount || 0).toLocaleString("en-IN")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div style="display: flex; justify-content: space-between; align-items: center; background: #ecfdf5; padding: 12px 16px; border-radius: 8px; border: 1px solid #a7f3d0; margin-bottom: 16px;">
        <span style="font-weight: bold; color: #065f46; font-size: 12px;">PAYMENT STATUS: VERIFIED PAID ✅</span>
        <span style="font-weight: 900; color: #064e3b; font-size: 15px;">NET TOTAL: ₹${(billData.totalAmount || 0).toLocaleString("en-IN")}</span>
      </div>

      <div style="text-align: center; font-size: 10px; color: #92400e; border-top: 1px dashed #fcd34d; padding-top: 10px;">
        <p style="margin: 0;">Thank you for shopping at Pooja Jewellers! Visit again for certified Hallmark Gold & Silver.</p>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const opt = {
    margin: 8,
    filename: filename,
    image: { type: "jpeg" as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" as const }
  };

  try {
    const imgBlob = await html2pdf().set({ margin: 8, image: { type: "png" as const, quality: 1.0 } }).from(container).outputImg("blob");
    if (container.parentNode) document.body.removeChild(container);

    const imageFileName = `Pooja_Jewellers_Invoice_${invNo.replace(/[/\\?%*:|"<>]/g, "_")}.png`;
    const imageFile = new File([imgBlob], imageFileName, { type: "image/png" });

    // Also download the PDF file to Downloads folder
    generateAndDownloadInvoicePDF(billData);

    if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      await navigator.share({
        files: [imageFile],
        title: `Pooja Jewellers Invoice ${invNo}`,
      });
      return true;
    }
  } catch (e) {
    console.log("Web share fallback:", e);
    if (container.parentNode) document.body.removeChild(container);
  }


  generateAndDownloadInvoicePDF(billData);
  openWhatsApp(phone, textMessage);
  return false;
};
