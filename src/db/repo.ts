import { db as sharedDb } from './schema.ts';
import type { CherishingDB, Chapter, MediaAsset, Memory, Story } from './schema.ts';
import { newId } from '../lib/id.ts';

/**
 * Data-access layer. Built as a factory over a Dexie instance so tests can run
 * against a fresh in-memory database. The app uses `repos` bound to the shared
 * singleton.
 *
 * Integrity rules enforced here:
 *  - Deleting a memory also deletes its assets and prunes any chapters that
 *    referenced it from every story (all in one transaction).
 *  - Deleting a story never touches memories or assets.
 * Readers still tolerate dangling references defensively.
 */

const now = () => Date.now();

export interface NewMemoryInput {
  title: string;
  text?: string;
  when?: Memory['when'];
  people?: string[];
  tags?: string[];
  photoIds?: string[];
  audioIds?: string[];
}

export function createRepos(db: CherishingDB) {
  const memories = {
    async list(): Promise<Memory[]> {
      const all = await db.memories.toArray();
      return all.sort(byRecency);
    },

    get(id: string): Promise<Memory | undefined> {
      return db.memories.get(id);
    },

    async create(input: NewMemoryInput): Promise<Memory> {
      const ts = now();
      const memory: Memory = {
        id: newId('mem'),
        title: input.title.trim(),
        text: input.text ?? '',
        ...(input.when ? { when: input.when } : {}),
        people: dedupeTrimmed(input.people),
        tags: dedupeTrimmed(input.tags),
        photoIds: input.photoIds ?? [],
        audioIds: input.audioIds ?? [],
        createdAt: ts,
        updatedAt: ts,
      };
      await db.memories.add(memory);
      return memory;
    },

    async update(id: string, patch: Partial<Omit<Memory, 'id' | 'createdAt'>>): Promise<void> {
      await db.memories.update(id, { ...patch, updatedAt: now() });
    },

    /** Delete a memory, its assets, and any story chapters referencing it. */
    async remove(id: string): Promise<void> {
      await db.transaction('rw', db.memories, db.assets, db.stories, async () => {
        const memory = await db.memories.get(id);
        if (!memory) return;
        const assetIds = [...memory.photoIds, ...memory.audioIds];
        if (assetIds.length) await db.assets.bulkDelete(assetIds);
        await db.memories.delete(id);

        // Prune chapters that pointed at this memory from every story.
        const stories = await db.stories.toArray();
        for (const story of stories) {
          const kept = story.chapters.filter((c) => c.memoryId !== id);
          if (kept.length !== story.chapters.length) {
            const cover =
              story.coverPhotoId && memory.photoIds.includes(story.coverPhotoId)
                ? undefined
                : story.coverPhotoId;
            await db.stories.update(story.id, {
              chapters: kept,
              coverPhotoId: cover,
              updatedAt: now(),
            });
          }
        }
      });
    },
  };

  const assets = {
    get(id: string): Promise<MediaAsset | undefined> {
      return db.assets.get(id);
    },
    async getMany(ids: string[]): Promise<MediaAsset[]> {
      if (!ids.length) return [];
      const found = await db.assets.bulkGet(ids);
      return found.filter((a): a is MediaAsset => a != null);
    },
    async add(asset: Omit<MediaAsset, 'id' | 'createdAt'> & { id?: string }): Promise<string> {
      const id = asset.id ?? newId('ast');
      await db.assets.add({ ...asset, id, createdAt: now() });
      return id;
    },
  };

  const stories = {
    async list(): Promise<Story[]> {
      const all = await db.stories.toArray();
      return all.sort(byRecency);
    },

    get(id: string): Promise<Story | undefined> {
      return db.stories.get(id);
    },

    async create(input: { title: string; subtitle?: string; spineHue?: number; chapters?: Chapter[]; coverPhotoId?: string }): Promise<Story> {
      const ts = now();
      const story: Story = {
        id: newId('sto'),
        title: input.title.trim() || 'Untitled story',
        ...(input.subtitle ? { subtitle: input.subtitle } : {}),
        ...(input.coverPhotoId ? { coverPhotoId: input.coverPhotoId } : {}),
        spineHue: input.spineHue ?? randomHue(),
        chapters: input.chapters ?? [],
        createdAt: ts,
        updatedAt: ts,
      };
      await db.stories.add(story);
      return story;
    },

    async update(id: string, patch: Partial<Omit<Story, 'id' | 'createdAt'>>): Promise<void> {
      await db.stories.update(id, { ...patch, updatedAt: now() });
    },

    remove(id: string): Promise<void> {
      return db.stories.delete(id).then(() => undefined);
    },
  };

  const settings = {
    async get<T>(key: string): Promise<T | undefined> {
      const row = await db.settings.get(key);
      return row?.value as T | undefined;
    },
    async set(key: string, value: unknown): Promise<void> {
      await db.settings.put({ key, value });
    },
    async remove(key: string): Promise<void> {
      await db.settings.delete(key);
    },
  };

  return { db, memories, assets, stories, settings };
}

export type Repos = ReturnType<typeof createRepos>;

/** Repos bound to the shared app database. */
export const repos = createRepos(sharedDb);

// --- helpers ---

/** Make a chapter from a memory id (used by the story builder). */
export function makeChapter(memoryId: string, caption?: string): Chapter {
  return { id: newId('ch'), memoryId, ...(caption ? { caption } : {}) };
}

function byRecency<T extends { updatedAt: number }>(a: T, b: T): number {
  return b.updatedAt - a.updatedAt;
}

function dedupeTrimmed(list: string[] | undefined): string[] {
  if (!list) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

function randomHue(): number {
  return Math.floor(Math.random() * 360);
}
