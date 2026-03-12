"""
Server entry point — FastAPI + WebSocket setup.
Mirrors server/src/index.ts
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load env from config/settings.env (same as TS server)
_root = Path(__file__).parent
for candidate in [_root / "config" / "settings.env", _root.parent / "config" / "settings.env"]:
    if candidate.exists():
        load_dotenv(candidate)
        break
load_dotenv()  # fallback to .env

from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from routes.session import router as session_router
from routes.transcribe import router as transcribe_router
from routes.tts import router as tts_router
from routes.chat import router as chat_router
from routes.document import router as document_router
from routes.transcribe_phone import router as transcribe_phone_router
from routes.pino import router as pino_router
from websocket.realtime_proxy import (
    handle_realtime_ws,
    handle_options_confirmed_rest,
    handle_correction_rejected_rest,
)

app = FastAPI(title="Kiosk STTS Server (Python)")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cross-Origin Isolation headers (for SharedArrayBuffer / barge-in detection)
# NOTE: FastAPI StaticFiles bypasses http middleware, so if we used StaticFiles()
# the COOP/COEP headers would be MISSING on JS/CSS files → SharedArrayBuffer
# disabled → barge-in detection broken. We serve static files via explicit
# FileResponse routes instead so every response goes through this middleware.
@app.middleware("http")
async def add_cross_origin_isolation(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    return response

# REST Routes
app.include_router(session_router, prefix="/api/session")
app.include_router(transcribe_router, prefix="/api/transcribe")
app.include_router(tts_router, prefix="/api/tts")
app.include_router(chat_router, prefix="/api/chat")
app.include_router(document_router, prefix="/api/document")
app.include_router(transcribe_phone_router, prefix="/api/transcribe-phone")
app.include_router(pino_router, prefix="/api/pino")

@app.get("/api/health")
async def health():
    import time
    return {"status": "ok", "timestamp": int(time.time() * 1000)}

@app.post("/api/realtime/options-confirmed")
async def options_confirmed(request: Request):
    body = await request.json()
    result = body.get("result")
    if not result:
        return JSONResponse(status_code=400, content={"error": "result required"})
    found = handle_options_confirmed_rest(result)
    print(f"[Server] POST options-confirmed → {'delivered' if found else 'no session found'}")
    return {"success": found}

@app.post("/api/realtime/correction-rejected")
async def correction_rejected(request: Request):
    body = await request.json()
    step = body.get("step")
    session_id = body.get("sessionId")
    found = handle_correction_rejected_rest(step, session_id)
    print(f"[Server] POST correction-rejected (step: {step or 'unknown'}, session: {session_id or 'any'}) → {'delivered' if found else 'no session found'}")
    return {"success": found}

@app.websocket("/api/realtime")
async def realtime_ws(websocket: WebSocket):
    await handle_realtime_ws(websocket)

# Static files (production)
# We use explicit FileResponse routes (NOT StaticFiles mount) so that the
# COOP/COEP middleware above runs for every file including JS/CSS assets.
# This is required for SharedArrayBuffer to work (barge-in detection).
client_dist = os.environ.get("CLIENT_DIST_PATH")
if os.environ.get("NODE_ENV") == "production" and client_dist:
    from fastapi import HTTPException
    from fastapi.responses import FileResponse

    @app.get("/assets/{file_path:path}")
    async def serve_assets(file_path: str):
        full = os.path.join(client_dist, "assets", file_path)
        if not os.path.isfile(full):
            raise HTTPException(status_code=404)
        return FileResponse(full)

    @app.get("/locales/{file_path:path}")
    async def serve_locales(file_path: str):
        full = os.path.join(client_dist, "locales", file_path)
        if not os.path.isfile(full):
            raise HTTPException(status_code=404)
        return FileResponse(full)

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        candidate = os.path.join(client_dist, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(client_dist, "index.html"))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3001))
    print(f"[Server] Running on port {port}")
    print(f"[Server] REST API: http://localhost:{port}/api")
    print(f"[Server] WebSocket: ws://localhost:{port}/api/realtime")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
