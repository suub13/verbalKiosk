"""
Document management routes.
POST /api/document/upload - Upload document
GET /api/document/{id} - Get parsed document structure
POST /api/document/{id}/translate - Translate document fields
POST /api/document/{id}/reading-script - Generate reading script
Mirrors server/src/routes/document.ts
"""
import os
import uuid
import aiofiles
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from services.document_processor import DocumentProcessor
from services.document_analyzer import DocumentAnalyzer
from services.translator import Translator
from utils.ttl_map import TtlMap

router = APIRouter()

processor = DocumentProcessor()
analyzer = DocumentAnalyzer()
translator = Translator()

# Document cache — 60 min TTL
document_cache: TtlMap[str, dict] = TtlMap(60 * 60 * 1000)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "NO_FILE", "message": "No file uploaded"},
        })

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "INVALID_FILE_TYPE", "message": "Only PDF and image files are allowed"},
        })

    await processor.ensure_upload_dir()

    # Save file
    temp_path = f"uploads/{uuid.uuid4()}{ext}"
    try:
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail={
                "success": False,
                "error": {"code": "FILE_TOO_LARGE", "message": "File exceeds 20MB limit"},
            })

        async with aiofiles.open(temp_path, "wb") as f:
            await f.write(contents)

        structure = await processor.process_document(temp_path, file.filename)
        document_cache.set(structure["id"], structure)

        return {
            "success": True,
            "data": {
                "documentId": structure["id"],
                "fileName": structure["fileName"],
                "pageCount": structure["pageCount"],
                "structure": structure,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "success": False,
            "error": {"code": "UPLOAD_FAILED", "message": str(e)},
        })
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass


@router.get("/{doc_id}")
async def get_document(doc_id: str):
    doc = document_cache.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail={
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Document not found"},
        })
    return {"success": True, "data": doc}


class TranslateRequest(BaseModel):
    targetLanguage: str
    fieldIds: list[str] | None = None


@router.post("/{doc_id}/translate")
async def translate_document(doc_id: str, body: TranslateRequest):
    doc = document_cache.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail={
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Document not found"},
        })

    if not body.targetLanguage:
        raise HTTPException(status_code=400, detail={
            "success": False,
            "error": {"code": "INVALID_REQUEST", "message": "targetLanguage is required"},
        })

    try:
        translations = await translator.translate_fields(
            doc["fields"], body.targetLanguage, body.fieldIds
        )
        return {"success": True, "data": {"translations": translations}}
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "success": False,
            "error": {"code": "TRANSLATE_FAILED", "message": str(e)},
        })


class ReadingScriptRequest(BaseModel):
    mode: str = "full"
    language: str = "ko"


@router.post("/{doc_id}/reading-script")
async def reading_script(doc_id: str, body: ReadingScriptRequest):
    doc = document_cache.get(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail={
            "success": False,
            "error": {"code": "NOT_FOUND", "message": "Document not found"},
        })
    try:
        script = await analyzer.generate_reading_script(doc, body.mode, body.language)
        return {"success": True, "data": script}
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "success": False,
            "error": {"code": "SCRIPT_FAILED", "message": str(e)},
        })
