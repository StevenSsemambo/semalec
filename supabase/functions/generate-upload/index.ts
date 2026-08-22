// SEMAI — /generate-upload Edge Function
// Ports backend/routes/generate.py's /generate/upload endpoint.
// Accepts a PDF (or plain text) file and returns extracted text for the lecturer to
// review/edit before generating a course from it. Uses `unpdf`, which is built for
// edge/serverless runtimes (Deno, Cloudflare Workers, Vercel Edge) — pypdf has no Deno equivalent.

import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) return json({ error: "No file uploaded" }, 400);

    const filename = (file.name || "").toLowerCase();
    let text = "";

    if (filename.endsWith(".pdf")) {
      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const pdf = await getDocumentProxy(buf);
        const { text: extracted } = await extractText(pdf, { mergePages: true });
        text = extracted;
      } catch (e) {
        return json({ error: `Could not read PDF: ${e}` }, 400);
      }
    } else {
      try {
        text = await file.text();
      } catch (e) {
        return json({ error: `Could not read file: ${e}` }, 400);
      }
    }

    text = text.trim();
    if (!text) return json({ error: "No extractable text found in that file" }, 422);

    return json({ text: text.slice(0, 20000) });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
