import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../context/SettingsContext.tsx';
import type { TextSize } from '../context/SettingsContext.tsx';
import { ChunkyButton } from '../components/ChunkyButton.tsx';
import { ToggleSwitch } from '../components/ToggleSwitch.tsx';
import { repos } from '../db/repo.ts';
import { buildBackupZip, importBackup } from '../lib/exportImport.ts';
import type { ImportMode, ImportSummary } from '../lib/exportImport.ts';
import './SettingsScreen.css';

const TEXT_OPTIONS: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra large' },
];

export function SettingsScreen() {
  const { textSize, setTextSize, highContrast, setHighContrast, reducedMotion, setReducedMotion } =
    useSettings();

  const [storage, setStorage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<Uint8Array | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    navigator.storage.estimate().then((est) => {
      if (est.usage != null) setStorage(formatBytes(est.usage));
    });
  }, [busy]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (pendingFile && !dlg.open) dlg.showModal();
    else if (!pendingFile && dlg.open) dlg.close();
  }, [pendingFile]);

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      const bytes = await buildBackupZip(repos, Date.now());
      // Copy into a fresh ArrayBuffer so the Blob type is unambiguous.
      const buf = new Uint8Array(bytes.byteLength);
      buf.set(bytes);
      const blob = new Blob([buf.buffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cherishing-backup-${todayStamp()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage('Your backup has been saved. Keep it somewhere safe.');
    } catch {
      setMessage('Sorry — something went wrong while making the backup.');
    } finally {
      setBusy(false);
    }
  }

  async function handleFileChosen(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setPendingFile(bytes);
    } catch {
      setMessage('That file could not be read.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function runImport(mode: ImportMode) {
    if (!pendingFile) return;
    setBusy(true);
    setMessage(null);
    const bytes = pendingFile;
    setPendingFile(null);
    try {
      const summary = await importBackup(repos, bytes, mode);
      setMessage(describeImport(summary, mode));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sorry — that backup could not be restored.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack settings">
      <h1 className="page-title">Settings</h1>

      <section className="panel stack" aria-labelledby="s-text">
        <h2 id="s-text" className="settings__h2">
          Text size
        </h2>
        <div className="settings__segment" role="radiogroup" aria-label="Text size">
          {TEXT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              role="radio"
              aria-checked={textSize === opt.value}
              className={`seg ${textSize === opt.value ? 'seg--on' : ''}`}
              onClick={() => setTextSize(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="panel stack" aria-labelledby="s-comfort">
        <h2 id="s-comfort" className="settings__h2">
          Comfort
        </h2>
        <ToggleSwitch
          label="Higher contrast"
          hint="Stronger colors and clearer edges."
          checked={highContrast}
          onChange={setHighContrast}
        />
        <ToggleSwitch
          label="Reduce movement"
          hint="Turns off gentle motion like slow zooms."
          checked={reducedMotion}
          onChange={setReducedMotion}
        />
      </section>

      <section className="panel stack" aria-labelledby="s-backup">
        <h2 id="s-backup" className="settings__h2">
          Your backup
        </h2>
        <p className="muted">
          Everything you add stays on this device. Save a backup file now and then so you never lose
          your memories — and to move them to another device.
        </p>
        {storage && <p className="settings__storage">Currently using about {storage} on this device.</p>}
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          onChange={(e) => handleFileChosen(e.target.files)}
        />
        <div className="row">
          <ChunkyButton variant="primary" size="lg" icon="💾" onClick={handleExport} disabled={busy}>
            {busy ? 'Working…' : 'Save a backup'}
          </ChunkyButton>
          <ChunkyButton size="lg" icon="↩" onClick={() => fileRef.current?.click()} disabled={busy}>
            Restore from backup
          </ChunkyButton>
        </div>
        {message && (
          <p className="settings__message" role="status">
            {message}
          </p>
        )}
      </section>

      <section className="panel stack" aria-labelledby="s-privacy">
        <h2 id="s-privacy" className="settings__h2">
          Your privacy
        </h2>
        <p className="muted">
          Cherishing keeps everything on this device. Nothing is uploaded, and there is no account to
          sign in to. Your memories are yours alone.
        </p>
      </section>

      <dialog ref={dialogRef} className="confirm" onCancel={() => setPendingFile(null)}>
        <h2 className="confirm__title">Restore this backup?</h2>
        <p className="confirm__body">
          You can add these memories to what you already have, or replace everything on this device
          with the backup.
        </p>
        <div className="confirm__actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <ChunkyButton variant="primary" size="lg" onClick={() => runImport('merge')}>
            Add to what I have
          </ChunkyButton>
          <ChunkyButton variant="danger" size="lg" onClick={() => runImport('replace')}>
            Replace everything
          </ChunkyButton>
          <ChunkyButton size="lg" onClick={() => setPendingFile(null)}>
            Cancel
          </ChunkyButton>
        </div>
      </dialog>
    </div>
  );
}

function describeImport(s: ImportSummary, mode: ImportMode): string {
  const parts: string[] = [];
  if (s.memories) parts.push(`${s.memories} ${s.memories === 1 ? 'memory' : 'memories'}`);
  if (s.stories) parts.push(`${s.stories} ${s.stories === 1 ? 'story' : 'stories'}`);
  if (parts.length === 0) {
    return mode === 'merge'
      ? 'Nothing new to add — everything in that backup was already here.'
      : 'Restored, but the backup was empty.';
  }
  return `Restored ${parts.join(' and ')}.`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let val = bytes / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val < 10 ? 1 : 0)} ${units[i]}`;
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
