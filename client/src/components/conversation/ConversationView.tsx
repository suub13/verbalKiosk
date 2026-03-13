// // // import React, { useEffect, useRef, useCallback, useState } from 'react';
// // // import { useStore } from '@/store';
// // // import { VoiceStateIndicator } from '@/components/voice/VoiceStateIndicator';
// // // import { MessageBubble } from './MessageBubble';
// // // import { WorkflowPanel } from './WorkflowPanel';
// // // import { pipelineBridge } from '@/services/pipelineBridge';

// // // export function ConversationView() {
// // //   /* ── store 구독 ── */
// // //   const messages            = useStore(s => s.messages);
// // //   const partialTranscript   = useStore(s => s.partialTranscript);
// // //   const voiceState          = useStore(s => s.voiceState);
// // //   const isWorkflowOpen      = useStore(s => s.isWorkflowOpen);

// // //   /* ── 오답 수정 콜백 ── */
// // //   const handleResolveCorrection = useCallback((messageId: string, accepted: boolean) => {
// // //     useStore.getState().resolveCorrection(messageId, accepted);
// // //     if (!accepted) {
// // //       pipelineBridge.onCorrectionRejected?.();
// // //     }
// // //   }, []);

// // //   const hasMessages = messages.length > 0;
// // //   const scrollRef   = useRef<HTMLDivElement>(null);

// // //   /* 새 메시지 도착 시 최하단으로 스크롤 */
// // //   useEffect(() => {
// // //     const el = scrollRef.current;
// // //     if (el) el.scrollTop = el.scrollHeight;
// // //   }, [messages]);

// // //   return (
// // //     <div
// // //       className="conversation-view"
// // //       style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}
// // //     >
// // //       {/* ──────────────────────────────────────────
// // //           좌측: 대화창
// // //           · 워크플로우 열림: flex 0 0 50%
// // //           · 워크플로우 닫힘: flex 1 (전체)
// // //       ────────────────────────────────────────── */}
// // //       <div
// // //         style={{
// // //           flex:          isWorkflowOpen ? '0 0 50%' : 1,
// // //           display:       'flex',
// // //           minWidth:      0,
// // //           flexDirection: 'column',
// // //           position:      'relative',
// // //           overflow:      'hidden',
// // //           transition:    'flex 300ms ease',
// // //         }}
// // //       >
// // //         {/* 스크롤 가능한 메시지 영역 */}
// // //         <div
// // //           ref={scrollRef}
// // //           className="conversation-view__messages"
// // //           style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 0' }}
// // //         >
// // //           {!hasMessages ? (
// // //             /* 메시지 없음 — 음성 인디케이터 중앙 표시 */
// // //             <div
// // //               style={{
// // //                 flex: 1, display: 'flex', flexDirection: 'column',
// // //                 alignItems: 'center', justifyContent: 'center',
// // //                 gap: 56, paddingBottom: 56,
// // //               }}
// // //             >
// // //               <VoiceStateIndicator />
// // //               <p style={{ fontSize: 28, color: '#6b7280', marginTop: 20, textAlign: 'center', userSelect: 'none' }}>
// // //                 음성으로 말씀해 주세요
// // //               </p>
// // //             </div>
// // //           ) : (
// // //             <>
// // //               {/* 메시지 있을 때 — 축소된 음성 인디케이터 */}
// // //               <div
// // //                 style={{
// // //                   display: 'flex', justifyContent: 'center',
// // //                   padding: '10px 0 20px',
// // //                   transform: 'scale(0.5)', transformOrigin: 'top center',
// // //                   height: 170, flexShrink: 0,
// // //                 }}
// // //               >
// // //                 <VoiceStateIndicator />
// // //               </div>

// // //               {/* 메시지 목록 */}
// // //               {messages.map(msg => (
// // //                 <MessageBubble
// // //                   key={msg.id}
// // //                   role={msg.role}
// // //                   content={msg.content}
// // //                   timestamp={msg.timestamp}
// // //                   audioTranscript={msg.audioTranscript}
// // //                   correction={msg.correction}
// // //                   onResolveCorrection={
// // //                     msg.correction?.status === 'pending'
// // //                       ? (accepted) => handleResolveCorrection(msg.id, accepted)
// // //                       : undefined
// // //                   }
// // //                 />
// // //               ))}

