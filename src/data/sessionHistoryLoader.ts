import type { ExportPayload } from './export.ts';
import { parseExportPayload } from './exportPayloadSchema.ts';
import type { SessionSummary } from '../metrics/sessionHistory.ts';

/** The subset of the browser File API needed by the multi-file history loader. */
export interface SessionHistoryFile {
  readonly name: string;
  text(): Promise<string>;
}

/**
 * Converts one validated Assessment export into its family-specific history summary. The caller
 * owns metric derivation because raw exports do not persist scene/condition reconstruction inputs.
 */
export type SessionSummaryFromExport = (payload: ExportPayload) => SessionSummary;

/**
 * Reads selected JSON exports and excludes Practice (including legacy exports with no Assessment
 * metadata) before a summary can enter a formal personal baseline.
 */
export async function loadAssessmentSessionSummaries(
  files: Iterable<SessionHistoryFile>,
  toSessionSummary: SessionSummaryFromExport,
): Promise<SessionSummary[]> {
  const summaries: SessionSummary[] = [];
  for (const file of files) {
    const payload = readExportPayload(await file.text(), file.name);
    if (payload.meta.assessment === undefined) continue;
    summaries.push(toSessionSummary(payload));
  }
  return summaries;
}

function readExportPayload(text: string, fileName: string): ExportPayload {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${fileName} is not valid JSON`);
  }
  const result = parseExportPayload(value);
  if (!result.ok) throw new Error(`${fileName} is not an export payload`);
  return result.payload;
}
