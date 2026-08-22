from flask import Blueprint, request, jsonify
import anthropic
import os
import json

from .codeutils import strip_markdown_prose

chat_bp = Blueprint("chat", __name__)
client  = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

def load_curriculum(course_id: str) -> str:
    """Load curriculum from JSON store."""
    path = os.path.join(os.path.dirname(__file__), "..", "data", "courses.json")
    try:
        with open(path) as f:
            courses = json.load(f)
        course = courses.get(course_id)
        if course:
            return f"\n\nCURRICULUM FOR THIS SESSION:\n{json.dumps(course, indent=2)}"
    except Exception:
        pass
    return ""

def build_system_prompt(course_id: str, student_name: str, context: str) -> str:
    curriculum = load_curriculum(course_id)
    return f"""You are SEMAI, an AI university lecturer created by Steven Ssemambo (SayMyTech Developers).
You teach students at Makerere University and other institutions.

STUDENT: {student_name}
CURRENT CONTEXT: {context}
{curriculum}

VOICE RULES — your text is spoken aloud to the student:
- Write in natural spoken sentences only — NO bullet points, NO markdown, NO asterisks
- Keep each response to 3–5 sentences maximum
- Spell out code concepts clearly: say "public class" not just "class"
- When referencing code say "look at line X on your screen"
- Be warm, patient, and encouraging — address the student by name occasionally
- Say "great question!" when appropriate
- End explanations with "Any questions? You can type or speak to me."

TEACHING BEHAVIOUR:
- When greeting: introduce yourself as SEMAI, welcome the student, briefly overview what you will cover
- When teaching theory: narrate naturally, explain why not just what
- When switching to code: say "I am now switching to the code editor" before explaining
- When answering questions: be concise, offer to go deeper if needed
- When a student is stuck: encourage them, break it into smaller steps
- Quiz students occasionally to check understanding"""

@chat_bp.route("/chat", methods=["POST"])
def chat():
    data        = request.json
    messages    = data.get("messages", [])
    course_id   = data.get("courseId", "tdit214")
    student     = data.get("studentName", "Student")
    context     = data.get("context", "")

    # Validate messages
    clean = [{"role": m["role"], "content": m["content"]}
             for m in messages if m.get("role") in ("user", "assistant") and m.get("content")]
    if not clean:
        return jsonify({"error": "No messages provided"}), 400

    try:
        resp = client.messages.create(
            model      = "claude-sonnet-4-6",
            max_tokens = 600,
            system     = build_system_prompt(course_id, student, context),
            messages   = clean,
        )
        reply = strip_markdown_prose(resp.content[0].text)
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
