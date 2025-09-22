"""
Custom role API routes.

This module contains Flask Blueprint for custom role management API endpoints.
"""

from flask import Blueprint, request, jsonify, session
from app.models import CustomRoleManager, get_role_db_path
from app.database import get_db_connection, infer_column_type
from services.gemini_service import _generate_json_from_model, generate_chart_insights
import sqlite3
import json
import logging
from pathlib import Path

custom_role_bp = Blueprint('custom_role', __name__)


@custom_role_bp.route("/api/custom_roles")
def api_custom_roles():
    """List all available custom roles for the homepage."""
    manager = CustomRoleManager()
    custom_roles = manager.get_custom_roles()
    return jsonify({"custom_roles": custom_roles})


@custom_role_bp.route("/api/new_role/create", methods=["POST"])
def api_new_role_create():
    """Create a new custom role with configuration."""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    gcp_project = (payload.get("gcp_project") or "").strip()
    bq_dataset = (payload.get("bq_dataset") or "").strip()
    bq_tables = payload.get("bq_tables") or []
    sa_json = payload.get("sa_json") or ""
    
    manager = CustomRoleManager()
    result = manager.create_role(role_name, gcp_project, bq_dataset, bq_tables, sa_json)
    return jsonify(result)


@custom_role_bp.route("/api/new_role/import", methods=["POST"])
def api_new_role_import():
    """Import data from BigQuery into a custom role's database."""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    
    manager = CustomRoleManager()
    result = manager.import_role_data(role_name)
    return jsonify(result)


@custom_role_bp.route("/api/new_role/analyze", methods=["POST"])
def api_new_role_analyze():
    """Analyze a custom role's data and generate KPIs and visualizations."""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    
    manager = CustomRoleManager()
    result = manager.analyze_role(role_name)
    return jsonify(result)


@custom_role_bp.route("/api/new_role/finalize", methods=["POST"])
def api_new_role_finalize():
    """Finalize custom role creation (placeholder for future functionality)."""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    if not role_name:
        return jsonify({"ok": False, "error": "Missing role_name"}), 400
    # For now, nothing extra to do. Frontend will navigate to dashboard.
    return jsonify({"ok": True})


