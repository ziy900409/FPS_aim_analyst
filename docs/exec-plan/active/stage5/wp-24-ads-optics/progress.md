# WP-24 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: 🟡 進行中(T0 ✅,T1 ✅,T2 next)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 EV_ADS 輸入鏈 | ✅ |
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

### 2026-07-10 12:13Z — T1 EV_ADS 輸入事件鏈 PASS(heldAds + stuck 防護;ring 佈局零破壞)

**Progress**

- 擴碼:`src/state/types.ts` 加 `EV_ADS = 3` + `InputEvent` union `{ type:'ads'; down; t }` + `InputEventView.type` 增 `'ads'`;packed 佈局 `type,t,a,b` **未動**(ads 走 `a=0`、`b=down`,比照 fire)。grep 佐證:`enqueue(EV_ADS, t, 0, down?1:0)` 與 `pushFire` 逐位同形([SharedState.ts:200-201](../../../../../src/state/SharedState.ts))。
- `SharedState`:加 `pushAds`(InputRing)、`heldAds` 旗標(interface + `createSharedState` false + `resetState` 歸零)、`dequeueInto` 顯式 `EV_FIRE`/`EV_ADS` 分支解碼。
- `InputSampler`:右鍵(`button===2`)down/up → `pushAds`(down 走 pointer-lock 採計閘門、up 不受閘門但需已採計 down);`contextmenu` 鎖定中 `preventDefault`;新增 `releaseAds(t)` 接縫(解鎖掛點補送 ads-up,stuck 防護);`detach` 清 `adsButtonHeld`。
- `SimLoop.applyInput`:新增 `ads` 分支只翻 `state.heldAds`——**不**觸發 raycast / weapon schedule / 目標演進(GD-16)。`consume.ts` **零改動**(型別無關的通用消費,ads 走同一分桶排序路徑)。
- 測試設施 `inputRingTestUtil.ts`:`pushEvent`/`snapshot` 加 `ads` 分支(additive,既有 key/mouse/fire 路徑不變)。
- **零破壞閘證據**:改動前基準 `npx vitest run <6 檔>` = 74 tests 綠;改動後同指令 = 88 tests 綠(+14 新,`consume`/`InputRing` bounded-insertion/`SharedState`/`SimLoop`/`fire-determinism` 全綠)。全量 `npx tsc --noEmit` clean + `npx vitest run` = **67 files / 541 tests**(baseline 527 +14)綠;三組 determinism regression(spray / moving-target / longrange)全綠 → **決定性回歸零重錄**。

**手動驗證矩陣(以決定性單元測試編碼)**

T1 尚未把 ADS 接進 live app(main.ts 佈線屬 T2/T3),故 README failure-mode 的手動矩陣以合成事件單元測試等價覆蓋:

| 情境 | 測試 | 斷言 |
|---|---|---|
| 按住(hold) | InputSampler「鎖定中右鍵 down/up 入緩衝」 | ads down/up 蓋 timeStamp 升冪入 ring |
| 快速點放 | InputSampler「快速點放同序列 down+up」/ SimLoop「同 tick down→up」 | 依到達序消費,收尾 `heldAds=false` |
| 解鎖中放開(mouseup) | InputSampler「已採計 ads-down 後即使解鎖 mouseup 仍送 ads-up」 | up 不受 isLocked 閘門 |
| 解鎖(pointerlockchange) | InputSampler「releaseAds:解鎖中按住補送 ads-up」+「未按住 no-op」 | stuck-ads 防護、不重複補 up |
| 右鍵選單衝突 | InputSampler「contextmenu 鎖定中 preventDefault;未鎖定不抑制」 | 鎖定中抑制、放行一般選單 |

**Decision Log**

| ID | Decision | Alternatives Considered | Rationale |
|----|----------|--------------------------|-----------|
| D-T1.1 | stuck-ads 防護以 `InputSampler.releaseAds(t)` 接縫實作(推真正的 ads-up 事件過 ring→consume→heldAds),而非比照 fire 在 main.ts 直接寫 `sharedState.heldFire=false` | (a) 直接在解鎖掛點寫 `sharedState.heldAds=false`;(b) 注入解鎖 notifier 進 sampler | ADS 記錄為效度必要條件(FR-E6,T3):ads-up 必須成為**可被消費/記錄的事件**才能還原構念,直接寫旗標會漏記事件。`releaseAds` 保留 sampler 為 ads 事件單一產源、可測(注入式,本專案慣例);main.ts 佈線延到 T2/T3(該檔為 T2/T3 熱區) |
| D-T1.2 | ads-down 走 pointer-lock 採計閘門、ads-up 不受閘門但需已採計 down | ads 全程不設閘門 | 完全比照 fire down/up(WP-11):避免取鎖前右鍵 / UI 右鍵污染;確保按住期間解鎖仍能補 up |
| D-T1.3 | `consume.ts` 不改動 | 加 ads 專屬分支/註解 | consume 型別無關,ads 走既有升冪分桶排空;不動 = 最小風險、與「分桶排序語意不變」一致 |

**Deviation from 「零修改」DoD(誠實記錄)**

- `src/input/InputSampler.test.ts` 既有 case「非左鍵(右鍵/中鍵)不入緩衝」被**窄化**為「中鍵不入緩衝」:該 case 的前提(右鍵完全惰性)正是 T1 要改的行為(右鍵→ADS),故其斷言已被 feature 取代。ring/consume 核心佈局測試(failure-mode 指名的零修改閘)全數未動。右鍵行為改由新增的 ADS describe(9 cases)覆蓋。此為伴隨 feature 的合理、最小測試更新,非為配合實作而放寬既有斷言。

**Surprises & Discoveries**

- TS 無 exhaustive `never` switch 消費 `InputEvent`,故加 union 成員零編譯破壞;`fpsTestHarness.pushInputEvent` 的 `else → pushFire` 對 `{down}` 相容(ads 未經該 harness 注入,無實際影響,留 T2/T3 視需要擴充)。

**Open Questions**

- OQ-24.1 仍留 T2:ADS FOV 過渡時長 / overlay 淡入預設 120ms render-only。
- main.ts 解鎖掛點呼叫 `inputSampler.releaseAds(performance.now())` 的 live 佈線待 T2/T3 落地(與 camera/overlay 同步一併接)。

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
