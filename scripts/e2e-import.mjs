/**
 * E2E: admin uploads a real CSV through the import panel in a real browser,
 * against a throwaway exam (deleted afterwards). Usage:
 *   node scripts/e2e-import.mjs <path-to-csv>
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("usage: node scripts/e2e-import.mjs <csv-path>");
  process.exit(1);
}

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

const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Throwaway exam
const { data: exam, error: exErr } = await svc.from("exams").insert({
  title: "E2E import throwaway — delete me",
  subject: "e2e", category: "e2e",
  duration_minutes: 5, marks_per_question: 1, negative_marking: 0,
  published: false,
}).select("id").single();
check("throwaway exam created", !exErr, exErr?.message ?? "");
if (!exam) process.exit(1);

const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message));

try {
  await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", process.env.SEED_ADMIN_EMAIL ?? "admin@exam.com");
  await page.fill("#password", process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 20_000 });

  await page.goto(`${APP}/admin/exams/${exam.id}`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /import/i }).click();

  // Real file upload through the real input
  await page.setInputFiles('input[type="file"]', csvPath);
  await page.getByText(/valid$/).first().waitFor({ timeout: 20_000 });
  const validText = await page.getByText(/valid$/).first().textContent();
  check("parse preview valid", /\d+ valid/.test(validText ?? ""), validText ?? "");

  await page.getByRole("button", { name: /Import \d+ question/ }).click();
  const toast = page.getByText(/Imported \d+ question/);
  await toast.waitFor({ timeout: 30_000 });
  check("import succeeded", true, (await toast.textContent()) ?? "");

  const { count } = await svc.from("questions").select("id", { count: "exact", head: true }).eq("exam_id", exam.id);
  check("50 questions in DB", count === 50, `${count} rows`);
} catch (err) {
  failures++;
  console.error("✗ EXCEPTION:", err.message.split("\n")[0]);
  await page.screenshot({ path: "scripts/e2e-import-failure.png" }).catch(() => {});
}

check("no page errors", consoleErrors.length === 0, consoleErrors[0] ?? "");

await browser.close();

// Cleanup — cascade deletes the imported questions
await svc.from("exams").delete().eq("id", exam.id);
console.log("\n(throwaway exam + questions deleted)");

console.log(`\n${failures === 0 ? "IMPORT E2E PASSED ✅" : `${failures} CHECK(S) FAILED ❌`}`);
process.exit(failures === 0 ? 0 : 1);
