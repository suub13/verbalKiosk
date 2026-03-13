/**
 * App - Main application component.
 * 앱 마운트 및 세션 종료 후 즉시 realtime 세션 자동 시작.
 * Phone verification happens inline during conversation via AI function call.
 */

import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { useVoicePipeline } from '@/hooks/useVoicePipeline';
import { KioskLayout } from '@/components/layout/KioskLayout';
import { ConversationView } from '@/components/conversation/ConversationView';

export default function App() {
  const sessionId  = useStore(s => s.sessionId);
  const voiceState = useStore(s => s.voiceState);
  const { startSession } = useVoicePipeline();

  /**
   * sessionId가 없을 때 자동으로 realtime 세션 시작 (단 1회):
   *  - 최초 마운트 시 (sessionId === null)
   *  - endSession 이후 reset()으로 sessionId가 null로 돌아올 때
   */
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (sessionId !== null) {
      hasStartedRef.current = false;
      return;
    }
    if (voiceState === 'error') return;
    if (hasStartedRef.current) return;

    hasStartedRef.current = true;
    startSession();
  }, [sessionId, voiceState, startSession]);

  return (
    <KioskLayout>
      <ConversationView />
    </KioskLayout>
  );
}
