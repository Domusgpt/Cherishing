// Placeholder — the real CRT playback view arrives with the story-reels work.
export function PlaybackScreen({ id }: { id: string }) {
  return (
    <div className="stack" style={{ padding: '2rem' }}>
      <h1 className="page-title">Now playing</h1>
      <p className="muted">Story {id}</p>
    </div>
  );
}
