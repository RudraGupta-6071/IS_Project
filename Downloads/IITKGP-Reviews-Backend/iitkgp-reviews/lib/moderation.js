import { z } from 'zod';
import { page, pagination, uuid } from './catalog.js';
import { query } from './db.js';
import { ApiError, body, json } from './http.js';
import { optionalText } from './user-text.js';

const reportInput = z.strictObject({
  reason: z.enum(['abuse', 'privacy', 'spam', 'other']),
  details: optionalText(500),
});
const actionInput = z.strictObject({ action: z.enum(['hide', 'restore', 'dismiss']) });
const queueInput = z.strictObject({ ...pagination, queue: z.enum(['reported', 'hidden']).default('reported') });

export async function reportReview(request, studentId, id) {
  const reviewId = uuid.parse(id);
  const { reason, details } = await body(request, reportInput);
  const { rows } = await query('select review_app.report_review($1, $2, $3, $4) as accepted',
    [studentId, reviewId, reason, details]);
  if (!rows[0].accepted) throw new ApiError(404, 'Review not available.');
  return json({ reported: true }, 202);
}

export async function canModerate(studentId) {
  const { rows } = await query('select review_app.is_moderator($1) as allowed', [studentId]);
  return rows[0].allowed;
}

async function requireModerator(studentId) {
  if (!(await canModerate(studentId))) throw new ApiError(403, 'Moderator access required.');
}

export async function moderationQueue(request, studentId) {
  await requireModerator(studentId);
  const input = queueInput.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows } = await query('select id, feedback, project_topics, project_types, ratings, context, course_code, professor_name, academic_year, semester, is_hidden, reports from review_app.moderation_queue($1, $2, $3, $4)',
    [studentId, input.queue, input.limit + 1, input.offset]);
  return page(rows, input);
}

export async function moderateReview(request, studentId, id) {
  await requireModerator(studentId);
  const reviewId = uuid.parse(id);
  const { action } = await body(request, actionInput);
  const { rows } = await query('select review_app.moderate_review($1, $2, $3) as changed',
    [studentId, reviewId, action]);
  if (!rows[0].changed) throw new ApiError(409, 'This review has changed. Reload the moderation queue.');
  return json({ updated: true });
}
