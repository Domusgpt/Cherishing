import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CherishingDB } from '../db/schema.ts';
import { createRepos, makeChapter } from '../db/repo.ts';
import type { Repos } from '../db/repo.ts';

let db: CherishingDB;
let repos: Repos;
let counter = 0;

beforeEach(async () => {
  // A fresh, uniquely-named database per test for full isolation.
  db = new CherishingDB(`test-${Date.now()}-${counter++}`);
  await db.open();
  repos = createRepos(db);
});

afterEach(async () => {
  await db.delete();
});

function fakeBlob(text = 'x'): Blob {
  return new Blob([text], { type: 'application/octet-stream' });
}

describe('memories', () => {
  it('creates a memory with trimmed, de-duplicated people and tags', async () => {
    const mem = await repos.memories.create({
      title: '  Beach trip  ',
      text: 'A lovely day',
      people: ['Nana', 'nana', ' Grandpa '],
      tags: ['summer', 'Summer', 'beach'],
    });
    expect(mem.title).toBe('Beach trip');
    expect(mem.people).toEqual(['Nana', 'Grandpa']);
    expect(mem.tags).toEqual(['summer', 'beach']);
    expect(await repos.memories.get(mem.id)).toBeTruthy();
  });

  it('lists memories most-recently-updated first', async () => {
    const a = await repos.memories.create({ title: 'First' });
    const b = await repos.memories.create({ title: 'Second' });
    await repos.memories.update(a.id, { title: 'First edited' });
    const list = await repos.memories.list();
    expect(list.map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it('deletes a memory, its assets, and prunes referencing chapters', async () => {
    const photoId = await repos.assets.add({ kind: 'photo', blob: fakeBlob('img'), mimeType: 'image/jpeg' });
    const audioId = await repos.assets.add({ kind: 'audio', blob: fakeBlob('snd'), mimeType: 'audio/mp4' });
    const mem = await repos.memories.create({ title: 'Has media', photoIds: [photoId], audioIds: [audioId] });
    const other = await repos.memories.create({ title: 'Survivor' });

    const story = await repos.stories.create({
      title: 'Mixed',
      coverPhotoId: photoId,
      chapters: [makeChapter(mem.id), makeChapter(other.id)],
    });

    await repos.memories.remove(mem.id);

    expect(await repos.memories.get(mem.id)).toBeUndefined();
    expect(await repos.assets.get(photoId)).toBeUndefined();
    expect(await repos.assets.get(audioId)).toBeUndefined();

    const updated = await repos.stories.get(story.id);
    expect(updated?.chapters).toHaveLength(1);
    expect(updated?.chapters[0]?.memoryId).toBe(other.id);
    // Cover photo pointed at the deleted memory's asset, so it was cleared.
    expect(updated?.coverPhotoId).toBeUndefined();
  });

  it('deleting a story leaves memories and assets untouched', async () => {
    const photoId = await repos.assets.add({ kind: 'photo', blob: fakeBlob(), mimeType: 'image/jpeg' });
    const mem = await repos.memories.create({ title: 'Kept', photoIds: [photoId] });
    const story = await repos.stories.create({ title: 'Doomed', chapters: [makeChapter(mem.id)] });

    await repos.stories.remove(story.id);

    expect(await repos.stories.get(story.id)).toBeUndefined();
    expect(await repos.memories.get(mem.id)).toBeTruthy();
    expect(await repos.assets.get(photoId)).toBeTruthy();
  });
});

describe('index queries', () => {
  it('finds memories by tag and by person', async () => {
    await repos.memories.create({ title: 'A', tags: ['holiday'], people: ['Mum'] });
    await repos.memories.create({ title: 'B', tags: ['holiday', 'beach'], people: ['Dad'] });
    await repos.memories.create({ title: 'C', tags: ['school'], people: ['Mum'] });

    const holiday = await db.memories.where('tags').equals('holiday').toArray();
    expect(holiday.map((m) => m.title).sort()).toEqual(['A', 'B']);

    const mum = await db.memories.where('people').equals('Mum').toArray();
    expect(mum.map((m) => m.title).sort()).toEqual(['A', 'C']);
  });
});

describe('stories', () => {
  it('persists chapter reordering', async () => {
    const m1 = await repos.memories.create({ title: 'One' });
    const m2 = await repos.memories.create({ title: 'Two' });
    const story = await repos.stories.create({
      title: 'Order',
      chapters: [makeChapter(m1.id), makeChapter(m2.id)],
    });
    const reversed = [...story.chapters].reverse();
    await repos.stories.update(story.id, { chapters: reversed });
    const reloaded = await repos.stories.get(story.id);
    expect(reloaded?.chapters.map((c) => c.memoryId)).toEqual([m2.id, m1.id]);
  });

  it('defaults an empty title and assigns a spine hue', async () => {
    const story = await repos.stories.create({ title: '   ' });
    expect(story.title).toBe('Untitled story');
    expect(story.spineHue).toBeGreaterThanOrEqual(0);
    expect(story.spineHue).toBeLessThan(360);
  });
});

describe('settings kv', () => {
  it('stores and clears arbitrary values', async () => {
    await repos.settings.set('draft', { step: 2, title: 'WIP' });
    expect(await repos.settings.get<{ step: number }>('draft')).toEqual({ step: 2, title: 'WIP' });
    await repos.settings.remove('draft');
    expect(await repos.settings.get('draft')).toBeUndefined();
  });
});
