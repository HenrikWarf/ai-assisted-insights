"""
Main application entry point for the data-driven application.

This is the refactored version of the original app.py, now using modular components.
"""

from app import create_app

# Create the application instance
app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
