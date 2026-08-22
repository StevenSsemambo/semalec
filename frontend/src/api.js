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

export async function getCourses() {
  const result = await supabase.functions.invoke("curriculum", { method: "GET" });
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
