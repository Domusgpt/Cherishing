import type { ReactNode } from 'react';
import './EmptyState.css';

/** A warm, encouraging empty state — never a dead end. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty panel">
      <div className="empty__icon" aria-hidden="true">
        {icon}
      </div>
      <h2 className="empty__title">{title}</h2>
      {children && <p className="empty__body">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}
