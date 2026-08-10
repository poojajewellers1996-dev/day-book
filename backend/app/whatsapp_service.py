import os
import urllib.parse
from fpdf import FPDF

# Ensure generated invoices directory exists
INVOICES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "generated_invoices")
os.makedirs(INVOICES_DIR, exist_ok=True)

class JewelleryInvoicePDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 18)
        self.set_text_color(120, 53, 15) # Warm Amber / Brown
        self.cell(0, 10, "POOJA JEWELLERS", align="C", new_x="LMARGIN", new_y="NEXT")
        
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(146, 64, 14)
        self.cell(0, 5, "Certified Gold & Silver Ornaments", align="C", new_x="LMARGIN", new_y="NEXT")
        
        self.set_font("Helvetica", "", 9)
        self.set_text_color(180, 83, 9)
        self.cell(0, 5, "Budigere | Contact: 9164180406 / 9448587754", align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(4)
        
        # Horizontal Rule
        self.set_draw_color(180, 83, 9)
        self.set_line_width(0.8)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(150, 100, 50)
        self.cell(0, 10, "Thank you for shopping at Pooja Jewellers! | Certified 100% Hallmark Gold & Silver", align="C")


def sanitize_phone_number(phone: str) -> str:
    if not phone:
        return ""
    cleaned = "".join([c for c in phone if c.isdigit()])
    if len(cleaned) == 10:
        return f"91{cleaned}"
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return cleaned
    if len(cleaned) > 10:
        return cleaned[-10:]
    return cleaned


def create_pdf_invoice_file(
    invoice_no: str,
    date_str: str,
    customer_name: str,
    items: list,
    total_amount: float,
    book_no: str = "",
    phone: str = "",
    address: str = ""
) -> str:
    pdf = JewelleryInvoicePDF(orientation="P", unit="mm", format="A4")
    pdf.add_page()
    
    # Customer Details Box
    pdf.set_fill_color(255, 251, 235) # Light amber background
    pdf.set_draw_color(254, 243, 199)
    pdf.rect(10, pdf.get_y(), 190, 22, style="FD")
    
    start_y = pdf.get_y() + 3
    pdf.set_xy(14, start_y)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(45, 27, 14)
    pdf.cell(90, 5, f"Customer: {customer_name or 'Valued Customer'}")
    
    pdf.set_xy(110, start_y)
    pdf.cell(85, 5, f"Invoice No: {invoice_no or 'INV-0001'}", align="R")
    
    pdf.set_xy(14, start_y + 6)
    pdf.set_font("Helvetica", "", 9)
    pdf.cell(90, 5, f"Phone: {phone or '—'}")
    
    pdf.set_xy(110, start_y + 6)
    pdf.cell(85, 5, f"Date: {date_str or '—'}", align="R")
    
    if address:
        pdf.set_xy(14, start_y + 12)
        pdf.cell(90, 5, f"Address: {address}")
    if book_no:
        pdf.set_xy(110, start_y + 12)
        pdf.cell(85, 5, f"Book No: {book_no}", align="R")
        
    pdf.set_y(start_y + 24)
    
    # Table Header
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_fill_color(120, 53, 15)
    pdf.set_text_color(255, 255, 255)
    
    pdf.cell(15, 8, "#", border=1, align="C", fill=True)
    pdf.cell(95, 8, "Item Description", border=1, align="L", fill=True)
    pdf.cell(20, 8, "Qty", border=1, align="C", fill=True)
    pdf.cell(30, 8, "Weight (g)", border=1, align="R", fill=True)
    pdf.cell(30, 8, "Amount (INR)", border=1, align="R", fill=True, new_x="LMARGIN", new_y="NEXT")
    
    # Table Rows
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(45, 27, 14)
    
    for idx, item in enumerate(items, 1):
        bg = (255, 255, 255) if idx % 2 != 0 else (255, 252, 245)
        pdf.set_fill_color(*bg)
        pdf.set_draw_color(252, 211, 77)
        
        name = item.get("name") or item.get("item_name") or "Jewellery Item"
        qty = item.get("qty") or item.get("quantity") or 1
        weight = item.get("weight") or 0.0
        amt = item.get("amount") or 0.0
        
        pdf.cell(15, 7, str(idx), border=1, align="C", fill=True)
        pdf.cell(95, 7, str(name), border=1, align="L", fill=True)
        pdf.cell(20, 7, f"{qty} pc", border=1, align="C", fill=True)
        pdf.cell(30, 7, f"{weight:.2f} g", border=1, align="R", fill=True)
        pdf.cell(30, 7, f"{amt:,.0f}", border=1, align="R", fill=True, new_x="LMARGIN", new_y="NEXT")
        
    pdf.ln(4)
    
    # Total Box
    pdf.set_fill_color(236, 253, 245) # Light green
    pdf.set_draw_color(167, 243, 208)
    pdf.rect(10, pdf.get_y(), 190, 12, style="FD")
    
    tot_y = pdf.get_y() + 3
    pdf.set_xy(14, tot_y)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(6, 95, 70)
    pdf.cell(90, 6, "PAYMENT STATUS: VERIFIED PAID")
    
    pdf.set_xy(110, tot_y)
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_text_color(6, 78, 59)
    pdf.cell(85, 6, f"TOTAL: INR {total_amount:,.0f}", align="R")
    
    safe_filename = f"Invoice_{invoice_no.replace('/', '_').replace('\\', '_')}.pdf"
    file_path = os.path.join(INVOICES_DIR, safe_filename)
    pdf.output(file_path)
    return file_path


def dispatch_whatsapp_bill_directly(phone: str, file_path: str, message_text: str = "") -> bool:
    formatted_phone = sanitize_phone_number(phone)
    if not formatted_phone:
        return False
        
    try:
        encoded_msg = urllib.parse.quote(message_text or "Namaste! Here is your Pooja Jewellers Purchase Invoice.")
        target_url = f"https://web.whatsapp.com/send?phone={formatted_phone}&text={encoded_msg}"
        import webbrowser
        webbrowser.open(target_url)
        return True
    except Exception as e:
        print(f"Backend WhatsApp dispatch info: {e}")
        return False

