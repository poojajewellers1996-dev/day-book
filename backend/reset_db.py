import os
import sys
import hashlib
import secrets
from sqlalchemy import create_engine, MetaData, inspect
from sqlalchemy.orm import sessionmaker

# Add the backend directory to Python path so we can import app modules
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from app.config import Base
from app.models import SystemUser

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    kdf = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}:{kdf.hex()}"

def main():
    db_url = None
    if len(sys.argv) > 1:
        db_url = sys.argv[1]
    else:
        # Check environment variable
        db_url = os.getenv("DATABASE_URL")

    if not db_url:
        print("\033[1;31mError: DATABASE_URL not provided.\033[0m")
        print("Usage: python reset_db.py <DATABASE_URL>")
        print("Example: python reset_db.py \"postgresql://user:pass@ep-hostname.us-east-2.aws.neon.tech/dbname?sslmode=require\"")
        sys.exit(1)

    print(f"\033[1;34mConnecting to database...\033[0m")
    
    # Enable SSL mode requirement for Neon if not explicitly set
    if "neon.tech" in db_url and "sslmode" not in db_url:
        if "?" in db_url:
            db_url += "&sslmode=require"
        else:
            db_url += "?sslmode=require"

    engine = create_engine(db_url)
    
    # 1. Reflect and Drop all existing tables (including old ones not in current schema)
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    if existing_tables:
        print(f"\033[1;33mFound existing tables to drop:\033[0m {existing_tables}")
        # Dropping table without interactive confirmation to let it run smoothly in automated environments
        print("Dropping all tables...")
        meta = MetaData()
        meta.reflect(bind=engine)
        meta.drop_all(bind=engine)
        print("\033[1;32mAll tables dropped successfully.\033[0m")
    else:
        print("No existing tables found.")

    # 2. Recreate only current tables from refactored models
    print("Creating new tables for the Girvi-only schema...")
    Base.metadata.create_all(bind=engine)
    print("\033[1;32mGirvi-only schema tables created successfully.\033[0m")

    # 3. Seed default user username "pooja" / PIN "1996"
    print("Seeding default user credentials...")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        hashed = hash_password("1996")
        pooja_user = SystemUser(username="pooja", password_hash=hashed)
        db.add(pooja_user)
        db.commit()
        print("\033[1;32mUser 'pooja' seeded with default PIN '1996'.\033[0m")
    except Exception as e:
        db.rollback()
        print(f"\033[1;31mError seeding user:\033[0m {e}")
    finally:
        db.close()

    print("\033[1;32mDatabase reset completed successfully!\033[0m")

if __name__ == "__main__":
    main()
