import type { DataRecorderSnapshot } from '../data/DataRecorder.ts';
import { computeMetrics, type Metrics } from './compute.ts';

export interface MetricsDashboard {
  compute(snapshot: DataRecorderSnapshot): Metrics;
}

export function createMetricsDashboard(): MetricsDashboard {
  return {
    compute(snapshot: DataRecorderSnapshot): Metrics {
      return computeMetrics(snapshot);
    },
  };
}
