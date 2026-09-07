import { describe, expect, it } from 'vitest';
import { buildExportPayload, type ExportPayload } from '../../src/data/export.ts';
import { collectMeta } from '../../src/data/metadata.ts';
import { resolveTargetHitbox, targetHitboxToConfig } from '../../src/drill/DrillConfig.ts';
import { deriveMouseThrow } from '../../src/metrics/mouseThrow.ts';
import { deriveRepositioningSuspicion } from '../../src/metrics/spiderShotRepositioning.ts';
import { resolveEyeWorldBase } from '../../src/scene/eyePose.ts';
import { wideFlickArena } from '../../src/scene/scenes/wide-flick-arena.ts';
import {
  FIXTURE_FOV_DEG,
  canonicalWideFrames,
  runWide,
  wideDrillConfig,
} from './spiderWideDeterminismFixture.ts';
import { buildWideFlickPayload, PERIPHERAL_YAW_DEG } from './spiderWideRepositioningFixture.ts';

/**
 * WP-57 / T5 步驟 4–5 —— 門檻敏感度表與 `cm/360` 方向性檢查。
 *
 * ⚠️ **這份表量的是偵測器對門檻的反應面，不是抬滑鼠的真實盛行率。** T6（實機）尚未執行，repo 內
 * 沒有任何帶真實滑鼠軌跡的 wide run，因此下方的 cohort 是**由明示的生成模型合成的**：每個 flick
 * 的停滯是注入的，ground truth 已知。這讓表能回答「門檻選在哪裡才把抬滑鼠與刻意停頓分開」，但
 * **不能**回答「玩家實際多常抬滑鼠」。後者是 OQ-57.5，仍待真實資料。
 *
 * 第一個 `describe` 先把這件事實測入帳（唯一一個走生產管線的 wide run 產出 0 個可推導的窗），
 * 免得後人把合成表誤讀為實測。
 */

/** 生成模型：單次 50° 拉槍所需的實體行程超過剩餘鼠墊預算時，玩家必須抬滑鼠。 */
const PAD_BUDGET_CM = 6;
/** 每個 cm/360 條件下的 flick 數。 */
const FLICKS_PER_CONDITION = 8;
/** 抬滑鼠 = 準心完全不動（ω = 0），長度取四個值以免退化成單一數字。 */
const LIFT_STALL_MS = [180, 220, 260, 300] as const;
/** 刻意停頓 = 猶豫但仍在微調：短，且**帶殘餘角速度**——`stallOmegaDegPerSec` 要分開的正是這個。 */
const HESITATION_MS = [0, 40, 80, 120] as const;
const HESITATION_RESIDUAL_DEG_PER_SEC = 15;

/** `meta.dpi = 800` 固定；感度值選成 `cm/360` 落在 20…100 的整數附近（見下方實測斷言）。 */
const SENSITIVITIES = [2.6, 1.7318, 1.3, 0.866, 0.65, 0.52] as const;

const STALL_MIN_MS_GRID = [80, 120, 150, 200, 250, 300] as const;
const STALL_OMEGA_GRID = [5, 10, 20, 40] as const;

/** 敏感度表的工作點；**不是凍結值**，OQ-57.5 待真實資料收斂。 */
const WORKING_POINT = { stallMinMs: 150, stallOmegaDegPerSec: 10 } as const;

interface Condition {
  readonly sensitivity: number;
  readonly cmPer360: number;
  readonly liftCount: number;
  readonly payloads: readonly ExportPayload[];
}

const CONDITIONS: readonly Condition[] = SENSITIVITIES.map(buildCondition);
const ALL_PAYLOADS = CONDITIONS.flatMap((condition) => condition.payloads);

describe('WP-57 T5 — 為什麼這張表是合成的（實測入帳，不是假設）', () => {
  it('the only production-pipeline wide run cannot support the flag at all (KI-005 refusal)', () => {
    // `spiderWideDeterminismFixture` 的 recorder 沒有配置 `mouseIntegration`（該 harness 刻意把
    // aim 釘在 yaw = pitch = 0：合成滑鼠軌跡會把 harness 自身的幀邊界帶進刺激，汙染 FPS parity
    // 的歸因），因此匯出**根本沒有** `ticks.dYaw`/`dPitch`。`omegaDegPerSec()` 依 KI-005 契約
    // 直接拒絕這種匯出，而不是退回有 beat-aliasing bug 的舊推導 —— 本旗標繼承同一個拒絕。
    //
    // ⇒ 拿它跑敏感度表不是「樣本少」，而是**一格資料都沒有**。這就是下方 cohort 必須合成的理由。
    expect(() => deriveRepositioningSuspicion(buildRealRunPayload(), WORKING_POINT)).toThrow(
      /has no ticks\.dYaw\/dPitch/,
    );
  });
});