// // //               <div style={{ height: 100, flexShrink: 0 }} />
// // //             </>
// // //           )}
// // //         </div>

// // //         {/* 음성 인식 중간 결과 오버레이 */}
// // //         {(partialTranscript || voiceState === 'listening') && (
// // //           <div
// // //             className="conversation-view__transcript-overlay"
// // //             style={{
// // //               position: 'absolute', bottom: 0, left: 0, right: 0,
// // //               padding: '20px 32px',
// // //               background: 'linear-gradient(transparent, rgba(255,255,255,0.95) 30%)',
// // //               pointerEvents: 'none',
// // //             }}
// // //           >
// // //             <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
// // //               <span
// // //                 style={{
// // //                   width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
// // //                   background: voiceState === 'listening' ? '#3b82f6' : '#9ca3af',
// // //                   animation: voiceState === 'listening' ? 'transcript-pulse 1.2s infinite' : 'none',
// // //                 }}
// // //               />
// // //               <span style={{ fontSize: 24, color: '#374151', fontStyle: partialTranscript ? 'normal' : 'italic' }}>
// // //                 {partialTranscript || '듣고 있습니다...'}
// // //               </span>
// // //             </div>
// // //           </div>
// // //         )}

// // //         <style>{`
// // //           @keyframes transcript-pulse {
// // //             0%, 100% { opacity: 1; transform: scale(1); }
// // //             50%       { opacity: 0.4; transform: scale(0.8); }
// // //           }
// // //         `}</style>
// // //       </div>

// // //       {/* ──────────────────────────────────────────
// // //           우측: WorkflowPanel — 항상 flex 0 0 50%
// // //       ────────────────────────────────────────── */}
// // //       {isWorkflowOpen && (
// // //         <div
// // //           style={{
// // //             flex:       '0 0 50%',
// // //             minWidth:   0,
// // //             borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
// // //             overflow:   'hidden',
// // //             transition: 'flex 300ms ease',
// // //           }}
// // //         >
// // //           <WorkflowPanel />
// // //         </div>
// // //       )}
// // //     </div>
// // //   );
// // // }


// // import React, { useEffect, useRef, useCallback, useState } from 'react';
// // import { useStore } from '@/store';
// // import { VoiceStateIndicator } from '@/components/voice/VoiceStateIndicator';
// // import { MessageBubble } from './MessageBubble';
// // import { WorkflowPanel } from './WorkflowPanel';
// // import { pipelineBridge } from '@/services/pipelineBridge';

// // export function ConversationView() {
// //   /* ── store 구독 ── */
// //   const messages            = useStore(s => s.messages);
// //   const partialTranscript   = useStore(s => s.partialTranscript);
// //   const voiceState          = useStore(s => s.voiceState);
// //   const isMuted             = useStore(s => s.isMuted);
// //   const isWorkflowOpen      = useStore(s => s.isWorkflowOpen);

// //   // 마이크가 실제로 열려있는 listening 상태일 때만 표시
// //   const isMicActive = voiceState === 'listening' && !isMuted;

// //   /* ── 오답 수정 콜백 ── */
// //   const handleResolveCorrection = useCallback((messageId: string, accepted: boolean) => {
// //     useStore.getState().resolveCorrection(messageId, accepted);
// //     if (!accepted) {
// //       pipelineBridge.onCorrectionRejected?.();
// //     }
// //   }, []);

// //   const hasMessages = messages.length > 0;
// //   const scrollRef   = useRef<HTMLDivElement>(null);

// //   /* 새 메시지 도착 시 최하단으로 스크롤 */
// //   useEffect(() => {
// //     const el = scrollRef.current;
// //     if (el) el.scrollTop = el.scrollHeight;
// //   }, [messages]);

