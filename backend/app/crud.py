from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas

# --- DayBook CRUD ---

def get_daybook(db: Session, daybook_id: int):
    return db.query(models.DayBook).filter(models.DayBook.id == daybook_id).first()

def get_daybook_by_date(db: Session, date: str):
    return db.query(models.DayBook).filter(models.DayBook.date == date).first()

def get_previous_daybook(db: Session, date: str):
    """Return the most recent DayBook whose date is strictly before `date`."""
    return (
        db.query(models.DayBook)
        .filter(models.DayBook.date < date)
        .order_by(models.DayBook.date.desc())
        .first()
    )

import re

def parse_split_tag(text: str, default_amount: float):
    if not text:
        return default_amount, 0.0, 0.0, "hdfc_192"

    match = re.search(r"\[SPLIT:C([\d.]+):U([\d.]+)(?::O([\d.]+))?(?::A([^\]]+))?\]", text)
    if match:
        c = float(match.group(1)) if match.group(1) else 0.0
        u = float(match.group(2)) if match.group(2) else 0.0
        o = float(match.group(3)) if match.group(3) else 0.0
        acc = match.group(4).strip() if match.group(4) else "hdfc_192"
        return c, u, o, acc

    upi_match = re.search(r"\[UPI(?::([^\]]+))?\]", text, re.IGNORECASE)
    if upi_match:
        acc = upi_match.group(1).strip().lower() if upi_match.group(1) else "hdfc_192"
        return 0.0, default_amount, 0.0, acc

    accounts = ["hdfc_192", "hdfc_od_7442", "pooja_068", "shankarlal_832", "vikash", "vikram", "deepak", "kavitha"]
    for a in accounts:
        if f"[{a}]".lower() in text.lower() or f"[{a.replace('_', ' ')}]".lower() in text.lower():
            return 0.0, default_amount, 0.0, a

    if re.search(r"Payment Method:\s*(HDFC|HDFC_192|HDFC_OD|UPI)", text, re.IGNORECASE) or \
       re.search(r"\((HDFC Bank|HDFC OD|PhonePe|UPI)\)", text, re.IGNORECASE):
        acc = "hdfc_od_7442" if ("hdfc_od" in text.lower() or "hdfc od" in text.lower()) else "hdfc_192"
        return 0.0, default_amount, 0.0, acc

    if text.startswith("[UPI"):
        acc = "hdfc_192"
        if text.startswith("[UPI:"):
            parts = text.split("]")
            if parts:
                acc = parts[0].replace("[UPI:", "").strip().lower()
        return 0.0, default_amount, 0.0, acc
    elif text.startswith("[OTHER]"):
        return 0.0, 0.0, default_amount, "hdfc_192"
    else:
        return default_amount, 0.0, 0.0, "hdfc_192"

def extract_upi_account(val: str) -> str:
    if not val:
        return "hdfc_192"
    if val.startswith("[UPI:"):
        parts = val.split("]")
        if parts:
            return parts[0].replace("[UPI:", "").strip()
    return "hdfc_192"

