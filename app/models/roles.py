"""
Custom role management models and utilities.

This module handles custom role creation, management, and database operations.
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.database import get_db_connection
from app.database.role_db_schema import initialize_role_db
from services.bigquery_loader import import_tables_to_sqlite
from services.gemini_service import _generate_json_from_model, generate_chart_insights
from google.cloud import bigquery
from google.oauth2 import service_account
import logging


# Define global paths
APP_ROOT = Path(__file__).parent.parent.parent.resolve()
CUSTOM_DIR = APP_ROOT / "custom_roles"

def get_role_db_path(role_name: str) -> Path:
    """
    Get the database path for a custom role.
    
    Args:
        role_name (str): The name of the role
        
    Returns:
        Path: Path to the role's SQLite database file
    """
    safe = "".join(ch for ch in role_name if ch.isalnum() or ch in ("-","_"," ")).strip().replace(" ", "_")
    return CUSTOM_DIR / f"{safe}.db"

# Helper to get BQ client from service account
def get_bq_client(role_name: str):
    """Initializes a BigQuery client from a service account JSON file."""
    safe_role_name = "".join(ch for ch in role_name if ch.isalnum() or ch in ("-","_"," ")).strip().replace(" ", "_")
    sa_path = CUSTOM_DIR / f"{safe_role_name}.sa.json"
    
    if not sa_path.exists():
        logging.warning(f"Service account file not found for role: {role_name}")
        # Fallback to default credentials if available (e.g., gcloud auth)
        try:
            return bigquery.Client()
        except Exception:
            return None

    try:
        credentials = service_account.Credentials.from_service_account_file(str(sa_path))
        return bigquery.Client(credentials=credentials, project=credentials.project_id)
    except Exception as e:
        logging.error(f"Failed to create BQ client from service account file: {e}")
        return None


class CustomRoleManager:
    """
    Manager class for custom role operations.
    
    This class handles the creation, import, analysis, and management of custom roles
    with their associated data and configurations.
    """
    
    def __init__(self):
        self.custom_dir = CUSTOM_DIR
    
    def create_role(self, role_name: str, gcp_project: str, bq_dataset: str, 
                   bq_tables: List[str], sa_json: str = "") -> Dict[str, Any]:
        """
        Create a new custom role with its configuration.
        
        Args:
            role_name (str): Name of the role
            gcp_project (str): Google Cloud Project ID
            bq_dataset (str): BigQuery dataset name
            bq_tables (List[str]): List of BigQuery table names
            sa_json (str): Service account JSON (optional)
            
        Returns:
            Dict[str, Any]: Response dictionary with creation status
        """
        if not all([role_name, gcp_project, bq_dataset, bq_tables]):
            return {"ok": False, "error": "Missing required fields"}
        
        # Create and initialize the dedicated SQLite DB
        role_db = get_role_db_path(role_name)
        initialize_role_db(role_db)
        
        # Persist minimal config file alongside DB
        config = {
            "role_name": role_name, 
            "gcp_project": gcp_project, 
            "bq_dataset": bq_dataset, 
            "bq_tables": bq_tables, 
            "has_sa": bool(sa_json),
            "created_at": datetime.now().isoformat(),
            "total_records": 0,  # Will be updated after import
            "schema_descriptions": {} # Placeholder for BQ metadata
        }
        
        config_path = self.custom_dir / f"{role_name.replace(' ','_')}.json"
        config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2))
        
        # Optionally stash service account JSON (avoid mixing with repo)
        if sa_json.strip():
            sa_path = self.custom_dir / f"{role_name.replace(' ','_')}.sa.json"
            sa_path.write_text(sa_json)
        
        return {"ok": True}
    
    def import_role_data(self, role_name: str) -> Dict[str, Any]:
        """
        Import data from BigQuery into the role's SQLite database.
        
        Args:
            role_name (str): Name of the role to import data for
            
        Returns:
            Dict[str, Any]: Response dictionary with import status
        """
        if not role_name:
            return {"ok": False, "error": "Missing role_name"}
        
        role_db = get_role_db_path(role_name)
        cfg_path = self.custom_dir / f"{role_name.replace(' ','_')}.json"
        
        if not cfg_path.exists():
            return {"ok": False, "error": "Role not found"}
        
        cfg = json.loads(cfg_path.read_text())
        sa_path = self.custom_dir / f"{role_name.replace(' ','_')}.sa.json"
        sa_json = sa_path.read_text() if sa_path.exists() else None
        
        # Get BigQuery client
        try:
            client = get_bq_client(role_name)
            if not client:
                return {"ok": False, "error": "Failed to create BigQuery client. Service account JSON might be missing or invalid."}
        except Exception as e:
            return {"ok": False, "error": f"Failed to initialize BigQuery client: {str(e)}"}

        total_records_imported = 0
        schema_descriptions = {}

        # Prepare SQLite connection once
        conn = sqlite3.connect(str(role_db))
        cur = conn.cursor()

        # Simple BigQuery->SQLite type mapping
        def map_bq_type_to_sqlite(field_type: str) -> str:
            t = (field_type or "").upper()
            if t in ("INT64", "INTEGER"): return "INTEGER"
            if t in ("FLOAT64", "NUMERIC", "BIGNUMERIC", "FLOAT"): return "REAL"
            if t in ("BOOL", "BOOLEAN"): return "INTEGER"  # 0/1
            if t in ("TIMESTAMP", "DATETIME", "DATE", "TIME"): return "TEXT"
            return "TEXT"

        for table_name in cfg.get("bq_tables", []):
            try:
                # Fetch table and column metadata (descriptions)
                table_ref = client.get_table(f'{cfg['gcp_project']}.{cfg['bq_dataset']}.{table_name}')
                schema_descriptions[table_name] = {
                    "table_description": table_ref.description,
                    "columns": {field.name: field.description for field in table_ref.schema}
                }

                # Create SQLite table with mapped schema
                columns_sql = ", ".join(
                    [f'"{f.name}" {map_bq_type_to_sqlite(str(f.field_type))}' for f in table_ref.schema]
                )
                cur.execute(f'CREATE TABLE IF NOT EXISTS "{table_name}" ({columns_sql})')

                # Fetch data from BigQuery
                full_table_name = f"`{cfg['gcp_project']}.{cfg['bq_dataset']}.{table_name}`"
                query = f"SELECT * FROM {full_table_name}"
                rows = client.query(query).result()

                # Insert rows into SQLite in batches
                placeholders = ",".join(["?"] * len(table_ref.schema))
                insert_sql = f'INSERT INTO "{table_name}" VALUES ({placeholders})'
                batch = []
                batch_size = 500
                for row in rows:
                    # Preserve BigQuery field order
                    values = [row[f.name] for f in table_ref.schema]
                    batch.append(values)
                    if len(batch) >= batch_size:
                        cur.executemany(insert_sql, batch)
                        conn.commit()
                        total_records_imported += len(batch)
                        batch.clear()
                if batch:
                    cur.executemany(insert_sql, batch)
                    conn.commit()
                    total_records_imported += len(batch)

            except Exception as e:
                conn.rollback()
                return {"ok": False, "error": f"Error importing table {table_name}: {str(e)}"}
        
        conn.close()
        # Update config file with total records and schema descriptions
        try:
            cfg["total_records"] = total_records_imported
            cfg["schema_descriptions"] = schema_descriptions
            cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2))
        except Exception as e:
            # This is not a fatal error, so we just log it and continue
            logging.warning(f"Could not update config file for {role_name}: {str(e)}")

        return {"ok": True}
    
    def analyze_role(self, role_name: str) -> Dict[str, Any]:
        """
        Analyze a custom role's data and generate KPIs and visualizations.
        
        Args:
            role_name (str): Name of the role to analyze
            
        Returns:
            Dict[str, Any]: Response dictionary with analysis results
        """
        if not role_name:
            return {"ok": False, "error": "Missing role_name"}
        
        role_db = get_role_db_path(role_name)
        if not role_db.exists():
            return {"ok": False, "error": "Role DB not found"}
        
        # Build comprehensive data analysis for Gemini
        conn = sqlite3.connect(str(role_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Get table schema and sample data (exclude internal app tables)
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        all_tables = [r[0] for r in cur.fetchall()]
        
        # Filter out internal app tables - only analyze actual data tables
        internal_tables = {
            'proposed_actions', 'saved_analyses', 'saved_actions', 
            'chart_insights', 'action_notes', 'priority_notes',
            'priority_insights', 'analysis_runs'
        }
        tables = [t for t in all_tables if t not in internal_tables]
        
        if not tables:
            return {"ok": False, "error": "No data tables found in database"}
        
        # Load schema descriptions from config file
        safe_role_name = "".join(ch for ch in role_name if ch.isalnum() or ch in ("-","_"," ")).strip().replace(" ", "_")
        cfg_path = CUSTOM_DIR / f"{safe_role_name}.json"
        
        schema_descriptions = {}
        if cfg_path.exists():
            try:
                cfg = json.loads(cfg_path.read_text())
                schema_descriptions = cfg.get("schema_descriptions", {})
            except Exception:
                pass # Ignore if config can't be read

        data_analysis = {
            "role_name": role_name,
            "schema_descriptions": schema_descriptions,
            "tables": {}
        }
        
        for table in tables:
            try:
                # Get table schema
                cur.execute(f'PRAGMA table_info("{table}")')
                columns = [{"name": r[1], "type": r[2], "nullable": not r[3]} for r in cur.fetchall()]
                
                # Get row count
                cur.execute(f'SELECT COUNT(1) as cnt FROM "{table}"')
                row_count = cur.fetchone()["cnt"]
                
                # Get sample data (first 5 rows)
                cur.execute(f'SELECT * FROM "{table}" LIMIT 5')
                sample_data = [dict(r) for r in cur.fetchall()]
                
                # Get column value distributions for key columns
                distributions = {}
                for col in columns[:10]:  # Limit to first 10 columns
                    col_name = col["name"]
                    try:
                        cur.execute(f'SELECT DISTINCT "{col_name}", COUNT(1) as cnt FROM "{table}" GROUP BY "{col_name}" ORDER BY cnt DESC LIMIT 10')
                        distributions[col_name] = [dict(r) for r in cur.fetchall()]
                    except Exception:
                        pass
                
                data_analysis["tables"][table] = {
                    "row_count": row_count,
                    "columns": columns,
                    "sample_data": sample_data,
                    "distributions": distributions
                }
            except Exception as e:
                data_analysis["tables"][table] = {"error": str(e)}
        
        conn.close()
        
        # Ask Gemini for comprehensive KPI and visualization analysis
        try:
            table_name = list(data_analysis.get("tables", {}).keys())[0]
            prompt = f"""You are a data analyst bot writing SQLite queries. Your task is to generate a JSON object with KPIs, charts, and insights based STRICTLY on the provided schema for a '{role_name}'.

