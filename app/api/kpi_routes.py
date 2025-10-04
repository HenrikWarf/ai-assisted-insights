"""
KPI API routes.

This module contains Flask Blueprint for KPI management endpoints.
Handles CRUD operations for KPIs including AI-assisted generation.
"""

import json
import logging
import os
import sqlite3
from pathlib import Path
from flask import Blueprint, request, jsonify, session
from services.gemini_service import _generate_text_from_model

kpi_bp = Blueprint('kpi', __name__)

logger = logging.getLogger(__name__)


def get_role_plan_path(role_name: str) -> str:
    """Get the path to the role's plan.json file."""
    safe_role = role_name.replace(' ', '_')
    return os.path.join('custom_roles', f'{safe_role}.plan.json')


def get_role_db_path(role_name: str) -> Path:
    """Get the path to the role's database file."""
    safe_role = role_name.replace(" ", "_")
    return Path('custom_roles') / f'{safe_role}.db'


def load_role_plan(role_name: str) -> dict:
    """Load the role's plan from JSON file."""
    plan_path = get_role_plan_path(role_name)
    if os.path.exists(plan_path):
        with open(plan_path, 'r') as f:
            return json.load(f)
    return {"kpis": [], "charts": [], "insights": []}


def save_role_plan(role_name: str, plan: dict):
    """Save the role's plan to JSON file."""
    plan_path = get_role_plan_path(role_name)
    with open(plan_path, 'w') as f:
        json.dump(plan, f, indent=2)


@kpi_bp.route("/api/kpis", methods=["GET"])
def get_kpis():
    """Get all KPIs for the current role."""
    if "role" not in session:
        logger.warning("GET /api/kpis - No role in session")
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    logger.info(f"GET /api/kpis - Role: {role}")
    
    # For built-in roles, return empty array (they don't use plan.json)
    if role in ["E-commerce Manager", "Marketing Lead"]:
        logger.info(f"GET /api/kpis - Built-in role, returning empty")
        return jsonify({"kpis": [], "is_custom_role": False})
    
    # For custom roles, load from plan.json
    plan = load_role_plan(role)
    kpi_count = len(plan.get("kpis", []))
    logger.info(f"GET /api/kpis - Custom role, loaded {kpi_count} KPIs")
    return jsonify({"kpis": plan.get("kpis", []), "is_custom_role": True})


