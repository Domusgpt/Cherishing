import { useId } from 'react';
import type { ReactNode } from 'react';
import './TextField.css';

interface BaseProps {
  label: string;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

interface TextFieldProps extends BaseProps {
  multiline?: false;
  inputMode?: 'text' | 'numeric';
}
interface TextAreaProps extends BaseProps {
  multiline: true;
  rows?: number;
}

/**
 * A labelled input. The label is always visible above the field (never a
 * placeholder standing in for a label) so it stays readable for everyone.
 */
export function TextField(props: TextFieldProps | TextAreaProps) {
  const id = useId();
  const hintId = props.hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {props.label}
      </label>
      {props.hint && (
        <p className="field__hint" id={hintId}>
          {props.hint}
        </p>
      )}
      {props.multiline ? (
        <textarea
          id={id}
          className="field__control field__control--area"
          value={props.value}
          rows={props.rows ?? 6}
          placeholder={props.placeholder}
          aria-describedby={hintId}
          autoFocus={props.autoFocus}
          onChange={(e) => props.onChange(e.target.value)}
        />
      ) : (
        <input
          id={id}
          className="field__control"
          type="text"
          inputMode={props.inputMode ?? 'text'}
          value={props.value}
          placeholder={props.placeholder}
          aria-describedby={hintId}
          autoFocus={props.autoFocus}
          onChange={(e) => props.onChange(e.target.value)}
        />
      )}
    </div>
  );
}