// //   return (
// //     <div
// //       className="conversation-view"
// //       style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}
// //     >
// //       {/* ──────────────────────────────────────────
// //           좌측: 대화창
// //           · 워크플로우 열림: flex 0 0 50%
// //           · 워크플로우 닫힘: flex 1 (전체)
// //       ────────────────────────────────────────── */}
// //       <div
// //         style={{
// //           flex:          isWorkflowOpen ? '0 0 50%' : 1,
// //           display:       'flex',
// //           minWidth:      0,
// //           flexDirection: 'column',
// //           position:      'relative',
// //           overflow:      'hidden',
// //           transition:    'flex 300ms ease',
// //         }}
// //       >
// //         {/* 스크롤 가능한 메시지 영역 */}
// //         <div
// //           ref={scrollRef}
// //           className="conversation-view__messages"
// //           style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 0' }}
// //         >
// //           {!hasMessages ? (
// //             /* 메시지 없음 — 음성 인디케이터 중앙 표시 */
// //             <div
// //               style={{
// //                 flex: 1, display: 'flex', flexDirection: 'column',
// //                 alignItems: 'center', justifyContent: 'center',
// //                 gap: 56, paddingBottom: 56,
// //               }}
// //             >
// //               <VoiceStateIndicator />
// //               <p style={{ fontSize: 28, color: '#6b7280', marginTop: 20, textAlign: 'center', userSelect: 'none' }}>
// //                 음성으로 말씀해 주세요
// //               </p>
// //             </div>
// //           ) : (
// //             <>
// //               {/* 메시지 있을 때 — 축소된 음성 인디케이터 */}
// //               <div
// //                 style={{
// //                   display: 'flex', justifyContent: 'center',
// //                   padding: '10px 0 20px',
// //                   transform: 'scale(0.5)', transformOrigin: 'top center',
// //                   height: 170, flexShrink: 0,
// //                 }}
// //               >
// //                 <VoiceStateIndicator />
// //               </div>

// //               {/* 메시지 목록 */}
// //               {messages.map(msg => (
// //                 <MessageBubble
// //                   key={msg.id}
// //                   role={msg.role}
// //                   content={msg.content}
// //                   timestamp={msg.timestamp}
// //                   audioTranscript={msg.audioTranscript}
// //                   correction={msg.correction}
// //                   onResolveCorrection={
// //                     msg.correction?.status === 'pending'
// //                       ? (accepted) => handleResolveCorrection(msg.id, accepted)
// //                       : undefined
// //                   }
// //                 />
// //               ))}

// //               <div style={{ height: 100, flexShrink: 0 }} />
// //             </>
// //           )}
// //         </div>

// //         {/* 음성 인식 중간 결과 오버레이 — 마이크 활성(listening + !muted) 상태에서만 표시 */}
// //         {isMicActive && (
// //           <div
// //             className="conversation-view__transcript-overlay"
// //             style={{
// //               position: 'absolute', bottom: 0, left: 0, right: 0,
// //               padding: '20px 32px',
// //               background: 'linear-gradient(transparent, rgba(255,255,255,0.95) 30%)',
// //               pointerEvents: 'none',
// //             }}
// //           >
// //             <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
// //               <span
// //                 style={{
// //                   width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
// //                   background: isMicActive ? '#3b82f6' : '#9ca3af',
// //                   animation: isMicActive ? 'transcript-pulse 1.2s infinite' : 'none',
// //                 }}
// //               />
// //               <span style={{ fontSize: 24, color: '#374151', fontStyle: partialTranscript ? 'normal' : 'italic' }}>
// //                 {partialTranscript || '듣고 있습니다...'}
// //               </span>
// //             </div>
// //           </div>
// //         )}

// //         <style>{`
// //           @keyframes transcript-pulse {
// //             0%, 100% { opacity: 1; transform: scale(1); }
// //             50%       { opacity: 0.4; transform: scale(0.8); }
// //           }
// //         `}</style>
// //       </div>

// //       {/* ──────────────────────────────────────────
// //           우측: WorkflowPanel — 항상 flex 0 0 50%
// //       ────────────────────────────────────────── */}
// //       {isWorkflowOpen && (
// //         <div
// //           style={{
// //             flex:       '0 0 50%',
// //             minWidth:   0,
// //             borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
// //             overflow:   'hidden',
// //             transition: 'flex 300ms ease',
// //           }}
// //         >
// //           <WorkflowPanel />
// //         </div>
// //       )}
// //     </div>
// //   );
// // }

// import React, { useEffect, useRef, useCallback, useState } from 'react';
// import { useStore } from '@/store';
// import { VoiceStateIndicator } from '@/components/voice/VoiceStateIndicator';
// import { MessageBubble } from './MessageBubble';
// import { WorkflowPanel } from './WorkflowPanel';
// import { pipelineBridge } from '@/services/pipelineBridge';

