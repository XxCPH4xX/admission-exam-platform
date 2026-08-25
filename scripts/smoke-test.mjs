/**
 * Security & data smoke test against the LIVE Supabase project.
 * Logs in as the seeded student/admin and probes PostgREST the same way a
 * hostile client would (no service key involved in the "attack" requests).
 *
 * Usage: npm run smoke
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // fall through — env may already be set
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error("✗ Missing Supabase env vars (.env.local)");
  process.exit(1);
}

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
  if (!res.ok) throw new Error(`login failed for ${email}: ${await res.text()}`);
  return (await res.json()).access_token;
}

/** Raw PostgREST GET/POST as a specific bearer token (or null for anon). */
async function rest(path, { method = "GET", token, body } = {}) {
  const headers = { apikey: anonKey, "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body is fine */
  }
  return { status: res.status, json };
}

const anon = rest.bind(null);

// ---------------------------------------------------------------------------
console.log("\n── Student perspective ──────────────────────────────────────");
const sTok = await login("student@exam.com", process.env.SEED_STUDENT_PASSWORD ?? "Student@1234");

// 1. Published exams are visible
{
  const { status, json } = await rest("exams?select=id,title,published&published=eq.true", { token: sTok });
  check("student can list published exams", status === 200 && Array.isArray(json) && json.length >= 2, `${json?.length ?? 0} exams`);
}

// 2. Unpublished exams are NOT visible
{
  const { status, json } = await rest("exams?select=id&published=eq.false", { token: sTok });
  check("unpublished exams hidden from students", status === 200 && Array.isArray(json) && json.length === 0);
}

// 3. THE critical one: correct_answer must never come back over the wire.
// Column-level grants make PostgREST fail CLOSED: any statement touching the
// column — selecting it, select=*, filtering, sorting — is a 403.
{
  const safe = await rest("questions?select=id,exam_id,question_text&limit=1", { token: sTok });
  check("safe question columns readable by student", safe.status === 200 && Array.isArray(safe.json) && safe.json.length > 0);

  for (const probe of ["select=correct_answer&limit=1", "select=*&limit=1", "correct_answer=eq.B&select=id"]) {
    const { status } = await rest(`questions?${probe}`, { token: sTok });
    check(`correct_answer blocked (${probe.split("&")[0]})`, status === 403 || status === 401, `status ${status}`);
  }
}

// 4. Profile isolation: only own row
{
  const { json } = await rest("users?select=email,role", { token: sTok });
  check("students see only their own profile", Array.isArray(json) && json.length === 1 && json[0].email === "student@exam.com");
}

// 5. Attempt isolation: no rows for a fresh student
{
  const { json } = await rest("exam_attempts?select=*", { token: sTok });
  check("students see only their own attempts", Array.isArray(json) && json.length === 0);
}

// 6. RLS write protection: student must not create exams
{
  const { status } = await rest("exams", {
    method: "POST",
    token: sTok,
    body: { title: "HACK", subject: "x", category: "y", duration_minutes: 5, marks_per_question: 1 },
  });
  check("student CANNOT insert exams (RLS)", status === 403 || status === 401, `status ${status}`);
}

// 7. Revoked RPC must be uncallable by authenticated users
{
  const res = await fetch(`${url}/rest/v1/rpc/expire_all_stale_attempts`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: `Bearer ${sTok}`, "content-type": "application/json" },
    body: "{}",
  });
  check("expire_all_stale_attempts revoked from users", res.status === 404 || res.status === 403, `status ${res.status}`);
}

// 8. Anonymous (no login) gets nothing sensitive.
// RLS-filtered tables return 200 with an EMPTY array (not 401) — empty is the
// security property we care about; column-revoked tables still hard-403.
{
  const { status, json } = await anon("exam_attempts?select=*");
  check("anonymous sees zero attempts", status === 200 && Array.isArray(json) && json.length === 0,
        `status ${status}, ${json?.length ?? "?"} rows`);
  const { json: qj } = await anon("questions?select=id&limit=1");
  const q = Array.isArray(qj) ? qj[0] : null;
  check("anonymous gets no question data", status === 200 ? q == null : true);
}

// ---------------------------------------------------------------------------
console.log("\n── Admin perspective ────────────────────────────────────────");
const aTok = await login(process.env.SEED_ADMIN_EMAIL ?? "admin@exam.com", process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234");

{
  const { json } = await rest("users?select=email,role", { token: aTok });
  check("admin sees all profiles", Array.isArray(json) && json.length >= 2, `${json?.length ?? 0} profiles`);
}
{
  const { json } = await rest("exams?select=id&published=eq.false", { token: aTok });
  check("admin RLS policies active (query runs)", Array.isArray(json));
}
// By design even admins lack the column grant — admin UI uses the service-role
// server client. Confirm consistency so nobody "fixes" this accidentally.
{
  const { status } = await rest("questions?select=correct_answer&limit=1", { token: aTok });
  check("correct_answer blocked for admin tokens too (service role only)", status === 403 || status === 401, `status ${status}`);
}

// ---------------------------------------------------------------------------
console.log("\n── Service-role sanity ──────────────────────────────────────");
const svc = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
{
  const { count, error } = await svc.from("questions").select("*", { count: "exact", head: true });
  check("demo questions exist", !error && (count ?? 0) >= 8, `${count} questions`);
  const { data } = await svc.from("questions").select("correct_answer").limit(1);
  check("service role CAN read correct_answer", Array.isArray(data) && data[0] && "correct_answer" in data[0]);
}
{
  const { data, error } = await svc.from("users").select("email,role");
  check("both profiles present", !error && data?.length === 2 &&
        data.some(u => u.role === "admin") && data.some(u => u.role === "student"));
}
{
  const { data } = await svc.storage.from("question-images").list("", { limit: 1 });
  check("question-images bucket reachable", Array.isArray(data));
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED ✅" : `${failures} CHECK(S) FAILED ❌`}\n`);
process.exit(failures === 0 ? 0 : 1);
