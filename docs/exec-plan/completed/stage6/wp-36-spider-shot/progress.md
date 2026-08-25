# WP-36 — Progress Log

> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)
> 本檔記錄:Progress(每 task 完成證據)、Decision Log(`D-36.n`,per-WP 決策)、Surprises(讀碼意外)、Open Questions(承 README §7,執行期更新狀態)。

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry-gate | ✅ | 2026-08-24 | WP-33 T-exit 的七項凍結契約仍為權威；`buildCompatibilityKey()` 的 caller-owned 非空 `targetConditionCell` 契約未變。README §0 五項讀碼結論仍成立；WP-35 的 `trackingTransitions.ts` 已可供 T3 直接複用 drop/reacquire。零 `src/` diff。 |
| T1 schedule engine | ✅ | 2026-08-24 | `spiderShot` schema and legacy-spawn mutual exclusion; deterministic center↔peripheral TargetManager schedule; `visible.zone` and `Meta.spawn.spiderShot` export wiring. `npm run test:ci`: typecheck ✅, Vitest **109 files / 879 tests**, Playwright **21 passed**. |
| T2 condition cell | ✅ | 2026-08-24 | `spider-shot-v1` Assessment config; additive shared `angularDistanceDeg()`; `deriveSpiderShotTransitions()` reconstructs direction/D_deg/W_deg/quadrant/hitbox/distance/seed/condition cell from `visible` + metadata. `npm run test:ci`: typecheck ✅, Vitest **111 files / 882 tests**, Playwright **21 passed**. |
| T3 five metrics | ✅ | 2026-08-24 | `deriveSpiderShotMetrics()` assembles peripheral-arrival reaction, execution, stop control, first-shot, and all-anchor rhythm metrics from canonical derivations; no existing geometry changed. Synthetic center→peripheral→center fixture covers two peripheral arrivals, hit/miss first shots, post-acquisition escape/reacquisition, and rhythm. `npm run test:ci`: typecheck ✅, Vitest **112 files / 883 tests**, Playwright **21 passed**. |
| T-exit | ✅ | 2026-08-24 | `analysis-spider-shot.md` 定稿(排程機制、與既有 L/R 交替/`SpawnAreaConfig` 差異表、`zone`/`D_deg`/`W_deg`/象限公式、`targetConditionCell` 格式、五類指標公式 + 測試證據連結);CONTEXT.md §A 回寫六則新術語;`../README.md` §3/§6/§9 與本 WP `README.md`/`task-checklist.md` 狀態翻 ✅。`npm run test:ci`:typecheck ✅、Vitest **112 files / 883 tests**、Playwright **21/21**。 |

**T0 覆核**:

- `SpawnAreaConfig`/`sampleSpawnPose()` 仍是水平 yaw + 固定 `TARGET_Y` 的獨立抽樣；Spider Shot 所需的中心—周邊二維極角排程仍是淨新增能力。
- `TargetManager.tick()` 仍以 `!hasAliveTarget(state)` 保持單一存活目標；`markKilled()` 的 `nextSide` 仍只服務既有 L/R 路徑。WP-35 僅新增 hold-track 的 `trackingStopMs`/`tStop` 行為，未改動上述排程前提。
- `DrillEvent { type: 'visible' }` 與 `SpawnMeta` 尚無 `zone`/`spiderShot`；兩者皆可安全 additive。WP-34/35 的最新提交沒有未提交衝突，且 WP-35 僅新增獨立 `target_stop` event。
- `trackingDerivation.ts` 仍只輸出 `TrackingSample { t, onTarget, epsilonDeg }` 與 TOT%/RMS/percentile；`trackingTransitions.ts` 已直接掃描該 canonical samples，提供 `dropCount`/`reacquireMs`。T3 可直接複用它；overshoot 量與 micro-adjust 次數因缺少有號誤差／角速度反轉資訊，須在 T3 以獨立消費層定義，不能宣稱由現有 samples 完整推出。

**驗證**:2026-08-24 非 sandbox `npm run test:ci`：`tsc --noEmit` 通過、Vitest **109 files / 872 tests passed**；Playwright **17 passed / 4 failed**，失敗於 `backend.spec.ts` 的 renderer backend poll 與 `input-sampler.spec.ts` 三項 `__aimDebug` app-ready poll。失敗檔案與本切片零程式碼／五份文件異動無關，且後三項屬 WP-35 T-exit 已記錄的 app-ready flake 類型；完整 CI gate 尚未綠燈，提交前需由使用者決定是否接受附證據的 docs-only commit。

## Decision Log

### D-36.1 — 排程落點與欄位命名:凍結 top-level `spiderShot` 專屬排程(2026-08-24,T0)

**決議**:T1 新增 `DrillConfig.spiderShot?: SpiderShotScheduleConfig`；其 discriminant 固定為 `kind: 'center-peripheral'`，並保留 `seed`、`centerDistanceU` 與 `peripheral.angularRadiusDegRange`／`azimuthDegRange`／`distanceURange`。這些名稱準確區分中心距離、周邊角距、方位角與世界距離，毋須調整。

`TargetManager` 以 `spiderShot` 是否存在選入完全獨立的 center/peripheral 狀態分支；既有 `sequence.alternation` 仍必填但在此分支不讀取，`nextSide` 與既有 L/R 路徑不改。`spiderShot.seed` 是該分支唯一的 RNG source；`sequence.seed` 在 spider-shot config 中也必須省略，避免兩個 seed 權威。T1 建立 `Meta.spawn` 時以 `spiderShot.seed` 填既有 `seed`，並回顯完整排程於 `spiderShot?: unknown`。

`DrillEvent { type: 'visible' }` 新增 optional `zone?: 'center' | 'peripheral'`；`side` 維持相容欄位、在 spider-shot 分支僅為佔位，不承載象限語意。`D_deg`、`W_deg`、象限、距離與 hitbox 均維持 T2 以連續 visible 座標與 metadata 離線重建，避免建立第二套即時記錄。

**Alternatives considered**:

- 將中心／周邊編入 `sequence.alternation` 或擴充 `side`。未採用：兩者均是既有 L/R 二元契約，會改變既有 drill 語意與 `visible` 事件相容面。
- 將 `zone`、角距、象限與尺寸全寫入 visible event。未採用：除 `zone` 外皆能由事件座標與 GD-7 hitbox 唯一重建；冗餘即時欄位會引入兩份幾何權威。

### D-36.2 — 排程機制互斥:拒絕 spider-shot 與 legacy seeded-spawn 混用(2026-08-24,T0)

**決議**:T1 的 `validateDrill()` 在 `spiderShot` 存在時，必須拒絕 `targets.spawnArea`、`sequence.spawnDelayMsRange` 與 `sequence.seed`。前兩者是既有無狀態水平 polar spawn 的取樣／延遲機制，後者則會與 `spiderShot.seed` 形成雙重 RNG 權威；它們與中心—周邊狀態排程同時宣告會讓 spawn 位置、延遲與可重現性不明確。反之，沒有 `spiderShot` 時保留現有 `spawnArea`、`spawnDelayMsRange`、`sequence.seed` 全部驗證與行為不變。

Assessment spider-shot 的 seed 要求由 `spiderShot.seed` 滿足；T1 只在既有 legacy seeded-spawn 路徑維持 `sequence.seed` 要求。`sequence.alternation` 則仍保留必填的型別相容位置，不作 seed 代理。

**Alternatives considered**:

- 允許兩套設定共存並以 spiderShot 優先。未採用：被忽略的設定會製造錯誤的可重現性宣告，且遮蔽 config typo。
- 重用 `sequence.seed` 作為 spider-shot 的 seed。未採用：會讓新排程的唯一設定不再自足，並將新語意耦合到 legacy sequence namespace。

### D-36.3 — 中心視線的 2D 極角座標約定(2026-08-24,T1)

**決議**:周邊目標以玩家原點到中心目標 `(0, TARGET_Y, -centerDistanceU)` 的正規化向量為 `forward`；以其與 world-up 正交的投影向量為 `up`，固定 world +X 為 `right`。取樣順序固定為 `azimuthDeg → angularRadiusDeg → distanceU`，並以 `direction = cos(radius) × forward + sin(radius) × (sin(azimuth) × right + cos(azimuth) × up)` 換算世界座標。故方位角 0°/90°/180°/270° 對應上／右／下／左，45°/225° 是兩個斜向。

**Alternatives considered**:

- 直接以 world XZ 平面的 yaw／固定 `TARGET_Y` 偏移。未採用：這是既有 `SpawnAreaConfig` 的一維模型，無法生成垂直或斜向周邊目標。
- 把中心目標固定在水平視線 `y=0`。未採用：會與既有中心目標 `(0, TARGET_Y, -centerDistanceU)` 的視覺／命中座標不一致。

### D-36.4 — 回中心 transition 保留幾何輸出，象限只屬周邊抵達(2026-08-24,T2)

**決議**:`deriveSpiderShotTransitions()` 對每個相鄰 `visible` anchor 都輸出 transition；因此 `peripheral-to-center` 仍保留方向、`D_deg`、抵達目標的 `W_deg`、hitbox、世界距離、seed 與 `targetConditionCell`，可供 T3 節奏統計使用。只有 `center-to-peripheral` 以抵達周邊的方位角產生 `horizontal`／`vertical`／`oblique` 象限；回中心的 `quadrant` 固定為 `undefined`。

`D_deg` 由新抽出的 `angularDistanceDeg()` 共用既有 `angularEccentricityDeg()` 的無號方向夾角實作。`W_deg` 唯一讀取 `meta.targets.hitbox`，並以抵達目標的世界距離換算。條件字串固定為 `spider:d=<6-decimal D_deg>;w=<6-decimal W_deg>`，其數值精度明確且可穩定作為 CompatibilityKey 的 caller-owned 非空欄位。

**Alternatives considered**:

- 只輸出中心→周邊 transition。未採用：會切斷完整 transition interval 序列，使 T3 節奏指標需另建一套 anchor 掃描。
- 將回中心方位角標為反向的周邊象限。未採用：象限描述的是抵達周邊的呈現位置；對中心抵達施加標籤會混淆呈現層語意。

### D-36.5 — 五類指標的樣本範圍與停止控制定義(2026-08-24,T3)

**決議**:`deriveSpiderShotMetrics()` 的切換反應、移動執行、停止控制與首發只對 `zone: 'peripheral'` 的抵達目標輸出；回中心仍是完整 transition anchor，但只進入節奏的連續 `visible.t` 間隔。這落實 README §1.1 的構念範圍，不將回中心重複宣稱為一份獨立反應／停止樣本。

移動執行的 `movementTimeMs` 固定為既有時間線上的 `t_first_on_target - t_detect`，讓它描述動作起始後到首次進靶的 flick 執行，而 `reactionMs` 仍是 `t_detect - t_visible` 的視覺—動作代理值。峰值角速度直接取 `buildPeekWindows()` 所給 tick window 內既有 tick-integral `omegaDegPerSec()` 的最大絕對值；首發命中沿用 peek-window outcome，開火偏差在 first-shot 對應 tick 呼叫既有 `angularEccentricityDeg()`。

停止控制不新增幾何：`dropCount`/`microAdjustCount` 分別直接轉錄 `deriveTrackingTransitions()` 的掉靶數與 reacquisition 段數；`overshootDeg` 定義為首次進靶後所有 canonical `TrackingSample.onTarget === false` 的最大無號 `epsilonDeg`。由於 canonical samples 沒有有號誤差，此數值是「進靶後逸出幅度」，不宣稱能區分 overshoot 與 undershoot。

**Alternatives considered**:

- 為有號 overshoot／undershoot 新建目標相對座標或反轉幾何。未採用：這會建立第二套幾何權威，違反 C-D4；目前匯出沒有足以穩定判別方向的 canonical 資料。
- 將 `t_first_on_target - t_visible` 作為 movement time。未採用：它會把已另行報告的視覺—動作 reaction proxy 混入 flick 執行時間。
- 對回中心也產出四類逐目標樣本。未採用：違反此 WP 已凍結的量測範圍，且會使同一中心位置重複主張構念樣本。

## Surprises

### S-36.1 — 完整 E2E gate 受既有 app-ready／renderer backend 不穩定性阻擋(2026-08-24,T0)

非 sandbox `npm run test:ci` 的 typecheck 與 Vitest 全綠，但 Playwright 17/21 通過；`backend.spec.ts` 未在 5 秒內收到 renderer backend，三項 `input-sampler.spec.ts` 未在 5 秒內取得 `window.__aimDebug`。T0 沒有 `src/` 或測試異動，故不追蹤或修復這些不在範圍的 E2E 問題；提交前等待使用者決定。

### S-36.2 — 共用夾角抽取必須保留 dot product 的原始浮點運算順序(2026-08-24,T2)

第一次完整 CI 的 `trackingDerivation.test.ts` 在 near-perfect tracking 的 P95 ε 閾值以 `1.2074e-6 > 1e-6` 失敗。原因是初版 helper 先將兩向量長度相乘再相除，改變了既有 `angularEccentricityDeg()` 的浮點捨入順序。helper 修為只接收正規化方向；既有路徑保留「目標向量分量各自除以長度後 dot」的原順序，Spider Shot 則顯式正規化兩個目標方向再呼叫。修正後 `npm run test:ci` 全綠：Vitest **111/882**、Playwright **21/21**。

### S-36.3 — 平行 Playwright 偶發 app-ready poll timeout，重跑完整 gate 全綠(2026-08-24,T3)

首次 T3 `npm run test:ci` 的 typecheck 與 Vitest **112/883** 全綠、Playwright 20/21；唯一失敗是既有 `input-sampler.spec.ts` `recordKeyEvents` 的 `window.__aimDebug` app-ready poll 5 秒逾時。單獨重跑該測試通過，後續完整 gate 也通過 **21/21**；本切片未修改 app startup、input 或 E2E 檔案。

## Open Questions 狀態

承 [README.md §7](README.md);執行期於此表更新狀態(不修改 README 的原始建議文字,只在此追記結論)。

| # | 問題 | 狀態 |
|---|---|---|
| OQ-S6-16 | `trackingDerivation.ts` overshoot/微調覆蓋面 | ✅ closed(T3)：直接消費 canonical samples；最大進靶後無號 ε 為逸出幅度，`deriveTrackingTransitions()` 提供 drop/reacquire。無有號資料，故不宣稱 overshoot/undershoot 分類。 |
| OQ-S6-17 | 回中心 transition 是否計入切換反應/停止控制 | ✅ closed(T3)：只計入節奏；四類逐目標構念只針對抵達周邊。 |
| OQ-S6-18 | 象限分箱門檻 45° 暫定 | 🟢 open,移交 WP-39 pilot(T-exit 覆核:非 `targetConditionCell` 相容鍵欄位,調整不升版,不阻塞 WP-36 交付) |
