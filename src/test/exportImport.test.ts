import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CherishingDB } from '../db/schema.ts';
import { createRepos, makeChapter } from '../db/repo.ts';
import type { Repos } from '../db/repo.ts';
import { buildBackupZip, importBackup, parseBackupZip } from '../lib/exportImport.ts';

let db: CherishingDB;
let repos: Repos;
let counter = 0;

beforeEach(async () => {
  db = new CherishingDB(`backup-${Date.now()}-${counter++}`);
  await db.open();
  repos = createRepos(db);
});

afterEach(async () => {
  await db.delete();
});

async function seed() {
  const photoId = await repos.assets.add({
    kind: 'photo',
    blob: new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' }),
    thumbBlob: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    width: 100,
    height: 80,
  });
  const audioId = await repos.assets.add({
    kind: 'audio',
    blob: new Blob([new Uint8Array([42, 42, 42])], { type: 'audio/mp4' }),
    mimeType: 'audio/mp4',
    durationMs: 4200,
  });
  const mem = await repos.memories.create({
    title: 'Beach day',
    text: 'Sun and sand',
    people: ['Nana'],
    tags: ['summer'],
    photoIds: [photoId],
    audioIds: [audioId],
    when: { label: 'Summer 1974', year: 1974 },
  });
  await repos.stories.create({ title: 'Holidays', spineHue: 40, chapters: [makeChapter(mem.id)] });
  return { photoId, audioId, memId: mem.id };
}

async function bytesOf(blob: Blob): Promise<number[]> {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

describe('backup round-trip', () => {
  it('exports and re-imports the whole library byte-for-byte', async () => {
    const { photoId, audioId } = await seed();
    const zip = await buildBackupZip(repos, 1_700_000_000_000);

    // Wipe, then restore.
    await Promise.all([db.memories.clear(), db.stories.clear(), db.assets.clear()]);
    const summary = await importBackup(repos, zip, 'replace');

    expect(summary.memories).toBe(1);
    expect(summary.stories).toBe(1);
    expect(summary.assets).toBe(2);

    const mems = await repos.memories.list();
    expect(mems).toHaveLength(1);
    expect(mems[0]!.when).toEqual({ label: 'Summer 1974', year: 1974 });
    expect(mems[0]!.people).toEqual(['Nana']);

    const photo = await repos.assets.get(photoId);
    expect(photo?.mimeType).toBe('image/jpeg');
    expect(await bytesOf(photo!.blob)).toEqual([1, 2, 3, 4, 5]);
    expect(photo?.thumbBlob).toBeTruthy();
    expect(await bytesOf(photo!.thumbBlob!)).toEqual([9, 8, 7]);

    const audio = await repos.assets.get(audioId);
    expect(audio?.mimeType).toBe('audio/mp4');
    expect(audio?.durationMs).toBe(4200);
    expect(await bytesOf(audio!.blob)).toEqual([42, 42, 42]);
  });

  it('merge mode skips items that already exist', async () => {
    await seed();
    const zip = await buildBackupZip(repos, 1_700_000_000_000);
    // Import into the SAME db without wiping — everything is a duplicate.
    const summary = await importBackup(repos, zip, 'merge');
    expect(summary.memories).toBe(0);
    expect(summary.stories).toBe(0);
    expect(summary.assets).toBe(0);
    expect(summary.skipped).toBeGreaterThan(0);
    // Still exactly one memory, not two.
    expect(await repos.memories.list()).toHaveLength(1);
  });

  it('rejects a file that is not a Cherishing backup', () => {
    const notAZip = new Uint8Array([1, 2, 3, 4]);
    expect(() => parseBackupZip(notAZip)).toThrow();
  });

  it('rejects a backup from a newer format version', async () => {
    await seed();
    const zip = await buildBackupZip(repos, 1_700_000_000_000);
    // Tamper: bump the version beyond what we support.
    const { manifest } = parseBackupZip(zip);
    manifest.formatVersion = 999;
    const { strToU8, zipSync } = await import('fflate');
    const tampered = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)) });
    expect(() => parseBackupZip(tampered)).toThrow(/newer version/i);
  });
});
