import { isResolutionMode, type ResolutionMode } from './resolutionMode.ts';
import type { EligibilityRequirement } from './eligibilityGate.ts';

export interface ProtocolCondition {
  label: string;
  mode: ResolutionMode;
  sceneId: string;
  drillId: string;
}

export interface ProtocolConfig {
  protocolId: string;
  requiredDisplay: EligibilityRequirement;
  conditions: ProtocolCondition[];
}

export interface ProtocolConditionContext {
  protocolId: string;
  conditionIndex: number;
  conditionLabel: string;
  condition: ProtocolCondition;
  suspect: boolean;
  suspectReason?: string;
}

export interface ProtocolReadyState {
  mode: ResolutionMode;
  sceneId: string;
  drillId: string;
}

export interface ProtocolConditionExport<TPayload> {
  context: ProtocolConditionContext;
  payload: TPayload;
}

export interface ProtocolRunnerOptions<TPayload> {
  config: ProtocolConfig;
  applyCondition: (
    condition: ProtocolCondition,
    context: ProtocolConditionContext,
  ) => ProtocolReadyState | Promise<ProtocolReadyState>;
  exportCondition: (context: ProtocolConditionContext) => TPayload | Promise<TPayload>;
  onConditionStart?: (context: ProtocolConditionContext) => void;
  onConditionComplete?: (result: ProtocolConditionExport<TPayload>) => void;
  onProtocolComplete?: (exports: readonly ProtocolConditionExport<TPayload>[]) => void;
}

export interface ProtocolRunner<TPayload> {
  readonly config: ProtocolConfig;
  readonly current: ProtocolConditionContext | undefined;
  readonly exports: readonly ProtocolConditionExport<TPayload>[];
  start(): Promise<ProtocolConditionContext>;
  beginNextCondition(): Promise<ProtocolConditionContext | undefined>;
  completeCurrentCondition(): Promise<ProtocolConditionExport<TPayload>>;
  markCurrentConditionSuspect(reason: string): void;
  reset(): void;
}

export function validateProtocol(value: unknown): ProtocolConfig {
  const root = requireRecord(value, 'protocol');
  const protocolId = requireNonEmptyString(root.protocolId, 'protocol.protocolId');
  const requiredDisplayRecord = requireRecord(root.requiredDisplay, 'protocol.requiredDisplay');
  const requiredDisplay: EligibilityRequirement = {
    minW: requirePositiveInteger(requiredDisplayRecord.minW, 'protocol.requiredDisplay.minW'),
    minH: requirePositiveInteger(requiredDisplayRecord.minH, 'protocol.requiredDisplay.minH'),
  };
  const rawConditions = root.conditions;
  if (!Array.isArray(rawConditions) || rawConditions.length === 0) {
    throw new Error('protocol.conditions must be a non-empty array');
  }
  const conditions = rawConditions.map((condition, index) => requireCondition(condition, index));
  return { protocolId, requiredDisplay, conditions };
}

export function createProtocolRunner<TPayload>(
  options: ProtocolRunnerOptions<TPayload>,
): ProtocolRunner<TPayload> {
  const config = validateProtocol(options.config);
  let current: ProtocolConditionContext | undefined;
  const exports: ProtocolConditionExport<TPayload>[] = [];

  async function beginCondition(index: number): Promise<ProtocolConditionContext | undefined> {
    const condition = config.conditions[index];
    if (condition === undefined) return undefined;

    current = {
      protocolId: config.protocolId,
      conditionIndex: index,
      conditionLabel: condition.label,
      condition,
      suspect: false,
    };
    const ready = await options.applyCondition(condition, snapshotContext(current));
    assertReadyState(condition, ready);
    options.onConditionStart?.(snapshotContext(current));
    return snapshotContext(current);
  }

  return {
    config,
    get current(): ProtocolConditionContext | undefined {
      return current === undefined ? undefined : snapshotContext(current);
    },
    get exports(): readonly ProtocolConditionExport<TPayload>[] {
      return exports.map((result) => ({
        context: snapshotContext(result.context),
        payload: result.payload,
      }));
    },
    async start(): Promise<ProtocolConditionContext> {
      exports.length = 0;
      const first = await beginCondition(0);
      if (first === undefined) throw new Error('protocol has no conditions');
      return first;
    },
    beginNextCondition(): Promise<ProtocolConditionContext | undefined> {
      return beginCondition((current?.conditionIndex ?? -1) + 1);
    },
    async completeCurrentCondition(): Promise<ProtocolConditionExport<TPayload>> {
      if (current === undefined) throw new Error('protocol has no active condition');
      const context = snapshotContext(current);
      const payload = await options.exportCondition(context);
      const result = { context, payload };
      exports.push(result);
      options.onConditionComplete?.({ context: snapshotContext(context), payload });
      if (context.conditionIndex === config.conditions.length - 1) {
        options.onProtocolComplete?.(
          exports.map((item) => ({ context: snapshotContext(item.context), payload: item.payload })),
        );
        current = undefined;
      }
      return { context: snapshotContext(context), payload };
    },
    markCurrentConditionSuspect(reason: string): void {
      if (current === undefined) return;
      current.suspect = true;
      current.suspectReason = requireNonEmptyString(reason, 'reason');
    },
    reset(): void {
      current = undefined;
      exports.length = 0;
    },
  };
}

function requireCondition(value: unknown, index: number): ProtocolCondition {
  const condition = requireRecord(value, `protocol.conditions[${index}]`);
  const mode = condition.mode;
  if (!isResolutionMode(mode)) throw new Error(`protocol.conditions[${index}].mode must be native, fhd-1080, or qhd-1440`);
  return {
    label: requireNonEmptyString(condition.label, `protocol.conditions[${index}].label`),
    mode,
    sceneId: requireNonEmptyString(condition.sceneId, `protocol.conditions[${index}].sceneId`),
    drillId: requireNonEmptyString(condition.drillId, `protocol.conditions[${index}].drillId`),
  };
}

function assertReadyState(condition: ProtocolCondition, ready: ProtocolReadyState): void {
  const state = requireRecord(ready, 'protocol ready state') as Partial<ProtocolReadyState>;
  if (state.mode !== condition.mode) {
    throw new Error(`protocol condition ${condition.label} expected display mode ${condition.mode}, got ${String(state.mode)}`);
  }
  if (state.sceneId !== condition.sceneId) {
    throw new Error(`protocol condition ${condition.label} expected scene ${condition.sceneId}, got ${String(state.sceneId)}`);
  }
  if (state.drillId !== condition.drillId) {
    throw new Error(`protocol condition ${condition.label} expected drill ${condition.drillId}, got ${String(state.drillId)}`);
  }
}

function snapshotContext(context: ProtocolConditionContext): ProtocolConditionContext {
  return {
    protocolId: context.protocolId,
    conditionIndex: context.conditionIndex,
    conditionLabel: context.conditionLabel,
    condition: { ...context.condition },
    suspect: context.suspect,
    ...(context.suspectReason !== undefined ? { suspectReason: context.suspectReason } : {}),
  };
}

function requireRecord(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function requirePositiveInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}
