/**
 * KioskIdentityForm.tsx
 * ─────────────────────────────────────────────────────────────
 * 키오스크 본인인증 폼 — 완전 독립형 (Self-contained) 컴포넌트
 *
 * 변경 이력:
 * ✅ 입력창 너비 제한 (max-width 적용)
 * ✅ 하단 버튼 항상 화면 하단에 고정 (스크롤 밖으로 분리)
 * ✅ 주민번호 앞 6자리 입력 완료 시 뒷번호 칸으로 자동 이동
 * ✅ 휴대폰 입력 시 키패드 위로 스크롤 (입력창이 가리지 않도록)
 * ✅ 유효성 검사 강화 (이름: 한글/영문, 주민번호: 숫자, 전화번호: 숫자)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';

/* ════════════════════════════════════════════════════════════
   타입 & 상수
════════════════════════════════════════════════════════════ */
type FieldId = 'name' | 'rrn-front' | 'rrn-back' | 'phone';
type KbMode = 'korean' | 'number';

interface FormData {
  name: string;
  rrnFront: string;
  rrnBack: string;
  phone: string;
  carrier: string;
}

interface KioskIdentityFormProps {
  onComplete?: (data: FormData) => void;
  onCancel?: () => void;
}

const FIELD_ORDER: FieldId[] = ['name', 'rrn-front', 'rrn-back', 'phone'];

const CARRIERS = [
  { id: 'skt',      label: 'SKT',       color: '#E8102A' },
  { id: 'kt',       label: 'KT',        color: '#E94E1B' },
  { id: 'lgu',      label: 'LG U+',     color: '#A50034' },
  { id: 'mvno-skt', label: '알뜰(SKT)',  color: '#6B7280' },
  { id: 'mvno-kt',  label: '알뜰(KT)',   color: '#6B7280' },
  { id: 'mvno-lgu', label: '알뜰(LGU+)', color: '#6B7280' },
];

const SHIFT_MAP: Record<string, string> = {
  'ㄱ':'ㄲ','ㄷ':'ㄸ','ㅂ':'ㅃ','ㅅ':'ㅆ','ㅈ':'ㅉ','ㅐ':'ㅒ','ㅔ':'ㅖ',
};

const MAX_LEN: Record<FieldId, number | null> = {
  name: null, 'rrn-front': 6, 'rrn-back': 1, phone: 11,
};

const PLACEHOLDER: Record<FieldId, string> = {
  name: '이름을 입력해 주세요',
  'rrn-front': '앞 6자리',
  'rrn-back': '●',
  phone: '010-0000-0000',
};

/* 물리 키보드 두벌식 매핑 */
const KO_MAP: Record<string, string> = {
  q:'ㅂ',w:'ㅈ',e:'ㄷ',r:'ㄱ',t:'ㅅ',y:'ㅛ',u:'ㅕ',i:'ㅑ',o:'ㅐ',p:'ㅔ',
  a:'ㅁ',s:'ㄴ',d:'ㅇ',f:'ㄹ',g:'ㅎ',h:'ㅗ',j:'ㅓ',k:'ㅏ',l:'ㅣ',
  z:'ㅋ',x:'ㅌ',c:'ㅊ',v:'ㅍ',b:'ㅠ',n:'ㅜ',m:'ㅡ',
  Q:'ㅃ',W:'ㅉ',E:'ㄸ',R:'ㄲ',T:'ㅆ',O:'ㅒ',P:'ㅖ',
};

/* ════════════════════════════════════════════════════════════
   한글 두벌식 조합 엔진
════════════════════════════════════════════════════════════ */
const CHOSEONG  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNGSEONG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONGSEONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

const CHO_IDX:  Record<string,number> = Object.fromEntries(CHOSEONG.map((c,i)=>[c,i]));
const JUNG_IDX: Record<string,number> = Object.fromEntries(JUNGSEONG.map((c,i)=>[c,i]));
const JONG_IDX: Record<string,number> = {ㄱ:1,ㄲ:2,ㄳ:3,ㄴ:4,ㄵ:5,ㄶ:6,ㄷ:7,ㄹ:8,ㄺ:9,ㄻ:10,ㄼ:11,ㄽ:12,ㄾ:13,ㄿ:14,ㅀ:15,ㅁ:16,ㅂ:17,ㅄ:18,ㅅ:19,ㅆ:20,ㅇ:21,ㅈ:22,ㅊ:23,ㅋ:24,ㅌ:25,ㅍ:26,ㅎ:27};

const JONG_SPLIT:   Record<number,string[]> = {3:['ㄱ','ㅅ'],5:['ㄴ','ㅈ'],6:['ㄴ','ㅎ'],9:['ㄹ','ㄱ'],10:['ㄹ','ㅁ'],11:['ㄹ','ㅂ'],12:['ㄹ','ㅅ'],13:['ㄹ','ㅌ'],14:['ㄹ','ㅍ'],15:['ㄹ','ㅎ'],18:['ㅂ','ㅅ']};
const JONG_COMBINE: Record<string,number> = {'ㄱㅅ':3,'ㄴㅈ':5,'ㄴㅎ':6,'ㄹㄱ':9,'ㄹㅁ':10,'ㄹㅂ':11,'ㄹㅅ':12,'ㄹㅌ':13,'ㄹㅍ':14,'ㄹㅎ':15,'ㅂㅅ':18};
const JUNG_COMBINE: Record<string,string> = {'ㅗㅏ':'ㅘ','ㅗㅐ':'ㅙ','ㅗㅣ':'ㅚ','ㅜㅓ':'ㅝ','ㅜㅔ':'ㅞ','ㅜㅣ':'ㅟ','ㅡㅣ':'ㅢ'};
const JUNG_SPLIT:   Record<string,string> = Object.fromEntries(Object.entries(JUNG_COMBINE).map(([k,v])=>[v,k]));

