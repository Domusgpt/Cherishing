import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema.ts';
import type { Memory } from '../db/schema.ts';
import { ChunkyButton } from '../components/ChunkyButton.tsx';
import { PhotoThumb } from '../components/PhotoThumb.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { Link, navigate } from '../router/router.tsx';
import './MemoryLibraryScreen.css';

export function MemoryLibraryScreen() {
  const memories = useLiveQuery(async () => {
    const all = await db.memories.toArray();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  const [filter, setFilter] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const m of memories ?? []) {
      for (const t of m.tags) set.add(t);
      for (const p of m.people) set.add(p);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [memories]);

  const shown = useMemo(() => {
    if (!memories) return [];
    if (!filter) return memories;
    return memories.filter((m) => m.tags.includes(filter) || m.people.includes(filter));
  }, [memories, filter]);

  if (memories === undefined) {
    return <p className="muted">Opening your memory box…</p>;
  }

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="page-title">Memory box</h1>
        <ChunkyButton variant="primary" size="lg" icon="＋" onClick={() => navigate('/memories/new')}>
          Add a memory
        </ChunkyButton>
      </div>

      {memories.length === 0 ? (
        <EmptyState
          icon="📼"
          title="Your memory box is empty"
          action={
            <ChunkyButton variant="primary" size="lg" onClick={() => navigate('/memories/new')}>
              Add your first memory
            </ChunkyButton>
          }
        >
          Add a photo, record a voice, or write down a moment you'd like to keep.
        </EmptyState>
      ) : (
        <>
          {allTags.length > 0 && (
            <div className="filter-row" role="group" aria-label="Filter memories">
              <button
                className={`chip-filter ${filter === null ? 'chip-filter--on' : ''}`}
                onClick={() => setFilter(null)}
                aria-pressed={filter === null}
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  className={`chip-filter ${filter === t ? 'chip-filter--on' : ''}`}
                  onClick={() => setFilter(t)}
                  aria-pressed={filter === t}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <ul className="memory-grid">
            {shown.map((m) => (
              <li key={m.id}>
                <MemoryCard memory={m} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MemoryCard({ memory }: { memory: Memory }) {
  const cover = memory.photoIds[0];
  return (
    <Link to={`/memories/${memory.id}`} className="memory-card">
      <div className="memory-card__media">
        {cover ? (
          <PhotoThumb assetId={cover} alt="" />
        ) : (
          <div className="memory-card__noimg" aria-hidden="true">
            {memory.audioIds.length > 0 ? '🎙' : '✎'}
          </div>
        )}
        {memory.audioIds.length > 0 && (
          <span className="memory-card__badge" title="Has a voice recording">
            🎙
          </span>
        )}
      </div>
      <div className="memory-card__body">
        <span className="memory-card__title">{memory.title}</span>
        {memory.when?.label && <span className="memory-card__when">{memory.when.label}</span>}
      </div>
    </Link>
  );
}
