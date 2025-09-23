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


def get_role_db_connection(user_role: str):
    """
    Get a database connection to the role-specific SQLite database.
    If the role DB does not exist, it will be created.
    """
    safe_role = (user_role or "Customer Analyst").replace(" ", "_")
    role_dir = APP_ROOT / "custom_roles"
    role_dir.mkdir(parents=True, exist_ok=True)
    role_db_path = role_dir / f"{safe_role}.db"
    conn = sqlite3.connect(str(role_db_path))
    conn.row_factory = sqlite3.Row
    return conn
