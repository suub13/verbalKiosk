# Kiosk STTS — Python Server

TypeScript Express 서버를 **완전히 동일한 기능**으로 Python/FastAPI로 재작성한 버전입니다.

## 아키텍처 대응표

| TypeScript | Python |
|---|---|
| `server/src/index.ts` | `main.py` |
| `server/src/routes/session.ts` | `routes/session.py` |
| `server/src/routes/transcribe.ts` | `routes/transcribe.py` |
| `server/src/routes/tts.ts` | `routes/tts.py` |
| `server/src/routes/chat.ts` | `routes/chat.py` |
| `server/src/routes/document.ts` | `routes/document.py` |
| `server/src/routes/transcribePhone.ts` | `routes/transcribe_phone.py` |
| `server/src/websocket/realtimeProxy.ts` | `websocket/realtime_proxy.py` |
| `server/src/services/sessionStore.ts` | `services/session_store.py` |
| `server/src/services/openaiClient.ts` | `services/openai_client.py` |
| `server/src/services/civilServiceRegistry.ts` | `services/civil_service_registry.py` |
| `server/src/services/documentProcessor.ts` | `services/document_processor.py` |
| `server/src/services/documentAnalyzer.ts` | `services/document_analyzer.py` |
| `server/src/services/translator.ts` | `services/translator.py` |
| `server/src/services/definitions/registry.ts` | `services/definitions/registry.py` |
| `server/src/services/definitions/residentCopy.ts` | `services/definitions/resident_copy.py` |
| `server/src/services/definitions/healthInsurance.ts` | `services/definitions/health_insurance_and_tax.py` |
| `server/src/services/definitions/taxCertificate.ts` | `services/definitions/health_insurance_and_tax.py` |
| `server/src/config/prompts.ts` | `config/prompts.py` |
| `server/src/config/sigunguPrompt.ts` | `config/sigungu_prompt.py` |
| `server/src/utils/ttlMap.ts` | `utils/ttl_map.py` |
| `server/src/constants/timings.ts` | `constants/timings.py` |

## 설치 방법

```bash
cd python_server
pip install -r requirements.txt
```

## 실행 방법

```bash
# 환경변수 설정 (config/settings.env 또는 .env 파일)
echo "OPENAI_API_KEY=sk-..." > .env

# 서버 시작 (기본 포트: 3001)
python main.py

# 또는 uvicorn으로 직접
uvicorn main:app --host 0.0.0.0 --port 3001
```

## API 엔드포인트 (기존 TS 서버와 동일)

| Method | Path | 설명 |
|---|---|---|
| `GET` | `/api/health` | 헬스체크 |
| `POST` | `/api/session` | 세션 생성 |
| `DELETE` | `/api/session/{id}` | 세션 삭제 |
| `POST` | `/api/transcribe` | STT (PCM16 → 텍스트) |
| `POST` | `/api/tts` | TTS (텍스트 → PCM16) |
| `POST` | `/api/chat` | LLM 대화 + function calling |
| `POST` | `/api/document/upload` | 문서 업로드 + OCR/분석 |
| `GET` | `/api/document/{id}` | 문서 구조 조회 |
| `POST` | `/api/document/{id}/translate` | 문서 필드 번역 |
| `POST` | `/api/document/{id}/reading-script` | 음성 읽기 스크립트 생성 |
| `POST` | `/api/transcribe-phone` | 전화번호 전용 STT |
| `POST` | `/api/realtime/options-confirmed` | REST fallback |
| `POST` | `/api/realtime/correction-rejected` | REST fallback |
| `WS` | `/api/realtime` | OpenAI Realtime API 프록시 |

## UI 연결 방법

기존 `client/`를 그대로 사용하면 됩니다. Python 서버가 **동일한 포트(3001)와 동일한 API 경로**를 사용합니다.

```bash
# 프로덕션 (빌드된 클라이언트 서빙)
CLIENT_DIST_PATH=../client/dist python main.py

# 개발 (클라이언트는 Vite dev server로 별도 실행)
python main.py  # 포트 3001
cd ../client && npm run dev  # 포트 5173 (vite.config.ts에서 3001로 프록시)
```

## 환경변수

```env
OPENAI_API_KEY=sk-...
PORT=3001
SESSION_TIMEOUT_MS=600000
NODE_ENV=production   # production이면 CLIENT_DIST_PATH의 정적 파일 서빙
CLIENT_DIST_PATH=../client/dist
```

## 새 서비스 추가 방법

1. `services/definitions/new_service.py` 생성
2. `ServerServiceDefinition` 인스턴스 정의
3. `services/definitions/registry.py`에 `register_server_service_definition(...)` 한 줄 추가

기존 TypeScript와 **동일한 플러그인 구조**입니다.
