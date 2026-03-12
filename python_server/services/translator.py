"""
Translator service.
Mirrors server/src/services/translator.ts
"""
import json
from services.openai_client import get_openai


class Translator:
    def __init__(self):
        self._cache: dict[str, str] = {}

    async def translate_fields(
        self,
        fields: list[dict],
        target_language: str,
        field_ids: list[str] | None = None,
    ) -> dict[str, str]:
        fields_to_translate = (
            [f for f in fields if f["id"] in field_ids] if field_ids else fields
        )
        translations: dict[str, str] = {}

        texts = [{"id": f["id"], "text": f"{f['label']}: {f.get('value') or '(비어있음)'}"} for f in fields_to_translate]

        uncached = []
        for t in texts:
            cache_key = f"{t['text']}:{target_language}"
            if cache_key in self._cache:
                translations[t["id"]] = self._cache[cache_key]
            else:
                uncached.append(t)

        if not uncached:
            return translations

        batch_text = "\n".join(f"[{i}] {t['text']}" for i, t in enumerate(uncached))
        target_lang = "Korean" if target_language == "ko" else "English"

        response = await get_openai().chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": f'Translate the following document field labels and values to {target_lang}.\nKeep the same numbered format. Return JSON: {{ "translations": {{ "0": "translated text", "1": "..." }} }}',
                },
                {"role": "user", "content": batch_text},
            ],
        )

        content = response.choices[0].message.content or ""
        result = json.loads(content)
        for i, t in enumerate(uncached):
            translated = result.get("translations", {}).get(str(i), t["text"])
            translations[t["id"]] = translated
            self._cache[f"{t['text']}:{target_language}"] = translated

        return translations

    async def translate_text(self, text: str, target_language: str) -> str:
        cache_key = f"{text}:{target_language}"
        if cache_key in self._cache:
            return self._cache[cache_key]
        target_lang = "Korean" if target_language == "ko" else "English"
        response = await get_openai().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": f"Translate to {target_lang}. Return only the translation."},
                {"role": "user", "content": text},
            ],
        )
        result = response.choices[0].message.content or text
        self._cache[cache_key] = result
        return result
