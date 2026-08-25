/**
 * Renders every dashboard page as the right role and fails on error
 * boundaries / console errors. Usage: node scripts/page-sweep.mjs
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const APP = process.env.APP_BASE_URL ?? "http://localhost:3000";

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function login(page, email, password) {
  await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(student|admin)/, { timeout: 20_000 });
}

const browser = await chromium.launch({ headless: true });

async function sweep(role, email, password, pages) {
  console.log(`\n── ${role} pages ────────────────────────────────────────────`);
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message.slice(0, 200)}`));

  await login(page, email, process.env.SEED_STUDENT_PASSWORD ?? password);

  for (const [name, url] of pages) {
    errors.length = 0;
    const res = await page.goto(`${APP}${url}`, { waitUntil: "networkidle", timeout: 30_000 });
    const body = (await page.textContent("body")) ?? "";
    const boundary = /something went wrong|application error/i.test(body);
    check(`${name} (${url})`, res.ok() && !boundary && errors.length === 0,
          boundary ? "error boundary" : errors.length ? errors[0] : `status ${res.status()}`);
  }
  await context.close();
}

// Latest completed attempt for the review/result deep links
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: lastAttempt } = await svc.from("exam_attempts")
  .select("id").eq("status", "completed").order("started_at", { ascending: false }).limit(1);
const attemptId = lastAttempt?.[0]?.id ?? "";

await sweep("Student", "student@exam.com", "Student@1234", [
  ["dashboard", "/student"],
  ["exams list", "/student/exams"],
  ["history", "/student/history"],
  ["analytics", "/student/analytics"],
  ["result page", `/student/result/${attemptId}`],
  ["review page", `/student/review/${attemptId}`],
]);

await sweep("Admin", process.env.SEED_ADMIN_EMAIL ?? "admin@exam.com", process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234", [
  ["overview", "/admin"],
  ["exams", "/admin/exams"],
  ["results", "/admin/results"],
  ["students", "/admin/students"],
  ["analytics", "/admin/analytics"],
]);

await browser.close();
console.log(`\n${failures === 0 ? "ALL PAGES RENDER ✅" : `${failures} PAGE(S) FAILED ❌`}`);
process.exit(failures === 0 ? 0 : 1);
