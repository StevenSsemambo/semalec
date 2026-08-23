// SEMAI — /generate-module Edge Function
// Generates ONE new module (slides + practical) to append to an existing course, so a
// lecturer adding a module to a course just describes/pastes its content and SEMAI designs
// it — same pattern as full course generation, scoped to a single module.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-3.6-flash";
const MODULE_ICONS = ["📘", "🔷", "🧱", "🔀", "🧬", "🗄️", "⚙️", "📦", "🧮", "🌐"];

const SYSTEM_PROMPT = `You are an expert curriculum designer helping a lecturer add ONE new module
to an existing course for SEMAI, an AI lecturer app. This app is used across ALL subjects —
programming, business, marketing, accounting, history, science, law, anything a lecturer teaches.

Return ONLY valid JSON — no markdown fences, no commentary, no prose before or after — matching
EXACTLY this schema for a single module:

{
  "icon": "one relevant emoji",
  "title": "Module title",
  "slides": [
    { "title": "Slide title", "bullets": ["point 1", "point 2", "point 3", "point 4"] }
  ],
  "practicalType": "code | example | none",
  "practicalLanguage": "the programming language if practicalType is code, e.g. java, python, sql — otherwise empty string",
  "practical": "the hands-on content — RAW plain text only, no markdown fences, no HTML: if practicalType is code, a complete working code example; if practicalType is example, a short worked example, mini case study, or practice scenario; if practicalType is none, an empty string",
  "practicalNote": "2-3 sentences (plain text, no markdown) explaining what the practical demonstrates — or empty string if practicalType is none"
}

Rules:
- Use "code" only for programming/technical subjects where real source code genuinely helps. Use
  "example" for a worked example, mini case study, or practice scenario for non-programming subjects.
  Use "none" only if a hands-on section genuinely doesn't fit.
- Produce 2 to 4 slides, each with 3 to 6 bullets. Each bullet must be a real, self-contained piece of
  content, not a fragment — write it as "Key term or short phrase — one clear sentence explaining or
  elaborating it" (use an em dash between the two parts). Someone should be able to understand the point
  from the bullet alone, on screen — SEMAI will still teach and expand around it live, but the slide
  itself must look like a real, informative lecture slide, never a bare outline. Aim for roughly 10-22
  words total per bullet.
- The "practical" field must be plain text only — never wrapped in \`\`\`fences or HTML.
- Base everything strictly on the module topic and source material given. Stay consistent with the
  course it belongs to.
- Output must be a single JSON object and nothing else.`;

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function stripCodeFences(text: string): string {
  if (!text) return "";
  text = text.trim();
  const fence = text.match(/```(?:\w+)?\s*\n?([\s\S]*?)```/);
  if (fence) text = fence[1];
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, "");
  const entities: Record<string, string> = {
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'",
  };
  for (const [entity, char] of Object.entries(entities)) text = text.replaceAll(entity, char);
  return text.trim();
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
    const data = await req.json();
    const courseTitle = (data.courseTitle ?? "").trim();
    const subject = data.subject ?? "";
    const moduleTitle = (data.moduleTitle ?? "").trim();
    const sourceText = (data.sourceText ?? "").trim();

    if (!moduleTitle) return json({ error: "moduleTitle required" }, 400);
    if (!sourceText) return json({ error: "sourceText required — describe or paste what this module should cover" }, 400);

    const userMessage = `Course: ${courseTitle || "Not specified"}${subject ? ` (${subject})` : ""}
New module topic: ${moduleTitle}

SOURCE MATERIAL for this module (description, notes, or outline provided by the lecturer):
---
${sourceText.slice(0, 8000)}
---

Generate the module JSON now.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 4000, responseMimeType: "application/json" },
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

    let m: any;
    try {
      m = extractJson(raw);
    } catch (e) {
      console.error("JSON parse failure. Raw text was:", raw);
      return json({ error: `SEMAI produced an unexpected format — please try again. (${e})` }, 502);
    }

    const slides = (m.slides ?? []).map((s: any) => ({
      title: s.title || "Untitled slide",
      bullets: (s.bullets ?? []).filter((b: any) => typeof b === "string" && b.trim()),
    }));
    let practicalType = m.practicalType || "none";
    if (!["code", "example", "none"].includes(practicalType)) {
      practicalType = m.practical ? "example" : "none";
    }

    return json({
      id: slugify(moduleTitle) || `module-${Date.now()}`,
      icon: m.icon || MODULE_ICONS[Math.floor(Math.random() * MODULE_ICONS.length)],
      title: m.title || moduleTitle,
      slides,
      practicalType,
      practicalLanguage: (m.practicalLanguage || "").toLowerCase(),
      practical: stripCodeFences(m.practical || ""),
      practicalNote: stripCodeFences(m.practicalNote || ""),
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
