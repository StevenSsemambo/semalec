// SEMAI — /tts-config Edge Function
// Ports backend/routes/tts.py's /tts/config endpoint.
// Frontend checks this to know which TTS mode to use (browser Web Speech API vs ElevenLabs).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const hasEleven = !!Deno.env.get("ELEVENLABS_API_KEY");
  return new Response(
    JSON.stringify({ mode: hasEleven ? "elevenlabs" : "browser", enabled: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
