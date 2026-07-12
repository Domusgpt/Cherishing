import type { ReactNode } from 'react';
import { ChunkyButton } from './ChunkyButton.tsx';
import './WizardShell.css';

/**
 * A calm one-question-per-screen frame. Shows clear progress ("Step 2 of 5"),
 * a big heading, optional plain-language help, and large Back / Next controls.
 */
export function WizardShell({
  stepIndex,
  stepCount,
  title,
  help,
  children,
  onBack,
  onNext,
  nextLabel = 'Next',
  backLabel = 'Back',
  nextDisabled = false,
  onCancel,
}: {
  stepIndex: number;
  stepCount: number;
  title: string;
  help?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  onCancel?: () => void;
}) {
  const pct = Math.round(((stepIndex + 1) / stepCount) * 100);
  return (
    <section className="wizard" aria-labelledby="wizard-title">
      <div className="wizard__head">
        <p className="wizard__step">
          Step {stepIndex + 1} of {stepCount}
        </p>
        {onCancel && (
          <button className="wizard__cancel" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <div className="wizard__track" aria-hidden="true">
        <div className="wizard__fill" style={{ width: `${pct}%` }} />
      </div>

      <h1 className="wizard__title" id="wizard-title">
        {title}
      </h1>
      {help && <p className="wizard__help">{help}</p>}

      <div className="wizard__body">{children}</div>

      <div className="wizard__actions">
        {onBack ? (
          <ChunkyButton onClick={onBack} size="lg">
            {backLabel}
          </ChunkyButton>
        ) : (
          <span />
        )}
        <ChunkyButton variant="primary" size="lg" onClick={onNext} disabled={nextDisabled}>
          {nextLabel}
        </ChunkyButton>
      </div>
    </section>
  );
}
