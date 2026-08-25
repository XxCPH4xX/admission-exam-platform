import { NextResponse, type NextRequest } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { requireAdminApi } from "@/lib/api-auth";
import { parseImportFile } from "@/services/import.service";

/**
 * POST /api/admin/import?examId=<uuid>
 * Accepts multipart form with `file` (CSV/XLSX). Returns validated rows +
 * per-row errors for preview. The actual import happens via the bulk
 * questions endpoint after the admin confirms.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const rl = rateLimit(`import:${auth.user.id}:${getClientIp(request.headers)}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429, headers: { "retry-after": String(rl.retryAfterSeconds) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("examId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(examId)) {
    return NextResponse.json({ error: "INVALID_EXAM_ID" }, { status: 400 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "NO_FILE" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseImportFile(file.name, buffer);
    return NextResponse.json({ ok: true, ...parsed });
  } catch (err) {
    const code =
      err instanceof Error ? err.message : "READ_FAILED";
    const statusMap: Record<string, number> = {
      FILE_TOO_LARGE: 413,
      UNSUPPORTED_TYPE: 415,
      READ_FAILED: 422,
      NO_ROWS: 422,
      TOO_MANY_ROWS: 413,
    };
    return NextResponse.json(
      { error: code },
      { status: statusMap[code] ?? 500 }
    );
  }
}
