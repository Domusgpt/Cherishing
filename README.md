# Cherishing

A warm, gentle place to keep your family memories — photos, voices, and stories —
and turn them into little "story reels" you can watch together, like a shelf of
old home-video tapes.

Cherishing is **local-first**: everything you add stays on your own device. There
is no account, no sign-up, and nothing is uploaded to a server. It works offline,
and you can save a single backup file to move your memories to another device.

## Design

The look is a soft, tactile take on old **VHS tapes and warm CRT televisions** —
cream and amber tones, gently raised buttons, and a cosy screen glow. It's built
to be comfortable for everyone, from grandchildren to grandparents:

- Large text (adjustable) and big, easy-to-tap buttons.
- Plain-language, one-step-at-a-time guidance when adding a memory.
- High-contrast and reduced-motion options built in.

## Getting started

```bash
npm install
npm run dev        # start the local dev server
```

Then open the address it prints (usually http://localhost:5173).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the app locally with hot reload |
| `npm run build` | Type-check and build the production site into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the unit tests (Vitest) |
| `npm run typecheck` | Type-check without emitting |

## How it's built

- **React + Vite + TypeScript** (strict), no backend.
- **IndexedDB** via [Dexie](https://dexie.org/) for memories, stories, and media
  blobs.
- **fflate** for the single-file `.zip` backup (export / restore).
- Hand-written CSS design tokens for the neoskeuomorphic VHS/CRT look — no CSS
  framework.

A note on voice recordings: browsers differ in the audio format they record
(for example, iPhones and iPads record `audio/mp4`). Cherishing stores each
recording's real format so it always plays back correctly, and backups made on
one device restore cleanly on another.

## Privacy

Your memories never leave your device unless *you* save a backup file and move it
yourself. There is no analytics, no tracking, and no network calls while you use
the app.
