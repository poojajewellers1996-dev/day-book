from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from .config import engine, Base, get_db
from . import models, schemas, crud

# Initialize database schemas
Base.metadata.create_all(bind=engine)

# ─── SECURITY & AUTHENTICATION UTILITIES ───
import hashlib
import secrets
import base64
import hmac
import json
import time

SECRET_KEY = "pooja-jewellers-super-secret-key-that-is-extremely-secure"
GLOBAL_TIME_OFFSET_SECONDS = 0.0

def get_real_ist_now():
    from datetime import datetime, timezone, timedelta
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    now_ts = time.time() + GLOBAL_TIME_OFFSET_SECONDS
    return datetime.fromtimestamp(now_ts, tz=ist_tz)

def hash_password(password: str, salt: bytes = None) -> str:
    if salt is None:
        salt = secrets.token_bytes(16)
    kdf = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{kdf.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_str, key_str = hashed.split(":")
        salt = bytes.fromhex(salt_str)
        key = bytes.fromhex(key_str)
        kdf = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return secrets.compare_digest(kdf, key)
    except Exception:
        return False

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")

def base64url_decode(data: str) -> bytes:
    padding = "=" * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

def create_access_token(subject: str, session_id: Optional[str] = None, expires_in: int = 86400) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": subject,
        "exp": int(time.time()) + expires_in
    }
    if session_id:
        payload["sid"] = session_id
    header_b64 = base64url_encode(json.dumps(header).encode("utf-8"))
    payload_b64 = base64url_encode(json.dumps(payload).encode("utf-8"))
    message = f"{header_b64}.{payload_b64}"
    signature = hmac.new(SECRET_KEY.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
    signature_b64 = base64url_encode(signature)
    return f"{message}.{signature_b64}"

def decode_access_token(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        message = f"{header_b64}.{payload_b64}"
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), message.encode("utf-8"), hashlib.sha256).digest()
        expected_sig_b64 = base64url_encode(expected_sig)
        if not hmac.compare_digest(signature_b64, expected_sig_b64):
            return None
        payload = json.loads(base64url_decode(payload_b64).decode("utf-8"))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

# Auto-seed default user "admin" with password "pooja" if not already present
def seed_default_admin():
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        admin_user = db.query(models.SystemUser).filter(models.SystemUser.username == "admin").first()
        if not admin_user:
            default_pw = "pooja"
            hashed = hash_password(default_pw)
            db.add(models.SystemUser(username="admin", password_hash=hashed))
            db.commit()
            print("[Startup] Seeded default admin user successfully.")
    except Exception as e:
        db.rollback()
        print("[Startup] Failed to seed default admin user:", e)
    finally:
        db.close()

seed_default_admin()

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi import Request

security_scheme = HTTPBearer(auto_error=False)

def verify_token_dependency(
    request: Request, 
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: Session = Depends(get_db)
):
    path = request.url.path
    # Bypassed paths
    if path in ["/api/auth/login", "/api/system/run-id", "/api/system/network-time", "/api/system/google-time", "/api/system/open-date-settings", "/api/system/set-time-offset", "/api/live-rates"] or path.startswith("/api/whatsapp"):
        return None
        
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Missing Authorization credentials."
        )
        
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid token. Please log in again."
        )
        
    username = payload.get("sub")
    sid = payload.get("sid")
    if not sid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="SESSION_SUPERSEDED"
        )
        
    if username:
        user = db.query(models.SystemUser).filter(models.SystemUser.username == username).first()
        if user:
            if user.current_session_id != sid:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="SESSION_SUPERSEDED"
                )
            from datetime import datetime
            user.last_active_at = datetime.utcnow()
            try:
                db.commit()
            except Exception:
                db.rollback()
                
    return payload


