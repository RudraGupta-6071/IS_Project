'use client';

import Link from 'next/link';
import { contextNames } from '../lib/rating-metrics.js';
import { queryString } from './api.js';
import { PageIntro, PageNav, StatePanel, termName } from './ui.jsx';
import { useData } from './use-data.js';

export function MyReviews({ offset: raw }) {
  const offset = typeof raw === 'string' && /^\d+$/.test(raw) ? Math.min(Number(raw), 1000000) : 0;
  const href = value => '/reviews/mine' + queryString({ offset: value || undefined });
  const reviews = useData('reviews/mine' + queryString({ limit: 12, offset }));
  return <div className="wrap inner-page review-form-page">
    <PageIntro label="Student reviews" title="My reviews">Find and edit reviews you’ve submitted.</PageIntro>
    <StatePanel state={reviews} next={href(offset)} busy="Loading your reviews…" />
    {reviews.data && <>
      {reviews.data.items.length ? <ul className="relation-list detail-panel">
        {reviews.data.items.map(item => (
          <li key={item.id}><div>
            <strong>{[item.course_code, item.professor_name].filter(Boolean).join(' · ')}</strong>
            <p className="muted">{termName(item)} · {contextNames[item.context]}</p>
            {item.is_hidden && <span className="badge limited-badge">Hidden by moderation</span>}
          </div><Link className="button quiet compact" href={'/reviews/edit/' + item.id}>Edit review</Link></li>
        ))}
      </ul> : <div className="state-panel"><h2>No reviews on this page</h2><Link href="/reviews/new" className="button primary">Write a review</Link></div>}
      <PageNav offset={offset} nextOffset={reviews.data.nextOffset} href={href} />
    </>}
  </div>;
}
