from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime
from sqlalchemy.orm import relationship
from .config import Base

class DayBook(Base):
    __tablename__ = "daybooks"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(String, unique=True, index=True) # ISO format: YYYY-MM-DD
    opening_cash = Column(Float, default=0.0)
    opening_upi = Column(Float, default=0.0)
    opening_other = Column(Float, default=0.0)
    closing_cash = Column(Float, default=0.0)
    closing_upi = Column(Float, default=0.0)
    closing_other = Column(Float, default=0.0)
    opening_upi_details = Column(String, default="{}")
    closing_upi_details = Column(String, default="{}")
    is_manually_adjusted = Column(Integer, default=0)

    debit_entries = relationship("DebitEntry", back_populates="daybook", cascade="all, delete-orphan")
    credit_entries = relationship("CreditEntry", back_populates="daybook", cascade="all, delete-orphan")
    sold_items = relationship("SoldItem", back_populates="daybook", cascade="all, delete-orphan")
    phonepe_entries = relationship("PhonePeEntry", back_populates="daybook", cascade="all, delete-orphan")
    old_gold_entries = relationship("OldGoldEntry", back_populates="daybook", cascade="all, delete-orphan")
    old_silver_entries = relationship("OldSilverEntry", back_populates="daybook", cascade="all, delete-orphan")
    pledge_entries = relationship("PledgeEntry", back_populates="daybook", cascade="all, delete-orphan")
    release_entries = relationship("ReleaseEntry", back_populates="daybook", cascade="all, delete-orphan")
    pledge_payments = relationship("PledgePayment", back_populates="daybook", cascade="all, delete-orphan")

