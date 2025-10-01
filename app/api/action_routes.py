"""
API routes for Action entities and Explore Action feature.

This module provides REST API endpoints for managing detailed action entities,
including exploration, notes, sharing, and workspace management.
"""

from flask import Blueprint, request, jsonify, session
from app.database.connection import get_role_db_connection
from services.gemini_service import _generate_json_from_model
from services.action_plan_service import (
    update_task_status_in_db, 
    generate_sql_query_for_task,
    generate_communication_for_task
)
from services.gemini_service import _generate_content_from_model
import json
import logging
import uuid
from datetime import datetime
import sqlite3

logger = logging.getLogger(__name__)

# Create blueprint
action_bp = Blueprint('actions', __name__)


def _get_user_role():
    return session.get("role") or request.headers.get("X-Role") or "Customer Analyst"


@action_bp.route('/api/actions/explore', methods=['POST'])
def api_explore_action():
    """
    Generate context and next steps for a proposed action and save it 
    to the role-specific database.
    """
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        action_id = data.get('action_id')
        action_data = data.get('action_data')
        
        if not action_id or not action_data:
            return jsonify({"error": "Missing required fields"}), 400
        
        prompt = f"""
        Act as a senior business strategist for a '{user_role}'. Your task is to provide a deep analysis of a proposed action related to a strategic priority.

        **Strategic Priority:** '{data.get('priority_title', 'Not specified')}'
        
        **Proposed Action:**
        - **Title:** '{action_data.get('action_title', '')}'
        - **Description:** '{action_data.get('action_description', '')}'

        Your analysis must be comprehensive and structured into a JSON object with two top-level keys: "context" and "next_steps".

        **1. "context" (Object):**
        This object should contain the following keys, each with a detailed string value that uses markdown for formatting:
        - "strategic_alignment": How does this action directly support the parent priority and broader business goals?
        - "market_rationale": What current market trends, competitive pressures, or customer behaviors make this action timely and relevant?
        - "potential_impact": Quantify the expected positive outcomes (e.g., revenue growth, cost savings, market share).
        - "risk_assessment": What are the potential risks or obstacles (e.g., technical challenges, resource constraints, market adoption)?

        **2. "next_steps" (Array of Objects):**
        Provide a list of clear, actionable next steps to operationalize this action. Each step must be an object with the following keys:
        - "id": A unique UUID string for the step.
        - "title": A concise title for the step.
        - "description": A detailed description of the step.
        - "status": The initial status, which must be set to "pending".
        - "sub_tasks": An empty array `[]` where sub-tasks can be added later.
        - "query_generation_enabled": A boolean value (`true` or `false`). Set this to `true` ONLY for steps that involve direct data analysis, validation, or KPI measurement. For all other steps (like stakeholder communication or roadmapping), set it to `false`.
        
        Your response must include at least four distinct steps covering:
        1.  **Data Validation & Analysis:** Initial data work to confirm the hypothesis.
        2.  **KPIs & Measurement:** Specific metrics to measure success.
        3.  **Stakeholder Involvement:** Who needs to be involved.
        4.  **Implementation Roadmap:** High-level phases for rollout.

        Return a single, minified JSON object with ONLY the "context" and "next_steps" keys.
        """
        gemini_response = _generate_json_from_model(prompt, '{}')
        context_content = gemini_response.get('context')
        next_steps = gemini_response.get('next_steps')
        
        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row  # Set row_factory before creating the cursor
        cursor = conn.cursor()
        
        # Check if the action is already saved
        cursor.execute("SELECT 1 FROM saved_actions WHERE action_id = ?", (action_id,))
        is_saved = cursor.fetchone()
        
        target_table = "saved_actions" if is_saved else "proposed_actions"

        # Update the proposed action in the role's database
        cursor.execute(f"""
            UPDATE {target_table}
            SET gemini_context = ?, next_steps = ?, updated_ts = CURRENT_TIMESTAMP
            WHERE action_id = ?
        """, (
            json.dumps(context_content) if context_content else None,
            json.dumps(next_steps) if next_steps else None,
            action_id
        ))
        conn.commit()

        # Get the updated action
        cursor.execute(f"SELECT * FROM {target_table} WHERE action_id = ?", (action_id,))
        action_row = cursor.fetchone()
        
        conn.close()
        
        if not action_row:
            return jsonify({"error": "Action not found after update"}), 404
            
        return jsonify({
            "success": True,
            "action": dict(action_row)
        })
        
    except Exception as e:
        logger.error(f"Error exploring action: {e}")
        return jsonify({"error": "Failed to explore action"}), 500


