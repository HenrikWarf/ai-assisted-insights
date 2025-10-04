"""
API routes for Priority Insights and Explore & Act feature.

This module provides REST API endpoints for managing priority insights,
notes, and action recommendations.
"""

from flask import Blueprint, request, jsonify, session
from app.database.connection import get_db_connection, get_role_db_connection
from services.gemini_service import _generate_json_from_model, generate_chart_insights
import json
import logging
import uuid
import sqlite3
from datetime import datetime
import traceback


logger = logging.getLogger(__name__)

# Create blueprint
priority_insights_bp = Blueprint('priority_insights', __name__)


def _get_user_role() -> str:
    """Resolve user role from session, header, or safe default.

    This prevents 401s during local development when no auth session exists.
    """
    return session.get("role") or request.headers.get("X-Role") or "Customer Analyst"


@priority_insights_bp.route('/api/priority-insights/summary', methods=['POST'])
def api_priority_summary():
    """Get summary of all data for a priority."""
    user_role = _get_user_role()
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        
        if not priority_id or not grid_type:
            return jsonify({"error": "Missing required fields"}), 400
        
        # This service call might still rely on the central DB.
        # This is a candidate for future refactoring.
        # summary = get_service_summary(priority_id, grid_type, user_role)
        summary = {} # Placeholder
        
        return jsonify({
            "success": True,
            "summary": summary
        })
        
    except Exception as e:
        logger.error(f"Error getting priority summary: {e}")
        return jsonify({"error": "Internal server error"}), 500


@priority_insights_bp.route('/api/priority-insights/generate', methods=['POST'])
def api_generate_insights():
    """Generate insights for a priority using Gemini."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        priority_data = data.get('priority_data', {})
        role_name = session.get('user_role', 'default')
        grid_type = data.get('grid_type')

        prompt = f"""
        Analyze the following priority for the '{role_name}' role. 
        This priority is of '{grid_type}' importance. 
        The user needs a deep, insightful analysis of this priority, going beyond the surface-level data. 
        Provide a comprehensive analysis that includes:
        1.  **Root Cause Analysis**: What are the likely underlying reasons for this priority being flagged?
        2.  **Business Impact**: What is the potential impact on the business if this priority is not addressed?
        3.  **Strategic Recommendations**: What are the high-level strategic recommendations to address this priority?
        4.  **Data-Driven Next Steps**: What specific data points or metrics should be investigated next to validate the analysis and recommendations?

        The priority data is:
        {json.dumps(priority_data, indent=2)}

        Based on this, generate a detailed analysis.
        The output should be a single JSON object with one key: "insights_content", which contains the textual analysis as a string.
        """
        
        # The second argument to _generate_json_from_model is for providing structured context,
        # but the detailed prompt already contains all necessary information.
        insights_result = _generate_json_from_model(prompt, '{}')
        
        # Structure the response to match what the frontend's updateInsightsContent function expects
        response_data = {
            "insights_content": insights_result.get("insights_content"),
            "created_ts": datetime.utcnow().isoformat()
        }
        
        return jsonify({
            "success": True,
            "insights": response_data,
            "context_json": insights_result
        })
        
    except Exception as e:
        logger.error(f"Error generating insights: {e}")
        return jsonify({"error": "Failed to generate insights"}), 500


@priority_insights_bp.route('/api/priority-insights/actions', methods=['POST'])
def api_generate_actions():
    """Generate action recommendations for a priority."""
    user_role = _get_user_role()
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        priority_data = data.get('priority_data')
        
        if not priority_id or not grid_type or not priority_data:
            return jsonify({"error": "Missing required fields"}), 400
        
        conn = get_role_db_connection(user_role)
        cursor = conn.cursor()
        
        priority_title = priority_data.get('title', 'Untitled Priority')
        priority_description = priority_data.get('why', '')
        priority_category = priority_data.get('category', 'general')
        
        cursor.execute("SELECT * FROM proposed_actions WHERE priority_id = ? AND grid_type = ?", (priority_id, grid_type))
        existing_actions = cursor.fetchall()

        prompt = f"""
        Act as a senior business strategist providing action recommendations for a '{user_role}'.
        The strategic priority is: "{priority_title}" ({priority_description}).

        Based on this priority, generate a list of 5 distinct, high-impact, and actionable recommendations.

        **For each action, you must provide a JSON object with the following keys:**
        - "action_title": A clear, concise title for the action.
        - "action_description": A brief explanation of what the action entails and why it's important.
        - "priority_level": An integer from 1 (High) to 3 (Low) indicating the urgency and importance.
        - "estimated_effort": A string ('High', 'Medium', 'Low') estimating the resources required.
        - "estimated_impact": A string ('High', 'Medium', 'Low') estimating the potential positive impact on the business.

        Return a single, minified JSON array of these action objects. **Do not include any other keys in the action objects.**

        Example of a valid response format:
        [
            {{
                "action_title": "Launch a targeted marketing campaign",
                "action_description": "Develop and launch a marketing campaign targeting high-value customer segments.",
                "priority_level": 1,
                "estimated_effort": "High",
                "estimated_impact": "High"
            }},
            {{
                "action_title": "Optimize website checkout flow",
                "action_description": "Analyze and improve the user experience of the checkout process to reduce cart abandonment.",
                "priority_level": 1,
                "estimated_effort": "Medium",
                "estimated_impact": "High"
            }}
        ]
        """
        # This context is redundant as the prompt contains the necessary details.
        # Passing an empty object helps the model focus on the instructions.
        gemini_response = _generate_json_from_model(prompt, '{}')
        
        # The model may wrap the list in a dictionary, so we handle that gracefully.
        actions_list = []
        if isinstance(gemini_response, list):
            actions_list = gemini_response
        elif isinstance(gemini_response, dict):
            # Find the first value that is a list and assume it's the actions.
            for value in gemini_response.values():
                if isinstance(value, list):
                    actions_list = value
                    break

        cursor.execute("DELETE FROM proposed_actions WHERE priority_id = ? AND grid_type = ?", (priority_id, grid_type))

        for action in actions_list:
            action_id = f"action_{uuid.uuid4()}"
            action_title = action.get('action_title', 'Untitled Action')
            action_description = action.get('action_description', '')
            
            cursor.execute("""
                INSERT INTO proposed_actions (priority_id, grid_type, action_id, action_title, action_description, action_json)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                priority_id,
                grid_type,
                action_id,
                action_title,
                action_description,
                json.dumps(action)
            ))
        
        conn.commit()

        cursor.execute("SELECT * FROM proposed_actions WHERE priority_id = ? AND grid_type = ?", (priority_id, grid_type))
        rows = cursor.fetchall()
        columns = [description[0] for description in cursor.description]
        updated_actions = [dict(zip(columns, row)) for row in rows]
        
        conn.close()

        return jsonify({
            "success": True,
            "actions": updated_actions,
            "saved_count": len(actions_list)
        })
        
    except Exception as e:
        logger.error(f"Error generating actions: {e}")
        return jsonify({"error": "Failed to generate actions"}), 500


