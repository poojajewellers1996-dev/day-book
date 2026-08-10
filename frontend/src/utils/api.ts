export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api";

export interface Entry {
  id: number;
  daybook_id: number;
  name: string;
  particulars: string;
  amount: number;
  remarks?: string;
}

export interface SoldItem {
  id: number;
  daybook_id: number;
  item_name: string;
  quantity: number;
  weight: number;
  amount: number;
  date?: string;
}

export interface PhonePeEntry {
  id: number;
  daybook_id: number;
  customer_name: string;
  amount: number;
}

export interface OldGoldEntry {
  id: number;
  daybook_id: number;
  customer_name: string;
  weight: number;
  amount: number;
}

export interface OldSilverEntry {
  id: number;
  daybook_id: number;
  customer_name: string;
  weight: number;
  amount: number;
}

export interface PledgeEntry {
  id: number;
  daybook_id: number;
  customer_name: string;
  ornament: string;
  weight: number;
  amount: number;
  interest_percentage: number;
  pledge_no?: string;
  pawner_relation?: string;
  pawner_relation_name?: string;
  mobile?: string;
  income?: string;
  address?: string;
  rupees_in_words?: string;
  interest_rate_text?: string;
  redemption_period_months?: number;
  interest_payment_frequency?: string;
  gross_weight?: number;
  less_weight?: number;
  net_weight?: number;
  quantity?: number;
  estimated_value?: number;
  ornament_2?: string;
  quantity_2?: number;
  gross_weight_2?: number;
  less_weight_2?: number;
  net_weight_2?: number;
  estimated_value_2?: number;
  ornament_3?: string;
  quantity_3?: number;
  gross_weight_3?: number;
  less_weight_3?: number;
  net_weight_3?: number;
  estimated_value_3?: number;
  due_date?: string;
  status?: string;
  release_date?: string;
  customer_photo?: string;
  item_photo?: string;
  date?: string;
  payments?: PledgePayment[];
  is_existing?: number;
  is_repledged?: number;
  repledged_bank?: string | null;
  repledged_amount?: number | null;
  repledged_date?: string | null;
  repledged_name?: string | null;
  repledged_receipt_no?: string | null;
  repledged_entries?: string | null; // JSON: [{name,bank,date,amount,linked_girvies,interest_amount,interest_rate}]
  repledged_interest_amount?: number | null;
  repledged_interest_rate?: string | null;
}

export interface PledgePayment {
  id: number;
  pledge_id: number;
  daybook_id: number;
  date: string;
  payment_type: "INTEREST" | "PRINCIPAL" | "TOP_UP";
  amount: number;
  payment_method: string;
}

export interface ReleaseEntry {
  id: number;
  daybook_id: number;
  customer_name: string;
  principal_amount: number;
  interest_received: number;
}

export interface DayBook {
  id: number;
  date: string;
  opening_cash: number;
  opening_upi: number;
  opening_other: number;
  closing_cash: number;
  closing_upi: number;
  closing_other: number;
  opening_upi_details?: string;
  closing_upi_details?: string;
  debit_entries: Entry[];
  credit_entries: Entry[];
  sold_items: SoldItem[];
  phonepe_entries: PhonePeEntry[];
  old_gold_entries: OldGoldEntry[];
  old_silver_entries: OldSilverEntry[];
  pledge_entries: PledgeEntry[];
  release_entries: ReleaseEntry[];
}

// Check if window is defined (browser environment)
const isBrowser = typeof window !== "undefined";

export function getAuthHeaders(): Record<string, string> {
  if (isBrowser) {
    const token = localStorage.getItem("pooja_daybook_token");
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
  }
  return {};
}

function getPreviousDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function getNextDateStr(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

export const getOfflineDayBook = (date: string): DayBook => {
  if (!isBrowser) return createEmptyDayBook(date);
  let dbData: DayBook;
  const data = localStorage.getItem(`daybook_${date}`);
  if (data) {
    dbData = JSON.parse(data);
  } else {
    dbData = createEmptyDayBook(date);
  }

  // Ensure opening balances match previous day's closing balances
  const prevDate = getPreviousDateStr(date);
  const prevData = localStorage.getItem(`daybook_${prevDate}`);
  if (prevData) {
    try {
      const prevDb: DayBook = JSON.parse(prevData);
      const pCash = prevDb.closing_cash || 0;
      const pUpi = prevDb.closing_upi || 0;
      const pOther = prevDb.closing_other || 0;
      const pUpiDetails = prevDb.closing_upi_details || "{}";

      if (
        dbData.opening_cash !== pCash ||
        dbData.opening_upi !== pUpi ||
        dbData.opening_other !== pOther ||
        dbData.opening_upi_details !== pUpiDetails
      ) {
        dbData.opening_cash = pCash;
        dbData.opening_upi = pUpi;
        dbData.opening_other = pOther;
        dbData.opening_upi_details = pUpiDetails;
        localStorage.setItem(`daybook_${date}`, JSON.stringify(dbData));
      }
    } catch {}
  } else if (!data) {
    saveOfflineDayBook(date, dbData);
  }

  return dbData;
};

export const saveOfflineDayBook = (date: string, data: DayBook) => {
  if (!isBrowser) return;
  localStorage.setItem(`daybook_${date}`, JSON.stringify(data));
  // Add to sync queue
  const queue = JSON.parse(localStorage.getItem("sync_queue") || "[]");
  if (!queue.includes(date)) {
    queue.push(date);
    localStorage.setItem("sync_queue", JSON.stringify(queue));
  }

  // Also cascade closing balance into next day's opening balance in localStorage
  const nextDate = getNextDateStr(date);
  const nextDataStr = localStorage.getItem(`daybook_${nextDate}`);
  if (nextDataStr) {
    try {
      const nextDb: DayBook = JSON.parse(nextDataStr);
      nextDb.opening_cash = data.closing_cash || 0;
      nextDb.opening_upi = data.closing_upi || 0;
      nextDb.opening_other = data.closing_other || 0;
      nextDb.opening_upi_details = data.closing_upi_details || "{}";
      localStorage.setItem(`daybook_${nextDate}`, JSON.stringify(nextDb));
    } catch {}
  }
};

export const createEmptyDayBook = (date: string): DayBook => {
  return {
    id: -Math.floor(Math.random() * 100000), // temp local negative ID
    date,
    opening_cash: 0,
    opening_upi: 0,
    opening_other: 0,
    closing_cash: 0,
    closing_upi: 0,
    closing_other: 0,
    opening_upi_details: "{}",
    closing_upi_details: "{}",
    debit_entries: [],
    credit_entries: [],
    sold_items: [],
    phonepe_entries: [],
    old_gold_entries: [],
    old_silver_entries: [],
    pledge_entries: [],
    release_entries: [],
  };
};

export async function fetchDayBook(date: string): Promise<{ data: DayBook; synced: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/daybook/date/${date}`);
    if (!res.ok) throw new Error("Server error");
    const serverData: DayBook = await res.json();
    if (isBrowser) {
      localStorage.setItem(`daybook_${date}`, JSON.stringify(serverData));
    }
    return { data: serverData, synced: true };
  } catch (err) {
    console.warn("Backend unavailable, using offline cache:", err);
    return { data: getOfflineDayBook(date), synced: false };
  }
}

export async function ensureBackendDaybook(date: string): Promise<DayBook | null> {
  try {
    const offline = getOfflineDayBook(date);
    const res = await fetch(`${API_BASE}/daybook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        opening_cash: offline.opening_cash || 0,
        opening_upi: offline.opening_upi || 0,
        opening_other: offline.opening_other || 0,
        closing_cash: offline.closing_cash || 0,
        closing_upi: offline.closing_upi || 0,
        closing_other: offline.closing_other || 0,
        opening_upi_details: offline.opening_upi_details || "{}",
        closing_upi_details: offline.closing_upi_details || "{}"
      }),
    });
    if (res.ok) {
      const db = await res.json();
      saveOfflineDayBook(date, db);
      return db;
    }
  } catch (e) {
    console.error("Failed to ensure backend daybook:", e);
  }
  return null;
}

