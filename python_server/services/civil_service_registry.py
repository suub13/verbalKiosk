"""
CivilServiceRegistry — handles civil service data and function call execution.
Mirrors server/src/services/civilServiceRegistry.ts
"""
from typing import Any
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from utils.ttl_map import TtlMap

# ── Seed data ─────────────────────────────────────────────────────────────
CATEGORIES = [
    {
        "id": "resident",
        "name": "주민등록",
        "nameEn": "Resident Registration",
        "services": [
            {
                "id": "resident-copy",
                "categoryId": "resident",
                "name": "주민등록등본",
                "nameEn": "Resident Registration Certificate",
                "description": "주민등록등본을 발급받을 수 있습니다.",
                "requirements": ["본인 신분증"],
                "requiredDocuments": ["신분증 (주민등록증, 운전면허증, 여권 중 택1)"],
                "fee": 0,
                "processingDays": 0,
                "formFields": [
                    {"id": "name", "label": "신청인 성명", "labelEn": "Applicant Name", "type": "text", "required": True},
                    {"id": "residentId", "label": "주민등록번호", "labelEn": "Resident ID Number", "type": "text", "required": True},
                    {"id": "address", "label": "주소", "labelEn": "Address", "type": "address", "required": True},
                    {"id": "purpose", "label": "사용 목적", "labelEn": "Purpose", "type": "select", "required": True,
                     "options": [
                         {"value": "general", "label": "일반 행정"},
                         {"value": "finance", "label": "금융기관 제출"},
                         {"value": "real_estate", "label": "부동산 거래"},
                         {"value": "other", "label": "기타"},
                     ]},
                    {"id": "copies", "label": "발급 부수", "labelEn": "Number of Copies", "type": "number", "required": True, "placeholder": "1"},
                ],
            }
        ],
    },
    {
        "id": "insurance",
        "name": "건강보험",
        "nameEn": "Health Insurance",
        "services": [
            {
                "id": "insurance-qualification",
                "categoryId": "insurance",
                "name": "건강보험 자격득실 확인서",
                "nameEn": "Health Insurance Qualification Certificate",
                "description": "건강보험 자격득실 확인서를 발급받을 수 있습니다.",
                "requirements": ["본인 신분증"],
                "requiredDocuments": ["신분증 (주민등록증, 운전면허증, 여권 중 택1)"],
                "fee": 0,
                "processingDays": 0,
                "formFields": [
                    {"id": "name", "label": "신청인 성명", "labelEn": "Applicant Name", "type": "text", "required": True},
                    {"id": "residentId", "label": "주민등록번호", "labelEn": "Resident ID Number", "type": "text", "required": True},
                    {"id": "purpose", "label": "사용 목적", "labelEn": "Purpose", "type": "select", "required": True,
                     "options": [
                         {"value": "employment", "label": "취업용"},
                         {"value": "loan", "label": "대출용"},
                         {"value": "general", "label": "일반 제출용"},
                         {"value": "other", "label": "기타"},
                     ]},
                    {"id": "copies", "label": "발급 부수", "labelEn": "Number of Copies", "type": "number", "required": True, "placeholder": "1"},
                ],
            }
        ],
    },
    {
        "id": "tax",
        "name": "세금/납세",
        "nameEn": "Tax",
        "services": [
            {
                "id": "tax-certificate",
                "categoryId": "tax",
                "name": "납세증명서",
                "nameEn": "Tax Payment Certificate",
                "description": "납세증명서를 발급받을 수 있습니다.",
                "requirements": ["본인 신분증"],
                "requiredDocuments": ["신분증 (주민등록증, 운전면허증, 여권 중 택1)"],
                "fee": 0,
                "processingDays": 0,
                "formFields": [
                    {"id": "name", "label": "신청인 성명", "labelEn": "Applicant Name", "type": "text", "required": True},
                    {"id": "residentId", "label": "주민등록번호", "labelEn": "Resident ID Number", "type": "text", "required": True},
                    {"id": "businessNumber", "label": "사업자등록번호", "labelEn": "Business Registration Number", "type": "text", "required": False, "placeholder": "개인은 생략 가능"},
                    {"id": "purpose", "label": "사용 목적", "labelEn": "Purpose", "type": "select", "required": True,
                     "options": [
                         {"value": "bid", "label": "입찰·계약용"},
                         {"value": "loan", "label": "대출·금융용"},
                         {"value": "general", "label": "관공서 제출용"},
                         {"value": "other", "label": "기타"},
                     ]},
                    {"id": "copies", "label": "발급 부수", "labelEn": "Number of Copies", "type": "number", "required": True, "placeholder": "1"},
                ],
            }
        ],
    },
]