def recalculate_and_cascade_daybook(db: Session, daybook_id: int):
    daybook = db.query(models.DayBook).filter(models.DayBook.id == daybook_id).first()
    if not daybook:
        return

    # If opening balance was not manually adjusted, sync opening balance with previous daybook's closing balance
    if getattr(daybook, "is_manually_adjusted", 0) != 1:
        prev = get_previous_daybook(db, daybook.date)
        if prev:
            daybook.opening_cash = prev.closing_cash or 0.0
            daybook.opening_upi = prev.closing_upi or 0.0
            daybook.opening_other = prev.closing_other or 0.0
            daybook.opening_upi_details = prev.closing_upi_details or "{}"


    sold_cash_total = 0.0
    sold_upi_total = 0.0
    sold_other_total = 0.0
    seen_bills = set()
    for item in daybook.sold_items:
        bill_match = re.search(r"\[BILL:([^\]]+)\]", item.item_name)
        if bill_match:
            bill_id = bill_match.group(1)
            if bill_id in seen_bills:
                continue
            seen_bills.add(bill_id)
        c, u, o, acc = parse_split_tag(item.item_name, item.amount)
        sold_cash_total += c
        sold_upi_total += u
        sold_other_total += o

    # Filter out auto-posted / old Girvi entries from debit/credit sums to avoid double counting
    debit_entries_filtered = [e for e in daybook.debit_entries if not e.name.lower().startswith("girvi no.") and not "girvi pledge" in e.particulars.lower()]
    credit_entries_filtered = [
        e for e in daybook.credit_entries 
        if not e.name.lower().startswith("chhudai no.") 
        and not e.name.lower().startswith("banda no.") 
        and not "girvi release" in e.particulars.lower() 
        and not "girvi banda" in e.particulars.lower()
    ]

    banda_entries = [
        e for e in daybook.credit_entries 
        if e.name.lower().startswith("banda no.") or "girvi banda" in e.particulars.lower()
    ]

    banda_cash = 0.0
    banda_upi = 0.0
    banda_other = 0.0
    for e in banda_entries:
        c, u, o, acc = parse_split_tag(e.particulars, e.amount)
        banda_cash += c
        banda_upi += u
        banda_other += o

    debit_cash = 0.0
    debit_upi = 0.0
    debit_other = 0.0
    for e in debit_entries_filtered:
        comb = f"{e.particulars or ''} {getattr(e, 'remarks', '') or ''} {getattr(e, 'name', '') or ''}"
        c, u, o, acc = parse_split_tag(comb, e.amount)
        debit_cash += c
        debit_upi += u
        debit_other += o

    credit_cash = 0.0
    credit_upi = 0.0
    credit_other = 0.0
    for e in credit_entries_filtered:
        comb = f"{e.particulars or ''} {getattr(e, 'remarks', '') or ''} {getattr(e, 'name', '') or ''}"
        c, u, o, acc = parse_split_tag(comb, e.amount)
        credit_cash += c
        credit_upi += u
        credit_other += o

    pledge_cash = 0.0
    pledge_upi = 0.0
    pledge_other = 0.0
    for e in daybook.pledge_entries:
        if getattr(e, "is_existing", 0) == 1:
            continue
        total_top_ups = sum(p.amount for p in e.payments if p.payment_type == "TOP_UP")
        initial_amount = e.amount - total_top_ups
        c, u, o, acc = parse_split_tag(e.customer_name, initial_amount)
        pledge_cash += c
        pledge_upi += u
        pledge_other += o

    release_cash = 0.0
    release_upi = 0.0
    release_other = 0.0
    for e in daybook.release_entries:
        tot = e.principal_amount + e.interest_received
        c, u, o, acc = parse_split_tag(e.customer_name, tot)
        release_cash += c
        release_upi += u
        release_other += o

    phonepe_total = sum(e.amount for e in daybook.phonepe_entries)

    cash_rec = max(0.0, credit_cash + sold_cash_total + release_cash + banda_cash)
    cash_given = debit_cash + pledge_cash

    upi_rec = phonepe_total + credit_upi + release_upi + banda_upi
    upi_given = debit_upi + pledge_upi

    other_rec = credit_other + sold_other_total + release_other + banda_other
    other_given = debit_other + pledge_other

    import json
    accounts = ["hdfc_192", "hdfc_od_7442", "pooja_068", "shankarlal_832", "vikash", "vikram", "deepak", "kavitha"]

    opening_details = {}
    if daybook.opening_upi_details:
        try:
            opening_details = json.loads(daybook.opening_upi_details)
        except Exception:
            pass

    for acc in accounts:
        if acc not in opening_details:
            opening_details[acc] = 0.0

    # Ensure opening_upi matches the sum of details (in case adjustments were made)
    details_sum = sum(opening_details.values())
    if details_sum > 0:
        daybook.opening_upi = details_sum
    elif daybook.opening_upi and daybook.opening_upi > 0:
        opening_details["hdfc_192"] = daybook.opening_upi

    upi_rec_per_account = {acc: 0.0 for acc in accounts}
    upi_given_per_account = {acc: 0.0 for acc in accounts}

    def extract_upi_account(val: str) -> str:
        if not val:
            return "hdfc_192"
        if val.startswith("[UPI:"):
            parts = val.split("]")
            if parts:
                return parts[0].replace("[UPI:", "").strip()
        return "hdfc_192"

    for e in credit_entries_filtered:
        c, u, o, acc = parse_split_tag(e.particulars, e.amount)
        if u > 0 and acc in upi_rec_per_account:
            upi_rec_per_account[acc] += u

    for e in banda_entries:
        c, u, o, acc = parse_split_tag(e.particulars, e.amount)
        if u > 0 and acc in upi_rec_per_account:
            upi_rec_per_account[acc] += u

    for e in daybook.release_entries:
        tot = e.principal_amount + e.interest_received
        c, u, o, acc = parse_split_tag(e.customer_name, tot)
        if u > 0 and acc in upi_rec_per_account:
            upi_rec_per_account[acc] += u

    for e in daybook.phonepe_entries:
        acc = extract_upi_account(e.customer_name)
        if acc in upi_rec_per_account:
            upi_rec_per_account[acc] += e.amount

    for e in debit_entries_filtered:
        c, u, o, acc = parse_split_tag(e.particulars, e.amount)
        if u > 0 and acc in upi_given_per_account:
            upi_given_per_account[acc] += u

    for e in daybook.pledge_entries:
        if getattr(e, "is_existing", 0) == 1:
            continue
        total_top_ups = sum(p.amount for p in e.payments if p.payment_type == "TOP_UP")
        initial_amount = e.amount - total_top_ups
        c, u, o, acc = parse_split_tag(e.customer_name, initial_amount)
        if u > 0 and acc in upi_given_per_account:
            upi_given_per_account[acc] += u

    closing_details = {}
    for acc in accounts:
        closing_details[acc] = opening_details[acc] + upi_rec_per_account[acc] - upi_given_per_account[acc]

    daybook.opening_cash = daybook.opening_cash or 0.0
    daybook.opening_upi = daybook.opening_upi or 0.0
    daybook.opening_other = daybook.opening_other or 0.0
    daybook.opening_upi_details = json.dumps(opening_details)
    daybook.closing_cash = daybook.opening_cash + cash_rec - cash_given
    daybook.closing_upi = daybook.opening_upi + upi_rec - upi_given
    daybook.closing_other = daybook.opening_other + other_rec - other_given
    daybook.closing_upi_details = json.dumps(closing_details)

    db.commit()
    db.refresh(daybook)

    next_daybook = (
        db.query(models.DayBook)
        .filter(models.DayBook.date > daybook.date)
        .order_by(models.DayBook.date.asc())
        .first()
    )
    if next_daybook and getattr(next_daybook, "is_manually_adjusted", 0) != 1:
        next_daybook.opening_cash = daybook.closing_cash or 0.0
        next_daybook.opening_upi = daybook.closing_upi or 0.0
        next_daybook.opening_upi_details = daybook.closing_upi_details or "{}"
        next_daybook.opening_other = daybook.closing_other or 0.0

        db.commit()
        recalculate_and_cascade_daybook(db, next_daybook.id)

