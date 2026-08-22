from flask import Blueprint, jsonify

tts_bp = Blueprint("tts", __name__)

# Browser Web Speech API handles TTS on the frontend for now.
# When you get an ElevenLabs key, replace this with:
#
# import requests
# ELEVEN_KEY  = os.environ.get("ELEVENLABS_API_KEY")
# VOICE_ID    = "EXAVITQu4vr4xnSDxMaL"  # Rachel — natural female voice
#
# @tts_bp.route("/tts", methods=["POST"])
# def synthesise():
#     text = request.json.get("text","")
#     url  = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}/stream"
#     headers = {"xi-api-key": ELEVEN_KEY, "Content-Type": "application/json"}
#     body = {"text": text, "model_id": "eleven_turbo_v2",
#             "voice_settings": {"stability":0.5,"similarity_boost":0.75}}
#     r = requests.post(url, json=body, headers=headers, stream=True)
#     return Response(r.iter_content(chunk_size=1024),
#                     content_type="audio/mpeg",
#                     headers={"Transfer-Encoding":"chunked"})

@tts_bp.route("/tts/config", methods=["GET"])
def tts_config():
    """Frontend checks this to know which TTS mode to use."""
    import os
    has_eleven = bool(os.environ.get("ELEVENLABS_API_KEY"))
    return jsonify({
        "mode":    "elevenlabs" if has_eleven else "browser",
        "enabled": True,
    })
