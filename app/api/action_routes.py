"""
API routes for Action entities and Explore Action feature.

This module provides REST API endpoints for managing detailed action entities,
including exploration, notes, sharing, and workspace management.
"""

from flask import Blueprint, request, jsonify, session
from app.database.action_schema import (
    create_action_tables,
    create_action,
    get_action,
    update_action,
    add_action_note,
    get_action_notes,
    delete_action_note,
    save_action_to_workspace,
    get_workspace_actions,
    create_action_share,
    get_shared_action,
    delete_action
)
from services.action_service import (
    generate_action_context_with_search,
    generate_action_next_steps
)
import json
import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

# Create blueprint
action_bp = Blueprint('actions', __name__)


@action_bp.route('/api/actions/explore', methods=['POST'])
def api_explore_action():
    """Create a detailed action entity from a recommended action."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        action_data = data.get('action_data')
        
        if not priority_id or not grid_type or not action_data:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Ensure tables exist
        create_action_tables()
        
        # Generate unique action ID
        action_id = str(uuid.uuid4())
        
        # Generate Gemini context with Google Search grounding
        context_result = generate_action_context_with_search(
            action_title=action_data.get('action_title', ''),
            action_description=action_data.get('action_description', ''),
            priority_title=data.get('priority_title', ''),
            priority_description=data.get('priority_description', ''),
            user_role=session["role"]
        )
        
        # Generate next steps
        next_steps = generate_action_next_steps(
            action_title=action_data.get('action_title', ''),
            action_description=action_data.get('action_description', ''),
            context_data=context_result.get('context_content', ''),
            user_role=session["role"]
        )
        
        # Create the action entity
        action_db_id = create_action(
            action_id=action_id,
            priority_id=priority_id,
            grid_type=grid_type,
            user_role=session["role"],
            action_title=action_data.get('action_title', ''),
            action_description=action_data.get('action_description', ''),
            action_type='explored',
            priority_level=action_data.get('priority_level', 1),
            estimated_effort=action_data.get('estimated_effort'),
            estimated_impact=action_data.get('estimated_impact'),
            gemini_context=context_result.get('context_content'),
            next_steps=next_steps
        )
        
        # Get the created action
        action = get_action(action_id, session["role"])
        
        return jsonify({
            "success": True,
            "action": action,
            "action_id": action_id,
            "context": context_result,
            "next_steps": next_steps
        })
        
    except Exception as e:
        logger.error(f"Error exploring action: {e}")
        return jsonify({"error": "Failed to explore action"}), 500


@action_bp.route('/api/actions/<action_id>', methods=['GET'])
def api_get_action(action_id):
    """Get a specific action by ID."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Ensure tables exist
        create_action_tables()
        
        action = get_action(action_id, session["role"])
        
        if not action:
            return jsonify({"error": "Action not found"}), 404
        
        # Get action notes
        notes = get_action_notes(action_id, session["role"])
        action['notes'] = notes
        
        return jsonify({
            "success": True,
            "action": action
        })
        
    except Exception as e:
        logger.error(f"Error getting action: {e}")
        return jsonify({"error": "Failed to get action"}), 500


@action_bp.route('/api/actions/<action_id>/notes', methods=['POST'])
def api_add_action_note(action_id):
    """Add a note to an action."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        note_content = data.get('note_content')
        
        if not note_content:
            return jsonify({"error": "Note content is required"}), 400
        
        # Ensure tables exist
        create_action_tables()
        
        # Add note
        note_id = add_action_note(action_id, session["role"], note_content)
        
        # Get updated notes
        notes = get_action_notes(action_id, session["role"])
        
        return jsonify({
            "success": True,
            "note_id": note_id,
            "notes": notes
        })
        
    except Exception as e:
        logger.error(f"Error adding action note: {e}")
        return jsonify({"error": "Failed to add note"}), 500


@action_bp.route('/api/actions/<action_id>/notes/<int:note_id>', methods=['DELETE'])
def api_delete_action_note(action_id, note_id):
    """Delete an action note."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Ensure tables exist
        create_action_tables()
        
        # Delete note
        success = delete_action_note(note_id, session["role"])
        
        if not success:
            return jsonify({"error": "Note not found"}), 404
        
        # Get updated notes
        notes = get_action_notes(action_id, session["role"])
        
        return jsonify({
            "success": True,
            "notes": notes
        })
        
    except Exception as e:
        logger.error(f"Error deleting action note: {e}")
        return jsonify({"error": "Failed to delete note"}), 500