@action_bp.route('/api/actions/<action_id>', methods=['GET'])
def api_get_action(action_id):
    """Get a specific action by ID from the appropriate table."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        conn = get_role_db_connection(user_role)
        cursor = conn.cursor()

        # Check saved_actions first, then proposed_actions
        cursor.execute("SELECT * FROM saved_actions WHERE action_id = ?", (action_id,))
        row = cursor.fetchone()
        if row:
            source_table = "saved_actions"
        else:
            cursor.execute("SELECT * FROM proposed_actions WHERE action_id = ?", (action_id,))
            row = cursor.fetchone()
            source_table = "proposed_actions"

        if not row:
            conn.close()
            return jsonify({"error": "Action not found"}), 404

        columns = [description[0] for description in cursor.description]
        action = dict(zip(columns, row))
        action['source_table'] = source_table
        
        if source_table == "saved_actions":
            action['notes'] = []

        conn.close()
        
        return jsonify({
            "success": True,
            "action": action
        })
        
    except Exception as e:
        logger.error(f"Error getting action: {e}")
        return jsonify({"error": "Failed to get action"}), 500


@action_bp.route('/api/actions/save', methods=['POST'])
def api_save_action():
    """Save a proposed action to the saved_actions table."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json()
        action_id = data.get('action_id')

        if not action_id:
            return jsonify({"error": "Missing action_id"}), 400

        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM proposed_actions WHERE action_id = ?", (action_id,))
        proposed_action = cursor.fetchone()

        if not proposed_action:
            conn.close()
            return jsonify({"error": "Proposed action not found"}), 404

        action_json = json.loads(proposed_action['action_json']) if proposed_action['action_json'] else {}

        cursor.execute("""
            INSERT OR REPLACE INTO saved_actions (
                action_id, priority_id, grid_type, action_title, action_description,
                status, estimated_effort, estimated_impact, priority_level,
                gemini_context, next_steps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            proposed_action['action_id'],
            proposed_action['priority_id'],
            proposed_action['grid_type'],
            proposed_action['action_title'],
            proposed_action['action_description'],
            'pending',
            action_json.get('estimated_effort'),
            action_json.get('estimated_impact'),
            action_json.get('priority_level'),
            proposed_action['gemini_context'],
            proposed_action['next_steps']
        ))
        conn.commit()

        cursor.execute("SELECT * FROM saved_actions WHERE action_id = ?", (action_id,))
        saved_action = cursor.fetchone()
        
        conn.close()

        return jsonify({
            "success": True,
            "action": dict(saved_action)
        })

    except Exception as e:
        logger.error(f"Error saving action: {e}")
        return jsonify({"error": "Failed to save action"}), 500


@action_bp.route('/api/actions/saved', methods=['GET'])
def api_get_saved_actions():
    """Get all saved actions for the current role."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                sa.*,
                COALESCE(san.priority_title, 'Priority ' || sa.priority_id) as priority_title
            FROM saved_actions sa
            LEFT JOIN saved_analyses san ON sa.priority_id = san.priority_id AND (sa.grid_type = san.grid_type OR sa.grid_type = 'unknown')
            ORDER BY priority_title, sa.saved_ts DESC
        """)
        rows = cursor.fetchall()
        
        actions_by_priority = {}
        for row in rows:
            action = dict(row)
            priority_title = action.get('priority_title', 'Uncategorized')
            if priority_title not in actions_by_priority:
                actions_by_priority[priority_title] = []
            actions_by_priority[priority_title].append(action)

        conn.close()

        return jsonify({
            "success": True,
            "actions_by_priority": actions_by_priority
        })

    except Exception as e:
        logger.error(f"Error getting saved actions: {e}")
        return jsonify({"error": "Failed to get saved actions"}), 500


@action_bp.route('/api/actions/saved/<action_id>', methods=['DELETE'])
def api_delete_saved_action(action_id):
    """Delete a saved action from the role-specific DB."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        conn = get_role_db_connection(user_role)
        cursor = conn.cursor()

        cursor.execute("DELETE FROM saved_actions WHERE action_id = ?", (action_id,))
        success = cursor.rowcount > 0
        
        conn.commit()
        conn.close()
        
        if success:
            return jsonify({"success": True, "message": "Action deleted successfully"})
        else:
            return jsonify({"error": "Action not found"}), 404
            
    except Exception as e:
        logger.error(f"Error deleting saved action: {e}")
        return jsonify({"error": "Failed to delete action"}), 500


@action_bp.route('/api/actions/<action_id>/notes', methods=['POST'])
def api_add_note_to_action(action_id):
    """Add a note to a saved action."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        data = request.get_json()
        note_text = data.get('note_text')

        if not note_text:
            return jsonify({"error": "Missing note_text"}), 400

        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("INSERT INTO action_notes (action_id, note_text) VALUES (?, ?)", (action_id, note_text))
        conn.commit()
        
        note_id = cursor.lastrowid
        cursor.execute("SELECT * FROM action_notes WHERE id = ?", (note_id,))
        new_note = cursor.fetchone()

        conn.close()

        return jsonify({"success": True, "note": dict(new_note)}), 201

    except Exception as e:
        logger.error(f"Error adding note to action: {e}")
        return jsonify({"error": "Failed to add note"}), 500


@action_bp.route('/api/actions/<action_id>/notes', methods=['GET'])
def api_get_action_notes(action_id):
    """Get all notes for a saved action."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM action_notes WHERE action_id = ? ORDER BY created_ts ASC", (action_id,))
        notes = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return jsonify({"success": True, "notes": notes})

    except Exception as e:
        logger.error(f"Error getting action notes: {e}")
        return jsonify({"error": "Failed to get notes"}), 500


