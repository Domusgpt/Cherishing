import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema.ts';
import type { Chapter, Memory } from '../db/schema.ts';
import { repos, makeChapter } from '../db/repo.ts';
import { ChunkyButton } from '../components/ChunkyButton.tsx';
import { TextField } from '../components/TextField.tsx';
import { Dial } from '../components/Dial.tsx';
import { PhotoThumb } from '../components/PhotoThumb.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { navigate } from '../router/router.tsx';
import './StoryBuilderScreen.css';

export function StoryBuilderScreen({ id }: { id?: string }) {
  const editing = Boolean(id);
  const memories = useLiveQuery(async () => {
    const all = await db.memories.toArray();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  const [loaded, setLoaded] = useState(!editing);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [hue, setHue] = useState(40);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  // Load an existing story when editing.
  useEffect(() => {
    if (!id) return;
    let active = true;
    repos.stories.get(id).then((story) => {
      if (!active) return;
      if (!story) {
        setMissing(true);
      } else {
        setTitle(story.title);
        setSubtitle(story.subtitle ?? '');
        setHue(story.spineHue);
        setChapters(story.chapters);
      }
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const memoriesById = useMemo(() => {
    const map = new Map<string, Memory>();
    for (const m of memories ?? []) map.set(m.id, m);
    return map;
  }, [memories]);

  if (missing) {
    return (
      <div className="stack">
        <h1 className="page-title">Story not found</h1>
        <ChunkyButton onClick={() => navigate('/')}>Back to shelf</ChunkyButton>
      </div>
    );
  }
  if (!loaded || memories === undefined) {
    return <p className="muted">Getting things ready…</p>;
  }

  function addChapter(memoryId: string) {
    setChapters((cs) => [...cs, makeChapter(memoryId)]);
  }
  function removeChapter(chapterId: string) {
    setChapters((cs) => cs.filter((c) => c.id !== chapterId));
  }
  function move(chapterId: string, dir: -1 | 1) {
    setChapters((cs) => {
      const i = cs.findIndex((c) => c.id === chapterId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cs.length) return cs;
      const copy = [...cs];
      const [item] = copy.splice(i, 1);
      copy.splice(j, 0, item!);
      return copy;
    });
  }
  function setCaption(chapterId: string, caption: string) {
    setChapters((cs) =>
      cs.map((c) => (c.id === chapterId ? { ...c, caption: caption || undefined } : c)),
    );
  }

  async function save(thenPlay: boolean) {
    setBusy(true);
    try {
      const cover = firstCoverPhoto(chapters, memoriesById);
      let storyId = id;
      if (editing && id) {
        await repos.stories.update(id, {
          title: title.trim() || 'Untitled story',
          subtitle: subtitle.trim() || undefined,
          spineHue: hue,
          chapters,
          coverPhotoId: cover,
        });
      } else {
        const created = await repos.stories.create({
          title,
          subtitle: subtitle.trim() || undefined,
          spineHue: hue,
          chapters,
          coverPhotoId: cover,
        });
        storyId = created.id;
      }
      void navigator.storage?.persist?.();
      navigate(thenPlay && storyId ? `/stories/${storyId}/play` : '/');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack builder">
      <h1 className="page-title">{editing ? 'Edit story' : 'New story'}</h1>

      <div className="panel stack">
        <TextField
          label="Story title"
          value={title}
          onChange={setTitle}
          placeholder="Our summers at the lake"
          autoFocus={!editing}
        />
        <TextField
          label="A short line underneath (optional)"
          value={subtitle}
          onChange={setSubtitle}
          placeholder="1974 – 1985"
        />
        <div className="stack-sm">
          <span className="field__label">Tape label color</span>
          <Dial value={hue} onChange={setHue} />
        </div>
      </div>

      <h2 className="builder__h2">Chapters</h2>
      {chapters.length === 0 ? (
        <p className="muted">No chapters yet. Add memories from below to build your story.</p>
      ) : (
        <ol className="chapter-list">
          {chapters.map((c, i) => {
            const mem = memoriesById.get(c.memoryId);
            return (
              <li key={c.id} className="chapter">
                <div className="chapter__order" aria-hidden="true">
                  {i + 1}
                </div>
                <div className="chapter__thumb">
                  <PhotoThumb assetId={mem?.photoIds[0]} alt="" />
                </div>
                <div className="chapter__main">
                  <span className="chapter__title">{mem?.title ?? 'Missing memory'}</span>
                  <input
                    className="field__control chapter__caption"
                    type="text"
                    value={c.caption ?? ''}
                    placeholder="Add a caption (optional)"
                    aria-label={`Caption for chapter ${i + 1}`}
                    onChange={(e) => setCaption(c.id, e.target.value)}
                  />
                </div>
                <div className="chapter__controls">
                  <button
                    className="icon-btn"
                    onClick={() => move(c.id, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${mem?.title ?? 'chapter'} earlier`}
                  >
                    ▲
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => move(c.id, 1)}
                    disabled={i === chapters.length - 1}
                    aria-label={`Move ${mem?.title ?? 'chapter'} later`}
                  >
                    ▼
                  </button>
                  <button
                    className="icon-btn icon-btn--danger"
                    onClick={() => removeChapter(c.id)}
                    aria-label={`Remove ${mem?.title ?? 'chapter'} from story`}
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <h2 className="builder__h2">Add memories</h2>
      {memories.length === 0 ? (
        <EmptyState
          icon="📼"
          title="No memories to add yet"
          action={
            <ChunkyButton variant="primary" onClick={() => navigate('/memories/new')}>
              Add a memory
            </ChunkyButton>
          }
        >
          A story is made from memories. Add one first, then come back.
        </EmptyState>
      ) : (
        <ul className="picker">
          {memories.map((m) => (
            <li key={m.id} className="picker__item">
              <div className="picker__thumb">
                <PhotoThumb assetId={m.photoIds[0]} alt="" />
              </div>
              <span className="picker__title">{m.title}</span>
              <ChunkyButton icon="＋" onClick={() => addChapter(m.id)} aria-label={`Add ${m.title} to story`}>
                Add
              </ChunkyButton>
            </li>
          ))}
        </ul>
      )}

      <div className="row builder__actions">
        <ChunkyButton
          variant="primary"
          size="lg"
          onClick={() => save(true)}
          disabled={busy || chapters.length === 0}
        >
          Save & play
        </ChunkyButton>
        <ChunkyButton size="lg" onClick={() => save(false)} disabled={busy}>
          Save
        </ChunkyButton>
        <ChunkyButton size="lg" onClick={() => navigate('/')} disabled={busy}>
          Cancel
        </ChunkyButton>
      </div>
    </div>
  );
}

function firstCoverPhoto(chapters: Chapter[], memoriesById: Map<string, Memory>): string | undefined {
  for (const c of chapters) {
    const mem = memoriesById.get(c.memoryId);
    if (mem?.photoIds[0]) return mem.photoIds[0];
  }
  return undefined;
}
