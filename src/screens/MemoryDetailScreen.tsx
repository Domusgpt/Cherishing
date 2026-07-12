// Placeholder — the real memory detail view arrives with the capture work.
export function MemoryDetailScreen({ id }: { id: string }) {
  return (
    <div className="stack">
      <h1 className="page-title">Memory</h1>
      <p className="muted">Memory {id}</p>
    </div>
  );
}
