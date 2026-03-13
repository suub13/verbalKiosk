/** Civil service category */
export interface CivilServiceCategory {
    id: string;
    name: string;
    nameEn: string;
    description: string;
    services: CivilService[];
}

/** Individual civil service */
export interface CivilService {
    id: string;
    categoryId: string;
    name: string;
    nameEn: string;
    description: string;
    requirements: string[];
    requiredDocuments: string[];
    fee: number;
    processingDays: number;
    formFields: FormFieldDefinition[];
}

/** Form field definition */
export interface FormFieldDefinition {
    id: string;
    label: string;
    labelEn: string;
    type: 'text' | 'number' | 'date' | 'address' | 'phone' | 'select' | 'checkbox';
    required: boolean;
    placeholder?: string;
    options?: { value: string; label: string; }[];
    validation?: string;
}

/** Form data being filled by voice */
export interface FormData {
    serviceId: string;
    fields: Record<string, string>;
    completedFields: string[];
    currentFieldId?: string;
    status: 'in_progress' | 'review' | 'submitted';
}

/** Function call schemas for Realtime API */
export const CIVIL_SERVICE_TOOLS = [
    {
        type: 'function',
        name: 'search_services',
        description: '발급 가능한 서류를 검색합니다. Search for documents available for issuance.',
        parameters: {
            type: 'object',
            properties: {
                query: { type: 'string', description: '검색어 (한국어 또는 영어)' },
                category: { type: 'string', description: '카테고리 ID (선택)' },
            },
            required: ['query'],
        },
    },
    {
        type: 'function',
        name: 'get_service_details',
        description: '특정 발급 서류의 상세 정보를 조회합니다.',
        parameters: {
            type: 'object',
            properties: {
                serviceId: { type: 'string', description: '서비스 ID' },
            },
            required: ['serviceId'],
        },
    },
    {
        type: 'function',
        name: 'check_requirements',
        description: '서류 발급 요건 및 수수료를 확인합니다.',
        parameters: {
            type: 'object',
            properties: {
                serviceId: { type: 'string', description: '서비스 ID' },
            },
            required: ['serviceId'],
        },
    },
    {
        type: 'function',
        name: 'open_service_form',
        description: '서류 발급 양식을 화면에 표시합니다. 사용자에게 필요한 항목을 안내하기 전에 호출하세요. 화면에 폼이 나타나며, 이후 set_current_field와 fill_form_field로 항목을 하나씩 채워갑니다.',
        parameters: {
            type: 'object',
            properties: {
                serviceId: { type: 'string', description: '서비스 ID' },
                serviceName: { type: 'string', description: '서비스 표시 이름 (예: "주민등록등본")' },
                fields: {
                    type: 'array',
                    description: '양식 필드 목록',
                    items: {
                        type: 'object',
                        properties: {
                            id: { type: 'string', description: '필드 ID' },
                            label: { type: 'string', description: '필드 레이블 (한국어)' },
                            type: { type: 'string', description: '필드 타입 (text, select, number, date 등)' },
                            required: { type: 'boolean', description: '필수 여부' },
                            options: {
                                type: 'array',
                                description: '선택지 목록 (select 타입인 경우)',
                                items: {
                                    type: 'object',
                                    properties: {
                                        value: { type: 'string' },
                                        label: { type: 'string' },
                                    },
                                },
                            },
                        },
                        required: ['id', 'label', 'required'],
                    },
                },
            },
            required: ['serviceId', 'serviceName', 'fields'],
        },
    },
    {
        type: 'function',
        name: 'set_current_field',
        description: '현재 질문 중인 양식 필드를 화면에서 강조 표시합니다. 각 항목을 물어보기 직전에 호출하세요.',
        parameters: {
            type: 'object',
            properties: {
                fieldId: { type: 'string', description: '강조할 필드 ID' },
            },
            required: ['fieldId'],
        },
    },
    {
        type: 'function',
        name: 'fill_form_field',
        description: '양식의 특정 필드에 값을 입력합니다. 사용자의 답변을 받은 후 호출하세요.',
        parameters: {
            type: 'object',
            properties: {
                serviceId: { type: 'string', description: '서비스 ID' },
                fieldId: { type: 'string', description: '필드 ID' },
                value: { type: 'string', description: '입력 값' },
            },
            required: ['serviceId', 'fieldId', 'value'],
        },
    },
    {
        type: 'function',
        name: 'submit_form',
        description: '작성된 양식을 제출합니다.',
        parameters: {
            type: 'object',
            properties: {
                serviceId: { type: 'string', description: '서비스 ID' },
            },
            required: ['serviceId'],
        },
    },
    {
        type: 'function',
        name: 'navigate_step',
        description: '화면의 진행 단계를 전환합니다. 새로운 단계에 대해 말하기 전에 반드시 먼저 호출하세요. 특히 사용자가 이전 단계로 돌아가려 할 때 반드시 호출하세요.',
        parameters: {
            type: 'object',
            properties: {
                step: {
                    type: 'string',
                    enum: ['address', 'type', 'options', 'verify', 'issue'],
                    description: '이동할 단계: address(주소입력), type(발급형태), options(발급옵션), verify(본인확인), issue(발급)',
                },
            },
            required: ['step'],
        },
    },
    {
        type: 'function',
        name: 'set_address',
        description: '주민등록등본 발급을 위한 주민등록상 주소를 설정합니다. 시/도를 먼저 들으면 sido만으로 호출하고, 시/군/구까지 들으면 둘 다 포함하여 다시 호출하세요. 두 값이 모두 설정되면 다음 단계로 넘어갑니다.',
        parameters: {
            type: 'object',
            properties: {
                sido: { type: 'string', description: '시/도 (예: "서울특별시", "경기도")' },
                sigungu: { type: 'string', description: '시/군/구 (예: "강남구", "수원시 팔달구"). 아직 모르면 생략 가능.' },
            },
            required: ['sido'],
        },
    },
    {
        type: 'function',
        name: 'set_issuance_type',
        description: '주민등록등본 발급형태를 설정합니다. 사용자에게 기본발급과 선택발급 중 선택하도록 안내한 후 호출하세요. 기본발급은 과거 주소 변동사항을 제외한 모든 정보가 표시됩니다. 선택발급은 사용자가 표시할 항목을 직접 선택합니다.',
        parameters: {
            type: 'object',
            properties: {
                type: { type: 'string', enum: ['basic', 'custom'], description: '발급형태: basic(기본발급) 또는 custom(선택발급)' },
            },
            required: ['type'],
        },
    },
    // ── [추가] set_issuance_options: 선택발급 옵션을 음성으로 수집하여 화면에 반영 ──
    // 사용자가 음성으로 말한 각 항목의 포함 여부를 받아 화면(OptionsDetail UI)에 즉시 반영합니다.
    // finalize=true이면 옵션을 확정하고 본인확인 단계로 자동 진행합니다.
    {
        type: 'function',
        name: 'set_issuance_options',
        description: '선택발급의 발급 옵션을 음성으로 수집하여 화면에 실시간 반영합니다. 각 항목을 사용자에게 묻고 답변을 받을 때마다 호출하여 화면을 업데이트하세요. finalize=true이면 모든 옵션을 확정하고 본인확인 단계로 진행합니다.',
        parameters: {
            type: 'object',
            properties: {
                addressHistoryMode: {
                    type: 'string',
                    enum: ['all', 'custom'],
                    description: '과거 주소 변동사항 포함 방식: all(전체 포함) 또는 custom(직접 기간 지정)',
                },
                addressHistoryYears: {
                    type: 'number',
                    description: '과거 주소 포함 기간 (년). addressHistoryMode=custom일 때 사용. 0이면 주소 변동사항 미포함.',
                },
                issuanceOptions: {
                    type: 'object',
                    description: '각 항목의 포함 여부. 명시하지 않은 항목은 기존 상태 유지.',
                    properties: {
                        compositionReason:  { type: 'boolean', description: '세대 구성 사유' },
                        compositionDate:    { type: 'boolean', description: '세대 구성 일자' },
                        changeReason:       { type: 'boolean', description: '변동 사유' },
                        headRelation:       { type: 'boolean', description: '세대주와의 관계' },
                        cohabitant:         { type: 'boolean', description: '동거인' },
                        memberChangeReason: { type: 'boolean', description: '구성원 변동사유' },
                        occurrenceDate:     { type: 'boolean', description: '발생일/신고일' },
                        otherMemberNames:   { type: 'boolean', description: '교부대상자 외 세대원 등의 이름' },
                        residentIdSelf:     { type: 'boolean', description: '주민등록번호 뒷자리 - 본인' },
                        residentIdFamily:   { type: 'boolean', description: '주민등록번호 뒷자리 - 세대원' },
                    },
                },
                finalize: {
                    type: 'boolean',
                    description: 'true이면 현재 옵션을 확정하고 본인확인 단계로 이동합니다. 모든 항목 수집 후 사용자 최종 확인을 받았을 때만 true로 설정하세요.',
                },
            },
        },
    },
    {
        type: 'function',
        name: 'issue_document',
        description: '서류를 최종 발급합니다. 모든 절차가 완료된 후 호출하세요.',
        parameters: {
            type: 'object',
            properties: {
                serviceId: { type: 'string', description: '서비스 ID' },
            },
            required: ['serviceId'],
        },
    },
    {
        type: 'function',
        name: 'request_identity_verification',
        description: '서류 발급 전 본인확인 절차를 시작합니다. 개인정보 수집 동의 안내문과 절차를 반환합니다. 반환된 안내문을 사용자에게 읽어주고 동의 여부를 물어야 합니다.',
        parameters: {
            type: 'object',
            properties: {
                reason: { type: 'string', description: '본인확인이 필요한 사유 (예: "주민등록등본 발급")' },
            },
            required: ['reason'],
        },
    },
    {
        type: 'function',
        name: 'submit_identity_verification',
        description: '사용자가 음성으로 답변한 개인정보 동의 여부와 전화번호를 제출합니다. 동의를 받고 전화번호를 들은 후에 호출하세요.',
        parameters: {
            type: 'object',
            properties: {
                consent: { type: 'boolean', description: '개인정보 수집 동의 여부' },
                phoneNumber: { type: 'string', description: '사용자 휴대전화번호 (예: 010-1234-5678)' },
            },
            required: ['consent', 'phoneNumber'],
        },
    },
    {
        type: 'function',
        name: 'reset_workflow',
        description: '현재 진행 중인 발급 절차를 초기화하고 오른쪽 안내 패널을 닫습니다. 사용자가 발급 불가능한 서류를 요청하거나, 진행 중인 절차를 취소하거나, 다른 서류로 변경하려 할 때 호출하세요.',
        parameters: {
            type: 'object',
            properties: {
                reason: { type: 'string', description: '초기화 사유 (예: "발급 불가능한 서류 요청", "사용자 취소", "서류 변경")' },
            },
            required: ['reason'],
        },
    },
];
//# sourceMappingURL=civilService.js.map