import { z } from 'zod';
import { metrics } from './rating-metrics.js';
import { cleanText, optionalText } from './user-text.js';

const rating = z.number().int().min(1).max(5);
const ratingFields = labels => z.strictObject(Object.fromEntries(Object.keys(labels).map(key => [key, rating])));
const feedback = optionalText(3000);
const project = {
  context: z.literal('project'), feedback,
  projectTypes: z.array(cleanText(80, { required: true, singleLine: true })).min(1).max(8)
    .refine(values => new Set(values.map(value => value.toLowerCase())).size === values.length,
      'Project types must be distinct.'),
};
const teaching = { context: z.literal('teaching'), feedback, ratings: ratingFields(metrics.teaching) };
const independentProject = { ...project, ratings: ratingFields(metrics.project) };
const courseProject = {
  ...project,
  ratings: ratingFields({ ...metrics.teaching, ...metrics.projectCourse }),
  projectTopics: cleanText(600, { required: true }),
};

const target = { professorId: z.uuid(), termId: z.uuid() };
export const createInput = z.union([
  z.strictObject({ ...teaching, ...target, assignmentId: z.uuid() }),
  z.strictObject({ ...courseProject, ...target, assignmentId: z.uuid() }),
  z.strictObject({ ...independentProject, ...target, assignmentId: z.null().optional() }),
]);

export function editInput(review) {
  if (review.context === 'teaching') return z.strictObject(teaching);
  return z.strictObject(review.course_id ? courseProject : independentProject);
}