ALL_SERVICES = [svc for cat in CATEGORIES for svc in cat["services"]]

# In-memory form store — 30 min TTL
form_store: TtlMap[str, dict] = TtlMap(30 * 60 * 1000)


class CivilServiceRegistry:
    async def execute_function(self, name: str, args: dict) -> Any:
        match name:
            case "search_services":
                return self._search_services(args.get("query", ""), args.get("category"))
            case "get_service_details":
                return self._get_service_details(args.get("serviceId", ""))
            case "check_requirements":
                return self._check_requirements(args.get("serviceId", ""))
            case "fill_form_field":
                return self._fill_form_field(args.get("serviceId", ""), args.get("fieldId", ""), args.get("value", ""))
            case "submit_form":
                return self._submit_form(args.get("serviceId", ""))
            case _:
                return {"error": f"Unknown function: {name}"}

    def _search_services(self, query: str, category_id: str | None = None) -> dict:
        q = query.lower()
        results = ALL_SERVICES
        if category_id:
            results = [s for s in results if s["categoryId"] == category_id]
        results = [
            s for s in results
            if q in s["name"].lower() or q in s["nameEn"].lower()
            or q in s["description"].lower() or q in s["categoryId"].lower()
        ]
        return {
            "results": [
                {"id": s["id"], "name": s["name"], "nameEn": s["nameEn"],
                 "description": s["description"], "fee": s["fee"],
                 "processingDays": s["processingDays"]}
                for s in results
            ],
            "totalCount": len(results),
        }

    def _get_service_details(self, service_id: str) -> dict:
        svc = next((s for s in ALL_SERVICES if s["id"] == service_id), None)
        if not svc:
            return {"error": "서비스를 찾을 수 없습니다."}
        return svc

    def _check_requirements(self, service_id: str) -> dict:
        svc = next((s for s in ALL_SERVICES if s["id"] == service_id), None)
        if not svc:
            return {"error": "서비스를 찾을 수 없습니다."}
        return {
            "serviceId": service_id,
            "serviceName": svc["name"],
            "requirements": svc["requirements"],
            "requiredDocuments": svc["requiredDocuments"],
            "fee": svc["fee"],
            "processingDays": svc["processingDays"],
        }

    def _fill_form_field(self, service_id: str, field_id: str, value: str) -> dict:
        svc = next((s for s in ALL_SERVICES if s["id"] == service_id), None)
        if not svc:
            return {"error": "서비스를 찾을 수 없습니다."}
        field = next((f for f in svc["formFields"] if f["id"] == field_id), None)
        if not field:
            return {"error": "해당 필드를 찾을 수 없습니다."}

        form_data = form_store.get(service_id)
        if not form_data:
            form_data = {"serviceId": service_id, "fields": {}, "completedFields": [], "status": "in_progress"}
        form_data["fields"][field_id] = value
        if field_id not in form_data["completedFields"]:
            form_data["completedFields"].append(field_id)
        form_store.set(service_id, form_data)

        required_fields = [f for f in svc["formFields"] if f["required"]]
        completed_required = [f for f in required_fields if f["id"] in form_data["completedFields"]]
        next_field = next((f for f in required_fields if f["id"] not in form_data["completedFields"]), None)

        return {
            "success": True,
            "fieldId": field_id,
            "value": value,
            "progress": f"{len(completed_required)}/{len(required_fields)}",
            "nextField": {"id": next_field["id"], "label": next_field["label"]} if next_field else None,
            "isComplete": len(completed_required) == len(required_fields),
        }

    def _submit_form(self, service_id: str) -> dict:
        import time
        form_data = form_store.get(service_id)
        if not form_data:
            return {"error": "작성 중인 양식이 없습니다."}
        svc = next((s for s in ALL_SERVICES if s["id"] == service_id), None)
        if not svc:
            return {"error": "서비스를 찾을 수 없습니다."}

        missing = [
            f["label"] for f in svc["formFields"]
            if f["required"] and f["id"] not in form_data["completedFields"]
        ]
        if missing:
            return {"success": False, "error": "필수 항목이 누락되었습니다.", "missingFields": missing}

        form_data["status"] = "submitted"
        receipt = f"GOV-{int(time.time() * 1000):X}"
        return {
            "success": True,
            "message": "양식이 성공적으로 제출되었습니다.",
            "receiptNumber": receipt,
            "estimatedProcessingDays": svc["processingDays"],
        }
