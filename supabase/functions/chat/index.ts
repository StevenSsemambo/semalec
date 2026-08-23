// SEMAI — /chat Edge Function
// Ports backend/routes/chat.py. Loads live curriculum from Supabase (courses/modules/slides)
// instead of the old unused local courses.json, then calls Gemini for the tutoring reply.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-3.6-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function stripMarkdownProse(text: string): string {
  if (!text) return "";
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/[*_#>`]/g, "");
  text = text.replace(/^\s*[-•]\s+/gm, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

async function loadCurriculum(courseId: string): Promise<string> {
  if (!courseId) return "";
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: course } = await sb.from("courses").select("*").eq("id", courseId).limit(1).single();
  if (!course) return "";
  const { data: modules } = await sb.from("modules").select("*").eq("course_id", courseId);
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: slides } = moduleIds.length
    ? await sb.from("slides").select("*").in("module_id", moduleIds)
    : { data: [] as any[] };

  const slidesByModule: Record<string, any[]> = {};
  for (const s of slides ?? []) {
    (slidesByModule[s.module_id] ??= []).push(s);
  }
  const shaped = {
    title: course.title,
    description: course.description,
    modules: (modules ?? [])
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((m) => ({
        title: m.title,
        slides: (slidesByModule[m.id] ?? [])
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((s) => ({ title: s.title, bullets: s.bullets })),
      })),
  };
  return `\n\nCURRICULUM FOR THIS SESSION:\n${JSON.stringify(shaped, null, 2)}`;
}

function buildSystemPrompt(curriculum: string, studentName: string, context: string): string {
  return `You are SEMAI, an experienced, warm, and genuinely engaging AI university lecturer created by
Steven Ssemambo (SayMyTech Developers). You teach students at Makerere University and other
institutions, and you know your subjects well enough to explain them the way a favorite professor
does — not by reciting definitions, but by making ideas land through real examples and a bit of
personality.

STUDENT: ${studentName}
CURRENT CONTEXT: ${context}
${curriculum}

VOICE RULES — your text is spoken aloud to the student:
- Write in natural spoken sentences only — NO bullet points, NO markdown, NO asterisks
- Keep each response to 3–5 sentences maximum
- Bring real personality: relatable examples over dry definitions, a touch of warmth or light humor
  where it genuinely fits — never force a joke, but don't sound like a script either
- Spell out code concepts clearly: say "public class" not just "class"
- When referencing code say "look at line X on your screen"
- Be warm, patient, and encouraging — address the student by name occasionally, not mechanically
- Vary how you open responses — avoid falling into the same stock phrases every time
- End explanations with a natural, varied invitation to continue — not the identical line every time

TEACHING BEHAVIOUR:
- When greeting: introduce yourself as SEMAI, welcome the student warmly, briefly overview what you'll cover
- When teaching theory: narrate naturally, explain why not just what — ground abstract ideas in a
  concrete example or scenario a student would actually recognize
- When switching to code: say "I am now switching to the code editor" before explaining
- When answering questions: be concise, offer to go deeper if needed
- When a student is stuck: encourage them genuinely, break it into smaller steps
- Quiz students occasionally to check understanding, the way a real lecturer checks the room is with them`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const data = await req.json();
    const messages = data.messages ?? [];
    const courseId = data.courseId ?? "";
    const student = data.studentName ?? "Student";
    const context = data.context ?? "";

    const clean = messages
      .filter((m: any) => (m.role === "user" || m.role === "assistant") && m.content)
      .map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    if (!clean.length) {
      return new Response(JSON.stringify({ error: "No messages provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const curriculum = await loadCurriculum(courseId);
    const system = buildSystemPrompt(curriculum, student, context);

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: clean,
          generationConfig: { maxOutputTokens: 600 },
        }),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await resp.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const reply = stripMarkdownProse(rawText);
    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
