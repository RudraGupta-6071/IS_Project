'use client';

import Link from 'next/link';
import { useState } from 'react';
import { contextNames, metrics } from '../lib/rating-metrics.js';
import { api, queryString } from './api.js';
import { SearchField } from './search.jsx';
import { useData } from './use-data.js';
import { PageIntro, StatePanel, termName } from './ui.jsx';

function ReviewPicker() {
  const [resource, setResource] = useState('courses');
  const [q, setQuery] = useState('');
  const courses = resource === 'courses';
  const results = useData(resource + queryString({ q, limit: 6 }));
  const field = courses ? 'courseId' : 'professorId';
  return <section className="detail-panel picker">
    <h2>Choose what to review</h2>
    <div className="segment-group">
      <button type="button" aria-pressed={courses} onClick={() => { setResource('courses'); setQuery(''); }}>Course</button>
      <button type="button" aria-pressed={!courses} onClick={() => { setResource('professors'); setQuery(''); }}>Professor</button>
    </div>
    <form className="inline-search" key={resource} onSubmit={event => {
      event.preventDefault();
      setQuery(String(new FormData(event.currentTarget).get('q')).trim());
    }}>
      <SearchField label={courses ? 'Find a course to review' : 'Find a professor to review'}
        placeholder={courses ? 'Course name or code' : 'Professor name'} />
      <button className="button primary" type="submit">Find</button>
    </form>
    <StatePanel state={results} next="/reviews/new" busy="Finding records…" />
    {results.data && (results.data.items.length ? <ul className="relation-list">{results.data.items.map(item =>
      <li key={item.id}><div>{courses && <span className="card-label">{item.code}</span>}
        <Link href={'/reviews/new' + queryString({ [field]: item.id })}>{courses ? item.title : item.name} <span aria-hidden="true">↗</span></Link></div>
        <span className="relation-terms">{item.department}</span></li>)}</ul> : <p>No matching records.</p>)}
    {results.data?.nextOffset != null &&
      <p><Link className="text-button" href={'/' + resource + queryString({ q })}>See all matches in the directory</Link></p>}
  </section>;
}

function RatingGroup({ title, labels, ratings = {} }) {
  return <fieldset className="rating-fields">
    <legend>{title} · Required</legend>
    <div className="ratings-form-grid">{Object.entries(labels).map(([key, label]) => (
      <fieldset className="star-field" key={key}>
        <legend>{label}</legend>
        <div className="star-options">{[1, 2, 3, 4, 5].map(value => (
          <label key={value}>
            <input className="sr-only" type="radio" name={key} value={value} required defaultChecked={ratings[key] === value} />
            <span aria-hidden="true">★</span><span className="sr-only">{value} out of 5</span>
          </label>
        ))}</div>
      </fieldset>
    ))}</div>
  </fieldset>;
}

function ReviewFields({ context, courseReview, existing }) {
  const project = context === 'project';
  const legacy = courseReview && project && existing && !existing.project_topics;
  const ratings = legacy ? { ...existing.ratings, projectGrading: existing.ratings.grading,
    projectWorkload: existing.ratings.workload, grading: undefined, workload: undefined } : existing?.ratings;
  return <>
    <p className="muted">Ratings are required. For workload, 1 means light and 5 means heavy.</p>
    {(!project || courseReview) && <RatingGroup title="Course ratings" labels={metrics.teaching} ratings={ratings} />}
    {project && <>
      <RatingGroup title="Project ratings" labels={courseReview ? metrics.projectCourse : metrics.project} ratings={ratings} />
      <label>Project types (required)
        <input className="input" name="projectTypes" placeholder="Simulation, literature review" maxLength={648}
          defaultValue={existing?.project_types.join(', ')} required />
        <span className="field-note">Enter up to eight types, separated by commas.</span>
      </label>
      {courseReview && <label>Project topics (required)
        <textarea className="input" name="projectTopics" rows={2} maxLength={600}
          placeholder="For example, simulating airport check-in queues" defaultValue={existing?.project_topics ?? ''} required />
      </label>}
    </>}
    <label>Written review (optional)
      <textarea className="input" name="feedback" rows={4} maxLength={3000} defaultValue={existing?.feedback ?? ''}
        placeholder="What would you tell a student considering this course or professor?" />
      <span className="field-note">Leave out names, roll numbers, and contact details.</span>
    </label>
  </>;
}