describe('WP-57 T5 步驟 4 — 門檻敏感度表', () => {
  it('prints the stallMinMs × stallOmegaDegPerSec annotation-rate surface', () => {
    const header = ['stallMinMs \\ ω(deg/s)', ...STALL_OMEGA_GRID.map(String)].join(' | ');
    const rows = STALL_MIN_MS_GRID.map((stallMinMs) =>
      [
        String(stallMinMs),
        ...STALL_OMEGA_GRID.map((stallOmegaDegPerSec) =>
          annotationRate(ALL_PAYLOADS, { stallMinMs, stallOmegaDegPerSec }).toFixed(4),
        ),
      ].join(' | '),
    );
    // eslint-disable-next-line no-console -- 這張表是 progress.md 的證據來源，必須可從測試輸出抄錄。
    console.log(['', header, ...rows, ''].join('\n'));
    expect(rows).toHaveLength(STALL_MIN_MS_GRID.length);
  });

  it('is monotone non-increasing in stallMinMs — a longer required stall can only flag fewer', () => {
    for (const stallOmegaDegPerSec of STALL_OMEGA_GRID) {
      const column = STALL_MIN_MS_GRID.map((stallMinMs) =>
        annotationRate(ALL_PAYLOADS, { stallMinMs, stallOmegaDegPerSec }),
      );
      expect(column).toEqual([...column].sort((a, b) => b - a));
    }
  });

  it('is monotone non-decreasing in stallOmegaDegPerSec — a looser near-zero bound can only flag more', () => {
    for (const stallMinMs of STALL_MIN_MS_GRID) {
      const row = STALL_OMEGA_GRID.map((stallOmegaDegPerSec) =>
        annotationRate(ALL_PAYLOADS, { stallMinMs, stallOmegaDegPerSec }),
      );
      expect(row).toEqual([...row].sort((a, b) => a - b));
    }
  });

  it('separates lifts from hesitations exactly at the working point', () => {
    // 工作點 (150 ms, 10 deg/s)：注入的抬滑鼠（≥180 ms、ω = 0）全數命中，刻意停頓（≤120 ms、
    // ω = 15 deg/s）零誤標。這是「表上這一格為什麼被選作工作點」的可執行理由。
    const flagged = CONDITIONS.reduce(
      (sum, condition) => sum + suspectedCount(condition.payloads, WORKING_POINT),
      0,
    );
    const injected = CONDITIONS.reduce((sum, condition) => sum + condition.liftCount, 0);
    expect(injected).toBeGreaterThan(0);
    expect(flagged).toBe(injected);
  });
});

describe('WP-57 T5 步驟 5 — cm/360 方向性檢查', () => {
  it('derives cm/360 from the payload via deriveMouseThrow, not from a second sensitivity model', () => {
    const derived = CONDITIONS.map((condition) => condition.cmPer360);
    expect(derived.map((cm) => Math.round(cm))).toEqual([20, 30, 40, 60, 80, 100]);
  });

  it('prints cm/360 alongside the annotation rate at the working point', () => {
    const rows = CONDITIONS.map((condition) =>
      [
        condition.cmPer360.toFixed(2),
        condition.sensitivity.toFixed(4),
        ((PERIPHERAL_YAW_DEG / 360) * condition.cmPer360).toFixed(2),
        `${condition.liftCount}/${FLICKS_PER_CONDITION}`,
        annotationRate(condition.payloads, WORKING_POINT).toFixed(4),
      ].join(' | '),
    );
    // eslint-disable-next-line no-console -- progress.md 的證據來源。
    console.log(['', 'cm/360 | sensitivity | 單次行程(cm) | 注入抬滑鼠 | 標註率', ...rows, ''].join('\n'));
    expect(rows).toHaveLength(CONDITIONS.length);
  });

  it('rises monotonically with cm/360 — the expected direction', () => {
    // 方向若相反或無關，依 T5 步驟 5 就是偵測器有問題的訊號，必須重新評估判準。
    const rates = CONDITIONS.map((condition) => annotationRate(condition.payloads, WORKING_POINT));
    expect(rates).toEqual([...rates].sort((a, b) => a - b));
    expect(rates[rates.length - 1]).toBeGreaterThan(rates[0]);
    expect(rates[0]).toBe(0);
  });
});

