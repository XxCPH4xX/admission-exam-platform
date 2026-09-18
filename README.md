# Admission Exam Platform — ভর্তি প্রস্তুতি পরীক্ষা

A production-quality online MCQ examination platform for Bangladesh admission
preparation (Medical / BUET / DU / GST / BCS style mock tests), inspired by
Udvash, Unmesh, ACS and Retina.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn UI · Supabase (Postgres + Auth + Storage) · Zod · Zustand · TanStack
Query · Recharts · Vercel

---

## Features

| Area | Highlights |
| --- | --- |
| **Exam engine** | Server-validated countdown, question palette (answered/current colors), jump navigation, keyboard shortcuts (←/→/A–D), fullscreen mode |
| **Autosave** | Instant optimistic save on every selection, background sync queue with retry, localStorage backup — refresh-proof |
| **Recovery** | Reload mid-exam → answers, timer and question restored from the server; local-only answers are re-synced automatically |
| **Anti-cheat** | Timer authority lives server-side (`ends_at`); expired saves are rejected and auto-finalized; `correct_answer` hidden at the SQL column level during exams |
| **Submission** | Manual or time-up auto-submit via an atomic Postgres function (`submit_attempt`) — no result tampering possible from the client |
| **Results & review** | Score / percentage / accuracy, correct–wrong–skipped breakdown, green/red answer review with filters (no explanations by design) |
| **Admin** | Exam CRUD + publish/unpublish, per-question CRUD, multi-image upload to Supabase Storage, CSV/XLSX import with preview & error report |
| **Analytics** | Student score/accuracy trends + distribution; admin subject stats, participation, top students |
| **Bangla** | Full UTF-8 pipeline, Noto Sans Bengali typography (with Hind Siliguri/SolaimanLipi/Kalpurush fallbacks), one-click EN↔বাংলা UI toggle |
| **Security** | RLS everywhere, column-level grants, role guards in middleware + server actions + API routes, Zod validation on every write, rate limiting, same-site cookies |

---

## Quick start (local)

### 1. Database

Open **Supabase Dashboard → SQL Editor**, paste the entire contents of
[`supabase/schema.sql`](supabase/schema.sql) and click **Run**.

This creates tables, indexes, RLS policies, the scoring functions, the
`question-images` storage bucket and two demo exams with Bangla questions.

### 2. Environment

`.env.local` already exists with your project's keys:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # server-only
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Seed users

```bash
npm run db:seed
```

Creates both accounts (idempotent — safe to re-run):

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admixam.com` | `Admi234` |
| Student | `stuenxam.com` | `Stude234` |

Override via env: `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
`SEED_STUDENT_EMAIL`, `SEED_STUDENT_PASSWORD`.

### 4. Run

```bash
npm install
npm run dev        # http://localhost:3000
```

---

## Deployment (Vercel)

1. Push this folder to a GitHub repository.
2. In Vercel: **New Project → import the repo** (framework auto-detects Next.js).
3. Add the four environment variables above in **Project → Settings →
   Environment Variables** (plus an optional `CRON_SECRET`, any random string).
4. Deploy.
5. Set **Supabase Dashboard → Authentication → URL Configuration → Site URL**
   to your Vercel domain so auth cookies work across redirects.
6. The cron in [`vercel.json`](vercel.json) finalizes expired attempts every
   minute (Vercel Hobby allows daily crons; on free plans the lazy expiry path
   already covers everything — cron is a bonus).

---

## How integrity is guaranteed

- **Timer:** the deadline (`exam_attempts.ends_at`) is fixed when the attempt
  starts. The client only *displays* the delta. Every autosave ack re-syncs it,
  and any save arriving after the deadline is rejected and triggers scoring.
- **Scoring:** `results` rows can only be written by the SECURITY DEFINER
  function `_finalize_attempt` — students have zero insert/update access even
  via the REST API.
- **Answers leak prevention:** `questions.correct_answer` is revoked from
  `authenticated` at the PostgreSQL column level; exam sessions select only the
  safe columns. Full questions are served only after submission.
- **One active attempt:** a partial unique index enforces a single
  `in_progress` attempt per user per exam.

## Project structure

```
src/
├── app/                    # Routes (App Router)
│   ├── admin/              # Admin dashboard, exams CRUD, students, results, analytics
│   ├── student/            # Student dashboard, exams, history, analytics
│   │   ├── exams/[examId]/ # Exam instructions + start gate
│   │   ├── result/[attemptId]/  # Result summary
│   │   └── review/[attemptId]/  # Answer review (green/red)
│   ├── exam/[attemptId]/   # The timed exam engine
│   └── api/                # Route handlers (attempts, admin CRUD, uploads, cron)
├── components/             # UI kit (shadcn) + app shells + exam components
├── features/               # Feature modules (server actions, client widgets)
├── services/               # Data-access layer (Supabase clients live only here)
├── lib/                    # supabase clients, i18n, rate-limit, feature flags
├── store/                  # Zustand (exam engine state machine)
├── hooks/                  # useTranslation, useExamTimer
├── types/                  # Domain + DB row types
└── validations/            # Zod schemas shared by forms and APIs
supabase/schema.sql         # Full database migration (run once)
scripts/                    # db:seed, db:expire
```

## Notes

- **xlsx (SheetJS 0.18.5)** parses admin-uploaded files server-side. npm's
  audit flags advisories for this vintage; input is admin-only, size-capped
  (10 MB) and schema-validated before touching the database. Swap to
  `exceljs` if you want a fully patched parser.
- Rate limiting is in-memory (per serverless instance). For heavy traffic move
  to Upstash Redis behind the same `rateLimit()` interface.
- Feature flags live in [`src/lib/features.ts`](src/lib/features.ts):
  dark mode, random question order, random option order, retakes, fullscreen,
  leaderboard, multi-student expansion.