## Database Schema & Context
The database has one primary table named `{table_name}`. The detailed schema for this table, including column data types and value distributions, is in the JSON context.
IMPORTANT: The JSON context also contains `schema_descriptions` with descriptions for the table and each column from BigQuery. Use these descriptions to better understand the data's meaning and business context.

## CRITICAL RULES (Failure to follow will result in errors):
1.  **Use ONLY the `{table_name}` table and its real columns**: Every query MUST use the exact column names from the `{table_name}` schema. Do NOT invent columns.
2.  **Quote Column Names**: Column names with spaces or special characters MUST be enclosed in double quotes (e.g., '"Last_Week_This_Year_Sales"').
3.  **No Hallucination**: Do not assume any columns exist. If the data for a typical KPI (e.g., 'profit') is not available, calculate it from existing columns or do not create the KPI.
4.  **Valid SQLite ONLY**: All SQL must be 100% valid for SQLite.
5.  **KPI Formula Definition**: The `formula` for KPIs must be a complete `SELECT` statement that returns a single numeric value (e.g., 'SELECT SUM("Last_Week_This_Year_Sales") FROM pa_sales').

## Output Format
Return a single JSON object with `kpis`, `charts`, and `insights` keys. Ensure the SQL in `formula` and `query_sql` is correct based on the rules above.
{{
  "kpis": [{{
    "id": "kpi_unique_id", 
    "title": "KPI Title", 
    "description": "...", 
    "formula": "SELECT ...", 
    "table": "{table_name}"
  }}],
  "charts": [{{
    "id": "chart_unique_id", 
    "title": "Chart Title", 
    "type": "bar|line|pie|table", 
    "description": "...", 
    "query_sql": "SELECT ..."
  }}],
  "insights": ["..."]
}}
"""
            plan = _generate_json_from_model(prompt, json.dumps(data_analysis, ensure_ascii=False, indent=2))
            
            # Generate Enhanced Insights for each chart automatically
            conn = sqlite3.connect(str(role_db))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            
            # Create insights table if it doesn't exist
            cur.execute("""
                CREATE TABLE IF NOT EXISTS chart_insights (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id TEXT NOT NULL UNIQUE,
                    chart_title TEXT NOT NULL,
                    insights_json TEXT NOT NULL,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
            """)
            
            # Generate insights for each chart
            charts = plan.get("charts", [])
            for chart in charts:
                chart_id = chart.get("id")
                chart_title = chart.get("title", "Chart")
                chart_type = chart.get("type", "unknown")
                query_sql = chart.get("query_sql")
                
                if query_sql and chart_id:
                    try:
                        # Execute the chart query to get data
                        cur.execute(query_sql)
                        chart_data = [dict(r) for r in cur.fetchall()]
                        
                        if chart_data:
                            # Generate insights using Gemini
                            insights = generate_chart_insights(chart_title, chart_data, chart_type)
                            
                            if insights and chart_id:
                                # Store insights in the database
                                cur.execute("""
                                    INSERT INTO chart_insights (chart_id, chart_title, insights_json, updated_at)
                                    VALUES (?, ?, ?, datetime('now'))
                                    ON CONFLICT(chart_id) DO UPDATE SET
                                        insights_json = excluded.insights_json,
                                        chart_title = excluded.chart_title,
                                        updated_at = excluded.updated_at;
                                """, (chart_id, chart_title, json.dumps(insights)))
                                
                    except Exception as e:
                        print(f"Failed to generate insights for chart {chart_id}: {e}")
                        # Don't fail the entire process if insights fail for one chart
                        continue
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            return {"ok": False, "error": str(e)}
        
        # Save plan
        plan_path = self.custom_dir / f"{role_name.replace(' ','_')}.plan.json"
        plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2))
        
        return {"ok": True, "plan": plan}
    
    def get_role_config(self, role_name: str) -> Optional[Dict[str, Any]]:
        """Gets the configuration for a single role."""
        safe_role_name = "".join(ch for ch in role_name if ch.isalnum() or ch in ("-","_"," ")).strip().replace(" ", "_")
        config_path = self.custom_dir / f"{safe_role_name}.json"
        if config_path.exists():
            try:
                return json.loads(config_path.read_text())
            except Exception:
                return None
        return None
    
    def get_role_db_path(self, role_name: str) -> Path:
        """Get the database path for a custom role."""
        return get_role_db_path(role_name)

    def get_custom_roles(self) -> List[Dict[str, Any]]:
        """
        Get list of all available custom roles.
        
        Returns:
            List[Dict[str, Any]]: List of custom role information
        """
        custom_roles = []
        if self.custom_dir.exists():
            for config_file in self.custom_dir.glob("*.json"):
                if config_file.name.endswith(".plan.json") or config_file.name.endswith(".sa.json"):
                    continue
                try:
                    config = json.loads(config_file.read_text())
                    role_name = config.get("role_name", "")
                    if role_name:
                        custom_roles.append({
                            "name": role_name,
                            "id": role_name.replace(" ", "_").lower(),
                            "created": config_file.stat().st_mtime
                        })
                except Exception:
                    continue
        
        # Sort by creation time (newest first)
        custom_roles.sort(key=lambda x: x["created"], reverse=True)
        return custom_roles