import type { ReactNode } from 'react';
import './CrtFrame.css';

/**
 * A rounded CRT television bezel with an inner screen, amber glow, and
 * scanline overlay. Wraps whatever is "on screen" during playback.
 */
export function CrtFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`crt ${className ?? ''}`}>
      <div className="crt__bezel">
        <div className="crt__screen scanlines">
          <div className="crt__vignette" aria-hidden="true" />
          {children}
        </div>
      </div>
    </div>
  );
}
