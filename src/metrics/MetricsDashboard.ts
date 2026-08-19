import type { DataRecorderSnapshot } from '../data/DataRecorder.ts';
import type { ExportPayload } from '../data/export.ts';
import { computeMetrics, type Metrics } from './compute.ts';
import { computePromotedMetrics, type PromotedMetrics } from './researchMetrics.ts';

export interface MetricsDashboard {
  compute(snapshot: DataRecorderSnapshot): Metrics;
  computePromoted(payload: ExportPayload): PromotedMetrics;
}

export function createMetricsDashboard(): MetricsDashboard {
  return {
    compute(snapshot: DataRecorderSnapshot): Metrics {
      return computeMetrics(snapshot);
    },
    computePromoted(payload: ExportPayload): PromotedMetrics {
      return computePromotedMetrics(payload);
    },
  };
}