// export function ConversationView() {
//   /* ── store 구독 ── */
//   const messages            = useStore(s => s.messages);
//   const partialTranscript   = useStore(s => s.partialTranscript);
//   const voiceState          = useStore(s => s.voiceState);
//   const isMuted             = useStore(s => s.isMuted);
//   const isWorkflowOpen      = useStore(s => s.isWorkflowOpen);

//   // 마이크가 실제로 열려있는 listening 상태일 때만 표시
//   const isMicActive = voiceState === 'listening' && !isMuted;
//   // AI 발화 스트리밍 오버레이: speaking 상태에서 partialTranscript가 있을 때
//   const isAiSpeaking = voiceState === 'speaking' && !!partialTranscript;

//   /* ── 오답 수정 콜백 ── */
//   const handleResolveCorrection = useCallback((messageId: string, accepted: boolean) => {
//     useStore.getState().resolveCorrection(messageId, accepted);
//     if (!accepted) {
//       pipelineBridge.onCorrectionRejected?.();
//     }
//   }, []);

//   const hasMessages = messages.length > 0;
//   const scrollRef   = useRef<HTMLDivElement>(null);

//   /* 새 메시지 도착 시 최하단으로 스크롤 */
//   useEffect(() => {
//     const el = scrollRef.current;
//     if (el) el.scrollTop = el.scrollHeight;
//   }, [messages]);

//   return (
//     <div
//       className="conversation-view"
//       style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}
//     >
//       {/* ──────────────────────────────────────────
//           좌측: 대화창
//           · 워크플로우 열림: flex 0 0 50%
//           · 워크플로우 닫힘: flex 1 (전체)
//       ────────────────────────────────────────── */}
//       <div
//         style={{
//           flex:          isWorkflowOpen ? '0 0 50%' : 1,
//           display:       'flex',
//           minWidth:      0,
//           flexDirection: 'column',
//           position:      'relative',
//           overflow:      'hidden',
//           transition:    'flex 300ms ease',
//         }}
//       >
//         {/* 스크롤 가능한 메시지 영역 */}
//         <div
//           ref={scrollRef}
//           className="conversation-view__messages"
//           style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 0' }}
//         >
//           {!hasMessages ? (
//             /* 메시지 없음 — 음성 인디케이터 중앙 표시 */
//             <div
//               style={{
//                 flex: 1, display: 'flex', flexDirection: 'column',
//                 alignItems: 'center', justifyContent: 'center',
//                 gap: 56, paddingBottom: 56,
//               }}
//             >
//               <VoiceStateIndicator />
//               <p style={{ fontSize: 28, color: '#6b7280', marginTop: 20, textAlign: 'center', userSelect: 'none' }}>
//                 음성으로 말씀해 주세요
//               </p>
//             </div>
//           ) : (
//             <>
//               {/* 메시지 있을 때 — 축소된 음성 인디케이터 */}
//               <div
//                 style={{
//                   display: 'flex', justifyContent: 'center',
//                   padding: '10px 0 20px',
//                   transform: 'scale(0.5)', transformOrigin: 'top center',
//                   height: 170, flexShrink: 0,
//                 }}
//               >
//                 <VoiceStateIndicator />
//               </div>

//               {/* 메시지 목록 */}
//               {messages.map(msg => (
//                 <MessageBubble
//                   key={msg.id}
//                   role={msg.role}
//                   content={msg.content}
//                   timestamp={msg.timestamp}
//                   audioTranscript={msg.audioTranscript}
//                   correction={msg.correction}
//                   onResolveCorrection={
//                     msg.correction?.status === 'pending'
//                       ? (accepted) => handleResolveCorrection(msg.id, accepted)
//                       : undefined
//                   }
//                 />
//               ))}

//               <div style={{ height: 100, flexShrink: 0 }} />
//             </>
//           )}
//         </div>

