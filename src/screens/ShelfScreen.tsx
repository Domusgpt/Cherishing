import { ChunkyButton } from '../components/ChunkyButton.tsx';
import { navigate } from '../router/router.tsx';

// Placeholder — the real tape shelf arrives with the story-reels work.
export function ShelfScreen() {
  return (
    <div className="stack">
      <h1 className="page-title">Your shelf</h1>
      <p className="page-lead">
        This is where your family stories will line up like a shelf of tapes.
      </p>
      <div className="row">
        <ChunkyButton variant="primary" size="lg" onClick={() => navigate('/memories/new')}>
          Add a memory
        </ChunkyButton>
        <ChunkyButton onClick={() => navigate('/memories')}>Open the memory box</ChunkyButton>
      </div>
    </div>
  );
}
