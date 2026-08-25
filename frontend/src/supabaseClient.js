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
    options: { data: { name, institution, institution_id: institutionId, role: "lecturer" } }, // read by handle_new_user() trigger in schema.sql
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

// ── Student auth helpers ─────────────────────────────────────────────────────
// Same underlying identity table/trigger as lecturers, differentiated by role — gives
// students a real, persistent identity instead of a free-typed name, so progress can
// actually be attributed and shown to a lecturer/institution.
export async function signUpStudent({ email, password, name, institution, institutionId }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, institution, institution_id: institutionId, role: "student" } },
  });
  if (error) throw error;
  return data;
}

export async function signInStudent({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOutStudent() {
  await supabase.auth.signOut();
}

export async function getStudentSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ── Progress tracking ────────────────────────────────────────────────────────
// Direct table access, not an Edge Function — RLS enforces that a student can only ever
// write their own rows (auth.uid() = student_id), so correctness is guaranteed by
// Postgres itself even if a bug crept into this client code.
export async function recordProgress({ studentId, courseId, moduleId, slideIndex, completed }) {
  if (!studentId || !courseId || !moduleId) return;
  const { error } = await supabase.from("progress").upsert(
    { student_id: studentId, course_id: courseId, module_id: moduleId, slide_index: slideIndex ?? 0, completed: !!completed, updated_at: new Date().toISOString() },
    { onConflict: "student_id,course_id,module_id" },
  );
  if (error) console.error("progress upsert failed", error.message);
}

// Lecturer-only (RLS scopes this to courses the caller created) — per-student completion
// for a given course, joined with the student's display name and module titles.
export async function getCourseProgress(courseId) {
  const { data, error } = await supabase
    .from("progress")
    .select("student_id, module_id, slide_index, completed, updated_at, profiles:student_id(name), modules:module_id(title, position)")
    .eq("course_id", courseId);
  if (error) throw new Error(error.message);
  return data || [];
}