function ReviewForm({ target, terms, courseId, next, existing }) {
  const [selection, setSelection] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [sending, setSending] = useState(false);
  const assignment = target?.assignments.find(row => row.id === selection);
  const independent = selection === 'independent';
  const context = existing?.context ?? (independent || assignment?.course_type === 'project_based' ? 'project' : 'teaching');
  const courseReview = Boolean(existing ? existing.course_id : assignment);
  const title = existing?.course_title ?? existing?.professor_name ?? target?.title ?? target?.name;
  const detailUrl = existing ? '/reviews/mine' : courseId ? '/courses/' + target.id : '/professors/' + target.id;

  async function submit(event) {
    event.preventDefault();
    if (sending || (!existing && !assignment && !independent)) return;
    const form = new FormData(event.currentTarget);
    const labels = context === 'teaching' ? metrics.teaching : courseReview
      ? { ...metrics.teaching, ...metrics.projectCourse } : metrics.project;
    const ratings = Object.fromEntries(Object.keys(labels).map(key => [key, Number(form.get(key))]));
    const payload = { context, ratings, feedback: form.get('feedback') };
    if (!existing) {
      payload.professorId = assignment?.professor_id ?? target.id;
      payload.termId = assignment?.term_id ?? form.get('termId');
      if (assignment) payload.assignmentId = assignment.id;
    }
    if (context === 'project') {
      payload.projectTypes = String(form.get('projectTypes')).split(',').map(value => value.trim()).filter(Boolean);
      if (courseReview) payload.projectTopics = form.get('projectTopics');
    }
    setOutcome(null);
    setSending(true);
    try {
      const result = await api(existing ? 'reviews/' + existing.id : 'reviews', {
        method: existing ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      });
      setOutcome({ id: result.id });
    } catch (failure) {
      setOutcome({ error: failure });
    } finally {
      setSending(false);
    }
  }
  return <section className="detail-panel">
    <h2>{title}</h2>
    {outcome?.id ? <div className="form-success" role="status">
      <p>{existing ? 'Your changes were saved.' : 'Your review was posted.'}</p>
      <div className="review-actions">
        <Link href={detailUrl} className="button primary">{existing ? 'My reviews' : 'View reviews'}</Link>
        {!existing && <Link href={'/reviews/edit/' + outcome.id} className="button quiet">Edit review</Link>}
      </div>
    </div> : <form className="stack compose-form" onSubmit={submit}>
      {existing ? <p className="muted">{[existing.course_title && existing.professor_name, termName(existing), contextNames[context]].filter(Boolean).join(' · ')}</p> :
        <>
          <label>Course assignment (required)<select className="input" value={selection}
            onChange={event => { setSelection(event.target.value); setOutcome(null); }} required>
            <option value="" disabled>Choose a course and term</option>
            {target.assignments.map(row => <option key={row.id} value={row.id}>
              {courseId ? row.professor_name : row.course_code + ' · ' + row.course_title} · {termName(row)}
            </option>)}
            {!courseId && <option value="independent">Independent project supervision</option>}
          </select></label>
          {!target.assignments.length && courseId && <p className="muted">No course assignments are available.</p>}
          {independent && <label>Academic term (required)<select className="input" name="termId" defaultValue="" required>
            <option value="" disabled>Choose the term</option>
            {terms.map(term => <option key={term.id} value={term.id}>{termName(term)}</option>)}
          </select></label>}
        </>}
      {(existing || selection) && <ReviewFields key={existing?.id ?? selection} context={context} courseReview={courseReview} existing={existing} />}
      {outcome?.error && <p className="input-error" role="alert">{outcome.error.message}
        {outcome.error.status === 401 && <> <Link href={'/sign-in?next=' + encodeURIComponent(next)}>Sign in again</Link></>}
        {outcome.error.status === 409 && <> <Link href="/reviews/mine">Find your existing review</Link></>}
      </p>}
      <button className="button primary" type="submit" disabled={(!existing && !selection) || sending}>
        {sending ? 'Saving…' : existing ? 'Save changes' : 'Post review'}
      </button>
    </form>}
  </section>;
}

export function ReviewEditor({ id }) {
  const next = '/reviews/edit/' + encodeURIComponent(id);
  const review = useData('reviews/mine/' + encodeURIComponent(id));
  return <div className="wrap inner-page review-form-page">
    <PageIntro label="My reviews" title="Edit review" />
    <Link className="back-link" href="/reviews/mine">← My reviews</Link>
    <StatePanel state={review} next={next} busy="Loading your review…" />
    {review.data && <ReviewForm key={id} existing={review.data} next={next} />}
  </div>;
}

export function ReviewComposer({ courseId, professorId }) {
  const resource = courseId ? 'courses' : 'professors';
  const id = courseId || professorId;
  const catalog = useData(id ? 'catalog' : null);
  const target = useData(id ? resource + '/' + id : null);
  const next = '/reviews/new' + queryString({ courseId, professorId });
  return <div className="wrap inner-page review-form-page">
    <PageIntro label="Student reviews" title="Write a review">Share what you experienced. Your account information is kept private.</PageIntro>
    <Link className="back-link my-review-link" href="/reviews/mine">My reviews ↗</Link>
    {id ? <>
      <Link className="back-link" href="/reviews/new">← Choose a different course or professor</Link>
      <StatePanel state={target} next={next} busy="Loading review options…" />
      {target.data && (catalog.data ? <ReviewForm target={target.data} terms={catalog.data.terms} courseId={courseId} next={next} />
        : <StatePanel state={catalog} next={next} busy="Loading academic terms…" />)}
    </> : <ReviewPicker />}
  </div>;
}
