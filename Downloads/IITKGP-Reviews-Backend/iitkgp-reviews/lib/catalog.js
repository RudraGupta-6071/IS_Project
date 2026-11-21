import { z } from 'zod';
import { query } from './db.js';
import { enrichCatalog, ratingDetails } from './catalog-ratings.js';
import { ApiError, json } from './http.js';

export const uuid = z.uuid();
export const contextType = z.enum(['teaching', 'project']);
const courseType = z.enum(['regular', 'project_based']);
export const pagination = {
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1000000).default(0),
};
const filters = {
  ...pagination,
  q: z.string().trim().max(120).default(''),
  departmentId: uuid.optional(),
  termId: uuid.optional(),
};

export function page(rows, { limit, offset }) {
  return json({ items: rows.slice(0, limit), nextOffset: rows.length > limit ? offset + limit : null });
}

const courses = `
  select c.id, c.code, c.title, c.course_type, c.department_id, d.name as department, d.code = 'DEMO' as is_demo
  from review_app.courses c join review_app.departments d on d.id = c.department_id
`;
const professors = `
  select p.id, p.name, p.department_id, d.name as department, d.code = 'DEMO' as is_demo
  from review_app.professors p join review_app.departments d on d.id = p.department_id
`;

export async function listCatalog(request, resource) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  if (resource === 'courses') {
    const input = z.strictObject({ ...filters, type: courseType.optional() }).parse(params);
    const { rows } = await query(`${courses}
      where ($1 = '' or strpos(lower(c.code), lower($1)) > 0 or strpos(lower(c.title), lower($1)) > 0)
        and ($2::uuid is null or c.department_id = $2)
        and ($3::text is null or c.course_type = $3)
        and ($4::uuid is null or exists (
          select 1 from review_app.course_offerings o where o.course_id = c.id and o.term_id = $4
        ))
      order by c.code limit $5 offset $6
    `, [input.q, input.departmentId, input.type, input.termId, input.limit + 1, input.offset]);
    return page(await enrichCatalog(rows, true, input), input);
  }

  const input = z.strictObject({ ...filters, context: contextType.optional() }).parse(params);
  const { rows } = await query(`${professors}
    where ($1 = '' or strpos(lower(p.name), lower($1)) > 0)
      and ($2::uuid is null or p.department_id = $2)
      and ($3::text is null or exists (
        select 1 from review_app.student_reviews r
        where r.professor_id = p.id and r.context = $3 and ($4::uuid is null or r.term_id = $4)
      ))
      and ($4::uuid is null or $3 is not null or exists (
        select 1 from review_app.teaching_assignments a where a.professor_id = p.id and a.term_id = $4
        union all
        select 1 from review_app.student_reviews r where r.professor_id = p.id and r.term_id = $4
      ))
    order by p.name, p.id limit $5 offset $6
  `, [input.q, input.departmentId, input.context, input.termId, input.limit + 1, input.offset]);
  return page(await enrichCatalog(rows, false, input), input);
}

export async function catalogDetail(resource, id, request) {
  const termId = uuid.optional().parse(new URL(request.url).searchParams.get('termId') ?? undefined);
  const isCourse = resource === 'courses';
  const target = uuid.parse(id);
  const { rows } = await query(isCourse ? courses + 'where c.id = $1' : professors + 'where p.id = $1', [target]);
  if (!rows.length) throw new ApiError(404, 'Catalog record not found.');
  const { rows: assignments } = await query(`
    select a.id, o.id as offering_id, c.id as course_id, c.code as course_code,
      c.title as course_title, c.course_type, p.id as professor_id, p.name as professor_name,
      t.id as term_id, t.start_year || '-' || (t.start_year + 1) as academic_year, t.semester
    from review_app.teaching_assignments a
    join review_app.course_offerings o on o.id = a.offering_id
    join review_app.courses c on c.id = o.course_id
    join review_app.professors p on p.id = a.professor_id
    join review_app.academic_terms t on t.id = a.term_id
    where ${isCourse ? 'c.id' : 'p.id'} = $1
    order by t.start_year desc, case t.semester when 'summer' then 3 when 'spring' then 2 else 1 end desc,
      c.code, p.name, a.id
  `, [target]);
  const [[item], ratingInfo] = await Promise.all([enrichCatalog(rows, isCourse, { termId }), ratingDetails(target, isCourse, termId)]);
  return json({ ...item, ...ratingInfo, assignments });
}

export async function catalogOptions() {
  const [departments, terms] = await Promise.all([
    query('select id, code, name from review_app.departments order by name, id'),
    query(`select id, start_year, start_year || '-' || (start_year + 1) as academic_year, semester
      from review_app.academic_terms
      order by start_year desc, case semester when 'summer' then 3 when 'spring' then 2 else 1 end desc`),
  ]);
  return json({ departments: departments.rows, terms: terms.rows });
}
