import { ChunkyButton } from '../components/ChunkyButton.tsx';
import { navigate } from '../router/router.tsx';
import './AddMemoryWizard.css';

/**
 * The "memory saved" confirmation, on its own route so that leaving it fully
 * unmounts the wizard — returning to /memories/new then always starts fresh.
 */
export function MemorySavedScreen({ id }: { id: string }) {
  return (
    <div className="wizard-done stack center">
      <div className="wizard-done__badge" aria-hidden="true">
        ✓
      </div>
      <h1 className="page-title">Memory saved</h1>
      <p className="page-lead">It's safely tucked into your memory box.</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <ChunkyButton variant="primary" size="lg" onClick={() => navigate('/memories/new')}>
          Add another
        </ChunkyButton>
        <ChunkyButton size="lg" onClick={() => navigate(`/memories/${id}`)}>
          See my memory
        </ChunkyButton>
      </div>
    </div>
  );
}
