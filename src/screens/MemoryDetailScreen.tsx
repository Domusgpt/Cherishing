import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema.ts';
import type { Memory } from '../db/schema.ts';
import { repos } from '../db/repo.ts';
import { ChunkyButton } from '../components/ChunkyButton.tsx';
import { PhotoThumb } from '../components/PhotoThumb.tsx';
import { AudioPlayer } from '../components/AudioPlayer.tsx';
import { TextField } from '../components/TextField.tsx';
import { ChipsInput } from '../components/ChipsInput.tsx';
import { RecordButton } from '../components/RecordButton.tsx';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import type { Recording } from '../lib/audioRecorder.ts';
import { importImageFiles } from '../lib/imageImport.ts';
import { navigate } from '../router/router.tsx';
import './MemoryDetailScreen.css';

export function MemoryDetailScreen({ id }: { id: string }) {
  const memory = useLiveQuery(async () => (await db.memories.get(id)) ?? null, [id]);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (memory === undefined) return <p className="muted">Finding this memory…</p>;
  if (memory === null) {
    return (
      <div className="stack">
        <h1 className="page-title">Memory not found</h1>
        <ChunkyButton onClick={() => navigate('/memories')}>Back to memory box</ChunkyButton>
      </div>
    );
  }

  async function handleDelete() {
    await repos.memories.remove(id);
    navigate('/memories');
  }

  return (
    <div className="stack">
      {editing ? (
        <EditView memory={memory} onDone={() => setEditing(false)} />
      ) : (
        <ReadView memory={memory} onEdit={() => setEditing(true)} onDelete={() => setConfirming(true)} />
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this memory?"
        body="This will remove its photos and recording too. This cannot be undone."
        confirmLabel="Yes, delete"
        cancelLabel="Keep it"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

function ReadView({
  memory,
  onEdit,
  onDelete,
}: {
  memory: Memory;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="detail-head">
        <button className="link-back" onClick={() => navigate('/memories')}>
          ← Memory box
        </button>
        <h1 className="page-title">{memory.title}</h1>
        {memory.when?.label && <p className="detail-when">{memory.when.label}</p>}
      </div>

      {memory.photoIds.length > 0 && (
        <ul className="photo-strip" aria-label="Photos">
          {memory.photoIds.map((pid) => (
            <li key={pid}>
              <PhotoThumb assetId={pid} alt={`Photo from ${memory.title}`} full />
            </li>
          ))}
        </ul>
      )}

      {memory.audioIds.length > 0 && (
        <div className="stack-sm">
          {memory.audioIds.map((aid) => (
            <AudioPlayer key={aid} assetId={aid} label="Voice recording" />
          ))}
        </div>
      )}

      {memory.text.trim() && <p className="detail-text">{memory.text}</p>}

      {(memory.people.length > 0 || memory.tags.length > 0) && (
        <div className="detail-meta">
          {memory.people.length > 0 && (
            <p>
              <strong>Who:</strong> {memory.people.join(', ')}
            </p>
          )}
          {memory.tags.length > 0 && (
            <p>
              <strong>Tags:</strong> {memory.tags.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="row" style={{ marginTop: 'var(--sp-3)' }}>
        <ChunkyButton variant="primary" size="lg" icon="✎" onClick={onEdit}>
          Edit
        </ChunkyButton>
        <ChunkyButton variant="danger" size="lg" onClick={onDelete}>
          Delete
        </ChunkyButton>
      </div>
    </>
  );
}

function EditView({ memory, onDone }: { memory: Memory; onDone: () => void }) {
  const [title, setTitle] = useState(memory.title);
  const [text, setText] = useState(memory.text);
  const [whenLabel, setWhenLabel] = useState(memory.when?.label ?? '');
  const [whenYear, setWhenYear] = useState(memory.when?.year ? String(memory.when.year) : '');
  const [people, setPeople] = useState<string[]>(memory.people);
  const [tags, setTags] = useState<string[]>(memory.tags);
  const [photoIds, setPhotoIds] = useState<string[]>(memory.photoIds);
  const [audioIds, setAudioIds] = useState<string[]>(memory.audioIds);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setNote(null);
    try {
      const { images, failed } = await importImageFiles(Array.from(files));
      const ids: string[] = [];
      for (const img of images) {
        ids.push(
          await repos.assets.add({
            kind: 'photo',
            blob: img.blob,
            thumbBlob: img.thumbBlob,
            mimeType: img.mimeType,
            width: img.width,
            height: img.height,
          }),
        );
      }
      setPhotoIds((p) => [...p, ...ids]);
      if (failed) setNote(`${failed} ${failed === 1 ? 'photo' : 'photos'} couldn't be added.`);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function addRecording(rec: Recording) {
    const aid = await repos.assets.add({
      kind: 'audio',
      blob: rec.blob,
      mimeType: rec.mimeType,
      durationMs: rec.durationMs,
    });
    setAudioIds((a) => [...a, aid]);
  }

  async function save() {
    setBusy(true);
    try {
      const year = whenYear.trim() ? Number(whenYear.trim()) : undefined;
      const when =
        whenLabel.trim() || year
          ? { label: whenLabel.trim() || String(year), ...(year && !Number.isNaN(year) ? { year } : {}) }
          : undefined;
      // Delete assets the user removed while editing.
      const removed = [
        ...memory.photoIds.filter((p) => !photoIds.includes(p)),
        ...memory.audioIds.filter((a) => !audioIds.includes(a)),
      ];
      for (const rid of removed) await db.assets.delete(rid);

      await repos.memories.update(memory.id, {
        title: title.trim() || 'Untitled memory',
        text,
        when,
        people,
        tags,
        photoIds,
        audioIds,
      });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1 className="page-title">Edit memory</h1>
      <TextField label="Name" value={title} onChange={setTitle} />

      <div className="stack-sm">
        <span className="field__label">Photos</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => addPhotos(e.target.files)}
        />
        {photoIds.length > 0 && (
          <ul className="thumb-grid" aria-label="Photos">
            {photoIds.map((pid) => (
              <li key={pid} className="thumb-grid__item">
                <PhotoThumb assetId={pid} alt="Photo" />
                <button
                  type="button"
                  className="thumb-grid__remove"
                  onClick={() => setPhotoIds((p) => p.filter((x) => x !== pid))}
                  aria-label="Remove this photo"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <ChunkyButton icon="📷" onClick={() => fileRef.current?.click()} disabled={busy}>
          Add photos
        </ChunkyButton>
        {note && <p className="muted" role="status">{note}</p>}
      </div>

      <div className="stack-sm">
        <span className="field__label">Voice recordings</span>
        {audioIds.map((aid) => (
          <div key={aid} className="row" style={{ alignItems: 'stretch' }}>
            <div style={{ flex: 1 }}>
              <AudioPlayer assetId={aid} />
            </div>
            <ChunkyButton onClick={() => setAudioIds((a) => a.filter((x) => x !== aid))}>Remove</ChunkyButton>
          </div>
        ))}
        <RecordButton onSave={addRecording} />
      </div>

      <TextField label="The story" multiline value={text} onChange={setText} />
      <TextField label="When was this?" value={whenLabel} onChange={setWhenLabel} placeholder="Summer 1974" />
      <TextField
        label="Year (optional)"
        inputMode="numeric"
        value={whenYear}
        onChange={(v) => setWhenYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
        placeholder="1974"
      />
      <ChipsInput label="Who was there?" placeholder="Add a person" values={people} onChange={setPeople} />
      <ChipsInput label="Tags" placeholder="Add a tag" values={tags} onChange={setTags} />

      <div className="row">
        <ChunkyButton variant="primary" size="lg" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </ChunkyButton>
        <ChunkyButton size="lg" onClick={onDone} disabled={busy}>
          Cancel
        </ChunkyButton>
      </div>
    </div>
  );
}
