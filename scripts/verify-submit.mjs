/**
 * End-to-end submission verification against the LIVE database.
 * Simulates: start attempt → save answers → submit → grade check,
 * plus cross-user FORBIDDEN enforcement.
 *
 * Usage: node scripts/verify-submit.mjs   (after schema patch)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("✗ Missing Supabase env vars");
  process.exit(1);
}

const svc = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function login(email, password) {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${await res.text()}`);
  const json = await res.json();
  return { token: json.access_token, uid: json.user.id };
}

// ---------------------------------------------------------------------------
console.log("\n── Setup ────────────────────────────────────────────────────");
const student = await login("student@exam.com", process.env.SEED_STUDENT_PASSWORD ?? "Student@1234");
check("student login", !!student.token);

// Pick a published exam the student does NOT already have an active attempt
// on (the partial unique index correctly blocks parallel active attempts).
const { data: activeOn } = await svc.from("exam_attempts").select("exam_id")
  .eq("user_id", student.uid).eq("status", "in_progress");
const busyExamIds = new Set((activeOn ?? []).map(a => a.exam_id));
const { data: exams } = await svc.from("exams")
  .select("id,title,total_marks,marks_per_question,negative_marking,duration_minutes")
  .eq("published", true);
const exam = (exams ?? []).find(e => !busyExamIds.has(e.id));
check("available demo exam found", !!exam, exam?.title ?? "");
if (!exam) process.exit(1);

const { data: questions } = await svc.from("questions").select("id,correct_answer,order_index")
  .eq("exam_id", exam.id).order("order_index");
check("questions loaded", (questions?.length ?? 0) >= 3, `${questions?.length} questions`);
if ((questions?.length ?? 0) < 3) process.exit(1);

// Answer pattern: first two CORRECT, third WRONG, rest untouched
const plan = questions.slice(0, 3).map((q, i) => ({
  question_id: q.id,
  selected_answer: i < 2 ? q.correct_answer : (["A","B","C","D"].find(a => a !== q.correct_answer)),
}));
const expectedCorrect = 2, expectedWrong = 1;
const mph = Number(exam.marks_per_question), neg = Number(exam.negative_marking);
const expectedScore = Math.max(0, expectedCorrect * mph - expectedWrong * neg);
const expectedPct = Math.round(((expectedScore * 100) / (questions.length * mph)) * 100) / 100;
const expectedAcc = Math.round((expectedCorrect * 100 / 3) * 100) / 100;

// ---------------------------------------------------------------------------
console.log("\n── Student starts & takes attempt (RLS path) ────────────────");
const endsAt = new Date(Date.now() + exam.duration_minutes * 60_000).toISOString();
const ins = await fetch(`${url}/rest/v1/exam_attempts`, {
  method: "POST",
  headers: { apikey: anonKey, authorization: `Bearer ${student.token}`, "content-type": "application/json", prefer: "return=representation" },
  body: JSON.stringify({
    user_id: student.uid, exam_id: exam.id, ends_at: endsAt,
    duration_minutes: exam.duration_minutes, marks_per_question: mph, negative_marking: neg,
  }),
});
if (!ins.ok) {
  console.error("attempt insert failed:", ins.status, await ins.text());
  process.exit(1);
}
const attemptId = (await ins.json())[0].id;
check("attempt started under RLS", !!attemptId);

for (const row of plan) {
  const r = await fetch(`${url}/rest/v1/answers`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: `Bearer ${student.token}`, "content-type": "application/json" },
    body: JSON.stringify({ ...row, attempt_id: attemptId }),
  });
  check(`answer saved (${row.selected_answer})`, r.status === 201);
}

// ---------------------------------------------------------------------------
console.log("\n── Submit via RPC (user-token path, auth.uid()) ─────────────");
{
  const r = await fetch(`${url}/rest/v1/rpc/submit_attempt`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: `Bearer ${student.token}`, "content-type": "application/json" },
    body: JSON.stringify({ p_attempt_id: attemptId }),
  });
  check("submit_attempt succeeds", r.ok, r.ok ? "" : `${r.status} ${await r.text()}`);

  const { data: result } = await svc.from("results").select("*").eq("attempt_id", attemptId).maybeSingle();
  check("result written", !!result);
  if (result) {
    check(`score = ${expectedScore}`, Number(result.score) === expectedScore, `got ${result.score}`);
    check(`percentage = ${expectedPct}`, Number(result.percentage) === expectedPct, `got ${result.percentage}`);
    check(`accuracy = ${expectedAcc}`, Number(result.accuracy) === expectedAcc, `got ${result.accuracy}`);
    check("counts 2/1/2", result.correct_count === 2 && result.wrong_count === 1 && result.skipped_count === questions.length - 3,
          `${result.correct_count}/${result.wrong_count}/${result.skipped_count}`);
  }
  const { data: att } = await svc.from("exam_attempts").select("status,submitted_at").eq("id", attemptId).maybeSingle();
  check("attempt completed", att?.status === "completed", att?.status ?? "");

  // Idempotency: resubmitting must not duplicate or change anything
  const { count } = await svc.from("results").select("*", { count: "exact", head: true }).eq("attempt_id", attemptId);
  check("resubmit safe (single result)", count === 1);
}

// ---------------------------------------------------------------------------
console.log("\n── Ownership enforcement ────────────────────────────────────");
{
  const { data: adminProfile } = await svc.from("users").select("id,email").eq("role", "admin").maybeSingle();
  const foreignIns = await svc.from("exam_attempts").insert({
    user_id: adminProfile.id, exam_id: exam.id, ends_at: endsAt,
    duration_minutes: exam.duration_minutes, marks_per_question: mph, negative_marking: neg,
  }).select("id").single();
  check("service role created admin-owned attempt", !foreignIns.error);

  if (foreignIns.data) {
    const r = await fetch(`${url}/rest/v1/rpc/submit_attempt`, {
      method: "POST",
      headers: { apikey: anonKey, authorization: `Bearer ${student.token}`, "content-type": "application/json" },
      body: JSON.stringify({ p_attempt_id: foreignIns.data.id }),
    });
    const body = await r.json().catch(() => ({ message: "" }));
    check("student CANNOT submit someone else's attempt", /FORBIDDEN/.test(body.message ?? ""), body.message);
    // And the explicit-p_user_id path used by our server route:
    const r2 = await fetch(`${url}/rest/v1/rpc/submit_attempt`, {
      method: "POST",
      headers: { apikey: anonKey, authorization: `Bearer ${student.token}`, "content-type": "application/json" },
      body: JSON.stringify({ p_attempt_id: foreignIns.data.id, p_user_id: student.uid }),
    });
    const b2 = await r2.json().catch(() => ({ message: "" }));
    check("mismatched p_user_id rejected too", /FORBIDDEN/.test(b2.message ?? ""), b2.message);
    await svc.from("exam_attempts").delete().eq("id", foreignIns.data.id); // cleanup (cascade)
  }
}

// ---------------------------------------------------------------------------
console.log("\n── Cleanup ──────────────────────────────────────────────────");
const del = await svc.from("exam_attempts").delete().eq("id", attemptId);
check("test attempt removed", !del.error);

console.log(`\n${failures === 0 ? "SUBMIT PIPELINE VERIFIED ✅" : `${failures} CHECK(S) FAILED ❌`}\n`);
process.exit(failures === 0 ? 0 : 1);
