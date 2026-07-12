import { useId, useState } from 'react';
import './ChipsInput.css';

/**
 * A friendly tag/name entry: type a word, press Enter (or tap Add) to make a
 * chip. Each chip has a big remove button. No free-floating placeholder labels.
 */
export function ChipsInput({
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [text, setText] = useState('');

  function add() {
    const v = text.trim();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...values, v]);
    }
    setText('');
  }

  function remove(v: string) {
    onChange(values.filter((x) => x !== v));
  }

  return (
    <div className="chips">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {hint && <p className="field__hint">{hint}</p>}
      <div className="chips__row">
        <input
          id={id}
          className="field__control chips__input"
          type="text"
          value={text}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="chips__add" onClick={add} disabled={!text.trim()}>
          Add
        </button>
      </div>
      {values.length > 0 && (
        <ul className="chips__list">
          {values.map((v) => (
            <li key={v} className="chips__chip">
              <span>{v}</span>
              <button
                type="button"
                className="chips__remove"
                onClick={() => remove(v)}
                aria-label={`Remove ${v}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