interface CSState { done: string; cho: number; jung: number; jong: number; }

function hCombine(cho:number, jung:number, jong:number){ return String.fromCharCode(0xAC00+cho*21*28+jung*28+jong); }
function hDecomp(ch:string){ const c=ch.charCodeAt(0)-0xAC00; if(c<0||c>11171)return null; return {cho:Math.floor(c/(21*28)),jung:Math.floor((c%(21*28))/28),jong:c%28}; }

function csVal(s:CSState){ if(s.cho<0)return s.done; if(s.jung<0)return s.done+CHOSEONG[s.cho]; return s.done+hCombine(s.cho,s.jung,s.jong); }

function csConsonant(s:CSState, j:string): CSState {
  const ns = {...s};
  const cho=CHO_IDX[j], jong=JONG_IDX[j];
  if(ns.cho<0){
    if(cho!==undefined){ns.cho=cho;ns.jung=-1;ns.jong=0;}else ns.done+=j;
  } else if(ns.jung<0){
    ns.done+=CHOSEONG[ns.cho];
    if(cho!==undefined){ns.cho=cho;}else{ns.done+=j;ns.cho=-1;}
    ns.jung=-1;ns.jong=0;
  } else if(ns.jong===0){
    if(jong!==undefined){ns.jong=jong;}
    else{ns.done+=hCombine(ns.cho,ns.jung,0);if(cho!==undefined){ns.cho=cho;}else{ns.done+=j;ns.cho=-1;}ns.jung=-1;ns.jong=0;}
  } else {
    const comb=JONG_COMBINE[JONGSEONG[ns.jong]+j];
    if(comb!==undefined){ns.jong=comb;}
    else{
      const sp=JONG_SPLIT[ns.jong];
      if(sp){
        ns.done+=hCombine(ns.cho,ns.jung,JONG_IDX[sp[0]]||0);
        ns.cho=CHO_IDX[sp[1]]||11;ns.jung=-1;ns.jong=0;
        if(jong!==undefined){ns.jong=jong;}
        else if(cho!==undefined){ns.done+=CHOSEONG[ns.cho];ns.cho=cho;ns.jung=-1;ns.jong=0;}
        else{ns.done+=CHOSEONG[ns.cho]+j;ns.cho=-1;ns.jung=-1;ns.jong=0;}
      } else {
        ns.done+=hCombine(ns.cho,ns.jung,ns.jong);
        if(cho!==undefined){ns.cho=cho;}else{ns.done+=j;ns.cho=-1;}
        ns.jung=-1;ns.jong=0;
      }
    }
  }
  return ns;
}

function csVowel(s:CSState, j:string): CSState {
  const ns = {...s};
  const ji=JUNG_IDX[j]; if(ji===undefined)return ns;
  if(ns.cho<0){
    if(ns.done.length>0){const last=ns.done[ns.done.length-1];if(JUNG_IDX[last]!==undefined){const m=JUNG_COMBINE[last+j];if(m){ns.done=ns.done.slice(0,-1)+m;return ns;}}}
    ns.done+=j;
  } else if(ns.jung<0){
    ns.jung=ji;
  } else if(ns.jong===0){
    const cur=JUNGSEONG[ns.jung],m=JUNG_COMBINE[cur+j];
    if(m&&JUNG_IDX[m]!==undefined){ns.jung=JUNG_IDX[m];}
    else{ns.done+=hCombine(ns.cho,ns.jung,0);ns.cho=CHO_IDX['ㅇ'];ns.jung=ji;ns.jong=0;}
  } else {
    const sp=JONG_SPLIT[ns.jong]; let nj:number,nc:number;
    if(sp){nj=JONG_IDX[sp[0]]||0;nc=CHO_IDX[sp[1]]||11;}
    else{nj=0;nc=CHO_IDX[JONGSEONG[ns.jong]]||11;}
    ns.done+=hCombine(ns.cho,ns.jung,nj);ns.cho=nc;ns.jung=ji;ns.jong=0;
  }
  return ns;
}

function csBs(s:CSState): CSState {
  const ns = {...s};
  if(ns.jong>0){const sp=JONG_SPLIT[ns.jong];ns.jong=sp?(JONG_IDX[sp[0]]||0):0;}
  else if(ns.jung>=0){const sp=JUNG_SPLIT[JUNGSEONG[ns.jung]];if(sp){ns.jung=JUNG_IDX[sp[0]]!==undefined?JUNG_IDX[sp[0]]:-1;if(ns.jung<0)ns.jung=-1;}else ns.jung=-1;}
  else if(ns.cho>=0){ns.cho=-1;}
  else if(ns.done.length>0){const last=ns.done[ns.done.length-1];ns.done=ns.done.slice(0,-1);const d=hDecomp(last);if(d){ns.cho=d.cho;ns.jung=d.jung;ns.jong=d.jong;}}
  return ns;
}

function csReset(v:string): CSState { return {done:v,cho:-1,jung:-1,jong:0}; }

/* ════════════════════════════════════════════════════════════
   유효성 검사
════════════════════════════════════════════════════════════ */
/** 이름: 한글 또는 영문자 (숫자·특수문자 불가) */
function validateName(v: string): string | null {
  if (!v.trim()) return '이름을 입력해 주세요.';
  if (/\d/.test(v)) return '이름에 숫자를 입력할 수 없습니다.';
  if (!/^[가-힣a-zA-Z\s]+$/.test(v.trim())) return '이름은 한글 또는 영문만 입력 가능합니다.';
  return null;
}

