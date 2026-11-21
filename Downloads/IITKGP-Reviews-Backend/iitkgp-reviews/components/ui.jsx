import Link from 'next/link';
import { courseTypes, minimumReviewCount } from '../lib/rating-metrics.js';

export function CourseBadge({ value }) {
  return <span className={'badge' + (value === 'project_based' ? ' project-badge' : '')}>{courseTypes[value]}</span>;
}

export function DemoBadge({ show }) {
  return show ? <span className="badge demo-badge">Demo data</span> : null;
}

export function RatingBadge({ average, count }) {
  return (
    <span className="rating-badge">
      {!count ? <span>No reviews yet</span> : count < minimumReviewCount || average == null ?
        <span className="badge limited-badge">Limited data · {count} {count === 1 ? 'review' : 'reviews'}</span> : <><span className="star" aria-hidden="true">★</span><strong>{Number(average).toFixed(1)}<span className="sr-only"> out of 5</span></strong><span>·</span><span>{count} {count === 1 ? 'review' : 'reviews'}</span></>}
    </span>
  );
}

export function PageIntro({ label, title, children }) {
  return <div className="page-intro"><p className="kicker">{label}</p><h1>{title}</h1>{children && <p>{children}</p>}</div>;
}

export function StatePanel({ state, next = '/', busy = 'Loading…' }) {
  if (state.pending) return <div className="state-panel" role="status">{busy}</div>;
  if (!state.error) return null;
  if (state.error.status === 401) return (
    <div className="state-panel"><h2>Sign in to continue</h2><p>Use your verified institute email to access student reviews.</p>
      <Link className="button primary" href={'/sign-in?next=' + encodeURIComponent(next)}>Sign in with institute email <span aria-hidden="true">↗</span></Link>
    </div>
  );
  if (state.error.status === 404) return <div className="state-panel"><h2>Page not found</h2><p>This record could not be found.</p><Link href="/" className="button quiet">Go home</Link></div>;
  return <div className="state-panel" role="alert"><h2>Couldn’t load this page</h2><p>{state.error.message}</p><button className="button quiet" type="button" onClick={state.retry}>Try again</button></div>;
}

export function PageNav({ offset, nextOffset, href }) {
  if (!offset && nextOffset === null) return null;
  return <nav className="page-nav" aria-label="Results pages">
    {offset > 0 && <Link className="button quiet" href={href(Math.max(0, offset - 12))}>← Previous</Link>}
    {nextOffset !== null && <Link className="button quiet" href={href(nextOffset)}>Next →</Link>}
  </nav>;
}

export function termName(term) {
  return term.semester.charAt(0).toUpperCase() + term.semester.slice(1) + ' ' + term.academic_year;
}
