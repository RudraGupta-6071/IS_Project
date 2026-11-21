begin;

-- The previous constraint allowed one teaching and one project review per assignment.
-- Stop on existing cross-context duplicates so review content is preserved for reconciliation.
do $$
begin
  if exists (
    select 1 from review_app.reviews where assignment_id is not null
    group by author_id, assignment_id having count(*) > 1
  ) then
    raise exception 'Resolve existing duplicate assignment reviews before applying the student session migration';
  end if;
end;
$$;
create unique index review_per_student_assignment on review_app.reviews (author_id, assignment_id)
  where assignment_id is not null;
drop index review_app.review_per_assignment;

create table review_app.student_sessions (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  student_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);
create index student_sessions_expiry on review_app.student_sessions (expires_at);
create index student_sessions_student on review_app.student_sessions (student_id);
revoke all on review_app.student_sessions from public, anon, authenticated, review_app_api;

create function review_app.active_student(account_id uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = account_id and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now())
      and review_app.student_eligible(u.email)
  );
$$;

create function review_app.issue_session(account_id uuid, digest bytea, previous_digest bytea)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not review_app.active_student(account_id) then
    return false;
  end if;
  delete from review_app.student_sessions where token_hash = previous_digest;
  insert into review_app.student_sessions (token_hash, student_id) values (digest, account_id);
  return true;
end;
$$;

create function review_app.session_student(digest bytea)
returns uuid language sql stable security definer set search_path = '' as $$
  select student_id from review_app.student_sessions
  where token_hash = digest and expires_at > now() and review_app.active_student(student_id);
$$;

create function review_app.revoke_session(digest bytea)
returns void language sql security definer set search_path = '' as $$
  delete from review_app.student_sessions where token_hash = digest;
$$;

revoke all on function review_app.active_student(uuid),
  review_app.issue_session(uuid, bytea, bytea), review_app.session_student(bytea),
  review_app.revoke_session(bytea) from public, anon, authenticated;
grant execute on function review_app.issue_session(uuid, bytea, bytea),
  review_app.session_student(bytea), review_app.revoke_session(bytea) to review_app_api;

commit;
