"""
Database schema and operations for role-specific SQLite databases.

This module provides functions to initialize and manage the schema of the
database associated with each custom role.
"""

import sqlite3
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

def initialize_role_db(db_path: Path):
    """
    Initializes the database for a custom role, creating all necessary tables.
    """
    if not db_path.parent.exists():
        db_path.parent.mkdir(parents=True)
        
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Use IF NOT EXISTS to prevent data loss on subsequent runs.
        # The migration script will now handle schema alterations.
        # cursor.execute("DROP TABLE IF EXISTS proposed_actions")
        # cursor.execute("DROP TABLE IF EXISTS saved_analyses")
        # cursor.execute("DROP TABLE IF EXISTS saved_actions")
        # cursor.execute("DROP TABLE IF EXISTS chart_insights")

        # 1. Proposed Actions (from Gemini, transient)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS proposed_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                priority_id TEXT NOT NULL,
                grid_type TEXT NOT NULL,
                action_id TEXT UNIQUE NOT NULL,
                action_title TEXT NOT NULL,
                action_description TEXT,
                gemini_context TEXT,
                next_steps TEXT,
                action_json TEXT,
                created_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # 2. Saved Analyses (Priorities saved by user)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS saved_analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                priority_id TEXT NOT NULL,
                grid_type TEXT NOT NULL,
                priority_title TEXT NOT NULL,
                priority_data TEXT,
                insights_content TEXT,
                actions_json TEXT,
                created_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(priority_id, grid_type)
            )
        """)

        # 3. Saved Actions (Actions saved by user for tracking)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS saved_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_id TEXT UNIQUE NOT NULL,
                priority_id TEXT NOT NULL,
                grid_type TEXT NOT NULL,
                action_title TEXT NOT NULL,
                action_description TEXT,
                status TEXT DEFAULT 'pending',
                estimated_effort TEXT,
                estimated_impact TEXT,
                gemini_context TEXT,
                next_steps TEXT,
                notes TEXT,
                saved_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Application-specific tables from the original design
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS chart_insights (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chart_id TEXT NOT NULL UNIQUE,
                insights_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS action_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_id TEXT NOT NULL,
                note_text TEXT NOT NULL,
                created_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (action_id) REFERENCES saved_actions (action_id) ON DELETE CASCADE
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS priority_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                priority_id TEXT NOT NULL,
                grid_type TEXT NOT NULL,
                note_text TEXT NOT NULL,
                created_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Drop legacy/deprecated tables if they exist. This is safe.
        cursor.execute("DROP TABLE IF EXISTS actions")
        cursor.execute("DROP TABLE IF EXISTS priority_insights")
        cursor.execute("DROP TABLE IF EXISTS analysis_notes")
        # cursor.execute("DROP TABLE IF EXISTS priority_notes") - This was an error

        conn.commit()
        logger.info(f"Successfully initialized and migrated schema for database: {db_path}")

    except Exception as e:
        logger.error(f"Error initializing role database at {db_path}: {e}")
        raise
    finally:
        if conn:
            conn.close()
