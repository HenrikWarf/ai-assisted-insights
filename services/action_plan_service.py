"""
Service layer for managing the interactive action plan.

This service will handle the business logic related to creating, updating,
and interacting with the structured "Next Steps" which are treated as
an action plan. This includes generating sub-tasks via AI and
updating the completion status of tasks.
"""
import json
import sqlite3
from app.database.connection import get_role_db_connection
import logging

logger = logging.getLogger(__name__)

def update_task_status_in_db(user_role, action_id, task_id, new_status):
    """
    Finds an action, updates a specific task's status within its next_steps JSON,
    and saves it back to the database.

    Args:
        user_role (str): The role of the user, used to connect to the correct DB.
        action_id (str): The ID of the action to update.
        task_id (str): The ID of the task/sub-task to update.
        new_status (str): The new status for the task (e.g., 'completed').

    Returns:
        dict: The updated action object, or None if not found.
    """
    conn = get_role_db_connection(user_role)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    logger.info(f"Attempting to update task. action_id='{action_id}', task_id='{task_id}', new_status='{new_status}'")

    # The action could be in either 'saved_actions' or 'proposed_actions'
    tables_to_check = ["saved_actions", "proposed_actions"]
    action_data = None
    target_table = None

    for table in tables_to_check:
        cursor.execute(f"SELECT * FROM {table} WHERE action_id = ?", (action_id,))
        action_data = cursor.fetchone()
        if action_data:
            target_table = table
            break
    
    if not action_data or 'next_steps' not in action_data.keys() or not action_data['next_steps']:
        logger.warning(f"Action not found or no next_steps for action_id='{action_id}'")
        conn.close()
        return None

    try:
        next_steps = json.loads(action_data['next_steps'])
        task_found = False
        logger.debug(f"Searching for task_id='{task_id}' in next_steps for action '{action_id}': {next_steps}")

        for step in next_steps:
            step_id = str(step.get('id', 'N/A'))
            logger.debug(f"Comparing incoming task_id='{task_id.lower()}' with step_id='{step_id.lower()}'")
            if step_id.lower() == task_id.lower():
                step['status'] = new_status
                task_found = True
                break
            if 'sub_tasks' in step and step['sub_tasks']:
                for sub_task in step['sub_tasks']:
                    sub_task_id = str(sub_task.get('id', 'N/A'))
                    logger.debug(f"Comparing incoming task_id='{task_id.lower()}' with sub_task_id='{sub_task_id.lower()}'")
                    if str(sub_task.get('id')).lower() == task_id.lower():
                        sub_task['status'] = new_status
                        task_found = True
                        break
            if task_found:
                break
        
        if not task_found:
            logger.warning(f"Task with id='{task_id}' not found in action='{action_id}'")
            conn.close()
            return None # Or raise an error that the task_id was not found

        # Save the updated JSON back to the database
        cursor.execute(
            f"UPDATE {target_table} SET next_steps = ?, updated_ts = CURRENT_TIMESTAMP WHERE action_id = ?",
            (json.dumps(next_steps), action_id)
        )
        conn.commit()

        # Fetch the updated action to return
        cursor.execute(f"SELECT * FROM {target_table} WHERE action_id = ?", (action_id,))
        updated_action = cursor.fetchone()
        
        conn.close()
        
        return dict(updated_action) if updated_action else None

    except (json.JSONDecodeError, TypeError):
        conn.close()
        return None
    except Exception as e:
        conn.close()
        raise e

def _get_db_schema(user_role):
    """
    Retrieves the database schema (table and column names).
    
    Args:
        user_role (str): The user's role to connect to the correct DB.
        
    Returns:
        str: A string representation of the database schema.
    """
    conn = get_role_db_connection(user_role)
    cursor = conn.cursor()
    
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    schema_str = ""
    for table_name in tables:
        table_name = table_name[0]
        schema_str += f"Table '{table_name}':\n"
        cursor.execute(f"PRAGMA table_info({table_name});")
        columns = cursor.fetchall()
        for column in columns:
            schema_str += f"  - {column[1]} ({column[2]})\n"
    
    conn.close()
    return schema_str

