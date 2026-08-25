-- ============================================================================
-- PATCH 001 — fix scoring totals in _finalize_attempt
-- Run in Supabase Dashboard → SQL Editor. Safe to re-run.
--
-- BUG: the old function counted rows in the `answers` table as the question
-- total. Questions never answered had no row, so `skipped` was always 0 and
-- `percentage` was computed against answered questions only (inflated).
--
-- FIX: the denominator is now the full question set the attempt presented
-- (attempt.question_order, falling back to the exam's question count), so
-- unanswered questions count as skipped and percentages are out of the whole
-- exam. Existing results are NOT retroactively recalculated by this patch —
-- they keep their stored values.
-- ============================================================================

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

-- ----------------------------------------------------------------------------
-- One-time backfill: recompute already-finalized results with the corrected
-- totals so old rows agree with new ones. Deterministic — safe to re-run.
-- ----------------------------------------------------------------------------
with graded as (
  select
    t.id                                                as attempt_id,
    coalesce(jsonb_array_length(t.question_order), 0)   as q_total,
    coalesce((select count(*)::int from public.questions q
              where q.exam_id = t.exam_id), 0)          as exam_total,
    count(a.id) filter (where a.selected_answer is not null)::int as answered,
    count(*)    filter (where a.selected_answer = q.correct_answer)::int as correct,
    count(*)    filter (where a.selected_answer is not null
                        and a.selected_answer <> q.correct_answer)::int as wrong
  from public.exam_attempts t
  left join public.answers a   on a.attempt_id = t.id
  left join public.questions q on q.id = a.question_id
  where t.status <> 'in_progress'
  group by t.id
)
update public.results r
   set correct_count = g.correct,
       wrong_count   = g.wrong,
       skipped_count = greatest(0, (case when g.q_total > 0 then g.q_total else g.exam_total end) - g.answered),
       score         = greatest(0, g.correct * t.marks_per_question - g.wrong * t.negative_marking),
       percentage    = case
                         when (case when g.q_total > 0 then g.q_total else g.exam_total end) * t.marks_per_question > 0
                         then round(
                           greatest(0, g.correct * t.marks_per_question - g.wrong * t.negative_marking) * 100
                           / ((case when g.q_total > 0 then g.q_total else g.exam_total end) * t.marks_per_question),
                           2)
                         else 0
                       end,
       accuracy      = case when g.answered > 0
                            then round(g.correct * 100.0 / g.answered, 2) else 0 end
  from graded g
  join public.exam_attempts t on t.id = g.attempt_id
 where r.attempt_id = g.attempt_id;
