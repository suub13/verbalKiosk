"""
DocumentProcessor — PDF parsing + OCR + GPT-4o structure analysis.
Mirrors server/src/services/documentProcessor.ts
"""
import json
import os
import uuid
import struct
import asyncio
from pathlib import Path
from services.openai_client import get_openai


class DocumentProcessor:
    def __init__(self):
        self.upload_dir = Path("uploads")

    async def ensure_upload_dir(self):
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def process_document(self, file_path: str, file_name: str) -> dict:
        # Step 1: Extract text from PDF
        pdf_pages = await self._extract_pdf_text(file_path)

        # Step 2: If text too short, use OCR
        total_text = "\n".join(p["text"] for p in pdf_pages)
        ocr_confidence = 1.0

        pages = pdf_pages
        if len(total_text.strip()) < 50:
            ocr_result = await self._perform_ocr(file_path)
            pages = ocr_result["pages"]
            ocr_confidence = ocr_result["confidence"]

        # Step 3: Analyze with GPT-4o
        return await self._analyze_structure(pages, file_name, ocr_confidence)

    async def _extract_pdf_text(self, file_path: str) -> list[dict]:
        try:
            import pdfplumber
            pages = []
            with pdfplumber.open(file_path) as pdf:
                for i, page in enumerate(pdf.pages, 1):
                    text = page.extract_text() or ""
                    pages.append({
                        "pageNumber": i,
                        "text": text,
                        "width": page.width or 0,
                        "height": page.height or 0,
                    })
            return pages
        except Exception:
            return [{"pageNumber": 1, "text": "", "width": 0, "height": 0}]

    async def _perform_ocr(self, file_path: str) -> dict:
        try:
            import pytesseract
            from PIL import Image
            img = Image.open(file_path)
            text = pytesseract.image_to_string(img, lang="kor+eng")
            return {
                "pages": [{"pageNumber": 1, "text": text, "width": 0, "height": 0}],
                "confidence": 0.8,
            }
        except Exception:
            return {
                "pages": [{"pageNumber": 1, "text": "", "width": 0, "height": 0}],
                "confidence": 0.0,
            }

    async def _analyze_structure(self, pages: list[dict], file_name: str, ocr_confidence: float) -> dict:
        full_text = "\n\n".join(f"[Page {p['pageNumber']}]\n{p['text']}" for p in pages)

        response = await get_openai().chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": """You are a document structure analyzer for documents (e.g., certificates, IDs, bank statements).
Analyze the structure and return JSON:
{
  "title": "document title",
  "documentType": "type of document (e.g., 토지대장, 주민등록등본, etc.)",
  "issuingAgency": "issuing agency if found",
  "dateIssued": "date if found (YYYY-MM-DD)",
  "language": "ko or en",
  "sections": [
    {
      "id": "section-1",
      "type": "header|table|paragraph|list|form_field|signature",
      "pageNumber": 1,
      "content": "section text content"
    }
  ],
  "fields": [
    {
      "id": "field-1",
      "label": "field label in Korean",
      "value": "field value if present",
      "type": "text|number|date|checkbox|address|name|phone",
      "pageNumber": 1,
      "required": true
    }
  ]
}""",
                },
                {
                    "role": "user",
                    "content": f"Analyze this document:\nFilename: {file_name}\n\n{full_text}",
                },
            ],
        )

        content = response.choices[0].message.content
        if not content:
            raise ValueError("Failed to analyze document structure")

        analysis = json.loads(content)
        doc_id = str(uuid.uuid4())

        sections = [
            {
                "id": s.get("id", f"section-{i+1}"),
                "type": s.get("type", "paragraph"),
                "pageNumber": s.get("pageNumber", 1),
                "content": s.get("content", ""),
            }
            for i, s in enumerate(analysis.get("sections", []))
        ]

        fields = [
            {
                "id": f.get("id", f"field-{i+1}"),
                "label": f.get("label", ""),
                "value": f.get("value", ""),
                "type": f.get("type", "text"),
                "pageNumber": f.get("pageNumber", 1),
                "required": f.get("required", True),
            }
            for i, f in enumerate(analysis.get("fields", []))
        ]

        return {
            "id": doc_id,
            "fileName": file_name,
            "pageCount": len(pages),
            "title": analysis.get("title", file_name),
            "sections": sections,
            "fields": fields,
            "metadata": {
                "language": analysis.get("language", "ko"),
                "documentType": analysis.get("documentType", "unknown"),
                "issuingAgency": analysis.get("issuingAgency"),
                "dateIssued": analysis.get("dateIssued"),
                "ocrConfidence": ocr_confidence,
            },
        }
