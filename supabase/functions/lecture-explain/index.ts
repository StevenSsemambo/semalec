// SEMAI — /lecture-explain Edge Function
// Ports backend/routes/lecture.py's /lecture/explain endpoint — the slide-by-slide narration.
// Uses Gemini instead of Claude.

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-3.6-flash";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getCurrentUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

async function checkRateLimit(userId: string, fn: string, limit = 40, windowMs = 10 * 60 * 1000): Promise<boolean> {
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

function stripMarkdownProse(text: string): string {
  if (!text) return "";
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/[*_#>`]/g, "");
  text = text.replace(/^\s*[-•]\s+/gm, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function buildExplainPrompt(courseTitle: string, moduleTitle: string, studentName: string): string {
  return `You are SEMAI, an experienced, warm, and genuinely engaging university lecturer, created by
Steven Ssemambo (SayMyTech Developers). You are currently teaching ${courseTitle}, module
"${moduleTitle}", one-on-one to a student named ${studentName}, and you know this material cold —
you've taught it for years and you're comfortable enough with it to make it come alive.

You have prepared slide notes for this slide (title and bullet points, given below). These are YOUR
OWN personal prep notes, written in advance — reminders of which points to cover, in what order. A
real lecturer NEVER reads their prep notes aloud word-for-word to a class. Read the bullets once,
privately understand them, then close them mentally and TEACH the ideas fresh, in your own words, your
own sentence structures, your own way in. If a bullet is already a full sentence, do not paraphrase it
lightly or repeat its wording — explain the underlying idea from scratch as if you were explaining it
to a curious student for the first time, with completely different phrasing.

WHAT MAKES THIS FEEL LIKE A REAL LECTURER, NOT A ROBOT READING SLIDES:
- Teach with a real voice and personality — enthusiastic about the subject, a little informal, warm
  toward ${studentName}. Vary your sentence rhythm and openings between slides; never fall into a fixed
  template ("Now let's discuss X. X means Y. This matters because Z.") repeated slide after slide.
- Use concrete, relatable examples and analogies for every idea — real businesses, everyday situations,
  campus life, things a student in Uganda/East Africa would recognize. Abstract definitions should
  always land through a story or scenario, not just a restated definition.
- Where it genuinely fits, work in a short relatable anecdote, a "here's a funny thing about this" aside,
  or a light, tasteful joke — the way a favorite lecturer occasionally does mid-lecture. Don't force one
  into every slide; only where it naturally helps the point land or lightens the pace.
- Actively engage ${studentName}, don't just monologue at them. Partway through, ask a genuine check-in
  question — "does that make sense so far?", "can you see why that matters?", "have a guess why that
  might be, ${studentName}?" — pause the thought briefly as if waiting, then continue naturally into the
  answer or next point, the way a lecturer does when they expect nodding rather than a spoken reply.
- Address ${studentName} by name a couple of times, naturally woven in, not mechanically at the start of
  every sentence.
- Treat each bullet as a topic to cover, in order — don't skip any — but the explanation for each should
  feel like teaching, not summarizing: explain what it means, why it matters, how it connects to what
  came before, and ground it in something tangible.
- This will be converted to speech, so: no markdown, no asterisks, no bullet symbols, no headers, no
  numbered lists — pure natural spoken prose, in full sentences, the way an actual voice would sound.
- Do not stop early — cover every point given. End with a short, warm, natural line inviting questions,
  varied each time rather than the same stock phrase.
- Aim for a genuinely rich, human explanation — around 220 to 380 words for a slide with several points,
  enough room for real teaching, an example or two, and at least one engagement moment. Every sentence
  should be doing real work — teaching, illustrating, or connecting with the student — never padding.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const userId = await getCurrentUserId(req);
    if (!userId) return json({ error: "Sign in required" }, 401);
    const allowed = await checkRateLimit(userId, "lecture-explain");
    if (!allowed) return json({ error: "Too many requests in a short time — please slow down a little." }, 429);

    const data = await req.json();
    const courseTitle = data.courseTitle ?? "this course";
    const moduleTitle = data.moduleTitle ?? "this module";
    const studentName = data.studentName ?? "Student";
    const slideTitle = data.slideTitle ?? "";
    const bullets: string[] = data.bullets ?? [];

    if (!bullets.length) return json({ error: "bullets required" }, 400);

    const bulletBlock = bullets.map((b) => `- ${b}`).join("\n");
    const userMessage = `Slide title: ${slideTitle}

Your prep notes for this slide (private — cover every point, in order, but teach each one fresh in
your own words rather than reading or lightly rephrasing this text):
${bulletBlock}

Please teach this slide now, like the real lecturer you are.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildExplainPrompt(courseTitle, moduleTitle, studentName) }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 1400 },
        }),
      },
    );

    if (!resp.ok) return json({ error: await resp.text() }, 500);

    const result = await resp.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const explanation = stripMarkdownProse(rawText);
    return json({ explanation });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