# Daily Automated Backup System
def start_backup_scheduler():
    import threading
    import shutil
    import datetime
    import time
    import os

    def backup_loop():
        # Delay initial run slightly to not slow down start
        time.sleep(15)
        while True:
            try:
                base_dir = os.path.dirname(os.path.abspath(__file__))
                db_path = os.path.join(base_dir, "..", "database.db")
                backups_dir = os.path.join(base_dir, "..", "backups")
                if not os.path.exists(backups_dir):
                    os.makedirs(backups_dir)
                
                if os.path.exists(db_path):
                    today_str = datetime.datetime.now().strftime("%Y-%m-%d")
                    backup_filename = f"db_backup_{today_str}.db"
                    backup_file_path = os.path.join(backups_dir, backup_filename)
                    
                    shutil.copy2(db_path, backup_file_path)
                    print(f"[Backup Scheduler] Created daily backup: {backup_filename}")
                    
                    backup_files = [
                        os.path.join(backups_dir, f) for f in os.listdir(backups_dir)
                        if f.startswith("db_backup_") and f.endswith(".db")
                    ]
                    backup_files.sort(key=os.path.getmtime)
                    if len(backup_files) > 14:
                        to_remove = backup_files[:-14]
                        for f in to_remove:
                            try:
                                os.remove(f)
                                print(f"[Backup Scheduler] Rotated out old backup: {os.path.basename(f)}")
                              
                            except Exception as ree:
                                print(f"[Backup Scheduler] Failed to delete old backup {f}: {ree}")
            except Exception as e:
                print(f"[Backup Scheduler] Error during backup: {e}")
            # Run every 24 hours
            time.sleep(86400)

    t = threading.Thread(target=backup_loop, daemon=True)
    t.start()

start_backup_scheduler()

app = FastAPI(
    title="Pooja Jewellers Pledge Monitor API",
    description="Backend API for Pooja Jewellers Girvi & Bank Re-pledges",
    version="1.0.0",
    dependencies=[Depends(verify_token_dependency)]
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://day-book-five.vercel.app"
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import uuid
SERVER_RUN_ID = str(uuid.uuid4())

def log_system_action(db: Session, action: str, details: str, module: str = "GENERAL"):
    try:
        import datetime
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db_log = models.SystemLog(timestamp=now_str, action=action, details=details, module=module)
        db.add(db_log)
        db.commit()
    except Exception as e:
        print(f"[Error Logging Action] {action}: {details}. Error: {e}")

@app.get("/api/system/run-id")
def get_run_id():
    return {"run_id": SERVER_RUN_ID}

@app.get("/api/system/google-time")
def get_google_time():
    """Check both system time and Google/network time to detect any time alterations."""
    import urllib.request
    import email.utils
    import json
    from datetime import datetime, timezone

    google_timestamp = None
    source = "google"

    # 1. Fetch Google HTTP Date header
    try:
        req = urllib.request.Request("https://www.google.com", headers={"User-Agent": "Mozilla/5.0"}, method="HEAD")
        with urllib.request.urlopen(req, timeout=3) as resp:
            date_header = resp.headers.get("Date")
            if date_header:
                parsed_tuple = email.utils.parsedate_tz(date_header)
                if parsed_tuple:
                    dt = email.utils.mktime_tz(parsed_tuple)
                    google_timestamp = int(dt * 1000)
    except Exception as e:
        print("[Time Check] Google time fetch failed:", e)

    # 2. Fallback to timeapi.io if Google HTTP header was unreachable
    if not google_timestamp:
        try:
            req = urllib.request.Request("https://timeapi.io/api/v1/time/current/zone?timeZone=Asia/Kolkata", headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode())
                if "date_time" in data:
                    source = "timeapi.io"
                    dt = datetime.fromisoformat(data["date_time"])
                    google_timestamp = int(dt.timestamp() * 1000)
        except Exception as e:
            print("[Time Check] timeapi.io fetch failed:", e)

    # 3. Fallback to WorldTimeAPI if Google and timeapi.io were unreachable
    if not google_timestamp:
        try:
            req = urllib.request.Request("https://worldtimeapi.org/api/timezone/Asia/Kolkata", headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode())
                if "datetime" in data:
                    source = "worldtimeapi"
                    dt = datetime.fromisoformat(data["datetime"].replace("Z", "+00:00"))
                    google_timestamp = int(dt.timestamp() * 1000)
        except Exception as e:
            print("[Time Check] WorldTimeAPI fetch failed:", e)

    system_timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)

    if google_timestamp:
        diff_seconds = abs(google_timestamp - system_timestamp) / 1000.0
        mismatch = diff_seconds > 60  # > 1 minute difference
        return {
            "success": True,
            "google_timestamp": google_timestamp,
            "system_timestamp": system_timestamp,
            "diff_seconds": diff_seconds,
            "diff_minutes": round(diff_seconds / 60.0, 1),
            "source": source,
            "mismatch": mismatch
        }
    else:
        return {
            "success": False,
            "google_timestamp": system_timestamp,
            "system_timestamp": system_timestamp,
            "diff_seconds": 0,
            "diff_minutes": 0,
            "source": "fallback_system",
            "mismatch": False
        }

