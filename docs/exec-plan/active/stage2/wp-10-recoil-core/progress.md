# WP-10 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ 完成(T0–T4 ✅,T-exit ✅ **M5 golden 全綠 2026-07-05**)

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ |
| T1 ran1 + 彈道表 | ✅ |
| T2 punch 動力學 | ✅ |
| T3 spread/inaccuracy | ✅ |
| T4 2D 檢查頁 | ✅ |
| T-exit(M5) | ✅ |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-1 recoil tick 節奏(建議:64Hz 子節奏,偶數 sim tick) | ✅ resolved | 2026-07-05,Codex 依 T0 計畫預設拍板:recoil tick = 64Hz 子節奏,在 128Hz sim 內以偶數 tick 呼叫 `recoilTick(state, 1/64)`;golden 與 WP-13 接線皆以此為準。 |
| OQ-S2-6 彈匣盡行為(建議:停火、無 reload) | ✅ resolved | 2026-07-05,Codex 依 T0 計畫預設拍板:彈匣盡即停火,stage2 不做 reload;drill 一 peek ≤ 一匣。 |

---

## Outcomes(M5 交付總結)

**交付了什麼**:`src/recoil/` 純數學 TS 模組(零 three/DOM 相依)——`rng.ts`(ran1)、`recoilTable.ts`(64 筆彈道表)、`punch.ts`(RecoilState + recoilTick + recoilOnFire)、`spread.ts`(sampleSpread 三成分)、`patternViewer.ts`(dev-only #pattern);golden fixtures `tests/golden/recoil/ak47-table.json`(64 筆)+ `ak47-10shot-punch.json`(58 tick + 10 shotsLog,final rawPunch×2 = −10.18°/−1.56°)。

**M5 門控證據(2026-07-05)**:全套 `vitest run` → 30 files / 208 tests passed(exit 0);`src/recoil` → 4 files / 23 tests(≥ 12 門檻);`typecheck` pass;`Math.random` 於 `src/recoil` grep = 0;所有 `recoilTick` 呼叫點 dtSec 恆 1/64(非 1/64 拋錯);兩份 golden fixture 在 repo;T4 形狀 sanity 截圖(AK 直升→之字)已在下方 Log。

**帶著走的決定(給 WP-11/12/13)**:
- 校準集中在 `punch.ts` 兩個常數 `GOLDEN_PITCH_KICK_SCALE` / `GOLDEN_YAW_KICK_SCALE`(源只給最終向量);WP-15 若拿到更細逐 tick 資料只需替換這兩常數 + 更新 golden。
- 模組輸出一律 degree(pitch 正值朝下);`degToRad` 與符號翻轉留給 WP-13 單點 adapter,本 WP 不做。
- `recoilTick` signature 不帶 weapon → recovery time 由 `recoilOnFire` 存入 `RecoilState.inaccuracyRecoveryTimeSec`;WP-13 佈線需先 `recoilOnFire` 再靠 tick recovery。
- `recoilResetDelaySec = cycletime × 1.1` 由 `recoilOnFire` 從 weapon-like 設定,保留 WP-11 `WeaponConfig` 接線空間。

**Surprises**:見下方兩則(T2 源只有最終向量、T1 PowerShell npx 政策擋);校準常數為已知取捨,非 BLOCKER。

**下一步**:M5 已過 → **WP-13 可開**;WP-11/12/14 不受此門限制,可並行開跑。

## Decision Log

### 2026-07-05 — T-exit(M5)gate decisions
- **Decision**:以既有 T1–T4 交付直接封 M5,不新增 `src/` 程式碼;T-exit 為驗證 + 文件對帳切片。golden 全綠即宣告數學核心鎖定,此後 WP-13 偏差歸因於接線。
- **Decision**:文件對帳落地——規格書升 v1.2(§1.3 補「CS2 後座力系統」條目)、[CONTEXT.md](../../../../../CONTEXT.md) 新增 §F CS2 後座力術語表(ran1 / 彈道表 / aimPunch / rawPunch×2 / punch 動力學 / HybridDecay / recoil index / cycletime / inaccuracy 三成分 / 理想壓槍路徑)、stage2 README 與 exec-plan README 的 WP-10/M5 翻 ✅ 標日期。
- **Code review(五軸)**:correctness——validate 齊全、無 NaN 路徑(Infinity init 在 exp 下退化為 1/0 安全)、決定性測試 bit-for-bit;readability——命名對齊 CONTEXT、單位/符號註記清楚;architecture——零 three/DOM 相依守住 WP 邊界、校準常數單點化;security——純數學無外部輸入;performance——無熱路徑配置。唯一取捨 = `punch.ts` 校準 magic constants(已文件化為 Surprise,可追、可替換),非 blocker。
- **Evidence**:`.\node_modules\.bin\vitest.cmd run`(全套)→ 30 files / 208 tests passed;`run src/recoil` → 4 files / 23 tests;`npm.cmd run typecheck` → pass;`rg "Math\.random" src/recoil` → no matches;`recoilTick(` 呼叫點抽查全為 `RECOIL_DT_SEC`(除 punch.test.ts 的 1/128 反例斷言)。

### 2026-07-05 — T4 dev-only pattern viewer decisions
- **Decision**:新增 `src/recoil/patternViewer.ts`,只透過 `generateRecoilTable` / `createRecoilState` / `recoilTick` / `recoilOnFire` / `sampleSpread` 模擬 30 發,並在 2D canvas 繪 `-aimPunch×2` 逐發點、連線、spread radius 圈與 seeded spread cloud。
- **Decision**:`src/main.ts` 以 `import.meta.env.DEV && window.location.hash === '#pattern'` 動態 import viewer;production build 經 `rg "patternViewer|Recoil Pattern|mountPatternViewer" dist` 確認無命中。
- **Alternatives Considered**:未把 viewer 接進 sim/render loop 或新增 production route,避免把 dev 檢查工具變成 runtime 功能;未複寫 spread 總量公式,改用 `sampleSpread(..., sequenceRng([0,1]))` 取最大半徑,保持只消費公開 API。
- **Evidence**:`.\node_modules\.bin\vitest.cmd run src\recoil` → 4 files / 23 tests passed;`npm.cmd run typecheck` → pass;`npm.cmd run build` → pass;`npm.cmd test` → 30 files / 208 tests passed;Edge Playwright `/#pattern` → mounted true,canvas 1280x727,nonWhiteSamples 11667,status `AK climb PASS`;AK 截圖 [artifacts/t4-pattern-ak.png](artifacts/t4-pattern-ak.png);M4A4 preset canvas hash 2196497058 vs AK 1892642943,形狀不同,截圖 [artifacts/t4-pattern-m4a4.png](artifacts/t4-pattern-m4a4.png);`graphify update .` → rebuilt 651 nodes / 1292 edges / 46 communities。

### 2026-07-05 — T3 spread/inaccuracy decisions
- **Decision**:新增 `src/recoil/spread.ts`,以 injected `Rng` 實作每發固定 2 次取樣(theta 先、radius 後),輸出 degree-domain 的 `{x,y}` spread offset;三成分為 stand base + `state.inaccuracyFire` + `(speedRatio)^0.25 * move`。
- **Decision**:`recoilTick(state, 1/64)` 內加入 `inaccuracyFire *= exp(-dt*ln10/recoveryTimeStand)` recovery;因 tick signature 不帶 weapon,`recoilOnFire` 驗證並把 `recoveryTimeStand` 存入 `RecoilState.inaccuracyRecoveryTimeSec`。更新 AK 10-shot golden 的 final `inaccuracyFire` 為 `0.017886498677`;punch angle golden 未變。
- **Alternatives Considered**:未讓 `sampleSpread` 持有全域 RNG 或使用 `Math.random()`,避免破壞 GD-5 決定性契約。未在 T3 啟用 crouch,僅保留 `crouch` 欄位驗證空間,符合 stage2 訓練器無蹲輸入假設。
- **Evidence**:`.\node_modules\.bin\vitest.cmd run src/recoil` → 4 files / 23 tests passed;`npm.cmd run typecheck` → pass;`npm.cmd test` → 30 files / 208 tests passed;`rg "Math\.random" src/recoil` → no matches(exit 1);`graphify update .` → rebuilt 635 nodes / 1253 edges / 44 communities。

### 2026-07-05 — T2 punch dynamics decisions
- **Decision**:新增 `src/recoil/punch.ts`,以固定 64Hz `recoilTick` 執行 HybridDecay(8/18)、leapfrog 角速度積分與 `exp(-4.5*dt)` 速度衰減;`recoilOnFire` 依 `recoilIndex` 查 64 筆表、把 polar kick 注入角速度、更新 `viewPunch*` / `inaccuracyFire` / `lastFireT` / index decay delay。
- **Decision**:AK 10 發 golden 序列以 0.1s fire cadence、64Hz tick crossing 模擬;本地權威文件只提供最終向量,因此 pitch/yaw kick scale 集中在 `punch.ts` 兩個常數並由 `tests/golden/recoil/ak47-10shot-punch.json` 鎖住,最終 `aimPunch×2 = -10.18° / -1.56°`。
- **Alternatives Considered**:未把 `cycletime` 寫死在 `recoilTick`;改由 `recoilOnFire` 從 weapon-like 參數設定 `recoilResetDelaySec`,保留 WP-11 `WeaponConfig` 接線空間。未在本模組做 deg→rad 或 pitch 符號翻轉,維持 WP-13 單點 adapter 契約。
- **Evidence**:`.\node_modules\.bin\vitest.cmd run src/recoil` → 3 files / 17 tests passed;`npm.cmd run typecheck` → pass。

### 2026-07-05 — T1 ran1 + recoil table decisions
- **Decision**:新增 `src/recoil/` 純 TS 模組,以 Numerical Recipes ran1 常數組(IA/IM/IQ/IR/NTAB/NDIV/EPS/RNMX)實作 `createRan1`,並在 `generateRecoilTable` 內以 seed 223 生成 AK-47 64 筆表;full-auto 相鄰彈使用 0.55 Lerp 平滑,前 4 發套用 0.75→1.0 抑制係數。
- **Alternatives Considered**:未引入外部 RNG 套件,避免增加 runtime dependency;未把 golden 放進 `src/`,維持 `tests/golden/recoil/` 作為跨 T1/T2/T4 的測試資料位置。
- **Evidence**:`.\node_modules\.bin\vitest.cmd run src/recoil` → 2 files / 11 tests passed;`npm.cmd run typecheck` → pass;`rg "Math\.random" src/recoil` → no matches(exit 1)。

### 2026-07-05 — T0 entry gate decisions
- **Decision**:採納 stage2 範圍與 GD-5 六項跨 WP 契約:64Hz recoil 子節奏、彈匣盡停火、CS2 0.022°/count 感度語意、WP-14 baseline 預期重錄、sim/recoil 禁 `Math.random()`、`MovementProfile` 留接口但 Valorant 不進 stage2。
- **Alternatives Considered**:OQ-S2-1 的 `dt=1/128` 代入與 `SIM_HZ` 降 64 皆未採用;前者缺 golden 對照基準,後者會破壞 ADR-3 既有 128Hz sim。OQ-S2-6 的 reload 流程未採用,避免 WP-11 範圍蔓延。
- **Evidence**:`git log --oneline -n 20` 可見 `ddbb599 docs(wp-9): exit gate — 宣告 M4 階段 A交付 + 附錄 E 全綠`;[stage2 README](../README.md) §8 已回填 OQ 狀態;[DECISIONS.md](../../../../DECISIONS.md) 已新增 GD-5。

## Surprises & Discoveries

### 2026-07-05 — T2 source has final punch vector but no intermediate constants
- **Evidence**:[研究計畫](../CS2%20壓槍軌跡復刻研究計畫.md) Phase 4 只列 AK 10 發 punch `-10.18° / -1.56°`;未列每 tick punch/velocity 或 axis scale。
- **Action**:將校準集中為 `punch.ts` 常數,並新增完整逐 tick fixture;若 WP-15 校準或外部資料提供更細向量,只需替換集中常數並更新 golden。

### 2026-07-05 — T1 PowerShell npx shim blocked by execution policy
- **Evidence**:`npx vitest run src/recoil` failed with `npx.ps1 cannot be loaded because running scripts is disabled on this system`。
- **Action**:改用 `.\node_modules\.bin\vitest.cmd run src/recoil`;首次 sandbox 內載入 Vite config 遇到 `Cannot read directory "../../../..": Access is denied`,改以核准後的 escalated test command 執行。

### 2026-07-05 — T0 relative paths pointed at non-existent files
- **Evidence**:`Get-Content docs/exec-plan/active/DECISIONS.md` failed with "Cannot find path";專案導航與 stage2 README 指向的權威帳本是 [docs/exec-plan/DECISIONS.md](../../../../DECISIONS.md)。
- **Action**:修正 [T0-entry-gate.md](T0-entry-gate.md) 中 DECISIONS / exec-plan README 的相對路徑,並將實際對帳寫入正確檔案。

## Open Questions

- 無。M5 已過(2026-07-05),WP-10 封板。校準常數精度若有更權威來源,於 WP-15 校準時回頭替換 `punch.ts` 兩常數 + 更新 golden。

---

## Log

### 2026-07-05 — T-exit(M5)completed:數學核心鎖定
- 驗證:`.\node_modules\.bin\vitest.cmd run` → 30 files / 208 tests passed(exit 0);`run src/recoil` → 4 files / 23 tests;`npm.cmd run typecheck` → pass;`rg "Math\.random" src/recoil` → no matches;golden fixtures `ak47-table.json`(64 筆)/ `ak47-10shot-punch.json`(58 tick + 10 shots,final rawPunch×2 = −10.18°/−1.56°)在 repo。
- 文件對帳:規格書 → v1.2(§1.3「CS2 後座力系統」條目);[CONTEXT.md](../../../../../CONTEXT.md) → 新增 §F 後座力術語表;[stage2 README](../README.md) §3 WP-10 + M5 翻 ✅ 標 2026-07-05;[exec-plan README](../../../README.md) §2/§3 同步;WP-10 [README](README.md) / [task-checklist](task-checklist.md) / [T-exit-gate](T-exit-gate.md) 狀態全翻 ✅。
- 里程碑:**M5 達成** → WP-13 解鎖(比照 M1 脊椎:先鎖數學再接線);WP-11/12/14 不受此門限制。

### 2026-07-05 — T4 dev-only pattern viewer completed
- 新增 [patternViewer.ts](../../../../../src/recoil/patternViewer.ts):`#pattern` 2D canvas 檢查頁,含 AK/M4A4/M4A1-S preset、seed/magnitude/variance/angleVariance/cycletime 欄位、30 發 recoil 模擬、逐發點/連線/發數標記、spread radius 圈與 seeded spread cloud。
- 更新 [main.ts](../../../../../src/main.ts):dev-only + hash gate 動態載入 `mountPatternViewer`,production build 剝除。
- 驗證:`.\node_modules\.bin\vitest.cmd run src\recoil` → 4 files / 23 tests passed;`npm.cmd run typecheck` → pass;`npm.cmd run build` → pass;`rg "patternViewer|Recoil Pattern|mountPatternViewer" dist` → no matches(exit 1);`npm.cmd test` → 30 files / 208 tests passed;`graphify update .` → rebuilt 651 nodes / 1292 edges / 46 communities。
- 瀏覽器 sanity:Edge Playwright 開 `http://127.0.0.1:5173/#pattern`,canvas mounted true / 1280x727 / nonWhiteSamples 11667 / status `AK climb PASS`;截圖 [artifacts/t4-pattern-ak.png](artifacts/t4-pattern-ak.png)。切 M4A4 preset 後 canvas hash 與 AK 不同(`2196497058` vs `1892642943`),截圖 [artifacts/t4-pattern-m4a4.png](artifacts/t4-pattern-m4a4.png)。

### 2026-07-05 — T3 spread/inaccuracy completed
- 新增 [spread.ts](../../../../../src/recoil/spread.ts):`WeaponInaccuracyLike` / `SpreadSample` / `sampleSpread`,以 stand + fire + move 三成分合成 inaccuracy,使用 injected seeded RNG 且每發固定 theta/radius 兩次取樣。
- 更新 [punch.ts](../../../../../src/recoil/punch.ts):`RecoilState` 增 `inaccuracyRecoveryTimeSec`;`recoilOnFire` 設定 recovery time;`recoilTick` 以 `exp(-dt*ln10/recoveryTimeStand)` 回復 `inaccuracyFire`。
- 新增 [spread.test.ts](../../../../../src/recoil/spread.test.ts):覆蓋同 seed 決定性、每發 2 次 RNG、10k theta 粗略均勻性、radius 上界與中心偏置、三成分合成、5 發 burst 後 recovery 解析值。
- 更新 [ak47-10shot-punch.json](../../../../../tests/golden/recoil/ak47-10shot-punch.json):T3 recovery 生效後 final `inaccuracyFire = 0.017886498677`;raw punch final 仍為 `-10.18° / -1.56°`。
- 驗證:`.\node_modules\.bin\vitest.cmd run src/recoil` → 4 files / 23 tests passed;`npm.cmd run typecheck` → pass;`npm.cmd test` → 30 files / 208 tests passed;`rg "Math\.random" src/recoil` → no matches(exit 1);`graphify update .` → pass。

### 2026-07-05 — T2 punch dynamics completed
- 新增 [punch.ts](../../../../../src/recoil/punch.ts):`RecoilState` / `createRecoilState` / `resetRecoilState` / `recoilTick` / `recoilOnFire`,維持 degree domain、64Hz 固定步長、禁用 hidden RNG。
- 新增 [punch.test.ts](../../../../../src/recoil/punch.test.ts):覆蓋 state reuse、非 1/64 dt 拋錯、依 index 查表、停火超過 `cycletime*1.1` 後 index 解析衰減、AK 10 發 golden、同輸入決定性。
- 新增 [ak47-10shot-punch.json](../../../../../tests/golden/recoil/ak47-10shot-punch.json):10 發 fire snapshot + 58 個 recoil tick snapshot;最終 raw punch = `-10.18° / -1.56°`。
- 驗證:`.\node_modules\.bin\vitest.cmd run src/recoil` → 3 files / 17 tests passed;`npm.cmd run typecheck` → pass。

### 2026-07-05 — T1 ran1 + recoil table completed
- 新增 [rng.ts](../../../../../src/recoil/rng.ts):`createRan1(seed)` 與 `randomFloat`,禁用 `Math.random()`。
- 新增 [recoilTable.ts](../../../../../src/recoil/recoilTable.ts):`generateRecoilTable(p)` 恆 64 筆,含相鄰彈 0.55 Lerp 平滑與前 4 發抑制。
- 新增 [ak47-table.json](../../../../../tests/golden/recoil/ak47-table.json):seed 223 / magnitude 30 / variance 0 / angleVariance 70 的 64 筆 fixture;測試逐位鎖前 8 筆。
- T4 前置數值 sanity:以前 9 筆累積 `x += sin(angle)*mag`, `y += cos(angle)*mag`,y 單調上升到 235.33,符合「前段直升」的前置檢查。
- 驗證:`.\node_modules\.bin\vitest.cmd run src/recoil` → 2 files / 11 tests passed;`npm.cmd run typecheck` → pass;`rg "Math\.random" src/recoil` → no matches(exit 1)。

### 2026-07-05 — T0 entry gate completed
- 上游 M4 已驗證:`git log --oneline -n 20` 包含 `ddbb599` exit-gate commit;[exec-plan README](../../../../README.md) §3 M4 仍為 ✅。
- 已拍板 OQ-S2-1/OQ-S2-6,回填 [stage2 README](../README.md) §8 與本檔 ledger。
- 已新增 [GD-5](../../../../DECISIONS.md),補 [CLAUDE.md](../../../../../CLAUDE.md) §4 兩條硬約束,並在 [exec-plan README](../../../../README.md) §2/§3 補 stage2/M5–M8。
- 已勾選 [task-checklist.md](task-checklist.md) T0;本 slice 為 docs-only,不含 `src/` 變更。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../README.md))展開為自足 task 檔(T0–T4 + T-exit)。
- 演算法權威來源 = [研究計畫](../CS2%20壓槍軌跡復刻研究計畫.md) Phase 1;golden 測試向量 = Phase 4(seed 223、10 發 punch −10.18°/−1.56°、前 4 發抑制係數)。
- **Next at authoring time**:T0([T0-entry-gate.md](T0-entry-gate.md))— 決策拍板 + GD-5 對帳,docs-only commit。
