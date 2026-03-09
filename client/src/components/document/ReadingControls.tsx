/**
 * ReadingControls - Playback controls for document voice reading.
 * Play/pause, speed control, field navigation, reading mode selector.
 */

import { useStore } from '@/store';
import type { ReadingMode } from '@shared/types/document';

const READING_MODES: { mode: ReadingMode; label: string; desc: string }[] = [
  { mode: 'full', label: '전체 읽기', desc: '모든 항목을 순서대로 읽습니다' },
  { mode: 'highlights', label: '핵심 항목', desc: '중요한 항목만 읽습니다' },
  { mode: 'field_select', label: '항목 선택', desc: '원하는 항목을 선택하세요' },
];

export function ReadingControls() {
  const readingState = useStore(s => s.readingState);
  const setReadingMode = useStore(s => s.setReadingMode);
  const setReadingPlaying = useStore(s => s.setReadingPlaying);
  const setReadingSpeed = useStore(s => s.setReadingSpeed);
  const nextField = useStore(s => s.nextField);
  const prevField = useStore(s => s.prevField);

  return (
    <div className="reading-controls" role="toolbar" aria-label="읽기 제어">
      {/* Reading mode selector */}
      <div className="reading-controls__modes" role="radiogroup" aria-label="읽기 모드">
        {READING_MODES.map(({ mode, label, desc }) => (
          <button
            key={mode}
            className={`reading-mode-btn ${readingState.mode === mode ? 'reading-mode-btn--active' : ''}`}
            role="radio"
            aria-checked={readingState.mode === mode}
            aria-label={desc}
            onClick={() => setReadingMode(mode)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Playback controls */}
      <div className="reading-controls__playback">
        <button
          className="reading-btn reading-btn--prev"
          onClick={prevField}
          disabled={readingState.currentFieldIndex === 0}
          aria-label="이전 항목"
        >
          ◀
        </button>

        <button
          className="reading-btn reading-btn--play"
          onClick={() => setReadingPlaying(!readingState.isPlaying)}
          aria-label={readingState.isPlaying ? '일시정지' : '재생'}
        >
          {readingState.isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className="reading-btn reading-btn--next"
          onClick={nextField}
          disabled={readingState.currentFieldIndex >= readingState.totalFields - 1}
          aria-label="다음 항목"
        >
          ▶
        </button>
      </div>

      {/* Speed control */}
      <div className="reading-controls__speed">
        <label htmlFor="speed-control">속도</label>
        <input
          id="speed-control"
          type="range"
          min={0.5}
          max={2.0}
          step={0.25}
          value={readingState.speed}
          onChange={(e) => setReadingSpeed(parseFloat(e.target.value))}
          aria-label={`읽기 속도 ${readingState.speed}배`}
        />
        <span>{readingState.speed}x</span>
      </div>

      {/* Progress */}
      <div className="reading-controls__progress">
        <span>
          {readingState.currentFieldIndex + 1} / {readingState.totalFields}
        </span>
        <div
          className="reading-progress-bar"
          role="progressbar"
          aria-valuenow={readingState.currentFieldIndex + 1}
          aria-valuemin={1}
          aria-valuemax={readingState.totalFields}
        >
          <div
            className="reading-progress-bar__fill"
            style={{
              width: readingState.totalFields > 0
                ? `${((readingState.currentFieldIndex + 1) / readingState.totalFields) * 100}%`
                : '0%',
            }}
          />
        </div>
      </div>
    </div>
  );
}