//         {/* ── AI 발화 스트리밍 오버레이 (speaking + partialTranscript) ── */}
//         {isAiSpeaking && (
//           <div
//             className="conversation-view__ai-transcript-overlay"
//             style={{
//               position: 'absolute', bottom: 0, left: 0, right: 0,
//               padding: '20px 32px',
//               background: 'linear-gradient(transparent, rgba(255,255,255,0.97) 30%)',
//               pointerEvents: 'none',
//             }}
//           >
//             <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'center' }}>
//               <span
//                 style={{
//                   width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 6,
//                   background: '#10b981',
//                   animation: 'transcript-pulse 1.2s infinite',
//                 }}
//               />
//               <span style={{ fontSize: 24, color: '#065f46', fontWeight: 500, lineHeight: 1.5, wordBreak: 'keep-all' }}>
//                 {partialTranscript}
//                 {/* 타이핑 커서 */}
//                 <span
//                   aria-hidden="true"
//                   style={{
//                     display: 'inline-block', width: 2, height: '1em',
//                     marginLeft: 2, verticalAlign: 'text-bottom',
//                     background: '#10b981',
//                     animation: 'transcript-cursor-blink 800ms step-end infinite',
//                   }}
//                 />
//               </span>
//             </div>
//           </div>
//         )}

//         {/* ── 유저 마이크 오버레이 — 마이크 활성(listening + !muted) 상태에서만 표시 ── */}
//         {isMicActive && (
//           <div
//             className="conversation-view__transcript-overlay"
//             style={{
//               position: 'absolute', bottom: 0, left: 0, right: 0,
//               padding: '20px 32px',
//               background: 'linear-gradient(transparent, rgba(255,255,255,0.95) 30%)',
//               pointerEvents: 'none',
//             }}
//           >
//             <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
//               <span
//                 style={{
//                   width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
//                   background: '#3b82f6',
//                   animation: 'transcript-pulse 1.2s infinite',
//                 }}
//               />
//               <span style={{ fontSize: 24, color: '#374151', fontStyle: partialTranscript ? 'normal' : 'italic' }}>
//                 {partialTranscript || '듣고 있습니다...'}
//               </span>
//             </div>
//           </div>
//         )}

//         <style>{`
//           @keyframes transcript-pulse {
//             0%, 100% { opacity: 1; transform: scale(1); }
//             50%       { opacity: 0.4; transform: scale(0.8); }
//           }
//           @keyframes transcript-cursor-blink {
//             0%, 100% { opacity: 1; }
//             50%       { opacity: 0; }
//           }
//         `}</style>
//       </div>

//       {/* ──────────────────────────────────────────
//           우측: WorkflowPanel — 항상 flex 0 0 50%
//       ────────────────────────────────────────── */}
//       {isWorkflowOpen && (
//         <div
//           style={{
//             flex:       '0 0 50%',
//             minWidth:   0,
//             borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
//             overflow:   'hidden',
//             transition: 'flex 300ms ease',
//           }}
//         >
//           <WorkflowPanel />
//         </div>
//       )}
//     </div>
//   );
// }

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from '@/store';
import { VoiceStateIndicator } from '@/components/voice/VoiceStateIndicator';
import { MessageBubble } from './MessageBubble';
import { WorkflowPanel } from './WorkflowPanel';
import { pipelineBridge } from '@/services/pipelineBridge';

