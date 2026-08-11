from sqlalchemy.orm import Session
from sqlalchemy import func
from . import models, schemas

# --- Pledge Entry CRUD ---

def get_pledge_entry(db: Session, entry_id: int):
    return db.query(models.PledgeEntry).filter(models.PledgeEntry.id == entry_id).first()

def get_pledges(db: Session, skip: int = 0, limit: int = 2000):
    return db.query(models.PledgeEntry).order_by(models.PledgeEntry.id.desc()).offset(skip).limit(limit).all()

def create_pledge_entry(db: Session, entry: schemas.PledgeEntryCreate):
    db_entry = models.PledgeEntry(**entry.model_dump())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def update_pledge_entry(db: Session, entry_id: int, entry_update: schemas.PledgeEntryUpdate):
    db_entry = db.query(models.PledgeEntry).filter(models.PledgeEntry.id == entry_id).first()
    if not db_entry:
        return None
    for key, value in entry_update.model_dump(exclude_unset=True).items():
        setattr(db_entry, key, value)
    db.commit()
    db.refresh(db_entry)
    return db_entry

def delete_pledge_entry(db: Session, entry_id: int):
    db_entry = db.query(models.PledgeEntry).filter(models.PledgeEntry.id == entry_id).first()
    if db_entry:
        db.delete(db_entry)
        db.commit()
        return True
    return False


# --- Pledge Payment CRUD ---

def create_pledge_payment(db: Session, payment: schemas.PledgePaymentCreate, pledge_id: int):
    db_payment = models.PledgePayment(**payment.model_dump(), pledge_id=pledge_id)
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment

def delete_pledge_payment(db: Session, payment_id: int):
    db_payment = db.query(models.PledgePayment).filter(models.PledgePayment.id == payment_id).first()
    if db_payment:
        db.delete(db_payment)
        db.commit()
        return True
    return False


# --- System Log CRUD ---

def get_system_logs(db: Session, skip: int = 0, limit: int = 500):
    return db.query(models.SystemLog).order_by(models.SystemLog.timestamp.desc()).offset(skip).limit(limit).all()

def create_system_log(db: Session, action: str, details: str, module: str = "GENERAL", user_name: str = "admin"):
    import time
    from datetime import datetime, timezone, timedelta
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    timestamp = datetime.fromtimestamp(time.time(), tz=ist_tz).strftime("%Y-%m-%d %H:%M:%S")
    db_log = models.SystemLog(
        timestamp=timestamp,
        action=action,
        details=details,
        module=module,
        user_name=user_name
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log
