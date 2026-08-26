// SEMAI — /practical-walkthrough Edge Function
// Generates a step-by-step narrated walkthrough of a module's practical (code demo or worked
// example), so SEMAI can work through it live with the student instead of dumping it statically.
// For code: each step references exact line numbers in the given source so the frontend can
// highlight along as SEMAI narrates. For worked examples: each step references a short verbatim
// excerpt so the frontend can highlight the corresponding passage.

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

async function checkRateLimit(userId: string, fn: string, limit = 20, windowMs = 10 * 60 * 1000): Promise<boolean> {
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

function extractJson(raw: string): any {
  raw = raw.trim();
  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fence) raw = fence[1];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1);
  return JSON.parse(raw);
}

function buildSystemPrompt(courseTitle: string, moduleTitle: string, studentName: string, practicalType: string): string {
  const kind = practicalType === "code" ? "a piece of code" : "a worked example";
  return `You are SEMAI, an experienced, warm, genuinely engaging university lecturer created by
Steven Ssemambo (SayMyTech Developers), currently teaching ${courseTitle}, module "${moduleTitle}",
one-on-one to a student named ${studentName}. You are about to walk through ${kind} live with them,
the way a real lecturer works through an example on screen — narrating your thinking step by step,
not just presenting a finished result and reading it.

You will be given the full source content (code or worked example, with line numbers if it's code).
Break it into a small number of natural teaching steps (roughly 3 to 7, depending on length and
complexity — don't over-split something short). For each step, decide what portion of the content it
covers and write a genuine spoken narration for that step: explain what's happening and why, in your
own words, with real personality — a relatable example or light aside where it fits, occasional
engagement ("see how that works?", "make sense so far?"), never a dry restatement of the code/text
itself. This is spoken aloud, so: no markdown, no asterisks, no code syntax read literally character
by character — describe what the code does in plain spoken language.

Return ONLY valid JSON, no commentary, matching EXACTLY this schema:

{
  "steps": [
    ${practicalType === "code"
      ? `{ "startLine": 1, "endLine": 3, "narration": "spoken explanation of this chunk of code" }`
      : `{ "snippet": "a short exact excerpt copied verbatim from the source marking where this step begins", "narration": "spoken explanation of this part of the example" }`
    }
  ],
  "closing": "a short, warm, natural spoken line wrapping up the walkthrough and inviting questions or moving on — varied, not a stock phrase"
}

Rules:
${practicalType === "code"
  ? `- startLine/endLine are 1-indexed line numbers from the numbered source given below, inclusive, and steps should cover the source roughly in order without large unexplained gaps.`
  : `- "snippet" must be an exact, short (under 15 words), verbatim substring copied directly from the source content — not paraphrased — so it can be located and highlighted.`
}
- Every step's narration should feel like genuine live teaching — explain the "why", not just the "what".
- Output must be a single JSON object and nothing else.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const userId = await getCurrentUserId(req);
    if (!userId) return json({ error: "Sign in required" }, 401);
    const allowed = await checkRateLimit(userId, "practical-walkthrough");
    if (!allowed) return json({ error: "Too many requests in a short time — please slow down a little." }, 429);

    const data = await req.json();
    const courseTitle = data.courseTitle ?? "this course";
    const moduleTitle = data.moduleTitle ?? "this module";
    const studentName = data.studentName ?? "Student";
    const practicalType = data.practicalType === "code" ? "code" : "example";
    const content = (data.content ?? "").trim();
    const practicalNote = data.practicalNote ?? "";

    if (!content) return json({ error: "content required" }, 400);

    const sourceForPrompt = practicalType === "code"
      ? content.split("\n").map((line: string, i: number) => `${i + 1}: ${line}`).join("\n")
      : content;

    const userMessage = `${practicalType === "code" ? "SOURCE CODE (numbered)" : "WORKED EXAMPLE"}:
---
${sourceForPrompt}
---
${practicalNote ? `\nContext note from the lecturer's prep: ${practicalNote}\n` : ""}
Break this into a step-by-step live walkthrough now.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": GEMINI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemPrompt(courseTitle, moduleTitle, studentName, practicalType) }] },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: { maxOutputTokens: 3000, responseMimeType: "application/json" },
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

    const steps = (parsed.steps ?? []).map((s: any) => ({
      startLine: s.startLine,
      endLine: s.endLine,
      snippet: s.snippet ?? "",
      narration: stripMarkdownProse(s.narration ?? ""),
    })).filter((s: any) => s.narration);

    if (!steps.length) return json({ error: "No walkthrough steps were generated — please try again." }, 502);

    return json({ steps, closing: stripMarkdownProse(parsed.closing ?? "That's the walkthrough — well done!") });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
