# SEMAI

An AI-powered lecture platform. A lecturer builds or generates a course; SEMAI teaches it
live to students, slide by slide, in a Zoom-style interface.

## Architecture

- **Frontend** — Vite + React (`frontend/`). Deploys to **Netlify** as a static site.
- **Backend** — **Supabase Edge Functions** (`supabase/functions/`). No separate server to host.
- **Database + Auth** — **Supabase** (Postgres + Auth). Schema in `supabase/schema.sql`.

> `backend/` (the original Flask app) is kept in this repo only as reference for the port —
> it is not deployed or used. All of its routes now live in `supabase/functions/`.

| Old Flask route                     | Edge Function      |
|--------------------------------------|---------------------|
| `POST /chat`                         | `chat`              |
| `GET/POST/DELETE /curriculum[/:id]`  | `curriculum`        |
| `GET /tts/config`                    | `tts-config`        |
| `POST /lecture/explain`              | `lecture-explain`   |
| `POST /generate/course`              | `generate-course`   |
| `POST /generate/upload`              | `generate-upload`   |

## One-time setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL editor (creates `profiles`, `courses`, `modules`,
   `slides`, `progress` — all with RLS enabled).
3. Deploy the Edge Functions:
   ```bash
   supabase functions deploy chat curriculum tts-config lecture-explain generate-course generate-upload \
     --project-ref YOUR_PROJECT_REF
   ```
4. Set the Gemini key as a function secret (never put this in frontend env vars). Get a free key
   from [Google AI Studio](https://aistudio.google.com/apikey) — the format is `AIza...`:
   ```bash
   supabase secrets set GEMINI_API_KEY=AIza... --project-ref YOUR_PROJECT_REF
   ```
   `chat`, `lecture-explain`, and `generate-course` call the free-tier `gemini-2.5-flash` model.
   Swap the `GEMINI_MODEL` constant at the top of each function if you want a different one.
   Optional — enable ElevenLabs voice instead of the browser's built-in TTS:
   ```bash
   supabase secrets set ELEVENLABS_API_KEY=... --project-ref YOUR_PROJECT_REF
   ```

### 2. Frontend → Netlify

1. Copy `frontend/.env.example` to `frontend/.env.local` and fill in your Supabase project URL
   and **anon** key (Project Settings → API — never use the service role key here).
2. Push this repo to GitHub, then in Netlify: **Add new site → Import an existing project**.
3. Netlify reads `netlify.toml` at the repo root automatically (base `frontend/`, build
   `npm run build`, publish `frontend/dist`).
4. In **Site configuration → Environment variables**, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` with the same values as your `.env.local`.
5. Deploy.

## Local development

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

The frontend talks directly to your Supabase project's Edge Functions and database —
no local backend process needed.
