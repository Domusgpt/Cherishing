import { useCallback, useEffect, useRef, useState } from 'react';
import { repos } from '../db/repo.ts';
import type { MediaAsset, Memory } from '../db/schema.ts';
import { buildTimeline, kenBurnsVariant } from '../lib/playback.ts';
import type { Slide } from '../lib/playback.ts';
import { CrtFrame } from '../components/CrtFrame.tsx';
import { ChunkyButton } from '../components/ChunkyButton.tsx';
import { useBlobUrl } from '../lib/useBlobUrl.ts';
import { useSettings } from '../context/SettingsContext.tsx';
import { navigate } from '../router/router.tsx';
import './PlaybackScreen.css';

type LoadState = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; title: string; timeline: Slide[] };

export function PlaybackScreen({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    (async () => {
      const story = await repos.stories.get(id);
      if (!story) {
        if (active) setState({ status: 'missing' });
        return;
      }
      const memIds = Array.from(new Set(story.chapters.map((c) => c.memoryId)));
      const mems = (await repos.db.memories.bulkGet(memIds)).filter((m): m is Memory => m != null);
      const memoriesById = new Map<string, Memory>(mems.map((m) => [m.id, m]));
      const assetIds = new Set<string>();
      for (const m of mems) {
        for (const p of m.photoIds) assetIds.add(p);
        for (const a of m.audioIds) assetIds.add(a);
      }
      const assets = await repos.assets.getMany(Array.from(assetIds));
      const assetsById = new Map<string, MediaAsset>(assets.map((a) => [a.id, a]));
      const timeline = buildTimeline(story, memoriesById, assetsById);
      if (active) setState({ status: 'ready', title: story.title, timeline });
    })();
    return () => {
      active = false;
    };
  }, [id]);

  if (state.status === 'loading') {
    return <PlaybackShell><p className="playback__msg">Loading…</p></PlaybackShell>;
  }
  if (state.status === 'missing') {
    return (
      <PlaybackShell>
        <div className="playback__msg stack center">
          <p>We couldn't find that story.</p>
          <ChunkyButton variant="primary" onClick={() => navigate('/')}>Back to shelf</ChunkyButton>
        </div>
      </PlaybackShell>
    );
  }
  if (state.timeline.length === 0) {
    return (
      <PlaybackShell>
        <div className="playback__msg stack center">
          <p>This story has nothing to play yet. Add some memories to it first.</p>
          <ChunkyButton variant="primary" onClick={() => navigate(`/stories/${id}/edit`)}>
            Edit this story
          </ChunkyButton>
        </div>
      </PlaybackShell>
    );
  }

  return <Player title={state.title} timeline={state.timeline} onExit={() => navigate('/')} />;
}

function PlaybackShell({ children }: { children: React.ReactNode }) {
  return <div className="playback">{children}</div>;
}

