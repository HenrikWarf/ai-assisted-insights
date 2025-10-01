import sqlite3
import os
from pathlib import Path

def migrate():
    """
    Applies database migrations to all custom role databases.
    """
    custom_roles_dir = Path('custom_roles')
    db_files = custom_roles_dir.glob('*.db')
    
    for db_path in db_files:
        print(f"Migrating database: {db_path}...")
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.cursor()
            
            # Migration: Add priority_level to saved_actions
            try:
                cursor.execute("ALTER TABLE saved_actions ADD COLUMN priority_level INTEGER;")
                print(f"  - Added priority_level column to saved_actions in {db_path}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e):
                    print(f"  - priority_level column already exists in {db_path}. Skipping.")
                else:
                    raise
            
            conn.commit()
            conn.close()
            print(f"Successfully migrated {db_path}")
            
        except Exception as e:
            print(f"Error migrating {db_path}: {e}")

if __name__ == '__main__':
    migrate()
