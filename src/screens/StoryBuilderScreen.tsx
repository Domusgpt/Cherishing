// Placeholder — the real story builder arrives with the story-reels work.
export function StoryBuilderScreen({ id }: { id?: string }) {
  return (
    <div className="stack">
      <h1 className="page-title">{id ? 'Edit story' : 'New story'}</h1>
      <p className="page-lead">Arrange your memories into a story here.</p>
    </div>
  );
}
