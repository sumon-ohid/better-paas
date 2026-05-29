import os
import socket
from datetime import datetime, timezone

from flask import Flask, jsonify

app = Flask(__name__)


@app.get("/")
def index():
    return jsonify(
        app="python-flask",
        message="Hello from Flask on the BaaS platform",
        hostname=socket.gethostname(),
        time=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/health")
def health():
    return jsonify(status="ok"), 200


if __name__ == "__main__":
    # The platform injects PORT; bind to it on all interfaces (0.0.0.0).
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port)
