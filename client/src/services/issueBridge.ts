/**
 * issueBridge — 발급 확인 모달 상태 관리 (모듈 싱글톤)
 *
 * issue_document 함수가 호출되면 setPending(true)으로 모달을 열고,
 * 사용자가 ConversationView 의 확인 모달에서 "발급" 버튼을 누르면 confirm() 호출.
 * 취소 시 cancel() 호출.
 */

type IssueListener = (pending: boolean) => void;

let _pending = false;
let _onConfirm: (() => void) | null = null;
const _listeners = new Set<IssueListener>();

export const issueBridge = {
  /** functionCallDispatcher 에서 issue_document 처리 시 호출 */
  setPending(pending: boolean, onConfirm?: () => void): void {
    _pending = pending;
    _onConfirm = onConfirm ?? null;
    _listeners.forEach(fn => fn(pending));
  },

  isPending(): boolean {
    return _pending;
  },

  /** ConversationView 의 "발급" 버튼 클릭 시 호출 */
  confirm(): void {
    const fn = _onConfirm;
    _onConfirm = null;
    _pending = false;
    _listeners.forEach(l => l(false));
    fn?.();
  },

  /** ConversationView 의 "취소" 버튼 클릭 시 호출 */
  cancel(): void {
    _onConfirm = null;
    _pending = false;
    _listeners.forEach(l => l(false));
  },

  /** React 컴포넌트에서 상태 변화를 구독 */
  subscribe(fn: IssueListener): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
