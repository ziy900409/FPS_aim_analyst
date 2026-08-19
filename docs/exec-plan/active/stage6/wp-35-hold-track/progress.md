# WP-35 — Progress / Decision Log / Surprises / Open Questions

> Running log。每個 task 完成時與切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry-gate | ✅ | 2026-08-19 | WP-34 T-exit 已覆核;README §0 五條讀碼發現仍成立;OQ-S6-9/OQ-S6-14 已拍板(D-35.1/D-35.2);`TrackingSample`/`deriveTrackingSamples` 匯出面確認可供 T2 消費;零 `src/` diff |
| T1 fire-gating + target_stop | ✅ | 2026-08-19 | `npm run test:ci`: `tsc --noEmit` + Vitest **105 files / 864 tests passed** + Playwright **21 passed** |
| T2 tracking + stop-transition metrics | ✅ | 2026-08-19 | `target_stop` additive export + `hold_track_v1` + transition derivations; `npm run test:ci`: `tsc --noEmit` + Vitest **109 files / 872 tests passed** + Playwright **21 passed** |
| T-exit | ✅ | 2026-08-19 | 驗收條件覆核(見下)+ `analysis-hold-track.md` 定稿 + CONTEXT.md/stage6 README/OQ 對帳;`npm run test:ci`: `tsc --noEmit` + Vitest **109 files / 872 tests passed**(與 T2 結尾一致,T-exit 零 `src/` 變更)+ Playwright **20 passed / 1 failed**(既有 app-ready flake,見下) |

**閘證據**:

| Task | `npm run test:ci` |
|---|---|
| T0 | 2026-08-19 16:11+02:00: sandbox 內首跑被 Windows 權限擋於 Vitest/Vite config 載入(`Cannot read directory "../../../..": Access is denied`);非 sandbox 重跑同一命令通過:`tsc --noEmit` + Vitest **104 files / 860 tests passed** + Playwright **21 passed** |
| T1 | 2026-08-19 16:21+02:00: non-sandbox `npm run test:ci` 通過：`tsc --noEmit` + Vitest **105 files / 864 tests passed** + Playwright **21 passed** |
| T2 | 2026-08-19 16:33+02:00: non-sandbox `npm run test:ci` 通過：`tsc --noEmit` + Vitest **109 files / 872 tests passed** + Playwright **21 passed** |
| T-exit | 2026-08-19 16:43+02:00: `tsc --noEmit` 通過 + Vitest **109 files / 872 tests passed**(zero diff vs T2,本 task 只動文件)+ Playwright **20 passed**、`input-sampler.spec.ts:44`(鍵盤 A/D → 入緩衝→套用 vx)於 Edge **1 failed**——`gotoAppReady` 的 `__aimDebug` poll 逾時,與既有 WP-34 T-exit 記錄的 app-ready flake(S-34.3/S-34.4/S-34.5)同性質、與本 WP 檔案改動(僅 3 份文件)無關 |

**v1 驗收條件覆核(框架 v1 §"v1 驗收條件"與 hold-track 相關的一條)**:

- ✅「`hold-track` 的追蹤窗不因提早擊殺而縮短」——[`holdTrackWindowInvariant.test.ts`](../../../../../src/metrics/holdTrackWindowInvariant.test.ts):同一 presentation 分別在 `t=10`(提早)、`t=500`(準時)、未開火三案例下,`windowEndMs` 與 `windowEndMs − tVisibleMs` 皆為 `1000`,逐位相同。
- 補充佐證(非本 WP 專屬但支撐同一不變式的機制):`persistent` + `trackingStopMs` 到期原地凍結(非撤除)由 [`TargetManager.tick()`](../../../../../src/sim/TargetManager.ts) 的 `tStop` 分支保證窗口右界不受玩家何時開火影響;停止轉換與掉靶/重新取得指標分別由 [`stopTransitionDerivation.test.ts`](../../../../../src/metrics/stopTransitionDerivation.test.ts)(3 fixture)與 [`trackingTransitions.test.ts`](../../../../../src/metrics/trackingTransitions.test.ts)(3 fixture)覆蓋。

---

## Decision Log

> 編號 `D-35.n`。跨 WP / 跨文件的決策改入 [DECISIONS.md](../../../DECISIONS.md)。

