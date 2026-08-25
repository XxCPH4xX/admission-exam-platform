import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/services/auth.service";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILES = 5;

/**
 * Upload question images to Supabase Storage (service-role write).
 * Returns public URLs for storing in questions.image_urls.
 */
export async function POST(request: NextRequest) {
  // Auth: admins only (session checked server-side, not from client claims)
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  // Rate limit uploads per admin
  const rl = rateLimit(`upload:${user.id}:${getClientIp(request.headers)}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSeconds) } }
    );
  }

  const formData = await request.formData();
  const examId = String(formData.get("examId") ?? "");
  if (!examId || !/^[0-9a-f-]{36}$/i.test(examId)) {
    return NextResponse.json({ error: "INVALID_EXAM_ID" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "NO_FILES" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: "TOO_MANY_FILES", max: MAX_FILES }, { status: 400 });
  }

  const storage = createAdminClient().storage.from("question-images");
  const urls: string[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "UNSUPPORTED_TYPE", file: file.name },
        { status: 415 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "FILE_TOO_LARGE", file: file.name },
        { status: 413 }
      );
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `exams/${examId}/${crypto.randomUUID()}.${ext}`;

    const { error } = await storage.upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    urls.push(storage.getPublicUrl(path).data.publicUrl);
  }

  return NextResponse.json({ urls });
}
