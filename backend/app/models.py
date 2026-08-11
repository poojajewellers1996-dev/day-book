from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .config import Base

class PledgeEntry(Base):
    __tablename__ = "pledge_entries"
    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, nullable=False)
    ornament = Column(String, nullable=False)
    weight = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    interest_percentage = Column(Float, nullable=False)
    date = Column(String, nullable=False)  # ISO Date YYYY-MM-DD when pledge was created
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

    payments = relationship("PledgePayment", back_populates="pledge", cascade="all, delete-orphan")


class PledgePayment(Base):
    __tablename__ = "pledge_payments"
    id = Column(Integer, primary_key=True, index=True)
    pledge_id = Column(Integer, ForeignKey("pledge_entries.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)  # ISO Date YYYY-MM-DD
    payment_type = Column(String, nullable=False)  # "INTEREST" or "PRINCIPAL" or "TOP_UP"
    amount = Column(Float, nullable=False)
    payment_method = Column(String, nullable=False)  # "CASH", "UPI", "OTHER"

    pledge = relationship("PledgeEntry", back_populates="payments")


class SystemLog(Base):
    __tablename__ = "system_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(String, nullable=False)  # YYYY-MM-DD HH:MM:SS
    action = Column(String, nullable=False)     # e.g. "PLEDGE_CREATE", "PLEDGE_DELETE"
    details = Column(String, nullable=False)    # Detailed log text
    module = Column(String, default="GENERAL")   # e.g. "GIRVI", "BANK_REPLEDGE", "BACKUP"
    user_name = Column(String, default="admin")


class SystemUser(Base):
    __tablename__ = "system_users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, default="admin")
    password_hash = Column(String, nullable=False)
    current_session_id = Column(String, nullable=True)
    last_active_at = Column(DateTime, nullable=True)
