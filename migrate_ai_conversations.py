#!/usr/bin/env python3
"""
Migration script to add ai_conversations column to action tables.

This script adds the ai_conversations column to both saved_actions and proposed_actions tables
in all role-specific databases.
"""

import sqlite3
import json
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_database(db_path):
    """Add ai_conversations column to a specific database."""
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if column already exists in saved_actions
        cursor.execute("PRAGMA table_info(saved_actions)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'ai_conversations' not in columns:
            logger.info(f"Adding ai_conversations column to saved_actions in {db_path}")
            cursor.execute("ALTER TABLE saved_actions ADD COLUMN ai_conversations TEXT DEFAULT '{}'")
        else:
            logger.info(f"ai_conversations column already exists in saved_actions in {db_path}")
        
        # Check if column already exists in proposed_actions
        cursor.execute("PRAGMA table_info(proposed_actions)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'ai_conversations' not in columns:
            logger.info(f"Adding ai_conversations column to proposed_actions in {db_path}")
            cursor.execute("ALTER TABLE proposed_actions ADD COLUMN ai_conversations TEXT DEFAULT '{}'")
        else:
            logger.info(f"ai_conversations column already exists in proposed_actions in {db_path}")
        
        conn.commit()
        conn.close()
        logger.info(f"Successfully migrated {db_path}")
        
    except Exception as e:
        logger.error(f"Error migrating {db_path}: {e}")

def main():
    """Run migration on all role databases."""
    # Find all .db files in custom_roles directory
    custom_roles_dir = Path("custom_roles")
    
    if not custom_roles_dir.exists():
        logger.error("custom_roles directory not found")
        return
    
    db_files = list(custom_roles_dir.glob("*.db"))
    
    if not db_files:
        logger.warning("No database files found in custom_roles directory")
        return
    
    logger.info(f"Found {len(db_files)} database files to migrate")
    
    for db_file in db_files:
        migrate_database(db_file)
    
    logger.info("Migration completed")

if __name__ == "__main__":
    main()
