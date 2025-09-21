"""
Authentication utilities for user login and session management.

This module provides functions for handling user authentication, role normalization,
and session management.
"""

import os
from flask import session, jsonify


def normalize_role(role: str) -> str:
    """
    Normalize a role string by cleaning whitespace and hyphen characters.
    
    Args:
        role (str): The role string to normalize
        
    Returns:
        str: The normalized role string
    """
    if not role:
        return ""
    # Normalize whitespace and hyphen-like characters
    v = role.strip()
    for ch in ["\u2010", "\u2011", "\u2012", "\u2013", "\u2014", "\u2212"]:
        v = v.replace(ch, "-")
    return v


def get_canonical_roles():
    """
    Get the mapping of normalized role names to canonical role names.
    
    Returns:
        dict: Dictionary mapping normalized role names to canonical role names
    """
    return {
        "ecommerce manager": "E-commerce Manager",
        "e-commerce manager": "E-commerce Manager",
        "marketing lead": "Marketing Lead",
        "merchandiser": "Merchandiser",
        "store manager": "Marketing Lead" if os.getenv("ALLOW_STORE_MANAGER_AS_MARKETING", "1") == "1" else "Store Manager",
    }


def clean_key(v: str) -> str:
    """
    Clean a role key by removing spaces and hyphens for comparison.
    
    Args:
        v (str): The role string to clean
        
    Returns:
        str: The cleaned role string
    """
    return v.lower().replace("-", "").replace(" ", "")


def login_user(role: str) -> dict:
    """
    Authenticate a user with the given role and set up their session.
    
    Args:
        role (str): The user's role
        
    Returns:
        dict: Response dictionary with authentication status and role information
    """
    role = normalize_role(role)
    
    # Accept current and previous role labels; compare with aggressive normalization
    canonical = get_canonical_roles()
    lookup = {clean_key(k): v for k, v in canonical.items()}
    key = clean_key(role)
    
    if key not in lookup:
        # Fallback to E-commerce Manager to avoid blocking login during UI changes
        fallback = "E-commerce Manager"
        session["role"] = fallback
        session["user"] = "Henrik Warfvinge"  # Default user
        return {"ok": True, "role": fallback, "note": "Unrecognized role received; defaulted.", "received": role}
    
    session["role"] = lookup[key]
    session["user"] = "Henrik Warfvinge"  # Default user
    return {"ok": True, "role": lookup[key]}


def logout_user() -> dict:
    """
    Log out the current user by clearing their session.
    
    Returns:
        dict: Response dictionary indicating successful logout
    """
    session.clear()
    return {"ok": True}
