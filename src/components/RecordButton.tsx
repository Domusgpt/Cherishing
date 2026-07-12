import { useEffect, useRef, useState } from 'react';
import { ChunkyButton } from './ChunkyButton.tsx';
import {
  VoiceRecorder,
  isRecordingSupported,
  measureAudioDuration,
} from '../lib/audioRecorder.ts';
import type { Recording } from '../lib/audioRecorder.ts';
import { useBlobUrl } from '../lib/useBlobUrl.ts';
import './RecordButton.css';

type Phase = 'idle' | 'recording' | 'review';

/**
 * Record-a-voice control with a review-before-keep step. Recording begins from
 * a tap (so the permission prompt is tied to a gesture), shows a live timer via
 * aria-live, and hands the finished recording up only when the user confirms.
 */
export function RecordButton({ onSave }: { onSave: (rec: Recording) => void }) {
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Recording | null>(null);
  const timerRef = useRef<number | null>(null);

  const reviewUrl = useBlobUrl(pending?.blob);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      recorderRef.current?.cancel();
    };
  }, []);

  if (!isRecordingSupported()) {
    return (
      <p className="record__unsupported muted">
        Recording isn't available on this device or browser. You can still write the story instead.
      </p>
    );
  }

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  async function handleStart() {
    setError(null);
    const recorder = new VoiceRecorder();
    recorderRef.current = recorder;
    try {
      await recorder.start();
      setPhase('recording');
      startTimer();
    } catch {
      setError("We couldn't reach your microphone. You can still type the story instead.");
      recorderRef.current = null;
    }
  }

  async function handleStop() {
    stopTimer();
    const recorder = recorderRef.current;
    if (!recorder) return;
    try {
      const rec = await recorder.stop();
      const durationMs = rec.durationMs || (await measureAudioDuration(rec.blob));
      setPending({ ...rec, durationMs });
      setPhase('review');
    } catch {
      setError('Something went wrong while saving the recording. Please try again.');
      setPhase('idle');
    } finally {
      recorderRef.current = null;
    }
  }

  function handleRedo() {
    setPending(null);
    setPhase('idle');
  }

  function handleKeep() {
    if (pending) onSave(pending);
    setPending(null);
    setPhase('idle');
  }

  return (
    <div className="record">
      {error && (
        <p className="record__error" role="alert">
          {error}
        </p>
      )}

      {phase === 'idle' && (
        <button className="record__mic" type="button" onClick={handleStart} aria-label="Start recording">
          <span className="record__mic-glyph" aria-hidden="true">
            ●
          </span>
          <span className="record__mic-text">Tap to record</span>
        </button>
      )}

      {phase === 'recording' && (
        <div className="record__live">
          <button
            className="record__mic record__mic--live"
            type="button"
            onClick={handleStop}
            aria-label="Stop recording"
          >
            <span className="record__mic-glyph" aria-hidden="true">
              ■
            </span>
            <span className="record__mic-text">Tap to stop</span>
          </button>
          <p className="record__timer" role="status" aria-live="polite">
            Recording… {formatTime(elapsed)}
          </p>
        </div>
      )}

      {phase === 'review' && pending && (
        <div className="record__review stack-sm">
          <p className="record__timer">Recorded {formatTime(Math.round(pending.durationMs / 1000))}</p>
          {reviewUrl && <audio controls src={reviewUrl} className="record__playback" />}
          <div className="row">
            <ChunkyButton variant="primary" onClick={handleKeep}>
              Keep this recording
            </ChunkyButton>
            <ChunkyButton onClick={handleRedo}>Try again</ChunkyButton>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
