/**
 * Full browser E2E: login as student → start exam → answer → autosave check
 * → submit via dialog → land on result page with a score.
 *
 * Usage: node scripts/e2e-browser.mjs   (dev server on :3000)
 */
import { chromium } from "playwright";

const APP = process.env.APP_BASE_URL ?? "http://localhost:3000";
let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗ FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(`PAGEERROR: ${err.message}`));
const failedRequests = [];
page.on("response", (res) => {
  if (res.url().includes("/api/") && res.status() >= 400) {
    failedRequests.push(`${res.request().method()} ${res.url()} → ${res.status()}`);
  }
});

try {
  // ── Login ──────────────────────────────────────────────────────────────
  console.log("\n── Browser journey ─────────────────────────────────────────");
  await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await page.fill("#email", "student@exam.com");
  await page.fill("#password", process.env.SEED_STUDENT_PASSWORD ?? "Student@1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/student**", { timeout: 20_000 });
  check("login → /student", page.url().includes("/student"), page.url());

  // ── Pick an exam from the list ─────────────────────────────────────────
  await page.goto(`${APP}/student/exams`, { waitUntil: "networkidle" });
  const examLink = page.locator('a[href^="/student/exams/"]').first();
  const examHref = await examLink.getAttribute("href");
  check("exam list shows exams", !!examHref, examHref ?? "");
  await examLink.click();
  await page.waitForURL("**/student/exams/**", { timeout: 15_000 });

  // ── Start the attempt ───────────────────────────────────────────────────
  const startBtn = page.getByRole("button", { name: /start exam|continue exam|retake/i });
  await startBtn.waitFor({ state: "visible", timeout: 15_000 });
  await startBtn.click();

  // ── Exam engine loads ───────────────────────────────────────────────────
  await page.waitForURL("**/exam/**", { timeout: 30_000 });
  const attemptId = page.url().split("/exam/")[1]?.split(/[?#]/)[0];
  check("engine page reached", !!attemptId, page.url());

  await page.locator('[role="radiogroup"]').first().waitFor({ state: "visible", timeout: 30_000 });
  check("questions rendered", true);

  // Answer Q1–Q3 via real clicks
  for (let q = 0; q < 3; q++) {
    await page.locator('[role="radio"]').first().click();
    // Wait for autosave ack ("Saved" pill appears once lastSyncedAt set)
    await page.getByText("Saved", { exact: true }).waitFor({ timeout: 15_000 }).catch(() => {});
    if (q < 2) {
      await page.getByRole("button", { name: /^next/i }).click();
      await page.waitForTimeout(300);
    }
  }
  const savedVisible = await page.getByText("Saved", { exact: true }).isVisible().catch(() => false);
  check("autosave acked (Saved indicator)", savedVisible);

  const answeredText = await page.getByText(/answered/).first().textContent().catch(() => "");
  check("header counts answers", /3 answered/.test(answeredText ?? ""), answeredText?.trim() ?? "");

  // ── Submit via dialog ───────────────────────────────────────────────────
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 10_000 });
  check("submit dialog opens", true);

  await dialog.getByRole("button", { name: /yes, submit now|try again/i }).click();

  // ── Result page ─────────────────────────────────────────────────────────
  await page.waitForURL("**/student/result/**", { timeout: 30_000 });
  check("redirected to result page", page.url().includes(`/student/result/${attemptId}`), page.url());

  const body = await page.textContent("body");
  check("result shows score", /score|স্কোর/i.test(body ?? ""), "");
  const hasErrorBoundary = (body ?? "").toLowerCase().includes("something went wrong");
  check("no error boundary", !hasErrorBoundary);

  // Screenshot for the record
  await page.screenshot({ path: "scripts/e2e-result.png", fullPage: true });
} catch (err) {
  failures++;
  console.error("✗ EXCEPTION:", err.message);
  await page.screenshot({ path: "scripts/e2e-failure.png", fullPage: true }).catch(() => {});
}

console.log("\nconsole errors:", consoleErrors.length ? consoleErrors.slice(0, 10) : "none");
console.log("api 4xx/5xx:", failedRequests.length ? failedRequests.slice(0, 10) : "none");

await browser.close();
console.log(`\n${failures === 0 ? "BROWSER E2E PASSED ✅" : `${failures} CHECK(S) FAILED ❌`}`);
process.exit(failures === 0 ? 0 : 1);
