/**
 * 錄製 manifest 的解析（`docs/operational/spider-wide-recording-spec.md` §3.3）。
 *
 * manifest 有**兩種**條目形態，兩種都合法：
 * - **字串**（WP-57）：`{ "<檔名>": "<指示>" }` —— 方向性分組只需要指示這一個欄位。
 * - **物件**（WP-61）：`{ "<檔名>": { "instruction": ..., "instructionClass": ..., "sessionId": ... } }`
 *   —— 標註 cohort 另需 `instructionClass`（標註代表什麼）與 `sessionId`（FR-61.7 的分割隔離）。
 *
 * ⚠️ **T2 修掉的既有落差**：物件型條目自 T1 起就寫在錄製規格裡，但 `analyze-spider-wide` 的
 * `loadManifest()` 只收字串，遇到物件會擲 `must be a non-empty string instruction` —— 也就是
 * **規格文件教操作者寫一份腳本會拒收的 manifest**。錄製當下才發現，那是一輪重錄。
 *
 * 純函式：吃字串、吐 Map，不碰檔案系統（I/O 在各 CLI）。
 */
import { INSTRUCTION_CLASSES, isInstructionClass, type InstructionClass } from './liftCohortAudit.ts';

export interface LiftManifestEntry {
  /** 操作者填的指示文字 = 方向性分組的 ground truth。逐字比對，不做模糊比對。 */
  readonly instruction: string;
  /** WP-61 標註 cohort 用的封閉指示類別。字串型條目沒有它。 */
  readonly instructionClass?: InstructionClass;
  /** 獨立 session 識別名。校準／held-out 依它隔離（FR-61.7）。 */
  readonly sessionId?: string;
  /** golden 檔名用的匿名 run 識別名；缺席時由檔名推導。 */
  readonly runId?: string;
  /** ISO 8601 錄製時刻 —— 分割排序的第一順位鍵。 */
  readonly recordedAt?: string;
  /** 人填的錄製順序 —— 排序的第三順位鍵。 */
  readonly order?: number;
}

/**
 * @param raw        manifest 的 JSON 內容。
 * @param sourcePath 只用於錯誤訊息（讓操作者知道是哪一份 manifest 有問題）。
 * @throws 型別不符時擲出**指名條目與欄位**的錯誤 —— 一份靜默被忽略的 manifest 欄位，會讓整批 run
 *         被歸到錯的組別而沒有任何跡象。
 */
export function readLiftManifest(raw: string, sourcePath: string): ReadonlyMap<string, LiftManifestEntry> {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`manifest must be a JSON object keyed by export filename: ${sourcePath}`);
  }

  const entries = new Map<string, LiftManifestEntry>();
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    entries.set(baseName(key), parseEntry(key, value, sourcePath));
  }
  return entries;
}

function parseEntry(key: string, value: unknown, sourcePath: string): LiftManifestEntry {
  if (typeof value === 'string') {
    if (value.trim() === '') throw new Error(`manifest entry '${key}' must be a non-empty string instruction: ${sourcePath}`);
    return { instruction: value };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`manifest entry '${key}' must be a string or an object: ${sourcePath}`);
  }

  const record = value as Record<string, unknown>;
  const instruction = record.instruction;
  if (typeof instruction !== 'string' || instruction.trim() === '') {
    throw new Error(`manifest entry '${key}'.instruction must be a non-empty string: ${sourcePath}`);
  }
  if (record.instructionClass !== undefined && !isInstructionClass(record.instructionClass)) {
    throw new Error(
      `manifest entry '${key}'.instructionClass must be one of ${INSTRUCTION_CLASSES.join(' / ')}: ${sourcePath}`,
    );
  }
  for (const field of ['sessionId', 'runId', 'recordedAt'] as const) {
    if (record[field] !== undefined && (typeof record[field] !== 'string' || (record[field] as string).trim() === '')) {
      throw new Error(`manifest entry '${key}'.${field} must be a non-empty string: ${sourcePath}`);
    }
  }
  if (record.order !== undefined && (typeof record.order !== 'number' || !Number.isFinite(record.order))) {
    throw new Error(`manifest entry '${key}'.order must be a finite number: ${sourcePath}`);
  }

  return {
    instruction,
    ...(record.instructionClass !== undefined ? { instructionClass: record.instructionClass as InstructionClass } : {}),
    ...(record.sessionId !== undefined ? { sessionId: record.sessionId as string } : {}),
    ...(record.runId !== undefined ? { runId: record.runId as string } : {}),
    ...(record.recordedAt !== undefined ? { recordedAt: record.recordedAt as string } : {}),
    ...(record.order !== undefined ? { order: record.order as number } : {}),
  };
}

/** 比對用檔名，讓 manifest 不綁絕對路徑（沿用既有 `loadManifest()` 的行為）。 */
function baseName(key: string): string {
  const parts = key.split(/[\\/]/);
  return parts[parts.length - 1];
}