export async function saveDayBookCash(
  daybookId: number, 
  date: string, 
  openingCash: number, 
  openingUpi: number,
  openingOther: number,
  closingCash: number,
  closingUpi: number,
  closingOther: number,
  openingUpiDetails?: string,
  closingUpiDetails?: string
): Promise<boolean> {
  // Update offline cache first
  const offline = getOfflineDayBook(date);
  offline.opening_cash = openingCash;
  offline.opening_upi = openingUpi;
  offline.opening_other = openingOther;
  offline.closing_cash = closingCash;
  offline.closing_upi = closingUpi;
  offline.closing_other = closingOther;
  if (openingUpiDetails !== undefined) offline.opening_upi_details = openingUpiDetails;
  if (closingUpiDetails !== undefined) offline.closing_upi_details = closingUpiDetails;
  saveOfflineDayBook(date, offline);

  let realId = daybookId;
  if (realId < 0) {
    const db = await ensureBackendDaybook(date);
    if (db) {
      realId = db.id;
    } else {
      return false;
    }
  }

  try {
    const res = await fetch(`${API_BASE}/daybook/${realId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        opening_cash: openingCash, 
        opening_upi: openingUpi,
        opening_other: openingOther,
        closing_cash: closingCash,
        closing_upi: closingUpi,
        closing_other: closingOther,
        opening_upi_details: openingUpiDetails,
        closing_upi_details: closingUpiDetails
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Generic add item helper to backend
export async function addSubEntry(daybookId: number, date: string, section: string, data: any): Promise<{ success: boolean; item?: any }> {
  const offline = getOfflineDayBook(date);
  const tempId = Math.floor(Math.random() * 100000);
  const localItem = { id: tempId, daybook_id: daybookId, ...data };

  // Map section name to models field
  const fieldMap: Record<string, string> = {
    debit: "debit_entries",
    credit: "credit_entries",
    "sold-item": "sold_items",
    phonepe: "phonepe_entries",
    "old-gold": "old_gold_entries",
    "old-silver": "old_silver_entries",
    pledge: "pledge_entries",
    release: "release_entries",
  };

  const listName = fieldMap[section];
  if (listName && Array.isArray((offline as any)[listName])) {
    (offline as any)[listName].push(localItem);
    saveOfflineDayBook(date, offline);
  }

  // Sync to the global offline ledger cache for pledges
  if (isBrowser && section === "pledge") {
    try {
      const allPledgesStr = localStorage.getItem("pooja_all_pledges");
      const allPledges = allPledgesStr ? JSON.parse(allPledgesStr) : [];
      if (!allPledges.some((p: any) => p.pledge_no === localItem.pledge_no)) {
        allPledges.unshift(localItem);
        localStorage.setItem("pooja_all_pledges", JSON.stringify(allPledges));
      }
    } catch (e) {
      console.error("Failed to update offline pledges cache:", e);
    }
  }

  let realId = daybookId;
  if (realId < 0) {
    const db = await ensureBackendDaybook(date);
    if (db) {
      realId = db.id;
    } else {
      return { success: false, item: localItem };
    }
  }

  try {
    const res = await fetch(`${API_BASE}/daybook/${realId}/${section}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const savedItem = await res.json();
      // Replace local temp item with server item
      const reFetched = getOfflineDayBook(date);
      if (listName) {
        (reFetched as any)[listName] = (reFetched as any)[listName].filter((i: any) => i.id !== tempId);
        (reFetched as any)[listName].push(savedItem);
        localStorage.setItem(`daybook_${date}`, JSON.stringify(reFetched));
      }
      return { success: true, item: savedItem };
    }
  } catch (err) {
    console.error("Failed to sync sub-entry to backend", err);
  }
  return { success: false, item: localItem };
}

