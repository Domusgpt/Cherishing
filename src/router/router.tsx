import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';

/**
 * A tiny hash router. Hash routing needs no server rewrite config, so the
 * built app works from any static host or a bare file:// path.
 */

function currentHash(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : '/' + raw;
}

export function useRoute(): string {
  const [path, setPath] = useState<string>(() => currentHash());
  useEffect(() => {
    const onChange = () => setPath(currentHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

export function navigate(to: string): void {
  const target = to.startsWith('/') ? to : '/' + to;
  if (currentHash() === target) return;
  window.location.hash = target;
}

/** Match a route pattern like "/stories/:id/play" against a concrete path. */
export function matchRoute(
  pattern: string,
  path: string,
): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('?')[0]!.split('/').filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    const val = a[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return params;
}

/** Parse the `?a=b` portion of a hash path into a plain object. */
export function parseQuery(path: string): Record<string, string> {
  const q = path.split('?')[1];
  if (!q) return {};
  const out: Record<string, string> = {};
  for (const pair of q.split('&')) {
    const [k, v = ''] = pair.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return out;
}

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  children: ReactNode;
}

export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const href = '#' + (to.startsWith('/') ? to : '/' + to);
  const handle = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      // Let modified clicks (new tab) behave normally.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(to);
    },
    [onClick, to],
  );
  return (
    <a href={href} onClick={handle} {...rest}>
      {children}
    </a>
  );
}

/** Convenience: the first path segment, for highlighting nav items. */
export function useTopSegment(): string {
  const path = useRoute();
  return useMemo(() => '/' + (path.split('?')[0]!.split('/').filter(Boolean)[0] ?? ''), [path]);
}
