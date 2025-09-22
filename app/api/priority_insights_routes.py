"""
API routes for Priority Insights and Explore & Act feature.

This module provides REST API endpoints for managing priority insights,
notes, and action recommendations.
"""

from flask import Blueprint, request, jsonify, session
from app.database.priority_insights_schema import (
    create_priority_insights_tables,
    get_priority_insights,
    save_priority_insights,
    get_priority_notes,
    add_priority_note,
    get_priority_actions,
    add_priority_action,
    delete_priority_data,
    get_priority_summary,
    save_priority_analysis,
    get_saved_analyses,
    delete_saved_analysis
)
from services.priority_insights_service import (
    generate_priority_insights_with_search,
    generate_action_recommendations,
    get_priority_summary as get_service_summary
)
import json
import logging

logger = logging.getLogger(__name__)

# Create blueprint
priority_insights_bp = Blueprint('priority_insights', __name__)


@priority_insights_bp.route('/api/priority-insights/summary', methods=['POST'])
def api_priority_summary():
    """Get summary of all data for a priority."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        
        if not priority_id or not grid_type:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Ensure tables exist
        create_priority_insights_tables()
        
        # Get summary data
        summary = get_service_summary(priority_id, grid_type, session["role"])
        
        return jsonify({
            "success": True,
            "summary": summary
        })
        
    except Exception as e:
        logger.error(f"Error getting priority summary: {e}")
        return jsonify({"error": "Internal server error"}), 500


@priority_insights_bp.route('/api/priority-insights/generate', methods=['POST'])
def api_generate_insights():
    """Generate insights for a priority using Gemini with Google Search grounding."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        priority_data = data.get('priority_data')
        
        if not priority_id or not grid_type or not priority_data:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Ensure tables exist
        create_priority_insights_tables()
        
        # Extract priority information
        priority_title = priority_data.get('title', 'Untitled Priority')
        priority_description = priority_data.get('why', '')
        priority_category = priority_data.get('category', 'general')
        
        # Generate insights
        insights_result = generate_priority_insights_with_search(
            priority_title, priority_description, priority_category, session["role"]
        )
        
        # Save insights to database
        insight_id = save_priority_insights(
            priority_id=priority_id,
            grid_type=grid_type,
            priority_title=priority_title,
            priority_data=json.dumps(priority_data),
            insights_content=insights_result["insights_content"],
            search_grounding_data=insights_result["search_grounding_data"],
            user_role=session["role"]
        )
        
        # Get updated insights
        insights = get_priority_insights(priority_id, grid_type, session["role"])
        
        return jsonify({
            "success": True,
            "insights": insights,
            "insight_id": insight_id
        })
        
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        return jsonify({"error": "Failed to generate insights"}), 500


@priority_insights_bp.route('/api/priority-insights/actions', methods=['POST'])
def api_generate_actions():
    """Generate action recommendations for a priority."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        priority_data = data.get('priority_data')
        
        if not priority_id or not grid_type or not priority_data:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Ensure tables exist
        create_priority_insights_tables()
        
        # Extract priority information
        priority_title = priority_data.get('title', 'Untitled Priority')
        priority_description = priority_data.get('why', '')
        priority_category = priority_data.get('category', 'general')
        
        # Get existing actions to avoid duplicates
        existing_actions = get_priority_actions(priority_id, grid_type, session["role"])
        
        # Generate action recommendations
        actions = generate_action_recommendations(
            priority_title, priority_description, priority_category, 
            session["role"], existing_actions
        )
        
        # Save actions to database
        saved_actions = []
        for action in actions:
            action_id = add_priority_action(
                priority_id=priority_id,
                grid_type=grid_type,
                user_role=session["role"],
                action_title=action.get('title', ''),
                action_description=action.get('description', ''),
                action_type='recommended',
                priority_level=action.get('priority_level', 1),
                estimated_effort=action.get('estimated_effort'),
                estimated_impact=action.get('estimated_impact')
            )
            saved_actions.append(action_id)
        
        # Get updated actions
        updated_actions = get_priority_actions(priority_id, grid_type, session["role"])
        
        return jsonify({
            "success": True,
            "actions": updated_actions,
            "saved_count": len(saved_actions)
        })
        
    except Exception as e:
        logger.error(f"Error generating actions: {e}")
        return jsonify({"error": "Failed to generate actions"}), 500


@priority_insights_bp.route('/api/priority-insights/notes', methods=['POST'])
def api_add_note():
    """Add a note to a priority."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        note_content = data.get('note_content')
        
        if not priority_id or not grid_type or not note_content:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Ensure tables exist
        create_priority_insights_tables()
        
        # Add note
        note_id = add_priority_note(priority_id, grid_type, session["role"], note_content)
        
        # Get updated notes
        notes = get_priority_notes(priority_id, grid_type, session["role"])
        
        return jsonify({
            "success": True,
            "note_id": note_id,
            "notes": notes
        })
        
    except Exception as e:
        logger.error(f"Error adding note: {e}")
        return jsonify({"error": "Failed to add note"}), 500


