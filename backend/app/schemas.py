from pydantic import BaseModel, Field
from typing import List, Optional

# --- Base Schemas ---

class EntryBase(BaseModel):
    name: str
    particulars: str
    amount: float
    remarks: Optional[str] = None

class DebitEntryCreate(EntryBase):
    pass

class DebitEntryUpdate(EntryBase):
    name: Optional[str] = None
    particulars: Optional[str] = None
    amount: Optional[float] = None

class DebitEntry(EntryBase):
    id: int
    daybook_id: int

    class Config:
        from_attributes = True

class CreditEntryCreate(EntryBase):
    pass

class CreditEntryUpdate(EntryBase):
    name: Optional[str] = None
    particulars: Optional[str] = None
    amount: Optional[float] = None

class CreditEntry(EntryBase):
    id: int
    daybook_id: int

    class Config:
        from_attributes = True

# --- Sold Items ---

class SoldItemBase(BaseModel):
    item_name: str
    quantity: int
    weight: float
    amount: float = 0.0

class SoldItemCreate(SoldItemBase):
    pass

class SoldItemUpdate(SoldItemBase):
    item_name: Optional[str] = None
    quantity: Optional[int] = None
    weight: Optional[float] = None
    amount: Optional[float] = None

class SoldItem(SoldItemBase):
    id: int
    daybook_id: int

    class Config:
        from_attributes = True

# --- PhonePe / UPI ---

class PhonePeEntryBase(BaseModel):
    customer_name: str
    amount: float

class PhonePeEntryCreate(PhonePeEntryBase):
    pass

class PhonePeEntryUpdate(PhonePeEntryBase):
    customer_name: Optional[str] = None
    amount: Optional[float] = None

class PhonePeEntry(PhonePeEntryBase):
    id: int
    daybook_id: int

    class Config:
        from_attributes = True

# --- Old Gold ---

class OldGoldEntryBase(BaseModel):
    customer_name: str
    weight: float
    amount: float

class OldGoldEntryCreate(OldGoldEntryBase):
    pass

class OldGoldEntryUpdate(OldGoldEntryBase):
    customer_name: Optional[str] = None
    weight: Optional[float] = None
    amount: Optional[float] = None

class OldGoldEntry(OldGoldEntryBase):
    id: int
    daybook_id: int

    class Config:
        from_attributes = True

# --- Old Silver ---

class OldSilverEntryBase(BaseModel):
    customer_name: str
    weight: float
    amount: float

class OldSilverEntryCreate(OldSilverEntryBase):
    pass

class OldSilverEntryUpdate(OldSilverEntryBase):
    customer_name: Optional[str] = None
    weight: Optional[float] = None
    amount: Optional[float] = None

class OldSilverEntry(OldSilverEntryBase):
    id: int
    daybook_id: int

    class Config:
        from_attributes = True

# --- Pledge Payment ---

class PledgePaymentBase(BaseModel):
    pledge_id: int
    daybook_id: int
    date: str
    payment_type: str  # "INTEREST" or "PRINCIPAL"
    amount: float
    payment_method: str

class PledgePaymentCreate(BaseModel):
    payment_type: str
    amount: float
    payment_method: str
    date: str

class PledgePayment(PledgePaymentBase):
    id: int

    class Config:
        from_attributes = True

# --- Pledge ---

class PledgeEntryBase(BaseModel):
    customer_name: str
    ornament: str
    weight: float
    amount: float
    interest_percentage: float
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
    repledged_entries: Optional[str] = None  # JSON string: [{name,bank,date,amount},...]

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
    pledge_no: Optional[str] = None
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
    daybook_id: int
    date: Optional[str] = None
    payments: List[PledgePayment] = []

    class Config:
        from_attributes = True

# --- Release ---

class ReleaseEntryBase(BaseModel):
    customer_name: str
    principal_amount: float
    interest_received: float

class ReleaseEntryCreate(ReleaseEntryBase):
    pass

class ReleaseEntryUpdate(ReleaseEntryBase):
    customer_name: Optional[str] = None
    principal_amount: Optional[float] = None
    interest_received: Optional[float] = None

class ReleaseEntry(ReleaseEntryBase):
    id: int
    daybook_id: int

    class Config:
        from_attributes = True

# --- DayBook ---

class DayBookBase(BaseModel):
    date: str # YYYY-MM-DD
    opening_cash: float = 0.0
    opening_upi: float = 0.0
    opening_other: float = 0.0
    closing_cash: float = 0.0
    closing_upi: float = 0.0
    closing_other: float = 0.0
    opening_upi_details: Optional[str] = "{}"
    closing_upi_details: Optional[str] = "{}"
    is_manually_adjusted: Optional[int] = 0

class DayBookCreate(DayBookBase):
    pass

class DayBookUpdate(BaseModel):
    opening_cash: Optional[float] = None
    opening_upi: Optional[float] = None
    opening_other: Optional[float] = None
    closing_cash: Optional[float] = None
    closing_upi: Optional[float] = None
    closing_other: Optional[float] = None
    opening_upi_details: Optional[str] = None
    closing_upi_details: Optional[str] = None
    is_manually_adjusted: Optional[int] = None

class DayBookResponse(DayBookBase):
    id: int
    debit_entries: List[DebitEntry] = []
    credit_entries: List[CreditEntry] = []
    sold_items: List[SoldItem] = []
    phonepe_entries: List[PhonePeEntry] = []
    old_gold_entries: List[OldGoldEntry] = []
    old_silver_entries: List[OldSilverEntry] = []
    pledge_entries: List[PledgeEntry] = []
    release_entries: List[ReleaseEntry] = []

    class Config:
        from_attributes = True


# --- Purchase Party / Supplier ---

class PurchasePartyCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    gstin: Optional[str] = None
    opening_balance_cash: float = 0.0
    opening_balance_gold: float = 0.0
    opening_balance_silver: float = 0.0
    address: Optional[str] = None

class PurchasePartyResponse(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    gstin: Optional[str] = None
    opening_balance_cash: float
    opening_balance_gold: float
    opening_balance_silver: float
    address: Optional[str] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class SupplierPaymentCreate(BaseModel):
    amount: float
    payment_mode: str  # "CASH", "UPI", "OTHER"
    date: str          # YYYY-MM-DD
    remarks: Optional[str] = None
    is_rate_cut: Optional[bool] = False
    rate: Optional[float] = None
    metal: Optional[str] = None  # "GOLD" or "SILVER"


class SystemLogResponse(BaseModel):
    id: int
    timestamp: str
    action: str
    details: str

    class Config:
        from_attributes = True



