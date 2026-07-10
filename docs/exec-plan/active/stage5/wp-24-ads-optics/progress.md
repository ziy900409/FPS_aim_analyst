# WP-24 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 進行中(T0 ✅,T1 next)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 EV_ADS 輸入鏈 | ⬜ |
| T2 WeaponConfig.ads + zoom | ⬜ |
| T3 overlay + 記錄 | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S5-1 ADS 感度換算模型(CS2 zoom_sensitivity_ratio vs monitor-distance match)→ **GD-16** | ✅ 已決 | **CS2 式 FOV-ratio gain**:`sensitivity × sensitivityRatio × (adsFov / hipFov)`;`sensitivityRatio` 預設 1.0;pre-registered 後凍結,monitor-distance match 不重解釋既有資料 |
| OQ-S5-6 ADS 操作語意(hold vs toggle) | ✅ 已決 | **hold**:右鍵按住 = ADS down、放開 = ADS up;toggle 留未來 config 候補,stage5 預設不啟用 |
| OQ-24.1 ads FOV 過渡時長(render 內插)與 overlay 淡入語意 | 🟡 待 T2 | 預設:120ms 線性(render-only,不進 sim/記錄;記錄的是 heldAds 事件與 flag,非視覺過渡) |

---

## Log

### 2026-07-10 09:46Z — T0 entry gate PASS(GD-16 + fire 鏈移植基線)

**Progress**

- Branch:`docs/wp-24-t0-ads-optics`(base `main`)。
- Baseline:`npm.cmd run test:ci` exit 0。內容:`tsc --noEmit` pass;Vitest **67 files / 527 tests** pass;Playwright **15 tests** pass。第一次 `npm run test:ci` 被 Windows PowerShell execution policy 擋在 `npm.ps1`;改用 `npm.cmd run test:ci` 後在 sandbox 內遇到 Vite/Vitest config access-denied,經 approval 在 sandbox 外重跑同一 script 後通過。
- GD-16 入 [DECISIONS.md](../../../DECISIONS.md):ADS effective sensitivity = `sensitivity × sensitivityRatio × (adsFov / hipFov)`,ratio default `1.0`,pre-registered freeze。
- OQ-S5-1 / OQ-S5-6 已回填 [stage5 README](../README.md) §8;T1/T2 不再 blocked。
- [CLAUDE.md](../../../../../CLAUDE.md) §4 已追加 ADS 硬約束:ADS 只落 input/render/data,不得改 sim tick、目標演進、命中幾何;ads event + tick flag 必記錄。

**Decision Log**

| ID | Decision | Alternatives Considered | Rationale |
|----|----------|--------------------------|-----------|
| D-T0.1 | ADS gain 採 CS2 式 FOV-ratio:`sensitivity × sensitivityRatio × (adsFov / hipFov)` | Monitor-distance match | CS2 式與 GD-5 count→angle 線性模型相容,跨解析度不變;monitor-distance match 需額外 monitor coefficient/螢幕距離假設,不適合 stage5 角度制資料模型 |
| D-T0.2 | 操作語意採 hold,右鍵按住 ADS | Toggle default | hold 與 CS2 慣例一致,且 stuck-ads 防護可直接比照 fire down/up;toggle 保留為未來 config 候補但不進 stage5 預設 |

**Fire chain baseline for T1 migration**

