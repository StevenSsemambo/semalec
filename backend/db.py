import os
from supabase import create_client, Client

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

_client: "Client | None" = None


def get_supabase() -> Client:
    """
    Returns a Supabase client authenticated with the SERVICE ROLE key —
    this bypasses Row Level Security, which is intentional: the Flask
    backend is the only thing allowed to write course data, and it checks
    the requesting lecturer's identity itself (see routes/auth_utils.py)
    before performing any write.

    Never expose the service role key to the frontend — only the anon key
    (used by the frontend's supabase-js client for lecturer sign-in) is safe
    to ship in browser code.
    """
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
                "(see backend/.env.example)"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return _client
