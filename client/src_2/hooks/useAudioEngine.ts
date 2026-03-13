/**
 * Hook for AudioEngine lifecycle management.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { AudioEngine } from '@/services/audioEngine';
import { useStore } from '@/store';

export function useAudioEngine() {
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const setAudioLevel = useStore(s => s.setAudioLevel);

  useEffect(() => {
    audioEngineRef.current = AudioEngine.getInstance();

    // Check initial permission
    audioEngineRef.current.checkMicPermission().then(setPermissionState);

    return () => {
      // Don't destroy on unmount - singleton lives across components
    };
  }, []);

  const initialize = useCallback(async () => {
    const engine = AudioEngine.getInstance();
    await engine.initialize();
    engine.setOnAudioLevel(setAudioLevel);
    audioEngineRef.current = engine;
    setIsInitialized(true);

    const perm = await engine.checkMicPermission();
    setPermissionState(perm);
  }, [setAudioLevel]);

  const startCapture = useCallback(async () => {
    if (!audioEngineRef.current) return;
    await audioEngineRef.current.startMicCapture();
    const perm = await audioEngineRef.current.checkMicPermission();
    setPermissionState(perm);
  }, []);

  const stopCapture = useCallback(() => {
    audioEngineRef.current?.stopMicCapture();
  }, []);

  const stopPlayback = useCallback(() => {
    audioEngineRef.current?.stopPlayback();
  }, []);

  return {
    audioEngine: audioEngineRef.current,
    isInitialized,
    permissionState,
    initialize,
    startCapture,
    stopCapture,
    stopPlayback,
  };
}