export function ConversationView() {
  /* ── store 구독 ── */
  const messages            = useStore(s => s.messages);
  const partialTranscript   = useStore(s => s.partialTranscript);
  const aiPartialTranscript = useStore(s => s.aiPartialTranscript);
  const voiceState          = useStore(s => s.voiceState);
  const isMuted             = useStore(s => s.isMuted);
  const isWorkflowOpen      = useStore(s => s.isWorkflowOpen);

  // 마이크가 실제로 열려있는 listening 상태일 때만 표시
  const isMicActive = voiceState === 'listening' && !isMuted;
  // AI 발화 스트리밍 오버레이: speaking 상태에서 aiPartialTranscript가 있을 때
  const isAiSpeaking = voiceState === 'speaking' && !!aiPartialTranscript;

  /* ── 오답 수정 콜백 ── */
  const handleResolveCorrection = useCallback((messageId: string, accepted: boolean) => {
    useStore.getState().resolveCorrection(messageId, accepted);
    if (!accepted) {
      pipelineBridge.onCorrectionRejected?.();
    }
  }, []);

  const hasMessages = messages.length > 0;
  const scrollRef   = useRef<HTMLDivElement>(null);

  /* 새 메시지 도착 시 최하단으로 스크롤 */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div
      className="conversation-view"
      style={{ display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden' }}
    >
      {/* ──────────────────────────────────────────
          좌측: 대화창
          · 워크플로우 열림: flex 0 0 50%
          · 워크플로우 닫힘: flex 1 (전체)
      ────────────────────────────────────────── */}
      <div
        style={{
          flex:          isWorkflowOpen ? '0 0 50%' : 1,
          display:       'flex',
          minWidth:      0,
          flexDirection: 'column',
          position:      'relative',
          overflow:      'hidden',
          transition:    'flex 300ms ease',
        }}
      >
        {/* 스크롤 가능한 메시지 영역 */}
        <div
          ref={scrollRef}
          className="conversation-view__messages"
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '20px 0' }}
        >
          {!hasMessages ? (
            /* 메시지 없음 — 음성 인디케이터 중앙 표시 */
            <div
              style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 56, paddingBottom: 56,
              }}
            >
              <VoiceStateIndicator />
              <p style={{ fontSize: 28, color: '#6b7280', marginTop: 20, textAlign: 'center', userSelect: 'none' }}>
                음성으로 말씀해 주세요
              </p>
            </div>
          ) : (
            <>
              {/* 메시지 있을 때 — 축소된 음성 인디케이터 */}
              <div
                style={{
                  display: 'flex', justifyContent: 'center',
                  padding: '10px 0 20px',
                  transform: 'scale(0.5)', transformOrigin: 'top center',
                  height: 170, flexShrink: 0,
                }}
              >
                <VoiceStateIndicator />
              </div>

              {/* 메시지 목록 */}
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  audioTranscript={msg.audioTranscript}
                  correction={msg.correction}
                  onResolveCorrection={
                    msg.correction?.status === 'pending'
                      ? (accepted) => handleResolveCorrection(msg.id, accepted)
                      : undefined
                  }
                />
              ))}

              <div style={{ height: 100, flexShrink: 0 }} />
            </>
          )}
        </div>

        {/* ── AI 발화 스트리밍 오버레이 (speaking + partialTranscript) ── */}
        {isAiSpeaking && (
          <div
            className="conversation-view__ai-transcript-overlay"
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '20px 32px',
              background: 'linear-gradient(transparent, rgba(255,255,255,0.97) 30%)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, justifyContent: 'center' }}>
              <span
                style={{
                  width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 6,
                  background: '#10b981',
                  animation: 'transcript-pulse 1.2s infinite',
                }}
              />
              <span style={{ fontSize: 24, color: '#065f46', fontWeight: 500, lineHeight: 1.5, wordBreak: 'keep-all' }}>
                {aiPartialTranscript}
                {/* 타이핑 커서 */}
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block', width: 2, height: '1em',
                    marginLeft: 2, verticalAlign: 'text-bottom',
                    background: '#10b981',
                    animation: 'transcript-cursor-blink 800ms step-end infinite',
                  }}
                />
              </span>
            </div>
          </div>
        )}

        {/* ── 유저 마이크 오버레이 — 마이크 활성(listening + !muted) 상태에서만 표시 ── */}
        {isMicActive && (
          <div
            className="conversation-view__transcript-overlay"
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '20px 32px',
              background: 'linear-gradient(transparent, rgba(255,255,255,0.95) 30%)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
              <span
                style={{
                  width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                  background: '#3b82f6',
                  animation: 'transcript-pulse 1.2s infinite',
                }}
              />
              <span style={{ fontSize: 24, color: '#374151', fontStyle: partialTranscript ? 'normal' : 'italic' }}>
                {partialTranscript || '듣고 있습니다...'}
              </span>
            </div>
          </div>
        )}

        <style>{`
          @keyframes transcript-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50%       { opacity: 0.4; transform: scale(0.8); }
          }
          @keyframes transcript-cursor-blink {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0; }
          }
        `}</style>
      </div>

      {/* ──────────────────────────────────────────
          우측: WorkflowPanel — 항상 flex 0 0 50%
      ────────────────────────────────────────── */}
      {isWorkflowOpen && (
        <div
          style={{
            flex:       '0 0 50%',
            minWidth:   0,
            borderLeft: '1px solid rgba(0, 0, 0, 0.08)',
            overflow:   'hidden',
            transition: 'flex 300ms ease',
          }}
        >
          <WorkflowPanel />
        </div>
      )}
    </div>
  );
}