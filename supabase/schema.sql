-- ============================================================================
-- Admission Exam Platform — full database schema
-- Run this ONCE in the Supabase Dashboard → SQL Editor.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards where possible).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'student');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attempt_status as enum ('in_progress', 'completed', 'expired');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- Application profile linked 1:1 with auth.users
create table if not exists public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text not null unique,
  role        public.user_role not null default 'student',
  created_at  timestamptz not null default now()
);

create index if not exists users_role_idx on public.users (role);

-- Exams
create table if not exists public.exams (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (char_length(title) between 3 and 200),
  subject            text not null check (char_length(subject) between 2 and 100),
  category           text not null check (char_length(category) between 2 and 100),
  duration_minutes   integer not null check (duration_minutes between 1 and 600),
  total_marks        numeric(10,2) not null default 0 check (total_marks >= 0),
  marks_per_question numeric(6,2) not null check (marks_per_question > 0),
  negative_marking   numeric(6,2) not null default 0 check (negative_marking >= 0),
  published          boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists exams_published_idx on public.exams (published);
create index if not exists exams_subject_idx   on public.exams (subject);
create index if not exists exams_category_idx  on public.exams (category);
create index if not exists exams_created_idx   on public.exams (created_at desc);

-- Questions (single-correct MCQ, supports Bangla/English/mixed + images)
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.exams (id) on delete cascade,
  question_text  text not null check (char_length(question_text) between 1 and 5000),
  image_urls     jsonb not null default '[]'::jsonb,
  option_a       text not null,
  option_b       text not null,
  option_c       text not null,
  option_d       text not null,
  correct_answer char(1) not null check (correct_answer in ('A','B','C','D')),
  order_index    integer not null default 0,
  created_at     timestamptz not null default now(),
  unique (exam_id, order_index)
);

create index if not exists questions_exam_order_idx on public.questions (exam_id, order_index);

-- Auto-maintain exams.total_marks = question_count × marks_per_question
create or replace function public.sync_exam_total_marks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
begin
  v_exam_id := coalesce(new.exam_id, old.exam_id);
  update public.exams e
     set total_marks = sub.c * e.marks_per_question
    from (select count(*)::int as c from public.questions where exam_id = v_exam_id) sub
   where e.id = v_exam_id;
  return null;
end;
$$;

drop trigger if exists questions_sync_total_marks on public.questions;
create trigger questions_sync_total_marks
after insert or update or delete on public.questions
for each row execute function public.sync_exam_total_marks();

-- Also resync when marks_per_question changes
create or replace function public.resync_total_marks_on_exam_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.marks_per_question is distinct from old.marks_per_question then
    new.total_marks := sub.c * new.marks_per_question
      from (select count(*)::int as c from public.questions where exam_id = new.id) sub;
  end if;
  return new;
end;
$$;

drop trigger if exists exams_resync_total_marks on public.exams;
create trigger exams_resync_total_marks
before update on public.exams
for each row execute function public.resync_total_marks_on_exam_update();

-- Exam attempts (one active attempt per user/exam enforced below)
create table if not exists public.exam_attempts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,
  exam_id             uuid not null references public.exams (id) on delete cascade,
  status              public.attempt_status not null default 'in_progress',
  started_at          timestamptz not null default now(),
  ends_at             timestamptz not null,
  submitted_at        timestamptz,
  last_active_at      timestamptz,
  duration_minutes    integer not null,
  marks_per_question  numeric(6,2) not null,
  negative_marking    numeric(6,2) not null default 0,
  question_order      jsonb not null default '[]'::jsonb
);

create index if not exists attempts_user_started_idx on public.exam_attempts (user_id, started_at desc);
create index if not exists attempts_exam_idx        on public.exam_attempts (exam_id);
create index if not exists attempts_status_idx      on public.exam_attempts (status);
create index if not exists attempts_stale_idx       on public.exam_attempts (ends_at)
  where status = 'in_progress';

-- At most ONE active attempt per user per exam (double-click / race safety)
create unique index if not exists attempts_one_active_per_exam_uq
  on public.exam_attempts (user_id, exam_id)
  where status = 'in_progress';