@kpi_bp.route("/api/kpis/<kpi_id>", methods=["GET"])
def get_kpi(kpi_id):
    """Get a specific KPI by ID."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    plan = load_role_plan(role)
    
    kpi = next((k for k in plan.get("kpis", []) if k["id"] == kpi_id), None)
    if not kpi:
        return jsonify({"error": "KPI not found"}), 404
    
    return jsonify(kpi)


@kpi_bp.route("/api/kpis", methods=["POST"])
def create_kpi():
    """Create a new KPI."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    
    # Only allow custom roles to modify KPIs
    if role in ["E-commerce Manager", "Marketing Lead"]:
        return jsonify({"error": "Cannot modify KPIs for built-in roles"}), 403
    
    data = request.get_json()
    
    # Validate required fields
    required_fields = ["id", "title", "description", "formula", "table"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    # Load current plan
    plan = load_role_plan(role)
    
    # Check if KPI ID already exists
    if any(k["id"] == data["id"] for k in plan.get("kpis", [])):
        return jsonify({"error": "KPI with this ID already exists"}), 400
    
    # Add new KPI
    new_kpi = {
        "id": data["id"],
        "title": data["title"],
        "description": data["description"],
        "formula": data["formula"],
        "table": data["table"]
    }
    
    if "kpis" not in plan:
        plan["kpis"] = []
    
    plan["kpis"].append(new_kpi)
    
    # Save plan
    save_role_plan(role, plan)
    
    logger.info(f"Created KPI {data['id']} for role {role}")
    
    return jsonify(new_kpi), 201


@kpi_bp.route("/api/kpis/<kpi_id>", methods=["PUT"])
def update_kpi(kpi_id):
    """Update an existing KPI."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    
    # Only allow custom roles to modify KPIs
    if role in ["E-commerce Manager", "Marketing Lead"]:
        return jsonify({"error": "Cannot modify KPIs for built-in roles"}), 403
    
    data = request.get_json()
    
    # Load current plan
    plan = load_role_plan(role)
    
    # Find and update KPI
    kpi_index = next((i for i, k in enumerate(plan.get("kpis", [])) if k["id"] == kpi_id), None)
    
    if kpi_index is None:
        return jsonify({"error": "KPI not found"}), 404
    
    # Update KPI fields
    updated_kpi = plan["kpis"][kpi_index]
    updated_kpi["title"] = data.get("title", updated_kpi["title"])
    updated_kpi["description"] = data.get("description", updated_kpi["description"])
    updated_kpi["formula"] = data.get("formula", updated_kpi["formula"])
    updated_kpi["table"] = data.get("table", updated_kpi["table"])
    
    plan["kpis"][kpi_index] = updated_kpi
    
    # Save plan
    save_role_plan(role, plan)
    
    logger.info(f"Updated KPI {kpi_id} for role {role}")
    
    return jsonify(updated_kpi)


@kpi_bp.route("/api/kpis/<kpi_id>", methods=["DELETE"])
def delete_kpi(kpi_id):
    """Delete a KPI."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    
    # Only allow custom roles to modify KPIs
    if role in ["E-commerce Manager", "Marketing Lead"]:
        return jsonify({"error": "Cannot modify KPIs for built-in roles"}), 403
    
    # Load current plan
    plan = load_role_plan(role)
    
    # Find and remove KPI
    original_length = len(plan.get("kpis", []))
    plan["kpis"] = [k for k in plan.get("kpis", []) if k["id"] != kpi_id]
    
    if len(plan["kpis"]) == original_length:
        return jsonify({"error": "KPI not found"}), 404
    
    # Save plan
    save_role_plan(role, plan)
    
    logger.info(f"Deleted KPI {kpi_id} for role {role}")
    
    return jsonify({"success": True, "message": "KPI deleted"})


@kpi_bp.route("/api/kpis/test", methods=["POST"])
def test_kpi():
    """Test a KPI formula and return the result."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    data = request.get_json()
    
    formula = data.get("formula")
    if not formula:
        return jsonify({"error": "Formula is required"}), 400
    
    # Get database path for the role
    if role in ["E-commerce Manager", "Marketing Lead"]:
        db_path = Path("data") / "cfc.db"
    else:
        db_path = get_role_db_path(role)
    
    if not db_path.exists():
        return jsonify({"error": "Database not found"}), 404
    
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(formula)
        result = cur.fetchone()
        conn.close()
        
        if result:
            result_dict = dict(result)
            return jsonify({
                "success": True,
                "result": result_dict,
                "value": list(result_dict.values())[0] if result_dict else None
            })
        else:
            return jsonify({"success": True, "result": None, "value": None})
    
    except Exception as e:
        logger.error(f"Error testing KPI formula: {e}")
        return jsonify({"error": str(e)}), 400


@kpi_bp.route("/api/kpis/generate", methods=["POST"])
def generate_kpi_with_ai():
    """Generate a KPI using Gemini AI."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    data = request.get_json()
    
    description = data.get("description")
    if not description:
        return jsonify({"error": "Description is required"}), 400
    
    # Get database schema for the role
    if role in ["E-commerce Manager", "Marketing Lead"]:
        db_path = Path("data") / "cfc.db"
    else:
        db_path = get_role_db_path(role)
    
    if not db_path.exists():
        return jsonify({"error": "Database not found"}), 404
    
    try:
        # Get table schema
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Get all tables
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [row[0] for row in cur.fetchall()]
        
        # Get schema for each table
        schema_info = {}
        for table in tables:
            cur.execute(f"PRAGMA table_info(\"{table}\")")
            columns = cur.fetchall()
            schema_info[table] = [{"name": col[1], "type": col[2]} for col in columns]
        
        conn.close()
        
        # Prepare prompt for Gemini
        prompt = f"""You are a SQL expert and data analyst. Generate a KPI definition based on the user's description.

User's KPI Description: "{description}"

Available Database Schema:
{json.dumps(schema_info, indent=2)}

Generate a KPI with the following JSON structure:
{{
  "id": "unique_snake_case_id",
  "title": "Human-readable KPI title",
  "description": "Detailed description of what this KPI measures and why it's important",
  "formula": "Complete SQLite SELECT query that calculates this KPI",
  "table": "primary_table_name_used"
}}

IMPORTANT RULES:
1. The formula MUST be a complete, valid SQLite SELECT statement
2. Use ONLY the tables and columns provided in the schema
3. Wrap table and column names in double quotes to handle special characters
4. The query should return a single aggregated value
5. Make the KPI relevant and actionable for business decisions

Return ONLY the JSON object, no additional text."""

        # Call Gemini
        response = _generate_text_from_model(prompt)
        
        # Parse response
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        kpi_definition = json.loads(response_text.strip())
        
        # Validate the generated KPI
        required_fields = ["id", "title", "description", "formula", "table"]
        if not all(field in kpi_definition for field in required_fields):
            return jsonify({"error": "AI generated incomplete KPI definition"}), 500
        
        # Test the formula
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        try:
            cur.execute(kpi_definition["formula"])
            result = cur.fetchone()
            test_value = dict(result) if result else None
        except Exception as test_error:
            logger.warning(f"Generated KPI formula failed test: {test_error}")
            test_value = None
        finally:
            conn.close()
        
        return jsonify({
            "kpi": kpi_definition,
            "test_value": test_value
        })
    
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing AI response: {e}")
        return jsonify({"error": "Failed to parse AI response"}), 500
    except Exception as e:
        logger.error(f"Error generating KPI with AI: {e}")
        return jsonify({"error": str(e)}), 500


@kpi_bp.route("/api/kpis/<kpi_id>/improve", methods=["POST"])
def improve_kpi_with_ai(kpi_id):
    """Improve an existing KPI using Gemini AI."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    data = request.get_json()
    
    improvement_request = data.get("request", "Improve this KPI to be more accurate and useful")
    
    # Load current KPI
    plan = load_role_plan(role)
    kpi = next((k for k in plan.get("kpis", []) if k["id"] == kpi_id), None)
    
    if not kpi:
        return jsonify({"error": "KPI not found"}), 404
    
    # Get database schema
    db_path = get_role_db_path(role)
    if not db_path.exists():
        return jsonify({"error": "Database not found"}), 404
    
    try:
        # Get table schema
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Get schema for the KPI's table
        cur.execute(f"PRAGMA table_info(\"{kpi['table']}\")")
        columns = cur.fetchall()
        schema_info = {kpi['table']: [{"name": col[1], "type": col[2]} for col in columns]}
        
        conn.close()
        
        # Prepare prompt for Gemini
        prompt = f"""You are a SQL expert and data analyst. Improve the following KPI based on the user's request.

Current KPI:
{json.dumps(kpi, indent=2)}

User's Improvement Request: "{improvement_request}"

Available Schema for table "{kpi['table']}":
{json.dumps(schema_info, indent=2)}

Generate an improved KPI with the following JSON structure:
{{
  "id": "{kpi['id']}",
  "title": "Improved title if needed",
  "description": "Improved description explaining the changes",
  "formula": "Improved SQLite SELECT query",
  "table": "{kpi['table']}"
}}

IMPORTANT RULES:
1. Keep the same ID
2. The formula MUST be a complete, valid SQLite SELECT statement
3. Use ONLY the columns provided in the schema
4. Wrap table and column names in double quotes
5. Explain in the description what was improved and why

Return ONLY the JSON object, no additional text."""

        # Call Gemini
        response = _generate_text_from_model(prompt)
        
        # Parse response
        response_text = response.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        improved_kpi = json.loads(response_text.strip())
        
        return jsonify({"kpi": improved_kpi})
    
    except Exception as e:
        logger.error(f"Error improving KPI with AI: {e}")
        return jsonify({"error": str(e)}), 500


@kpi_bp.route("/api/kpis/<kpi_id>/columns", methods=["GET"])
def get_kpi_columns(kpi_id):
    """Analyze and return the columns used in a KPI formula."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    
    # Load current KPI
    plan = load_role_plan(role)
    kpi = next((k for k in plan.get("kpis", []) if k["id"] == kpi_id), None)
    
    if not kpi:
        return jsonify({"error": "KPI not found"}), 404
    
    # Parse SQL to extract columns (simple regex-based extraction)
    import re
    
    formula = kpi["formula"]
    
    # Extract column names from the formula (simplified approach)
    # This matches quoted identifiers and common SQL patterns
    column_pattern = r'"([^"]+)"'
    columns = re.findall(column_pattern, formula)
    
    # Filter out table names (keep only column names)
    table_name = kpi.get("table", "")
    columns = [col for col in columns if col != table_name]
    
    # Get aggregation functions used
    agg_functions = []
    for func in ["SUM", "AVG", "COUNT", "MIN", "MAX", "GROUP_CONCAT"]:
        if func in formula.upper():
            agg_functions.append(func)
    
    return jsonify({
        "columns": list(set(columns)),
        "aggregations": agg_functions,
        "table": table_name
    })

