/**
 * App - Main application component.
 * Routes: ServiceSelector → ConversationView|DocumentGuideView.
 * Phone verification now happens inline during conversation via AI function call.
 */

import { useCallback } from 'react';
import { useStore } from '@/store';
import { useVoicePipeline } from '@/hooks/useVoicePipeline';
import { KioskLayout } from '@/components/layout/KioskLayout';
import { ServiceSelector } from '@/components/layout/ServiceSelector';
import { ConversationView } from '@/components/conversation/ConversationView';
import { DocumentGuideView } from '@/components/document/DocumentGuideView';
import type { PipelineMode } from '@shared/types/voice';

export default function App() {
  const sessionId = useStore(s => s.sessionId);
  const pipelineMode = useStore(s => s.pipelineMode);
  const setPipelineMode = useStore(s => s.setPipelineMode);
  const { startSession } = useVoicePipeline();

  const handleServiceSelect = useCallback(async (mode: PipelineMode) => {
    setPipelineMode(mode);
    await startSession(mode);
  }, [setPipelineMode, startSession]);

  // No session → service selector, session exists → conversation or document view
  if (!sessionId) {
    return (
      <KioskLayout>
        <ServiceSelector onSelect={handleServiceSelect} />
      </KioskLayout>
    );
  }

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