@action_bp.route('/api/actions/<action_id>/steps/update', methods=['POST'])
def api_update_action_step_status(action_id):
    """Update the status of a single step or sub-task in an action plan."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        task_id = data.get('task_id')
        status = data.get('status')

        if not task_id or not status:
            return jsonify({"error": "Missing task_id or status"}), 400

        updated_action = update_task_status_in_db(user_role, action_id, task_id, status)

        if not updated_action:
            return jsonify({"error": "Action or task not found"}), 404

        return jsonify({
            "success": True,
            "action": updated_action
        })

    except Exception as e:
        logger.error(f"Error updating action step status: {e}")
        return jsonify({"error": "Failed to update step status"}), 500


@action_bp.route('/api/actions/<action_id>/steps/<task_id>/generate-query', methods=['POST'])
def api_generate_query_for_step(action_id, task_id):
    """Generate a SQL query for a specific action plan step."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        query_data = generate_sql_query_for_task(user_role, action_id, task_id)

        if not query_data or 'sql_query' not in query_data:
            return jsonify({"error": "Task not found or query could not be generated"}), 404

        return jsonify({
            "success": True,
            "explanation": query_data.get("explanation", "No explanation provided."),
            "sql_query": query_data.get("sql_query")
        })

    except Exception as e:
        logger.error(f"Error generating SQL query for step: {e}")
        return jsonify({"error": "Failed to generate SQL query"}), 500


