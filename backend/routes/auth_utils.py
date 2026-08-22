import os
from functools import wraps
from flask import request, jsonify
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")


def get_current_lecturer():
    """
    The frontend signs the lecturer in directly via supabase-js (using the
    public anon key) and sends the resulting session access token in the
    Authorization header on every course-writing request. This verifies
    that token against Supabase and returns (user_id, email), or (None, None)
    if there's no valid session.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, None
    token = auth_header.split(" ", 1)[1]
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        return None, None
    try:
        client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
        result = client.auth.get_user(token)
        return result.user.id, result.user.email
    except Exception:
        return None, None


def require_lecturer(fn):
    """Route decorator — rejects the request with 401 unless a valid lecturer session is present."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user_id, email = get_current_lecturer()
        if not user_id:
            return jsonify({"error": "Sign in required"}), 401
        request.lecturer_id = user_id
        request.lecturer_email = email
        return fn(*args, **kwargs)
    return wrapper