### D-35.1 — fire-gating 落點:在 `scheduleFire` 追加 additive active-target gate,不併入 `nextFireT`/彈匣語意(2026-08-19,T0)

讀碼覆核現況:

- `SimLoop.scheduleFire()` 的唯一開火消費閘為 `state.heldFire && state.weapon.ammo > 0 && state.weapon.nextFireT <= untilMs`。
- `TargetState.persistent` 只影響命中後是否 `markKilled`,不阻止 `fire` event 產生。
- `rg -n "persistent|fireLocked|tStop" src/state src/sim src/loop` 只找到既有 `persistent`;`fireLocked`/`tStop` 目前不存在。
- CodeGraph blast radius: `scheduleFire` 只由 `simStep` 呼叫,但 `simStep`/`TargetManager` 覆蓋多個 regression/e2e 測試;T1 必須用 additive 條件與既有 regression gate 守零回溯。

**決議**:T1 在 `TargetState` 新增 optional `fireLocked?: boolean`,由 `TargetManager` 依 `DrillConfig` 寫入;`SimLoop.scheduleFire` 只讀 active alive+visible target 的 `fireLocked !== true` 作為 while 迴圈額外 AND 條件。省略欄位時既有 drill 行為不變。

**解鎖瞬間推演**:若玩家在鎖定期間按住 fire,`heldFire=true` 且 `nextFireT` 可能已到期;因 while gate 被 `fireLocked` 擋住,不消費 ammo、不推進 `nextFireT`。target_stop 同 tick 把 `fireLocked` 翻 `false` 後,下一次 `scheduleFire` 看到 `nextFireT <= untilMs` 時只會依既有 `cycleMs` 逐發消費;gating 本身不額外修改 `nextFireT` 或 ammo,因此不會產生第二套 fire cadence。T1 測試須覆蓋「鎖定中不記 fire、不扣彈、`nextFireT` 保持待消費;解鎖後只產生既有 cadence 下允許的一發/多發」。

**Alternatives considered**:

- 把 gating 併入 `WeaponConfig` 或 `nextFireT` 語意。未採用:fire lock 是 drill/target 生命週期語意,不是武器循環或彈匣狀態;混入 `nextFireT` 會讓解鎖瞬間到底是補發、延後、還是重置 cycle 變成隱式政策。
- 在 input sampler 擋掉 fire-down。未採用:會丟失「玩家在鎖定期間按住 fire」這個行為訊號,且無法由 target state 同步解鎖;現有輸入緩衝應保留事件,sim 端依 active target 決定是否消費。

### D-35.2 — `target_stop` 修飾欄位:新增 `timing.trackingStopMs`,不讓 `presentationMs` 帶 kill/freeze 判別子(2026-08-19,T0)

讀碼覆核現況:

- `DrillConfig.timing.presentationMs` 已明文定義為 timed presentation:目標可見後達時長即由 `DrillRunner` `markKilled` 推進下一目標。
- `TargetManager` 只因 `presentationMs !== undefined` 把目標標為 `persistent:true`;真正到期撤除在 `DrillRunner.ts`。
- `schema.ts` 目前只驗證 `presentationMs` 為 positive number,沒有行為判別子或互斥欄位。

**決議**:T1 新增獨立 optional `timing.trackingStopMs?: number`。此欄位語意為「可見後達此時長 -> target_stop:原地凍結、`fireLocked=false`、同 tick 記 `state.tStop`」;既有 `presentationMs` 語意維持「到期撤除/advance」。T1 schema 應把 `trackingStopMs` 驗證為 positive number,並拒絕與 `presentationMs` 同時出現,避免同一 drill 同時宣告 advance 與 stop。

**Alternatives considered**:

- `presentationMs + presentationEndAction: 'kill' | 'freeze'`。未採用:會讓 `presentationMs` 由既有「到期撤除」語意變成帶判別子的多義欄位,增加所有既有 tracking drill 的閱讀與 schema 負擔。
- 重用 `peekTimeoutMs`。未採用:`peekTimeoutMs` 是 detection/peek timeout,到期撤除;與 hold-track 的 target_stop 構念不同。

### D-35.3 — tracking transitions 邊界:新函式只消費 exported `TrackingSample[]`(2026-08-19,T0)