// Generic delete item helper
export async function deleteSubEntry(date: string, section: string, itemId: number): Promise<boolean> {
  const offline = getOfflineDayBook(date);
  const fieldMap: Record<string, string> = {
    debit: "debit_entries",
    credit: "credit_entries",
    "sold-item": "sold_items",
    phonepe: "phonepe_entries",
    "old-gold": "old_gold_entries",
    "old-silver": "old_silver_entries",
    pledge: "pledge_entries",
    release: "release_entries",
  };

  const listName = fieldMap[section];
  if (listName && Array.isArray((offline as any)[listName])) {
    (offline as any)[listName] = (offline as any)[listName].filter((i: any) => i.id !== itemId);
    saveOfflineDayBook(date, offline);
  }

  if (itemId < 0) {
    // Delete temp offline item
    return true;
  }

  try {
    const res = await fetch(`${API_BASE}/${section}/${itemId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Update sold item helper
export async function updateSoldItem(itemId: number, date: string, data: Partial<SoldItem>): Promise<boolean> {
  const offline = getOfflineDayBook(date);
  if (Array.isArray(offline.sold_items)) {
    offline.sold_items = offline.sold_items.map((i: any) => i.id === itemId ? { ...i, ...data } : i);
    saveOfflineDayBook(date, offline);
  }

  if (itemId < 0) return true;

  try {
    const res = await fetch(`${API_BASE}/sold-item/${itemId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Update debit entry helper
export async function updateDebitEntry(entryId: number, date: string, data: { name?: string; particulars?: string; amount?: number; remarks?: string }): Promise<boolean> {
  const offline = getOfflineDayBook(date);
  if (Array.isArray(offline.debit_entries)) {
    offline.debit_entries = offline.debit_entries.map((i: any) => i.id === entryId ? { ...i, ...data } : i);
    saveOfflineDayBook(date, offline);
  }

  if (entryId < 0) return true;

  try {
    const res = await fetch(`${API_BASE}/debit/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Update credit entry helper
export async function updateCreditEntry(entryId: number, date: string, data: { name?: string; particulars?: string; amount?: number; remarks?: string }): Promise<boolean> {
  const offline = getOfflineDayBook(date);
  if (Array.isArray(offline.credit_entries)) {
    offline.credit_entries = offline.credit_entries.map((i: any) => i.id === entryId ? { ...i, ...data } : i);
    saveOfflineDayBook(date, offline);
  }

  if (entryId < 0) return true;

  try {
    const res = await fetch(`${API_BASE}/credit/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}


// Sync all offline records
export async function syncOfflineQueue(): Promise<number> {
  if (!isBrowser) return 0;
  const queue: string[] = JSON.parse(localStorage.getItem("sync_queue") || "[]");
  if (queue.length === 0) return 0;

  let syncCount = 0;
  for (const date of queue) {
    try {
      const localData = getOfflineDayBook(date);
      // Create daybook first on server
      const dbRes = await fetch(`${API_BASE}/daybook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: localData.date,
          opening_cash: localData.opening_cash,
          opening_upi: localData.opening_upi,
          opening_other: localData.opening_other,
          closing_cash: localData.closing_cash,
          closing_upi: localData.closing_upi,
          closing_other: localData.closing_other,
        }),
      });

      if (!dbRes.ok) continue;
      const serverDayBook: DayBook = await dbRes.json();

      // For all offline added items, upload them
      const itemsToSync = [
        { list: localData.debit_entries, section: "debit" },
        { list: localData.credit_entries, section: "credit" },
        { list: localData.sold_items, section: "sold-item" },
        { list: localData.phonepe_entries, section: "phonepe" },
        { list: localData.old_gold_entries, section: "old-gold" },
        { list: localData.old_silver_entries, section: "old-silver" },
        { list: localData.pledge_entries, section: "pledge" },
        { list: localData.release_entries, section: "release" },
      ];

      for (const group of itemsToSync) {
        for (const item of group.list) {
          if (item.id < 0) {
            // strip temp ID
            const { id, daybook_id, ...cleanData } = item as any;
            await fetch(`${API_BASE}/daybook/${serverDayBook.id}/${group.section}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cleanData),
            });
          }
        }
      }

      // Re-fetch to align IDs properly
      const refreshed = await fetch(`${API_BASE}/daybook/date/${date}`);
      if (refreshed.ok) {
        const fullServer = await refreshed.json();
        localStorage.setItem(`daybook_${date}`, JSON.stringify(fullServer));
      }

      syncCount++;
    } catch (err: any) {
      console.warn(`[Sync] Failed syncing date ${date}: ${err.message || err}`);
    }
  }

  localStorage.setItem("sync_queue", JSON.stringify([]));
  return syncCount;
}

export interface OutstandingUdhar {
  name: string;
  amount: number;
}

export async function fetchOutstandingUdhar(): Promise<OutstandingUdhar[]> {
  try {
    const res = await fetch(`${API_BASE}/udar/outstanding`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Server error");
    const data: OutstandingUdhar[] = await res.json();
    if (isBrowser) {
      localStorage.setItem("outstanding_udhar", JSON.stringify(data));
    }
    return data;

  } catch (err) {
    console.warn("Backend unavailable, using cached outstanding udhar:", err);
    if (isBrowser) {
      const cached = localStorage.getItem("outstanding_udhar");
      if (cached) return JSON.parse(cached);
    }
    return [];
  }
}

export async function fetchAllPledges(): Promise<PledgeEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/pledges`);
    if (!res.ok) throw new Error("Server error");
    const data: PledgeEntry[] = await res.json();
    if (isBrowser) {
      localStorage.setItem("pooja_all_pledges", JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.warn("Backend unavailable, using cached pledges:", err);
    if (isBrowser) {
      const cached = localStorage.getItem("pooja_all_pledges");
      if (cached) return JSON.parse(cached);
    }
    return [];
  }
}

export async function fetchAllSoldItems(): Promise<SoldItem[]> {
  try {
    const res = await fetch(`${API_BASE}/sold-items`);
    if (!res.ok) throw new Error("Server error");
    const data: SoldItem[] = await res.json();
    if (isBrowser) {
      localStorage.setItem("pooja_all_sold_items", JSON.stringify(data));
    }
    return data;
  } catch (err) {
    console.warn("Backend unavailable, using cached sold items:", err);
    if (isBrowser) {
      const cached = localStorage.getItem("pooja_all_sold_items");
      if (cached) return JSON.parse(cached);
    }
    return [];
  }
}

export async function updatePledgeEntry(pledgeId: number, data: Partial<PledgeEntry>, dateStr: string): Promise<boolean> {
  if (isBrowser) {
    if (data.date && data.date !== dateStr) {
      localStorage.removeItem(`daybook_${dateStr}`);
      localStorage.removeItem(`daybook_${data.date}`);
    } else {
      const cachedDaybook = localStorage.getItem(`daybook_${dateStr}`);
      if (cachedDaybook) {
        try {
          const db: DayBook = JSON.parse(cachedDaybook);
          db.pledge_entries = db.pledge_entries.map(p => p.id === pledgeId ? { ...p, ...data } : p);
          localStorage.setItem(`daybook_${dateStr}`, JSON.stringify(db));
        } catch (e) {
          console.error(e);
        }
      }
    }
    const allPledges = localStorage.getItem("pooja_all_pledges");
    if (allPledges) {
      try {
        const list: PledgeEntry[] = JSON.parse(allPledges);
        const updated = list.map(p => p.id === pledgeId ? { ...p, ...data } : p);
        localStorage.setItem("pooja_all_pledges", JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
    }
  }

  if (pledgeId < 0) return true;

  try {
    const res = await fetch(`${API_BASE}/pledge/${pledgeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function revertPledgeRelease(pledgeId: number): Promise<boolean> {
  if (isBrowser) {
    localStorage.removeItem("pooja_all_pledges");
  }
  if (pledgeId < 0) return true;

  try {
    const res = await fetch(`${API_BASE}/pledge/${pledgeId}/revert-release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface BarcodeItem {
  metal: "GOLD" | "SILVER";
  itemName: string;
  purity: string;
  qty: number;
  weight: number;
  huid?: string;
}

export async function fetchBarcodeItem(barcodeNo: string): Promise<{ found: boolean; is_sold?: boolean; sold_date?: string; item?: BarcodeItem }> {
  try {
    const res = await fetch(`${API_BASE}/barcode/${encodeURIComponent(barcodeNo.trim())}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.warn("Failed to fetch barcode item:", e.message || e);
  }
  return { found: false };
}


// --- Purchase Party / Supplier API Wrapper ---

export interface PurchaseParty {
  id: number;
  name: string;
  phone: string;
  gstin: string;
  opening_balance_cash: number;
  opening_balance_gold: number;
  opening_balance_silver: number;
  address: string;
  created_at: string;
  outstanding_cash: number;
  outstanding_gold: number;
  outstanding_silver: number;
}

export interface PartyTransaction {
  id: string;
  date: string;
  type: "bill" | "payment";
  reference: string;
  details: string;
  amount: number;
  pure_weight: number;
  metal: string;
  is_rate_cut: boolean;
  rate?: number;
}

export interface SupplierPaymentCreate {
  amount: number;
  payment_mode: "CASH" | "UPI" | "OTHER";
  date: string;
  remarks?: string;
  is_rate_cut?: boolean;
  rate?: number;
  metal?: "GOLD" | "SILVER";
}


export async function fetchPurchaseParties(): Promise<PurchaseParty[]> {
  try {
    const res = await fetch(`${API_BASE}/purchase/parties`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.error("Failed to fetch purchase parties:", e.message || e);
  }
  return [];
}

export async function createPurchaseParty(party: Omit<PurchaseParty, "id" | "outstanding_cash" | "outstanding_gold" | "outstanding_silver" | "created_at">): Promise<PurchaseParty | null> {
  try {
    const res = await fetch(`${API_BASE}/purchase/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(party),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.error("Failed to create purchase party:", e.message || e);
  }
  return null;
}

export async function fetchPartyTransactions(partyName: string): Promise<PartyTransaction[]> {
  try {
    const res = await fetch(`${API_BASE}/purchase/parties/${encodeURIComponent(partyName.trim())}/transactions`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.error("Failed to fetch party transactions:", e.message || e);
  }
  return [];
}

export async function recordPartyPayment(partyName: string, payment: SupplierPaymentCreate): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/purchase/parties/${encodeURIComponent(partyName.trim())}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.error("Failed to record party payment:", e.message || e);
  }
  return null;
}

export async function deleteDebitEntry(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/debit/${id}`, {
      method: "DELETE"
    });
    return res.ok;
  } catch (e: any) {
    console.error("Failed to delete debit entry:", e.message || e);
    return false;
  }
}

export async function convertDebitToRateCut(id: number, rate: number, metal: "GOLD" | "SILVER"): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/debit/${id}/convert-rate-cut`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rate, metal }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.error("Failed to convert debit to rate cut:", e.message || e);
  }
  return null;
}

export async function revertDebitRateCut(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/debit/${id}/revert-rate-cut`, {
      method: "POST",
    });
    return res.ok;
  } catch (e: any) {
    console.error("Failed to revert debit rate cut:", e.message || e);
    return false;
  }
}

export async function updatePurchaseParty(id: number, party: Omit<PurchaseParty, "id" | "outstanding_cash" | "outstanding_gold" | "outstanding_silver" | "created_at">): Promise<PurchaseParty | null> {
  try {
    const res = await fetch(`${API_BASE}/purchase/parties/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(party)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.error("Failed to update purchase party:", e.message || e);
  }
  return null;
}

export async function deletePurchaseParty(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/purchase/parties/${id}`, {
      method: "DELETE"
    });
    return res.ok;
  } catch (e: any) {
    console.error("Failed to delete purchase party:", e.message || e);
    return false;
  }
}

export interface SystemLog {
  id: number;
  timestamp: string;
  action: string;
  details: string;
  module?: string;
  user_name?: string;
}

export interface SystemLogEntry extends SystemLog {}

export interface BackupSnapshot {
  filename: string;
  timestamp: string;
  size_bytes: number;
  mtime: number;
}

export async function createDatabaseSnapshot(): Promise<{ success: boolean; filename: string; message: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/backup/create`, { method: "POST" });
    if (res.ok) return await res.json();
  } catch (e: any) {
    console.error("Failed to create snapshot:", e);
  }
  return null;
}

export async function fetchBackupsList(): Promise<BackupSnapshot[]> {
  try {
    const res = await fetch(`${API_BASE}/backup/list`);
    if (res.ok) return await res.json();
  } catch (e: any) {
    console.error("Failed to fetch backups list:", e);
  }
  return [];
}

export async function fetchSystemLogs(params?: { limit?: number; module?: string; action?: string; search?: string } | string): Promise<SystemLog[]> {
  try {
    let query = new URLSearchParams();
    if (typeof params === "object") {
      if (params?.limit) query.append("limit", params.limit.toString());
      if (params?.module) query.append("module", params.module);
      if (params?.action) query.append("action", params.action);
      if (params?.search) query.append("search", params.search);
    } else if (typeof params === "string") {
      query.append("password", params);
    }

    const res = await fetch(`${API_BASE}/system-logs?${query.toString()}`);
    if (res.ok) return await res.json();
  } catch (e: any) {
    console.error("Failed to fetch system logs:", e);
  }
  return [];
}

export async function downloadDatabaseBackup(password?: string): Promise<void> {
  const url = `${API_BASE}/backup/download`;
  window.open(url, "_blank");
}

export async function restoreDatabaseBackup(file: File | string, maybeFile?: File): Promise<{ success: boolean; message: string } | any> {
  try {
    const targetFile = file instanceof File ? file : maybeFile;
    if (!targetFile) return { success: false, message: "No file provided" };
    const formData = new FormData();
    formData.append("file", targetFile);
    const res = await fetch(`${API_BASE}/backup/restore`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) return await res.json();
  } catch (e: any) {
    console.error("Failed to restore backup:", e);
  }
  return null;
}

export async function addPledgePayment(
  pledgeId: number,
  payment: { payment_type: "INTEREST" | "PRINCIPAL" | "TOP_UP"; amount: number; payment_method: string; date: string }
): Promise<PledgePayment | null> {
  try {
    const res = await fetch(`${API_BASE}/pledge/${pledgeId}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payment),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.error("Failed to add pledge payment:", e.message || e);
  }
  return null;
}