@custom_role_bp.route("/api/custom_role/schema")
def api_custom_role_schema():
    """Get database schema for custom role."""
    role_name = request.args.get('role_name', '').strip()
    if not role_name:
        return jsonify({"ok": False, "error": "Missing role_name"}), 400
    
    role_db = get_role_db_path(role_name)
    if not role_db.exists():
        return jsonify({"ok": False, "error": "Role DB not found"}), 404
    
    try:
        conn = sqlite3.connect(str(role_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Get all tables (exclude SQLite system tables and our custom system tables)
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'chart_%' AND name NOT LIKE 'analysis_%'")
        tables = [r[0] for r in cur.fetchall()]
        
        schema_info = {}
        for table in tables:
            cur.execute(f"PRAGMA table_info('{table}')")
            columns = []
            for row in cur.fetchall():
                column_name = row[1]
                sqlite_type = row[2]
                
                # Infer actual data type from column name and sample data
                inferred_type = infer_column_type(column_name, sqlite_type, table, cur)
                
                columns.append({
                    "name": column_name,
                    "type": sqlite_type,
                    "inferred_type": inferred_type,
                    "nullable": not row[3],
                    "default": row[4],
                    "primary_key": bool(row[5])
                })
            
            # Get row count
            cur.execute(f"SELECT COUNT(1) as cnt FROM '{table}'")
            row_count = cur.fetchone()["cnt"]
            
            schema_info[table] = {
                "columns": columns,
                "row_count": row_count
            }
        
        conn.close()
        return jsonify({"ok": True, "schema": schema_info})
        
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@custom_role_bp.route("/api/custom_role/metrics")
def api_custom_role_metrics():
    """Get metrics data for a custom role."""
    role_name = request.args.get("role_name", "").strip()
    if not role_name:
        return jsonify({"error": "Missing role_name"}), 400
    
    role_db = get_role_db_path(role_name)
    if not role_db.exists():
        return jsonify({"error": "Role DB not found"}), 404
    
    # Build a lightweight metrics dict based on plan-generated SQL if present; otherwise row counts only
    APP_ROOT = Path(__file__).parent.parent.parent.resolve()
    CUSTOM_DIR = APP_ROOT / "custom_roles"
    plan_path = CUSTOM_DIR / f"{role_name.replace(' ','_')}.plan.json"
    metrics = {}
    
    conn = sqlite3.connect(str(role_db))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    if plan_path.exists():
        try:
            plan = json.loads(plan_path.read_text())
            
            # Execute KPI calculations with change percentage
            kpis = plan.get("kpis") or []
            
            # Helper functions for change calculation
            import re
            def extract_table(sql: str) -> str:
                m = re.search(r"FROM\s+`?\"?([a-zA-Z0-9_]+)`?\"?", sql, re.IGNORECASE)
                return m.group(1) if m else ""
            
            def pick_date_column(table: str) -> str:
                try:
                    cur.execute(f"PRAGMA table_info('{table}')")
                    cols = [r[1] for r in cur.fetchall()]
                except Exception:
                    cols = []
                for name in [
                    "date", "day", "registration_date", "date_of_last_purchase", "first_purchase_date",
                    "created_at", "updated_at", "signup_date"
                ]:
                    if name in cols:
                        return name
                # Try fuzzy match
                for c in cols:
                    lc = c.lower()
                    if any(x in lc for x in ["date", "day", "created", "updated", "signup", "purchase"]):
                        return c
                return ""
            
            def add_time_window(sql: str, table: str, date_col: str, start_iso: str, end_iso: str) -> str:
                if not table or not date_col:
                    return ""
                # Normalize SQL spacing
                s = sql.strip()
                has_where = re.search(r"\bWHERE\b", s, re.IGNORECASE) is not None
                clause = f"{date_col} BETWEEN date('{start_iso}') AND date('{end_iso}')"
                if has_where:
                    return re.sub(r"\bWHERE\b", lambda m: m.group(0) + " " + clause + " AND ", s, count=1, flags=re.IGNORECASE)
                else:
                    return re.sub(r"\bFROM\s+`?\"?" + re.escape(table) + r"`?\"?", lambda m: m.group(0) + f" WHERE {clause}", s, count=1, flags=re.IGNORECASE)

            from datetime import datetime, timedelta
            end_curr = datetime.utcnow().date()
            start_curr = end_curr - timedelta(days=30)
            end_prev = start_curr - timedelta(days=1)
            start_prev = end_prev - timedelta(days=30)
            fmt = lambda d: d.isoformat()

            for kpi in kpis:
                formula = kpi.get("formula")
                kpi_id = kpi.get("id") or kpi.get("title", "kpi").lower().replace(" ", "_")
                if formula:
                    try:
                        # Get current value
                        cur.execute(formula)
                        result = cur.fetchone()
                        if result:
                            kpi_data = dict(result)
                            
                            # Try to calculate change percentage
                            table = extract_table(formula)
                            date_col = pick_date_column(table)
                            if table and date_col:
                                try:
                                    sql_curr = add_time_window(formula, table, date_col, fmt(start_curr), fmt(end_curr))
                                    sql_prev = add_time_window(formula, table, date_col, fmt(start_prev), fmt(end_prev))
                                    if sql_curr and sql_prev:
                                        cur.execute(sql_curr)
                                        curr_result = cur.fetchone()
                                        cur.execute(sql_prev)
                                        prev_result = cur.fetchone()
                                        
                                        if curr_result and prev_result:
                                            curr_val = list(curr_result.values())[0]
                                            prev_val = list(prev_result.values())[0]
                                            if isinstance(curr_val, (int, float)) and isinstance(prev_val, (int, float)) and prev_val != 0:
                                                change_pct = ((curr_val - prev_val) / prev_val) * 100
                                                kpi_data['change_pct'] = round(change_pct, 1)
                                except Exception:
                                    pass  # If change calculation fails, just use the original value
                            
                            metrics[f"kpi_{kpi_id}"] = kpi_data
                    except Exception:
                        pass
            
            # Execute chart queries
            charts = plan.get("charts") or []
            for ch in charts:
                q = ch.get("query_sql")
                chart_id = (ch.get("id") or ch.get("title") or "chart").lower().replace(" ", "_")
                # Remove existing chart_ prefix if present to avoid double prefixing
                if chart_id.startswith("chart_"):
                    chart_id = chart_id[6:]  # Remove "chart_" prefix
                if not q:
                    continue
                try:
                    cur.execute(q)
                    metrics[f"chart_{chart_id}"] = [dict(r) for r in cur.fetchall()]
                except Exception:
                    # Skip invalid queries
                    continue
        except Exception:
            pass
    
    # Always include table rowcounts
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    tables = [r[0] for r in cur.fetchall()]
    for t in tables:
        try:
            cur.execute(f"SELECT COUNT(1) as cnt FROM '{t}'")
            row = cur.fetchone()
            metrics[f"{t}_rowcount"] = row["cnt"] if row else 0
        except Exception:
            pass
    conn.close()
    
    # Include plan data in response so frontend can access chart types
    plan_data = None
    if plan_path.exists():
        try:
            plan_data = json.loads(plan_path.read_text())
        except Exception:
            pass
    
    # Get role metadata (creation date and total records)
    config_path = CUSTOM_DIR / f"{role_name.replace(' ','_')}.json"
    role_metadata = {}
    if config_path.exists():
        try:
            config = json.loads(config_path.read_text())
            
            # Calculate actual total records from database
            actual_total_records = 0
            try:
                conn = sqlite3.connect(str(role_db))
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                
                # Get all tables and count their records
                cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                tables = [r[0] for r in cur.fetchall()]
                
                for table in tables:
                    cur.execute(f"SELECT COUNT(1) as cnt FROM '{table}'")
                    actual_total_records += cur.fetchone()["cnt"]
                
                conn.close()
            except Exception:
                # Fallback to config value if database query fails
                actual_total_records = config.get("total_records", 0)
            
            role_metadata = {
                "created_at": config.get("created_at"),
                "total_records": actual_total_records
            }
        except Exception:
            pass
    
    return jsonify({
        "role": role_name, 
        "metrics": metrics, 
        "plan": plan_data,
        "metadata": role_metadata,
        "user": session.get("user", "Unknown User")
    })


@custom_role_bp.route("/api/custom_role/create_visualization", methods=["POST"])
def api_custom_role_create_visualization():
    """Create or edit a custom visualization."""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    description = (payload.get("description") or "").strip()
    chart_id = payload.get("chart_id")  # Optional - if provided, edit existing chart
    generate_insights = payload.get("generate_insights", True)
    
    if not role_name or not description:
        return jsonify({"ok": False, "error": "Missing role_name or description"}), 400
    
    APP_ROOT = Path(__file__).parent.parent.parent.resolve()
    CUSTOM_DIR = APP_ROOT / "custom_roles"
    plan_path = CUSTOM_DIR / f"{role_name.replace(' ','_')}.plan.json"
    
    if not plan_path.exists():
        return jsonify({"ok": False, "error": "Role plan not found"}), 404
    
    try:
        # Load existing plan
        plan = json.loads(plan_path.read_text())
        charts = plan.get("charts", [])
        
        # Generate SQL query using Gemini
        role_db = get_role_db_path(role_name)
        if not role_db.exists():
            return jsonify({"ok": False, "error": "Role database not found"}), 404
        
        # Get schema information for context
        conn = sqlite3.connect(str(role_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Get table schemas
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'chart_%' AND name NOT LIKE 'analysis_%'")
        tables = [r[0] for r in cur.fetchall()]
        
        schema_info = {}
        for table in tables:
            cur.execute(f"PRAGMA table_info('{table}')")
            columns = []
            for row in cur.fetchall():
                columns.append({
                    "name": row[1],
                    "type": row[2],
                    "nullable": not row[3]
                })
            schema_info[table] = {"columns": columns}
        
        conn.close()
        
        # Generate SQL query using Gemini
        prompt = f"""
        You are a SQL expert. Generate a SQL query for the following request:
        
        Request: {description}
        
        Available tables and columns:
        {json.dumps(schema_info, indent=2)}
        
        Requirements:
        1. Use only the tables and columns provided above
        2. Generate a valid SQLite query
        3. If the request mentions charts, focus on data aggregation and grouping
        4. For time-based queries, use appropriate date functions
        5. Return only the SQL query, no explanations
        
        SQL Query:
        """
        
        response = _generate_json_from_model(prompt, json.dumps(schema_info, indent=2))
        
        # Extract SQL query from the response dictionary
        sql_query = response.get('sql_query') or response.get('query') or response.get('sql') or str(response)
        
        if not sql_query:
            return jsonify({"ok": False, "error": "Failed to generate SQL query"}), 500
        
        # Clean up the SQL query (remove any markdown formatting)
        sql_query = str(sql_query).strip()
        if sql_query.startswith("```sql"):
            sql_query = sql_query[6:]
        if sql_query.startswith("```"):
            sql_query = sql_query[3:]
        if sql_query.endswith("```"):
            sql_query = sql_query[:-3]
        sql_query = sql_query.strip()
        
        # Test the query
        try:
            conn = sqlite3.connect(str(role_db))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            cur.execute(sql_query)
            results = [dict(r) for r in cur.fetchall()]
            conn.close()
            
            if not results:
                return jsonify({"ok": False, "error": "Query returned no results"}), 400
                
        except Exception as e:
            return jsonify({"ok": False, "error": f"Invalid SQL query: {str(e)}"}), 400
        
        # Determine chart type based on description
        chart_type = "table"  # default
        desc_lower = description.lower()
        if any(word in desc_lower for word in ["line", "trend", "over time", "timeline"]):
            chart_type = "line"
        elif any(word in desc_lower for word in ["bar", "compare", "comparison"]):
            chart_type = "bar"
        elif any(word in desc_lower for word in ["pie", "breakdown", "distribution", "share"]):
            chart_type = "pie"
        elif any(word in desc_lower for word in ["scatter", "correlation"]):
            chart_type = "scatter"
        
        # Generate chart ID
        if chart_id:
            # Editing existing chart
            chart_id = chart_id.replace("chart_", "")
        else:
            # Creating new chart
            chart_id = description.lower().replace(" ", "_").replace("-", "_")
            chart_id = "".join(c for c in chart_id if c.isalnum() or c == "_")
            chart_id = chart_id[:50]  # Limit length
        
        # Create chart object
        chart_obj = {
            "id": chart_id,
            "title": description,
            "type": chart_type,
            "query_sql": sql_query
        }
        
        if chart_id in [c.get("id") for c in charts]:
            # Update existing chart
            charts = [c if c.get("id") != chart_id else chart_obj for c in charts]
        else:
            # Add new chart
            charts.append(chart_obj)
        
        # Update the plan
        plan["charts"] = charts
        
        # Save updated plan
        plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2))
        
        # Generate insights if requested
        if generate_insights:
            try:
                insights = generate_chart_insights(results, description, chart_type)
                if insights:
                    # Store insights in database
                    conn = sqlite3.connect(str(role_db))
                    cur = conn.cursor()
                    
                    # Create insights table if it doesn't exist
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS chart_insights (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            chart_id TEXT NOT NULL,
                            insights_json TEXT NOT NULL,
                            created_at TEXT NOT NULL DEFAULT (datetime('now')),
                            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                        )
                    """)
                    
                    # Insert or update insights
                    cur.execute("""
                        INSERT OR REPLACE INTO chart_insights (chart_id, insights_json, updated_at)
                        VALUES (?, ?, datetime('now'))
                    """, (chart_id, json.dumps(insights)))
                    
                    conn.commit()
                    conn.close()
            except Exception as e:
                logging.warning(f"Failed to generate insights: {e}")
        
        return jsonify({
            "ok": True, 
            "message": "Visualization created successfully",
            "chart_id": chart_id,
            "chart_type": chart_type
        })
        
    except Exception as e:
        logging.error(f"Error creating visualization: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@custom_role_bp.route("/api/custom_role/delete_chart", methods=["POST"])
def api_custom_role_delete_chart():
    """Delete a custom chart."""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    chart_id = (payload.get("chart_id") or "").strip()
    
    if not role_name or not chart_id:
        return jsonify({"ok": False, "error": "Missing role_name or chart_id"}), 400
    
    APP_ROOT = Path(__file__).parent.parent.parent.resolve()
    CUSTOM_DIR = APP_ROOT / "custom_roles"
    plan_path = CUSTOM_DIR / f"{role_name.replace(' ','_')}.plan.json"
    if not plan_path.exists():
        return jsonify({"ok": False, "error": "Role plan not found"}), 404
    
    try:
        # Load existing plan
        plan = json.loads(plan_path.read_text())
        charts = plan.get("charts", [])
        
        # Find and remove the chart
        original_count = len(charts)
        charts = [chart for chart in charts if chart.get("id") != chart_id]
        
        if len(charts) == original_count:
            return jsonify({"ok": False, "error": "Chart not found"}), 404
        
        # Update the plan
        plan["charts"] = charts
        
        # Save updated plan
        plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2))
        
        return jsonify({"ok": True, "message": "Chart deleted successfully"})
        
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@custom_role_bp.route("/api/custom_role/insights/<role_name>/<chart_id>", methods=["GET"])
def api_get_chart_insights(role_name, chart_id):
    """Get stored insights for a specific chart"""
    try:
        role_db = get_role_db_path(role_name)
        if not role_db.exists():
            return jsonify({"ok": False, "error": "Role database not found"}), 404
        
        conn = sqlite3.connect(str(role_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Get latest insights for this chart
        cur.execute("""
            SELECT insights_json, created_at, updated_at 
            FROM chart_insights 
            WHERE chart_id = ? 
            ORDER BY updated_at DESC 
            LIMIT 1
        """, (chart_id,))
        
        result = cur.fetchone()
        conn.close()
        
        if not result:
            return jsonify({"ok": False, "error": "No insights found for this chart"}), 404
        
        insights = json.loads(result["insights_json"])
        
        return jsonify({
            "ok": True,
            "insights": insights,
            "created_at": result["created_at"],
            "updated_at": result["updated_at"]
        })
        
    except Exception as e:
        logging.error(f"Error fetching chart insights: {e}")
        return jsonify({"ok": False, "error": f"Failed to fetch insights: {str(e)}"}), 500
