import socket
from datetime import datetime, timezone

from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def index():
    return {
        "app": "python-fastapi",
        "message": "Hello from FastAPI on the BaaS platform",
        "hostname": socket.gethostname(),
        "time": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health")
def health():
    return {"status": "ok"}
