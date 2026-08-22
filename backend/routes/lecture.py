from flask import Blueprint, request, jsonify
import anthropic
import os

from .codeutils import strip_markdown_prose

lecture_bp = Blueprint("lecture", __name__)
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))


def build_explain_prompt(course_title: str, module_title: str, student_name: str) -> str:
    return f"""You are SEMAI, an AI university lecturer created by Steven Ssemambo (SayMyTech Developers),
currently teaching {course_title}, module "{module_title}", to a student named {student_name}.

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
- Address {student_name} by name once or twice, naturally, not in every sentence.
- Do not stop early. You must explain ALL of the bullet points provided before finishing.
- This will be converted to speech, so: no markdown, no asterisks, no bullet symbols, no headers,
  no numbered lists — pure spoken prose only, in full sentences.
- End with a short natural transition line inviting questions, e.g. "Any questions on this before
  we move on? You can type or speak to me."
- Aim for a genuinely thorough explanation — around 150 to 260 words is expected for a slide with
  several points. Do not pad or repeat yourself — every sentence should teach something."""


@lecture_bp.route("/lecture/explain", methods=["POST"])
def explain_slide():
    data = request.json or {}
    course_title = data.get("courseTitle", "this course")
    module_title = data.get("moduleTitle", "this module")
    student_name = data.get("studentName", "Student")
    slide_title = data.get("slideTitle", "")
    bullets = data.get("bullets", [])

    if not bullets:
        return jsonify({"error": "bullets required"}), 400

    bullet_block = "\n".join(f"- {b}" for b in bullets)
    user_message = f"""Slide title: {slide_title}

Bullet points to teach (explain every single one, in order):
{bullet_block}

Please teach this slide now."""

    try:
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=900,
            system=build_explain_prompt(course_title, module_title, student_name),
            messages=[{"role": "user", "content": user_message}],
        )
        raw = resp.content[0].text
        explanation = strip_markdown_prose(raw)
        return jsonify({"explanation": explanation})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
