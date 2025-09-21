"""
Authentication module for the data-driven application.

This module handles user authentication, session management, and role-based access.
"""

from .auth import login_user, logout_user, normalize_role, get_canonical_roles

__all__ = ['login_user', 'logout_user', 'normalize_role', 'get_canonical_roles']
