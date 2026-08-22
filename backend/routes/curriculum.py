from flask import Blueprint, request, jsonify
import re

from db import get_supabase
from .auth_utils import require_lecturer

curriculum_bp = Blueprint("curriculum", __name__)


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _assemble_course(course_row, modules_rows, slides_by_module):
    modules = []
    for m in sorted(modules_rows, key=lambda r: r.get("position", 0)):
        slides = [
            {"title": s.get("title", ""), "bullets": s.get("bullets", [])}
            for s in sorted(slides_by_module.get(m["id"], []), key=lambda r: r.get("position", 0))
        ]
        modules.append({
            "id": m["id"], "icon": m.get("icon", ""), "title": m.get("title", ""), "slides": slides,
            "practicalType": m.get("practical_type", "none"),
            "practicalLanguage": m.get("practical_language", ""),
            "practical": m.get("practical", ""),
            "practicalNote": m.get("practical_note", ""),
        })
    return {
        "id": course_row["id"], "title": course_row["title"],
        "description": course_row.get("description", ""), "subject": course_row.get("subject", ""),
        "outline": course_row.get("outline", ""), "lecturer": course_row.get("lecturer_name", ""),
        "institution": course_row.get("institution", ""), "modules": modules,
    }


# ── GET all courses (summary list, for the Join screen dropdown) ───────────────
@curriculum_bp.route("/curriculum", methods=["GET"])
def get_all():
    sb = get_supabase()
    courses = sb.table("courses").select("id,title,description,subject,lecturer_name").execute().data
    modules = sb.table("modules").select("course_id").execute().data
    counts = {}
    for m in modules:
        counts[m["course_id"]] = counts.get(m["course_id"], 0) + 1
    return jsonify({"courses": [
        {"id": c["id"], "title": c["title"], "description": c.get("description") or "",
         "subject": c.get("subject") or "", "lecturer": c.get("lecturer_name") or "",
         "moduleCount": counts.get(c["id"], 0)}
        for c in courses
    ]})


# ── GET single course (full, nested — what the Lecture screen loads) ──────────
@curriculum_bp.route("/curriculum/<course_id>", methods=["GET"])
def get_one(course_id):
    sb = get_supabase()
    course_res = sb.table("courses").select("*").eq("id", course_id).limit(1).execute().data
    if not course_res:
        return jsonify({"error": "Course not found"}), 404
    course_row = course_res[0]

    modules_rows = sb.table("modules").select("*").eq("course_id", course_id).execute().data
    module_ids = [m["id"] for m in modules_rows]
    slides_rows = (
        sb.table("slides").select("*").in_("module_id", module_ids).execute().data
        if module_ids else []
    )
    slides_by_module = {}
    for s in slides_rows:
        slides_by_module.setdefault(s["module_id"], []).append(s)

    return jsonify(_assemble_course(course_row, modules_rows, slides_by_module))


# ── CREATE / REPLACE course — lecturer must be signed in ──────────────────────
@curriculum_bp.route("/curriculum", methods=["POST"])
@require_lecturer
def create():
    data = request.json or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title required"}), 400

    course_id = data.get("id") or slugify(title)
    sb = get_supabase()

    sb.table("courses").upsert({
        "id": course_id,
        "title": title,
        "description": data.get("description", ""),
        "subject": data.get("subject", ""),
        "outline": data.get("outline", ""),
        "lecturer_id": request.lecturer_id,
        "lecturer_name": data.get("lecturer") or request.lecturer_email,
        "institution": data.get("institution", ""),
    }).execute()

    # Replace modules/slides wholesale — simplest correct approach for a full course (re)save.
    sb.table("modules").delete().eq("course_id", course_id).execute()
    for i, m in enumerate(data.get("modules", [])):
        mod_res = sb.table("modules").insert({
            "course_id": course_id,
            "position": i,
            "icon": m.get("icon", ""),
            "title": m.get("title", ""),
            "practical_type": m.get("practicalType", "none"),
            "practical_language": m.get("practicalLanguage", ""),
            "practical": m.get("practical", ""),
            "practical_note": m.get("practicalNote", ""),
        }).execute()
        module_id = mod_res.data[0]["id"]

        slides = [
            {"module_id": module_id, "position": j, "title": s.get("title", ""), "bullets": s.get("bullets", [])}
            for j, s in enumerate(m.get("slides", []))
        ]
        if slides:
            sb.table("slides").insert(slides).execute()

    return jsonify({"id": course_id, "message": "Course saved"}), 201


# ── DELETE course — only the lecturer who created it ──────────────────────────
@curriculum_bp.route("/curriculum/<course_id>", methods=["DELETE"])
@require_lecturer
def delete(course_id):
    sb = get_supabase()
    course_res = sb.table("courses").select("lecturer_id").eq("id", course_id).limit(1).execute().data
    if not course_res:
        return jsonify({"error": "Not found"}), 404
    if course_res[0].get("lecturer_id") != request.lecturer_id:
        return jsonify({"error": "You can only delete courses you created"}), 403

    sb.table("courses").delete().eq("id", course_id).execute()  # cascades to modules/slides
    return jsonify({"message": "Deleted"})