def generate_sql_query_for_task(user_role, action_id, task_id):
    """
    Generates a SQL query for a specific task using Gemini and saves it to the action.

    Args:
        user_role (str): The user's role.
        action_id (str): The ID of the action containing the task.
        task_id (str): The ID of the task to generate the query for.

    Returns:
        dict: The generated query data, or None if the task is not found.
    """
    conn = get_role_db_connection(user_role)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    logger.info(f"Attempting to generate query for task. action_id='{action_id}', task_id='{task_id}'")

    tables_to_check = ["saved_actions", "proposed_actions"]
    action_data = None
    target_table = None

    for table in tables_to_check:
        cursor.execute(f"SELECT * FROM {table} WHERE action_id = ?", (action_id,))
        action_data = cursor.fetchone()
        if action_data:
            target_table = table
            break
    
    if not action_data or not action_data['next_steps']:
        logger.warning(f"Action not found or no next_steps for action_id='{action_id}'")
        conn.close()
        return None

    try:
        next_steps = json.loads(action_data['next_steps'])
        task_to_query = None
        logger.debug(f"Searching for task_id='{task_id}' in next_steps for action '{action_id}': {next_steps}")

        for step in next_steps:
            step_id = str(step.get('id', 'N/A'))
            logger.debug(f"Comparing incoming task_id='{task_id.lower()}' with step_id='{step_id.lower()}'")
            if step_id.lower() == task_id.lower():
                task_to_query = step
                break
        
        if not task_to_query:
            logger.warning(f"Task with id='{task_id}' not found in action='{action_id}'")
            return None

        db_schema = _get_db_schema(user_role)
        prompt = f"""
        Based on the following database schema and task, generate a JSON object with two keys: "explanation" and "sql_query".

        **Database Schema:**
        ```
        {db_schema}
        ```

        **Task:**
        - **Title:** "{task_to_query.get('title', '')}"
        - **Description:** "{task_to_query.get('description', '')}"

        **Instructions:**
        1.  **"explanation"**: Write a concise, one-sentence explanation of what the SQL query is intended to do.
        2.  **"sql_query"**: Write a single, executable, and well-formatted SQL query that accomplishes the task. Use line breaks and indentation for readability.

        Return only a single, minified JSON object. Do not include any markdown, backticks, or any text other than the JSON object itself.
        """
        
        from services.gemini_service import _generate_json_from_model
        query_data = _generate_json_from_model(prompt, "{{}}")

        if not query_data or 'sql_query' not in query_data:
            logger.warning(f"Failed to generate valid query data from model for task '{task_id}'")
            return None
        
        # Save the generated query and explanation back to the task in next_steps
        task_found_for_update = False
        for step in next_steps:
            if str(step.get('id')).lower() == task_id.lower():
                step['generated_query'] = query_data.get('sql_query')
                step['generated_query_explanation'] = query_data.get('explanation')
                task_found_for_update = True
                break
        
        if task_found_for_update:
            cursor.execute(
                f"UPDATE {target_table} SET next_steps = ? WHERE action_id = ?",
                (json.dumps(next_steps), action_id)
            )
            conn.commit()
            logger.info(f"Saved generated query for task_id='{task_id}' in action_id='{action_id}'")
        else:
            logger.warning(f"Could not find task with id='{task_id}' to save the generated query.")
        
        return query_data

    except (json.JSONDecodeError, TypeError) as e:
        logger.error(f"JSON error in generate_sql_query_for_task: {e}")
        return None
    finally:
        if conn:
            conn.close()

def generate_communication_for_task(user_role, action_id, task_id, communication_type):
    """
    Generates a communication draft (email, Slack, slide) for a specific task.

    Args:
        user_role (str): The user's role.
        action_id (str): The ID of the action containing the task.
        task_id (str): The ID of the task to generate the communication for.
        communication_type (str): The type of communication ('email', 'slack', or 'slide').

    Returns:
        str: The generated communication content, or None if not found.
    """
    conn = get_role_db_connection(user_role)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Fetch the action and join with priority to get context
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

        if not action_data or not action_data['next_steps']:
            logger.warning(f"Action not found or no next_steps for action_id='{action_id}'")
            return None

        next_steps = json.loads(action_data['next_steps'])
        task = next((step for step in next_steps if str(step.get('id')).lower() == task_id.lower()), None)

        if not task:
            logger.warning(f"Task with id='{task_id}' not found in action='{action_id}'")
            return None

        # Prepare context for the prompt
        context = {
            "priority_title": action_data['priority_title'] if action_data['priority_title'] else 'N/A',
            "action_title": action_data['action_title'],
            "action_description": action_data['action_description'],
            "task_title": task.get('title', ''),
            "task_description": task.get('description', '')
        }

        # Define prompts for each communication type
        prompts = {
            "email": f"""
                You are a senior business strategist. Draft a concise and professional email to a manager or another team.
                The goal is to explain a proposed action, provide the data-driven rationale, and clarify what is needed from them.
                The email should be ready to send with minimal edits.
                
                **Context:**
                - **Strategic Priority:** {context['priority_title']}
                - **Proposed Action:** {context['action_title']} ({context['action_description']})
                - **Specific Task:** {context['task_title']} ({context['task_description']})

                Return only the raw text of the email, including a subject line.
            """,
            "slack": f"""
                You are a senior business strategist. Draft a short, informal Slack message for a team channel.
                The message should briefly explain a proposed action and its goal, designed to spark discussion or provide a quick update.
                
                **Context:**
                - **Action:** {context['action_title']}
                - **Task:** {context['task_title']}

                Return only the raw text of the Slack message.
            """,
            "slide": f"""
                You are a senior business strategist. Generate content for a single presentation slide.
                The content should be a bulleted list summarizing the action's "Problem," "Proposed Solution," and "Expected Impact."
                The format should be clean and easy to copy into a presentation.

                **Context:**
                - **Priority:** {context['priority_title']}
                - **Action:** {context['action_title']} ({context['action_description']})
                - **Task:** {context['task_title']}

                Return only the raw text for the slide.
            """
        }

        prompt = prompts.get(communication_type)
        if not prompt:
            logger.warning(f"Invalid communication type: {communication_type}")
            return None
        
        from services.gemini_service import _generate_content_from_model
        generated_content = _generate_content_from_model(prompt, "")

        if generated_content:
            # Save the generated communication back to the task in next_steps
            task_found_for_update = False
            for step in next_steps:
                if str(step.get('id')).lower() == task_id.lower():
                    if 'generated_communications' not in step:
                        step['generated_communications'] = {}
                    step['generated_communications'][communication_type] = generated_content
                    task_found_for_update = True
                    break
            
            if task_found_for_update:
                cursor.execute(
                    f"UPDATE {target_table} SET next_steps = ? WHERE action_id = ?",
                    (json.dumps(next_steps), action_id)
                )
                conn.commit()
                logger.info(f"Saved generated {communication_type} for task_id='{task_id}' in action_id='{action_id}'")

        return generated_content

    except Exception as e:
        logger.error(f"Error generating communication for task '{task_id}': {e}")
        return None
    finally:
        if conn:
            conn.close()