@app.post("/api/system/open-date-settings")
def open_date_settings():
    """Launch Windows Date & Time Settings directly on the device."""
    import os, platform
    try:
        if platform.system() == "Windows":
            os.system("start ms-settings:dateandtime")
            return {"success": True, "message": "Opened Windows Date & Time Settings"}
        else:
            return {"success": False, "message": "Only supported on Windows"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/auth/login")
def login(payload: dict, db: Session = Depends(get_db)):
    username = payload.get("username", "admin") or "admin"
    password = payload.get("password")
    force = payload.get("force", False)
    
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
        
    user = db.query(models.SystemUser).filter(models.SystemUser.username == username).first()
    if not user:
        user = db.query(models.SystemUser).filter(models.SystemUser.username == "admin").first()
        
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
        
    is_valid = verify_password(password, user.password_hash)
    if not is_valid:
        if user.username == "admin" and password == "pooja123":
            if verify_password("pooja", user.password_hash):
                is_valid = True
                
    if not is_valid:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )
        
    from datetime import datetime, timedelta
    import uuid
    
    now = datetime.utcnow()
    is_session_active = False
    if user.current_session_id and user.last_active_at:
        last_active = user.last_active_at
        if isinstance(last_active, str):
            try:
                clean_str = last_active.split(".")[0]
                last_active = datetime.strptime(clean_str, "%Y-%m-%d %H:%M:%S")
            except Exception:
                last_active = now - timedelta(minutes=5)
        try:
            if (now - last_active) < timedelta(minutes=2):
                is_session_active = True
        except Exception:
            pass
            
    if is_session_active and not force:
        return {"status": "session_active", "message": "Another device is currently logged in."}
        
    new_sid = str(uuid.uuid4())
    user.current_session_id = new_sid
    user.last_active_at = now
    db.commit()
        
    token = create_access_token(user.username, session_id=new_sid)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/dashboard/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    active_pledges = db.query(models.PledgeEntry).filter(models.PledgeEntry.status == "ACTIVE").all()
    released_pledges = db.query(models.PledgeEntry).filter(models.PledgeEntry.status == "RELEASED").all()
    
    outstanding_girvi = sum(p.amount for p in active_pledges)
    active_girvi_count = len(active_pledges)
    
    total_released_girvi_amount = sum(p.amount for p in released_pledges)
    total_released_girvi_count = len(released_pledges)
    
    repledged_active = [p for p in active_pledges if p.is_repledged == 1]
    total_repledged_amount = sum(p.repledged_amount or 0.0 for p in repledged_active)
    total_repledged_count = len(repledged_active)
    
    active_gold_wt_safe = 0.0
    active_gold_wt_bank = 0.0
    active_silver_wt_safe = 0.0
    active_silver_wt_bank = 0.0
    
    for p in active_pledges:
        is_silver_1 = any(x in (p.ornament or "").lower() for x in ["silver", "chandi", "sil"])
        w1 = p.net_weight or p.weight or 0.0
        w2 = p.net_weight_2 or 0.0
        w3 = p.net_weight_3 or 0.0
        
        if p.is_repledged == 1:
            if is_silver_1:
                active_silver_wt_bank += w1
            else:
                active_gold_wt_bank += w1
                
            if p.ornament_2:
                is_silver_2 = any(x in p.ornament_2.lower() for x in ["silver", "chandi", "sil"])
                if is_silver_2:
                    active_silver_wt_bank += w2
                else:
                    active_gold_wt_bank += w2
                    
            if p.ornament_3:
                is_silver_3 = any(x in p.ornament_3.lower() for x in ["silver", "chandi", "sil"])
                if is_silver_3:
                    active_silver_wt_bank += w3
                else:
                    active_gold_wt_bank += w3
        else:
            if is_silver_1:
                active_silver_wt_safe += w1
            else:
                active_gold_wt_safe += w1
                
            if p.ornament_2:
                is_silver_2 = any(x in p.ornament_2.lower() for x in ["silver", "chandi", "sil"])
                if is_silver_2:
                    active_silver_wt_safe += w2
                else:
                    active_gold_wt_safe += w2
                    
            if p.ornament_3:
                is_silver_3 = any(x in p.ornament_3.lower() for x in ["silver", "chandi", "sil"])
                if is_silver_3:
                    active_silver_wt_safe += w3
                else:
                    active_gold_wt_safe += w3

    due_pledges = [p for p in active_pledges if p.due_date]
    due_pledges.sort(key=lambda x: x.due_date)
    
    upcoming_due_pledges = []
    for p in due_pledges[:10]:
        upcoming_due_pledges.append({
            "id": p.id,
            "pledge_no": p.pledge_no,
            "customer_name": p.customer_name,
            "amount": p.amount,
            "due_date": p.due_date,
            "mobile": p.mobile,
            "ornament": p.ornament,
            "weight": p.weight
        })
        
    logs = db.query(models.SystemLog).order_by(models.SystemLog.id.desc()).limit(5).all()
    recent_logs = []
    for l in logs:
        recent_logs.append({
            "id": l.id,
            "timestamp": l.timestamp,
            "action": l.action,
            "details": l.details,
            "module": l.module
        })
        
    # Calculate monthly trends (last 6 months)
    from datetime import date
    from collections import defaultdict

    monthly_data = defaultdict(lambda: {"principal": 0.0, "count": 0})
    all_pledges = db.query(models.PledgeEntry).all()
    for p in all_pledges:
        if p.date:
            try:
                ym = p.date[:7] # YYYY-MM
                monthly_data[ym]["principal"] += p.amount
                monthly_data[ym]["count"] += 1
            except Exception:
                pass

    today = date.today()
    monthly_trends = []
    for i in range(5, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        ym = f"{y:04d}-{m:02d}"
        temp_date = date(y, m, 1)
        label = temp_date.strftime("%b %y")
        monthly_trends.append({
            "month_key": ym,
            "label": label,
            "principal": monthly_data[ym]["principal"],
            "count": monthly_data[ym]["count"]
        })

    return {
        "outstanding_girvi": outstanding_girvi,
        "active_girvi_count": active_girvi_count,
        "total_released_girvi_amount": total_released_girvi_amount,
        "total_released_girvi_count": total_released_girvi_count,
        "total_repledged_amount": total_repledged_amount,
        "total_repledged_count": total_repledged_count,
        "active_gold_wt_safe": active_gold_wt_safe,
        "active_gold_wt_bank": active_gold_wt_bank,
        "active_silver_wt_safe": active_silver_wt_safe,
        "active_silver_wt_bank": active_silver_wt_bank,
        "upcoming_due_pledges": upcoming_due_pledges,
        "recent_logs": recent_logs,
        "monthly_trends": monthly_trends
    }


# ─── PLEDGES CRUD ROUTES ───

@app.get("/api/pledges", response_model=List[schemas.PledgeEntry])
def get_all_pledges(db: Session = Depends(get_db)):
    return crud.get_pledges(db)

@app.get("/api/pledges/{entry_id}", response_model=schemas.PledgeEntry)
def get_pledge(entry_id: int, db: Session = Depends(get_db)):
    res = crud.get_pledge_entry(db, entry_id)
    if not res:
        raise HTTPException(status_code=404, detail="Pledge entry not found")
    return res

@app.post("/api/pledges", response_model=schemas.PledgeEntry)
def add_pledge_entry(entry: schemas.PledgeEntryCreate, db: Session = Depends(get_db)):
    res = crud.create_pledge_entry(db, entry)
    log_system_action(db, "PLEDGE_CREATE", f"Added Pledge: {entry.customer_name} | {entry.ornament} | Wt: {entry.weight}g | ₹{entry.amount}", module="GIRVI")
    return res

@app.put("/api/pledge/{entry_id}", response_model=schemas.PledgeEntry)
def update_pledge_entry(entry_id: int, entry_update: schemas.PledgeEntryUpdate, db: Session = Depends(get_db)):
    res = crud.update_pledge_entry(db, entry_id, entry_update)
    if not res:
        raise HTTPException(status_code=404, detail="Pledge entry not found")
    log_system_action(db, "PLEDGE_UPDATE", f"Updated Pledge #{res.pledge_no}: {res.customer_name} | {res.ornament} | ₹{res.amount}", module="GIRVI")
    return res

@app.delete("/api/pledge/{entry_id}")
def delete_pledge_entry(entry_id: int, db: Session = Depends(get_db)):
    db_entry = crud.get_pledge_entry(db, entry_id)
    if not db_entry:
        raise HTTPException(status_code=404, detail="Pledge entry not found")
    details = f"Deleted Pledge: {db_entry.customer_name} | {db_entry.ornament} | Wt: {db_entry.weight}g | ₹{db_entry.amount}"
    crud.delete_pledge_entry(db, entry_id)
    log_system_action(db, "PLEDGE_DELETE", details, module="GIRVI")
    return {"message": "Pledge entry deleted"}


# ─── PLEDGE PAYMENTS ROUTES ───

@app.post("/api/pledge/{pledge_id}/payment", response_model=schemas.PledgePayment)
def add_pledge_payment(pledge_id: int, entry: schemas.PledgePaymentCreate, db: Session = Depends(get_db)):
    pledge = crud.get_pledge_entry(db, pledge_id)
    if not pledge:
        raise HTTPException(status_code=404, detail="Pledge not found")
    res = crud.create_pledge_payment(db, entry, pledge_id)
    if entry.payment_type == "TOP_UP":
        pledge.amount += entry.amount
        db.commit()
    log_system_action(db, "PLEDGE_PAYMENT_CREATE", f"Recorded {entry.payment_type} Payment of ₹{entry.amount} for Pledge {pledge.pledge_no} via {entry.payment_method}", module="GIRVI")
    return res

@app.delete("/api/pledge-payment/{payment_id}")
def delete_pledge_payment(payment_id: int, db: Session = Depends(get_db)):
    payment = db.query(models.PledgePayment).filter(models.PledgePayment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    pledge = payment.pledge
    if payment.payment_type == "TOP_UP" and pledge:
        pledge.amount -= payment.amount
        db.commit()
    pledge_no = pledge.pledge_no if pledge else "Unknown"
    amount = payment.amount
    crud.delete_pledge_payment(db, payment_id)
    log_system_action(db, "PLEDGE_PAYMENT_DELETE", f"Deleted payment of ₹{amount} for Pledge {pledge_no}", module="GIRVI")
    return {"message": "Payment deleted successfully"}


# ─── REVERT RELEASE ROUTE ───

@app.post("/api/pledge/{pledge_id}/revert-release", response_model=schemas.PledgeEntry)
def revert_pledge_release(pledge_id: int, db: Session = Depends(get_db)):
    db_entry = crud.get_pledge_entry(db, pledge_id)
    if not db_entry:
        raise HTTPException(status_code=404, detail="Pledge entry not found")
    if db_entry.status != "RELEASED":
        raise HTTPException(status_code=400, detail="Pledge is not in RELEASED status")
    db_entry.status = "ACTIVE"
    db_entry.release_date = None
    db.commit()
    db.refresh(db_entry)
    log_system_action(db, "PLEDGE_REVERT_RELEASE", f"Reverted release for Pledge #{db_entry.pledge_no} ({db_entry.customer_name}) back to ACTIVE", module="GIRVI")
    return db_entry


# ─── Live Gold & Silver rates Bangalore scraper ───

LIVE_RATES_CACHE = {
    "gold_24k": "14,433",
    "gold_22k": "13,230",
    "gold_18k": "10,825",
    "silver": "2,45,000",
    "last_updated": 0
}

@app.get("/api/live-rates")
def get_live_rates():
    global LIVE_RATES_CACHE
    import urllib.request
    import re
    now = time.time()
    if now - LIVE_RATES_CACHE["last_updated"] > 3600:
        url = "https://www.goodreturns.in/gold-rates/bangalore.html"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                html = response.read().decode('utf-8')
                
                match_24 = re.search(r'&#x20b9;([\d,]+)</strong>\s*per gram for 24 karat gold', html, re.IGNORECASE)
                match_22 = re.search(r'&#x20b9;([\d,]+)</strong>\s*per gram for 22 karat gold', html, re.IGNORECASE)
                match_18 = re.search(r'&#x20b9;([\d,]+)</strong>\s*per gram for 18 karat gold', html, re.IGNORECASE)
                match_silver = re.search(r'<span class="label">Silver</span>\s*<span class="value">[^<]*?([\d,]+)\s*/\s*kg', html, re.IGNORECASE)
                
                if match_24:
                    LIVE_RATES_CACHE["gold_24k"] = match_24.group(1)
                if match_22:
                    LIVE_RATES_CACHE["gold_22k"] = match_22.group(1)
                if match_18:
                    LIVE_RATES_CACHE["gold_18k"] = match_18.group(1)
                if match_silver:
                    LIVE_RATES_CACHE["silver"] = match_silver.group(1)
                    
                LIVE_RATES_CACHE["last_updated"] = now
        except Exception as e:
            print("Failed to fetch live rates, using cached/default rates:", e)
            
    return {
        "gold_24k": LIVE_RATES_CACHE["gold_24k"],
        "gold_22k": LIVE_RATES_CACHE["gold_22k"],
        "gold_18k": LIVE_RATES_CACHE["gold_18k"],
        "silver": LIVE_RATES_CACHE["silver"]
    }


# ─── TIME SYNC AND OFFSET ───

class TimeOffsetRequest(BaseModel):
    offset_seconds: float

@app.post("/api/system/set-time-offset")
def set_time_offset(body: TimeOffsetRequest):
    global GLOBAL_TIME_OFFSET_SECONDS
    GLOBAL_TIME_OFFSET_SECONDS = body.offset_seconds
    now_ist = get_real_ist_now()
    return {
        "status": "ok",
        "offset_seconds": GLOBAL_TIME_OFFSET_SECONDS,
        "current_ist": now_ist.isoformat(),
        "date": now_ist.strftime("%Y-%m-%d"),
        "time": now_ist.strftime("%H:%M:%S")
    }

@app.get("/api/system/network-time")
def get_network_time():
    global GLOBAL_TIME_OFFSET_SECONDS
    import urllib.request
    import json
    from email.utils import parsedate_to_datetime
    from datetime import datetime, timezone, timedelta
    ist_tz = timezone(timedelta(hours=5, minutes=30))

    for head_url in ["https://www.google.com", "https://cloudflare.com", "https://api.github.com"]:
        try:
            req = urllib.request.Request(head_url, headers={"User-Agent": "Mozilla/5.0"}, method="HEAD")
            with urllib.request.urlopen(req, timeout=3) as resp:
                date_hdr = resp.headers.get("Date")
                if date_hdr:
                    gmt_dt = parsedate_to_datetime(date_hdr)
                    ist_dt = gmt_dt.astimezone(ist_tz)
                    date_str = ist_dt.strftime("%Y-%m-%d")
                    time_str = ist_dt.strftime("%H:%M:%S")
                    real_ts = ist_dt.timestamp()
                    GLOBAL_TIME_OFFSET_SECONDS = real_ts - time.time()
                    return {
                        "source": f"http_header ({head_url})",
                        "date": date_str,
                        "time": time_str,
                        "iso": ist_dt.isoformat(),
                        "timestamp": int(real_ts * 1000)
                    }
        except Exception:
            pass

    now_ist = get_real_ist_now()
    date_str = now_ist.strftime("%Y-%m-%d")
    time_str = now_ist.strftime("%H:%M:%S")
    return {
        "source": "server_ist" if GLOBAL_TIME_OFFSET_SECONDS == 0 else "server_ist_offset",
        "date": date_str,
        "time": time_str,
        "iso": now_ist.isoformat(),
        "timestamp": int(now_ist.timestamp() * 1000)
    }


# ─── BACKUP AND RESTORE ENDPOINTS ───

@app.get("/api/backup/download")
def download_database_backup(db: Session = Depends(get_db)):
    import os
    from datetime import datetime
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, "..", "database.db")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found")
    
    timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    filename = f"girvi_backup_{timestamp}.db"
    log_system_action(db, "BACKUP_DOWNLOAD", f"User downloaded database backup file: {filename}", module="BACKUP")
    return FileResponse(db_path, filename=filename, media_type="application/x-sqlite3")

@app.post("/api/backup/create")
def create_manual_backup(db: Session = Depends(get_db)):
    import os, shutil
    from datetime import datetime
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, "..", "database.db")
    backups_dir = os.path.join(base_dir, "..", "backups")
    if not os.path.exists(backups_dir):
        os.makedirs(backups_dir)
    
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found")
    
    now = datetime.now()
    timestamp_str = now.strftime("%Y-%m-%d_%H%M%S")
    backup_filename = f"db_manual_backup_{timestamp_str}.db"
    backup_file_path = os.path.join(backups_dir, backup_filename)
    
    shutil.copy2(db_path, backup_file_path)
    size_bytes = os.path.getsize(backup_file_path)
    log_system_action(db, "BACKUP_CREATE", f"Manual snapshot created: {backup_filename} ({round(size_bytes/1024, 1)} KB)", module="BACKUP")
    
    return {
        "success": True,
        "filename": backup_filename,
        "timestamp": now.strftime("%Y-%m-%d %H:%M:%S"),
        "size_bytes": size_bytes,
        "message": f"Snapshot created: {backup_filename}"
    }

