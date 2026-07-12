import './Dial.css';

const HUES = [40, 15, 350, 320, 265, 210, 170, 110];

/**
 * A row of big color swatches for choosing a story's spine tint. Implemented as
 * a radiogroup so it's fully keyboard- and screen-reader-navigable.
 */
export function Dial({ value, onChange }: { value: number; onChange: (hue: number) => void }) {
  return (
    <div className="dial" role="radiogroup" aria-label="Tape label color">
      {HUES.map((hue) => {
        const selected = Math.abs(hue - value) < 8;
        return (
          <button
            key={hue}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`dial__swatch ${selected ? 'dial__swatch--on' : ''}`}
            style={{ background: `hsl(${hue}, 55%, 72%)` }}
            onClick={() => onChange(hue)}
          >
            <span className="sr-only">Color {hue}</span>
          </button>
        );
      })}
    </div>
  );
}
