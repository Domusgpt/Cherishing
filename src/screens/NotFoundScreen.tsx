import { Link } from '../router/router.tsx';

export function NotFoundScreen() {
  return (
    <div className="stack">
      <h1 className="page-title">We couldn't find that page</h1>
      <p className="page-lead">The link may be old. Let's head back to your shelf.</p>
      <p>
        <Link to="/">Go to the shelf</Link>
      </p>
    </div>
  );
}
