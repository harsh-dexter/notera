import os
import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, text # Import text
from sqlalchemy.orm import sessionmaker, Session # Import Session for type hinting
from sqlalchemy.ext.declarative import declarative_base

# Define the path to the database file within the db_data directory
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'db_data')
if not os.path.exists(DB_DIR):
    os.makedirs(DB_DIR)

SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(DB_DIR, 'fluent_notes.db')}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False} # check_same_thread only needed for SQLite
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Helper to get a DB session (useful for background tasks or direct use) ---
def get_db_session() -> Session:
    """Creates and returns a new SQLAlchemy session."""
    return SessionLocal()

Base = declarative_base()

# Define the Meeting model
class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(String, primary_key=True, index=True) # Using job_id as primary key
    filename = Column(String, index=True)
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="processing") # Added status field
    transcript = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    action_items = Column(Text, nullable=True) # Storing as JSON string
    decisions = Column(Text, nullable=True) # Storing as JSON string
    languages = Column(Text, nullable=True) # Storing as JSON string array of ISO 639-1 codes
    pdf_path = Column(String, nullable=True) # Path to the generated PDF

# Function to create tables
def create_db_and_tables():
    Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

print("SQLAlchemy Database module initialized.")
print(f"Database URL: {SQLALCHEMY_DATABASE_URL}")


# Function to setup FTS table and triggers using raw SQL
def setup_fts(db_engine):
    """Creates the FTS5 table and synchronization triggers if they don't exist."""
    # Use a connection from the engine to execute raw SQL
    with db_engine.connect() as connection:
        # Create FTS5 table
        connection.execute(text(f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS meetings_fts USING fts5(
                id UNINDEXED, -- Match the main table's primary key name
                transcript,
                content='meetings', -- Link to the main table
                content_rowid='rowid' -- Use rowid for linking
            );
        """)) # Wrap in text()
        # Trigger after INSERT on meetings
        connection.execute(text(f"""
            CREATE TRIGGER IF NOT EXISTS meetings_ai AFTER INSERT ON meetings BEGIN
                INSERT INTO meetings_fts (rowid, id, transcript) VALUES (new.rowid, new.id, new.transcript);
            END;
        """)) # Wrap in text()
        # Trigger after DELETE on meetings
        connection.execute(text(f"""
            CREATE TRIGGER IF NOT EXISTS meetings_ad AFTER DELETE ON meetings BEGIN
                DELETE FROM meetings_fts WHERE rowid=old.rowid;
            END;
        """)) # Wrap in text()
        # Trigger after UPDATE on meetings
        connection.execute(text(f"""
            CREATE TRIGGER IF NOT EXISTS meetings_au AFTER UPDATE ON meetings BEGIN
                UPDATE meetings_fts SET transcript = new.transcript WHERE rowid=old.rowid;
            END;
        """)) # Wrap in text()
        print("FTS table and triggers checked/created.")
