"""
Main application entry point for the data-driven application.

This is the refactored version of the original app.py, now using modular components.
"""

import os
from app import create_app

# Create the application instance
app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
