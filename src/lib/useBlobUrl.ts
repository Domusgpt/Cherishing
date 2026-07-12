import { useEffect, useState } from 'react';

/**
 * The single chokepoint for turning a Blob into a displayable object URL.
 * Creates the URL on mount / when the blob changes and revokes it on cleanup,
 * so grids and playback never leak object URLs no matter how often they
 * re-render. Returns undefined when there is no blob.
 */
export function useBlobUrl(blob: Blob | null | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return url;
}
