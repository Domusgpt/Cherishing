import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import type { MediaAsset, Memory, Story } from '../db/schema.ts';
import type { Repos } from '../db/repo.ts';

/**
 * Backup format: a single .zip holding a manifest plus the raw media files.
 * Storing media byte-for-byte (uncompressed) avoids the ~33% base64 bloat and
 * the main-thread stalls of a giant JSON blob, and restores identically on any
 * device because each asset carries its real mime type.
 */

export const FORMAT_VERSION = 1;

interface AssetMeta {
  id: string;
  kind: MediaAsset['kind'];
  mimeType: string;
  fileName: string;
  thumbFileName?: string;
  width?: number;
  height?: number;
  durationMs?: number;
  createdAt: number;
}

interface Manifest {
  formatVersion: number;
  app: 'cherishing';
  exportedAt: number;
  memories: Memory[];
  stories: Story[];
  assets: AssetMeta[];
}

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  memories: number;
  stories: number;
  assets: number;
  skipped: number;
}

function extForMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  return 'bin';
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Wrap raw bytes in a Blob, copying into a fresh ArrayBuffer for stable typing. */
function bytesToBlob(data: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy.buffer], { type });
}

/** Build a backup zip of the entire library. `exportedAt` is injected (no clock in pure code). */
export async function buildBackupZip(repos: Repos, exportedAt: number): Promise<Uint8Array> {
  const memories = await repos.memories.list();
  const stories = await repos.stories.list();
  const allAssets = await repos.db.assets.toArray();

  const files: Record<string, Uint8Array> = {};
  const assetMetas: AssetMeta[] = [];

  for (const a of allAssets) {
    const ext = extForMime(a.mimeType);
    const fileName = `media/${a.id}.${ext}`;
    files[fileName] = await blobBytes(a.blob);
    const meta: AssetMeta = {
      id: a.id,
      kind: a.kind,
      mimeType: a.mimeType,
      fileName,
      createdAt: a.createdAt,
      ...(a.width != null ? { width: a.width } : {}),
      ...(a.height != null ? { height: a.height } : {}),
      ...(a.durationMs != null ? { durationMs: a.durationMs } : {}),
    };
    if (a.thumbBlob) {
      const thumbFileName = `media/${a.id}.thumb.jpg`;
      files[thumbFileName] = await blobBytes(a.thumbBlob);
      meta.thumbFileName = thumbFileName;
    }
    assetMetas.push(meta);
  }

  const manifest: Manifest = {
    formatVersion: FORMAT_VERSION,
    app: 'cherishing',
    exportedAt,
    memories,
    stories,
    assets: assetMetas,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest));

  // level 0 = store: media is already compressed (JPEG/opus), so this is faster
  // and just as small, which matters on older devices.
  return zipSync(files, { level: 0 });
}

/** Read and validate a backup zip without touching the database. */
export function parseBackupZip(bytes: Uint8Array): { manifest: Manifest; files: Record<string, Uint8Array> } {
  const files = unzipSync(bytes);
  const manifestBytes = files['manifest.json'];
  if (!manifestBytes) throw new Error("This file doesn't look like a Cherishing backup.");
  let manifest: Manifest;
  try {
    manifest = JSON.parse(strFromU8(manifestBytes)) as Manifest;
  } catch {
    throw new Error('This backup file is damaged and could not be read.');
  }
  if (manifest.app !== 'cherishing' || typeof manifest.formatVersion !== 'number') {
    throw new Error("This file doesn't look like a Cherishing backup.");
  }
  if (manifest.formatVersion > FORMAT_VERSION) {
    throw new Error('This backup was made with a newer version of Cherishing. Please update the app first.');
  }
  return { manifest, files };
}

/** Restore a backup, either merging into or replacing the current library. */
export async function importBackup(
  repos: Repos,
  bytes: Uint8Array,
  mode: ImportMode,
): Promise<ImportSummary> {
  const { manifest, files } = parseBackupZip(bytes);
  const { db } = repos;

  const summary: ImportSummary = { memories: 0, stories: 0, assets: 0, skipped: 0 };

  await db.transaction('rw', db.memories, db.stories, db.assets, async () => {
    if (mode === 'replace') {
      await Promise.all([db.memories.clear(), db.stories.clear(), db.assets.clear()]);
    }

    const existingAssets = mode === 'merge' ? new Set(await db.assets.toCollection().primaryKeys()) : new Set<string>();
    const existingMems = mode === 'merge' ? new Set(await db.memories.toCollection().primaryKeys()) : new Set<string>();
    const existingStories = mode === 'merge' ? new Set(await db.stories.toCollection().primaryKeys()) : new Set<string>();

    for (const meta of manifest.assets) {
      if (existingAssets.has(meta.id)) {
        summary.skipped++;
        continue;
      }
      const data = files[meta.fileName];
      if (!data) continue; // media missing from the archive — skip defensively
      const asset: MediaAsset = {
        id: meta.id,
        kind: meta.kind,
        blob: bytesToBlob(data, meta.mimeType),
        mimeType: meta.mimeType,
        createdAt: meta.createdAt,
        ...(meta.width != null ? { width: meta.width } : {}),
        ...(meta.height != null ? { height: meta.height } : {}),
        ...(meta.durationMs != null ? { durationMs: meta.durationMs } : {}),
      };
      if (meta.thumbFileName && files[meta.thumbFileName]) {
        asset.thumbBlob = bytesToBlob(files[meta.thumbFileName]!, 'image/jpeg');
      }
      await db.assets.add(asset);
      summary.assets++;
    }

    for (const mem of manifest.memories) {
      if (existingMems.has(mem.id)) {
        summary.skipped++;
        continue;
      }
      await db.memories.add(mem);
      summary.memories++;
    }

    for (const story of manifest.stories) {
      if (existingStories.has(story.id)) {
        summary.skipped++;
        continue;
      }
      await db.stories.add(story);
      summary.stories++;
    }
  });

  return summary;
}
