'use client';

import Link from 'next/link';
import { contextNames, metrics, minimumReviewCount } from '../lib/rating-metrics.js';
import { useRouter } from 'next/navigation';
import { ReportReview } from './report-review.jsx';
import { queryString } from './api.js';
import { useData } from './use-data.js';
import { CourseBadge, DemoBadge, PageNav, RatingBadge, StatePanel, termName } from './ui.jsx';

function RatingBreakdown({ context, values }) {
  const rows = Object.entries(metrics[context]).filter(([key]) => Number.isFinite(values[key]));
  if (!rows.length) return null;
  return (
    <div className="rating-breakdown">
      <h3>{contextNames[context]}</h3>
      {rows.map(([key, label]) => <div className="rating-row" key={key}>
        <span>{label}</span><span className="rating-track" aria-hidden="true"><span style={{ width: (values[key] * 20) + '%' }}/></span>
        <strong>{values[key].toFixed(1)}<span className="sr-only"> out of 5</span></strong>
      </div>)}
    </div>
  );
}

function Assignments({ item, courses }) {
  const unique = new Map();
  for (const assignment of item.assignments) {
    const id = courses ? assignment.professor_id : assignment.course_id;
    if (!unique.has(id)) {
      unique.set(id, {
        href: '/' + (courses ? 'professors' : 'courses') + '/' + id,
        name: courses ? assignment.professor_name : assignment.course_title,
        code: courses ? null : assignment.course_code,
        terms: [],
      });
    }
    unique.get(id).terms.push(termName(assignment));
  }
  return (
    <section className="detail-panel">
      <h2>{courses ? 'Associated professors' : 'Courses taught'}</h2>
      {unique.size ? <ul className="relation-list">{Array.from(unique, ([id, relation]) =>
        <li key={id}><div>{relation.code && <span className="card-label">{relation.code}</span>}
          <Link href={relation.href}>{relation.name} <span aria-hidden="true">↗</span></Link></div>
          <span className="relation-terms">{relation.terms.join(' · ')}</span></li>)}</ul> :
        <p className="muted">No teaching assignments are listed.</p>}
    </section>
  );
}

function ReviewCard({ item, courses }) {
  const counterpart = courses ? item.professor_name : item.course_code;
  const labels = item.project_topics ? { ...metrics.teaching, ...metrics.projectCourse } : metrics[item.context];
  return <article className="review-card">
    <div className="review-meta"><span className={'badge' + (item.context === 'project' ? ' project-badge' : '')}>{contextNames[item.context]}</span><span>{termName(item)}</span>
      {counterpart && <span>{counterpart}</span>}<DemoBadge show={item.is_demo} /></div>
    {item.feedback ? <p className="review-text">{item.feedback}</p> : <p className="muted">Ratings only</p>}
    <ul className="review-metrics">{Object.entries(labels).filter(([key]) => Number.isInteger(item.ratings?.[key])).map(([key, label]) =>
      <li key={key}>{label} <strong>{item.ratings[key]}/5</strong></li>)}</ul>
    {item.project_types?.length > 0 && <p className="project-mentions"><strong>Project types</strong> {item.project_types.join(' · ')}</p>}
    {item.project_topics && <p className="project-mentions"><strong>Project topics</strong> {item.project_topics}</p>}
    <ReportReview id={item.id} />
  </article>;
}

export function Details({ id, resource, offset: rawOffset, termId }) {
  const router = useRouter();
  const courses = resource === 'courses';
  const parent = '/' + resource;
  const endpoint = resource + '/' + encodeURIComponent(id);
  const offset = typeof rawOffset === 'string' && /^\d+$/.test(rawOffset) ? Math.min(Number(rawOffset), 1000000) : 0;
  const detail = useData(endpoint + queryString({ termId }));
  const catalog = useData(detail.data ? 'catalog' : null);
  const reviewEndpoint = 'reviews' + queryString({ [courses ? 'courseId' : 'professorId']: id, termId, limit: 12, offset });
  const reviews = useData(detail.data ? reviewEndpoint : null);
  const next = '/' + endpoint + queryString({ termId, offset: offset || undefined });
  const item = detail.data;
  if (!item) return <div className="wrap inner-page"><Link className="back-link" href={parent}>← Browse {resource}</Link>
    <StatePanel state={detail} next={next} busy="Loading details…" /></div>;

  const projectInfo = item.course_type === 'project_based' || item.project_types.length > 0;
  return (
    <div className="wrap inner-page detail-page">
      <Link className="back-link" href={parent}>← Browse {resource}</Link>
      <div className="detail-hero">
        <div><p className="kicker">{courses ? item.code : 'Professor'}</p>
          <h1>{courses ? item.title : item.name}</h1>
          <div className="detail-meta"><span>{item.department}</span>{courses && <CourseBadge value={item.course_type}/>}<DemoBadge show={item.is_demo} /></div>
        </div>
        <Link href={'/reviews/new' + queryString({ [courses ? 'courseId' : 'professorId']: id })} className="button primary">Write a review <span aria-hidden="true">↗</span></Link>
      </div>
      <div className="detail-grid">
        <section className="detail-panel">
          <div className="summary-head"><h2>Overall ratings</h2><RatingBadge average={item.average_rating} count={item.review_count} /></div>
          {item.is_demo && <p className="muted">This is a fictional demo record. Any reviews here are test submissions.</p>}
          {catalog.data && <label className="term-filter">Academic term<select className="input" value={termId ?? ''}
            onChange={event => router.push('/' + endpoint + queryString({ termId: event.target.value }))}>
            <option value="">All academic terms</option>
            {catalog.data.terms.map(term => <option key={term.id} value={term.id}>{termName(term)}</option>)}
          </select></label>}
          {item.average_rating != null ? <><p className="muted">Overall is the average of review scores. Workload is shown separately on a 1–5 scale from light to heavy.</p>
            <RatingBreakdown context="teaching" values={item.rating_breakdowns.teaching} />
            <RatingBreakdown context="project" values={item.rating_breakdowns.project} />
            {Object.keys(item.rating_breakdowns.teaching).length + Object.keys(item.rating_breakdowns.project).length === 0 &&
              <p className="muted">Each rating category needs at least {minimumReviewCount} responses before its average appears.</p>}</> : <p className="muted">Averages appear once at least {minimumReviewCount} reviews are available for this period.</p>}
        </section>
        <div className="detail-sidebar">
          <Assignments item={item} courses={courses}/>
          {projectInfo && <section className="detail-panel"><h2>Project types reported</h2>
            {item.project_types.length ? <ul className="project-types">{item.project_types.map(project =>
              <li key={project.label}><span>{project.label}</span><span>{project.review_count} {project.review_count === 1 ? 'review' : 'reviews'}</span></li>)}</ul>
              : <p className="muted">Project details will appear when students share their experiences.</p>}
          </section>}
        </div>
      </div>
      <section className="reviews-section" aria-labelledby="student-reviews">
        <div className="section-heading"><h2 id="student-reviews">Student reviews</h2></div>
        <StatePanel state={reviews} next={next} busy="Loading reviews…" />
        {reviews.data && <>
          {reviews.data.items.length ? <div className="review-list">{reviews.data.items.map(review => <ReviewCard key={review.id} item={review} courses={courses} />)}</div>
            : <div className="state-panel"><h3>No reviews yet</h3><p>Be the first to share your experience.</p></div>}
          <PageNav offset={offset} nextOffset={reviews.data.nextOffset} href={page => '/' + endpoint + queryString({ termId, offset: page || undefined }) + '#student-reviews'} />
        </>}
      </section>
    </div>
  );
}
