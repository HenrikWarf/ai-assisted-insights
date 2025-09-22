"""
Database schema for Action entities.

This module provides database operations for managing detailed action entities
that users can explore, save, and manage in their workspace.
"""

import sqlite3
import json
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Database file path
DB_PATH = "data/cfc.db"


def create_action_tables():
    """Create the action-related tables if they don't exist."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Actions table - stores detailed action entities
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_id TEXT UNIQUE NOT NULL,
                priority_id TEXT NOT NULL,
                grid_type TEXT NOT NULL,
                user_role TEXT NOT NULL,
                action_title TEXT NOT NULL,
                action_description TEXT NOT NULL,
                action_type TEXT DEFAULT 'recommended',
                priority_level INTEGER DEFAULT 1,
                estimated_effort TEXT,
                estimated_impact TEXT,
                gemini_context TEXT,
                next_steps TEXT,
                notes TEXT,
                is_saved_to_workspace BOOLEAN DEFAULT FALSE,
                created_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Action notes table - stores user notes for actions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS action_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_id TEXT NOT NULL,
                user_role TEXT NOT NULL,
                note_content TEXT NOT NULL,
                created_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (action_id) REFERENCES actions (action_id) ON DELETE CASCADE
            )
        """)
        
        # Action shares table - stores shared action information
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS action_shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_id TEXT NOT NULL,
                user_role TEXT NOT NULL,
                share_token TEXT UNIQUE NOT NULL,
                share_url TEXT,
                expires_at TIMESTAMP,
                created_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (action_id) REFERENCES actions (action_id) ON DELETE CASCADE
            )
        """)
        
        # Workspace actions table - tracks actions saved to user workspace
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workspace_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action_id TEXT NOT NULL,
                user_role TEXT NOT NULL,
                saved_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (action_id) REFERENCES actions (action_id) ON DELETE CASCADE,
                UNIQUE(action_id, user_role)
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info("Action tables created successfully")
        
    except Exception as e:
        logger.error(f"Error creating action tables: {e}")
        raise


def create_action(action_id: str, priority_id: str, grid_type: str, user_role: str,
                 action_title: str, action_description: str, action_type: str = 'recommended',
                 priority_level: int = 1, estimated_effort: str = None, 
                 estimated_impact: str = None, gemini_context: str = None,
                 next_steps: str = None) -> int:
    """
    Create a new action entity.
    
    Args:
        action_id (str): Unique identifier for the action
        priority_id (str): Associated priority ID
        grid_type (str): Grid type (short-term/long-term)
        user_role (str): User role
        action_title (str): Action title
        action_description (str): Action description
        action_type (str): Type of action (recommended, custom, etc.)
        priority_level (int): Priority level (1-3)
        estimated_effort (str): Estimated effort level
        estimated_impact (str): Estimated impact level
        gemini_context (str): Gemini-generated context
        next_steps (str): Recommended next steps
        
    Returns:
        int: The created action's database ID
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO actions (
                action_id, priority_id, grid_type, user_role, action_title,
                action_description, action_type, priority_level, estimated_effort,
                estimated_impact, gemini_context, next_steps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            action_id, priority_id, grid_type, user_role, action_title,
            action_description, action_type, priority_level, estimated_effort,
            estimated_impact, gemini_context, next_steps
        ))
        
        action_db_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"Created action {action_id} for priority {priority_id}")
        return action_db_id
        
    except Exception as e:
        logger.error(f"Error creating action: {e}")
        raise


def get_action(action_id: str, user_role: str) -> Optional[Dict[str, Any]]:
    """
    Get a specific action by ID.
    
    Args:
        action_id (str): Action ID
        user_role (str): User role
        
    Returns:
        dict: Action data or None if not found
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM actions 
            WHERE action_id = ? AND user_role = ?
        """, (action_id, user_role))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, row))
        
        return None
        
    except Exception as e:
        logger.error(f"Error getting action: {e}")
        raise


