// Talks to the SEMAI Supabase Edge Functions (supabase/functions/*) instead of the old
// Flask backend. supabase.functions.invoke() automatically attaches the right auth —
// the anon key when signed out, the lecturer's session token when signed in — so the
// Edge Functions can tell a real lecturer from an anonymous student.
import { supabase } from "./supabaseClient";

function unwrap({ data, error }) {
  if (error) throw new Error(error.message || "Request failed");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function sendChat({ messages, courseId, studentName, context }) {
  const result = await supabase.functions.invoke("chat", {
    body: { messages, courseId, studentName, context },
  });
  return unwrap(result); // { reply: "..." }
}

export async function getCourses(institutionId) {
  const path = institutionId ? `curriculum?institution_id=${encodeURIComponent(institutionId)}` : "curriculum";
  const result = await supabase.functions.invoke(path, { method: "GET" });
  return unwrap(result); // { courses: [...] }
}

export async function getCourse(id) {
  const result = await supabase.functions.invoke(`curriculum/${id}`, { method: "GET" });
  return unwrap(result);
}

// Requires the lecturer to be signed in (see supabaseClient.js) — the Edge Function verifies the token.
export async function saveCourse(data) {
  const result = await supabase.functions.invoke("curriculum", { method: "POST", body: data });
  return unwrap(result);
}

export async function deleteCourse(id) {
  const result = await supabase.functions.invoke(`curriculum/${id}`, { method: "DELETE" });
  return unwrap(result);
}

export async function getTTSConfig() {
  const result = await supabase.functions.invoke("tts-config", { method: "GET" });
  return unwrap(result); // { mode: "browser" | "elevenlabs", enabled: true }
}

// ── Full lecturer-style slide narration ─────────────────────────────────────
export async function explainSlide({ courseTitle, moduleTitle, studentName, slideTitle, bullets }) {
  const result = await supabase.functions.invoke("lecture-explain", {
    body: { courseTitle, moduleTitle, studentName, slideTitle, bullets },
  });
  return unwrap(result); // { explanation: "..." }
}

// ── Step-by-step live walkthrough of a module's code demo or worked example ─
export async function explainPractical({ courseTitle, moduleTitle, studentName, practicalType, content, practicalNote }) {
  const result = await supabase.functions.invoke("practical-walkthrough", {
    body: { courseTitle, moduleTitle, studentName, practicalType, content, practicalNote },
  });
  return unwrap(result); // { steps: [{ startLine, endLine, snippet, narration }], closing }
}

// ── AI course generation (lecturer describes/pastes/uploads content) ───────
export async function generateCourse({ title, lecturer, institution, sourceText }) {
  const result = await supabase.functions.invoke("generate-course", {
    body: { title, lecturer, institution, sourceText },
  });
  return unwrap(result); // full course object { title, description, modules, ... }
}

export async function uploadCourseSource(file) {
  const form = new FormData();
  form.append("file", file);
  const result = await supabase.functions.invoke("generate-upload", { body: form });
  return unwrap(result); // { text: "extracted text..." }
}

// ── AI single-module generation (adding a module to an existing course) ────
export async function generateModule({ courseTitle, subject, moduleTitle, sourceText }) {
  const result = await supabase.functions.invoke("generate-module", {
    body: { courseTitle, subject, moduleTitle, sourceText },
  });
  return unwrap(result); // single module object { id, icon, title, slides, practicalType, ... }
}

// ── Institutions (multi-tenancy) — plain table access via RLS, no edge function needed ─
export async function getInstitutions() {
  const { data, error } = await supabase.from("institutions").select("id,name").order("name");
  if (error) throw new Error(error.message);
  return data || [];
}

// Finds an institution by exact name, or creates it if it doesn't exist yet — used at
// lecturer sign-up so typing a new school's name self-serves a new tenant.
export async function resolveInstitution(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const { data: existing, error: findErr } = await supabase
    .from("institutions").select("id,name").ilike("name", trimmed).limit(1).maybeSingle();
  if (findErr) throw new Error(findErr.message);
  if (existing) return existing;
  const { data: created, error: createErr } = await supabase
    .from("institutions").insert({ name: trimmed }).select("id,name").single();
  if (createErr) throw new Error(createErr.message);
  return created;
}