class DebitEntry(Base):
    __tablename__ = "debit_entries"
    id = Column(Integer, primary_key=True, index=True)
    daybook_id = Column(Integer, ForeignKey("daybooks.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    particulars = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    remarks = Column(String, nullable=True)

    daybook = relationship("DayBook", back_populates="debit_entries")

class CreditEntry(Base):
    __tablename__ = "credit_entries"
    id = Column(Integer, primary_key=True, index=True)
    daybook_id = Column(Integer, ForeignKey("daybooks.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    particulars = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    remarks = Column(String, nullable=True)

    daybook = relationship("DayBook", back_populates="credit_entries")

class SoldItem(Base):
    __tablename__ = "sold_items"
    id = Column(Integer, primary_key=True, index=True)
    daybook_id = Column(Integer, ForeignKey("daybooks.id", ondelete="CASCADE"), nullable=False)
    item_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    weight = Column(Float, nullable=False)
    amount = Column(Float, default=0.0, nullable=False)

    daybook = relationship("DayBook", back_populates="sold_items")

class PhonePeEntry(Base):
    __tablename__ = "phonepe_entries"
    id = Column(Integer, primary_key=True, index=True)
    daybook_id = Column(Integer, ForeignKey("daybooks.id", ondelete="CASCADE"), nullable=False)
    customer_name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)

    daybook = relationship("DayBook", back_populates="phonepe_entries")

class OldGoldEntry(Base):
    __tablename__ = "old_gold_entries"
    id = Column(Integer, primary_key=True, index=True)
    daybook_id = Column(Integer, ForeignKey("daybooks.id", ondelete="CASCADE"), nullable=False)
    customer_name = Column(String, nullable=False)
    weight = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)

    daybook = relationship("DayBook", back_populates="old_gold_entries")

class OldSilverEntry(Base):
    __tablename__ = "old_silver_entries"
    id = Column(Integer, primary_key=True, index=True)
    daybook_id = Column(Integer, ForeignKey("daybooks.id", ondelete="CASCADE"), nullable=False)
    customer_name = Column(String, nullable=False)
    weight = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)

    daybook = relationship("DayBook", back_populates="old_silver_entries")

class PledgeEntry(Base):
    __tablename__ = "pledge_entries"
    id = Column(Integer, primary_key=True, index=True)
    daybook_id = Column(Integer, ForeignKey("daybooks.id", ondelete="CASCADE"), nullable=False)
    customer_name = Column(String, nullable=False)
    ornament = Column(String, nullable=False)
    weight = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    interest_percentage = Column(Float, nullable=False)
    is_existing = Column(Integer, default=0)
    is_repledged = Column(Integer, default=0)
    repledged_bank = Column(String, nullable=True)
    repledged_amount = Column(Float, nullable=True)
    repledged_date = Column(String, nullable=True)
    repledged_name = Column(String, nullable=True)
    repledged_receipt_no = Column(String, nullable=True)
    repledged_entries = Column(String, nullable=True)  # JSON array of {name,bank,date,amount,interest_amount,interest_rate}
    repledged_interest_amount = Column(Float, nullable=True)
    repledged_interest_rate = Column(String, nullable=True)

    pledge_no = Column(String, nullable=True)
    pawner_relation = Column(String, nullable=True)
    pawner_relation_name = Column(String, nullable=True)
    mobile = Column(String, nullable=True)
    income = Column(String, nullable=True)
    address = Column(String, nullable=True)
    rupees_in_words = Column(String, nullable=True)
    interest_rate_text = Column(String, nullable=True)
    redemption_period_months = Column(Integer, default=12)
    interest_payment_frequency = Column(String, nullable=True)
    gross_weight = Column(Float, nullable=True)
    less_weight = Column(Float, nullable=True)
    net_weight = Column(Float, nullable=True)
    quantity = Column(Integer, nullable=True)
    estimated_value = Column(Float, nullable=True)
    
    ornament_2 = Column(String, nullable=True)
    quantity_2 = Column(Integer, nullable=True)
    gross_weight_2 = Column(Float, nullable=True)
    less_weight_2 = Column(Float, nullable=True)
    net_weight_2 = Column(Float, nullable=True)
    estimated_value_2 = Column(Float, nullable=True)

    ornament_3 = Column(String, nullable=True)
    quantity_3 = Column(Integer, nullable=True)
    gross_weight_3 = Column(Float, nullable=True)
    less_weight_3 = Column(Float, nullable=True)
    net_weight_3 = Column(Float, nullable=True)
    estimated_value_3 = Column(Float, nullable=True)
    
    due_date = Column(String, nullable=True)
    status = Column(String, default="ACTIVE")
    release_date = Column(String, nullable=True)
    customer_photo = Column(String, nullable=True)
    item_photo = Column(String, nullable=True)

    daybook = relationship("DayBook", back_populates="pledge_entries")
    payments = relationship("PledgePayment", back_populates="pledge", cascade="all, delete-orphan")

    @property
    def date(self):
        if hasattr(self, '_date'):
            return self._date
        return self.daybook.date if self.daybook else None

    @date.setter
    def date(self, value):
        self._date = value



class ReleaseEntry(Base):
    __tablename__ = "release_entries"
    id = Column(Integer, primary_key=True, index=True)
    daybook_id = Column(Integer, ForeignKey("daybooks.id", ondelete="CASCADE"), nullable=False)
    customer_name = Column(String, nullable=False)
    principal_amount = Column(Float, nullable=False)
    interest_received = Column(Float, nullable=False)

    daybook = relationship("DayBook", back_populates="release_entries")

class PledgePayment(Base):
    __tablename__ = "pledge_payments"
    id = Column(Integer, primary_key=True, index=True)
    pledge_id = Column(Integer, ForeignKey("pledge_entries.id", ondelete="CASCADE"), nullable=False)
    daybook_id = Column(Integer, ForeignKey("daybooks.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)  # ISO Date YYYY-MM-DD
    payment_type = Column(String, nullable=False)  # "INTEREST" or "PRINCIPAL"
    amount = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False)  # "CASH", "UPI", "OTHER"

    pledge = relationship("PledgeEntry", back_populates="payments")
    daybook = relationship("DayBook", back_populates="pledge_payments")


class PurchaseBill(Base):
    __tablename__ = "purchase_bills"

    id = Column(Integer, primary_key=True, index=True)
    bill_no = Column(String, index=True, nullable=False)
    bill_date = Column(String, nullable=False)  # ISO: YYYY-MM-DD
    supplier_name = Column(String, nullable=False)
    supplier_gst = Column(String, nullable=True)
    metal = Column(String, nullable=False)  # GOLD or SILVER
    invoice_total = Column(Float, default=0.0)
    remarks = Column(String, nullable=True)
    created_at = Column(String, nullable=True)

    # Rate cut and metal weight tracking fields
    total_weight = Column(Float, nullable=True)
    purity = Column(String, nullable=True)
    is_rate_cut = Column(Integer, default=1)  # 1 = True (Rate cut), 0 = False (Pure)
    rate = Column(Float, nullable=True)
    amount = Column(Float, nullable=True)
    pure_weight = Column(Float, nullable=True)
    making = Column(Float, nullable=True)
    total_percent = Column(Float, nullable=True)

    items = relationship("PurchaseItem", back_populates="bill", cascade="all, delete-orphan")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("purchase_bills.id", ondelete="CASCADE"), nullable=False)
    barcode_no = Column(String, unique=True, index=True, nullable=False)
    ornament_name = Column(String, nullable=False)
    huid_no = Column(String, nullable=True)
    purity = Column(String, nullable=False)
    qty = Column(Integer, default=1)
    weight = Column(Float, nullable=False)
    net_weight = Column(Float, nullable=True)
    rate = Column(Float, default=0.0)
    making = Column(String, nullable=True)
    amount = Column(Float, default=0.0)
    remark = Column(String, nullable=True)
    bill_no = Column(String, nullable=True)   # denormalized for easy lookup
    bill_date = Column(String, nullable=True)  # denormalized
    metal = Column(String, nullable=True)      # GOLD / SILVER
    is_sold = Column(Integer, default=0)       # 0 = Available, 1 = Sold
    sold_date = Column(String, nullable=True)  # YYYY-MM-DD when marked sold

    bill = relationship("PurchaseBill", back_populates="items")


class SoldExcelBarcode(Base):
    __tablename__ = "sold_excel_barcodes"

    barcode_no = Column(String, primary_key=True, index=True)
    sold_date = Column(String, nullable=True)   # YYYY-MM-DD when marked sold


class PurchaseParty(Base):
    __tablename__ = "purchase_parties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    gstin = Column(String, nullable=True)
    opening_balance_cash = Column(Float, default=0.0)      # Cash outstanding balance we owe them (₹)
    opening_balance_gold = Column(Float, default=0.0)      # Gold weight outstanding balance we owe them (grams)
    opening_balance_silver = Column(Float, default=0.0)    # Silver weight outstanding balance we owe them (grams)
    address = Column(String, nullable=True)
    created_at = Column(String, nullable=True)


class SystemLog(Base):
    __tablename__ = "system_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String, nullable=False)  # YYYY-MM-DD HH:MM:SS
    action = Column(String, nullable=False)     # e.g. "DEBIT_CREATE", "PLEDGE_DELETE"
    details = Column(String, nullable=False)    # Detailed log text
    module = Column(String, default="GENERAL")   # e.g. "GIRVI", "BANK_REPLEDGE", "DAYBOOK", "BACKUP", "STOCK"
    user_name = Column(String, default="admin")


class SystemUser(Base):
    __tablename__ = "system_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, default="admin")
    password_hash = Column(String, nullable=False)
    current_session_id = Column(String, nullable=True)
    last_active_at = Column(DateTime, nullable=True)




