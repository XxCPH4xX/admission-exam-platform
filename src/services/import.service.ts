import "server-only";
import * as XLSX from "xlsx";
import { normalizeAnswer } from "@/lib/exam";
import { importRowSchema, type ParsedImport } from "@/validations/import";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ROWS = 500;

const HEADER_ALIASES: Record<string, string> = {
  question: "question",
  "question text": "question",
  প্রশ্ন: "question",
  "option a": "optionA",
  "option_a": "optionA",
  "অপশন ক": "optionA",
  "option b": "optionB",
  "option_b": "optionB",
  "অপশন খ": "optionB",
  "option c": "optionC",
  "option_c": "optionC",
  "অপশন গ": "optionC",
  "option d": "optionD",
  "option_d": "optionD",
  "অপশন ঘ": "optionD",
  "correct answer": "correctAnswer",
  "correct_answer": "correctAnswer",
  answer: "correctAnswer",
  "সঠিক উত্তর": "correctAnswer",
  "image url": "imageUrl",
  image: "imageUrl",
};

/**
 * Parse an uploaded CSV/XLSX buffer into validated import rows.
 * Handles UTF-8 Bangla content and maps ক/খ/গ/ঘ → A/B/C/D.
 */
export function parseImportFile(
  fileName: string,
  buffer: Buffer
): ParsedImport {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const lower = fileName.toLowerCase();
  const isXlsx = lower.endsWith(".xlsx");
  const isCsv =
    lower.endsWith(".csv") || lower.endsWith(".txt");

  if (!isXlsx && !isCsv) {
    throw new Error("UNSUPPORTED_TYPE");
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = isXlsx
      ? XLSX.read(buffer, { type: "buffer", cellDates: false })
      : XLSX.read(buffer.toString("utf8"), {
          type: "string",
          raw: false,
        });
  } catch {
    throw new Error("READ_FAILED");
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("EMPTY_FILE");

  // header:1 → array-of-arrays; defval keeps empty cells stable
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });

  if (matrix.length < 2) throw new Error("NO_ROWS");

  // Map header row → canonical field names
  const headerRow = (matrix[0] ?? []).map((h) =>
    String(h ?? "").trim().toLowerCase()
  );
  const columnMap = new Map<number, string>();
  for (let c = 0; c < headerRow.length; c++) {
    const field = HEADER_ALIASES[headerRow[c]];
    if (field && ![...columnMap.values()].includes(field)) {
      columnMap.set(c, field);
    }
  }

  // Fall back to positional mapping when headers are unrecognized
  const hasMappedQuestion = [...columnMap.values()].includes("question");
  if (!hasMappedQuestion) {
    const positional = ["question", "optionA", "optionB", "optionC", "optionD", "correctAnswer", "imageUrl"];
    columnMap.clear();
    positional.forEach((field, i) => {
      if (i < Math.max(headerRow.length, 6)) columnMap.set(i, field);
    });
  }

  const rows: ParsedImport["rows"] = [];
  const errors: ParsedImport["errors"] = [];

  for (let r = 1; r < matrix.length; r++) {
    const raw = matrix[r];
    if (!raw || raw.every((cell) => String(cell ?? "").trim() === "")) continue;

    const record: Record<string, string | null> = {};
    for (const [c, field] of columnMap) {
      const value = raw[c];
      record[field] = value === undefined || value === null ? null : String(value).trim();
    }

    // Normalize the correct answer (ক/খ/গ/ঘ or A–D)
    const normalizedAnswer = normalizeAnswer(record.correctAnswer ?? "");

    const result = importRowSchema.safeParse({
      question: record.question ?? "",
      optionA: record.optionA ?? "",
      optionB: record.optionB ?? "",
      optionC: record.optionC ?? "",
      optionD: record.optionD ?? "",
      correctAnswer: normalizedAnswer ?? "",
      imageUrl:
        record.imageUrl && /^https?:\/\//i.test(record.imageUrl)
          ? record.imageUrl
          : null,
    });

    const rowNumber = r + 1; // 1-indexed including header
    if (result.success) {
      rows.push(result.data);
    } else {
      errors.push({
        rowNumber,
        errors: result.error.issues.map(
          (issue) => `${issue.path.join(".") || "row"}: ${issue.message}`
        ),
      });
    }
  }

  if (rows.length + errors.length > MAX_ROWS) {
    throw new Error("TOO_MANY_ROWS");
  }

  return { rows, errors, totalRows: rows.length + errors.length };
}
