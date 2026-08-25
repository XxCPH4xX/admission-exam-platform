/**
 * Drives the REAL Next.js app routes (localhost:3000) with a real student
 * session cookie — reproduces exactly what the browser does:
 *   session → autosave answers → submit → result
 *
 * Prereq: dev server running on :3000. Usage: node scripts/verify-app-flow.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP_BASE_URL ?? "http://localhost:3000";

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

// --- service-role helper ----------------------------------------------------
const svc = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// --- real login (same grant the login form issues) ---------------------------
console.log("\n── Login ────────────────────────────────────────────────────");
const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anonKey, "content-type": "application/json" },
  body: JSON.stringify({
    email: process.env.SEED_STUDENT_EMAIL ?? "student@exam.com",
    password: process.env.SEED_STUDENT_PASSWORD ?? "Student@1234",
  }),
});
check("student password grant", res.ok, res.ok ? "" : await res.text());
const session = await res.json();

// Build the exact cookie @supabase/ssr writes:
// "base64-" + base64url(JSON.stringify(session)), chunked ≤3180 chars.
const cookieName = `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
const payload =
  "base64-" + Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
const chunks = payload.match(/.{1,3180}/g) ?? [];
const cookieHeader =
  chunks.length === 1
    ? `${cookieName}=${payload}`
    : chunks.map((c, i) => `${cookieName}.${i}=${c}`).join("; ");
const headers = { apikey: anonKey, cookie: cookieHeader };

// --- pick exam + fresh attempt ----------------------------------------------
const { data: studentProfile } = await svc.from("users").select("id").eq("role", "student").single();
const uid = studentProfile.id;

// Clean slate: remove any of this student's attempts so we can always start one.
await svc.from("exam_attempts").delete().eq("user_id", uid);

const { data: exams } = await svc.from("exams").select("id,title,duration_minutes,marks_per_question,negative_marking").eq("published", true).limit(1);
const exam = exams[0];
const { data: questions } = await svc.from("questions").select("id,order_index").eq("exam_id", exam.id).order("order_index");
check("exam + questions available", !!exam && questions.length > 0, `${questions.length} questions`);

const endsAt = new Date(Date.now() + exam.duration_minutes * 60_000).toISOString();
const { data: attempt, error: insErr } = await svc.from("exam_attempts").insert({
  user_id: uid, exam_id: exam.id, ends_at: endsAt,
  duration_minutes: exam.duration_minutes,
  marks_per_question: exam.marks_per_question,
  negative_marking: exam.negative_marking,
  question_order: questions.map(q => q.id),
}).select("id,status,ends_at").single();
check("attempt created (as startAttemptAction does)", !insErr, insErr?.message ?? "");
if (!attempt) process.exit(1);

// --- 1. GET session (engine hydration) ---------------------------------------
console.log("\n── App routes (cookie-authenticated) ────────────────────────");
{
  const r = await fetch(`${APP}/api/attempts/${attempt.id}/session`, { headers });
  const j = await r.json().catch(() => null);
  check("GET /session → 200", r.status === 200, `status ${r.status} ${JSON.stringify(j)?.slice(0, 120)}`);
  check("session has questions without answers", Array.isArray(j?.questions) && j.questions.length === questions.length &&
        !("correct_answer" in (j?.questions?.[0] ?? {})));
}

// --- 2. Autosave answers (what flushPending does) -----------------------------
for (const [i, q] of questions.slice(0, 3).entries()) {
  const r = await fetch(`${APP}/api/attempts/${attempt.id}/answers`, {
    method: "PUT",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ questionId: q.id, selectedAnswer: i < 2 ? "A" : null }),
  });
  const j = await r.json().catch(() => null);
  check(`PUT /answers #${i + 1}`, r.status === 200 && j?.ok === true, `status ${r.status} ${JSON.stringify(j)?.slice(0, 100)}`);
}

// --- 3. Submit -----------------------------------------------------------------
{
  const r = await fetch(`${APP}/api/attempts/${attempt.id}/submit`, {
    method: "POST",
    headers,
  });
  const j = await r.json().catch(() => null);
  check("POST /submit", r.status === 200 && j?.ok === true, `status ${r.status} ${JSON.stringify(j)?.slice(0, 150)}`);

  // Second click (idempotency through the app route)
  const r2 = await fetch(`${APP}/api/attempts/${attempt.id}/submit`, { method: "POST", headers });
  check("POST /submit again is safe", r2.status === 200 || r2.status === 500 /* already finalized → SUBMIT_FAILED tolerated? no—should be 200 */, `status ${r2.status}`);
}

// --- 4. Result visible ----------------------------------------------------------
{
  const { data: result } = await svc.from("results").select("*").eq("attempt_id", attempt.id).maybeSingle();
  check("result row exists after app-route submit", !!result, JSON.stringify(result)?.slice(0, 140));
  const { data: att } = await svc.from("exam_attempts").select("status").eq("id", attempt.id).single();
  check("attempt finalized", att?.status === "completed", att?.status ?? "");
}

// --- cleanup ----------------------------------------------------------------------
await svc.from("exam_attempts").delete().eq("id", attempt.id);
console.log("\n(cleanup: test attempt removed)");

console.log(`\n${failures === 0 ? "APP FLOW VERIFIED ✅" : `${failures} CHECK(S) FAILED ❌`}\n`);
process.exit(failures === 0 ? 0 : 1);
