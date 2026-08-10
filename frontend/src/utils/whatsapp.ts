/**
 * WhatsApp Utility Module for Pooja Jewellers
 * Deep-links via https://wa.me/ or https://web.whatsapp.com/
 */

/**
 * Clean & sanitize phone number to 10 digits with 91 India country code prefix
 */
export function sanitizePhoneNumber(phone: string | undefined): string {
  if (!phone) return "";
  // Remove spaces, dashes, brackets, non-digits
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return cleaned;
  }

  if (cleaned.length > 10) {
    return cleaned.slice(-10);
  }
  return cleaned;
}

/**
 * Open WhatsApp URL in new tab / app
 */
export function openWhatsApp(phone: string, text: string) {
  const cleanPhone = sanitizePhoneNumber(phone);
  const encodedText = encodeURIComponent(text);

  if (cleanPhone) {
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    window.open(url, "_blank");
  } else {
    // If no phone number provided, open WhatsApp with text template
    const url = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(url, "_blank");
  }
}

/**
 * Template 1: Girvi Interest Due Reminder Message
 */
export function formatGirviReminderMsg(params: {
  customerName: string;
  pledgeNo?: string;
  ornament?: string;
  principalAmount: number;
  interestDue?: number;
  dueDate?: string;
  pawnerRelation?: string;
  relationName?: string;
}): string {
  const name = params.customerName || "Valued Customer";
  const pNo = params.pledgeNo ? ` [Pledge No: ${params.pledgeNo}]` : "";
  const item = params.ornament ? ` (${params.ornament})` : "";
  const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(params.principalAmount || 0);

  let msg = `Hello ${name} 🙏,\n\n`;
  msg += `This is a friendly reminder from *POOJA JEWELLERS* regarding your Girvi Pledge${pNo}${item}.\n\n`;
  msg += `• *Pledge Amount:* ${amount}\n`;
  if (params.interestDue !== undefined && params.interestDue > 0) {
    const intStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(params.interestDue);
    msg += `• *Interest Due:* ${intStr}\n`;
  }
  if (params.dueDate) {
    msg += `• *Due Date:* ${params.dueDate}\n`;
  }
  msg += `\nKindly visit our shop or contact us to pay interest or redeem your item.\n\n`;
  msg += `*Pooja Jewellers*\n📞 Contact: 9164180406 / 9448587754\n📍 Budigere`;

  return msg;
}

/**
 * Template 2: Girvi Release Confirmation Receipt Message
 */
export function formatGirviReleaseMsg(params: {
  customerName: string;
  pledgeNo?: string;
  ornament?: string;
  principalAmount: number;
  interestPaid: number;
  releaseDate: string;
}): string {
  const name = params.customerName || "Valued Customer";
  const pNo = params.pledgeNo ? ` [Pledge No: ${params.pledgeNo}]` : "";
  const item = params.ornament ? ` (${params.ornament})` : "";
  const principal = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(params.principalAmount || 0);
  const interest = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(params.interestPaid || 0);
  const total = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format((params.principalAmount || 0) + (params.interestPaid || 0));

  let msg = `Hello ${name} 🙏,\n\n`;
  msg += `Thank you for visiting *POOJA JEWELLERS*!\nYour Girvi Pledge${pNo}${item} has been *SUCCESSFULLY RELEASED*.\n\n`;
  msg += `• *Release Date:* ${params.releaseDate}\n`;
  msg += `• *Principal Amount:* ${principal}\n`;
  msg += `• *Interest Paid:* ${interest}\n`;
  msg += `• *Total Amount Settled:* ${total}\n\n`;
  msg += `We appreciate your trust and business. Looking forward to serving you again!\n\n`;
  msg += `*Pooja Jewellers*\n📞 Contact: 9164180406 / 9448587754\n📍 Budigere`;

  return msg;
}

/**
 * Template 3: Sales Invoice Receipt Message (Full PDF Bill Format)
 */
export function formatSaleInvoiceMsg(params: {
  customerName: string;
  invoiceNo: string;
  bookNo?: string;
  date: string;
  billType?: string;
  items?: Array<{ name: string; weight?: number; qty?: number; amount: number }>;
  itemName?: string;
  amount: number;
  weight?: number;
  gstin?: string;
}): string {
  const name = params.customerName || "Valued Customer";
  const amountStr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(params.amount || 0);

  let msg = `=================================\n`;
  msg += `       🧾 *POOJA JEWELLERS* 🧾\n`;
  msg += `   Certified Gold & Silver Jewellery\n`;
  msg += `   Budigere\n`;
  msg += `   📞 Contact: 9164180406 / 9448587754\n`;

  msg += `=================================\n`;
  msg += `*OFFICIAL DIGITAL TAX INVOICE BILL*\n\n`;
  msg += `• *Invoice No:* ${params.invoiceNo}\n`;
  if (params.bookNo) {
    msg += `• *Book No:* ${params.bookNo}\n`;
  }
  msg += `• *Date:* ${params.date}\n`;
  msg += `• *Customer:* ${name}\n`;
  if (params.gstin) {
    msg += `• *GSTIN:* ${params.gstin}\n`;
  }
  msg += `---------------------------------\n`;
  msg += `*PURCHASE ITEM DETAILS:*\n`;

  if (params.items && params.items.length > 0) {
    params.items.forEach((it, idx) => {
      const itemAmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(it.amount || 0);
      msg += `${idx + 1}. *${it.name}*\n`;
      msg += `   Qty: ${it.qty || 1} pc | Weight: ${it.weight || 0}g | Amount: ${itemAmt}\n`;
    });
  } else {
    msg += `1. *${params.itemName || "Jewellery Item"}*\n`;
    if (params.weight) {
      msg += `   Weight: ${params.weight}g | Amount: ${amountStr}\n`;
    } else {
      msg += `   Amount: ${amountStr}\n`;
    }
  }

  msg += `---------------------------------\n`;
  msg += `*TOTAL NET AMOUNT PAID:* *${amountStr}*\n`;
  msg += `*PAYMENT STATUS:* VERIFIED PAID ✅\n`;
  msg += `---------------------------------\n\n`;
  msg += `Thank you for shopping at *Pooja Jewellers*!\nVisit us again for 100% Certified Hallmark Jewellery.\n`;
  msg += `=================================`;

  return msg;
}

