// /**
//  * App - Main application component.
//  * Routes: ServiceSelector → ConversationView|DocumentGuideView.
//  * Phone verification now happens inline during conversation via AI function call.
//  */

// import { useCallback } from 'react';
// import { useStore } from '@/store';
// import { useVoicePipeline } from '@/hooks/useVoicePipeline';
// import { KioskLayout } from '@/components/layout/KioskLayout';
// import { ServiceSelector } from '@/components/layout/ServiceSelector';
// import { ConversationView } from '@/components/conversation/ConversationView';
// import { DocumentGuideView } from '@/components/document/DocumentGuideView';
// import type { PipelineMode } from '@shared/types/voice';

// export default function App() {
//   const sessionId = useStore(s => s.sessionId);
//   const pipelineMode = useStore(s => s.pipelineMode);
//   const setPipelineMode = useStore(s => s.setPipelineMode);
//   const { startSession } = useVoicePipeline();

//   const handleServiceSelect = useCallback(async (mode: PipelineMode) => {
//     setPipelineMode(mode);
//     await startSession(mode);
//   }, [setPipelineMode, startSession]);

//   // No session → service selector, session exists → conversation or document view
//   if (!sessionId) {
//     return (
//       <KioskLayout>
//         <ServiceSelector onSelect={handleServiceSelect} />
//       </KioskLayout>
//     );
//   }

//   return (
//     <KioskLayout>
//       {pipelineMode === 'realtime' ? (
//         <ConversationView />
//       ) : (
//         <DocumentGuideView />
//       )}
//     </KioskLayout>
//   );
// }


// /**
//  * App - Main application component.
//  * Routes: ServiceSelector → ConversationView|DocumentGuideView.
//  * Phone verification now happens inline during conversation via AI function call.
//  */

// import { useCallback } from 'react';
// import { useStore } from '@/store';
// import { useVoicePipeline } from '@/hooks/useVoicePipeline';
// import { KioskLayout } from '@/components/layout/KioskLayout';
// import { ServiceSelector } from '@/components/layout/ServiceSelector';
// import { ConversationView } from '@/components/conversation/ConversationView';
// import { DocumentGuideView } from '@/components/document/DocumentGuideView';
// import type { PipelineMode } from '@shared/types/voice';

// export default function App() {
//   const sessionId = useStore(s => s.sessionId);
//   const pipelineMode = useStore(s => s.pipelineMode);
//   const setPipelineMode = useStore(s => s.setPipelineMode);
//   const { startSession } = useVoicePipeline();

//   const handleServiceSelect = useCallback(async (mode: PipelineMode) => {
//     setPipelineMode(mode);
//     await startSession(mode);
//   }, [setPipelineMode, startSession]);

//   // No session → service selector, session exists → conversation or document view
//   if (!sessionId) {
//     return (
//       <KioskLayout>
//         <ServiceSelector onSelect={handleServiceSelect} />
//       </KioskLayout>
//     );
//   }

//   return (
//     <KioskLayout>
//       {pipelineMode === 'realtime' ? (
//         <ConversationView />
//       ) : (
//         <DocumentGuideView />
//       )}
//     </KioskLayout>
//   );
// }


/**
 * App - Main application component.
 * ServiceSelector 제거 → 앱 마운트 및 세션 종료 후 즉시 realtime 세션 자동 시작.
 * Phone verification now happens inline during conversation via AI function call.
 */
/**
 * App - Main application component.
 * ServiceSelector 제거 → 앱 마운트 및 세션 종료 후 즉시 realtime 세션 자동 시작.
 * Phone verification now happens inline during conversation via AI function call.
 *//**
 * App - Main application component.
 * ServiceSelector 제거 → 앱 마운트 및 세션 종료 후 즉시 realtime 세션 자동 시작.
 * Phone verification now happens inline during conversation via AI function call.
 */

import { useEffect, useRef } from 'react';
import { useStore } from '@/store';
import { useVoicePipeline } from '@/hooks/useVoicePipeline';
import { KioskLayout } from '@/components/layout/KioskLayout';
import { ConversationView } from '@/components/conversation/ConversationView';
import { DocumentGuideView } from '@/components/document/DocumentGuideView';

export default function App() {
  const pipelineMode = useStore(s => s.pipelineMode);
  const sessionId    = useStore(s => s.sessionId);
  const voiceState   = useStore(s => s.voiceState);
  const { startSession } = useVoicePipeline();

  /**
   * sessionId가 없을 때 자동으로 realtime 세션 시작 (단 1회):
   *  - 최초 마운트 시 (sessionId === null)
   *  - endSession 이후 reset()으로 sessionId가 null로 돌아올 때
   *
   * hasStartedRef 로 중복 실행 방지:
   *  - sessionId가 실제로 세팅되면 false로 리셋 → endSession 후 재시작 허용
   *  - startSession 콜백 레퍼런스가 바뀌어도 이중 실행 안 됨
   */
  const hasStartedRef = useRef(false);

  useEffect(() => {
    // 세션이 생성되면 가드 리셋 (endSession 후 재시작을 위해)
    if (sessionId !== null) {
      hasStartedRef.current = false;
      return;
    }
    if (voiceState === 'error') return;
    if (hasStartedRef.current) return;

    hasStartedRef.current = true;
    startSession('realtime');
  }, [sessionId, voiceState, startSession]);

  return (
    <KioskLayout>
      {pipelineMode === 'realtime' ? (
        <ConversationView />
      ) : (
        <DocumentGuideView />
      )}
    </KioskLayout>
  );
}