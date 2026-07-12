import { useEffect, useState } from 'react';
import { useBlobUrl } from '../lib/useBlobUrl.ts';
import { repos } from '../db/repo.ts';
import type { MediaAsset } from '../db/schema.ts';
import './AudioPlayer.css';

/** Plays a saved voice recording by asset id, using the native audio controls. */
export function AudioPlayer({ assetId, label }: { assetId: string; label?: string }) {
  const [asset, setAsset] = useState<MediaAsset | null>(null);

  useEffect(() => {
    let active = true;
    repos.assets.get(assetId).then((a) => active && setAsset(a ?? null));
    return () => {
      active = false;
    };
  }, [assetId]);

  const url = useBlobUrl(asset?.blob);

  return (
    <div className="audio-player">
      <span className="audio-player__icon" aria-hidden="true">
        🎙
      </span>
      <div className="audio-player__body">
        {label && <span className="audio-player__label">{label}</span>}
        {url ? (
          // The stored mimeType (e.g. audio/mp4 from iOS) drives correct playback.
          <audio controls preload="metadata" src={url} className="audio-player__el">
            Your browser cannot play this recording.
          </audio>
        ) : (
          <span className="muted">Loading recording…</span>
        )}
      </div>
    </div>
  );
}
