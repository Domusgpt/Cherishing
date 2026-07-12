import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ChunkyButton.css';

type Variant = 'primary' | 'quiet' | 'danger';
type Size = 'md' | 'lg';

interface ChunkyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  block?: boolean;
  children: ReactNode;
}

/**
 * The tactile press button used everywhere. Raised at rest; on :active it
 * translates down 1px and inverts to an inset shadow so it feels physically
 * pressed. Always at least --tap-min tall for older hands and touch.
 */
export function ChunkyButton({
  variant = 'quiet',
  size = 'md',
  icon,
  block = false,
  children,
  className,
  type = 'button',
  ...rest
}: ChunkyButtonProps) {
  const classes = [
    'chunky',
    `chunky--${variant}`,
    `chunky--${size}`,
    block ? 'chunky--block' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={classes} type={type} {...rest}>
      {icon != null && (
        <span className="chunky__icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="chunky__label">{children}</span>
    </button>
  );
}