function Player({ title, timeline, onExit }: { title: string; timeline: Slide[]; onExit: () => void }) {
  const { reducedMotion } = useSettings();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'paused' | 'ended'>('playing');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const slide = timeline[index]!;

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i + 1 < timeline.length) return i + 1;
      setPhase('ended');
      return i;
    });
  }, [timeline.length]);

  const goPrev = useCallback(() => {
    setPhase('playing');
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const restart = useCallback(() => {
    setIndex(0);
    setPhase('playing');
  }, []);

  const togglePlay = useCallback(() => {
    setPhase((p) => {
      if (p === 'ended') {
        setIndex(0);
        return 'playing';
      }
      return p === 'playing' ? 'paused' : 'playing';
    });
  }, []);

  // Load the current slide's audio (if any) as a blob URL.
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let active = true;
    setAudioBlob(null);
    if (!slide.audioAssetId) return;
    repos.assets.get(slide.audioAssetId).then((a) => active && setAudioBlob(a?.blob ?? null));
    return () => {
      active = false;
    };
  }, [slide.audioAssetId]);
  const audioUrl = useBlobUrl(audioBlob);

  // Advance timer. For audio slides this is a backstop; audio's onended is the
  // primary signal. For photo/text slides it's the sole driver.
  useEffect(() => {
    if (phase !== 'playing') return;
    const ms = slide.audioAssetId ? slide.durationMs + 4000 : slide.durationMs;
    const t = window.setTimeout(goNext, ms);
    return () => window.clearTimeout(t);
  }, [index, phase, slide.audioAssetId, slide.durationMs, goNext]);

  // Drive the audio element in step with play/pause.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (phase === 'playing' && audioUrl) {
      el.currentTime = 0;
      void el.play().catch(() => {
        /* autoplay blocked mid-story is unlikely once started; timer covers it */
      });
    } else {
      el.pause();
    }
  }, [audioUrl, phase, index]);

  // Keyboard controls.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Escape') onExit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, togglePlay, onExit]);

  const ended = phase === 'ended';

  return (
    <div className="playback">
      <div className="playback__bar">
        <button className="playback__exit" onClick={onExit} aria-label="Close and go back to the shelf">
          ✕ Close
        </button>
        <span className="playback__title">{title}</span>
        <span className="playback__counter" aria-live="polite">
          {index + 1} of {timeline.length}
        </span>
      </div>

      <CrtFrame>
        <SlideStage slide={slide} playing={phase === 'playing'} reducedMotion={reducedMotion} />
        {ended && (
          <div className="playback__end">
            <p className="playback__end-title">The End</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <ChunkyButton variant="primary" onClick={restart} icon="↺">
                Watch again
              </ChunkyButton>
              <ChunkyButton onClick={onExit}>Back to shelf</ChunkyButton>
            </div>
          </div>
        )}
      </CrtFrame>

      {slide.audioAssetId && audioUrl && (
        <audio ref={audioRef} src={audioUrl} onEnded={goNext} className="sr-only" />
      )}

      <div className="playback__controls" role="group" aria-label="Playback controls">
        <button className="vcr" onClick={goPrev} disabled={index === 0} aria-label="Previous chapter">
          ⏮
        </button>
        <button className="vcr vcr--play" onClick={togglePlay} aria-label={phase === 'playing' ? 'Pause' : 'Play'}>
          {phase === 'playing' ? '⏸' : '▶'}
        </button>
        <button
          className="vcr"
          onClick={goNext}
          disabled={index >= timeline.length - 1 && !ended}
          aria-label="Next chapter"
        >
          ⏭
        </button>
      </div>

      <div className="playback__progress" aria-hidden="true">
        <div
          className="playback__progress-fill"
          style={{ width: `${((index + 1) / timeline.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

function SlideStage({
  slide,
  playing,
  reducedMotion,
}: {
  slide: Slide;
  playing: boolean;
  reducedMotion: boolean;
}) {
  return (
    <div className="stage">
      <PhotoLayer
        photoAssetIds={slide.photoAssetIds}
        durationMs={slide.durationMs}
        playing={playing}
        reducedMotion={reducedMotion}
      />
      {slide.photoAssetIds.length === 0 && (
        <div className="stage__textonly">
          <p className="stage__bigtext">{slide.text || slide.title}</p>
        </div>
      )}
      {(slide.caption || slide.title) && (
        <div className="stage__caption">
          <span className="stage__caption-title">{slide.title}</span>
          {slide.caption && <span className="stage__caption-sub">{slide.caption}</span>}
        </div>
      )}
    </div>
  );
}

function PhotoLayer({
  photoAssetIds,
  durationMs,
  playing,
  reducedMotion,
}: {
  photoAssetIds: string[];
  durationMs: number;
  playing: boolean;
  reducedMotion: boolean;
}) {
  const [active, setActive] = useState(0);

  // Cycle through multiple photos evenly across the slide's duration.
  useEffect(() => {
    setActive(0);
    if (!playing || photoAssetIds.length <= 1) return;
    const per = Math.max(1200, durationMs / photoAssetIds.length);
    const t = window.setInterval(() => {
      setActive((a) => (a + 1) % photoAssetIds.length);
    }, per);
    return () => window.clearInterval(t);
  }, [photoAssetIds, durationMs, playing]);

  if (photoAssetIds.length === 0) return null;

  return (
    <div className="photo-layer">
      {photoAssetIds.map((assetId, i) => (
        <PlaybackPhoto
          key={assetId}
          assetId={assetId}
          visible={i === active}
          variant={kenBurnsVariant(i)}
          reducedMotion={reducedMotion}
        />
      ))}
    </div>
  );
}

function PlaybackPhoto({
  assetId,
  visible,
  variant,
  reducedMotion,
}: {
  assetId: string;
  visible: boolean;
  variant: 0 | 1 | 2 | 3;
  reducedMotion: boolean;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let active = true;
    repos.assets.get(assetId).then((a) => active && setBlob(a?.blob ?? null));
    return () => {
      active = false;
    };
  }, [assetId]);
  const url = useBlobUrl(blob);
  if (!url) return null;
  const cls = `playback-photo ${visible ? 'is-visible' : ''} ${
    reducedMotion ? '' : `kb kb--${variant}`
  }`;
  return <img className={cls} src={url} alt="" />;
}