@action_bp.route('/api/actions/<action_id>/steps/<task_id>/generate-communication', methods=['POST'])
def api_generate_communication_for_step(action_id, task_id):
    """Generate a communication draft for a specific action plan step."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        communication_type = data.get('type')

        if not communication_type:
            return jsonify({"error": "Missing communication type"}), 400

        content = generate_communication_for_task(user_role, action_id, task_id, communication_type)

        if not content:
            return jsonify({"error": "Task not found or content could not be generated"}), 404

        return jsonify({
            "success": True,
            "content": content
        })

    except Exception as e:
        logger.error(f"Error generating communication for step: {e}")
        return jsonify({"error": "Failed to generate communication"}), 500


@action_bp.route('/api/actions/<action_id>/notes/<int:note_id>', methods=['DELETE'])
def api_delete_action_note(action_id, note_id):
    """Delete a note from a saved action."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute("DELETE FROM action_notes WHERE id = ? AND action_id = ?", (note_id, action_id))
        conn.commit()

        if cursor.rowcount == 0:
            conn.close()
            return jsonify({"error": "Note not found or does not belong to this action"}), 404

        # Fetch remaining notes to send back to the client
        cursor.execute("SELECT * FROM action_notes WHERE action_id = ? ORDER BY created_ts ASC", (action_id,))
        notes = [dict(row) for row in cursor.fetchall()]

        conn.close()

        return jsonify({"success": True, "notes": notes})

    except Exception as e:
        logger.error(f"Error deleting action note: {e}")
        return jsonify({"error": "Failed to delete note"}), 500


