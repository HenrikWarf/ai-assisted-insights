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

# Register Blueprints
from app.api import auth_bp, metrics_bp, custom_role_bp, analysis_bp, priority_insights_bp, action_bp, kpi_bp
app.register_blueprint(auth_bp)
app.register_blueprint(metrics_bp)
app.register_blueprint(custom_role_bp)
app.register_blueprint(analysis_bp)
app.register_blueprint(priority_insights_bp)
app.register_blueprint(action_bp)
app.register_blueprint(kpi_bp)


def get_db_connection():
	DATA_DIR.mkdir(parents=True, exist_ok=True)
	conn = sqlite3.connect(str(DB_PATH))
	conn.row_factory = sqlite3.Row
	return conn


# Page-serving routes
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
    session['role'] = role_name
    return send_from_directory(str(STATIC_DIR), "dashboard.html")

if __name__ == "__main__":
	app.run(host="0.0.0.0", port=5000, debug=True)
