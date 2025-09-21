"""
Analysis API routes.

This module contains Flask Blueprint for analysis-related API endpoints.
"""

from flask import Blueprint, request, jsonify, session
from app.models import build_metrics_for_role, filter_data_for_short_term
from app.database import get_db_connection
from services.gemini_service import analyze_metrics_short_term, analyze_metrics_long_term
import json

analysis_bp = Blueprint('analysis', __name__)


@analysis_bp.route("/api/analyze", methods=["POST"]) 
def api_analyze():
    """
    Analyze metrics for the current user's role using Gemini AI.
    
    Performs both short-term (2 weeks) and long-term (90 days) analysis
    and stores the results in the database.
    """
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    data = build_metrics_for_role(role)
    analysis = None
    analysis_error = None
    
    try:
        # Get short-term analysis (last 2 weeks)
        short_term_data = filter_data_for_short_term(data.get("metrics", {}))
        short_term_analysis = analyze_metrics_short_term(role, short_term_data)
        
        # Get long-term analysis (full 90 days)
        long_term_analysis = analyze_metrics_long_term(role, data.get("metrics", {}))
        
        analysis = {
            "role": role,
            "short_term": short_term_analysis,
            "long_term": long_term_analysis,
            "engine": "gemini",
            "auth_mode": "service_account",
            "model": "gemini-2.5-pro"
        }
        
        # Persist latest successful analysis
        if analysis and isinstance(analysis, dict):
            # Store both analyses in the database
            conn = get_db_connection()
            cur = conn.cursor()
            # Delete previous analysis for this role to ensure only latest is kept
            cur.execute("DELETE FROM analysis_runs WHERE role = ?", (role,))
            
            # Store short-term analysis
            short_prior = short_term_analysis.get("prioritized_issues", []) or []
            def extract(i):
                if i is None: return {"title":"","why":"","category":"","evidence":{}}
                cat = ""
                txt = f"{i.get('title','')} {i.get('why','')} {' '.join((i.get('evidence') or {}).keys())}".lower()
                if any(x in txt for x in ["roas","ctr","cvr","campaign","creative","paid","social","display","email"]): cat = "marketing"
                elif any(x in txt for x in ["lcp","fid","cls","perf","web","latency","page"]): cat = "performance"
                elif any(x in txt for x in ["checkout","payment","decline","gateway","failure"]): cat = "checkout"
                elif any(x in txt for x in ["search","zero result","query"]): cat = "search"
                elif any(x in txt for x in ["return","rma"]): cat = "returns"
                elif any(x in txt for x in ["sku","inventory","merch","pdp","plp"]): cat = "merch"
                return {
                    "title": i.get("title",""),
                    "why": i.get("why",""),
                    "category": cat,
                    "evidence": i.get("evidence") or {}
                }
            
            short_items = [extract(short_prior[0] if len(short_prior)>0 else None), extract(short_prior[1] if len(short_prior)>1 else None), extract(short_prior[2] if len(short_prior)>2 else None)]
            
            cur.execute(
                """
                INSERT INTO analysis_runs(role, summary,
                  issue1_title, issue1_why, issue1_category, issue1_evidence_json,
                  issue2_title, issue2_why, issue2_category, issue2_evidence_json,
                  issue3_title, issue3_why, issue3_category, issue3_evidence_json,
                  analysis_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    role, short_term_analysis.get("summary",""),
                    short_items[0]["title"], short_items[0]["why"], short_items[0]["category"], json.dumps(short_items[0]["evidence"], ensure_ascii=False),
                    short_items[1]["title"], short_items[1]["why"], short_items[1]["category"], json.dumps(short_items[1]["evidence"], ensure_ascii=False),
                    short_items[2]["title"], short_items[2]["why"], short_items[2]["category"], json.dumps(short_items[2]["evidence"], ensure_ascii=False),
                    json.dumps(analysis, ensure_ascii=False)
                )
            )
            conn.commit()
            conn.close()
            
            # Get the created timestamp for the new analysis
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT created_ts FROM analysis_runs WHERE role = ? ORDER BY created_ts DESC LIMIT 1", (role,))
            row = cur.fetchone()
            conn.close()
            analysis["created_ts"] = row["created_ts"] if row else None
    except Exception as e:
        analysis_error = str(e)
    
    return jsonify({"role": role, "analysis": analysis, "analysis_error": analysis_error})


@analysis_bp.route("/api/analysis_latest")
def api_analysis_latest():
    """
    Get the latest analysis for the current user's role.
    
    Returns the most recent analysis stored in the database.
    """
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM analysis_runs WHERE role=? ORDER BY created_ts DESC, id DESC LIMIT 1
        """,
        (role,)
    )
    row = cur.fetchone()
    conn.close()
    
    if not row:
        return jsonify({"role": role, "analysis": None})
    
    # Prefer the full saved JSON if present; fallback to columns
    try:
        analysis = json.loads(row["analysis_json"]) if row["analysis_json"] else None
    except Exception:
        analysis = None
    
    if not analysis:
        analysis = {
            "summary": row["summary"],
            "prioritized_issues": [
                {"priority":1, "title": row["issue1_title"], "why": row["issue1_why"], "category": row["issue1_category"], "evidence": row["issue1_evidence_json"]},
                {"priority":2, "title": row["issue2_title"], "why": row["issue2_why"], "category": row["issue2_category"], "evidence": row["issue2_evidence_json"]},
                {"priority":3, "title": row["issue3_title"], "why": row["issue3_why"], "category": row["issue3_category"], "evidence": row["issue3_evidence_json"]},
            ]
        }
    
    return jsonify({"role": role, "analysis": analysis, "created_ts": row["created_ts"]})


