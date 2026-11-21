import { z } from 'zod';
import { query } from './db.js';
import { contextType, page, pagination, uuid } from './catalog.js';
import { ApiError, body, json } from './http.js';

import { createInput, editInput } from './review-input.js';

const listInput = z.strictObject({
  ...pagination,
  courseId: uuid.optional(),
  professorId: uuid.optional(),
  termId: uuid.optional(),
  context: contextType.optional(),
});

export async function listReviews(request, ownerId = null) {
  const input = listInput.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows } = await query(`
    select r.id, r.offering_id, r.course_id, r.professor_id, r.term_id, r.context,
      r.ratings, r.feedback, r.project_types, r.project_topics, r.created_at, r.updated_at,
      p.name as professor_name, c.code as course_code,
      (pd.code = 'DEMO' or coalesce(cd.code = 'DEMO', false)) as is_demo${ownerId ? ', r.is_hidden' : ''},
      t.start_year || '-' || (t.start_year + 1) as academic_year, t.semester
    from review_app.${ownerId ? 'all_reviews' : 'student_reviews'} r
    join review_app.academic_terms t on t.id = r.term_id
    join review_app.professors p on p.id = r.professor_id
    left join review_app.courses c on c.id = r.course_id
    join review_app.departments pd on pd.id = p.department_id
    left join review_app.departments cd on cd.id = c.department_id
    where ($1::uuid is null or r.course_id = $1)
      and ($2::uuid is null or r.professor_id = $2)
      and ($3::uuid is null or r.term_id = $3)
      and ($4::text is null or r.context = $4)
      and ($5::uuid is null or exists (
        select 1 from review_app.reviews ownership where ownership.id = r.id and ownership.author_id = $5
      ))
    order by r.created_at desc, r.id desc limit $6 offset $7
  `, [input.courseId, input.professorId, input.termId, input.context, ownerId, input.limit + 1, input.offset]);
  return page(rows, input);
}

export async function ownedReview(studentId, id) {
  const { rows } = await query(`
    select r.id, r.course_id, r.professor_id, r.context, r.ratings, r.feedback,
      r.project_types, r.project_topics, r.is_hidden, p.name as professor_name, c.title as course_title,
      t.start_year || '-' || (t.start_year + 1) as academic_year, t.semester
    from review_app.all_reviews r
    join review_app.professors p on p.id = r.professor_id
    join review_app.academic_terms t on t.id = r.term_id
    left join review_app.courses c on c.id = r.course_id
    where r.id = $1 and exists (
      select 1 from review_app.reviews ownership where ownership.id = r.id and ownership.author_id = $2
    )
  `, [uuid.parse(id), studentId]);
  if (!rows.length) throw new ApiError(404, 'Editable review not found.');
  return rows[0];
}

export async function createReview(request, studentId) {
  const review = await body(request, createInput);
  const { rows } = await query(`
    insert into review_app.reviews
      (author_id, assignment_id, professor_id, term_id, context, ratings, feedback, project_types, project_topics)
    select $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::jsonb, $7::text, $8::text[], $9::text
    where $2::uuid is null or exists (
      select 1 from review_app.teaching_assignments a
      join review_app.course_offerings o on o.id = a.offering_id
      join review_app.courses c on c.id = o.course_id
      where a.id = $2 and a.professor_id = $3 and a.term_id = $4
        and c.course_type = case when $5 = 'project' then 'project_based' else 'regular' end
    )
    returning id
  `, [studentId, review.assignmentId, review.professorId, review.termId, review.context,
    review.ratings, review.feedback, review.projectTypes ?? [], review.projectTopics ?? null]);
  if (!rows.length) throw new ApiError(400, 'Select a valid course, professor, term, and review type.');
  return json(rows[0], 201);
}

export async function updateReview(request, studentId, id) {
  const existing = await ownedReview(studentId, id);
  const review = await body(request, editInput(existing));
  const { rows } = await query(`
    update review_app.reviews
    set ratings = $1, feedback = $2, project_types = $3, project_topics = $4, updated_at = now()
    where id = $5 and author_id = $6 returning id
  `, [review.ratings, review.feedback, review.projectTypes ?? [], review.projectTopics ?? null, existing.id, studentId]);
  if (!rows.length) throw new ApiError(404, 'Editable review not found.');
  return json(rows[0]);
}

export async function deleteReview(studentId, id) {
  const result = await query('delete from review_app.reviews where id = $1 and author_id = $2',
    [uuid.parse(id), studentId]);
  if (!result.rowCount) throw new ApiError(404, 'Editable review not found.');
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
}
