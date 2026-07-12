import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema.ts';
import { ChunkyButton } from '../components/ChunkyButton.tsx';
import { TapeCard } from '../components/TapeCard.tsx';
import { EmptyState } from '../components/EmptyState.tsx';
import { navigate } from '../router/router.tsx';
import './ShelfScreen.css';

export function ShelfScreen() {
  const stories = useLiveQuery(async () => {
    const all = await db.stories.toArray();
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);
  const memoryCount = useLiveQuery(() => db.memories.count(), []);

  if (stories === undefined) {
    return <p className="muted">Dusting off the shelf…</p>;
  }

  return (
    <div className="stack">
      <div className="shelf-hero">
        <h1 className="page-title">Your shelf</h1>
        <p className="page-lead">
          Keep the moments that matter, and turn them into little stories you can watch together —
          like a shelf of home-video tapes.
        </p>
        <div className="row">
          <ChunkyButton variant="primary" size="lg" icon="＋" onClick={() => navigate('/stories/new')}>
            New story
          </ChunkyButton>
          <ChunkyButton size="lg" icon="📼" onClick={() => navigate('/memories')}>
            Memory box{typeof memoryCount === 'number' ? ` (${memoryCount})` : ''}
          </ChunkyButton>
          <ChunkyButton size="lg" icon="🎙" onClick={() => navigate('/memories/new')}>
            Add a memory
          </ChunkyButton>
        </div>
      </div>

      {stories.length === 0 ? (
        <EmptyState
          icon="📺"
          title="No stories yet"
          action={
            <div className="row" style={{ justifyContent: 'center' }}>
              <ChunkyButton
                variant="primary"
                size="lg"
                onClick={() => navigate(memoryCount ? '/stories/new' : '/memories/new')}
              >
                {memoryCount ? 'Make your first story' : 'Add your first memory'}
              </ChunkyButton>
            </div>
          }
        >
          {memoryCount
            ? 'Gather a few memories into a story and press play.'
            : 'Start by adding a memory — a photo, a voice, or a few words. Then weave your memories into a story.'}
        </EmptyState>
      ) : (
        <div className="shelf">
          <ul className="shelf__row">
            {stories.map((s) => (
              <li key={s.id} className="shelf__slot">
                <TapeCard
                  to={`/stories/${s.id}/play`}
                  title={s.title}
                  subtitle={s.subtitle}
                  hue={s.spineHue}
                  count={s.chapters.length}
                />
                <div className="shelf__edit">
                  <button className="link-quiet" onClick={() => navigate(`/stories/${s.id}/edit`)}>
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="shelf__board" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}