/** 주민번호 앞 6자리: 숫자 6개, YYMMDD 형식 */
function validateRrnFront(v: string): string | null {
  if (v.length !== 6) return '주민번호 앞 6자리를 입력해 주세요.';
  if (!/^\d{6}$/.test(v)) return '숫자만 입력 가능합니다.';
  const month = parseInt(v.slice(2, 4), 10);
  const day   = parseInt(v.slice(4, 6), 10);
  if (month < 1 || month > 12) return '올바른 생년월일을 입력해 주세요. (월 오류)';
  if (day   < 1 || day   > 31) return '올바른 생년월일을 입력해 주세요. (일 오류)';
  return null;
}

/** 주민번호 뒷자리 첫 번호: 1~4 (성별·출생 연도 구분) */
function validateRrnBack(v: string): string | null {
  if (!v) return '주민번호 뒷자리를 입력해 주세요.';
  if (!/^[1-4]$/.test(v)) return '뒷자리는 1~4 사이의 숫자를 입력해 주세요.';
  return null;
}

/** 전화번호: 10~11 자리 숫자, 010/011/016/017/018/019 시작 */
function validatePhone(v: string): string | null {
  if (!v) return '휴대폰 번호를 입력해 주세요.';
  if (!/^\d+$/.test(v)) return '숫자만 입력 가능합니다.';
  if (v.length < 10 || v.length > 11) return '10~11자리 번호를 입력해 주세요.';
  if (!/^01[0-9]/.test(v)) return '올바른 휴대폰 번호를 입력해 주세요.';
  return null;
}

/* ════════════════════════════════════════════════════════════
   유틸리티
════════════════════════════════════════════════════════════ */
function fmtPhone(p:string){ if(!p)return ''; if(p.length<=3)return p; if(p.length<=7)return p.slice(0,3)+'-'+p.slice(3); return p.slice(0,3)+'-'+p.slice(3,7)+'-'+p.slice(7); }

function getFieldVal(form:FormData, f:FieldId): string {
  switch(f){ case 'name': return form.name; case 'rrn-front': return form.rrnFront; case 'rrn-back': return form.rrnBack; case 'phone': return form.phone; }
}

function setFieldVal(form:FormData, f:FieldId, v:string): FormData {
  const n = {...form};
  switch(f){
    case 'name':      n.name=v; break;
    case 'rrn-front': n.rrnFront=v.replace(/\D/g,'').slice(0,6); break;
    case 'rrn-back':  n.rrnBack=v.replace(/\D/g,'').slice(0,1); break;
    case 'phone':     n.phone=v.replace(/\D/g,'').slice(0,11); break;
  }
  return n;
}

function displayVal(form:FormData, f:FieldId, cs:CSState, currentField:FieldId|null, kbMode:KbMode): string {
  let val = (f === currentField && kbMode === 'korean') ? csVal(cs) : getFieldVal(form, f);
  if(f !== 'name') val = val.replace(/\D/g,'');
  return f === 'phone' ? fmtPhone(val) : val;
}