def update_action(action_id: str, user_role: str, **kwargs) -> bool:
    """
    Update an action with new data.
    
    Args:
        action_id (str): Action ID
        user_role (str): User role
        **kwargs: Fields to update
        
    Returns:
        bool: True if updated successfully
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Build update query dynamically
        update_fields = []
        values = []
        
        for key, value in kwargs.items():
            if key in ['action_title', 'action_description', 'action_type', 
                      'priority_level', 'estimated_effort', 'estimated_impact',
                      'gemini_context', 'next_steps', 'notes', 'is_saved_to_workspace']:
                update_fields.append(f"{key} = ?")
                values.append(value)
        
        if not update_fields:
            conn.close()
            return False
        
        # Add updated timestamp
        update_fields.append("updated_ts = CURRENT_TIMESTAMP")
        values.extend([action_id, user_role])
        
        query = f"""
            UPDATE actions 
            SET {', '.join(update_fields)}
            WHERE action_id = ? AND user_role = ?
        """
        
        cursor.execute(query, values)
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        return success
        
    except Exception as e:
        logger.error(f"Error updating action: {e}")
        raise


def add_action_note(action_id: str, user_role: str, note_content: str) -> int:
    """
    Add a note to an action.
    
    Args:
        action_id (str): Action ID
        user_role (str): User role
        note_content (str): Note content
        
    Returns:
        int: Note ID
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO action_notes (action_id, user_role, note_content)
            VALUES (?, ?, ?)
        """, (action_id, user_role, note_content))
        
        note_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"Added note to action {action_id}")
        return note_id
        
    except Exception as e:
        logger.error(f"Error adding action note: {e}")
        raise


def get_action_notes(action_id: str, user_role: str) -> List[Dict[str, Any]]:
    """
    Get all notes for an action.
    
    Args:
        action_id (str): Action ID
        user_role (str): User role
        
    Returns:
        list: List of note dictionaries
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM action_notes 
            WHERE action_id = ? AND user_role = ?
            ORDER BY created_ts DESC
        """, (action_id, user_role))
        
        rows = cursor.fetchall()
        conn.close()
        
        columns = [description[0] for description in cursor.description]
        return [dict(zip(columns, row)) for row in rows]
        
    except Exception as e:
        logger.error(f"Error getting action notes: {e}")
        raise


def delete_action_note(note_id: int, user_role: str) -> bool:
    """
    Delete an action note.
    
    Args:
        note_id (int): Note ID
        user_role (str): User role
        
    Returns:
        bool: True if deleted successfully
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM action_notes 
            WHERE id = ? AND user_role = ?
        """, (note_id, user_role))
        
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        return success
        
    except Exception as e:
        logger.error(f"Error deleting action note: {e}")
        raise


def save_action_to_workspace(action_id: str, user_role: str) -> bool:
    """
    Save an action to the user's workspace.
    
    Args:
        action_id (str): Action ID
        user_role (str): User role
        
    Returns:
        bool: True if saved successfully
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Insert into workspace_actions table
        cursor.execute("""
            INSERT OR IGNORE INTO workspace_actions (action_id, user_role)
            VALUES (?, ?)
        """, (action_id, user_role))
        
        # Update the action's saved status
        cursor.execute("""
            UPDATE actions 
            SET is_saved_to_workspace = TRUE, updated_ts = CURRENT_TIMESTAMP
            WHERE action_id = ? AND user_role = ?
        """, (action_id, user_role))
        
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        logger.info(f"Saved action {action_id} to workspace for {user_role}")
        return success
        
    except Exception as e:
        logger.error(f"Error saving action to workspace: {e}")
        raise


def get_workspace_actions(user_role: str) -> List[Dict[str, Any]]:
    """
    Get all actions saved to the user's workspace.
    
    Args:
        user_role (str): User role
        
    Returns:
        list: List of action dictionaries
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT a.*, wa.saved_ts as workspace_saved_ts
            FROM actions a
            JOIN workspace_actions wa ON a.action_id = wa.action_id
            WHERE a.user_role = ? AND wa.user_role = ?
            ORDER BY wa.saved_ts DESC
        """, (user_role, user_role))
        
        rows = cursor.fetchall()
        conn.close()
        
        columns = [description[0] for description in cursor.description]
        return [dict(zip(columns, row)) for row in rows]
        
    except Exception as e:
        logger.error(f"Error getting workspace actions: {e}")
        raise


def create_action_share(action_id: str, user_role: str, expires_days: int = 30) -> Dict[str, Any]:
    """
    Create a shareable link for an action.
    
    Args:
        action_id (str): Action ID
        user_role (str): User role
        expires_days (int): Days until expiration
        
    Returns:
        dict: Share information including token and URL
    """
    try:
        import uuid
        from datetime import datetime, timedelta
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Generate unique share token
        share_token = str(uuid.uuid4())
        expires_at = datetime.now() + timedelta(days=expires_days)
        share_url = f"/shared-action/{share_token}"
        
        cursor.execute("""
            INSERT INTO action_shares (action_id, user_role, share_token, share_url, expires_at)
            VALUES (?, ?, ?, ?, ?)
        """, (action_id, user_role, share_token, share_url, expires_at))
        
        share_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"Created share for action {action_id}")
        return {
            "share_id": share_id,
            "share_token": share_token,
            "share_url": share_url,
            "expires_at": expires_at.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error creating action share: {e}")
        raise


def get_shared_action(share_token: str) -> Optional[Dict[str, Any]]:
    """
    Get an action by share token.
    
    Args:
        share_token (str): Share token
        
    Returns:
        dict: Action data or None if not found/expired
    """
    try:
        from datetime import datetime
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT a.*, as_share.expires_at
            FROM actions a
            JOIN action_shares as_share ON a.action_id = as_share.action_id
            WHERE as_share.share_token = ? AND as_share.expires_at > ?
        """, (share_token, datetime.now()))
        
        row = cursor.fetchone()
        conn.close()
        
        if row:
            columns = [description[0] for description in cursor.description]
            return dict(zip(columns, row))
        
        return None
        
    except Exception as e:
        logger.error(f"Error getting shared action: {e}")
        raise


def delete_action(action_id: str, user_role: str) -> bool:
    """
    Delete an action and all related data.
    
    Args:
        action_id (str): Action ID
        user_role (str): User role
        
    Returns:
        bool: True if deleted successfully
    """
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Delete action (cascades to notes and shares)
        cursor.execute("""
            DELETE FROM actions 
            WHERE action_id = ? AND user_role = ?
        """, (action_id, user_role))
        
        success = cursor.rowcount > 0
        conn.commit()
        conn.close()
        
        logger.info(f"Deleted action {action_id}")
        return success
        
    except Exception as e:
        logger.error(f"Error deleting action: {e}")
        raise
