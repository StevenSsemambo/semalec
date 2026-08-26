// SEMAI — /generate-course Edge Function
// Ports backend/routes/generate.py's /generate/course endpoint — AI curriculum generation.
// Uses Gemini instead of Claude, with responseMimeType forced to JSON.
// Uses a classic static AIza API key (x-goog-api-key header) — AQ. Auth keys need real OAuth
// credentials, which a serverless Edge Function has no way to provide.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-3.6-flash";
const MODULE_ICONS = ["📘", "🔷", "🧱", "🔀", "🧬", "🗄️", "⚙️", "📦", "🧮", "🌐"];

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Course generation was previously callable with NO auth check at all — anyone with the
// public anon key could hit this repeatedly and burn Gemini quota. Now requires a signed-in
// lecturer, matching the pattern already used by the curriculum Edge Function.
async function getCurrentLecturer(req: Request): Promise<{ id: string } | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: profile } = await sb.from("profiles").select("role").eq("id", data.user.id).limit(1).maybeSingle();
  if (profile?.role !== "lecturer") return null;
  return { id: data.user.id };
}

// Simple sliding-window-ish limiter (10-minute buckets). Not perfectly atomic under a race,
// but good enough to stop scripted abuse without adding real infrastructure for this pass.
async function checkRateLimit(userId: string, fn: string, limit = 8, windowMs = 10 * 60 * 1000): Promise<boolean> {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
  const { data: existing } = await sb.from("rate_limits").select("count").eq("user_id", userId).eq("fn", fn).eq("window_start", windowStart).maybeSingle();
  if (existing) {
    if (existing.count >= limit) return false;
    await sb.from("rate_limits").update({ count: existing.count + 1 }).eq("user_id", userId).eq("fn", fn).eq("window_start", windowStart);
  } else {
    await sb.from("rate_limits").insert({ user_id: userId, fn, window_start: windowStart, count: 1 });
  }
  return true;
}

const GENERATE_SYSTEM_PROMPT = `You are an expert curriculum designer helping a lecturer turn their raw
course material (a description, a syllabus, or pasted slide/notes/PDF text) into a structured
lecture course for SEMAI, an AI lecturer app. This app is used across ALL subjects — programming,
business, marketing, accounting, history, science, law, anything a lecturer teaches — not just
programming.

Return ONLY valid JSON — no markdown fences, no commentary, no prose before or after — matching
EXACTLY this schema:

{
  "description": "one sentence overview of the course",
  "subject": "short subject area label, e.g. Java Programming, Marketing, Financial Accounting, World History",
  "modules": [
    {
      "id": "short-kebab-case-id",
      "icon": "one relevant emoji",
      "title": "Module title",
      "slides": [
        { "title": "Slide title", "bullets": ["point 1", "point 2", "point 3", "point 4"] }
      ],
      "practicalType": "code | example | none",
      "practicalLanguage": "the programming language if practicalType is code, e.g. java, python, sql — otherwise empty string",
      "practical": "the hands-on content — RAW plain text only, no markdown fences, no HTML: if practicalType is code, a complete working code example; if practicalType is example, a short worked example, mini case study, or practice scenario relevant to the subject; if practicalType is none, an empty string",
      "practicalNote": "2-3 sentences (plain text, no markdown) explaining what the practical section demonstrates — or empty string if practicalType is none"
    }
  ]
}

Rules:
- Decide practicalType per module based on the subject: use "code" only for programming/technical
  subjects where showing real source code genuinely helps (pick the appropriate language). Use
  "example" for a worked example, mini case study, or practice scenario for non-programming subjects
  (business, marketing, accounting, history, law, science, etc). Use "none" only if a hands-on
  section genuinely doesn't fit that module.
- Produce 3 to 7 modules depending on how much source material is given — don't pad if the source is thin.
- Each module should have 2 to 4 slides, each slide with 3 to 6 bullets. Each bullet must be a real,
  self-contained piece of content, not a fragment — write it as "Key term or short phrase — one clear
  sentence explaining or elaborating it" (use an em dash between the two parts). Someone should be able
  to understand the point from the bullet alone, on screen, without hearing you speak — SEMAI will still
  teach and expand around it live, but the slide itself must look like a real, informative lecture slide,
  never a bare outline. Aim for roughly 10-22 words total per bullet.
- The "practical" field must be plain text only — never wrap it in \`\`\`fences or HTML, regardless of practicalType.
- Base everything strictly on the source material provided. If the source is a short description rather
  than a full syllabus, use your subject expertise to build out a sensible, well-sequenced module structure
  a real lecturer would teach — but stay true to what was actually asked for.
- Output must be a single JSON object and nothing else.`;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function stripCodeFences(text: string): string {
  if (!text) return "";
  text = text.trim();
  const fence = text.match(/```(?:java|Java|JAVA)?\s*\n?([\s\S]*?)```/);
  if (fence) text = fence[1];
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  const entities: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
  };
  for (const [entity, char] of Object.entries(entities)) text = text.replaceAll(entity, char);
  return text.trim();
}

