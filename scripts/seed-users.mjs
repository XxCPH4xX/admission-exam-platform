/**
 * Creates the initial admin and student accounts via the Supabase Admin API.
 * Profiles in public.users are auto-created by the on_auth_user_created trigger.
 *
 * Usage:  npm run db:seed
 * Override credentials via env: SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD /
 *                               SEED_STUDENT_EMAIL / SEED_STUDENT_PASSWORD
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Minimal .env.local loader (no dotenv dependency needed)
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  // fall through — env may already be set
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const USERS = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@exam.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@1234",
    name: "Administrator",
    role: "admin",
  },
  {
    email: process.env.SEED_STUDENT_EMAIL ?? "student@exam.com",
    password: process.env.SEED_STUDENT_PASSWORD ?? "Student@1234",
    name: "Student",
    role: "student",
  },
];

async function ensureProfile(userId, { name, email, role }) {
  const { error } = await admin.from("users").upsert(
    { id: userId, name, email, role },
    { onConflict: "id" }
  );
  if (error) throw new Error(`profile upsert failed: ${error.message}`);
}

for (const spec of USERS) {
  // createUser is idempotent-ish: check list first so reruns don't fail
  const { data: existing } = await admin.auth.admin.listUsers({
    perPage: 500,
  });
  const found = existing?.users?.find((u) => u.email === spec.email);

  let userId = found?.id;

  if (userId) {
    await admin.auth.admin.updateUserById(userId, {
      password: spec.password,
      user_metadata: { name: spec.name },
      app_metadata: { role: spec.role },
    });
    console.log(`↻ updated existing user ${spec.email}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: spec.email,
      password: spec.password,
      email_confirm: true,
      user_metadata: { name: spec.name },
      app_metadata: { role: spec.role },
    });
    if (error) {
      console.error(`✗ failed to create ${spec.email}: ${error.message}`);
      continue;
    }
    userId = data.user.id;
    console.log(`✓ created auth user ${spec.email}`);
  }

  try {
    await ensureProfile(userId, spec);
    console.log(`✓ profile ready (${spec.role}) → ${spec.email}`);
  } catch (err) {
    console.error(`✗ ${err.message}`);
  }
}

console.log("\nDone. Logins:");
for (const s of USERS) {
  console.log(`  ${s.role.padEnd(7)} ${s.email} / ${s.password}`);
}