-- Per-question saved answers (autosave target)
create table if not exists public.answers (
  id              uuid primary key default gen_random_uuid(),
  attempt_id      uuid not null references public.exam_attempts (id) on delete cascade,
  question_id     uuid not null references public.questions (id) on delete cascade,
  selected_answer char(1) check (selected_answer in ('A','B','C','D')),
  is_correct      boolean,
  updated_at      timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists answers_attempt_idx on public.answers (attempt_id);
create index if not exists answers_question_idx on public.answers (question_id);

-- Computed results — written ONLY by submit_attempt()/finalize (see below)
create table if not exists public.results (
  id             uuid primary key default gen_random_uuid(),
  attempt_id     uuid not null unique references public.exam_attempts (id) on delete cascade,
  score          numeric(10,2) not null check (score >= 0),
  correct_count  integer not null check (correct_count >= 0),
  wrong_count    integer not null check (wrong_count >= 0),
  skipped_count  integer not null check (skipped_count >= 0),
  percentage     numeric(5,2) not null check (percentage between 0 and 100),
  accuracy       numeric(5,2) not null check (accuracy between 0 and 100),
  created_at     timestamptz not null default now()
);

create index if not exists results_score_idx on public.results (score desc);

-- ----------------------------------------------------------------------------
-- Helper: is the current request an admin?
-- SECURITY DEFINER avoids recursive RLS evaluation on public.users.
-- Defined AFTER the tables: language-sql bodies are validated at create time.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ----------------------------------------------------------------------------
-- New auth user → auto-create profile (role defaults to student)
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.email,
    coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'student')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Submission pipeline
-- ----------------------------------------------------------------------------

