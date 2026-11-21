import { query } from './db.js';
import { minimumReviewCount } from './rating-metrics.js';

const overall = `(
  select avg(metric.value::text::numeric)
  from jsonb_each(r.ratings) as metric
  where metric.key not in ('workload', 'projectWorkload')
)`;
const emptySummary = { average_rating: null, review_count: 0 };

function targetColumn(isCourse) {
  return isCourse ? 'course_id' : 'professor_id';
}

export async function enrichCatalog(rows, isCourse, { termId, context } = {}) {
  if (!rows.length) return rows;
  const ids = rows.map(row => row.id);
  const column = targetColumn(isCourse);
  const [summaries, taught] = await Promise.all([
    query(`
      select r.${column} as id, case when count(${overall}) >= ${minimumReviewCount} then avg(${overall})::float8 end as average_rating, count(*)::int as review_count
      from review_app.student_reviews r
      where r.${column} = any($1::uuid[]) and ($2::uuid is null or r.term_id = $2)
        and ($3::text is null or r.context = $3)
      group by r.${column}
    `, [ids, termId, context]),
    isCourse ? null : query(`
      select professor_id, jsonb_agg(jsonb_build_object('id', id, 'code', code, 'title', title)
        order by code) as courses
      from (
        select distinct a.professor_id, c.id, c.code, c.title
        from review_app.teaching_assignments a
        join review_app.course_offerings o on o.id = a.offering_id
        join review_app.courses c on c.id = o.course_id
        where a.professor_id = any($1::uuid[]) and ($2::uuid is null or a.term_id = $2)
      ) distinct_courses
      group by professor_id
    `, [ids, termId]),
  ]);
  const summariesById = new Map(summaries.rows.map(({ id, ...summary }) => [id, summary]));
  const coursesByProfessor = new Map(taught?.rows.map(row => [row.professor_id, row.courses]));
  return rows.map(row => ({
    ...row,
    ...(summariesById.get(row.id) ?? emptySummary),
    ...(!isCourse && { courses: coursesByProfessor.get(row.id) ?? [] }),
  }));
}

export async function ratingDetails(id, isCourse, termId) {
  const column = targetColumn(isCourse);
  const [breakdowns, projects] = await Promise.all([
    query(`
      select scores.context, scores.key, avg(scores.value::text::numeric)::float8 as average
      from (
        select case when r.project_topics is not null
          and metric.key in ('teachingQuality','subjectKnowledge','grading','regularity','approachability','workload')
          then 'teaching' else r.context end as context,
          case metric.key when 'projectWorkload' then 'workload' when 'projectGrading' then 'grading'
            else metric.key end as key,
          metric.value
        from review_app.student_reviews r cross join lateral jsonb_each(r.ratings) as metric
        where r.${column} = $1 and ($2::uuid is null or r.term_id = $2)
      ) scores
      group by scores.context, scores.key
      having count(*) >= ${minimumReviewCount}
    `, [id, termId]),
    query(`
      select min(p.label) as label, count(*)::int as review_count
      from review_app.student_reviews r cross join lateral unnest(r.project_types) as p(label)
      where r.${column} = $1 and r.context = 'project'
      group by lower(p.label)
      order by review_count desc, label
      limit 12
    `, [id, termId]),
  ]);
  const ratingBreakdowns = { teaching: {}, project: {} };
  for (const { context, key, average } of breakdowns.rows) {
    ratingBreakdowns[context][key] = average;
  }
  return { rating_breakdowns: ratingBreakdowns, project_types: projects.rows };
}
