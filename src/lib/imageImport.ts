/**
 * Photo import: decode a user's file, correct EXIF orientation, and downscale
 * to keep IndexedDB from ballooning. Produces a full-size (but bounded) JPEG
 * plus a small thumbnail used in library grids so we never decode full images
 * just to draw a card.
 */

export const MAX_LONG_EDGE = 2048;
export const THUMB_LONG_EDGE = 320;
export const JPEG_QUALITY = 0.85;

export interface ImportedImage {
  blob: Blob;
  thumbBlob: Blob;
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Pure sizing math — extracted so it can be unit-tested without a canvas.
 * Scales (w, h) down so the longest edge is at most `maxLongEdge`, never up.
 */
export function computeTargetSize(
  w: number,
  h: number,
  maxLongEdge: number,
): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const longEdge = Math.max(w, h);
  if (longEdge <= maxLongEdge) return { width: Math.round(w), height: Math.round(h) };
  const scale = maxLongEdge / longEdge;
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/** Decode a file to an ImageBitmap with EXIF orientation applied where supported. */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older browsers may not support the options bag; fall through.
    }
  }
  // Fallback: <img> decode via object URL (modern browsers auto-orient EXIF).
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function dimsOf(src: ImageBitmap | HTMLImageElement): { w: number; h: number } {
  if ('width' in src && 'naturalWidth' in src) {
    const img = src as HTMLImageElement;
    return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
  }
  const bmp = src as ImageBitmap;
  return { w: bmp.width, h: bmp.height };
}

function drawToBlob(
  src: ImageBitmap | HTMLImageElement,
  target: { width: number; height: number },
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a drawing context for this photo.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, target.width, target.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process this photo.'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/** Import one image file into a bounded JPEG + thumbnail. Throws on failure. */
export async function importImageFile(file: File): Promise<ImportedImage> {
  const src = await decode(file);
  const { w, h } = dimsOf(src);
  if (!w || !h) throw new Error('This file did not look like a photo.');

  const full = computeTargetSize(w, h, MAX_LONG_EDGE);
  const thumb = computeTargetSize(w, h, THUMB_LONG_EDGE);
  const [blob, thumbBlob] = await Promise.all([drawToBlob(src, full), drawToBlob(src, thumb)]);

  if ('close' in src && typeof src.close === 'function') src.close();

  return { blob, thumbBlob, width: full.width, height: full.height, mimeType: 'image/jpeg' };
}

/**
 * Import several files, keeping going if some fail (e.g. a HEIC file on a
 * browser that can't decode it). Returns successes plus a count of failures
 * so the UI can say "1 photo couldn't be added" without losing the rest.
 */
export async function importImageFiles(
  files: File[],
): Promise<{ images: ImportedImage[]; failed: number }> {
  const images: ImportedImage[] = [];
  let failed = 0;
  for (const file of files) {
    try {
      images.push(await importImageFile(file));
    } catch {
      failed++;
    }
  }
  return { images, failed };
}
