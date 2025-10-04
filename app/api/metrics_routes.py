"""
Metrics API routes.

This module contains Flask Blueprint for metrics-related API endpoints.
"""

from flask import Blueprint, request, jsonify, session
from app.models import build_metrics_for_role
from app.database import get_db_connection

metrics_bp = Blueprint('metrics', __name__)


@metrics_bp.route("/api/insights")
def get_insights():
    """
    Get insights data for the current user's role.
    
    Returns recent sales, low inventory, and recommendations based on the user's role.
    """
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


@metrics_bp.route("/api/metrics")
def api_metrics():
    """
    Get metrics data for the current user's role.
    
    Returns role-specific metrics data including KPIs and chart data.
    """
    if "role" not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    role = session["role"]
    data = build_metrics_for_role(role)
    data["user"] = session.get("user", "Henrik Warfvinge")
    return jsonify(data)


@metrics_bp.route("/api/action", methods=["POST"]) 
def record_action():
    """
    Record a user action for analytics purposes.
    
    Stores action data in the database for tracking user behavior.
    """
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
