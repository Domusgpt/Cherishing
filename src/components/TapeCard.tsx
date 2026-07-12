import { Link } from '../router/router.tsx';
import './TapeCard.css';

/**
 * A VHS cassette standing on the shelf. The label is tinted by the story's
 * spineHue. Spools rotate gently on hover unless motion is reduced.
 */
export function TapeCard({
  to,
  title,
  subtitle,
  hue,
  count,
}: {
  to: string;
  title: string;
  subtitle?: string;
  hue: number;
  count: number;
}) {
  const labelStyle = { ['--label-hue' as string]: String(hue) } as React.CSSProperties;
  return (
    <Link to={to} className="tape" style={labelStyle} aria-label={`Play story: ${title}`}>
      <div className="tape__shell">
        <div className="tape__spools" aria-hidden="true">
          <span className="tape__spool" />
          <span className="tape__spool" />
        </div>
        <div className="tape__window" aria-hidden="true" />
        <div className="tape__label label-texture">
          <span className="tape__label-title">{title}</span>
          {subtitle && <span className="tape__label-sub">{subtitle}</span>}
          <span className="tape__label-count">
            {count} {count === 1 ? 'chapter' : 'chapters'}
          </span>
        </div>
      </div>
      <span className="tape__play" aria-hidden="true">
        ▶ Play
      </span>
    </Link>
  );
}