@action_bp.route('/api/actions/<action_id>/ai-assistant', methods=['POST'])
def api_ask_ai_assistant(action_id):
    """Ask AI Assistant a question about a specific step or context section."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        data = request.get_json()
        question = data.get('question')
        target_type = data.get('target_type')  # 'step' or 'context'
        target_id = data.get('target_id')  # step_id or context_section_id
        
        if not question or not target_type or not target_id:
            return jsonify({"error": "Missing required fields"}), 400
        
        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Fetch the action
        cursor.execute("""
            SELECT sa.*, p.priority_title
            FROM saved_actions sa
            LEFT JOIN saved_analyses p ON sa.priority_id = p.priority_id
            WHERE sa.action_id = ?
        """, (action_id,))
        action_data = cursor.fetchone()
        target_table = "saved_actions"
        
        if not action_data:
            cursor.execute("SELECT * FROM proposed_actions WHERE action_id = ?", (action_id,))
            action_data = cursor.fetchone()
            target_table = "proposed_actions"
        
        if not action_data:
            return jsonify({"error": "Action not found"}), 404
        
        # Get existing AI conversations or initialize
        ai_conversations = json.loads(action_data['ai_conversations'] if action_data['ai_conversations'] else '{}')
        
        # Prepare context for AI based on target type
        if target_type == 'step':
            context = _prepare_step_context(action_data, target_id)
        elif target_type == 'context':
            context = _prepare_context_section_context(action_data, target_id)
        else:
            return jsonify({"error": "Invalid target_type"}), 400
        
        if not context:
            return jsonify({"error": "Target not found"}), 404
        
        # Generate AI response
        prompt = f"""
        You are an AI business strategist assistant. The user is asking a question about a specific part of their action plan.
        
        **Context:**
        {context}
        
        **User Question:**
        {question}
        
        Please provide a helpful, actionable response that directly addresses their question. Be specific and practical.
        """
        
        ai_response = _generate_content_from_model(prompt, "")
        
        if not ai_response:
            return jsonify({"error": "Failed to generate AI response"}), 500
        
        # Create conversation entry
        conversation_id = str(uuid.uuid4())
        conversation_entry = {
            "id": conversation_id,
            "question": question,
            "response": ai_response,
            "timestamp": datetime.now().isoformat()
        }
        
        # Save to appropriate target conversations
        target_key = f"{target_type}_{target_id}"
        if target_key not in ai_conversations:
            ai_conversations[target_key] = []
        ai_conversations[target_key].append(conversation_entry)
        
        # Update database
        cursor.execute(
            f"UPDATE {target_table} SET ai_conversations = ?, updated_ts = CURRENT_TIMESTAMP WHERE action_id = ?",
            (json.dumps(ai_conversations), action_id)
        )
        conn.commit()
        conn.close()
        
        return jsonify({
            "success": True,
            "conversation": conversation_entry,
            "target_type": target_type,
            "target_id": target_id
        })
        
    except Exception as e:
        logger.error(f"Error with AI assistant: {e}")
        return jsonify({"error": "Failed to get AI response"}), 500


@action_bp.route('/api/actions/<action_id>/ai-assistant/<conversation_id>', methods=['DELETE'])
def api_delete_ai_conversation(action_id, conversation_id):
    """Delete a specific AI conversation."""
    user_role = _get_user_role()
    if not user_role:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        conn = get_role_db_connection(user_role)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Fetch the action
        cursor.execute("SELECT * FROM saved_actions WHERE action_id = ?", (action_id,))
        action_data = cursor.fetchone()
        target_table = "saved_actions"
        
        if not action_data:
            cursor.execute("SELECT * FROM proposed_actions WHERE action_id = ?", (action_id,))
            action_data = cursor.fetchone()
            target_table = "proposed_actions"
        
        if not action_data:
            return jsonify({"error": "Action not found"}), 404
        
        # Get existing AI conversations
        ai_conversations = json.loads(action_data['ai_conversations'] if action_data['ai_conversations'] else '{}')
        
        # Find and remove the conversation
        conversation_found = False
        for target_key, conversations in ai_conversations.items():
            ai_conversations[target_key] = [
                conv for conv in conversations 
                if conv.get('id') != conversation_id
            ]
            if len(ai_conversations[target_key]) != len(conversations):
                conversation_found = True
        
        if not conversation_found:
            return jsonify({"error": "Conversation not found"}), 404
        
        # Update database
        cursor.execute(
            f"UPDATE {target_table} SET ai_conversations = ?, updated_ts = CURRENT_TIMESTAMP WHERE action_id = ?",
            (json.dumps(ai_conversations), action_id)
        )
        conn.commit()
        conn.close()
        
        return jsonify({"success": True})
        
    except Exception as e:
        logger.error(f"Error deleting AI conversation: {e}")
        return jsonify({"error": "Failed to delete conversation"}), 500


def _prepare_step_context(action_data, step_id):
    """Prepare context information for a specific step."""
    try:
        next_steps = json.loads(action_data['next_steps'] if action_data['next_steps'] else '[]')
        step = next((s for s in next_steps if str(s.get('id')).lower() == step_id.lower()), None)
        
        if not step:
            return None
        
        context = f"""
        **Action Title:** {action_data['action_title']}
        **Action Description:** {action_data['action_description']}
        **Priority:** {action_data['priority_title'] if action_data['priority_title'] else 'N/A'}
        
        **Specific Step:**
        - **Title:** {step.get('title', '')}
        - **Description:** {step.get('description', '')}
        - **Status:** {step.get('completed', False) and 'Completed' or 'Pending'}
        - **Effort:** {step.get('effort', 'N/A')}
        - **Dependencies:** {step.get('dependencies', 'None')}
        """
        
        return context
        
    except Exception as e:
        logger.error(f"Error preparing step context: {e}")
        return None


def _prepare_context_section_context(action_data, section_id):
    """Prepare context information for a specific context section."""
    try:
        gemini_context = action_data['gemini_context'] if action_data['gemini_context'] else ''
        
        # Parse the context to find the specific section
        # This is a simplified approach - in practice, you might want to parse more intelligently
        context_sections = {
            'strategic_alignment': 'Strategic Alignment',
            'market_rationale': 'Market Rationale',
            'competitive_advantage': 'Competitive Advantage',
            'implementation_considerations': 'Implementation Considerations',
            'success_metrics': 'Success Metrics'
        }
        
        section_name = context_sections.get(section_id, section_id)
        
        context = f"""
        **Action Title:** {action_data['action_title']}
        **Action Description:** {action_data['action_description']}
        **Priority:** {action_data['priority_title'] if action_data['priority_title'] else 'N/A'}
        
        **Context Section:** {section_name}
        **Full Context:**
        {gemini_context}
        """
        
        return context
        
    except Exception as e:
        logger.error(f"Error preparing context section context: {e}")
        return None
