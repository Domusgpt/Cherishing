import { useEffect, useState } from 'react';
import { useBlobUrl } from '../lib/useBlobUrl.ts';
import { repos } from '../db/repo.ts';

/**
 * Renders a photo asset by id, preferring its lightweight thumbnail. Loads the
 * asset itself so callers only need to pass an id; the blob URL is managed by
 * useBlobUrl so nothing leaks.
 */
export function PhotoThumb({
  assetId,
  alt,
  full = false,
  className,
}: {
  assetId: string | undefined;
  alt: string;
  full?: boolean;
  className?: string;
}) {
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let active = true;
    setBlob(null);
    if (!assetId) return;
    repos.assets.get(assetId).then((asset) => {
      if (!active || !asset) return;
      setBlob(full ? asset.blob : (asset.thumbBlob ?? asset.blob));
    });
    return () => {
      active = false;
    };
  }, [assetId, full]);

  const url = useBlobUrl(blob);

  if (!url) {
    return <span className={`photo-thumb photo-thumb--empty ${className ?? ''}`} aria-hidden="true" />;
  }
  return <img className={`photo-thumb ${className ?? ''}`} src={url} alt={alt} loading="lazy" />;
}
