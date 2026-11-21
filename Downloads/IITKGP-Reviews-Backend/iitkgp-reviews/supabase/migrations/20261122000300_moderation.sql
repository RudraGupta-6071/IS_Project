begin;

alter table review_app.reviews add column is_hidden boolean not null default false;

create table review_app.moderators (
  student_id uuid primary key references auth.users(id) on delete cascade
);

create table review_app.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references review_app.reviews(id) on delete cascade,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null check (reason in ('abuse', 'privacy', 'spam', 'other')),
  details text check (char_length(btrim(details)) between 1 and 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index review_open_report_per_student on review_app.review_reports (review_id, reporter_id)
  where resolved_at is null;
create index review_reports_review on review_app.review_reports (review_id);

create table review_app.moderation_log (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null,
  moderator_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('hide', 'restore', 'dismiss')),
  created_at timestamptz not null default now()
);

create view review_app.all_reviews as
select r.id, a.offering_id, o.course_id, r.professor_id, r.term_id, r.context,
  r.ratings, r.feedback, r.project_types, r.created_at, r.updated_at, r.project_topics,
  r.is_hidden
from review_app.reviews r
left join review_app.teaching_assignments a on a.id = r.assignment_id
left join review_app.course_offerings o on o.id = a.offering_id;

create or replace view review_app.student_reviews as
select id, offering_id, course_id, professor_id, term_id, context, ratings,
  feedback, project_types, created_at, updated_at, project_topics
from review_app.all_reviews where not is_hidden;

grant select on review_app.all_reviews to review_app_api;

create function review_app.is_moderator(account_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select review_app.active_student(account_id)
    and exists (select 1 from review_app.moderators where student_id = account_id);
$$;

create function review_app.report_review(account_id uuid, target_id uuid, report_reason text, report_details text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not review_app.active_student(account_id) then return false; end if;
  perform 1 from review_app.reviews where id = target_id and not is_hidden for update;
  if not found then return false; end if;
  insert into review_app.review_reports (review_id, reporter_id, reason, details)
  values (target_id, account_id, report_reason, report_details)
  on conflict (review_id, reporter_id) where resolved_at is null do nothing;
  return true;
end;
$$;

create function review_app.moderation_queue(account_id uuid, queue_kind text, page_size integer, page_offset integer)
returns table (id uuid, feedback text, project_topics text, project_types text[], ratings jsonb, context text, course_code text, professor_name text,
  academic_year text, semester text, is_hidden boolean, reports jsonb)
language sql stable security definer set search_path = '' as $$
  select r.id, r.feedback, r.project_topics, r.project_types, r.ratings, r.context, c.code, p.name,
    t.start_year || '-' || (t.start_year + 1), t.semester, r.is_hidden,
    coalesce(recent.reports, '[]'::jsonb)
  from review_app.all_reviews r
  join review_app.academic_terms t on t.id = r.term_id
  join review_app.professors p on p.id = r.professor_id
  left join review_app.courses c on c.id = r.course_id
  left join lateral (
    select jsonb_agg(jsonb_build_object('reason', item.reason, 'details', item.details)
      order by item.created_at desc, item.id) as reports
    from (
      select report.id, report.reason, report.details, report.created_at
      from review_app.review_reports report
      where report.review_id = r.id and report.resolved_at is null
      order by report.created_at desc, report.id limit 10
    ) item
  ) recent on true
  where review_app.is_moderator(account_id)
    and ((queue_kind = 'hidden' and r.is_hidden) or
         (queue_kind = 'reported' and not r.is_hidden and recent.reports is not null))
  order by r.created_at desc, r.id desc limit page_size offset page_offset;
$$;

create function review_app.moderate_review(account_id uuid, target_id uuid, decision text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare hidden boolean;
begin
  if not review_app.is_moderator(account_id) or decision not in ('hide', 'restore', 'dismiss') then return false; end if;
  select is_hidden into hidden from review_app.reviews where id = target_id for update;
  if not found then return false; end if;
  if decision = 'restore' and not hidden then return false; end if;
  if decision <> 'restore' and (hidden or not exists (
    select 1 from review_app.review_reports where review_id = target_id and resolved_at is null
  )) then return false; end if;
  if decision <> 'dismiss' then
    update review_app.reviews set is_hidden = (decision = 'hide') where id = target_id;
  end if;
  update review_app.review_reports set resolved_at = now() where review_id = target_id and resolved_at is null;
  insert into review_app.moderation_log (moderator_id, review_id, action)
  values (account_id, target_id, decision);
  return true;
end;
$$;

revoke all on function review_app.is_moderator(uuid),
  review_app.report_review(uuid, uuid, text, text),
  review_app.moderation_queue(uuid, text, integer, integer),
  review_app.moderate_review(uuid, uuid, text) from public, anon, authenticated;
grant execute on function review_app.is_moderator(uuid),
  review_app.report_review(uuid, uuid, text, text),
  review_app.moderation_queue(uuid, text, integer, integer),
  review_app.moderate_review(uuid, uuid, text) to review_app_api;

commit;
