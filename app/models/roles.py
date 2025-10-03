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
def get_bq_client(role_name: str, sa_info: Optional[Dict[str, Any]] = None):
    """Initializes a BigQuery client from service account info (dictionary)."""
    if not sa_info:
        logging.warning(f"Service account info not provided for role: {role_name}. Falling back to default credentials.")
        try:
            # Fallback to default credentials if available (e.g., gcloud auth)
            return bigquery.Client()
        except Exception as e:
            logging.error(f"Failed to create BQ client with default credentials: {e}")
            return None

    try:
        # Create a sanitized copy for logging, excluding the private key
        sanitized_sa_info = sa_info.copy()
        private_key = sanitized_sa_info.pop('private_key', None)
        
        logging.info("Attempting to create BigQuery client with the following service account info (private key excluded):")
        logging.info(json.dumps(sanitized_sa_info, indent=2))
        
        if private_key:
            logging.info("Service account private key is present.")
            logging.info(f"Private key length: {len(private_key)}")
        else:
            logging.warning("Service account private key is MISSING from the provided info.")

        credentials = service_account.Credentials.from_service_account_info(sa_info)
        return bigquery.Client(credentials=credentials, project=credentials.project_id)
    except Exception as e:
        logging.error(f"Failed to create BQ client from service account info: {e}")
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
            sa_json (str): Service account JSON string (optional).
            
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
            "has_sa": bool(sa_json.strip()),
            "created_at": datetime.now().isoformat(),
            "total_records": 0,  # Will be updated after import
            "schema_descriptions": {} # Placeholder for BQ metadata
        }
        
        config_path = self.custom_dir / f"{role_name.replace(' ','_')}.json"
        config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2))
        
        # Optionally stash service account JSON (avoid mixing with repo)
        if sa_json.strip():
            try:
                # Parse the incoming string to validate and format it
                sa_data = json.loads(sa_json)
                formatted_sa_json = json.dumps(sa_data, indent=2)
                
                sa_path = self.custom_dir / f"{role_name.replace(' ','_')}.sa.json"
                sa_path.write_text(formatted_sa_json)
            except json.JSONDecodeError:
                return {"ok": False, "error": "The provided service account credential was not valid JSON."}
        
        return {"ok": True}
    
    def import_role_data(self, role_name: str) -> Dict[str, Any]:
        """
        Import data from BigQuery into the role's SQLite database.
        
        Args:
            role_name (str): Name of the role to import data for
            
        Returns:
            Dict[str, Any]: Response dictionary with import status
        """
        logging.info(f"Starting import process for role: {role_name}")
        if not role_name:
            logging.error("Import failed: role_name is missing.")
            return {"ok": False, "error": "Missing role_name"}

        cfg_path = self.custom_dir / f"{role_name.replace(' ','_')}.json"
        logging.info(f"Looking for config file at: {cfg_path}")
        if not cfg_path.exists():
            logging.error(f"Config file not found for role: {role_name}")
            return {"ok": False, "error": "Role configuration not found."}

        try:
            cfg = json.loads(cfg_path.read_text())
            logging.info("Successfully loaded role configuration.")
        except json.JSONDecodeError:
            logging.error(f"Failed to parse config file for role: {role_name}")
            return {"ok": False, "error": "Role configuration file is corrupted."}

        sa_path = self.custom_dir / f"{role_name.replace(' ','_')}.sa.json"
        sa_info = None
        if sa_path.exists():
            logging.info("Service account file found, attempting to load.")
            try:
                sa_info = json.loads(sa_path.read_text())
                logging.info("Successfully loaded service account file.")
            except json.JSONDecodeError:
                logging.error(f"Failed to parse service account file for role: {role_name}")
                return {"ok": False, "error": "Service account file is corrupted and not valid JSON."}
        else:
            logging.warning("No service account file found for role.")

        logging.info("Attempting to get BigQuery client...")
        try:
            client = get_bq_client(role_name, sa_info)
            if not client:
                # The error is already logged inside get_bq_client
                return {"ok": False, "error": "Failed to create BigQuery client. Please check server logs for details."}
            logging.info("Successfully obtained BigQuery client.")
        except Exception as e:
            logging.error(f"An unexpected error occurred while getting BigQuery client: {e}")
            return {"ok": False, "error": f"Failed to initialize BigQuery client: {str(e)}"}

        total_records_imported = 0
        schema_descriptions = {}

        # Prepare SQLite connection once
        conn = sqlite3.connect(str(get_role_db_path(role_name)))
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
                logging.info(f"Importing table: {table_name}")
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
                logging.info(f"Successfully imported {total_records_imported} records for table {table_name}.")

            except Exception as e:
                conn.rollback()
                logging.error(f"Error importing table {table_name}: {e}")
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

        logging.info(f"Import process finished successfully for role: {role_name}")
        return {"ok": True}
    
    def analyze_role(self, role_name: str) -> Dict[str, Any]:
        """
        Analyze a custom role's data and generate KPIs and visualizations using a modular, multi-step process.
        """
        if not role_name:
            return {"ok": False, "error": "Missing role_name"}

        role_db = get_role_db_path(role_name)
        if not role_db.exists():
            return {"ok": False, "error": "Role DB not found"}

        # --- 1. GATHER CONTEXT & PATCH SCHEMA ---
        conn = sqlite3.connect(str(role_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # Patch: Add chart_title column to chart_insights if it doesn't exist
        try:
            cur.execute("ALTER TABLE chart_insights ADD COLUMN chart_title TEXT NOT NULL DEFAULT 'Untitled Chart'")
            conn.commit()
            logging.info("Patched chart_insights table with chart_title column.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" not in str(e):
                raise # Re-raise if it's not the error we expect

        internal_tables = {
            'proposed_actions', 'saved_analyses', 'saved_actions', 
            'chart_insights', 'action_notes', 'priority_notes',
            'priority_insights', 'analysis_runs'
        }
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        all_tables = [r[0] for r in cur.fetchall()]
        tables = [t for t in all_tables if t not in internal_tables]

        if not tables:
            return {"ok": False, "error": "No data tables found in database"}
        table_name = tables[0] # Focus on the single imported table

        # Load schema descriptions from config file
        cfg_path = self.custom_dir / f"{role_name.replace(' ','_')}.json"
        schema_descriptions = {}
        if cfg_path.exists():
            try:
                cfg = json.loads(cfg_path.read_text())
                schema_descriptions = cfg.get("schema_descriptions", {})
            except Exception: pass

        # Build the data analysis context object
        data_analysis = {"role_name": role_name, "schema_descriptions": schema_descriptions, "tables": {}}
        try:
            cur.execute(f'PRAGMA table_info("{table_name}")')
            columns = [{"name": r[1], "type": r[2], "nullable": not r[3]} for r in cur.fetchall()]
            column_names_list = [c['name'] for c in columns]
            cur.execute(f'SELECT COUNT(1) as cnt FROM "{table_name}"')
            row_count = cur.fetchone()["cnt"]
            cur.execute(f'SELECT * FROM "{table_name}" LIMIT 5')
            sample_data = [dict(r) for r in cur.fetchall()]
            data_analysis["tables"][table_name] = {
                "row_count": row_count,
                "columns": columns,
                "sample_data": sample_data
            }
        except Exception as e:
            conn.close()
            return {"ok": False, "error": f"Failed to analyze table schema: {e}"}
        
        context_json = json.dumps(data_analysis, ensure_ascii=False, indent=2)
        logging.info(f"--- PROMPT CONTEXT ---\n{context_json}")

        try:
            # --- 2. STEP 1: Identify Key Concepts ---
            concepts_prompt = f"""You are a data analyst. Analyze the schema and data for the table '{table_name}'. 
            Identify the key business concepts, primary metrics, and important dimensions available in this table. 
            Return a JSON object with three keys: 'key_concepts' (list of strings), 'key_metrics' (list of strings), and 'key_dimensions' (list of strings)."""
            concepts = _generate_json_from_model(concepts_prompt, context_json)

            # --- 3. STEP 2: Generate KPIs (with dynamic examples) ---
            numeric_col_example = "some_column"
            for col in reversed(column_names_list):
                if any(kw in col.lower() for kw in ['sales', 'amount', 'price', 'qty', 'count']):
                    numeric_col_example = col
                    break
            else:
                if column_names_list:
                    numeric_col_example = column_names_list[-1]

            kpis_prompt = f"""You are a SQL expert generating SQLite queries for a table named '{table_name}'.
            The available columns are: {json.dumps(column_names_list)}.
            CRITICAL RULE: You MUST use ONLY these column names in your queries. Any other column name is invalid.
            For example, a correct query is 'SELECT SUM("{numeric_col_example}") FROM "{table_name}"'. An INCORRECT query is 'SELECT SUM(revenue) FROM "{table_name}"' because 'revenue' is not in the list of available columns.
            Given these rules, generate a list of relevant KPIs. Each KPI must be a JSON object with 'id', 'title', 'description', and a 'formula'. The 'formula' must be a complete, valid SQLite SELECT statement."""
            kpis_response = _generate_json_from_model(kpis_prompt, context_json)
            kpis = kpis_response.get("kpis", []) if isinstance(kpis_response, dict) else kpis_response

            # --- 4. STEP 3: Generate Charts (with dynamic examples) ---
            text_col_example = "some_category"
            for col in column_names_list:
                if any(kw in col.lower() for kw in ['name', 'area', 'category', 'product', 'region']):
                    text_col_example = col
                    break
            else:
                if column_names_list:
                    text_col_example = column_names_list[0]

            charts_prompt = f"""You are a SQL expert generating SQLite queries for a table named '{table_name}'.
            The available columns are: {json.dumps(column_names_list)}.
            CRITICAL RULE: You MUST use ONLY these column names in your queries. Any other column name is invalid.
            For example, a correct query is 'SELECT "{text_col_example}", SUM("{numeric_col_example}") FROM "{table_name}" GROUP BY "{text_col_example}"'. An INCORRECT query is 'SELECT product, SUM(sales) FROM "{table_name}" GROUP BY product' because 'product' and 'sales' are not in the list of available columns.
            Given these rules, generate a list of relevant visualizations. Each chart must be a JSON object with 'id', 'title', 'description', a 'type' ('bar', 'line', 'pie', or 'table'), and a 'query_sql'. The 'query_sql' must be a complete, valid SQLite query."""
            charts_response = _generate_json_from_model(charts_prompt, context_json)
            charts = charts_response.get("charts", []) if isinstance(charts_response, dict) else charts_response

            # --- 5. VALIDATE & ENHANCE ---
            validated_kpis = []
            for kpi in kpis:
                try:
                    cur.execute(kpi['formula'])
                    cur.fetchone()
                    kpi['table'] = table_name # Add table name for frontend
                    validated_kpis.append(kpi)
                except Exception as e:
                    logging.warning(f"Discarding invalid KPI '{kpi.get('title')}': {e}")

            validated_charts = []
            for chart in charts:
                try:
                    cur.execute(chart['query_sql'])
                    chart_data = [dict(r) for r in cur.fetchall()]
                    if chart_data:
                        validated_charts.append(chart)
                        # Generate and store enhanced insights for the valid chart
                        insights = generate_chart_insights(chart.get('title'), chart_data, chart.get('type'))
                        if insights and chart.get('id'):
                            cur.execute("""CREATE TABLE IF NOT EXISTS chart_insights (id INTEGER PRIMARY KEY, chart_id TEXT NOT NULL UNIQUE, chart_title TEXT, insights_json TEXT, created_at TEXT, updated_at TEXT)""")
                            cur.execute("""INSERT INTO chart_insights (chart_id, chart_title, insights_json, updated_at) VALUES (?, ?, ?, datetime('now'))
                                       ON CONFLICT(chart_id) DO UPDATE SET insights_json=excluded.insights_json, chart_title=excluded.chart_title, updated_at=excluded.updated_at;""", 
                                       (chart['id'], chart['title'], json.dumps(insights)))
                except Exception as e:
                    logging.warning(f"Discarding invalid chart '{chart.get('title')}': {e}")

            # --- 6. FINALIZE PLAN ---
            final_plan = {
                "kpis": validated_kpis,
                "charts": validated_charts,
                "insights": concepts.get('key_concepts', []) if isinstance(concepts, dict) else []
            }
            conn.commit()

        except Exception as e:
            return {"ok": False, "error": f"Failed during analysis generation: {str(e)}"}
        finally:
            conn.close()

        # Save the final validated plan
        plan_path = self.custom_dir / f"{role_name.replace(' ','_')}.plan.json"
        plan_path.write_text(json.dumps(final_plan, ensure_ascii=False, indent=2))
        
        return {"ok": True, "plan": final_plan}
    
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