def create_daybook(db: Session, daybook: schemas.DayBookCreate):
    db_daybook = models.DayBook(
        date=daybook.date,
        opening_cash=daybook.opening_cash,
        opening_upi=daybook.opening_upi,
        opening_other=daybook.opening_other,
        closing_cash=daybook.closing_cash,
        closing_upi=daybook.closing_upi,
        closing_other=daybook.closing_other,
        opening_upi_details=daybook.opening_upi_details,
        closing_upi_details=daybook.closing_upi_details,
        is_manually_adjusted=getattr(daybook, "is_manually_adjusted", 0) or 0
    )
    db.add(db_daybook)
    db.commit()
    db.refresh(db_daybook)
    recalculate_and_cascade_daybook(db, db_daybook.id)
    return db_daybook

def update_daybook_cash(
    db: Session, 
    daybook_id: int, 
    opening_cash: float = None, 
    opening_upi: float = None, 
    opening_other: float = None, 
    closing_cash: float = None,
    closing_upi: float = None,
    closing_other: float = None,
    opening_upi_details: str = None,
    closing_upi_details: str = None,
    is_manually_adjusted: int = None
):
    db_daybook = get_daybook(db, daybook_id)
    if not db_daybook:
        return None
    if opening_cash is not None:
        db_daybook.opening_cash = opening_cash
    if opening_upi is not None:
        db_daybook.opening_upi = opening_upi
    if opening_other is not None:
        db_daybook.opening_other = opening_other
    if is_manually_adjusted is not None:
        db_daybook.is_manually_adjusted = is_manually_adjusted
    if closing_cash is not None:
        db_daybook.closing_cash = closing_cash
    if closing_upi is not None:
        db_daybook.closing_upi = closing_upi
    if closing_other is not None:
        db_daybook.closing_other = closing_other
    if opening_upi_details is not None:
        db_daybook.opening_upi_details = opening_upi_details
    if closing_upi_details is not None:
        db_daybook.closing_upi_details = closing_upi_details
    db.commit()
    db.refresh(db_daybook)
    recalculate_and_cascade_daybook(db, db_daybook.id)
    return db_daybook

