import { matchRoute, useRoute, Link, useTopSegment } from './router/router.tsx';
import { ShelfScreen } from './screens/ShelfScreen.tsx';
import { MemoryLibraryScreen } from './screens/MemoryLibraryScreen.tsx';
import { MemoryDetailScreen } from './screens/MemoryDetailScreen.tsx';
import { AddMemoryWizard } from './screens/AddMemoryWizard.tsx';
import { StoryBuilderScreen } from './screens/StoryBuilderScreen.tsx';
import { PlaybackScreen } from './screens/PlaybackScreen.tsx';
import { SettingsScreen } from './screens/SettingsScreen.tsx';
import { NotFoundScreen } from './screens/NotFoundScreen.tsx';

/** Playback is full-bleed (its own chrome), so it renders outside the shell. */
function renderRoute(path: string) {
  let m: Record<string, string> | null;

  if (matchRoute('/', path)) return { chrome: true, node: <ShelfScreen /> };
  if (matchRoute('/memories', path)) return { chrome: true, node: <MemoryLibraryScreen /> };
  if (matchRoute('/memories/new', path)) return { chrome: true, node: <AddMemoryWizard /> };
  if ((m = matchRoute('/memories/:id', path))) return { chrome: true, node: <MemoryDetailScreen id={m.id!} /> };
  if (matchRoute('/stories/new', path)) return { chrome: true, node: <StoryBuilderScreen /> };
  if ((m = matchRoute('/stories/:id/edit', path))) return { chrome: true, node: <StoryBuilderScreen id={m.id!} /> };
  if ((m = matchRoute('/stories/:id/play', path))) return { chrome: false, node: <PlaybackScreen id={m.id!} /> };
  if (matchRoute('/settings', path)) return { chrome: true, node: <SettingsScreen /> };

  return { chrome: true, node: <NotFoundScreen /> };
}

function TopBar() {
  const seg = useTopSegment();
  return (
    <header className="topbar">
      <Link to="/" className="topbar__brand">
        <span className="topbar__dot" aria-hidden="true" />
        Cherishing
      </Link>
      <span className="topbar__spacer" />
      <nav aria-label="Main" className="row">
        <Link to="/" className="topbar__link" aria-current={seg === '/' ? 'page' : undefined}>
          Shelf
        </Link>
        <Link
          to="/memories"
          className="topbar__link"
          aria-current={seg === '/memories' ? 'page' : undefined}
        >
          Memories
        </Link>
        <Link
          to="/settings"
          className="topbar__link"
          aria-current={seg === '/settings' ? 'page' : undefined}
        >
          Settings
        </Link>
      </nav>
    </header>
  );
}

export function App() {
  const path = useRoute();
  const { chrome, node } = renderRoute(path);

  if (!chrome) {
    return <div className="grain-overlay">{node}</div>;
  }

  return (
    <div className="app-shell grain-overlay">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopBar />
      <main id="main" className="app-main" tabIndex={-1}>
        {node}
      </main>
    </div>
  );
}
