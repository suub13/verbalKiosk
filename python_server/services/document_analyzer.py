"""
DocumentAnalyzer — GPT-4o based document structure analysis.
Mirrors server/src/services/documentAnalyzer.ts
"""
import json
from services.openai_client import get_openai


class DocumentAnalyzer:
    async def generate_reading_script(self, document: dict, mode: str, language: str) -> dict:
        field_descriptions = "\n".join(
            f"- {f['label']}: {f.get('value') or '(비어있음)'}" for f in document.get("fields", [])
        )
        prompt = self._get_reading_prompt(mode, language)

        response = await get_openai().chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": f"Document: {document.get('title')}\nType: {document.get('metadata', {}).get('documentType')}\n\nFields:\n{field_descriptions}",
                },
            ],
        )

        content = response.choices[0].message.content
        if not content:
            raise ValueError("Failed to generate reading script")

        result = json.loads(content)
        return {
            "mode": mode,
            "segments": [
                {"fieldId": s.get("fieldId", ""), "text": s.get("text", ""), "priority": s.get("priority", "medium")}
                for s in result.get("segments", [])
            ],
        }

    async def identify_key_fields(self, document: dict) -> list[str]:
        response = await get_openai().chat.completions.create(
            model="gpt-4o",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": 'You are analyzing a document. Identify the most important fields. Return JSON: { "keyFieldIds": ["field-1", ...] }',
                },
                {
                    "role": "user",
                    "content": json.dumps({
                        "title": document.get("title"),
                        "type": document.get("metadata", {}).get("documentType"),
                        "fields": [{"id": f["id"], "label": f["label"], "value": f.get("value")} for f in document.get("fields", [])],
                    }),
                },
            ],
        )
        content = response.choices[0].message.content
        if not content:
            return [f["id"] for f in document.get("fields", [])]
        result = json.loads(content)
        return result.get("keyFieldIds", [])

    async def explain_field(self, document: dict, field: dict, language: str) -> str:
        system = (
            "문서의 필드를 고객이 이해하기 쉽게 설명해주세요. 2-3문장으로 간결하게."
            if language == "ko"
            else "Explain this field from a document in simple terms. 2-3 sentences."
        )
        response = await get_openai().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": f"Document: {document.get('title')}\nField: {field.get('label')}\nValue: {field.get('value') or '(empty)'}"},
            ],
        )
        return response.choices[0].message.content or ""

    def _get_reading_prompt(self, mode: str, language: str) -> str:
        lang = "Korean" if language == "ko" else "English"
        instructions = {
            "full": f"Read ALL fields in order. Generate natural {lang} speech text for each field.",
            "highlights": f"Read only the MOST IMPORTANT fields (name, dates, key values). Generate natural {lang} speech text.",
            "field_select": f"Prepare individual field readings. Each segment should be self-contained and natural in {lang}.",
        }
        return f"""You are generating a voice reading script for a document.
Mode: {mode}
{instructions.get(mode, instructions['full'])}

Return JSON:
{{
  "segments": [
    {{ "fieldId": "field-id", "text": "natural speech text to read aloud", "priority": "high|medium|low" }}
  ]
}}"""