function sanitizeModule(m: any, index: number) {
  const id = m.id || slugify(m.title || `module-${index}`);
  const icon = m.icon || MODULE_ICONS[index % MODULE_ICONS.length];
  const slides = (m.slides ?? []).map((s: any) => ({
    title: s.title || "Untitled slide",
    bullets: (s.bullets ?? []).filter((b: any) => typeof b === "string" && b.trim()),
  }));
  let practicalType = m.practicalType || "none";
  if (!["code", "example", "none"].includes(practicalType)) {
    practicalType = m.practical ? "example" : "none";
  }
  return {
    id, icon, title: m.title || `Module ${index + 1}`, slides,
    practicalType,
    practicalLanguage: (m.practicalLanguage || "").toLowerCase(),
    practical: stripCodeFences(m.practical || ""),
    practicalNote: stripCodeFences(m.practicalNote || ""),
  };
}

function extractJson(raw: string): any {
  raw = raw.trim();
  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fence) raw = fence[1];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);
  return JSON.parse(raw);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const lecturerAuth = await getCurrentLecturer(req);
    if (!lecturerAuth) return json({ error: "Sign in as a lecturer required" }, 401);
    const allowed = await checkRateLimit(lecturerAuth.id, "generate-course");
    if (!allowed) return json({ error: "You're generating courses quite fast — please wait a few minutes and try again." }, 429);

    const data = await req.json();
    const title = (data.title ?? "").trim();
    const lecturer = data.lecturer ?? "";
    const institution = data.institution ?? "";
    const sourceText = (data.sourceText ?? "").trim();

    if (!title) return json({ error: "title required" }, 400);
    if (!sourceText) return json({ error: "sourceText required — paste a description, outline, or uploaded content" }, 400);

    const userMessage = `Course title: ${title}
Lecturer: ${lecturer || "Not specified"}
Institution: ${institution || "Not specified"}

SOURCE MATERIAL (description, syllabus, or extracted slide/PDF/notes text provided by the lecturer):
---
${sourceText.slice(0, 12000)}
---

Generate the course JSON now.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: GENERATE_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 8000, responseMimeType: "application/json" },
        }),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gemini API error", resp.status, errText);
      return json({ error: errText }, 500);
    }

    const result = await resp.json();
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed: any;
    try {
      parsed = extractJson(raw);
    } catch (e) {
      console.error("JSON parse failure. Raw text was:", raw);
      return json({ error: `SEMAI produced an unexpected format — please try again. (${e})` }, 502);
    }

    const modules = (parsed.modules ?? []).map((m: any, i: number) => sanitizeModule(m, i));

    return json({
      title,
      description: parsed.description ?? "",
      subject: parsed.subject ?? "",
      lecturer,
      institution,
      outline: sourceText.slice(0, 4000),
      modules,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
