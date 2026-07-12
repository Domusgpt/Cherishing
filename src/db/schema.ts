import Dexie from 'dexie';
import type { EntityTable } from 'dexie';

/**
 * Data model for Cherishing. Media blobs live in their own `assets` table so
 * that editing a memory's title never rewrites megabytes of photo/audio data.
 */

export type AssetKind = 'photo' | 'audio';

export interface MediaAsset {
  id: string;
  kind: AssetKind;
  /** The full-size (downscaled) photo, or the recorded audio. */
  blob: Blob;
  /** 320px JPEG preview for photos; absent for audio. */
  thumbBlob?: Blob;
  /** The ACTUAL mime type produced by the device (e.g. iOS records audio/mp4). */
  mimeType: string;
  width?: number;
  height?: number;
  durationMs?: number;
  createdAt: number;
}

/** A soft date — older storytellers rarely recall exact days ("Summer 1974"). */
export interface FuzzyDate {
  label: string;
  year?: number;
}

export interface Memory {
  id: string;
  title: string;
  /** The written story. May be empty when the memory is a photo or voice note. */
  text: string;
  when?: FuzzyDate;
  people: string[];
  tags: string[];
  /** Ordered references into the `assets` table. */
  photoIds: string[];
  audioIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  memoryId: string;
  caption?: string;
  /** Optional override for how long this chapter holds on screen, in ms. */
  holdMs?: number;
}

export interface Story {
  id: string;
  title: string;
  subtitle?: string;
  coverPhotoId?: string;
  /** 0–360; tints the tape's spine label on the shelf. */
  spineHue: number;
  chapters: Chapter[];
  createdAt: number;
  updatedAt: number;
}

/** A tiny key/value table for app state (e.g. the in-progress wizard draft). */
export interface Setting {
  key: string;
  value: unknown;
}

export class CherishingDB extends Dexie {
  memories!: EntityTable<Memory, 'id'>;
  stories!: EntityTable<Story, 'id'>;
  assets!: EntityTable<MediaAsset, 'id'>;
  settings!: EntityTable<Setting, 'key'>;

  constructor(name = 'cherishing') {
    super(name);
    this.version(1).stores({
      memories: 'id, updatedAt, when.year, *tags, *people',
      stories: 'id, updatedAt',
      assets: 'id, kind',
      settings: 'key',
    });
  }
}

/** The shared singleton used by the app. Tests construct their own instances. */
export const db = new CherishingDB();