@app.get("/api/backup/list")
def list_backups():
    import os
    from datetime import datetime
    base_dir = os.path.dirname(os.path.abspath(__file__))
    backups_dir = os.path.join(base_dir, "..", "backups")
    if not os.path.exists(backups_dir):
        return []
    
    files = []
    for f in os.listdir(backups_dir):
        if f.endswith(".db"):
            fpath = os.path.join(backups_dir, f)
            mtime = os.path.getmtime(fpath)
            size = os.path.getsize(fpath)
            dt_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
            files.append({
                "filename": f,
                "timestamp": dt_str,
                "size_bytes": size,
                "mtime": mtime
            })
    files.sort(key=lambda x: x["mtime"], reverse=True)
    return files

@app.post("/api/backup/restore")
async def restore_database_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import os, shutil
    from datetime import datetime
    if not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a valid .db SQLite database file.")
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(base_dir, "..", "database.db")
    backups_dir = os.path.join(base_dir, "..", "backups")
    if not os.path.exists(backups_dir):
        os.makedirs(backups_dir)
    
    safety_filename = f"pre_restore_safety_{datetime.now().strftime('%Y-%m-%d_%H%M%S')}.db"
    safety_path = os.path.join(backups_dir, safety_filename)
    if os.path.exists(db_path):
        shutil.copy2(db_path, safety_path)
    
    temp_path = os.path.join(backups_dir, "temp_restore.db")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    db.close()
    shutil.copy2(temp_path, db_path)
    if os.path.exists(temp_path):
        os.remove(temp_path)
    
    log_system_action(db, "BACKUP_RESTORE", f"Database restored from uploaded file: {file.filename}", module="BACKUP")
    return {
        "success": True,
        "message": f"Database successfully restored from {file.filename}! Safety snapshot saved as {safety_filename}."
    }


# ─── SYSTEM AUDIT LOG ENDPOINT ───

@app.get("/api/system-logs")
def get_system_logs(
    limit: int = 100,
    module: Optional[str] = None,
    action: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.SystemLog)
    if module and module != "ALL":
        query = query.filter(models.SystemLog.module == module)
    if action and action != "ALL":
        query = query.filter(models.SystemLog.action == action)
    if search:
        s = f"%{search}%"
        query = query.filter(
            (models.SystemLog.details.like(s)) |
            (models.SystemLog.action.like(s))
        )
    query = query.order_by(models.SystemLog.id.desc()).limit(limit)
    return query.all()