-- Core atomic scorer. Locks the attempt, grades answers, writes the result,
-- flips status to completed/expired. Idempotent: re-running is a no-op once
-- the attempt has left in_progress.
create or replace function public._finalize_attempt(
  p_attempt_id uuid,
  p_expired boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt   public.exam_attempts%rowtype;
  v_total     integer;
  v_answered  integer;
  v_correct   integer;
  v_wrong     integer;
  v_skipped   integer;
  v_score     numeric;
  v_pct       numeric;
  v_acc       numeric;
  v_total_marks numeric;
begin
  select * into v_attempt
    from public.exam_attempts
   where id = p_attempt_id
   for update;

  if not found then
    return;
  end if;

  if v_attempt.status <> 'in_progress' then
    return; -- already finalized
  end if;

  -- Grade every non-null answer
  update public.answers a
     set is_correct = (a.selected_answer = q.correct_answer)
    from public.questions q
   where q.id = a.question_id
     and a.attempt_id = p_attempt_id
     and a.selected_answer is not null;

  -- Counts over the answers that exist…
  select
    count(*) filter (where a.selected_answer is not null)::int,
    count(*) filter (where a.selected_answer = q.correct_answer)::int,
    count(*) filter (where a.selected_answer is not null
                     and a.selected_answer <> q.correct_answer)::int
  into v_answered, v_correct, v_wrong
  from public.answers a
  join public.questions q on q.id = a.question_id
  where a.attempt_id = p_attempt_id;

  -- …but the DENOMINATOR is the full question set this attempt presented
  -- (question_order snapshot; fall back to the exam's question count for
  -- attempts created without one). Otherwise unanswered questions vanish:
  -- skipped reads 0 and the percentage is inflated.
  v_total := coalesce(jsonb_array_length(v_attempt.question_order), 0);
  if v_total = 0 then
    select count(*)::int into v_total
      from public.questions
     where exam_id = v_attempt.exam_id;
  end if;

  v_skipped := v_total - v_answered;
  if v_skipped < 0 then v_skipped := 0; end if;

  v_total_marks := v_total * v_attempt.marks_per_question;
  v_score := greatest(0,
    v_correct * v_attempt.marks_per_question - v_wrong * v_attempt.negative_marking);
  v_pct := case when v_total_marks > 0
                then round(v_score * 100 / v_total_marks, 2) else 0 end;
  v_acc := case when v_answered > 0
                then round(v_correct::numeric * 100 / v_answered, 2) else 0 end;

  insert into public.results
    (attempt_id, score, correct_count, wrong_count, skipped_count, percentage, accuracy)
  values
    (p_attempt_id, v_score, v_correct, v_wrong, v_skipped, v_pct, v_acc)
  on conflict (attempt_id) do nothing;

  update public.exam_attempts
     set status = case when p_expired then 'expired' else 'completed' end::attempt_status,
         submitted_at = coalesce(submitted_at, now())
   where id = p_attempt_id;
end;
$$;

-- Manual/auto submission invoked by the owning student (user JWT → auth.uid())
-- or by our server routes (service role + explicit p_user_id).
-- Returns the attempt id on success.
create or replace function public.submit_attempt(
  p_attempt_id uuid,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_status public.attempt_status;
  v_caller uuid := coalesce(p_user_id, auth.uid());
begin
  if v_caller is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select user_id, status into v_owner, v_status
    from public.exam_attempts
   where id = p_attempt_id;

  if not found then
    raise exception 'ATTEMPT_NOT_FOUND';
  end if;
  -- Ownership is enforced here at the DB level in EVERY call path.
  if v_owner <> v_caller then
    raise exception 'FORBIDDEN';
  end if;

  perform public._finalize_attempt(p_attempt_id, false);
  return p_attempt_id;
end;
$$;

-- Lazy expiry: finalize any of MY attempts whose deadline has passed.
-- Called whenever a student loads dashboards / resumes an attempt.
create or replace function public.expire_my_stale_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    return 0;
  end if;

  for v_id in
    select id from public.exam_attempts
     where user_id = auth.uid()
       and status = 'in_progress'
       and ends_at <= now()
     for update skip locked
  loop
    perform public._finalize_attempt(v_id, true);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Cron-friendly global sweep (callable by service_role only)
create or replace function public.expire_all_stale_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from public.exam_attempts
     where status = 'in_progress'
       and ends_at <= now()
     for update skip locked
  loop
    perform public._finalize_attempt(v_id, true);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public._finalize_attempt(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.expire_all_stale_attempts() from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.users         enable row level security;
alter table public.exams         enable row level security;
alter table public.questions     enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.answers       enable row level security;
alter table public.results       enable row level security;

-- users -----------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users
for select using (id = auth.uid() or public.is_admin());

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
for update using (id = auth.uid()) with check (id = auth.uid());

-- Lock down sensitive columns: users may only change their display name
revoke update on public.users from authenticated;
grant update (name) on public.users to authenticated;

-- exams -----------------------------------------------------------------------
drop policy if exists exams_read on public.exams;
create policy exams_read on public.exams
for select using (published or public.is_admin());

drop policy if exists exams_insert_admin on public.exams;
create policy exams_insert_admin on public.exams
for insert with check (public.is_admin());

drop policy if exists exams_update_admin on public.exams;
create policy exams_update_admin on public.exams
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists exams_delete_admin on public.exams;
create policy exams_delete_admin on public.exams
for delete using (public.is_admin());

-- questions -------------------------------------------------------------------
drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions
for select
using (
  public.is_admin()
  or exists (
    select 1 from public.exams e
    where e.id = exam_id and e.published
  )
);

drop policy if exists questions_insert_admin on public.questions;
create policy questions_insert_admin on public.questions
for insert with check (public.is_admin());

drop policy if exists questions_update_admin on public.questions;
create policy questions_update_admin on public.questions
for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists questions_delete_admin on public.questions;
create policy questions_delete_admin on public.questions
for delete using (public.is_admin());

-- Column-level protection: students can never SELECT correct_answer, even by
-- calling the REST API directly. Admin code paths use the service-role client.
revoke select on public.questions from authenticated, anon;
grant select (id, exam_id, question_text, image_urls,
              option_a, option_b, option_c, option_d, order_index, created_at)
  on public.questions to authenticated;

-- exam_attempts ---------------------------------------------------------------
drop policy if exists attempts_read on public.exam_attempts;
create policy attempts_read on public.exam_attempts
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists attempts_insert on public.exam_attempts;
create policy attempts_insert on public.exam_attempts
for insert with check (user_id = auth.uid());

drop policy if exists attempts_update on public.exam_attempts;
create policy attempts_update on public.exam_attempts
for update using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists attempts_delete_admin on public.exam_attempts;
create policy attempts_delete_admin on public.exam_attempts
for delete using (public.is_admin());

-- answers ---------------------------------------------------------------------
drop policy if exists answers_read on public.answers;
create policy answers_read on public.answers
for select using (
  public.is_admin()
  or exists (select 1 from public.exam_attempts a
             where a.id = attempt_id and a.user_id = auth.uid())
);

drop policy if exists answers_insert on public.answers;
create policy answers_insert on public.answers
for insert with check (
  exists (select 1 from public.exam_attempts a
          where a.id = attempt_id and a.user_id = auth.uid()
            and a.status = 'in_progress')
);

drop policy if exists answers_update on public.answers;
create policy answers_update on public.answers
for update using (
  exists (select 1 from public.exam_attempts a
          where a.id = attempt_id and a.user_id = auth.uid()
            and a.status = 'in_progress')
) with check (
  exists (select 1 from public.exam_attempts a
          where a.id = attempt_id and a.user_id = auth.uid()
            and a.status = 'in_progress')
);

drop policy if exists answers_delete on public.answers;
create policy answers_delete on public.answers
for delete using (
  exists (select 1 from public.exam_attempts a
          where a.id = attempt_id and a.user_id = auth.uid()
            and a.status = 'in_progress')
);

-- results ---------------------------------------------------------------------
drop policy if exists results_read on public.results;
create policy results_read on public.results
for select using (
  public.is_admin()
  or exists (select 1 from public.exam_attempts a
             where a.id = attempt_id and a.user_id = auth.uid())
);
-- No INSERT/UPDATE/DELETE policies on purpose: only _finalize_attempt
-- (security definer) may write results.

-- ----------------------------------------------------------------------------
-- Storage: question-images bucket (public read, service-role-only writes)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read question images" on storage.objects;
create policy "Public read question images"
on storage.objects for select
using (bucket_id = 'question-images');

-- ----------------------------------------------------------------------------
-- Demo content (optional — delete this block if you want a clean start)
-- ----------------------------------------------------------------------------
do $$
declare
  v_bio uuid;
  v_eng uuid;
begin
  if not exists (select 1 from public.exams where title = 'মেডিকেল ভর্তি প্রস্তুতি মডেল টেস্ট ০১') then
    insert into public.exams
      (title, subject, category, duration_minutes, marks_per_question, negative_marking, published)
    values
      ('মেডিকেল ভর্তি প্রস্তুতি মডেল টেস্ট ০১', 'জীববিজ্ঞান', 'মেডিকেল ভর্তি', 15, 1, 0.25, true);
  end if;

  if not exists (select 1 from public.exams where title = 'DU Admission Mock Test — English') then
    insert into public.exams
      (title, subject, category, duration_minutes, marks_per_question, negative_marking, published)
    values
      ('DU Admission Mock Test — English', 'English', 'Dhaka University', 10, 1, 0, true);
  end if;

  select id into v_bio from public.exams
   where title = 'মেডিকেল ভর্তি প্রস্তুতি মডেল টেস্ট ০১' limit 1;
  select id into v_eng from public.exams
   where title = 'DU Admission Mock Test — English' limit 1;

  if v_bio is not null and not exists (select 1 from public.questions where exam_id = v_bio) then
    insert into public.questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, order_index) values
    (v_bio, 'বাংলাদেশের রাজধানী কোনটি?', 'চট্টগ্রাম', 'ঢাকা', 'খুলনা', 'রাজশাহী', 'B', 1),
    (v_bio, 'DNA এর পূর্ণরূপ কী?', 'Deoxyribonucleic Acid', 'Diribonucleic Acid', 'Deoxyribose Nuclear Acid', 'Dual Nucleic Acid', 'A', 2),
    (v_bio, 'সালোকসংশ্লেষণে কোন গ্যাস নির্গত হয়?', 'কার্বন ডাই-অক্সাইড', 'নাইট্রোজেন', 'অক্সিজেন', 'হাইড্রোজেন', 'C', 3),
    (v_bio, 'মানবদেহে ক্রোমোজোম সংখ্যা কত জোড়া?', '২১ জোড়া', '২৩ জোড়া', '৪৬ জোড়া', '২২ জোড়া', 'B', 4),
    (v_bio, 'Which organ produces insulin?', 'Liver', 'Pancreas', 'Kidney', 'Spleen', 'B', 5);
  end if;

  if v_eng is not null and not exists (select 1 from public.questions where exam_id = v_eng) then
    insert into public.questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_answer, order_index) values
    (v_eng, 'Choose the correct spelling.', 'Recieve', 'Receive', 'Receeve', 'Riceive', 'B', 1),
    (v_eng, 'What is the synonym of "Abundant"?', 'Scarce', 'Plentiful', 'Tiny', 'Weak', 'B', 2),
    (v_eng, 'He ___ to school every day.', 'go', 'goes', 'going', 'gone', 'B', 3);
  end if;
end;
$$;

-- Done. Next step: run `npm run db:seed` to create the admin & student accounts.