export async function deletePledgePayment(paymentId: number): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/pledge-payment/${paymentId}`, {
      method: "DELETE",
    });
    return res.ok;
  } catch (e: any) {
    console.error("Failed to delete pledge payment:", e.message || e);
    return false;
  }
}

export interface AavakJaavakItem {

  id: string;
  date: string;
  flow_type: "TAKEN" | "GIVEN";
  category: string;
  party_name: string;
  particulars: string;
  mode: string;
  mode_key: string;
  amount: number;
  principal?: number;
  interest?: number;
  is_udhar?: boolean;
}

export interface AavakJaavakReport {
  summary: {
    total_taken: number;
    total_given: number;
    net_flow: number;
    interest_taken: number;
    interest_given: number;
    net_interest: number;
    count: number;
  };
  items: AavakJaavakItem[];
}

export async function fetchAavakJaavakReport(params?: {
  startDate?: string;
  endDate?: string;
  flowType?: string;
  paymentMode?: string;
  category?: string;
  search?: string;
  udharFilter?: string;
}): Promise<AavakJaavakReport | null> {
  try {
    const query = new URLSearchParams();
    if (params?.startDate) query.append("start_date", params.startDate);
    if (params?.endDate) query.append("end_date", params.endDate);
    if (params?.flowType) query.append("flow_type", params.flowType);
    if (params?.paymentMode) query.append("payment_mode", params.paymentMode);
    if (params?.category) query.append("category", params.category);
    if (params?.search) query.append("search", params.search);
    if (params?.udharFilter) query.append("udhar_filter", params.udharFilter);

    const res = await fetch(`${API_BASE}/reports/aavak-jaavak?${query.toString()}`);
    if (res.ok) {
      return await res.json();
    }

  } catch (e: any) {
    console.error("Failed to fetch Aavak-Jaavak report:", e.message || e);
  }
  return null;
}

export async function sendBackendWhatsAppPdfInvoice(data: {
  invoice_no: string;
  book_no?: string;
  date: string;
  customer_name: string;
  phone?: string;
  address?: string;
  items: Array<{ name: string; weight?: number; qty?: number; amount: number }>;
  total_amount: number;
  message?: string;
}): Promise<{ status: string; file_name: string; download_url: string; phone: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/whatsapp/send-pdf-bill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    console.info("Backend PDF service info:", e.message || e);
  }
  return null;
}