def delete_daybook(db: Session, daybook_id: int):
    db_daybook = get_daybook(db, daybook_id)
    if db_daybook:
        prev = get_previous_daybook(db, db_daybook.date)
        db.delete(db_daybook)
        db.commit()
        if prev:
            recalculate_and_cascade_daybook(db, prev.id)
        else:
            next_day = db.query(models.DayBook).order_by(models.DayBook.date.asc()).first()
            if next_day:
                next_day.opening_cash = 0.0
                next_day.opening_upi = 0.0
                next_day.opening_other = 0.0
                db.commit()
                recalculate_and_cascade_daybook(db, next_day.id)
        return True
    return False

# --- Debit Entry ---
def create_debit_entry(db: Session, entry: schemas.DebitEntryCreate, daybook_id: int):
    db_entry = models.DebitEntry(**entry.model_dump(), daybook_id=daybook_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    recalculate_and_cascade_daybook(db, daybook_id)
    return db_entry

def delete_debit_entry(db: Session, entry_id: int):
    db_entry = db.query(models.DebitEntry).filter(models.DebitEntry.id == entry_id).first()
    if db_entry:
        daybook_id = db_entry.daybook_id
        db.delete(db_entry)
        db.commit()
        recalculate_and_cascade_daybook(db, daybook_id)
        return True
    return False

def update_debit_entry(db: Session, entry_id: int, entry_update: schemas.DebitEntryUpdate):
    db_entry = db.query(models.DebitEntry).filter(models.DebitEntry.id == entry_id).first()
    if not db_entry:
        return None
    if entry_update.name is not None:
        db_entry.name = entry_update.name
    if entry_update.particulars is not None:
        db_entry.particulars = entry_update.particulars
    if entry_update.amount is not None:
        db_entry.amount = entry_update.amount
    if entry_update.remarks is not None:
        db_entry.remarks = entry_update.remarks
    db.commit()
    db.refresh(db_entry)
    recalculate_and_cascade_daybook(db, db_entry.daybook_id)
    return db_entry

# --- Credit Entry ---
def create_credit_entry(db: Session, entry: schemas.CreditEntryCreate, daybook_id: int):
    db_entry = models.CreditEntry(**entry.model_dump(), daybook_id=daybook_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    recalculate_and_cascade_daybook(db, daybook_id)
    return db_entry

def delete_credit_entry(db: Session, entry_id: int):
    db_entry = db.query(models.CreditEntry).filter(models.CreditEntry.id == entry_id).first()
    if db_entry:
        daybook_id = db_entry.daybook_id
        db.delete(db_entry)
        db.commit()
        recalculate_and_cascade_daybook(db, daybook_id)
        return True
    return False

def update_credit_entry(db: Session, entry_id: int, entry_update: schemas.CreditEntryUpdate):
    db_entry = db.query(models.CreditEntry).filter(models.CreditEntry.id == entry_id).first()
    if not db_entry:
        return None
    if entry_update.name is not None:
        db_entry.name = entry_update.name
    if entry_update.particulars is not None:
        db_entry.particulars = entry_update.particulars
    if entry_update.amount is not None:
        db_entry.amount = entry_update.amount
    if entry_update.remarks is not None:
        db_entry.remarks = entry_update.remarks
    db.commit()
    db.refresh(db_entry)
    recalculate_and_cascade_daybook(db, db_entry.daybook_id)
    return db_entry


# --- Sold Item ---
def create_sold_item(db: Session, item: schemas.SoldItemCreate, daybook_id: int):
    import re
    db_item = models.SoldItem(**item.model_dump(), daybook_id=daybook_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    
    # Check if a barcode is encoded in the item name
    # Format typically: ... [BARCODE:P00001] ...
    match = re.search(r"\[BARCODE:([A-Za-z0-9]+)\]", db_item.item_name)
    if match:
        bc_no = match.group(1).strip()
        bc_upper = bc_no.upper()
        # 1. If database item
        db_pi = db.query(models.PurchaseItem).filter(models.PurchaseItem.barcode_no == bc_no).first()
        if db_pi:
            db_pi.is_sold = 1
            db.commit()
        else:
            # 2. If it's an Excel item, add to sold_excel_barcodes
            existing = db.query(models.SoldExcelBarcode).filter(
                models.SoldExcelBarcode.barcode_no == bc_upper
            ).first()
            if not existing:
                new_sold = models.SoldExcelBarcode(barcode_no=bc_upper)
                db.add(new_sold)
                db.commit()
            
    recalculate_and_cascade_daybook(db, daybook_id)
    return db_item

def update_sold_item(db: Session, item_id: int, item_update: schemas.SoldItemUpdate):
    db_item = db.query(models.SoldItem).filter(models.SoldItem.id == item_id).first()
    if not db_item:
        return None
    if item_update.item_name is not None:
        db_item.item_name = item_update.item_name
    if item_update.quantity is not None:
        db_item.quantity = item_update.quantity
    if item_update.weight is not None:
        db_item.weight = item_update.weight
    if item_update.amount is not None:
        db_item.amount = item_update.amount
    db.commit()
    db.refresh(db_item)
    recalculate_and_cascade_daybook(db, db_item.daybook_id)
    return db_item


def delete_sold_item(db: Session, item_id: int):
    import re
    db_item = db.query(models.SoldItem).filter(models.SoldItem.id == item_id).first()
    if db_item:
        daybook_id = db_item.daybook_id
        
        # Check barcode
        match = re.search(r"\[BARCODE:([A-Za-z0-9]+)\]", db_item.item_name)
        if match:
            bc_no = match.group(1).strip()
            bc_upper = bc_no.upper()
            db_pi = db.query(models.PurchaseItem).filter(models.PurchaseItem.barcode_no == bc_no).first()
            if db_pi:
                db_pi.is_sold = 0
                db.commit()
            else:
                # Remove from SoldExcelBarcode
                excel_sold = db.query(models.SoldExcelBarcode).filter(
                    models.SoldExcelBarcode.barcode_no == bc_upper
                ).first()
                if excel_sold:
                    db.delete(excel_sold)
                    db.commit()
                
        db.delete(db_item)
        db.commit()
        recalculate_and_cascade_daybook(db, daybook_id)
        return True
    return False


# --- PhonePe / UPI ---
def create_phonepe_entry(db: Session, entry: schemas.PhonePeEntryCreate, daybook_id: int):
    db_entry = models.PhonePeEntry(**entry.model_dump(), daybook_id=daybook_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    recalculate_and_cascade_daybook(db, daybook_id)
    return db_entry

def delete_phonepe_entry(db: Session, entry_id: int):
    db_entry = db.query(models.PhonePeEntry).filter(models.PhonePeEntry.id == entry_id).first()
    if db_entry:
        daybook_id = db_entry.daybook_id
        db.delete(db_entry)
        db.commit()
        recalculate_and_cascade_daybook(db, daybook_id)
        return True
    return False

# --- Old Gold ---
def create_old_gold_entry(db: Session, entry: schemas.OldGoldEntryCreate, daybook_id: int):
    db_entry = models.OldGoldEntry(**entry.model_dump(), daybook_id=daybook_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def delete_old_gold_entry(db: Session, entry_id: int):
    db_entry = db.query(models.OldGoldEntry).filter(models.OldGoldEntry.id == entry_id).first()
    if db_entry:
        db.delete(db_entry)
        db.commit()
        return True
    return False

# --- Old Silver ---
def create_old_silver_entry(db: Session, entry: schemas.OldSilverEntryCreate, daybook_id: int):
    db_entry = models.OldSilverEntry(**entry.model_dump(), daybook_id=daybook_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def delete_old_silver_entry(db: Session, entry_id: int):
    db_entry = db.query(models.OldSilverEntry).filter(models.OldSilverEntry.id == entry_id).first()
    if db_entry:
        db.delete(db_entry)
        db.commit()
        return True
    return False

# --- Pledge ---
def create_pledge_entry(db: Session, entry: schemas.PledgeEntryCreate, daybook_id: int):
    db_entry = models.PledgeEntry(**entry.model_dump(), daybook_id=daybook_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    recalculate_and_cascade_daybook(db, daybook_id)
    return db_entry

def delete_pledge_entry(db: Session, entry_id: int):
    db_entry = db.query(models.PledgeEntry).filter(models.PledgeEntry.id == entry_id).first()
    if db_entry:
        daybook_id = db_entry.daybook_id
        pledge_no = db_entry.pledge_no.strip() if db_entry.pledge_no else None
        
        affected_daybook_ids = {daybook_id}
        
        if pledge_no:
            import re
            
            # Find and delete matching ReleaseEntry
            releases = db.query(models.ReleaseEntry).filter(
                (models.ReleaseEntry.customer_name == pledge_no) |
                (models.ReleaseEntry.customer_name.like(f"%{pledge_no}"))
            ).all()
            
            for r in releases:
                cleaned_name = re.sub(r"^\[(?:UPI|OTHER)\]\s*", "", r.customer_name, flags=re.IGNORECASE).strip()
                if cleaned_name == pledge_no:
                    affected_daybook_ids.add(r.daybook_id)
                    db.delete(r)
            
            # Find and delete matching CreditEntry (Banda/Chhudai/Repayments)
            credits = db.query(models.CreditEntry).filter(
                models.CreditEntry.name.like(f"%{pledge_no}%")
            ).all()
            
            credit_pattern = rf"^(?:banda no\.|chhudai no\.)\s*{re.escape(pledge_no.lower())}$"
            for c in credits:
                name_lower = c.name.lower().strip()
                if re.match(credit_pattern, name_lower, flags=re.IGNORECASE) or name_lower == f"girvi pay ({pledge_no.lower()})":
                    affected_daybook_ids.add(c.daybook_id)
                    db.delete(c)
                    
            # Find and delete matching DebitEntry (Girvi/TopUps)
            debits = db.query(models.DebitEntry).filter(
                models.DebitEntry.name.like(f"%{pledge_no}%")
            ).all()
            
            debit_pattern = rf"^girvi no\.\s*{re.escape(pledge_no.lower())}$"
            for d in debits:
                name_lower = d.name.lower().strip()
                if re.match(debit_pattern, name_lower, flags=re.IGNORECASE) or name_lower == f"girvi topup ({pledge_no.lower()})":
                    affected_daybook_ids.add(d.daybook_id)
                    db.delete(d)
        
        db.delete(db_entry)
        db.commit()
        
        # Recalculate all affected daybooks
        for db_id in affected_daybook_ids:
            recalculate_and_cascade_daybook(db, db_id)
            
        return True
    return False

# --- Release ---
def create_release_entry(db: Session, entry: schemas.ReleaseEntryCreate, daybook_id: int):
    db_entry = models.ReleaseEntry(**entry.model_dump(), daybook_id=daybook_id)
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    recalculate_and_cascade_daybook(db, daybook_id)
    return db_entry

def delete_release_entry(db: Session, entry_id: int):
    db_entry = db.query(models.ReleaseEntry).filter(models.ReleaseEntry.id == entry_id).first()
    if db_entry:
        daybook_id = db_entry.daybook_id
        customer_name = db_entry.customer_name
        
        # Clean prefix and spaces from customer_name to get the pledge_no
        import re
        pledge_no = re.sub(r"^\[[^\]]+\]\s*", "", customer_name, flags=re.IGNORECASE).strip()
        
        # Find pledge entry and revert its status to ACTIVE
        if pledge_no:
            pledge = db.query(models.PledgeEntry).filter(models.PledgeEntry.pledge_no == pledge_no).first()
            if pledge:
                pledge.status = "ACTIVE"
                pledge.release_date = None
                
        db.delete(db_entry)
        db.commit()
        recalculate_and_cascade_daybook(db, daybook_id)
        return True
    return False


# --- Master Aavak & Jaavak Report ---
def get_master_aavak_jaavak_entries(
    db: Session,
    start_date: str = None,
    end_date: str = None,
    flow_type: str = None,
    payment_mode: str = None,
    category: str = None,
    search: str = None,
    udhar_filter: str = None
):
    query = db.query(models.DayBook)
    if start_date:
        query = query.filter(models.DayBook.date >= start_date)
    if end_date:
        query = query.filter(models.DayBook.date <= end_date)
    daybooks = query.order_by(models.DayBook.date.desc()).all()

    items = []

    for d in daybooks:
        d_date = d.date

        # 1. Sold items (TAKEN / AAVAK)
        for item in d.sold_items:
            c, u, o, acc = parse_split_tag(item.item_name, item.amount)
            clean_name = item.item_name
            if c > 0:
                items.append({
                    "id": f"sold_cash_{item.id}",
                    "date": d_date,
                    "flow_type": "TAKEN",
                    "category": "SALES",
                    "party_name": clean_name,
                    "particulars": f"Sales (Qty: {item.quantity}, Wt: {item.weight}g)",
                    "mode": "CASH",
                    "mode_key": "cash",
                    "amount": c,
                    "is_udhar": False
                })
            if u > 0:
                items.append({
                    "id": f"sold_upi_{item.id}",
                    "date": d_date,
                    "flow_type": "TAKEN",
                    "category": "SALES",
                    "party_name": clean_name,
                    "particulars": f"Sales UPI (Qty: {item.quantity}, Wt: {item.weight}g)",
                    "mode": f"UPI ({acc})",
                    "mode_key": acc,
                    "amount": u,
                    "is_udhar": False
                })

        # 2. PhonePe / UPI entries (TAKEN / AAVAK) - Only standalone PhonePe entries (not auto-created from Sale)
        for pe in d.phonepe_entries:
            if pe.customer_name and pe.customer_name.endswith("(Sale)"):
                continue
            acc = extract_upi_account(pe.customer_name)
            items.append({
                "id": f"phonepe_{pe.id}",
                "date": d_date,
                "flow_type": "TAKEN",
                "category": "SALES",
                "party_name": pe.customer_name,
                "particulars": "PhonePe / UPI Received",
                "mode": f"UPI ({acc})",
                "mode_key": acc,
                "amount": pe.amount,
                "is_udhar": False
            })


        # 3. Credit Entries (TAKEN / AAVAK)
        for ce in d.credit_entries:
            if ce.name.lower().startswith("chhudai no.") or ce.name.lower().startswith("banda no.") or "girvi release" in ce.particulars.lower() or "girvi banda" in ce.particulars.lower():
                continue
            c, u, o, acc = parse_split_tag(ce.particulars, ce.amount)
            part_lower = (ce.particulars or "").lower()
            name_lower = (ce.name or "").lower()
            cat = "CREDIT_JAMA"
            if "interest" in part_lower or "intrest" in part_lower or "interest" in name_lower or "intrest" in name_lower:
                cat = "INTEREST"
            elif "udar" in part_lower or "udhar" in part_lower or "return" in part_lower:
                cat = "UDHAR"

            mode_str = "CASH"
            m_key = "cash"
            if u > 0:
                mode_str = f"UPI ({acc})"
                m_key = acc

            is_u = (cat in ["UDHAR", "CREDIT_JAMA"]) or ("udhar" in part_lower or "udar" in part_lower or "loan" in part_lower or "udhar" in name_lower or "udar" in name_lower)

            items.append({
                "id": f"credit_{ce.id}",
                "date": d_date,
                "flow_type": "TAKEN",
                "category": cat,
                "party_name": ce.name,
                "particulars": ce.particulars or "Credit / Jama Entry",
                "mode": mode_str,
                "mode_key": m_key,
                "amount": ce.amount,
                "is_udhar": is_u
            })

        # 4. Debit Entries (GIVEN / JAAVAK)
        for de in d.debit_entries:
            if de.name.lower().startswith("girvi no.") or "girvi pledge" in de.particulars.lower():
                continue
            c, u, o, acc = parse_split_tag(de.particulars, de.amount)
            part_lower = (de.particulars or "").lower()
            name_lower = (de.name or "").lower()
            rem_lower = (de.remarks or "").lower()
            
            cat = "DEBIT_NAAVE"
            if "interest" in part_lower or "intrest" in part_lower or "interest" in name_lower or "intrest" in name_lower or "interest" in rem_lower or "intrest" in rem_lower:
                cat = "INTEREST"
            elif "dukan" in part_lower or "expenditure" in part_lower or "expense" in part_lower or "rent" in part_lower or "tea" in part_lower:
                cat = "EXPENSE"
            elif "udar" in part_lower or "udhar" in part_lower or "loan" in part_lower:
                cat = "UDHAR"

            mode_str = "CASH"
            m_key = "cash"
            if u > 0:
                mode_str = f"UPI ({acc})"
                m_key = acc

            is_u = (cat in ["UDHAR", "DEBIT_NAAVE"]) or ("udhar" in part_lower or "udar" in part_lower or "loan" in part_lower or "udhar" in name_lower or "udar" in name_lower)

            items.append({
                "id": f"debit_{de.id}",
                "date": d_date,
                "flow_type": "GIVEN",
                "category": cat,
                "party_name": de.name,
                "particulars": de.particulars or "Debit / Expense Entry",
                "mode": mode_str,
                "mode_key": m_key,
                "amount": de.amount,
                "is_udhar": is_u
            })

        # 5. Pledge Entries (GIVEN / JAAVAK)
        for pe in d.pledge_entries:
            if getattr(pe, "is_existing", 0) == 1:
                continue
            total_top_ups = sum(p.amount for p in pe.payments if p.payment_type == "TOP_UP")
            initial_amount = pe.amount - total_top_ups
            c, u, o, acc = parse_split_tag(pe.customer_name, initial_amount)
            mode_str = "CASH"
            m_key = "cash"
            if u > 0:
                mode_str = f"UPI ({acc})"
                m_key = acc

            items.append({
                "id": f"pledge_{pe.id}",
                "date": d_date,
                "flow_type": "GIVEN",
                "category": "GIRVI_PLEDGE",
                "party_name": pe.customer_name,
                "particulars": f"New Girvi Pledge (Pledge No: {pe.pledge_no or 'N/A'}, Ornament: {pe.ornament})",
                "mode": mode_str,
                "mode_key": m_key,
                "amount": initial_amount,
                "is_udhar": True
            })

        # 6. Release Entries (TAKEN / AAVAK)
        for re_entry in d.release_entries:
            tot = re_entry.principal_amount + re_entry.interest_received
            c, u, o, acc = parse_split_tag(re_entry.customer_name, tot)
            mode_str = "CASH"
            m_key = "cash"
            if u > 0:
                mode_str = f"UPI ({acc})"
                m_key = acc

            items.append({
                "id": f"release_{re_entry.id}",
                "date": d_date,
                "flow_type": "TAKEN",
                "category": "GIRVI_RELEASE",
                "party_name": re_entry.customer_name,
                "particulars": f"Girvi Release (Principal: ₹{re_entry.principal_amount}, Interest: ₹{re_entry.interest_received})",
                "mode": mode_str,
                "mode_key": m_key,
                "amount": tot,
                "principal": re_entry.principal_amount,
                "interest": re_entry.interest_received,
                "is_udhar": False
            })

        # 7. Old Gold & Silver Entries (TAKEN / AAVAK)
        for og in d.old_gold_entries:
            items.append({
                "id": f"old_gold_{og.id}",
                "date": d_date,
                "flow_type": "TAKEN",
                "category": "OLD_METAL",
                "party_name": og.customer_name,
                "particulars": f"Old Gold Received ({og.weight}g)",
                "mode": "CASH",
                "mode_key": "cash",
                "amount": og.amount,
                "is_udhar": False
            })
        for os_entry in d.old_silver_entries:
            items.append({
                "id": f"old_silver_{os_entry.id}",
                "date": d_date,
                "flow_type": "TAKEN",
                "category": "OLD_METAL",
                "party_name": os_entry.customer_name,
                "particulars": f"Old Silver Received ({os_entry.weight}g)",
                "mode": "CASH",
                "mode_key": "cash",
                "amount": os_entry.amount,
                "is_udhar": False
            })

    # Apply Filters
    filtered_items = []
    for item in items:
        if flow_type and flow_type.upper() != "ALL":
            if item["flow_type"] != flow_type.upper():
                continue

        if payment_mode and payment_mode.upper() != "ALL":
            pm = payment_mode.lower()
            if pm == "cash" and item["mode_key"] != "cash":
                continue
            elif pm == "upi" and item["mode_key"] == "cash":
                continue
            elif pm not in ["cash", "upi"] and item["mode_key"] != pm:
                continue

        if category and category.upper() != "ALL":
            if item["category"] != category.upper():
                continue

        if udhar_filter and udhar_filter.upper() != "ALL":
            if udhar_filter.upper() == "ONLY_UDHAR" and not item.get("is_udhar", False):
                continue
            elif udhar_filter.upper() == "NON_UDHAR" and item.get("is_udhar", False):
                continue


        if category and category.upper() != "ALL":
            if item["category"] != category.upper():
                continue

        if search:
            s = search.lower()
            searchable = f"{item['party_name']} {item['particulars']} {item['category']} {item['mode']}".lower()
            if s not in searchable:
                continue

        filtered_items.append(item)

    filtered_items.sort(key=lambda x: (x["date"], x["id"]), reverse=True)

    total_taken = sum(i["amount"] for i in filtered_items if i["flow_type"] == "TAKEN")
    total_given = sum(i["amount"] for i in filtered_items if i["flow_type"] == "GIVEN")

    interest_taken = sum(
        i["amount"] if i["category"] == "INTEREST" else (i.get("interest", 0.0) if i["category"] == "GIRVI_RELEASE" else 0.0)
        for i in filtered_items if i["flow_type"] == "TAKEN"
    )
    interest_given = sum(
        i["amount"] for i in filtered_items if i["flow_type"] == "GIVEN" and i["category"] == "INTEREST"
    )

    return {
        "summary": {
            "total_taken": total_taken,
            "total_given": total_given,
            "net_flow": total_taken - total_given,
            "interest_taken": interest_taken,
            "interest_given": interest_given,
            "net_interest": interest_taken - interest_given,
            "count": len(filtered_items)
        },
        "items": filtered_items
    }

