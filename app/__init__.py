"""
Main application module for the data-driven application.

This module creates and configures the Flask application with all blueprints.
"""

from flask import Flask
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Import blueprints
from app.api import auth_bp, metrics_bp, custom_role_bp, analysis_bp

def create_app():
    """
    Create and configure the Flask application.
    
    Returns:
        Flask: Configured Flask application instance
    """
    app = Flask(__name__, static_folder="static")
    app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-me")
    
    # Register blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(metrics_bp)
    app.register_blueprint(custom_role_bp)
    app.register_blueprint(analysis_bp)
    
    return app

# Create the application instance
app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
