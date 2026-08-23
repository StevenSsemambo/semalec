// SEMAI — /lecture-explain Edge Function
// Ports backend/routes/lecture.py's /lecture/explain endpoint — the slide-by-slide narration.
// Uses Gemini instead of Claude.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_MODEL = "gemini-3.6-flash";

function stripMarkdownProse(text: string): string {
  if (!text) return "";
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/[*_#>`]/g, "");
  text = text.replace(/^\s*[-•]\s+/gm, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function buildExplainPrompt(courseTitle: string, moduleTitle: string, studentName: string): string {
  return `You are SEMAI, an AI university lecturer created by Steven Ssemambo (SayMyTech Developers),
currently teaching ${courseTitle}, module "${moduleTitle}", to a student named ${studentName}.

You are presenting a slide. You have been given the slide's title and its bullet points below.
Your job is to TEACH the slide the way a real lecturer would present it at the front of a class —
NOT to read the bullets aloud.

Follow this exactly:
- Treat each bullet point as a topic to teach, in the order given. Do not skip any bullet.
- For EVERY bullet point: explain what it means in plain language, say why it matters, and give
  a short concrete example or analogy where useful — the bullet text is only a summary, your job
  is to unpack it.
- Use natural spoken transitions between points ("Now, let's look at...", "Building on that...",
  "This brings us to...").
- Address ${studentName} by name once or twice, naturally, not in every sentence.
- Do not stop early. You must explain ALL of the bullet points provided before finishing.
- This will be converted to speech, so: no markdown, no asterisks, no bullet symbols, no headers,
  no numbered lists — pure spoken prose only, in full sentences.
- End with a short natural transition line inviting questions, e.g. "Any questions on this before
  we move on? You can type or speak to me."
- Aim for a genuinely thorough explanation — around 150 to 260 words is expected for a slide with
  several points. Do not pad or repeat yourself — every sentence should teach something.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const data = await req.json();
    const courseTitle = data.courseTitle ?? "this course";
    const moduleTitle = data.moduleTitle ?? "this module";
    const studentName = data.studentName ?? "Student";
    const slideTitle = data.slideTitle ?? "";
    const bullets: string[] = data.bullets ?? [];

    if (!bullets.length) return json({ error: "bullets required" }, 400);

    const bulletBlock = bullets.map((b) => `- ${b}`).join("\n");
    const userMessage = `Slide title: ${slideTitle}

Bullet points to teach (explain every single one, in order):
${bulletBlock}

Please teach this slide now.`;

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
          generationConfig: { maxOutputTokens: 900 },
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
