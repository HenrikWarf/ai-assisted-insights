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
from services.bigquery_loader import import_tables_to_sqlite
from services.gemini_service import _generate_json_from_model, generate_chart_insights


# Custom roles directory
APP_ROOT = Path(__file__).parent.parent.parent.resolve()
CUSTOM_DIR = APP_ROOT / "custom_roles"
CUSTOM_DIR.mkdir(exist_ok=True)


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
        
        # Create dedicated SQLite DB
        role_db = get_role_db_path(role_name)
        conn = sqlite3.connect(str(role_db))
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.commit()
        conn.close()
        
        # Persist minimal config file alongside DB
        config = {
            "role_name": role_name, 
            "gcp_project": gcp_project, 
            "bq_dataset": bq_dataset, 
            "bq_tables": bq_tables, 
            "has_sa": bool(sa_json),
            "created_at": datetime.now().isoformat(),
            "total_records": 0  # Will be updated after import
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
        
        # Import from BigQuery into SQLite
        try:
            import_tables_to_sqlite(cfg, str(role_db), sa_json)
            
            # Calculate total record count after import
            conn = sqlite3.connect(str(role_db))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            
            total_records = 0
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            tables = [r[0] for r in cur.fetchall()]
            
            for table in tables:
                cur.execute(f"SELECT COUNT(1) as cnt FROM '{table}'")
                total_records += cur.fetchone()["cnt"]
            
            conn.close()
            
            # Update config with total record count
            cfg["total_records"] = total_records
            cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2))
            
        except Exception as e:
            return {"ok": False, "error": str(e)}
        
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
        
        # Get table schema and sample data
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [r[0] for r in cur.fetchall()]
        
        data_analysis = {
            "role_name": role_name,
            "tables": {}
        }
        
        for table in tables:
            try:
                # Get table schema
                cur.execute(f"PRAGMA table_info('{table}')")
                columns = [{"name": r[1], "type": r[2], "nullable": not r[3]} for r in cur.fetchall()]
                
                # Get row count
                cur.execute(f"SELECT COUNT(1) as cnt FROM '{table}'")
                row_count = cur.fetchone()["cnt"]
                
                # Get sample data (first 5 rows)
                cur.execute(f"SELECT * FROM '{table}' LIMIT 5")
                sample_data = [dict(r) for r in cur.fetchall()]
                
                # Get column value distributions for key columns
                distributions = {}
                for col in columns[:10]:  # Limit to first 10 columns
                    col_name = col["name"]
                    try:
                        cur.execute(f"SELECT DISTINCT {col_name}, COUNT(1) as cnt FROM '{table}' GROUP BY {col_name} ORDER BY cnt DESC LIMIT 10")
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
            prompt = (
                f"You are analyzing data for a '{role_name}' role. Based on the actual table schemas, sample data, and value distributions provided, "
                "generate meaningful KPIs and visualizations.\n\n"
                "Return JSON with this structure:\n"
                "{\n"
                '  "kpis": [\n'
                '    {"id": "kpi_id", "title": "KPI Name", "description": "What this measures", "formula": "SQL calculation", "table": "source_table"}\n'
                '  ],\n'
                '  "charts": [\n'
                '    {"id": "chart_id", "title": "Chart Title", "type": "line|bar|pie|table", "description": "What this shows", "query_sql": "SELECT ... FROM ..."}\n'
                '  ],\n'
                '  "insights": ["Key insight 1", "Key insight 2"]\n'
                "}\n\n"
                "Focus on:\n"
                "- Customer behavior patterns (if customer data exists)\n"
                "- Business metrics relevant to the role\n"
                "- Time-based trends (if date columns exist)\n"
                "- Segmentation opportunities\n"
                "- Performance indicators\n\n"
                "Generate SQLite-compatible queries. Use actual column names from the schema."
            )
            plan = _generate_json_from_model(prompt, json.dumps(data_analysis, ensure_ascii=False, indent=2))
            
            # Generate Enhanced Insights for each chart automatically
            conn = sqlite3.connect(str(role_db))
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()
            
            # Create insights table if it doesn't exist
            cur.execute("""
                CREATE TABLE IF NOT EXISTS chart_insights (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chart_id TEXT NOT NULL,
                    chart_title TEXT NOT NULL,
                    insights_json TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
                            
                            # Store insights in database
                            insights_json = json.dumps(insights)
                            cur.execute("""
                                INSERT INTO chart_insights (chart_id, chart_title, insights_json)
                                VALUES (?, ?, ?)
                            """, (chart_id, chart_title, insights_json))
                            
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
