import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * WP-51 T1 — M18 evidence schema/writer (README §2.2 `M18EvidenceRecord`). Pure/injectable: no
 * `git`/`process` inspection here — the runner collects the shared environment fields once and
 * passes them in, so this module stays trivially unit-testable. Redaction is enforced at record
 * time (NFR-51.9: "不得embed完整payload或絕對真實history path") — a forbidden absolute path in
 * `artifact`/`command`/`notes` fails the record rather than silently landing in a report.
 */

export type M18EvidenceKind = 'automated' | 'measurement' | 'inspection' | 'manual';
export type M18EvidenceStatus = 'pass' | 'fail' | 'blocked' | 'not-applicable';

export interface Stage10EvidenceEnvironment {
  readonly commit: string;
  readonly node: string;
  readonly os: string;
  readonly browser: string;
  readonly backend: string;
}

export interface M18EvidenceRecord {
  readonly id: string;
  readonly status: M18EvidenceStatus;
  readonly kind: M18EvidenceKind;
  readonly owner: string;
  readonly command?: string;
  readonly artifact: string;
  readonly environment: Stage10EvidenceEnvironment & { readonly startedAt: string };
  readonly notes?: string;
}

export type M18EvidenceInput = Omit<M18EvidenceRecord, 'environment'> & {
  readonly startedAt?: string;
};

export class Stage10EvidenceRedactionError extends Error {
  constructor(recordId: string, forbiddenPath: string) {
    super(`evidence record "${recordId}" leaks a forbidden absolute path: ${forbiddenPath}`);
    this.name = 'Stage10EvidenceRedactionError';
  }
}

export interface CreateStage10EvidenceReporterOptions {
  readonly environment: Stage10EvidenceEnvironment;
  /** Absolute paths that must never appear verbatim in `artifact`/`command`/`notes` — typically the
   * real workspace root and `data/session-history` (NFR-51.9). */
  readonly forbiddenAbsolutePaths?: readonly string[];
}

export interface Stage10EvidenceReport {
  readonly generatedAt: string;
  readonly records: readonly M18EvidenceRecord[];
}

export interface Stage10EvidenceReporter {
  record(entry: M18EvidenceInput): M18EvidenceRecord;
  records(): readonly M18EvidenceRecord[];
  write(filePath: string): Promise<void>;
}

function assertRedacted(recordId: string, forbidden: readonly string[], haystacks: readonly string[]): void {
  for (const forbiddenPath of forbidden) {
    if (forbiddenPath === '') continue;
    for (const haystack of haystacks) {
      if (haystack.includes(forbiddenPath)) throw new Stage10EvidenceRedactionError(recordId, forbiddenPath);
    }
  }
}

export function createStage10EvidenceReporter(options: CreateStage10EvidenceReporterOptions): Stage10EvidenceReporter {
  const forbidden = options.forbiddenAbsolutePaths ?? [];
  const records: M18EvidenceRecord[] = [];

  return {
    record(entry: M18EvidenceInput): M18EvidenceRecord {
      assertRedacted(entry.id, forbidden, [entry.artifact, entry.command ?? '', entry.notes ?? '']);
      const { startedAt, ...rest } = entry;
      const full: M18EvidenceRecord = {
        ...rest,
        environment: { ...options.environment, startedAt: startedAt ?? new Date().toISOString() },
      };
      records.push(full);
      return full;
    },

    records(): readonly M18EvidenceRecord[] {
      return records.slice();
    },

    async write(filePath: string): Promise<void> {
      const report: Stage10EvidenceReport = { generatedAt: new Date().toISOString(), records: records.slice() };
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(report, null, 2), 'utf8');
    },
  };
}
