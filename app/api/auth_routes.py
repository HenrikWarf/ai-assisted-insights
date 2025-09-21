"""
Authentication API routes.

This module contains Flask Blueprint for authentication-related API endpoints.
"""

from flask import Blueprint, request, jsonify, session, redirect, send_from_directory
from app.auth import login_user, logout_user
from app.database import STATIC_DIR

auth_bp = Blueprint('auth', __name__)


@auth_bp.route("/")
def index():
    """Serve the main index page."""
    return send_from_directory(str(STATIC_DIR), "index.html")


@auth_bp.route("/dashboard")
def dashboard_page():
    """Serve the dashboard page if user is authenticated."""
    if "role" not in session:
        return redirect("/")
    return send_from_directory(str(STATIC_DIR), "dashboard.html")


@auth_bp.route("/register")
def register_page():
    """Serve the registration page."""
    return send_from_directory(str(STATIC_DIR), "register.html")


@auth_bp.route("/dashboard/<role_name>")
def custom_dashboard_page(role_name):
    """Serve a generic dashboard for custom roles."""
    return send_from_directory(str(STATIC_DIR), "dashboard.html")


@auth_bp.route("/login", methods=["POST"]) 
def login():
    """
    Handle user login with role-based authentication.
    
    Accepts role information via JSON, form data, or query parameters.
    Normalizes the role and sets up the user session.
    """
    data = request.get_json(silent=True) or {}
    role = data.get("role") or request.form.get("role") or request.args.get("role")
    
    result = login_user(role)
    return jsonify(result)


@auth_bp.route("/logout", methods=["POST"]) 
def logout():
    """Handle user logout by clearing the session."""
    result = logout_user()
    return jsonify(result)


@auth_bp.route('/static/<path:path>')
def send_static(path):
    """Serve static files."""
    return send_from_directory(str(STATIC_DIR), path)
