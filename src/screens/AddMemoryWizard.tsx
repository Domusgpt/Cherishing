import { useEffect, useRef, useState } from 'react';
import { WizardShell } from '../components/WizardShell.tsx';
import { TextField } from '../components/TextField.tsx';
import { ChunkyButton } from '../components/ChunkyButton.tsx';
import { RecordButton } from '../components/RecordButton.tsx';
import { PhotoThumb } from '../components/PhotoThumb.tsx';
import { AudioPlayer } from '../components/AudioPlayer.tsx';
import { ChipsInput } from '../components/ChipsInput.tsx';
import { repos } from '../db/repo.ts';
import type { Recording } from '../lib/audioRecorder.ts';
import { importImageFiles } from '../lib/imageImport.ts';
import { navigate } from '../router/router.tsx';
import './AddMemoryWizard.css';

const STEP_COUNT = 5;
const DRAFT_KEY = 'wizard.draft.v1';

interface Draft {
  title: string;
  text: string;
  whenLabel: string;
  whenYear: string;
  people: string[];
  tags: string[];
  photoIds: string[];
  audioIds: string[];
}

const EMPTY: Draft = {
  title: '',
  text: '',
  whenLabel: '',
  whenYear: '',
  people: [],
  tags: [],
  photoIds: [],
  audioIds: [],
};

