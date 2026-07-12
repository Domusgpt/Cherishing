/**
 * Voice recording built on MediaRecorder. Browsers disagree on the format they
 * can record (iOS Safari only does audio/mp4), so we negotiate a supported mime
 * type and store the recorder's ACTUAL mime type on the resulting recording —
 * that value is saved on the asset so playback and cross-device restore work.
 */

const CANDIDATE_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

export interface Recording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return CANDIDATE_TYPES.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

export function isRecordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * A small controller around one recording session. Call start() from a user
 * gesture so the microphone permission prompt appears; stop() resolves with the
 * finished recording and releases the mic.
 */
export class VoiceRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  async start(): Promise<void> {
    if (!isRecordingSupported()) {
      throw new Error('Recording is not supported on this device.');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.addEventListener('dataavailable', (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    });
    this.startedAt = performance.now();
    this.recorder.start();
  }

  get isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }

  /** Stop, releasing the microphone, and resolve with the recording. */
  stop(): Promise<Recording> {
    return new Promise((resolve, reject) => {
      const recorder = this.recorder;
      if (!recorder) {
        reject(new Error('Not recording.'));
        return;
      }
      recorder.addEventListener(
        'stop',
        () => {
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type: mimeType });
          const elapsed = Math.round(performance.now() - this.startedAt);
          this.release();
          resolve({ blob, mimeType, durationMs: elapsed });
        },
        { once: true },
      );
      try {
        recorder.stop();
      } catch (err) {
        this.release();
        reject(err instanceof Error ? err : new Error('Could not stop recording.'));
      }
    });
  }

  /** Abandon a recording and free the microphone without producing a blob. */
  cancel(): void {
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch {
      /* ignore */
    }
    this.release();
  }

  private release(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
  }
}

/**
 * Measure an audio blob's duration. Works around the Chrome bug where a fresh
 * MediaRecorder blob reports duration === Infinity until you seek past the end.
 */
export function measureAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';

    const cleanup = () => URL.revokeObjectURL(url);
    const done = (seconds: number) => {
      cleanup();
      resolve(Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0);
    };

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration === Infinity) {
        // Nudge the current time to force the real duration to resolve.
        audio.currentTime = Number.MAX_SAFE_INTEGER;
        audio.addEventListener('timeupdate', () => done(audio.duration), { once: true });
      } else {
        done(audio.duration);
      }
    });
    audio.addEventListener('error', () => done(0), { once: true });
    audio.src = url;
  });
}
