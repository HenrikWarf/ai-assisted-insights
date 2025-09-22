from flask import Flask, request, jsonify, send_from_directory, session, redirect
from dotenv import load_dotenv
import os
import sqlite3
from pathlib import Path
import json

load_dotenv()

APP_ROOT = Path(__file__).parent.resolve()
STATIC_DIR = APP_ROOT / "static"
DATA_DIR = APP_ROOT / "data"
DB_PATH = DATA_DIR / "cfc.db"

app = Flask(__name__, static_folder=str(STATIC_DIR))
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")


def get_db_connection():
	DATA_DIR.mkdir(parents=True, exist_ok=True)
	conn = sqlite3.connect(str(DB_PATH))
	conn.row_factory = sqlite3.Row
	return conn


@app.route("/")
def index():
	return send_from_directory(str(STATIC_DIR), "index.html")


@app.route("/dashboard")
def dashboard_page():
	if "role" not in session:
		return redirect("/")
	return send_from_directory(str(STATIC_DIR), "dashboard.html")

@app.route("/register")
def register_page():
    return send_from_directory(str(STATIC_DIR), "register.html")

@app.route("/dashboard/<role_name>")
def custom_dashboard_page(role_name):
    # Serve a generic dashboard for custom roles; client JS will fetch custom data
    return send_from_directory(str(STATIC_DIR), "dashboard.html")


# --- New Role (Custom Data) APIs ---
CUSTOM_DIR = APP_ROOT / "custom_roles"
CUSTOM_DIR.mkdir(exist_ok=True)

def _role_db_path(role_name: str) -> Path:
    safe = "".join(ch for ch in role_name if ch.isalnum() or ch in ("-","_"," ")).strip().replace(" ", "_")
    return CUSTOM_DIR / f"{safe}.db"

@app.route("/api/new_role/create", methods=["POST"])
def api_new_role_create():
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    gcp_project = (payload.get("gcp_project") or "").strip()
    bq_dataset = (payload.get("bq_dataset") or "").strip()
    bq_tables = payload.get("bq_tables") or []
    sa_json = payload.get("sa_json") or ""
    if not role_name or not gcp_project or not bq_dataset or not bq_tables:
        return jsonify({"ok": False, "error": "Missing required fields"}), 400
    # Create dedicated SQLite DB
    role_db = _role_db_path(role_name)
    conn = sqlite3.connect(str(role_db))
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.commit()
    conn.close()
    # Persist minimal config file alongside DB
    from datetime import datetime
    config = {
        "role_name": role_name, 
        "gcp_project": gcp_project, 
        "bq_dataset": bq_dataset, 
        "bq_tables": bq_tables, 
        "has_sa": bool(sa_json),
        "created_at": datetime.now().isoformat(),
        "total_records": 0  # Will be updated after import
    }
    (CUSTOM_DIR / f"{role_name.replace(' ','_')}.json").write_text(json.dumps(config, ensure_ascii=False, indent=2))
    # Optionally stash service account JSON (avoid mixing with repo)
    if sa_json.strip():
        (CUSTOM_DIR / f"{role_name.replace(' ','_')}.sa.json").write_text(sa_json)
    return jsonify({"ok": True})

@app.route("/api/new_role/import", methods=["POST"])
def api_new_role_import():
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    if not role_name:
        return jsonify({"ok": False, "error": "Missing role_name"}), 400
    role_db = _role_db_path(role_name)
    cfg_path = CUSTOM_DIR / f"{role_name.replace(' ','_')}.json"
    if not cfg_path.exists():
        return jsonify({"ok": False, "error": "Role not found"}), 404
    cfg = json.loads(cfg_path.read_text())
    sa_path = CUSTOM_DIR / f"{role_name.replace(' ','_')}.sa.json"
    sa_json = sa_path.read_text() if sa_path.exists() else None
    # Import from BigQuery into SQLite
    try:
        from services.bigquery_loader import import_tables_to_sqlite
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
        return jsonify({"ok": False, "error": str(e)}), 500
    return jsonify({"ok": True})