@action_bp.route('/api/actions/<action_id>/save', methods=['POST'])
def api_save_action_to_workspace(action_id):
    """Save an action to the user's workspace."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Ensure tables exist
        create_action_tables()
        
        # Save to workspace
        success = save_action_to_workspace(action_id, session["role"])
        
        if not success:
            return jsonify({"error": "Action not found"}), 404
        
        return jsonify({
            "success": True,
            "message": "Action saved to workspace"
        })
        
    except Exception as e:
        logger.error(f"Error saving action to workspace: {e}")
        return jsonify({"error": "Failed to save action"}), 500


@action_bp.route('/api/actions/workspace', methods=['GET'])
def api_get_workspace_actions():
    """Get all actions saved to the user's workspace."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Ensure tables exist
        create_action_tables()
        
        # Get workspace actions
        actions = get_workspace_actions(session["role"])
        
        return jsonify({
            "success": True,
            "actions": actions
        })
        
    except Exception as e:
        logger.error(f"Error getting workspace actions: {e}")
        return jsonify({"error": "Failed to get workspace actions"}), 500


@action_bp.route('/api/actions/<action_id>/share', methods=['POST'])
def api_create_action_share(action_id):
    """Create a shareable link for an action."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        expires_days = data.get('expires_days', 30)
        
        # Ensure tables exist
        create_action_tables()
        
        # Create share
        share_info = create_action_share(action_id, session["role"], expires_days)
        
        return jsonify({
            "success": True,
            "share": share_info
        })
        
    except Exception as e:
        logger.error(f"Error creating action share: {e}")
        return jsonify({"error": "Failed to create share"}), 500


@action_bp.route('/api/actions/shared/<share_token>', methods=['GET'])
def api_get_shared_action(share_token):
    """Get a shared action by token."""
    try:
        # Ensure tables exist
        create_action_tables()
        
        # Get shared action
        action = get_shared_action(share_token)
        
        if not action:
            return jsonify({"error": "Shared action not found or expired"}), 404
        
        # Get action notes
        notes = get_action_notes(action['action_id'], action['user_role'])
        action['notes'] = notes
        
        return jsonify({
            "success": True,
            "action": action
        })
        
    except Exception as e:
        logger.error(f"Error getting shared action: {e}")
        return jsonify({"error": "Failed to get shared action"}), 500


@action_bp.route('/api/actions/<action_id>', methods=['DELETE'])
def api_delete_action(action_id):
    """Delete an action."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Ensure tables exist
        create_action_tables()
        
        # Delete action
        success = delete_action(action_id, session["role"])
        
        if not success:
            return jsonify({"error": "Action not found"}), 404
        
        return jsonify({
            "success": True,
            "message": "Action deleted successfully"
        })
        
    except Exception as e:
        logger.error(f"Error deleting action: {e}")
        return jsonify({"error": "Failed to delete action"}), 500


@action_bp.route('/api/actions/<action_id>/update', methods=['PUT'])
def api_update_action(action_id):
    """Update an action."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        
        # Ensure tables exist
        create_action_tables()
        
        # Update action
        success = update_action(action_id, session["role"], **data)
        
        if not success:
            return jsonify({"error": "Action not found"}), 404
        
        # Get updated action
        action = get_action(action_id, session["role"])
        
        return jsonify({
            "success": True,
            "action": action
        })
        
    except Exception as e:
        logger.error(f"Error updating action: {e}")
        return jsonify({"error": "Failed to update action"}), 500