@analysis_bp.route("/api/custom_role/analyze", methods=["POST"])
def api_custom_role_analyze():
    """Analyze custom role metrics with Gemini."""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    if not role_name:
        return jsonify({"ok": False, "error": "Missing role_name"}), 400
    
    # Get the metrics for this custom role
    from app.models import get_role_db_path
    role_db = get_role_db_path(role_name)
    if not role_db.exists():
        return jsonify({"ok": False, "error": "Role DB not found"}), 404
    
    # Build metrics data similar to build_metrics_for_role
    import sqlite3
    conn = sqlite3.connect(str(role_db))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    metrics = {}
    from pathlib import Path
    APP_ROOT = Path(__file__).parent.parent.parent.resolve()
    CUSTOM_DIR = APP_ROOT / "custom_roles"
    plan_path = CUSTOM_DIR / f"{role_name.replace(' ','_')}.plan.json"
    
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
                if not q:
                    continue
                try:
                    cur.execute(q)
                    metrics[f"chart_{chart_id}"] = [dict(r) for r in cur.fetchall()]
                except Exception:
                    continue
        except Exception:
            pass
    conn.close()
    
    # Now analyze with Gemini
    analysis = None
    analysis_error = None
    try:
        # Get short-term analysis (last 2 weeks) - for custom roles, we'll use all available data
        short_term_analysis = analyze_metrics_short_term(role_name, metrics)
        
        # Get long-term analysis (full dataset)
        long_term_analysis = analyze_metrics_long_term(role_name, metrics)
        
        analysis = {
            "role": role_name,
            "short_term": short_term_analysis,
            "long_term": long_term_analysis,
            "engine": "gemini",
            "auth_mode": "service_account",
            "model": "gemini-2.5-pro"
        }
        
        # Save analysis to database (similar to built-in roles)
        if analysis and isinstance(analysis, dict):
            conn = get_db_connection()
            cur = conn.cursor()
            # Delete previous analysis for this role to ensure only latest is kept
            cur.execute("DELETE FROM analysis_runs WHERE role = ?", (role_name,))
            
            # Store short-term analysis
            short_prior = short_term_analysis.get("prioritized_issues", []) or []
            def extract(i):
                if i is None: return {"title":"","why":"","category":"","evidence":{}}
                cat = ""
                txt = f"{i.get('title','')} {i.get('why','')} {' '.join((i.get('evidence') or {}).keys())}".lower()
                if any(x in txt for x in ["roas","ctr","cvr","campaign","creative","paid","social","display","email"]): cat = "marketing"
                elif any(x in txt for x in ["lcp","fid","cls","perf","web","latency","page"]): cat = "performance"
                elif any(x in txt for x in ["checkout","payment","decline","gateway","failure"]): cat = "checkout"
                elif any(x in txt for x in ["search","zero result","query"]): cat = "search"
                elif any(x in txt for x in ["return","rma"]): cat = "returns"
                elif any(x in txt for x in ["sku","inventory","merch","pdp","plp"]): cat = "merch"
                return {
                    "title": i.get("title",""),
                    "why": i.get("why",""),
                    "category": cat,
                    "evidence": i.get("evidence") or {}
                }
            
            short_items = [extract(short_prior[0] if len(short_prior)>0 else None), extract(short_prior[1] if len(short_prior)>1 else None), extract(short_prior[2] if len(short_prior)>2 else None)]
            
            cur.execute(
                """
                INSERT INTO analysis_runs(role, summary,
                  issue1_title, issue1_why, issue1_category, issue1_evidence_json,
                  issue2_title, issue2_why, issue2_category, issue2_evidence_json,
                  issue3_title, issue3_why, issue3_category, issue3_evidence_json,
                  analysis_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    role_name, short_term_analysis.get("summary",""),
                    short_items[0]["title"], short_items[0]["why"], short_items[0]["category"], json.dumps(short_items[0]["evidence"], ensure_ascii=False),
                    short_items[1]["title"], short_items[1]["why"], short_items[1]["category"], json.dumps(short_items[1]["evidence"], ensure_ascii=False),
                    short_items[2]["title"], short_items[2]["why"], short_items[2]["category"], json.dumps(short_items[2]["evidence"], ensure_ascii=False),
                    json.dumps(analysis, ensure_ascii=False)
                )
            )
            conn.commit()
            conn.close()
            
            # Get the created timestamp for the new analysis
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT created_ts FROM analysis_runs WHERE role = ? ORDER BY created_ts DESC LIMIT 1", (role_name,))
            row = cur.fetchone()
            conn.close()
            analysis["created_ts"] = row["created_ts"] if row else None
            
    except Exception as e:
        analysis_error = str(e)
    
    return jsonify({
        "ok": True,
        "analysis": analysis,
        "analysis_error": analysis_error
    })


@analysis_bp.route("/api/custom_role/analysis_latest")
def api_custom_role_analysis_latest():
    """Get latest analysis for custom role."""
    role_name = request.args.get("role_name", "").strip()
    if not role_name:
        return jsonify({"error": "Missing role_name"}), 400
    
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT * FROM analysis_runs WHERE role=? ORDER BY created_ts DESC, id DESC LIMIT 1
        """,
        (role_name,)
    )
    row = cur.fetchone()
    conn.close()
    
    if not row:
        return jsonify({"role": role_name, "analysis": None})
    
    # Prefer the full saved JSON if present; fallback to columns
    try:
        analysis = json.loads(row["analysis_json"]) if row["analysis_json"] else None
    except Exception:
        analysis = None
    
    if not analysis:
        analysis = {
            "summary": row["summary"],
            "prioritized_issues": [
                {"priority":1, "title": row["issue1_title"], "why": row["issue1_why"], "category": row["issue1_category"], "evidence": row["issue1_evidence_json"]},
                {"priority":2, "title": row["issue2_title"], "why": row["issue2_why"], "category": row["issue2_category"], "evidence": row["issue2_evidence_json"]},
                {"priority":3, "title": row["issue3_title"], "why": row["issue3_why"], "category": row["issue3_category"], "evidence": row["issue3_evidence_json"]},
            ]
        }
    
    return jsonify({"role": role_name, "analysis": analysis, "created_ts": row["created_ts"]})
