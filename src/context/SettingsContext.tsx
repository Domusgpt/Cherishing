import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * User comfort settings. Persisted to localStorage so the app remembers a
 * larger text size or high contrast the instant it reopens — we intentionally
 * do NOT wait for IndexedDB here so the very first paint is already correct.
 */

export type TextSize = 'normal' | 'large' | 'xl';

export interface Settings {
  textSize: TextSize;
  highContrast: boolean;
  reducedMotion: boolean;
}

const DEFAULTS: Settings = {
  textSize: 'normal',
  highContrast: false,
  reducedMotion: false,
};

const STORAGE_KEY = 'cherishing.settings.v1';

interface SettingsContextValue extends Settings {
  setTextSize: (size: TextSize) => void;
  setHighContrast: (on: boolean) => void;
  setReducedMotion: (on: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);

  // Reflect settings onto <html> as data-* attributes that the CSS reads.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = settings.textSize;
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal';
    if (settings.reducedMotion) root.dataset.motion = 'reduced';
    else delete root.dataset.motion;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage may be unavailable in private mode; settings still apply live */
    }
  }, [settings]);

  const setTextSize = useCallback((textSize: TextSize) => setSettings((s) => ({ ...s, textSize })), []);
  const setHighContrast = useCallback((highContrast: boolean) => setSettings((s) => ({ ...s, highContrast })), []);
  const setReducedMotion = useCallback((reducedMotion: boolean) => setSettings((s) => ({ ...s, reducedMotion })), []);

  const value = useMemo<SettingsContextValue>(
    () => ({ ...settings, setTextSize, setHighContrast, setReducedMotion }),
    [settings, setTextSize, setHighContrast, setReducedMotion],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
