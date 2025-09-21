"""
Database module for the data-driven application.

This module provides database connection utilities and configuration.
"""

from .connection import get_db_connection, DB_PATH, DATA_DIR
from .schema import infer_column_type

__all__ = ['get_db_connection', 'DB_PATH', 'DATA_DIR', 'infer_column_type']
