import os
import sys

backend_dir = r"c:\Users\pooja\Downloads\DAY BOOK\DAY BOOK\backend"
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.config import SessionLocal
from app import crud, models

def main():
    db = SessionLocal()
    try:
        daybooks = db.query(models.DayBook).order_by(models.DayBook.date.asc()).all()
        for d in daybooks:
            print(f"Recalculating DayBook {d.id} for date {d.date}...")
            crud.recalculate_and_cascade_daybook(db, d.id)
        
        print("\nAll daybooks recalculated!")
        print("\nFinal Daybook Balances after July 25:")
        recent = db.query(models.DayBook).filter(models.DayBook.date >= "2026-07-25").order_by(models.DayBook.date.asc()).all()
        for r in recent:
            print(f"Date: {r.date} | Opening Cash: Rs {r.opening_cash:,.2f}, UPI: Rs {r.opening_upi:,.2f} | Closing Cash: Rs {r.closing_cash:,.2f}, UPI: Rs {r.closing_upi:,.2f}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