/* ════════════════════════════════════════════════════════════
   메인 컴포넌트
════════════════════════════════════════════════════════════ */
export const KioskIdentityForm: React.FC<KioskIdentityFormProps> = ({ onComplete, onCancel }) => {
  const [form, setForm] = useState<FormData>({ name:'', rrnFront:'', rrnBack:'', phone:'', carrier:'' });
  const [cs, setCs] = useState<CSState>(csReset(''));
  const [currentField, setCurrentField] = useState<FieldId | null>(null);
  const [kbMode, setKbMode] = useState<KbMode>('korean');
  const [isShifted, setIsShifted] = useState(false);
  const [kbVisible, setKbVisible] = useState(false);
  const [waitingCarrier, setWaitingCarrier] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const scrollRef  = useRef<HTMLDivElement>(null);
  const fieldRefs  = useRef<Record<string, HTMLDivElement|null>>({});
  const sliderRef  = useRef<HTMLDivElement>(null);

  /* ────────────────────────────────────────────────────────
     스크롤: 키보드 위로 해당 입력창이 보이도록
     phone 필드는 특별히 더 위쪽으로 올려서 전체 필드가 보이게
  ──────────────────────────────────────────────────────── */
  const scrollToField = useCallback((fieldId: string, extraMargin = 0) => {
    setTimeout(() => {
      const el     = fieldRefs.current[fieldId];
      const scroll = scrollRef.current;
      const slider = sliderRef.current;
      if (!el || !scroll) return;

      const kbH   = slider?.offsetHeight || 280;
      const sRect = scroll.getBoundingClientRect();
      const fRect = el.getBoundingClientRect();

      /* 키보드 위 가시 영역 */
      const vTop = sRect.top + 16;
      const vBot = sRect.bottom - kbH - 16 - extraMargin;
      const mid  = (vTop + vBot) / 2;

      if (fRect.top < vTop || fRect.bottom > vBot) {
        const delta = ((fRect.top + fRect.bottom) / 2) - mid;
        scroll.scrollBy({ top: delta, behavior: 'smooth' });
      }
    }, 100);
  }, []);

  /* ── 필드 포커스 ── */
  const focusField = useCallback((fieldId: FieldId) => {
    setForm(prev => {
      if (currentField && kbMode === 'korean') return setFieldVal(prev, currentField, csVal(cs));
      return prev;
    });

    const mode: KbMode = fieldId === 'name' ? 'korean' : 'number';
    setCurrentField(fieldId);
    setKbMode(mode);
    setIsShifted(false);
    setWaitingCarrier(false);
    setKbVisible(true);
    setErrors(prev => { const n={...prev}; delete n[fieldId]; return n; });
    setCs(csReset(getFieldVal(form, fieldId)));

    /* phone 필드는 키패드가 상당히 높으므로 여분 마진 추가 */
    scrollToField(fieldId, fieldId === 'phone' ? 80 : 0);
  }, [currentField, kbMode, cs, form, scrollToField]);

  /* ── 키보드 닫기 ── */
  const closeKeyboard = useCallback(() => {
    if (currentField && kbMode === 'korean') {
      const v = csVal(cs);
      setForm(prev => setFieldVal(prev, currentField, v));
      setCs(csReset(v));
    }
    setKbVisible(false);
    setCurrentField(null);
  }, [currentField, kbMode, cs]);

  /* ── 한글 문자 키 ── */
  const handleCharKey = useCallback((k: string) => {
    if (!currentField) return;
    const ml = MAX_LEN[currentField];
    if (ml && csVal(cs).length >= ml) return;

    const inputK = isShifted && SHIFT_MAP[k] ? SHIFT_MAP[k] : k;
    let newCs: CSState;
    if (JUNG_IDX[inputK] !== undefined) newCs = csVowel(cs, inputK);
    else newCs = csConsonant(cs, inputK);

    setCs(newCs);
    setForm(prev => setFieldVal(prev, currentField, csVal(newCs)));
    if (isShifted && SHIFT_MAP[k]) setIsShifted(false);
  }, [currentField, cs, isShifted]);

  /* ── 숫자 키 — 자동 이동 로직 포함 ── */
  const handleNumKey = useCallback((k: string) => {
    if (!currentField) return;
    const ml  = MAX_LEN[currentField];
    const cur = getFieldVal(form, currentField);
    if (ml && cur.length >= ml) return;

    const newVal = cur + k;
    setForm(prev => setFieldVal(prev, currentField, newVal));
    setCs(csReset(newVal.replace(/\D/g,'').slice(0, ml || 999)));

    /* 주민번호 앞 6자리 완성 → 뒷번호 칸으로 자동 이동 */
    if (currentField === 'rrn-front' && newVal.length >= 6) {
      setTimeout(() => focusField('rrn-back'), 80);
    }
  }, [currentField, form, focusField]);

  /* ── 백스페이스 ── */
  const handleBackspace = useCallback(() => {
    if (!currentField) return;
    if (kbMode === 'korean') {
      const newCs = csBs(cs);
      setCs(newCs);
      setForm(prev => setFieldVal(prev, currentField, csVal(newCs)));
    } else {
      const cur = getFieldVal(form, currentField);
      if (!cur) return;
      const newVal = cur.slice(0, -1);
      setForm(prev => setFieldVal(prev, currentField, newVal));
      setCs(csReset(newVal));
    }
  }, [currentField, kbMode, cs, form]);

  /* ── 정정(전체삭제) ── */
  const handleClear = useCallback(() => {
    if (!currentField) return;
    setForm(prev => setFieldVal(prev, currentField, ''));
    setCs(csReset(''));
  }, [currentField]);

  /* ── 완료 → 다음 필드 ── */
  const handleConfirm = useCallback(() => {
    if (!currentField) return;
    if (kbMode === 'korean') {
      const v = csVal(cs);
      setForm(prev => setFieldVal(prev, currentField, v));
      setCs(csReset(v));
    }

    if (currentField === 'rrn-back') {
      setKbVisible(false);
      setCurrentField(null);
      setWaitingCarrier(true);
      setTimeout(() => scrollToField('fg-carrier'), 100);
      return;
    }

    const idx = FIELD_ORDER.indexOf(currentField);
    if (idx >= 0 && idx < FIELD_ORDER.length - 1) {
      const next = FIELD_ORDER[idx + 1];
      if (next === 'phone' && !form.carrier) {
        setKbVisible(false);
        setCurrentField(null);
        setWaitingCarrier(true);
        setTimeout(() => scrollToField('fg-carrier'), 100);
        return;
      }
      setTimeout(() => focusField(next), 50);
    } else {
      closeKeyboard();
    }
  }, [currentField, kbMode, cs, form.carrier, focusField, closeKeyboard, scrollToField]);

  /* ── 통신사 선택 ── */
  const handleCarrierSelect = useCallback((id: string) => {
    if (currentField) {
      if (kbMode === 'korean') {
        const v = csVal(cs);
        setForm(prev => ({ ...setFieldVal(prev, currentField!, v), carrier: id }));
        setCs(csReset(v));
      } else {
        setForm(prev => ({ ...prev, carrier: id }));
      }
      setKbVisible(false);
      setCurrentField(null);
    } else {
      setForm(prev => ({ ...prev, carrier: id }));
    }
    setWaitingCarrier(false);
    setErrors(prev => { const n={...prev}; delete n['carrier']; return n; });
    setTimeout(() => focusField('phone'), 150);
  }, [currentField, kbMode, cs, focusField]);

  /* ── 제출 + 유효성 검사 ── */
  const handleSubmit = useCallback(() => {
    closeKeyboard();
    const errs: Record<string,string> = {};

    const nameErr = validateName(form.name);
    if (nameErr) errs['name'] = nameErr;

    const rrnFrontErr = validateRrnFront(form.rrnFront);
    if (rrnFrontErr) errs['rrn-front'] = rrnFrontErr;

    const rrnBackErr = validateRrnBack(form.rrnBack);
    if (rrnBackErr) errs['rrn-back'] = rrnBackErr;

    if (!form.carrier) errs['carrier'] = '통신사를 선택해 주세요.';

    const phoneErr = validatePhone(form.phone);
    if (phoneErr) errs['phone'] = phoneErr;

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    if (onComplete) { onComplete(form); return; }
    setShowSuccess(true);
  }, [form, closeKeyboard, onComplete]);

  /* ── 초기화 ── */
  const handleReset = useCallback(() => {
    closeKeyboard();
    setWaitingCarrier(false);
    setForm({ name:'', rrnFront:'', rrnBack:'', phone:'', carrier:'' });
    setCs(csReset(''));
    setErrors({});
  }, [closeKeyboard]);

  /* ── 물리 키보드 ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (waitingCarrier || !currentField) return;
      if (e.key === 'Backspace')            { e.preventDefault(); handleBackspace(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleConfirm(); return; }
      if (e.key === 'Escape')               { e.preventDefault(); closeKeyboard(); return; }
      if (kbMode === 'number') {
        if (/^[0-9]$/.test(e.key)) { e.preventDefault(); handleNumKey(e.key); }
        return;
      }
      if (kbMode === 'korean') {
        const mapped = KO_MAP[e.key];
        if (mapped) { e.preventDefault(); handleCharKey(mapped); return; }
        if (e.key === ' ') {
          e.preventDefault();
          const v = csVal(cs);
          const newCs: CSState = { done: v + ' ', cho: -1, jung: -1, jong: 0 };
          setCs(newCs);
          setForm(prev => setFieldVal(prev, currentField!, csVal(newCs)));
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [currentField, kbMode, waitingCarrier, cs, handleBackspace, handleConfirm, handleNumKey, handleCharKey, closeKeyboard]);

  /* ── 빈 영역 클릭 → 키보드 닫기 ── */
  const handleScrollAreaClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('[data-field]') && !target.closest('[data-carrier]') && !target.closest('[data-action]')) {
      closeKeyboard();
    }
  }, [closeKeyboard]);

  /* ════════════════════════════════════
     렌더링 헬퍼
  ════════════════════════════════════ */
  const disp      = (f: FieldId) => displayVal(form, f, cs, currentField, kbMode);
  const isFocused = (f: FieldId) => currentField === f;

  /* ── 입력 박스 스타일 조합 ── */
  const inputStyle = (f: FieldId, extra?: React.CSSProperties): React.CSSProperties => ({
    ...S.inputBox,
    ...(isFocused(f) ? S.inputBoxFocused : {}),
    ...(errors[f]    ? S.inputBoxError   : {}),
    ...extra,
  });

  /* ── 입력 박스 내부 컨텐츠 ── */
  const inputContent = (f: FieldId) => {
    const val = disp(f);
    return val
      ? <><span style={S.inputText}>{val}</span>{isFocused(f) && <span style={S.cursor}/>}</>
      : <><span style={S.inputPlaceholder}>{PLACEHOLDER[f]}</span>{isFocused(f) && <span style={S.cursor}/>}</>;
  };

  return (
    <div style={S.wrapper}>
      <style>{CSS_KEYFRAMES}</style>

      {/* ══════════════════════════════════════
          스크롤 영역 (하단 버튼 제외)
      ══════════════════════════════════════ */}
      <div ref={scrollRef} style={S.scrollArea} onMouseDown={handleScrollAreaClick}>

        {/* 타이틀 */}
        <div style={S.titleSection}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🔐</div>
          <h2 style={S.title}>본인인증</h2>
          <p style={S.subtitle}>서류 발급을 위해 본인 확인이 필요합니다.</p>
        </div>

        {/* ── 폼 카드 (너비 제한) ── */}
        <div style={S.formCard}>

          {/* ① 이름 */}
          <div style={S.fieldGroup} ref={el => { fieldRefs.current['name'] = el; }}>
            <div style={S.fieldLabel}>이름 <span style={S.req}>*</span></div>
            <div
              data-field="name"
              style={inputStyle('name')}
              onMouseDown={e => { e.preventDefault(); focusField('name'); }}
            >
              {inputContent('name')}
            </div>
            {errors['name'] && <div style={S.errorMsg}>{errors['name']}</div>}
          </div>

          {/* ② 주민번호 */}
          <div style={S.fieldGroup}>
            <div style={S.fieldLabel}>주민등록번호 <span style={S.req}>*</span></div>
            <div style={S.rrnRow}>
              {/* 앞 6자리 */}
              <div
                data-field="rrn-front"
                ref={el => { fieldRefs.current['rrn-front'] = el; }}
                style={inputStyle('rrn-front', { flex: 1 })}
                onMouseDown={e => { e.preventDefault(); focusField('rrn-front'); }}
              >
                {inputContent('rrn-front')}
              </div>
              <span style={S.rrnDivider}>-</span>
              {/* 뒷 첫자리 */}
              <div
                data-field="rrn-back"
                ref={el => { fieldRefs.current['rrn-back'] = el; }}
                style={inputStyle('rrn-back', { flex: '0 0 64px' })}
                onMouseDown={e => { e.preventDefault(); focusField('rrn-back'); }}
              >
                {inputContent('rrn-back')}
              </div>
              <span style={S.rrnMask}>●●●●●●</span>
            </div>
            {(errors['rrn-front'] || errors['rrn-back']) && (
              <div style={S.errorMsg}>{errors['rrn-front'] || errors['rrn-back']}</div>
            )}
          </div>

          {/* ③ 통신사 */}
          <div style={S.fieldGroup} ref={el => { fieldRefs.current['fg-carrier'] = el; }}>
            <div style={S.fieldLabel}>통신사 <span style={S.req}>*</span></div>
            <div style={S.carrierGrid}>
              {CARRIERS.map(c => (
                <button
                  key={c.id}
                  data-carrier={c.id}
                  style={{
                    ...S.carrierBtn,
                    ...(form.carrier === c.id
                      ? { background: `${c.color}15`, borderColor: c.color, color: c.color, fontWeight: 700 }
                      : {}),
                  }}
                  onMouseDown={e => { e.preventDefault(); handleCarrierSelect(c.id); }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {waitingCarrier && !form.carrier && (
              <div style={S.carrierHint}>👆 통신사를 선택해 주세요</div>
            )}
            {errors['carrier'] && <div style={S.errorMsg}>{errors['carrier']}</div>}
          </div>

          {/* ④ 휴대폰 (ref = 폰 필드 그룹 전체) */}
          <div style={S.fieldGroup} ref={el => { fieldRefs.current['phone'] = el; }}>
            <div style={S.fieldLabel}>휴대폰 번호 <span style={S.req}>*</span></div>
            <div
              data-field="phone"
              style={inputStyle('phone')}
              onMouseDown={e => { e.preventDefault(); focusField('phone'); }}
            >
              {inputContent('phone')}
            </div>
            {errors['phone'] && <div style={S.errorMsg}>{errors['phone']}</div>}
          </div>
        </div>

        {/* 키보드 올라올 때 여백 (phone 입력 중엔 더 크게) */}
        {kbVisible && (
          <div style={{ height: currentField === 'phone' ? 360 : 280 }} />
        )}
      </div>

      {/* ══════════════════════════════════════
          하단 버튼 — 스크롤 영역 밖(고정)
      ══════════════════════════════════════ */}
      <div style={S.bottomBtns} data-action="buttons">
        <button
          style={S.btnCancel}
          onMouseDown={e => { e.preventDefault(); onCancel ? onCancel() : handleReset(); }}
        >
          {onCancel ? '취소' : '초기화'}
        </button>
        <button
          style={S.btnSubmit}
          onMouseDown={e => { e.preventDefault(); handleSubmit(); }}
        >
          본인인증 완료
        </button>
      </div>

      {/* ── 키보드 슬라이더 ── */}
      <div
        ref={sliderRef}
        style={{ ...S.kbSlider, transform: kbVisible ? 'translateY(0)' : 'translateY(100%)' }}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
      >
        {kbMode === 'korean' ? (
          <KoreanKB
            isShifted={isShifted}
            onChar={handleCharKey}
            onBackspace={handleBackspace}
            onClear={handleClear}
            onConfirm={handleConfirm}
            onShift={() => setIsShifted(p => !p)}
          />
        ) : (
          <NumericKB
            onNum={handleNumKey}
            onBackspace={handleBackspace}
            onConfirm={handleConfirm}
          />
        )}
      </div>

      {/* ── 성공 모달 ── */}
      {showSuccess && (
        <div style={S.modalOverlay}>
          <div style={S.modalCard}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: '#16a34a', marginBottom: 6 }}>본인인증 완료</h3>
            <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6 }}>아래 정보로 인증이 완료되었습니다.</p>
            <div style={S.modalData}>
              <DataRow label="이름"   value={form.name} />
              <DataRow label="주민번호" value={`${form.rrnFront} - ${form.rrnBack}●●●●●●`} />
              <DataRow label="통신사"  value={form.carrier.toUpperCase()} />
              <DataRow label="휴대폰"  value={form.phone ? fmtPhone(form.phone) : '(미입력)'} />
            </div>
            <button style={S.modalClose} onMouseDown={e => { e.preventDefault(); setShowSuccess(false); handleReset(); }}>
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   한글 키보드
════════════════════════════════════════════════════════════ */
const KR_ROW1 = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅏ','ㅑ','ㅓ','ㅕ'];
const KR_ROW2 = ['ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅗ','ㅛ','ㅣ','ㅐ'];
const KR_ROW3 = ['ㅋ','ㅌ','ㅍ','ㅎ','ㅜ','ㅠ','ㅡ','ㅢ'];

interface KoreanKBProps {
  isShifted: boolean;
  onChar: (k: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onConfirm: () => void;
  onShift: () => void;
}

const KoreanKB: React.FC<KoreanKBProps> = React.memo(({ isShifted, onChar, onBackspace, onClear, onConfirm, onShift }) => {
  const kl = (ch: string) => (isShifted && SHIFT_MAP[ch]) ? SHIFT_MAP[ch] : ch;
  return (
    <div style={S.kbKoWrap}>
      <div style={S.kbRow}>
        {KR_ROW1.map(k => (
          <button key={k} style={S.kbKey} onMouseDown={e => { e.preventDefault(); onChar(k); }}>{kl(k)}</button>
        ))}
        <button style={{ ...S.kbKey, ...S.kbBackspace }} onMouseDown={e => { e.preventDefault(); onBackspace(); }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>
      <div style={S.kbRow}>
        {KR_ROW2.map(k => (
          <button key={k} style={S.kbKey} onMouseDown={e => { e.preventDefault(); onChar(k); }}>{kl(k)}</button>
        ))}
        <button style={{ ...S.kbKey, ...S.kbBlue }} onMouseDown={e => { e.preventDefault(); onClear(); }}>정정</button>
      </div>
      <div style={S.kbRow}>
        <button style={{ ...S.kbKey, ...S.kbShift, ...(isShifted ? S.kbShiftActive : {}) }} onMouseDown={e => { e.preventDefault(); onShift(); }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </button>
        {KR_ROW3.map(k => (
          <button key={k} style={S.kbKey} onMouseDown={e => { e.preventDefault(); onChar(k); }}>{kl(k)}</button>
        ))}
        <button style={{ ...S.kbKey, ...S.kbBlue }} onMouseDown={e => { e.preventDefault(); onConfirm(); }}>완료</button>
      </div>
    </div>
  );
});

/* ════════════════════════════════════════════════════════════
   숫자 키패드
════════════════════════════════════════════════════════════ */
const NUM_ROWS = [['1','2','3'],['4','5','6'],['7','8','9']];

interface NumericKBProps { onNum: (k: string) => void; onBackspace: () => void; onConfirm: () => void; }

const NumericKB: React.FC<NumericKBProps> = React.memo(({ onNum, onBackspace, onConfirm }) => (
  <div style={S.kbNumWrap}>
    <div style={S.kbNumInner}>
      {NUM_ROWS.map((row, ri) => (
        <div key={ri} style={S.kbNumRow}>
          {row.map(k => (
            <button key={k} style={S.kbNumKey} onMouseDown={e => { e.preventDefault(); onNum(k); }}>{k}</button>
          ))}
        </div>
      ))}
      <div style={S.kbNumRow}>
        <div style={{ ...S.kbNumKey, visibility: 'hidden' } as React.CSSProperties}/>
        <button style={S.kbNumKey} onMouseDown={e => { e.preventDefault(); onNum('0'); }}>0</button>
        <div style={{ ...S.kbNumKey, visibility: 'hidden' } as React.CSSProperties}/>
      </div>
      <div style={S.kbNumRow}>
        <button style={{ ...S.kbNumAction, ...S.kbNumDel }} onMouseDown={e => { e.preventDefault(); onBackspace(); }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <button style={{ ...S.kbNumAction, ...S.kbNumDone }} onMouseDown={e => { e.preventDefault(); onConfirm(); }}>완료</button>
      </div>
    </div>
  </div>
));

/* ════════════════════════════════════════════════════════════
   데이터 행
════════════════════════════════════════════════════════════ */
const DataRow: React.FC<{label:string; value:string}> = ({ label, value }) => (
  <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:14 }}>
    <span style={{ color:'#6B7280' }}>{label}</span>
    <span style={{ fontWeight:600, color:'#1a1f36' }}>{value}</span>
  </div>
);

/* ════════════════════════════════════════════════════════════
   CSS keyframes
════════════════════════════════════════════════════════════ */
const CSS_KEYFRAMES = `
@keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes carrierHintPulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
`;

/* ════════════════════════════════════════════════════════════
   스타일
════════════════════════════════════════════════════════════ */
const S: Record<string, React.CSSProperties> = {
  /* 전체 래퍼 — flex column: scrollArea + bottomBtns(고정) + kbSlider(절대) */
  wrapper: {
    display: 'flex', flexDirection: 'column', height: '100%',
    position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(160deg, #E8EDF3 0%, #F0F4F8 100%)',
    fontFamily: "'Pretendard','Noto Sans KR',-apple-system,BlinkMacSystemFont,sans-serif",
  },

  /* 스크롤 영역 */
  scrollArea: {
    flex: 1, overflowY: 'auto', padding: '20px 32px 8px',
    scrollBehavior: 'smooth' as const,
  },

  /* 타이틀 */
  titleSection: { textAlign: 'center' as const, marginBottom: 16 },
  title:    { fontSize: '1.5rem', fontWeight: 700, color: '#1a1f36', margin: 0 },
  subtitle: { fontSize: '0.92rem', color: '#6b7280', marginTop: 4 },

  /* 폼 카드 — 최대 너비 제한으로 너무 길쭉하지 않게 */
  formCard: {
    background: '#fff', borderRadius: 16,
    padding: '22px 28px',
    display: 'flex', flexDirection: 'column', gap: 18,
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    maxWidth: 640,      /* ← 너비 제한 */
    margin: '0 auto',  /* ← 중앙 정렬 */
  },

  fieldGroup:   { display: 'flex', flexDirection: 'column', gap: 6, scrollMarginTop: 16 },
  fieldLabel:   { fontSize: '0.9rem', fontWeight: 600, color: '#374151' },
  req: { color: '#EF4444', marginLeft: 2 },
  opt: { fontSize: '0.78rem', color: '#9CA3AF', fontWeight: 400 },

  inputBox: {
    minHeight: 48, padding: '10px 16px', borderRadius: 10,
    border: '2px solid rgba(0,0,0,0.1)', background: '#F9FAFB',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    transition: 'border-color .2s, box-shadow .2s, background .2s',
    userSelect: 'none' as const,
  },
  inputBoxFocused: {
    borderColor: '#3B82F6', background: '#FAFCFF',
    boxShadow: '0 0 0 3px rgba(59,130,246,0.12)',
  },
  inputBoxError: {
    borderColor: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.08)',
  },
  inputText:        { fontSize: '1.05rem', fontWeight: 500, color: '#1a1f36', letterSpacing: '0.02em' },
  inputPlaceholder: { fontSize: '0.92rem', color: '#9CA3AF' },
  cursor: {
    display: 'inline-block', width: 2, height: 18, background: '#3B82F6',
    marginLeft: 2, verticalAlign: 'middle',
    animation: 'cursorBlink 1s step-end infinite',
  },

  rrnRow:    { display: 'flex', alignItems: 'center', gap: 8 },
  rrnDivider:{ fontSize: '1.3rem', fontWeight: 700, color: '#374151', flexShrink: 0 },
  rrnMask:   { fontSize: '0.78rem', letterSpacing: '0.16em', color: '#9CA3AF', flexShrink: 0, paddingLeft: 4 },

  errorMsg: { fontSize: '0.78rem', color: '#EF4444', paddingLeft: 2 },

  carrierGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 7 },
  carrierBtn: {
    padding: '10px 6px', borderRadius: 9, fontSize: '0.85rem', fontWeight: 600,
    background: '#F3F4F6', border: '2px solid rgba(0,0,0,0.08)', color: '#374151',
    cursor: 'pointer', transition: 'all .2s', fontFamily: 'inherit', minHeight: 42,
  },
  carrierHint: {
    fontSize: '0.82rem', color: '#3B82F6', textAlign: 'center' as const,
    padding: 6, borderRadius: 7, background: 'rgba(59,130,246,0.06)',
    animation: 'carrierHintPulse 2s ease-in-out infinite',
  },

  /* ── 하단 버튼 (스크롤 밖, 항상 보임) ── */
  bottomBtns: {
    display: 'flex', gap: 10,
    padding: '12px 32px 16px',
    background: 'linear-gradient(transparent, rgba(232,237,243,0.98) 25%)',
    flexShrink: 0,
    zIndex: 10,
  },
  btnCancel: {
    flex: 1, padding: '14px 0', borderRadius: 11, fontSize: '0.95rem', fontWeight: 600,
    background: '#F3F4F6', border: '1px solid rgba(0,0,0,0.1)', color: '#6B7280',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'background .2s',
  },
  btnSubmit: {
    flex: 2, padding: '14px 0', borderRadius: 11, fontSize: '0.95rem', fontWeight: 700,
    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    border: 'none', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 3px 12px rgba(59,130,246,0.35)', transition: 'filter .2s',
  },

  /* 키보드 슬라이더 */
  kbSlider: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100,
    transition: 'transform 0.28s cubic-bezier(0.32,0.72,0,1)',
    willChange: 'transform' as const,
  },

  /* 한글 키보드 */
  kbKoWrap: {
    width: '100%', background: '#e8e9ed',
    borderRadius: '14px 14px 0 0', padding: '10px 14px 14px',
    display: 'flex', flexDirection: 'column', gap: 7,
    boxShadow: '0 -4px 16px rgba(0,0,0,0.10)', borderTop: '1px solid rgba(0,0,0,0.08)',
  },
  kbRow:  { display: 'flex', gap: 6 },
  kbKey: {
    flex: 1, height: 58, borderRadius: 9,
    border: '1px solid rgba(0,0,0,0.08)', background: '#f7f7f9',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 23, fontWeight: 500, color: '#1a1f36',
    cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
    transition: 'transform 0.1s, background 0.1s', userSelect: 'none' as const,
  },
  kbBackspace: { background: '#f87171', border: 'none', color: '#fff', boxShadow: '0 1px 3px rgba(248,113,113,0.3)' },
  kbBlue:      { background: '#3b82f6', border: 'none', color: '#fff', fontSize: 18, fontWeight: 700, boxShadow: '0 1px 3px rgba(59,130,246,0.3)' },
  kbShift:     { background: '#eeeff2', color: '#374151', border: '1px solid rgba(0,0,0,0.08)', fontSize: 20 },
  kbShiftActive:{ background: '#d1d5db', border: '2px solid #9ca3af' },

  /* 숫자 키패드 */
  kbNumWrap: {
    width: '100%', background: '#e8e9ed',
    borderRadius: '14px 14px 0 0', padding: '10px 14px 14px',
    boxShadow: '0 -4px 16px rgba(0,0,0,0.10)', borderTop: '1px solid rgba(0,0,0,0.08)',
    display: 'flex', justifyContent: 'center',
  },
  kbNumInner: {
    display: 'inline-flex', flexDirection: 'column', gap: 8,
    background: '#f5f6f8', borderRadius: 16, padding: '16px 14px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.07)',
  },
  kbNumRow:    { display: 'flex', gap: 8, justifyContent: 'center' },
  kbNumKey: {
    width: 74, height: 74, borderRadius: 11,
    border: '1px solid rgba(0,0,0,0.07)', background: '#ffffff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 28, fontWeight: 500, color: '#1a1f36',
    cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
    transition: 'transform 0.1s, background 0.1s', userSelect: 'none' as const,
  },
  kbNumAction: {
    height: 52, flex: 1, borderRadius: 9, border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
    fontWeight: 700, fontSize: 18, color: '#fff',
    transition: 'transform 0.1s, background 0.1s', userSelect: 'none' as const,
  },
  kbNumDel:  { background: '#f87171', boxShadow: '0 1px 3px rgba(248,113,113,0.3)' },
  kbNumDone: { background: '#3b82f6', boxShadow: '0 1px 3px rgba(59,130,246,0.3)' },

  /* 성공 모달 */
  modalOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
    zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalCard: {
    background: '#fff', borderRadius: 18, padding: '32px 40px',
    textAlign: 'center' as const, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    maxWidth: 400, width: '90%',
  },
  modalData: {
    textAlign: 'left' as const, margin: '16px 0',
    background: '#F9FAFB', borderRadius: 9, padding: '12px 16px',
  },
  modalClose: {
    marginTop: 16, padding: '12px 36px', borderRadius: 11,
    background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: '#fff',
    border: 'none', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
};

export default KioskIdentityForm;