`trackingDerivation.ts` 已公開匯出 `TrackingSample`、`TrackingPresentationSamples`、`TrackingSamplesResult` 與 `deriveTrackingSamples()`。T2 的掉靶次數/重新取得時間可新增 `trackingTransitions.ts`,以 `TrackingSample[]` 掃描 `onTarget` true→false→true 轉換;不需要 import 或改動 `derivePresentation`/`isOnTarget`/`rms`/`percentile` 等私有輔助函式。

**Alternatives considered**:

- 在 `derivePresentation()` 裡直接擴充聚合。未採用:T2 的新指標不是既有追蹤幾何本體,加進核心 derivation 會擴大已穩定測試路徑的回歸面。

### D-35.4 — `tStop` 同時作為 target_stop 時間戳與 freeze witness；不新增第二個 TargetState 旗標(2026-08-19,T1)

`TargetManager.tick()` 到期時在同一分支將 `fireLocked` 設為 `false`、寫入 `state.tStop`，往後每 tick 以 `tStop.has(target.id)` 跳過 motion drive。這使「原地凍結」的運行狀態與 T2 要消費的測量時間戳只有一份權威來源；`markKilled`/`reset`/`resetState` 均同步清除，避免 stale target id 汙染下一輪。

**Alternatives considered**:

- 另加 `TargetState.motionFrozen?: boolean`。未採用:會建立只服務於引擎而非測量的第二份 stop 狀態，並增加 reset/撤除時的同步義務；`tStop` 已是 target_stop 的權威事件紀錄。
- 解除 `fireLocked` 後保留現有 motion drive。未採用:針對性測試顯示下一 tick 位置會由 `x=3` 繼續到 `x=4`，違反「原地凍結」。

### D-35.5 — `tStop` 以 additive `target_stop` event 匯出；終止未重新取得的掉靶不納入 reacquire 平均(2026-08-19,T2)

`SharedState.tStop` 是執行期 Map，不屬於 `ExportPayload`。T2 在 `TargetManager` 已於同 tick 寫入後，由 `SimLoop` 記錄一次 `{ type: 'target_stop', targetId, t, targetX, targetY, targetZ }`；此事件同時固定停止位置，讓離線的停止後首發角度誤差能複用 `eyeOrigin.ts`，而不需要第二套 target-position 推導。

`deriveStopTransitions()` 以 `buildPeekWindows()` 的既有 `firstFire` 選擇首發，僅接受 `t_fire ≥ t_stop` 的首發；`firstShotHitAfterStop` 沿用該 fire event 的既有 hit outcome。`deriveTrackingTransitions()` 僅在第一個 on-target 後計 true→false，並只在窗口結束前 false→true 時記錄 reacquire duration；掉靶直到窗口結束未恢復者仍計 `dropCount`，但不加入 `reacquireMs`，避免以任意上界污染平均值與樣本數。

**Alternatives considered**:

- 把 `tStop` 寫入 `meta`。未採用:meta 是 drill/run 層資料，無法表示每個 target 的時間與停止座標；event timeline 與既有 `visible` 語意一致。
- 對未重新取得者填入「窗口剩餘時間」。未採用:這會把右截尾觀測誤作已觀測 duration；保留在 dropCount 並由後續呈現層明示有效 `reacquireMs` 樣本數。

---

## Surprises

> 編號 `S-35.n`。

### S-35.1 — 解鎖本身不會停止既有 motion drive(2026-08-19,T1)

第一輪 `TargetManager` 定向測試失敗：target_stop 後第三個 tick 的 position 為 `x=4`，預期凍結在 `x=3`。原因是 `fireLocked=false` 後仍符合既有 `isDrivenMotion` 路徑。以 `tStop.has(id)` 作為 freeze witness 後，同一組測試 **68 passed**；完整 CI 亦全綠。

---

## Open Questions

見 [README.md §7](README.md)。**OQ-S6-9** 已由 D-35.1 關閉:fire-gating 以 `TargetState.fireLocked` + `scheduleFire` additive AND 條件實作,不併入 `nextFireT`/彈匣語意。**OQ-S6-14** 已由 D-35.2 關閉:新增獨立 `timing.trackingStopMs`,並在 T1 schema 拒絕與 `presentationMs` 併用。**OQ-S6-15** 已由 D-35.5 關閉:終止未重新取得的 drop 不納入 `reacquireMs`，其 `dropCount` 仍保留。
