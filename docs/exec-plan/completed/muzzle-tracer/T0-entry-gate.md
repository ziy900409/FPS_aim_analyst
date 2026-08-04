# T0 — Entry gate(基線核對 + 讀碼證據 + CLAUDE.md §4 補句)

> Part of [WP-27 muzzle-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | —(GD-18 五項設計決策已於採納時拍板,見 [DECISIONS.md](../../DECISIONS.md)) |
| **Risk / Cplx** | Low / Low |
| **Touches** | 本資料夾 docs + [CLAUDE.md](../../../../CLAUDE.md) §4 tracer 條目 |
| **狀態** | ✅ PASS(2026-08-03) |

## Objective

動 `src/` 之前先鎖三件事:**前置相依已綠**(KI-002 D1)、**乾淨基線**(`test:ci` exit 0 +
既有測試清單)、**讀碼證據**(F-2 / F-3 / F-5 三個陷阱的行號級佐證)——這是 T1 零破壞論證的參照點。

## In scope

- **前置核對(C-0)**:確認 [BUGFIX-DECISIONS.md](../../../known_issue/BUGFIX-DECISIONS.md) **BD-002 ✅**
  (KI-002 D1+D2,2026-07-15)已落地;`br-field` 的 `eyeZ:0` 在 `src/scene/scenes/br-field.ts` 生效。
  結論記 progress(一句話 + 檔案/行號)。
- **乾淨基線**:`npm run test:ci` exit 0,記下 vitest files/tests 數與 playwright 數作為
  T1/T2 的**零破壞比較基準**。
- **讀碼證據(F-2 / F-3 / F-5)**記 progress,含行號:
  1. **F-2**:`arena.ox/oy/oz` 的**雙重角色**——tracer origin([SimLoop.ts:324](../../../../src/loop/SimLoop.ts#L324)/[:353](../../../../src/loop/SimLoop.ts#L353))
     **與** maxRange/落地距離基準([:339-343](../../../../src/loop/SimLoop.ts#L339-L343));故 C-1b 另立 `m*` 欄。
  2. **F-3**:`ballisticQ` 的合成來源([:127-133](../../../../src/loop/SimLoop.ts#L127-L133))= `state.aim + rawPunch×2`,
     **不**讀 camera quaternion;確認 `CameraController` 於 render 幀寫 camera 朝向 → 禁用來源的理由。
  3. **F-5**:既有會被本 WP 影響的測試清單 —— 必改 1 案([SimLoop.test.ts:432](../../../../src/loop/SimLoop.test.ts#L432));
     必須零修改全綠的清單(至少:`tests/regression/projectile-determinism.test.ts`、
     `src/loop/SimLoop.test.ts` 其餘案、`src/state/SharedState.test.ts`、`src/render/TracerView.test.ts`、
     `tests/regression/br-camera-anchor-invariants.test.ts`、命中/彈孔/fire 事件相關檔)。
- **`src/data/` 零引用複核**:grep 確認 `shotRays` 未被 `src/data/` 引用(C-2 前提)。
- **CLAUDE.md §4 補句**:既有 tracer 條目後補
  「**tracer origin 為 muzzle 偏移,與命中/彈道原點分離**——muzzle 只寫 `shotRays` / `BulletArena.m*`,
  不得進入 raycast 原點、`arena.o*`(maxRange/落地基準)或 `pushImpact`(WP-27/GD-18)」,與本 task 同 commit。
- **OQ-MT-2 登記**:在 progress 的 OQ ledger 明記 owner + deadline(T2 前)+ 量測方法
  (實機影格:量測槍口在畫面中的像素位置 → 依當時 FOV 與解析度換算視角度 → 反推 world 偏移)。

## Out of scope

- 任何 `src/` 變更;GD-18 已拍板事項的重新討論;ADS 偏移量的實際量測(OQ-MT-2 本身)。

## Steps

- [x] BD-002 / KI-002 D1 核對 + `br-field.eyeZ` 佐證記 progress。
- [x] `npm run test:ci` 乾淨基準 exit 0,數字記 progress。
- [x] F-2 / F-3 / F-5 三項讀碼證據(含行號)記 progress。
- [x] `src/data/` 對 `shotRays` 零引用 grep 證據記 progress。
- [x] CLAUDE.md §4 tracer 條目補句(與本 task 同 commit)。
- [x] OQ-MT-2 owner / deadline / 量測方法登記 progress OQ ledger。
- [x] progress.md 記 entry-gate PASS 宣告。

## Definition of Done

- BD-002 已落地之佐證可追(檔案 + 行號);`test:ci` exit 0 基準數字入 progress;
- F-2 / F-3 / F-5 三項證據皆含行號,且 F-5 的「必改 1 案 / 零修改清單」明文列出;
- CLAUDE.md §4 含新句;
- OQ-MT-2 有 owner 與 deadline;
- `git diff --stat` **不含 `src/`**。

## Commit

`docs(wp-27): T0 entry gate — 基線核對 + muzzle 讀碼證據(arena.o* 雙重角色/ballisticQ 來源)`
