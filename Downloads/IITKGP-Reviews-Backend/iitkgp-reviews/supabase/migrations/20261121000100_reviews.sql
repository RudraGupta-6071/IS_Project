begin;
create schema review_app;
revoke all on schema review_app from public, anon, authenticated;

create table review_app.student_domains (
  domain text primary key check (domain = lower(domain) and domain !~ '[[:space:]@]' and domain <> ''),
  require_allowlist boolean not null default true
);
create table review_app.approved_emails (email text primary key check (email = lower(email)));
create function review_app.student_eligible(email_address text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from review_app.student_domains d
    where lower(email_address) ~ '^[^[:space:]@]+@[^[:space:]@]+$'
      and d.domain = split_part(lower(email_address), '@', 2)
      and (not d.require_allowlist or exists (
        select 1 from review_app.approved_emails a where a.email = lower(email_address)
      ))
  );
$$;
create function public.check_student_signup(event jsonb)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when review_app.student_eligible(event->'user'->>'email') then '{}'::jsonb
    else '{"error":{"http_code":403,"message":"This account is not eligible."}}'::jsonb end;
$$;
revoke all on function public.check_student_signup(jsonb) from public, anon, authenticated;
grant execute on function public.check_student_signup(jsonb) to supabase_auth_admin;

create table review_app.departments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(btrim(code)) and code <> ''),
  name text not null check (btrim(name) <> '')
);
create table review_app.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(btrim(code)) and code <> ''),
  title text not null check (btrim(title) <> ''),
  department_id uuid not null references review_app.departments(id),
  course_type text not null check (course_type in ('regular', 'project_based'))
);
create table review_app.professors (
  id uuid primary key default gen_random_uuid(),
  catalog_key text not null unique check (catalog_key = lower(btrim(catalog_key)) and catalog_key <> ''),
  name text not null check (btrim(name) <> ''),
  department_id uuid not null references review_app.departments(id)
);
create table review_app.academic_terms (
  id uuid primary key default gen_random_uuid(),
  start_year smallint not null check (start_year between 1900 and 9998),
  semester text not null check (semester in ('autumn', 'spring', 'summer')),
  unique (start_year, semester)
);
create table review_app.course_offerings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references review_app.courses(id),
  term_id uuid not null references review_app.academic_terms(id),
  unique (course_id, term_id),
  unique (id, term_id)
);
create table review_app.teaching_assignments (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null,
  professor_id uuid not null references review_app.professors(id),
  term_id uuid not null,
  foreign key (offering_id, term_id) references review_app.course_offerings(id, term_id),
  unique (offering_id, professor_id),
  unique (id, professor_id, term_id)
);
create function review_app.valid_ratings(ratings jsonb, keys text[])
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(ratings) = 'object' then ratings ?& keys
    and not exists (
      select 1 from jsonb_each(ratings) as metric(key, value)
      where not (key = any(keys)) or jsonb_typeof(value) <> 'number' or value::text !~ '^[1-5]$'
    ) else false end;
$$;
create function review_app.valid_project_types(labels text[])
returns boolean language sql immutable set search_path = '' as $$
  select cardinality(labels) between 1 and 8
    and cardinality(labels) = (
      select count(distinct lower(label))
      from unnest(labels) as label where label = btrim(label) and char_length(label) between 1 and 80
    );
$$;
create table review_app.reviews (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  assignment_id uuid,
  professor_id uuid not null references review_app.professors(id),
  term_id uuid not null references review_app.academic_terms(id),
  context text not null check (context in ('teaching', 'project')),
  ratings jsonb not null,
  feedback text check (char_length(btrim(feedback)) between 1 and 3000),
  project_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assignment_id, professor_id, term_id)
    references review_app.teaching_assignments(id, professor_id, term_id),
  check (
    (context = 'teaching' and assignment_id is not null and cardinality(project_types) = 0
      and review_app.valid_ratings(ratings, array['teachingQuality','subjectKnowledge','grading','regularity','approachability','workload']))
    or
    (context = 'project' and review_app.valid_project_types(project_types)
      and review_app.valid_ratings(ratings, array['topicFreedom','guidance','involvement','workload','evaluation','grading']))
  )
);
create unique index review_per_assignment on review_app.reviews (author_id, assignment_id, context)
  where assignment_id is not null;
create unique index review_per_independent_project on review_app.reviews (author_id, professor_id, term_id)
  where assignment_id is null;
create index reviews_author on review_app.reviews (author_id);
create index reviews_recent on review_app.reviews (created_at desc, id desc);
create index reviews_professor on review_app.reviews (professor_id, created_at desc, id desc);
create index reviews_assignment on review_app.reviews (assignment_id, created_at desc, id desc);
create index reviews_term on review_app.reviews (term_id);
create index assignments_professor on review_app.teaching_assignments (professor_id, term_id);
create index offerings_term on review_app.course_offerings (term_id, course_id);
create index courses_department on review_app.courses (department_id, course_type, code);
create index professors_department on review_app.professors (department_id, name, id);

create view review_app.student_reviews as
select r.id, a.offering_id, o.course_id, r.professor_id, r.term_id, r.context,
  r.ratings, r.feedback, r.project_types, r.created_at, r.updated_at
from review_app.reviews r
left join review_app.teaching_assignments a on a.id = r.assignment_id
left join review_app.course_offerings o on o.id = a.offering_id;

do $role$
begin
  if not exists (select 1 from pg_roles where rolname = 'review_app_api') then
    create role review_app_api nologin;
  end if;
end;
$role$;
grant usage on schema review_app to review_app_api;
revoke all on function review_app.student_eligible(text) from public;
grant execute on function review_app.student_eligible(text) to review_app_api;
grant select on review_app.departments, review_app.courses, review_app.professors,
  review_app.academic_terms, review_app.course_offerings, review_app.teaching_assignments,
  review_app.student_reviews to review_app_api;
grant select (id, author_id, context) on review_app.reviews to review_app_api;
grant insert (author_id, assignment_id, professor_id, term_id, context, ratings, feedback, project_types)
  on review_app.reviews to review_app_api;
grant update (ratings, feedback, project_types, updated_at) on review_app.reviews to review_app_api;
grant delete on review_app.reviews to review_app_api;
commit;