function buildCondition(sensitivity: number): Condition {
  const probe = buildWideFlickPayload({ sensitivity });
  const cmPer360 = deriveMouseThrow(probe).cmPer360;
  if (cmPer360 === undefined) throw new Error('fixture meta must carry a DPI so cm/360 is derivable');

  const liftCount = Math.round(FLICKS_PER_CONDITION * liftFraction(cmPer360));
  const payloads = Array.from({ length: FLICKS_PER_CONDITION }, (_unused, index) => {
    if (index < liftCount) {
      return buildWideFlickPayload({
        sensitivity,
        stall: { afterMovedMs: 100, durationMs: LIFT_STALL_MS[index % LIFT_STALL_MS.length] },
      });
    }
    const durationMs = HESITATION_MS[index % HESITATION_MS.length];
    return buildWideFlickPayload({
      sensitivity,
      ...(durationMs === 0
        ? {}
        : {
            stall: {
              afterMovedMs: 100,
              durationMs,
              residualDegPerSec: HESITATION_RESIDUAL_DEG_PER_SEC,
            },
          }),
    });
  });

  return { sensitivity, cmPer360, liftCount, payloads };
}

/**
 * 單次 50° 拉槍所需行程超出鼠墊預算的比例，夾在 [0, 1]。行程需求隨 `cm/360` 線性成長，故這是
 * 「感度越低越常被迫抬滑鼠」這個機制的最小可寫下形式 —— 它是**假設**，不是量測。
 */
function liftFraction(cmPer360: number): number {
  const travelCm = (PERIPHERAL_YAW_DEG / 360) * cmPer360;
  return Math.min(1, Math.max(0, (travelCm - PAD_BUDGET_CM) / PAD_BUDGET_CM));
}

function suspectedCount(
  payloads: readonly ExportPayload[],
  options: { readonly stallMinMs: number; readonly stallOmegaDegPerSec: number },
): number {
  return payloads.reduce(
    (sum, payload) =>
      sum + deriveRepositioningSuspicion(payload, options).filter((row) => row.suspected).length,
    0,
  );
}

function annotationRate(
  payloads: readonly ExportPayload[],
  options: { readonly stallMinMs: number; readonly stallOmegaDegPerSec: number },
): number {
  const rows = payloads.flatMap((payload) => [...deriveRepositioningSuspicion(payload, options)]);
  return rows.length === 0 ? 0 : rows.filter((row) => row.suspected).length / rows.length;
}

/** 逐行對齊 `spider-wide-export-roundtrip.test.ts` 的 meta 組裝（即 `src/main.ts` 的三段）。 */
function buildRealRunPayload(): ExportPayload {
  const config = wideDrillConfig();
  const spiderShot = config.spiderShot;
  if (spiderShot === undefined) throw new Error('fixture drill must carry a resolved spiderShot schedule');

  const meta = collectMeta({
    drillId: config.drillId,
    weaponId: 'usp_s_laser',
    weaponSeed: 0,
    rngSeed: spiderShot.seed,
    backend: 'webgpu',
    displayHz: 144,
    browser: 'test-browser',
    sensitivity: 2,
    dpi: 800,
    fovDeg: FIXTURE_FOV_DEG,
    crossOriginIsolated: true,
    startedAt: '2026-09-07T00:00:00.000Z',
    targets: { hitbox: targetHitboxToConfig(resolveTargetHitbox(config)) },
    spawn: { seed: spiderShot.seed, spiderShot },
    scene: {
      sceneId: wideFlickArena.sceneId,
      assetPackVersion: wideFlickArena.assetPackVersion,
      clutterTier: wideFlickArena.clutterTier,
      fallback: false,
      eye: resolveEyeWorldBase(wideFlickArena),
    },
  });
  return buildExportPayload(meta, runWide(canonicalWideFrames()).snapshot);
}