@priority_insights_bp.route('/api/priority-insights/proposed-actions', methods=['GET'])
def api_get_proposed_actions():
    """Get all proposed actions for a given priority."""
    user_role = _get_user_role()
    priority_id = request.args.get('priority_id')
    grid_type = request.args.get('grid_type')

    if not all([user_role, priority_id, grid_type]):
        return jsonify({"error": "Missing required parameters"}), 400

    try:
        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM proposed_actions WHERE priority_id = ? AND grid_type = ?", (priority_id, grid_type))
        rows = cursor.fetchall()
        
        actions = [dict(row) for row in rows]
        conn.close()

        return jsonify({
            "success": True,
            "actions": actions
        })

    except Exception as e:
        logger.error(f"Error getting proposed actions: {e}")
        return jsonify({"error": "Failed to get proposed actions"}), 500


@priority_insights_bp.route('/api/priority-insights/save', methods=['POST'])
def api_save_priority_analysis():
    """Save a complete priority analysis to the role-specific DB."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        priority_data = data.get('priority_data')
        
        if not priority_id or not grid_type or not priority_data:
            return jsonify({"error": "Missing required fields"}), 400
        
        conn = get_role_db_connection(user_role)
        # Set row_factory here to get dict-like rows
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # This is a placeholder for insights. The generation logic needs to be
        # refactored to save insights to the role-specific DB.
        insights_content = data.get('insights_content', None)
        
        cursor.execute("SELECT * FROM proposed_actions WHERE priority_id = ? AND grid_type = ?", (priority_id, grid_type))
        rows = cursor.fetchall()
        actions = [dict(row) for row in rows]
        actions_json = json.dumps(actions) if actions else None

        cursor.execute("""
            INSERT OR REPLACE INTO saved_analyses (priority_id, grid_type, priority_title, priority_data, insights_content, actions_json)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            priority_id,
            grid_type,
            priority_data.get('title', 'Unknown Priority'),
            json.dumps(priority_data),
            insights_content,
            actions_json
        ))
        analysis_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
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
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        conn = get_role_db_connection(user_role)
        # Set row_factory here to get dict-like rows
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM saved_analyses ORDER BY updated_ts DESC")
        rows = cursor.fetchall()
        analyses = [dict(row) for row in rows]
        
        conn.close()
        
        return jsonify({
            "success": True,
            "analyses": analyses
        })
        
    except Exception as e:
        logger.error(f"Error getting saved analyses: {e}")
        return jsonify({"error": "Failed to get saved analyses"}), 500


