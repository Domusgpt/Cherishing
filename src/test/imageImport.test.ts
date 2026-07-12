import { describe, expect, it } from 'vitest';
import { computeTargetSize, MAX_LONG_EDGE, THUMB_LONG_EDGE } from '../lib/imageImport.ts';

describe('computeTargetSize', () => {
  it('leaves small images untouched', () => {
    expect(computeTargetSize(800, 600, MAX_LONG_EDGE)).toEqual({ width: 800, height: 600 });
  });

  it('scales a wide image so the long edge fits, preserving aspect ratio', () => {
    const out = computeTargetSize(4000, 3000, MAX_LONG_EDGE);
    expect(out.width).toBe(2048);
    expect(out.height).toBe(1536);
  });

  it('scales a tall image by its height', () => {
    const out = computeTargetSize(3000, 4000, MAX_LONG_EDGE);
    expect(out.height).toBe(2048);
    expect(out.width).toBe(1536);
  });

  it('produces small thumbnails', () => {
    const out = computeTargetSize(4000, 2000, THUMB_LONG_EDGE);
    expect(Math.max(out.width, out.height)).toBe(320);
    expect(out.height).toBe(160);
  });

  it('never upscales and never returns a zero edge for valid input', () => {
    expect(computeTargetSize(100, 100, MAX_LONG_EDGE)).toEqual({ width: 100, height: 100 });
    const tiny = computeTargetSize(10000, 1, THUMB_LONG_EDGE);
    expect(tiny.height).toBeGreaterThanOrEqual(1);
  });

  it('handles degenerate sizes gracefully', () => {
    expect(computeTargetSize(0, 0, MAX_LONG_EDGE)).toEqual({ width: 0, height: 0 });
  });
});
