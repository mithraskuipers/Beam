import io
import json
import mimetypes
import socket
import zipfile
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, render_template, request, send_file, send_from_directory
from flask_socketio import SocketIO
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
ITEMS_FILE = UPLOAD_DIR / "_items.json"

PORT = 5050

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 1024 * 1024 * 1024  # 1 GB per upload
app.config["JSON_SORT_KEYS"] = False

socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    max_http_buffer_size=1024 * 1024 * 1024,
)


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def load_items():
    if ITEMS_FILE.exists():
        try:
            return json.loads(ITEMS_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
    return []


def save_items(items):
    ITEMS_FILE.write_text(json.dumps(items, indent=2), encoding="utf-8")


def category_for(mimetype: str) -> str:
    if not mimetype:
        return "file"
    if mimetype.startswith("image/"):
        return "image"
    if mimetype.startswith("video/"):
        return "video"
    return "file"


def get_lan_ip() -> str:
    """Best-effort LAN IP so a phone on the same network can reach us."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/send")
def send_page():
    return render_template("sender.html")


@app.route("/receive")
def receive_page():
    return render_template("receiver.html")


# ---------------------------------------------------------------------------
# API
# ---------------------------------------------------------------------------

@app.route("/api/info")
def api_info():
    ip = get_lan_ip()
    return jsonify(
        {
            "lan_ip": ip,
            "port": PORT,
            "sender_url": f"http://{ip}:{PORT}/send",
            "receiver_url": f"http://{ip}:{PORT}/receive",
        }
    )


@app.route("/api/qr")
def api_qr():
    import qrcode

    ip = get_lan_ip()
    url = f"http://{ip}:{PORT}/send"
    img = qrcode.make(url, box_size=8, border=2)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return send_file(buf, mimetype="image/png")


@app.route("/api/items")
def api_items():
    items = load_items()
    items.sort(key=lambda it: it["timestamp"], reverse=True)
    return jsonify(items)


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename, conditional=True)


@app.route("/upload", methods=["POST"])
def upload():
    file = request.files.get("file")
    if not file or file.filename == "":
        return jsonify({"error": "No file provided"}), 400

    original_name = file.filename
    safe_name = secure_filename(original_name) or "file"
    uid = uuid4().hex[:10]
    stored_name = f"{uid}_{safe_name}"
    dest = UPLOAD_DIR / stored_name
    file.save(dest)

    mimetype = file.mimetype or mimetypes.guess_type(original_name)[0] or "application/octet-stream"
    size = dest.stat().st_size

    item = {
        "id": uid,
        "stored_name": stored_name,
        "original_name": original_name,
        "mimetype": mimetype,
        "category": category_for(mimetype),
        "size": size,
        "timestamp": datetime.now().isoformat(),
        "url": f"/uploads/{stored_name}",
    }

    items = load_items()
    items.append(item)
    save_items(items)

    socketio.emit("new_item", item)

    return jsonify(item), 201


@app.route("/api/delete-many", methods=["POST"])
def delete_many():
    data = request.get_json(silent=True) or {}
    ids = set(data.get("ids") or [])
    if not ids:
        return jsonify({"error": "No ids provided"}), 400

    items = load_items()
    remaining, removed_ids = [], []
    for it in items:
        if it["id"] in ids:
            removed_ids.append(it["id"])
            try:
                (UPLOAD_DIR / it["stored_name"]).unlink(missing_ok=True)
            except OSError:
                pass
        else:
            remaining.append(it)

    save_items(remaining)
    if removed_ids:
        socketio.emit("items_deleted", {"ids": removed_ids})
    return jsonify({"ok": True, "removed": removed_ids})


@app.route("/api/clear", methods=["POST"])
def clear_all():
    items = load_items()
    for it in items:
        try:
            (UPLOAD_DIR / it["stored_name"]).unlink(missing_ok=True)
        except OSError:
            pass
    save_items([])
    socketio.emit("items_cleared", {})
    return jsonify({"ok": True})


@app.route("/api/download-zip", methods=["POST"])
def download_zip():
    data = request.get_json(silent=True) or {}
    ids = data.get("ids") or []
    by_id = {it["id"]: it for it in load_items()}

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        used_names = set()
        for item_id in ids:
            it = by_id.get(item_id)
            if not it:
                continue
            path = UPLOAD_DIR / it["stored_name"]
            if not path.exists():
                continue
            name = it["original_name"]
            while name in used_names:
                name = f"_{name}"
            used_names.add(name)
            zf.write(path, arcname=name)
    buf.seek(0)

    return send_file(
        buf,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"beam_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
    )


if __name__ == "__main__":
    ip = get_lan_ip()
    print("=" * 56)
    print("  Beam is running")
    print(f"  Receiver (this computer):  http://localhost:{PORT}/receive")
    print(f"  Sender (your phone):       http://{ip}:{PORT}/send")
    print("  Press CTRL+C to stop.")
    print("=" * 56)
    socketio.run(app, host="0.0.0.0", port=PORT, debug=False, allow_unsafe_werkzeug=True)