@app.route("/api/new_role/analyze", methods=["POST"])
def api_new_role_analyze():
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    if not role_name:
        return jsonify({"ok": False, "error": "Missing role_name"}), 400
    role_db = _role_db_path(role_name)
    if not role_db.exists():
        return jsonify({"ok": False, "error": "Role DB not found"}), 404
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
        from services.gemini_service import _generate_json_from_model
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
                        from services.gemini_service import generate_chart_insights
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
        return jsonify({"ok": False, "error": str(e)}), 500
    # Save plan
    (CUSTOM_DIR / f"{role_name.replace(' ','_')}.plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2))
    return jsonify({"ok": True, "plan": plan})

@app.route("/api/new_role/finalize", methods=["POST"])
def api_new_role_finalize():
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    if not role_name:
        return jsonify({"ok": False, "error": "Missing role_name"}), 400
    # For now, nothing extra to do. Frontend will navigate to dashboard.
    return jsonify({"ok": True})


@app.route("/login", methods=["POST"]) 
def login():
	data = request.get_json(silent=True) or {}
	role = data.get("role") or request.form.get("role") or request.args.get("role")
	def normalize(value: str) -> str:
		if not value:
			return ""
		# Normalize whitespace and hyphen-like characters
		v = value.strip()
		for ch in ["\u2010", "\u2011", "\u2012", "\u2013", "\u2014", "\u2212"]:
			v = v.replace(ch, "-")
		return v
	role = normalize(role)
	# Accept current and previous role labels; compare with aggressive normalization
	canonical = {
		"ecommerce manager": "E-commerce Manager",
		"e-commerce manager": "E-commerce Manager",
		"marketing lead": "Marketing Lead",
		"merchandiser": "Merchandiser",
		"store manager": "Marketing Lead" if os.getenv("ALLOW_STORE_MANAGER_AS_MARKETING", "1") == "1" else "Store Manager",
	}
	def clean_key(v: str) -> str:
		return v.lower().replace("-", "").replace(" ", "")
	lookup = {clean_key(k): v for k, v in canonical.items()}
	key = clean_key(role)
	if key not in lookup:
		# Fallback to E-commerce Manager to avoid blocking login during UI changes
		fallback = "E-commerce Manager"
		session["role"] = fallback
		session["user"] = "Henrik Warfvinge"  # Default user
		return jsonify({"ok": True, "role": fallback, "note": "Unrecognized role received; defaulted.", "received": role})
	session["role"] = lookup[key]
	session["user"] = "Henrik Warfvinge"  # Default user
	return jsonify({"ok": True, "role": lookup[key]})


@app.route("/logout", methods=["POST"]) 
def logout():
	session.clear()
	return jsonify({"ok": True})


@app.route("/api/insights")
def get_insights():
	if "role" not in session:
		return jsonify({"error": "Unauthorized"}), 401
	role = session["role"]
	conn = get_db_connection()
	cur = conn.cursor()
	# Example: latest sales by product and store, low inventory, hot sellers
	cur.execute(
		"""
		SELECT s.id as sale_id, p.name as product, st.name as store, s.quantity, s.sale_ts
		FROM sales s
		JOIN products p ON s.product_id = p.id
		JOIN stores st ON s.store_id = st.id
		ORDER BY s.sale_ts DESC
		LIMIT 10
		"""
	)
	recent_sales = [dict(row) for row in cur.fetchall()]

	cur.execute(
		"""
		SELECT p.name as product, st.name as store, i.on_hand, i.threshold
		FROM inventory i
		JOIN products p ON i.product_id = p.id
		JOIN stores st ON i.store_id = st.id
		WHERE i.on_hand <= i.threshold
		ORDER BY i.on_hand ASC
		LIMIT 10
		"""
	)
	low_inventory = [dict(row) for row in cur.fetchall()]

	conn.close()

	recommendations = []
	gemini_error = None
	# Note: Recommendations are now provided by /api/analyze endpoint using analyze_metrics()

	return jsonify({
		"role": role,
		"recent_sales": recent_sales,
		"low_inventory": low_inventory,
		"recommendations": recommendations,
		"gemini_error": gemini_error,
	})


def filter_data_for_short_term(data: dict) -> dict:
	"""Filter data to only include the last 2 weeks for short-term analysis."""
	from datetime import datetime, timedelta
	
	# Calculate 2 weeks ago
	two_weeks_ago = (datetime.now() - timedelta(days=14)).strftime('%Y-%m-%d')
	
	filtered_data = {}
	for key, values in data.items():
		if isinstance(values, list) and len(values) > 0:
			# Filter to only include data from last 2 weeks
			filtered_values = [item for item in values if item.get('day', '') >= two_weeks_ago]
			filtered_data[key] = filtered_values
		else:
			filtered_data[key] = values
	
	return filtered_data


def build_metrics_for_role(role: str) -> dict:
	conn = get_db_connection()
	cur = conn.cursor()
	resp = {}
	# E-commerce metrics (up to ~90 days) - ORDER BY day ASC for chronological analysis
	cur.execute("SELECT * FROM vw_ecom_daily_funnel ORDER BY day ASC LIMIT 90")
	resp["ecom_funnel"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_payment_failures ORDER BY day ASC LIMIT 90")
	resp["payment_failures"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_zero_result_search ORDER BY day ASC LIMIT 90")
	resp["zero_result_search"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_plp_perf ORDER BY day ASC LIMIT 90")
	resp["plp_perf"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_product_conv WHERE product IN ('Sneakers','Denim Jacket','Graphic Tee','Chino Pants','Hoodie') ORDER BY day ASC LIMIT 120")
	resp["product_conv"] = [dict(r) for r in cur.fetchall()]
	# Advanced e-com
	cur.execute("SELECT * FROM vw_ecom_rates_by_day ORDER BY day ASC LIMIT 180")
	resp["ecom_rates_by_day"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_ecom_mobile_desktop_delta ORDER BY day ASC LIMIT 90")
	resp["ecom_mobile_desktop_delta"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_zero_result_top_share ORDER BY day ASC LIMIT 90")
	resp["zero_result_top_share"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_sku_efficiency ORDER BY day ASC LIMIT 500")
	resp["sku_efficiency"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_return_rate_trend ORDER BY day ASC LIMIT 180")
	resp["return_rate_trend"] = [dict(r) for r in cur.fetchall()]
	# Marketing metrics
	cur.execute("SELECT * FROM vw_mkt_roas_campaign ORDER BY day ASC, roas ASC LIMIT 180")
	resp["mkt_roas_campaign"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_creative_ctr ORDER BY day ASC")
	resp["creative_ctr"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_budget_pacing_var ORDER BY day ASC LIMIT 220")
	resp["budget_pacing"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_disapprovals ORDER BY day ASC LIMIT 180")
	resp["disapprovals"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_brand_health ORDER BY day ASC LIMIT 90")
	resp["brand_health"] = [dict(r) for r in cur.fetchall()]
	# Advanced mkt
	cur.execute("SELECT * FROM vw_campaign_kpis ORDER BY day ASC LIMIT 400")
	resp["campaign_kpis"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_disapproval_rate ORDER BY day ASC LIMIT 180")
	resp["disapproval_rate"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_brand_lift_proxy ORDER BY day ASC LIMIT 90")
	resp["brand_lift_proxy"] = [dict(r) for r in cur.fetchall()]
	cur.execute("SELECT * FROM vw_sentiment_social_roas ORDER BY day ASC LIMIT 90")
	resp["sentiment_social_roas"] = [dict(r) for r in cur.fetchall()]
	conn.close()
	# Filter by role
	if role == "E-commerce Manager":
		for k in [
			"mkt_roas_campaign","creative_ctr","budget_pacing","disapprovals","brand_health",
			"campaign_kpis","disapproval_rate","brand_lift_proxy","sentiment_social_roas"
		]:
			resp.pop(k, None)
	elif role == "Marketing Lead":
		for k in [
			"ecom_funnel","payment_failures","zero_result_search","plp_perf","product_conv",
			"ecom_rates_by_day","ecom_mobile_desktop_delta","zero_result_top_share","sku_efficiency","return_rate_trend"
		]:
			resp.pop(k, None)
	return {"role": role, "metrics": resp}


@app.route("/api/metrics")
def api_metrics():
	if "role" not in session:
		return jsonify({"error": "Unauthorized"}), 401
	role = session["role"]
	data = build_metrics_for_role(role)
	data["user"] = session.get("user", "Unknown User")
	return jsonify(data)

@app.route("/api/custom_roles")
def api_custom_roles():
    """List all available custom roles for the homepage"""
    custom_roles = []
    if CUSTOM_DIR.exists():
        for config_file in CUSTOM_DIR.glob("*.json"):
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
    return jsonify({"custom_roles": custom_roles})

@app.route("/api/custom_role/analyze", methods=["POST"])
def api_custom_role_analyze():
    """Analyze custom role metrics with Gemini"""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    if not role_name:
        return jsonify({"ok": False, "error": "Missing role_name"}), 400
    
    # Get the metrics for this custom role
    role_db = _role_db_path(role_name)
    if not role_db.exists():
        return jsonify({"ok": False, "error": "Role DB not found"}), 404
    
    # Build metrics data similar to build_metrics_for_role
    conn = sqlite3.connect(str(role_db))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    metrics = {}
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
        from services.gemini_service import analyze_metrics_short_term, analyze_metrics_long_term
        
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

@app.route("/api/custom_role/generate_viz", methods=["POST"])
def api_custom_role_generate_viz():
    """Generate custom visualization using Gemini"""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    description = (payload.get("description") or "").strip()
    chart_id = payload.get("chart_id")  # None for new charts, existing ID for edits
    
    if not role_name or not description:
        return jsonify({"ok": False, "error": "Missing role_name or description"}), 400
    
    # Get the role's database and plan
    role_db = _role_db_path(role_name)
    if not role_db.exists():
        return jsonify({"ok": False, "error": "Role DB not found"}), 404
    
    plan_path = CUSTOM_DIR / f"{role_name.replace(' ','_')}.plan.json"
    if not plan_path.exists():
        return jsonify({"ok": False, "error": "Role plan not found"}), 404
    
    try:
        # Load existing plan
        plan = json.loads(plan_path.read_text())
        
        # Get database schema for context
        conn = sqlite3.connect(str(role_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Get table information
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [r[0] for r in cur.fetchall()]
        
        schema_info = {}
        for table in tables:
            cur.execute(f"PRAGMA table_info('{table}')")
            columns = [{"name": r[1], "type": r[2]} for r in cur.fetchall()]
            cur.execute(f"SELECT COUNT(1) as cnt FROM '{table}'")
            row_count = cur.fetchone()["cnt"]
            schema_info[table] = {"columns": columns, "row_count": row_count}
        
        conn.close()
        
        # Prepare context for Gemini
        context = {
            "role_name": role_name,
            "description": description,
            "is_edit": chart_id is not None,
            "existing_charts": plan.get("charts", []),
            "schema": schema_info
        }
        
        if chart_id:
            # Find the existing chart being edited
            existing_chart = None
            for chart in plan.get("charts", []):
                if chart.get("id") == chart_id:
                    existing_chart = chart
                    break
            if existing_chart:
                context["existing_chart"] = existing_chart
        
        # Generate visualization using Gemini
        from services.gemini_service import _generate_json_from_model
        
        prompt = f"""
You are a data visualization expert. Based on the user's request and the available database schema, generate a new chart configuration.

Context:
- Role: {role_name}
- User Request: "{description}"
- Available Tables: {list(schema_info.keys())}
- Schema: {json.dumps(schema_info, indent=2)}

{"- Editing existing chart: " + json.dumps(existing_chart) if chart_id and existing_chart else "- Creating new chart"}

CHART TYPE EXTRACTION:
First, analyze the user's request to determine the most appropriate chart type. ALWAYS RESPECT EXPLICIT CHART TYPE REQUESTS.

**PRIORITY RULES:**
1. **If user explicitly mentions a chart type** (e.g., "bar chart", "line chart", "pie chart"), USE THAT TYPE regardless of data size or structure
2. **If user says "bar chart for distribution"**, create a bar chart even for small datasets
3. **For EDIT operations**: ALWAYS respect the user's chart type preference, even if it seems "wrong" for the data
4. **Only auto-select chart types when user doesn't specify AND it's a new chart**

**Chart Type Guidelines:**
1. **Line Chart**: Use for time series, trends over time, continuous data
   - Keywords: "trend", "over time", "monthly", "daily", "yearly", "growth", "decline", "change", "evolution"
   - Explicit: "line chart", "line graph", "trend line"

2. **Bar Chart**: Use for comparisons, categories, discrete data, distributions
   - Keywords: "compare", "by category", "by type", "by region", "top", "highest", "lowest", "ranking", "distribution"
   - Explicit: "bar chart", "bar graph", "column chart"
   - **IMPORTANT**: Create bar charts for distributions even with few categories if requested

3. **Pie Chart**: Use for proportions, percentages, parts of a whole
   - Keywords: "percentage", "proportion", "share", "breakdown", "split"
   - Explicit: "pie chart", "pie graph", "donut chart"

4. **Table**: Use for detailed data, multiple dimensions, complex information
   - Keywords: "detailed", "list", "all", "complete", "breakdown", "comprehensive"
   - Explicit: "table", "list", "detailed view"

Return JSON with this structure:
{{
  "id": "unique_chart_id",
  "title": "Chart Title",
  "type": "line|bar|pie|table",
  "description": "What this chart shows",
  "query_sql": "SELECT ... FROM ... WHERE ... GROUP BY ... ORDER BY ...",
  "chart_reasoning": "Explanation of why this chart type was chosen based on the user's request"
}}

Requirements:
1. **Chart Type Selection**: 
   - For NEW charts: Choose appropriate type based on user request and data patterns
   - For EDIT operations: ALWAYS use the chart type the user explicitly requests, even if it seems suboptimal
   - If user says "change to bar chart", "make it a pie chart", "convert to line chart" - USE THAT TYPE
2. Generate SQLite-compatible SQL queries
3. Use actual table and column names from the schema
4. Include appropriate WHERE clauses for data filtering
5. Use GROUP BY for aggregations when appropriate
6. Use ORDER BY for meaningful sorting
7. For edits, completely replace the existing chart
8. Ensure the SQL is safe (no DROP, DELETE, etc.)
9. Make the chart title descriptive and user-friendly
10. **IMPORTANT**: When editing an existing chart, use the SAME ID as the original chart: {chart_id if chart_id else "N/A"}

**EDIT OPERATION SPECIAL RULES:**
- If user mentions changing chart type (e.g., "change to bar chart", "make it a pie chart"), prioritize that over data analysis
- User's chart type preference for edits takes absolute priority over data structure considerations
- Even if the data seems better suited for a different chart type, use what the user requested

Focus on creating meaningful visualizations that provide business insights and match the user's intent.
"""
        
        result = _generate_json_from_model(prompt, json.dumps(context, ensure_ascii=False, indent=2))
        
        # For edits, force the same ID to be used
        if chart_id:
            result["id"] = chart_id
        
        # Validate the generated chart
        if not isinstance(result, dict) or not result.get("query_sql"):
            return jsonify({"ok": False, "error": "Invalid chart configuration generated"}), 400
        
        # Test the SQL query
        try:
            conn = sqlite3.connect(str(role_db))
            cur = conn.cursor()
            cur.execute(result["query_sql"])
            test_data = cur.fetchall()
            conn.close()
            
            if not test_data:
                return jsonify({"ok": False, "error": "Generated query returns no data"}), 400
                
        except Exception as e:
            return jsonify({"ok": False, "error": f"Generated SQL is invalid: {str(e)}"}), 400
        
        # Update the plan
        if chart_id:
            # Replace existing chart
            charts = plan.get("charts", [])
            for i, chart in enumerate(charts):
                if chart.get("id") == chart_id:
                    charts[i] = result
                    break
            plan["charts"] = charts
        else:
            # Add new chart
            if "charts" not in plan:
                plan["charts"] = []
            plan["charts"].append(result)
        
        # Save updated plan
        plan_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2))
        
        return jsonify({"ok": True, "chart": result})
        
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/api/custom_role/schema")
def api_custom_role_schema():
    """Get database schema for custom role"""
    role_name = request.args.get('role_name', '').strip()
    if not role_name:
        return jsonify({"ok": False, "error": "Missing role_name"}), 400
    
    role_db = _role_db_path(role_name)
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

def infer_column_type(column_name, sqlite_type, table_name, cursor):
    """Infer the actual data type from column name and sample data"""
    column_lower = column_name.lower()
    
    # First, try to infer from column name patterns
    if any(keyword in column_lower for keyword in ['id', '_id']):
        return 'INTEGER'
    elif any(keyword in column_lower for keyword in ['date', 'time', 'created', 'updated', 'timestamp']):
        return 'DATETIME'
    elif any(keyword in column_lower for keyword in ['age', 'count', 'number', 'total', 'amount', 'value', 'price', 'cost', 'quantity', 'orders', 'items']):
        return 'INTEGER'
    elif any(keyword in column_lower for keyword in ['rate', 'percent', 'ratio', 'average', 'avg', 'score', 'rating']):
        return 'REAL'
    elif any(keyword in column_lower for keyword in ['email', 'name', 'title', 'description', 'text', 'category', 'type', 'status', 'gender', 'location', 'source', 'channel', 'preference', 'style', 'size']):
        return 'TEXT'
    elif any(keyword in column_lower for keyword in ['is_', 'has_', 'active', 'enabled', 'visible', 'public']):
        return 'BOOLEAN'
    
    # If name-based inference fails, sample some data to determine type
    try:
        cursor.execute(f"SELECT {column_name} FROM '{table_name}' WHERE {column_name} IS NOT NULL LIMIT 10")
        sample_data = cursor.fetchall()
        
        if not sample_data:
            return 'TEXT'  # Default if no data
        
        # Check if all values are numeric
        numeric_count = 0
        date_count = 0
        boolean_count = 0
        
        for row in sample_data:
            value = str(row[0]).strip()
            if not value:
                continue
                
            # Check for numeric
            try:
                float(value)
                numeric_count += 1
            except ValueError:
                pass
            
            # Check for date patterns
            if any(pattern in value for pattern in ['-', '/', ':']) and len(value) > 8:
                try:
                    from datetime import datetime
                    datetime.fromisoformat(value.replace('/', '-').replace(' ', 'T'))
                    date_count += 1
                except:
                    pass
            
            # Check for boolean patterns
            if value.lower() in ['true', 'false', '1', '0', 'yes', 'no', 'y', 'n']:
                boolean_count += 1
        
        total_samples = len(sample_data)
        
        # Determine type based on sample analysis
        if date_count / total_samples > 0.7:
            return 'DATETIME'
        elif boolean_count / total_samples > 0.7:
            return 'BOOLEAN'
        elif numeric_count / total_samples > 0.7:
            # Check if they're integers or decimals
            integer_count = 0
            for row in sample_data:
                value = str(row[0]).strip()
                try:
                    if float(value).is_integer():
                        integer_count += 1
                except ValueError:
                    pass
            
            if integer_count / numeric_count > 0.8:
                return 'INTEGER'
            else:
                return 'REAL'
        else:
            return 'TEXT'
            
    except Exception:
        return 'TEXT'  # Default fallback

@app.route("/api/custom_role/analysis_latest")
def api_custom_role_analysis_latest():
    """Get latest analysis for custom role"""
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

@app.route("/api/custom_role/metrics")
def api_custom_role_metrics():
    role_name = request.args.get("role_name", "").strip()
    if not role_name:
        return jsonify({"error": "Missing role_name"}), 400
    role_db = _role_db_path(role_name)
    if not role_db.exists():
        return jsonify({"error": "Role DB not found"}), 404
    # Build a lightweight metrics dict based on plan-generated SQL if present; otherwise row counts only
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


@app.route("/api/analyze", methods=["POST"]) 
def api_analyze():
	if "role" not in session:
		return jsonify({"error": "Unauthorized"}), 401
	role = session["role"]
	data = build_metrics_for_role(role)
	analysis = None
	analysis_error = None
	try:
		from services.gemini_service import analyze_metrics_short_term, analyze_metrics_long_term
		
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


@app.route("/api/analysis_latest")
def api_analysis_latest():
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


# --- Priority Insights & Explore & Act API Routes ---

@app.route("/api/priority-insights/summary", methods=["POST"])
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
		
		# Import and ensure tables exist
		from app.database.priority_insights_schema import create_priority_insights_tables, get_priority_summary
		create_priority_insights_tables()
		
		# Get summary data
		summary = get_priority_summary(priority_id, session["role"])
		
		return jsonify({
			"success": True,
			"summary": summary
		})
		
	except Exception as e:
		print(f"Error getting priority summary: {e}")
		return jsonify({"error": "Internal server error"}), 500


@app.route("/api/priority-insights/generate", methods=["POST"])
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
		
		# Import required modules
		from app.database.priority_insights_schema import create_priority_insights_tables, save_priority_insights, get_priority_insights
		from services.priority_insights_service import generate_priority_insights_with_search
		
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
		insights = get_priority_insights(priority_id, session["role"])
		
		return jsonify({
			"success": True,
			"insights": insights,
			"insight_id": insight_id
		})
		
	except Exception as e:
		print(f"Error generating insights: {e}")
		return jsonify({"error": "Failed to generate insights"}), 500


@app.route("/api/priority-insights/actions", methods=["POST"])
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
		
		# Import required modules
		from app.database.priority_insights_schema import create_priority_insights_tables, get_priority_actions, add_priority_action
		from services.priority_insights_service import generate_action_recommendations
		
		# Ensure tables exist
		create_priority_insights_tables()
		
		# Extract priority information
		priority_title = priority_data.get('title', 'Untitled Priority')
		priority_description = priority_data.get('why', '')
		priority_category = priority_data.get('category', 'general')
		
		# Get existing actions to avoid duplicates
		existing_actions = get_priority_actions(priority_id, session["role"])
		
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
		updated_actions = get_priority_actions(priority_id, session["role"])
		
		return jsonify({
			"success": True,
			"actions": updated_actions,
			"saved_count": len(saved_actions)
		})
		
	except Exception as e:
		print(f"Error generating actions: {e}")
		return jsonify({"error": "Failed to generate actions"}), 500


@app.route("/api/priority-insights/notes", methods=["POST"])
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
		
		# Import required modules
		from app.database.priority_insights_schema import create_priority_insights_tables, add_priority_note, get_priority_notes
		
		# Ensure tables exist
		create_priority_insights_tables()
		
		# Add note
		note_id = add_priority_note(priority_id, session["role"], note_content)
		
		# Get updated notes
		notes = get_priority_notes(priority_id, session["role"])
		
		return jsonify({
			"success": True,
			"note_id": note_id,
			"notes": notes
		})
		
	except Exception as e:
		print(f"Error adding note: {e}")
		return jsonify({"error": "Failed to add note"}), 500


@app.route("/api/priority-insights/notes/<int:note_id>", methods=["DELETE"])
def api_delete_note(note_id):
	"""Delete a specific note."""
	if "role" not in session:
		return jsonify({"error": "Unauthorized"}), 401
	
	try:
		# Import required modules
		from app.database.priority_insights_schema import create_priority_insights_tables, delete_priority_note, get_priority_notes
		
		# Ensure tables exist
		create_priority_insights_tables()
		
		# Delete note
		success = delete_priority_note(note_id, session["role"])
		
		if success:
			return jsonify({"success": True, "message": "Note deleted successfully"})
		else:
			return jsonify({"error": "Note not found or could not be deleted"}), 404
		
	except Exception as e:
		print(f"Error deleting note: {e}")
		return jsonify({"error": "Failed to delete note"}), 500


@app.route("/api/priority-insights/insights/<int:insight_id>", methods=["DELETE"])
def api_delete_insight(insight_id):
	"""Delete a specific insight."""
	if "role" not in session:
		return jsonify({"error": "Unauthorized"}), 401
	
	try:
		# Import required modules
		from app.database.priority_insights_schema import create_priority_insights_tables, delete_priority_insight
		
		# Ensure tables exist
		create_priority_insights_tables()
		
		# Delete insight
		success = delete_priority_insight(insight_id, session["role"])
		
		if success:
			return jsonify({"success": True, "message": "Insight deleted successfully"})
		else:
			return jsonify({"error": "Insight not found or could not be deleted"}), 404
		
	except Exception as e:
		print(f"Error deleting insight: {e}")
		return jsonify({"error": "Failed to delete insight"}), 500


@app.route("/api/priority-insights/actions/<int:action_id>", methods=["DELETE"])
def api_delete_action(action_id):
    """Delete a specific action."""
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    try:
        # Import required modules
        from app.database.priority_insights_schema import create_priority_insights_tables, delete_priority_action
        
        # Ensure tables exist
        create_priority_insights_tables()
        
        # Delete action
        success = delete_priority_action(action_id, session["role"])
        
        if success:
            return jsonify({"success": True, "message": "Action deleted successfully"})
        else:
            return jsonify({"error": "Action not found or could not be deleted"}), 404
        
    except Exception as e:
        print(f"Error deleting action: {e}")
        return jsonify({"error": "Failed to delete action"}), 500



@app.route("/api/priority-insights/clear", methods=["POST"])
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
		
		# Import required modules
		from app.database.priority_insights_schema import create_priority_insights_tables, delete_priority_data
		
		# Ensure tables exist
		create_priority_insights_tables()
		
		# Clear data
		delete_priority_data(priority_id, session["role"])
		
		return jsonify({
			"success": True,
			"message": "Priority data cleared successfully"
		})
		
	except Exception as e:
		print(f"Error clearing priority data: {e}")
		return jsonify({"error": "Failed to clear data"}), 500


@app.route("/api/priority-insights/status", methods=["GET"])
def api_priority_insights_status():
	"""Get status of the Priority Insights feature."""
	try:
		# Import and check if tables exist and are accessible
		from app.database.priority_insights_schema import create_priority_insights_tables
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
		print(f"Error checking priority insights status: {e}")
		return jsonify({
			"success": False,
			"status": "error",
			"error": str(e)
		}), 500


@app.route("/api/action", methods=["POST"]) 
def record_action():
	if "role" not in session:
		return jsonify({"error": "Unauthorized"}), 401
	payload = request.get_json(force=True)
	action_type = payload.get("action_type")
	details = payload.get("details", {})
	conn = get_db_connection()
	cur = conn.cursor()
	cur.execute(
		"INSERT INTO actions(role, action_type, details_json, created_ts) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
		(session["role"], action_type, str(details)),
	)
	conn.commit()
	conn.close()
	return jsonify({"ok": True})


@app.route("/api/custom_role/delete_chart", methods=["POST"])
def api_custom_role_delete_chart():
    """Delete a custom chart"""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    chart_id = (payload.get("chart_id") or "").strip()
    
    if not role_name or not chart_id:
        return jsonify({"ok": False, "error": "Missing role_name or chart_id"}), 400
    
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


@app.route('/static/<path:path>')
def send_static(path):
	return send_from_directory(str(STATIC_DIR), path)


@app.route("/api/custom_role/create_visualization", methods=["POST"])
def api_custom_role_create_visualization():
    """Generate custom visualization with optional enhanced insights"""
    payload = request.get_json(force=True)
    role_name = (payload.get("role_name") or "").strip()
    description = (payload.get("description") or "").strip()
    chart_id = payload.get("chart_id")  # For editing existing charts
    generate_insights = payload.get("generate_insights", True)  # Default to True
    
    if not role_name or not description:
        return jsonify({"ok": False, "error": "Missing role_name or description"}), 400
    
    try:
        # Load role schema and existing plan
        role_db = _role_db_path(role_name)
        plan_path = CUSTOM_DIR / f"{role_name.replace(' ','_')}.plan.json"
        
        if not role_db.exists():
            return jsonify({"ok": False, "error": "Role database not found"}), 404
        
        # Get database schema for Gemini context
        conn = sqlite3.connect(str(role_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        # Get table information
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        tables = [r[0] for r in cur.fetchall()]
        
        schema_info = {}
        for table in tables:
            cur.execute(f"PRAGMA table_info('{table}')")
            columns = [{"name": r[1], "type": r[2]} for r in cur.fetchall()]
            cur.execute(f"SELECT COUNT(*) as count FROM '{table}'")
            row_count = cur.fetchone()[0]
            schema_info[table] = {"columns": columns, "row_count": row_count}
        
        conn.close()
        
        # Load existing plan if it exists
        existing_plan = {}
        if plan_path.exists():
            existing_plan = json.loads(plan_path.read_text())
        
        # Generate new chart using Gemini
        from services.gemini_service import _generate_json_from_model
        
        prompt = f"""
        You are an expert data analyst. Create a visualization configuration for this request:
        
        Role: {role_name}
        Description: {description}
        Database Schema: {json.dumps(schema_info, indent=2)}
        
        {"EDITING EXISTING CHART: Update chart with id '" + chart_id + "'" if chart_id else "CREATING NEW CHART"}
        
        Generate a JSON configuration with these fields:
        - id: "{chart_id}" (if editing) or generate a new unique chart ID
        - title: descriptive chart title
        - description: what this chart shows
        - type: "line", "bar", "pie", or "table"  
        - query_sql: SQLite query to get the data
        
        Ensure the SQL query is valid SQLite syntax and uses the available tables/columns.
        Focus on creating meaningful visualizations that answer the user's request.
        """
        
        schema_hint = """
        Return ONLY a JSON object with keys: id, title, description, type, query_sql
        """
        
        result = _generate_json_from_model(prompt, schema_hint)
        
        # Validate the generated SQL by testing it
        conn = sqlite3.connect(str(role_db))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        
        try:
            cur.execute(result["query_sql"])
            test_data = [dict(r) for r in cur.fetchall()]
            if not test_data:
                return jsonify({"ok": False, "error": "Generated query returned no data"}), 400
        except Exception as e:
            return jsonify({"ok": False, "error": f"Invalid SQL query: {str(e)}"}), 400
        finally:
            conn.close()
        
        # Generate insights if requested
        insights = []
        if generate_insights and test_data:
            try:
                from services.gemini_service import generate_chart_insights
                insights = generate_chart_insights(result["title"], test_data, result["type"])
                
                # Store insights in database with timestamp
                conn = sqlite3.connect(str(role_db))
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
                
                # Insert or update insights
                insights_json = json.dumps(insights)
                if chart_id:
                    # Update existing insights
                    cur.execute("""
                        INSERT OR REPLACE INTO chart_insights (chart_id, chart_title, insights_json, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    """, (result["id"], result["title"], insights_json))
                else:
                    # Insert new insights
                    cur.execute("""
                        INSERT INTO chart_insights (chart_id, chart_title, insights_json)
                        VALUES (?, ?, ?)
                    """, (result["id"], result["title"], insights_json))
                
                conn.commit()
                conn.close()
                
            except Exception as e:
                print(f"Failed to generate insights: {e}")
                # Don't fail the entire request if insights fail
                pass
        
        # Update plan file
        charts = existing_plan.get("charts", [])
        
        if chart_id:
            # Replace existing chart
            charts = [c for c in charts if c.get("id") != chart_id]
        
        # Add the new/updated chart
        charts.append(result)
        existing_plan["charts"] = charts
        
        # Save plan
        plan_path.write_text(json.dumps(existing_plan, ensure_ascii=False, indent=2))
        
        return jsonify({
            "ok": True,
            "chart": result,
            "insights": insights if generate_insights else None,
            "message": f"Visualization {'updated' if chart_id else 'created'} successfully"
        })
        
    except Exception as e:
        import logging
        logging.error(f"Error generating visualization: {e}")
        return jsonify({"ok": False, "error": f"Failed to generate visualization: {str(e)}"}), 500


@app.route("/api/custom_role/insights/<role_name>/<chart_id>", methods=["GET"])
def api_get_chart_insights(role_name, chart_id):
    """Get stored insights for a specific chart"""
    try:
        role_db = _role_db_path(role_name)
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
        import logging
        logging.error(f"Error fetching chart insights: {e}")
        return jsonify({"ok": False, "error": f"Failed to fetch insights: {str(e)}"}), 500


@app.route("/api/chart/insights", methods=["POST"])
def api_generate_chart_insights():
    """Generate enhanced insights for chart data using Gemini Flash 2.5"""
    payload = request.get_json(force=True)
    chart_title = payload.get("chart_title", "Chart")
    chart_data = payload.get("chart_data", [])
    chart_type = payload.get("chart_type", "unknown")
    role_name = payload.get("role_name")  # Optional: for storing insights
    chart_id = payload.get("chart_id")    # Optional: for storing insights
    
    if not chart_data:
        return jsonify({"ok": False, "error": "No chart data provided"}), 400
    
    try:
        from services.gemini_service import generate_chart_insights
        insights = generate_chart_insights(chart_title, chart_data, chart_type)
        
        # Store insights in database if role_name and chart_id are provided
        if role_name and chart_id:
            try:
                role_db = _role_db_path(role_name)
                if role_db.exists():
                    conn = sqlite3.connect(str(role_db))
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
                    
                    # Insert or update insights
                    insights_json = json.dumps(insights)
                    cur.execute("""
                        INSERT OR REPLACE INTO chart_insights (chart_id, chart_title, insights_json, updated_at)
                        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    """, (chart_id, chart_title, insights_json))
                    
                    conn.commit()
                    conn.close()
            except Exception as e:
                print(f"Failed to store insights: {e}")
                # Don't fail the entire request if storage fails
        
        return jsonify({
            "ok": True,
            "insights": insights,
            "chart_title": chart_title,
            "data_points": len(chart_data)
        })
        
    except Exception as e:
        import logging
        logging.error(f"Error generating chart insights: {e}")
        return jsonify({"ok": False, "error": f"Failed to generate insights: {str(e)}"}), 500


if __name__ == "__main__":
	app.run(host="0.0.0.0", port=5000, debug=True)