| 現況 fire 鏈 | Source evidence | EV_ADS 移植要求 |
|---|---|---|
| event code:`EV_FIRE = 2` | `src/state/types.ts` | 新增 `EV_ADS = 3`,不得改 `EV_KEY/EV_MOUSE/EV_FIRE` 既有碼值 |
| packed ring 佈局:`type,t,a,b`;fire 使用 `b=down(0/1)` | `src/state/types.ts`, `src/state/SharedState.ts` `pushFire(down,t) => enqueue(EV_FIRE,t,0,b)` | `pushAds(down,t)` 同佈局,`a=0`,`b=down(0/1)`;ring 解碼 golden 必須涵蓋 ads |
| sampler:左鍵 `mousedown` 鎖定中才 `pushFire(true)`;`mouseup` 不受 lock gate,但僅在已採計 down 後送 up | `src/input/InputSampler.ts` `fireButtonHeld` | 右鍵 `button===2` 送 ads down/up;down 需 pointer-lock gate;up 需允許解鎖後補送;未採計 down 不送 up |
| stuck-fire 防護:local `fireButtonHeld` + `detach()` 清 false;sim 端 ammo 空會解除 `heldFire` | `src/input/InputSampler.ts`, `src/loop/SimLoop.ts` | stuck-ads 需在 PointerLock 解鎖/blur 掛點補送 ads-up,避免 `heldAds` 永真;ADS 不走 ammo 語意 |
| consume:嚴格半開窗 `< untilT`,依 ring head 升冪排空;遲到只計數不丟棄 | `src/input/consume.ts` | ads 事件走同一 consume;不得另開排序/分桶語意 |
| sim applyInput:fire down/up 只翻 `state.heldFire` 與 `weapon.nextFireT`;實際 firing 由 `processFireSchedule` 處理 | `src/loop/SimLoop.ts` | ads applyInput 只翻 `state.heldAds`;不得觸發 raycast/weapon schedule |
| camera:滑鼠 delta 在 `CameraController.applyDelta`;punch 由 `setViewPunch` 分離,不寫回 aimSink | `src/view/CameraController.ts` | ADS gain 只乘使用者 delta;不得套到 punch 或 sim rawPunch |
| FOV seam 已存在:`setFov(deg)` 直接更新 projection | `src/view/CameraController.ts` | T2 可在其上加 target/current FOV 內插;render-only,不進 sim |

**Existing input/test gate for T1**

- `src/state/InputRing.test.ts`:ring overflow、decode、reuse view、fire packed layout。
- `src/state/SharedState.test.ts`:initial/reset `heldFire` 與 ring state。
- `src/input/InputSampler.test.ts`:keyboard、fire mousedown/mouseup lock gate、coalesced pointermove。
- `src/input/consume.test.ts`:半開窗 `< untilT`、排序/遲到語意。
- `src/loop/SimLoop.test.ts`:fire down/up 依時序消費、fire-up 不 raycast、不 record fire、ammo/re-fire schedule。
- `src/loop/__tests__/fire-determinism.test.ts`:held fire deterministic schedule/stuck-fire release assertions。
- E2E:`tests/e2e/input-sampler.spec.ts` 與 `tests/e2e/full-drill.spec.ts` 覆蓋 browser input chain 與 export chain。

**Surprises & Discoveries**

- `npm` on PowerShell resolves to `npm.ps1` and is blocked by machine execution policy; use `npm.cmd` for reproducible local commands on this Windows workspace.
- sandboxed Vitest config loading attempted to read parent directories and hit access denied; approved out-of-sandbox run is the recorded clean baseline.
- `InputSampler` currently has no `PointerLock.onChange` hook; T1 stuck-ads 解鎖補 up 需要新增/注入解鎖通知 seam,不要只靠 `mouseup`。

**Open Questions**

- OQ-24.1 remains for T2:ADS FOV transition duration/overlay fade default currently 120ms render-only.

### 2026-07-10 — Plan authored

- 由 stage5 計畫([../README.md](../README.md) §3/§6)展開為自足 task 檔(T0–T3 + T-exit)。
- 決議依據:GD-4(aim 僅觀測——ADS gain 落 `CameraController.applyDelta`,sim 零改動)、
  GD-5(0.022°/count 感度慣例)、WP-11 fire down/up 事件模式(EV_ADS 全面比照:packed b=down、
  held 旗標、stuck 防護、分桶消費)。
- 設計要點:**記錄 = 效度必要條件**——aim 資料已含 gain,分析端必須靠 tick `ads` flag +
  ads 事件還原構念,缺記錄該 drill 分析無效(FR-E6 為硬 DoD)。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— GD-16 拍板,docs-only。
