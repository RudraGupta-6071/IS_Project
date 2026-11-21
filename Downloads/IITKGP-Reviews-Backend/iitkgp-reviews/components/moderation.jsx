'use client';

import Link from 'next/link';
import { useState } from 'react';
import { reportReasons } from '../lib/report-reasons.js';
import { contextNames, metrics } from '../lib/rating-metrics.js';
import { api, queryString } from './api.js';
import { PageIntro, PageNav, StatePanel, termName } from './ui.jsx';
import { useData } from './use-data.js';

export function Moderation({ queue, offset }) {
  const href = (value = offset) => '/moderation' + queryString({ queue, offset: value || undefined });
  const reviews = useData('moderation' + queryString({ queue, offset, limit: 12 }));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function decide(id, action) {
    if (busy) return;
    setBusy(true);
    setStatus('');
    setError('');
    try {
      await api('moderation/' + id, { method: 'PATCH', body: JSON.stringify({ action }) });
      setStatus({ hide: 'Review hidden.', restore: 'Review restored.', dismiss: 'Reports dismissed.' }[action]);
      reviews.retry();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="wrap inner-page review-form-page">
    <PageIntro label="Administration" title="Review moderation" />
    <nav className="review-actions" aria-label="Moderation queues">
      <Link href="/moderation" className={'button ' + (queue === 'reported' ? 'primary' : 'quiet')}>Open reports</Link>
      <Link href="/moderation?queue=hidden" className={'button ' + (queue === 'hidden' ? 'primary' : 'quiet')}>Hidden reviews</Link>
    </nav>
    {status && <p className="form-success" role="status">{status}</p>}
    {error && <p className="input-error" role="alert">{error} <button className="text-button" onClick={reviews.retry}>Reload queue</button></p>}
    <StatePanel state={reviews} next={href()} busy="Loading moderation queue…" />
    {reviews.data && <>
      {reviews.data.items.length === 0 && <div className="state-panel">No reviews on this page.</div>}
      <div className="review-list">{reviews.data.items.map(item => {
        const labels = item.project_topics ? { ...metrics.teaching, ...metrics.projectCourse } : metrics[item.context];
        return <article className="review-card" key={item.id}>
          <h2>{[item.course_code, item.professor_name].filter(Boolean).join(' · ')}</h2>
          <p className="muted">{termName(item)} · {contextNames[item.context]}</p>
          {item.feedback && <p className="review-text">{item.feedback}</p>}
          {item.project_types.length > 0 && <p>Project types · {item.project_types.join(' · ')}</p>}
          {item.project_topics && <p>Project topics · {item.project_topics}</p>}
          <ul className="review-metrics">{Object.entries(labels).filter(([key]) => Number.isInteger(item.ratings?.[key]))
            .map(([key, label]) => <li key={key}>{label} <strong>{item.ratings[key]}/5</strong></li>)}</ul>
          {item.reports.length > 0 && <ul>{item.reports.map((report, index) =>
            <li key={index}><strong>{reportReasons[report.reason]}</strong>{report.details && <p>{report.details}</p>}</li>)}</ul>}
          <div className="review-actions">
            {item.is_hidden ? <button className="button quiet" disabled={busy} onClick={() => decide(item.id, 'restore')}>Restore review</button> : <>
              <button className="button primary" disabled={busy} onClick={() => decide(item.id, 'hide')}>Hide review</button>
              <button className="button quiet" disabled={busy} onClick={() => decide(item.id, 'dismiss')}>Dismiss reports</button>
            </>}
          </div>
        </article>;
      })}</div>
      <PageNav offset={offset} nextOffset={reviews.data.nextOffset} href={href} />
    </>}
  </div>;
}
