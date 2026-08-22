from flask import Blueprint, request, jsonify
import anthropic
import os
import json
import re

from .codeutils import strip_code_fences

generate_bp = Blueprint("generate", __name__)
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

MODULE_ICONS = ["📘", "🔷", "🧱", "🔀", "🧬", "🗄️", "⚙️", "📦", "🧮", "🌐"]

GENERATE_SYSTEM_PROMPT = """You are an expert curriculum designer helping a lecturer turn their raw
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
- Each module should have 2 to 4 slides, each slide with 3 to 6 bullets. Bullets are short summary
  phrases — they are NOT the full explanation, SEMAI will teach around them live — keep them concise
  (under 15 words each).
- The "practical" field must be plain text only — never wrap it in ```fences or HTML, regardless of practicalType.
- Base everything strictly on the source material provided. If the source is a short description rather
  than a full syllabus, use your subject expertise to build out a sensible, well-sequenced module structure
  a real lecturer would teach — but stay true to what was actually asked for.
- Output must be a single JSON object and nothing else."""


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def sanitize_module(module: dict, index: int) -> dict:
    """Guarantee module has required shape and clean, fence-free practical content."""
    mid = module.get("id") or slugify(module.get("title", f"module-{index}"))
    icon = module.get("icon") or MODULE_ICONS[index % len(MODULE_ICONS)]
    slides = []
    for s in module.get("slides", []):
        slides.append({
            "title": s.get("title", "Untitled slide"),
            "bullets": [b for b in s.get("bullets", []) if isinstance(b, str) and b.strip()],
        })

    practical_type = module.get("practicalType", "none")
    if practical_type not in ("code", "example", "none"):
        practical_type = "example" if module.get("practical") else "none"

    return {
        "id": mid,
        "icon": icon,
        "title": module.get("title", f"Module {index+1}"),
        "slides": slides,
        "practicalType": practical_type,
        "practicalLanguage": (module.get("practicalLanguage") or "").lower(),
        "practical": strip_code_fences(module.get("practical", "")),
        "practicalNote": strip_code_fences(module.get("practicalNote", "")),
    }


def extract_json(raw: str) -> dict:
    """Claude is asked for pure JSON, but defensively strip fences if present."""
    raw = raw.strip()
    fence = re.search(r"```(?:json)?\s*\n?([\s\S]*?)```", raw)
    if fence:
        raw = fence.group(1)
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        raw = raw[start:end+1]
    return json.loads(raw)


@generate_bp.route("/generate/course", methods=["POST"])
def generate_course():
    data = request.json or {}
    title = (data.get("title") or "").strip()
    lecturer = data.get("lecturer", "")
    institution = data.get("institution", "")
    source_text = (data.get("sourceText") or "").strip()

    if not title:
        return jsonify({"error": "title required"}), 400
    if not source_text:
        return jsonify({"error": "sourceText required — paste a description, outline, or uploaded content"}), 400

    user_message = f"""Course title: {title}
Lecturer: {lecturer or "Not specified"}
Institution: {institution or "Not specified"}

SOURCE MATERIAL (description, syllabus, or extracted slide/PDF/notes text provided by the lecturer):
---
{source_text[:12000]}
---

Generate the course JSON now."""

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8000,
            system=GENERATE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
        raw = resp.content[0].text
        parsed = extract_json(raw)

        modules = [sanitize_module(m, i) for i, m in enumerate(parsed.get("modules", []))]

        course = {
            "title": title,
            "description": parsed.get("description", ""),
            "subject": parsed.get("subject", ""),
            "lecturer": lecturer,
            "institution": institution,
            "outline": source_text[:4000],
            "modules": modules,
        }
        return jsonify(course)
    except json.JSONDecodeError:
        return jsonify({"error": "SEMAI produced an unexpected format — please try again."}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@generate_bp.route("/generate/upload", methods=["POST"])
def upload_source():
    """Accepts a PDF (or plain text) file and returns extracted text for the
    lecturer to review/edit before generating a course from it."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    f = request.files["file"]
    filename = (f.filename or "").lower()

    if filename.endswith(".pdf"):
        try:
            from pypdf import PdfReader
        except ImportError:
            return jsonify({"error": "PDF support not installed on server (pypdf missing)"}), 500
        try:
            reader = PdfReader(f)
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as e:
            return jsonify({"error": f"Could not read PDF: {e}"}), 400
    else:
        try:
            text = f.read().decode("utf-8", errors="ignore")
        except Exception as e:
            return jsonify({"error": f"Could not read file: {e}"}), 400

    text = text.strip()
    if not text:
        return jsonify({"error": "No extractable text found in that file"}), 422

    return jsonify({"text": text[:20000]})
