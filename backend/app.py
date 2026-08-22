from flask import Flask
from flask_cors import CORS
from routes.chat import chat_bp
from routes.curriculum import curriculum_bp
from routes.tts import tts_bp
from routes.lecture import lecture_bp
from routes.generate import generate_bp

app = Flask(__name__)
CORS(app, origins=["*"])  # update to your Vercel URL in production

app.register_blueprint(chat_bp,       url_prefix="/api")
app.register_blueprint(curriculum_bp, url_prefix="/api")
app.register_blueprint(tts_bp,        url_prefix="/api")
app.register_blueprint(lecture_bp,    url_prefix="/api")
app.register_blueprint(generate_bp,   url_prefix="/api")

@app.route("/")
def health():
    return {"status": "SEMAI backend running", "version": "1.0.0"}

if __name__ == "__main__":
    app.run(debug=True, port=5000)
