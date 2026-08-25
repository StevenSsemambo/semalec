import { createClient } from "@supabase/supabase-js";

// Safe to expose in browser code — this is the public "anon" key, not the service role key.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Lecturer auth helpers ────────────────────────────────────────────────────
export async function signUpLecturer({ email, password, name, institution, institutionId }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, institution, institution_id: institutionId } }, // read by handle_new_user() trigger in schema.sql
  });
  if (error) throw error;
  return data;
}

export async function signInLecturer({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutLecturer() {
  await supabase.auth.signOut();
}

export async function getLecturerSession() {
  const { data } = await supabase.auth.getSession();
  return data.session; // null if not signed in
}

export async function getLecturerProfile(userId) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data; // { id, name, institution }
}
