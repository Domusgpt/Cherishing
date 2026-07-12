import { describe, expect, it } from 'vitest';
import {
  BASE_SLIDE_MS,
  PER_EXTRA_PHOTO_MS,
  buildTimeline,
  kenBurnsVariant,
  slideDuration,
} from '../lib/playback.ts';
import type { MediaAsset, Memory, Story } from '../db/schema.ts';

function memory(partial: Partial<Memory> & { id: string }): Memory {
  return {
    id: partial.id,
    title: partial.title ?? 'Untitled',
    text: partial.text ?? '',
    people: partial.people ?? [],
    tags: partial.tags ?? [],
    photoIds: partial.photoIds ?? [],
    audioIds: partial.audioIds ?? [],
    createdAt: 0,
    updatedAt: 0,
    ...(partial.when ? { when: partial.when } : {}),
  };
}

function asset(id: string, partial: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id,
    kind: partial.kind ?? 'photo',
    blob: new Blob(['x']),
    mimeType: partial.mimeType ?? 'image/jpeg',
    createdAt: 0,
    ...partial,
  };
}

function story(chapters: Story['chapters']): Story {
  return { id: 's1', title: 'Story', spineHue: 10, chapters, createdAt: 0, updatedAt: 0 };
}

describe('buildTimeline', () => {
  it('returns an empty timeline for a story with no chapters', () => {
    expect(buildTimeline(story([]), new Map(), new Map())).toEqual([]);
  });

  it('skips chapters whose memory is missing', () => {
    const mems = new Map([['m1', memory({ id: 'm1', title: 'Kept' })]]);
    const s = story([
      { id: 'c1', memoryId: 'm1' },
      { id: 'c2', memoryId: 'gone' },
    ]);
    const timeline = buildTimeline(s, mems, new Map());
    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.title).toBe('Kept');
  });

  it('resolves photos and audio, dropping references to missing assets', () => {
    const mems = new Map([
      ['m1', memory({ id: 'm1', photoIds: ['p1', 'pMissing'], audioIds: ['aMissing', 'a1'] })],
    ]);
    const assets = new Map([
      ['p1', asset('p1')],
      ['a1', asset('a1', { kind: 'audio', mimeType: 'audio/mp4', durationMs: 8000 })],
    ]);
    const timeline = buildTimeline(story([{ id: 'c1', memoryId: 'm1' }]), mems, assets);
    expect(timeline[0]!.photoAssetIds).toEqual(['p1']);
    expect(timeline[0]!.audioAssetId).toBe('a1');
  });

  it('lets audio length win over photo-based timing', () => {
    const mems = new Map([['m1', memory({ id: 'm1', photoIds: ['p1'], audioIds: ['a1'] })]]);
    const assets = new Map([
      ['p1', asset('p1')],
      ['a1', asset('a1', { kind: 'audio', durationMs: 12000 })],
    ]);
    const timeline = buildTimeline(story([{ id: 'c1', memoryId: 'm1' }]), mems, assets);
    expect(timeline[0]!.durationMs).toBe(12000);
  });

  it('carries the chapter caption through', () => {
    const mems = new Map([['m1', memory({ id: 'm1' })]]);
    const timeline = buildTimeline(
      story([{ id: 'c1', memoryId: 'm1', caption: 'The big day' }]),
      mems,
      new Map(),
    );
    expect(timeline[0]!.caption).toBe('The big day');
  });
});

describe('slideDuration', () => {
  it('uses the base time for a single photo and no audio', () => {
    expect(slideDuration(undefined, undefined, 1)).toBe(BASE_SLIDE_MS);
  });

  it('adds time per extra photo', () => {
    expect(slideDuration(undefined, undefined, 3)).toBe(BASE_SLIDE_MS + 2 * PER_EXTRA_PHOTO_MS);
  });

  it('honors an explicit hold when there is no audio', () => {
    expect(slideDuration(9000, undefined, 1)).toBe(9000);
  });

  it('prefers audio duration over an explicit hold', () => {
    const audio = asset('a', { kind: 'audio', durationMs: 15000 });
    expect(slideDuration(9000, audio, 2)).toBe(15000);
  });

  it('never returns less than the minimum', () => {
    const audio = asset('a', { kind: 'audio', durationMs: 500 });
    expect(slideDuration(undefined, audio, 0)).toBeGreaterThanOrEqual(3000);
  });
});

describe('kenBurnsVariant', () => {
  it('cycles through four presets', () => {
    expect([0, 1, 2, 3, 4, 5].map(kenBurnsVariant)).toEqual([0, 1, 2, 3, 0, 1]);
  });
});
