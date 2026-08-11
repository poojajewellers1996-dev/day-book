from pydantic import BaseModel
from typing import List, Optional

# --- Pledge Payment Schemas ---

class PledgePaymentBase(BaseModel):
    pledge_id: int
    date: str
    payment_type: str  # "INTEREST" or "PRINCIPAL" or "TOP_UP"
    amount: float
    payment_method: str  # "CASH", "UPI", "OTHER"

class PledgePaymentCreate(BaseModel):
    payment_type: str
    amount: float
    payment_method: str
    date: str

class PledgePayment(PledgePaymentBase):
    id: int

    class Config:
        from_attributes = True


# --- Pledge Entry Schemas ---

class PledgeEntryBase(BaseModel):
    customer_name: str
    ornament: str
    weight: float
    amount: float
    interest_percentage: float
    date: str  # ISO Date YYYY-MM-DD when the pledge was created
    pledge_no: Optional[str] = None
    pawner_relation: Optional[str] = None
    pawner_relation_name: Optional[str] = None
    mobile: Optional[str] = None
    income: Optional[str] = None
    address: Optional[str] = None
    rupees_in_words: Optional[str] = None
    interest_rate_text: Optional[str] = None
    redemption_period_months: Optional[int] = 12
    interest_payment_frequency: Optional[str] = None
    gross_weight: Optional[float] = None
    less_weight: Optional[float] = None
    net_weight: Optional[float] = None
    quantity: Optional[int] = None
    estimated_value: Optional[float] = None
    
    ornament_2: Optional[str] = None
    quantity_2: Optional[int] = None
    gross_weight_2: Optional[float] = None
    less_weight_2: Optional[float] = None
    net_weight_2: Optional[float] = None
    estimated_value_2: Optional[float] = None

    ornament_3: Optional[str] = None
    quantity_3: Optional[int] = None
    gross_weight_3: Optional[float] = None
    less_weight_3: Optional[float] = None
    net_weight_3: Optional[float] = None
    estimated_value_3: Optional[float] = None

    due_date: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    release_date: Optional[str] = None
    customer_photo: Optional[str] = None
    item_photo: Optional[str] = None
    is_existing: Optional[int] = 0
    is_repledged: Optional[int] = 0
    repledged_bank: Optional[str] = None
    repledged_amount: Optional[float] = None
    repledged_date: Optional[str] = None
    repledged_name: Optional[str] = None
    repledged_receipt_no: Optional[str] = None
    repledged_entries: Optional[str] = None  # JSON string

class PledgeEntryCreate(PledgeEntryBase):
    pass

class PledgeEntryUpdate(BaseModel):
    customer_name: Optional[str] = None
    ornament: Optional[str] = None
    weight: Optional[float] = None
    amount: Optional[float] = None
    interest_percentage: Optional[float] = None
    pledge_no: Optional[str] = None
    pawner_relation: Optional[str] = None
    pawner_relation_name: Optional[str] = None
    mobile: Optional[str] = None
    income: Optional[str] = None
    address: Optional[str] = None
    rupees_in_words: Optional[str] = None
    interest_rate_text: Optional[str] = None
    redemption_period_months: Optional[int] = None
    interest_payment_frequency: Optional[str] = None
    gross_weight: Optional[float] = None
    less_weight: Optional[float] = None
    net_weight: Optional[float] = None
    quantity: Optional[int] = None
    estimated_value: Optional[float] = None
    
    ornament_2: Optional[str] = None
    quantity_2: Optional[int] = None
    gross_weight_2: Optional[float] = None
    less_weight_2: Optional[float] = None
    net_weight_2: Optional[float] = None
    estimated_value_2: Optional[float] = None

    ornament_3: Optional[str] = None
    quantity_3: Optional[int] = None
    gross_weight_3: Optional[float] = None
    less_weight_3: Optional[float] = None
    net_weight_3: Optional[float] = None
    estimated_value_3: Optional[float] = None

    due_date: Optional[str] = None
    status: Optional[str] = None
    release_date: Optional[str] = None
    customer_photo: Optional[str] = None
    item_photo: Optional[str] = None
    date: Optional[str] = None
    is_existing: Optional[int] = None
    is_repledged: Optional[int] = None
    repledged_bank: Optional[str] = None
    repledged_amount: Optional[float] = None
    repledged_date: Optional[str] = None
    repledged_name: Optional[str] = None
    repledged_receipt_no: Optional[str] = None
    repledged_entries: Optional[str] = None

class PledgeEntry(PledgeEntryBase):
    id: int
    payments: List[PledgePayment] = []

    class Config:
        from_attributes = True


# --- System Log Schema ---

class SystemLogResponse(BaseModel):
    id: int
    timestamp: str
    action: str
    details: str

    class Config:
        from_attributes = True