@priority_insights_bp.route('/api/priority-insights/clear', methods=['POST'])
def api_clear_priority_data():
    """Clear all data for a priority."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        
        if not priority_id or not grid_type:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Ensure tables exist
        create_priority_insights_tables()
        
        # Clear data
        delete_priority_data(priority_id, session["role"])
        
        return jsonify({
            "success": True,
            "message": "Priority data cleared successfully"
        })
        
    except Exception as e:
        logger.error(f"Error clearing priority data: {e}")
        return jsonify({"error": "Failed to clear data"}), 500


@priority_insights_bp.route('/api/priority-insights/status', methods=['GET'])
def api_priority_insights_status():
    """Get status of the Priority Insights feature."""
    try:
        # Check if tables exist and are accessible
        create_priority_insights_tables()
        
        return jsonify({
            "success": True,
            "status": "active",
            "features": {
                "insights_generation": True,
                "action_recommendations": True,
                "notes_management": True,
                "data_persistence": True
            }
        })
        
    except Exception as e:
        logger.error(f"Error checking priority insights status: {e}")
        return jsonify({
            "success": False,
            "status": "error",
            "error": str(e)
        }), 500


@priority_insights_bp.route('/api/priority-insights/save', methods=['POST'])
def api_save_priority_analysis():
    """Save a complete priority analysis."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        priority_data = data.get('priority_data')
        
        if not priority_id or not grid_type or not priority_data:
            return jsonify({"error": "Missing required fields"}), 400
        
        # Ensure tables exist
        create_priority_insights_tables()
        
        # Get current data
        insights = get_priority_insights(priority_id, grid_type, session["role"])
        actions = get_priority_actions(priority_id, grid_type, session["role"])
        notes = get_priority_notes(priority_id, grid_type, session["role"])
        
        # Prepare data for saving
        insights_content = insights["insights_content"] if insights else None
        actions_data = json.dumps(actions) if actions else None
        notes_data = json.dumps(notes) if notes else None
        
        # Save the analysis
        analysis_id = save_priority_analysis(
            priority_id=priority_id,
            grid_type=grid_type,
            priority_title=priority_data.get('title', 'Unknown Priority'),
            priority_data=json.dumps(priority_data),
            insights_content=insights_content,
            actions_data=actions_data,
            notes_data=notes_data,
            user_role=session["role"]
        )
        
        return jsonify({
            "success": True,
            "analysis_id": analysis_id,
            "message": "Priority analysis saved successfully"
        })
        
    except Exception as e:
        logger.error(f"Error saving priority analysis: {e}")
        return jsonify({"error": "Failed to save priority analysis"}), 500


@priority_insights_bp.route('/api/priority-insights/saved', methods=['GET'])
def api_get_saved_analyses():
    """Get all saved priority analyses for the current user."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Ensure tables exist
        create_priority_insights_tables()
        
        # Get saved analyses
        analyses = get_saved_analyses(session["role"])
        
        return jsonify({
            "success": True,
            "analyses": analyses
        })
        
    except Exception as e:
        logger.error(f"Error getting saved analyses: {e}")
        return jsonify({"error": "Failed to get saved analyses"}), 500


@priority_insights_bp.route('/api/priority-insights/saved/<int:analysis_id>', methods=['DELETE'])
def api_delete_saved_analysis(analysis_id):
    """Delete a saved priority analysis."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Ensure tables exist
        create_priority_insights_tables()
        
        # Delete analysis
        success = delete_saved_analysis(analysis_id, session["role"])
        
        if success:
            return jsonify({"success": True, "message": "Analysis deleted successfully"})
        else:
            return jsonify({"error": "Analysis not found or could not be deleted"}), 404
        
    except Exception as e:
        logger.error(f"Error deleting saved analysis: {e}")
        return jsonify({"error": "Failed to delete analysis"}), 500
