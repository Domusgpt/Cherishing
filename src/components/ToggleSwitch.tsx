import { useId } from 'react';
import './ToggleSwitch.css';

/** A large, obvious on/off switch with a real inset track and raised knob. */
export function ToggleSwitch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <label className="toggle" htmlFor={id}>
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint && <span className="toggle__hint">{hint}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`toggle__switch ${checked ? 'toggle__switch--on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle__knob" />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </label>
  );
}