export function AddMemoryWizard() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Restore an in-progress draft so an accidental close loses nothing.
  useEffect(() => {
    repos.settings.get<Draft>(DRAFT_KEY).then((d) => {
      if (d) setDraft({ ...EMPTY, ...d });
      setRestored(true);
    });
  }, []);

  // Autosave the draft after each change (once we've restored any prior one).
  useEffect(() => {
    if (!restored) return;
    void repos.settings.set(DRAFT_KEY, draft);
  }, [draft, restored]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  async function handlePhotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setPhotoNote(null);
    try {
      const { images, failed } = await importImageFiles(Array.from(files));
      const ids: string[] = [];
      for (const img of images) {
        const id = await repos.assets.add({
          kind: 'photo',
          blob: img.blob,
          thumbBlob: img.thumbBlob,
          mimeType: img.mimeType,
          width: img.width,
          height: img.height,
        });
        ids.push(id);
      }
      patch({ photoIds: [...draft.photoIds, ...ids] });
      if (failed > 0) {
        setPhotoNote(`${failed} ${failed === 1 ? 'photo' : 'photos'} couldn't be added, but the rest are here.`);
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removePhoto(id: string) {
    patch({ photoIds: draft.photoIds.filter((p) => p !== id) });
    await deleteAsset(id);
  }

  async function handleRecording(rec: Recording) {
    const id = await repos.assets.add({
      kind: 'audio',
      blob: rec.blob,
      mimeType: rec.mimeType,
      durationMs: rec.durationMs,
    });
    patch({ audioIds: [...draft.audioIds, id] });
  }

  async function removeAudio(id: string) {
    patch({ audioIds: draft.audioIds.filter((a) => a !== id) });
    await deleteAsset(id);
  }

  async function discardOrphans() {
    // Assets were stored as we went; if the user cancels, clean them up.
    for (const id of [...draft.photoIds, ...draft.audioIds]) await deleteAsset(id);
  }

  async function handleCancel() {
    await discardOrphans();
    await repos.settings.remove(DRAFT_KEY);
    navigate('/memories');
  }

  async function handleSave() {
    setBusy(true);
    try {
      const year = draft.whenYear.trim() ? Number(draft.whenYear.trim()) : undefined;
      const when =
        draft.whenLabel.trim() || year
          ? { label: draft.whenLabel.trim() || String(year), ...(year && !Number.isNaN(year) ? { year } : {}) }
          : undefined;
      const mem = await repos.memories.create({
        title: draft.title.trim() || 'Untitled memory',
        text: draft.text,
        ...(when ? { when } : {}),
        people: draft.people,
        tags: draft.tags,
        photoIds: draft.photoIds,
        audioIds: draft.audioIds,
      });
      await repos.settings.remove(DRAFT_KEY);
      // Ask the browser to keep our data (mitigates Safari eviction).
      void navigator.storage?.persist?.();
      // Route to a dedicated confirmation screen. This unmounts the wizard, so
      // returning to /memories/new later always starts from a clean form.
      navigate(`/memories/saved/${mem.id}`);
    } finally {
      setBusy(false);
    }
  }

  const next = () => setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));
  const isLast = step === STEP_COUNT - 1;

  return (
    <WizardShell
      stepIndex={step}
      stepCount={STEP_COUNT}
      title={STEP_TITLES[step]!}
      help={STEP_HELP[step]}
      onBack={step > 0 ? back : undefined}
      onNext={isLast ? handleSave : next}
      nextLabel={isLast ? (busy ? 'Saving…' : 'Save memory') : 'Next'}
      nextDisabled={busy || (step === 0 && draft.title.trim().length === 0)}
      onCancel={handleCancel}
    >
      {step === 0 && (
        <TextField
          label="Give this memory a name"
          hint="A few words are plenty — for example, “Grandpa's 80th birthday”."
          value={draft.title}
          onChange={(title) => patch({ title })}
          placeholder="Grandpa's 80th birthday"
          autoFocus
        />
      )}

      {step === 1 && (
        <div className="stack">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => handlePhotos(e.target.files)}
          />
          <ChunkyButton
            size="lg"
            icon="📷"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Adding…' : 'Choose photos'}
          </ChunkyButton>
          {photoNote && <p className="muted" role="status">{photoNote}</p>}
          {draft.photoIds.length > 0 && (
            <ul className="thumb-grid" aria-label="Photos added so far">
              {draft.photoIds.map((id) => (
                <li key={id} className="thumb-grid__item">
                  <PhotoThumb assetId={id} alt="Added photo" />
                  <button
                    type="button"
                    className="thumb-grid__remove"
                    onClick={() => removePhoto(id)}
                    aria-label="Remove this photo"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <RecordButton onSave={handleRecording} />
          {draft.audioIds.length > 0 && (
            <ul className="stack-sm" aria-label="Recordings added so far">
              {draft.audioIds.map((id) => (
                <li key={id} className="row" style={{ alignItems: 'stretch' }}>
                  <div style={{ flex: 1 }}>
                    <AudioPlayer assetId={id} />
                  </div>
                  <ChunkyButton variant="quiet" onClick={() => removeAudio(id)} aria-label="Remove this recording">
                    Remove
                  </ChunkyButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 3 && (
        <TextField
          label="Write the story"
          multiline
          hint="Say it however you like. There's no wrong way to remember."
          value={draft.text}
          onChange={(text) => patch({ text })}
          placeholder="I still remember the smell of the kitchen that morning…"
          autoFocus
        />
      )}

      {step === 4 && (
        <div className="stack">
          <TextField
            label="When was this?"
            hint="A rough idea is fine — “Summer 1974” or “when the twins were little”."
            value={draft.whenLabel}
            onChange={(whenLabel) => patch({ whenLabel })}
            placeholder="Summer 1974"
          />
          <TextField
            label="Year (optional)"
            hint="If you know it, adding the year helps sort your memories."
            inputMode="numeric"
            value={draft.whenYear}
            onChange={(whenYear) => patch({ whenYear: whenYear.replace(/[^0-9]/g, '').slice(0, 4) })}
            placeholder="1974"
          />
          <ChipsInput
            label="Who was there?"
            hint="Add a name and press Enter."
            placeholder="Add a person"
            values={draft.people}
            onChange={(people) => patch({ people })}
          />
          <ChipsInput
            label="Tags (optional)"
            hint="Words to find this by later, like “holiday” or “wedding”."
            placeholder="Add a tag"
            values={draft.tags}
            onChange={(tags) => patch({ tags })}
          />
        </div>
      )}
    </WizardShell>
  );
}

async function deleteAsset(id: string): Promise<void> {
  const { db } = repos;
  await db.assets.delete(id);
}

const STEP_TITLES = [
  'What is this memory about?',
  'Add some photos',
  'Tell it in your own voice',
  'Or write it down',
  'When was this, and who was there?',
];

const STEP_HELP: (string | undefined)[] = [
  undefined,
  'This is optional. You can add as many as you like, or skip and come back later.',
  'This is optional. Record yourself telling the story — no need to be perfect.',
  'This is optional too. A sentence or a whole page, whatever feels right.',
  'All optional — but a date and a name or two make memories easier to find.',
];
