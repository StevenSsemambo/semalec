// SEMAI — /curriculum Edge Function
// Ports backend/routes/curriculum.py and the lecturer-auth check from auth_utils.py.
// GET  /curriculum          -> list all courses (summary)
// GET  /curriculum/:id      -> full nested course (modules + slides)
// POST /curriculum          -> create/replace a course (lecturer must be signed in)
// DELETE /curriculum/:id    -> delete a course (only the lecturer who created it)

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Verifies the lecturer's Supabase session token (sent by the frontend after supabase-js
// sign-in) — mirrors auth_utils.get_current_lecturer / require_lecturer in the old Flask app.
async function getCurrentLecturer(req: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  // The anon key itself is a valid JWT but doesn't resolve to a user — getUser rejects it.
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? "" };
}

function assembleCourse(course: any, modules: any[], slidesByModule: Record<string, any[]>) {
  const shapedModules = [...modules]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((m) => ({
      id: m.id,
      icon: m.icon ?? "",
      title: m.title ?? "",
      slides: (slidesByModule[m.id] ?? [])
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((s) => ({ title: s.title ?? "", bullets: s.bullets ?? [] })),
      practicalType: m.practical_type ?? "none",
      practicalLanguage: m.practical_language ?? "",
      practical: m.practical ?? "",
      practicalNote: m.practical_note ?? "",
    }));
  return {
    id: course.id,
    title: course.title,
    description: course.description ?? "",
    subject: course.subject ?? "",
    outline: course.outline ?? "",
    lecturer: course.lecturer_name ?? "",
    institution: course.institution ?? "",
    modules: shapedModules,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("curriculum");
  const courseId = idx >= 0 && parts.length > idx + 1 ? decodeURIComponent(parts[idx + 1]) : null;

  try {
    if (req.method === "GET" && !courseId) {
      const { data: courses, error } = await sb
        .from("courses")
        .select("id,title,description,subject,lecturer_name");
      if (error) throw error;
      const { data: modules } = await sb.from("modules").select("course_id");
      const counts: Record<string, number> = {};
      for (const m of modules ?? []) counts[m.course_id] = (counts[m.course_id] ?? 0) + 1;
      return json({
        courses: (courses ?? []).map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description ?? "",
          subject: c.subject ?? "",
          lecturer: c.lecturer_name ?? "",
          moduleCount: counts[c.id] ?? 0,
        })),
      });
    }

    if (req.method === "GET" && courseId) {
      const { data: course } = await sb.from("courses").select("*").eq("id", courseId).limit(1).maybeSingle();
      if (!course) return json({ error: "Course not found" }, 404);
      const { data: modules } = await sb.from("modules").select("*").eq("course_id", courseId);
      const moduleIds = (modules ?? []).map((m) => m.id);
      const { data: slides } = moduleIds.length
        ? await sb.from("slides").select("*").in("module_id", moduleIds)
        : { data: [] as any[] };
      const slidesByModule: Record<string, any[]> = {};
      for (const s of slides ?? []) (slidesByModule[s.module_id] ??= []).push(s);
      return json(assembleCourse(course, modules ?? [], slidesByModule));
    }

    if (req.method === "POST") {
      const lecturer = await getCurrentLecturer(req);
      if (!lecturer) return json({ error: "Sign in required" }, 401);

      const data = await req.json();
      const title = (data.title ?? "").trim();
      if (!title) return json({ error: "title required" }, 400);
      const id = data.id || slugify(title);

      // If this course already exists, only its original creator may edit it.
      const { data: existing } = await sb.from("courses").select("lecturer_id").eq("id", id).limit(1).maybeSingle();
      if (existing && existing.lecturer_id !== lecturer.id) {
        return json({ error: "You can only edit courses you created" }, 403);
      }

      const { error: upsertErr } = await sb.from("courses").upsert({
        id,
        title,
        description: data.description ?? "",
        subject: data.subject ?? "",
        outline: data.outline ?? "",
        lecturer_id: lecturer.id,
        lecturer_name: data.lecturer || lecturer.email,
        institution: data.institution ?? "",
      });
      if (upsertErr) throw upsertErr;

      await sb.from("modules").delete().eq("course_id", id);
      const modules = data.modules ?? [];
      for (let i = 0; i < modules.length; i++) {
        const m = modules[i];
        const { data: modRow, error: modErr } = await sb
          .from("modules")
          .insert({
            course_id: id,
            position: i,
            icon: m.icon ?? "",
            title: m.title ?? "",
            practical_type: m.practicalType ?? "none",
            practical_language: m.practicalLanguage ?? "",
            practical: m.practical ?? "",
            practical_note: m.practicalNote ?? "",
          })
          .select()
          .single();
        if (modErr) throw modErr;

        const slides = (m.slides ?? []).map((s: any, j: number) => ({
          module_id: modRow.id,
          position: j,
          title: s.title ?? "",
          bullets: s.bullets ?? [],
        }));
        if (slides.length) {
          const { error: slideErr } = await sb.from("slides").insert(slides);
          if (slideErr) throw slideErr;
        }
      }

      return json({ id, message: "Course saved" }, 201);
    }

    if (req.method === "DELETE" && courseId) {
      const lecturer = await getCurrentLecturer(req);
      if (!lecturer) return json({ error: "Sign in required" }, 401);

      const { data: course } = await sb.from("courses").select("lecturer_id").eq("id", courseId).limit(1).maybeSingle();
      if (!course) return json({ error: "Not found" }, 404);
      if (course.lecturer_id !== lecturer.id) return json({ error: "You can only delete courses you created" }, 403);

      const { error } = await sb.from("courses").delete().eq("id", courseId); // cascades to modules/slides
      if (error) throw error;
      return json({ message: "Deleted" });
    }

    return json({ error: "Not found" }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
