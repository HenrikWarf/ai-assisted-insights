"""
API module for the data-driven application.

This module contains API route handlers organized by functionality.
"""

from .auth_routes import auth_bp
from .metrics_routes import metrics_bp
from .custom_role_routes import custom_role_bp
from .analysis_routes import analysis_bp
from .priority_insights_routes import priority_insights_bp
from .action_routes import action_bp
from .kpi_routes import kpi_bp

__all__ = ['auth_bp', 'metrics_bp', 'custom_role_bp', 'analysis_bp', 'priority_insights_bp', 'action_bp', 'kpi_bp']
