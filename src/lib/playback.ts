import type { MediaAsset, Memory, Story } from '../db/schema.ts';

/**
 * Pure playback planning. Turns a story into a flat list of slides with
 * per-slide durations, resolving asset references and skipping any that dangle.
 * Kept free of React/DOM so it can be unit-tested directly.
 */

export interface Slide {
  chapterId: string;
  memoryId: string;
  title: string;
  caption?: string;
  text: string;
  photoAssetIds: string[];
  audioAssetId?: string;
  durationMs: number;
}

export const BASE_SLIDE_MS = 6000;
export const PER_EXTRA_PHOTO_MS = 2500;
export const MIN_SLIDE_MS = 3000;

export function buildTimeline(
  story: Story,
  memoriesById: Map<string, Memory>,
  assetsById: Map<string, MediaAsset>,
): Slide[] {
  const slides: Slide[] = [];

  for (const chapter of story.chapters) {
    const memory = memoriesById.get(chapter.memoryId);
    if (!memory) continue; // dangling reference — skip defensively

    const photoAssetIds = memory.photoIds.filter((id) => assetsById.has(id));
    const audioAssetId = memory.audioIds.find((id) => assetsById.has(id));
    const audio = audioAssetId ? assetsById.get(audioAssetId) : undefined;

    const durationMs = slideDuration(chapter.holdMs, audio, photoAssetIds.length);

    slides.push({
      chapterId: chapter.id,
      memoryId: memory.id,
      title: memory.title,
      ...(chapter.caption ? { caption: chapter.caption } : {}),
      text: memory.text,
      photoAssetIds,
      ...(audioAssetId ? { audioAssetId } : {}),
      durationMs,
    });
  }

  return slides;
}

/**
 * How long a slide holds on screen:
 *  1. If it has audio with a known length, match the audio (the audio element
 *     actually drives advance during playback; this is the planning estimate).
 *  2. Else an explicit per-chapter hold, if set.
 *  3. Else a base time plus a little extra per additional photo.
 */
export function slideDuration(
  holdMs: number | undefined,
  audio: MediaAsset | undefined,
  photoCount: number,
): number {
  if (audio?.durationMs && audio.durationMs > 0) {
    return Math.max(MIN_SLIDE_MS, audio.durationMs);
  }
  if (holdMs && holdMs > 0) {
    return Math.max(MIN_SLIDE_MS, holdMs);
  }
  const extras = Math.max(0, photoCount - 1);
  return BASE_SLIDE_MS + extras * PER_EXTRA_PHOTO_MS;
}

/** Which Ken Burns preset a slide uses (0–3), by position. */
export function kenBurnsVariant(index: number): 0 | 1 | 2 | 3 {
  return (((index % 4) + 4) % 4) as 0 | 1 | 2 | 3;
}