@priority_insights_bp.route('/api/priority-insights/saved/<int:analysis_id>', methods=['GET'])
def api_get_saved_analysis(analysis_id):
    """Get a specific saved priority analysis from the role-specific DB."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM saved_analyses WHERE id = ?", (analysis_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({"error": "Analysis not found"}), 404
        
        analysis = dict(row)
        
        # Parse JSON fields
        if analysis.get('priority_data'):
            try:
                analysis['priority_data'] = json.loads(analysis['priority_data'])
            except:
                pass
        
        if analysis.get('actions_json'):
            try:
                analysis['actions'] = json.loads(analysis['actions_json'])
            except:
                analysis['actions'] = []
        
        return jsonify({"success": True, "analysis": analysis})
        
    except Exception as e:
        logger.error(f"Error getting saved analysis: {e}")
        return jsonify({"error": "Failed to get analysis"}), 500


@priority_insights_bp.route('/api/priority-insights/saved/<int:analysis_id>', methods=['PUT'])
def api_update_saved_analysis(analysis_id):
    """Update a saved priority analysis in the role-specific DB."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        insights_content = data.get('insights_content')
        
        if not insights_content:
            return jsonify({"error": "Missing insights_content"}), 400
        
        conn = get_role_db_connection(user_role)
        cursor = conn.cursor()
        
        # Update the analysis with insights
        cursor.execute("""
            UPDATE saved_analyses 
            SET insights_content = ?, updated_ts = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (insights_content, analysis_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({"error": "Analysis not found"}), 404
        
        conn.commit()
        conn.close()
        
        logger.info(f"Updated saved analysis {analysis_id} with insights for role {user_role}")
        return jsonify({"success": True, "message": "Analysis updated successfully"})
        
    except Exception as e:
        logger.error(f"Error updating saved analysis: {e}")
        return jsonify({"error": "Failed to update analysis"}), 500


@priority_insights_bp.route('/api/priority-insights/saved/<int:analysis_id>', methods=['DELETE'])
def api_delete_saved_analysis(analysis_id):
    """Delete a saved priority analysis from the role-specific DB."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        conn = get_role_db_connection(user_role)
        cursor = conn.cursor()
        
        # Check if the analysis exists
        cursor.execute("SELECT id FROM saved_analyses WHERE id = ?", (analysis_id,))
        if not cursor.fetchone():
            conn.close()
            return jsonify({"error": "Analysis not found"}), 404
        
        # Delete the analysis
        cursor.execute("DELETE FROM saved_analyses WHERE id = ?", (analysis_id,))
        conn.commit()
        conn.close()
        
        logger.info(f"Deleted saved analysis {analysis_id} for role {user_role}")
        return jsonify({"success": True, "message": "Analysis deleted successfully"})
        
    except Exception as e:
        logger.error(f"Error deleting saved analysis: {e}")
        return jsonify({"error": "Failed to delete analysis"}), 500


@priority_insights_bp.route('/api/priority-insights/notes', methods=['POST'])
def api_add_priority_note():
    """Add a note to a saved priority analysis."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json()
        logger.info(f"Saving priority note. Payload: {data}")
        priority_id = data.get('priority_id')
        grid_type = data.get('grid_type')
        note_text = data.get('note_text')

        if not all([priority_id, grid_type, note_text]):
            return jsonify({"error": "Missing required fields"}), 400

        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute(
            "INSERT INTO priority_notes (priority_id, grid_type, note_text) VALUES (?, ?, ?)",
            (priority_id, grid_type, note_text)
        )
        conn.commit()

        note_id = cursor.lastrowid
        cursor.execute("SELECT * FROM priority_notes WHERE id = ?", (note_id,))
        new_note = cursor.fetchone()

        conn.close()

        return jsonify({"success": True, "note": dict(new_note)}), 201

    except sqlite3.OperationalError as e:
        if 'no such table' in str(e):
             conn.close()
             logger.error(f"Database schema is out of date for role '{user_role}'. Missing 'priority_notes' table.")
             return jsonify({"error": "Database schema is out of date. Please run the migration script."}), 500
        logger.error(f"Database error adding priority note: {e}\n{traceback.format_exc()}")
        return jsonify({"error": "Failed to add note due to a database error"}), 500
    except Exception as e:
        import traceback
        logger.error(f"Error adding priority note: {e}\n{traceback.format_exc()}")
        return jsonify({"error": "Failed to add note"}), 500


@priority_insights_bp.route('/api/priority-insights/notes', methods=['GET'])
def api_get_priority_notes():
    """Get all notes for a saved priority analysis."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
        
    priority_id = request.args.get('priority_id')
    grid_type = request.args.get('grid_type')

    if not all([priority_id, grid_type]):
        return jsonify({"error": "Missing required query parameters"}), 400

    try:
        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute(
            "SELECT * FROM priority_notes WHERE priority_id = ? AND grid_type = ? ORDER BY created_ts ASC",
            (priority_id, grid_type)
        )
        notes = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return jsonify({"success": True, "notes": notes})

    except sqlite3.OperationalError as e:
        # This can happen if the notes table doesn't exist yet, which is not a server error
        if 'no such table' in str(e):
             conn.close()
             return jsonify({"success": True, "notes": []})
        logger.error(f"Database error getting priority notes: {e}")
        return jsonify({"error": "Failed to get notes due to a database error"}), 500
    except Exception as e:
        import traceback
        logger.error(f"Error getting priority notes: {e}\n{traceback.format_exc()}")
        return jsonify({"error": "Failed to get notes"}), 500
