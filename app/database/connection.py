"""
Database connection utilities.

This module handles SQLite database connections and configuration.
"""

import sqlite3
from pathlib import Path

# Database configuration
APP_ROOT = Path(__file__).parent.parent.parent.resolve()
DATA_DIR = APP_ROOT / "data"
DB_PATH = DATA_DIR / "cfc.db"


def get_db_connection():
    """
    Get a database connection to the SQLite database.
    
    Creates the data directory if it doesn't exist and returns a connection
    with row factory set to sqlite3.Row for easier data access.
    
    Returns:
        sqlite3.Connection: Database connection with row factory configured
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn
