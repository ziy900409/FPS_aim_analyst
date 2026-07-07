# WP-15 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ✅ M7 caveated PASS(2026-07-07):速度曲線 surrogate 對表通過 + recoil 對 CS2 golden 釘死;第三方 pattern 差異(yaw maxAbs 3.941°)分層歸因、經研究者接受(GD-14);`cl_showpos` 實錄行為級真值仍為 caveat

| Task | 狀態 |
|---|---|
| T0 entry gate | ✅ surrogate PASS 2026-07-07(可開 T1/T2;實錄 caveat) |
| T1 cl_showpos 對表 | ✅ GREEN 2026-07-07(128Hz fixture;calibration 抓到 CS2_PROFILE 兩常數 bug,已修) |
| T2 pattern 比對 | ✅ RED/STOP 2026-07-07(測試與歸因已落地;pattern 未通過容差) |
| T-exit(M7) | ✅ caveated PASS 2026-07-07(歸因接受;GD-14) |

---

## Open Questions ledger(T0 解決)

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-S2-2 校準容差 | ✅ decided 2026-07-07 | `cl_showpos` 速度逐 tick **±1 u/s**;AK pattern 逐彈角度 **±0.05°**。首輪跑完若需校正,須記錄最大偏差、原因分層與新容差理由。 |
| OQ-15.1 速度曲線資料來源 | 🟡 caveat accepted 2026-07-07 | 因目前沒有高幀率錄影設備,研究者批准以 Source movement 公式 + CS2 cvars 產生 theory-derived surrogate fixture。T1 可開工;M7/T-exit 不得宣稱已通過 `cl_showpos` 實錄行為級校準。 |
| OQ-15.2 T1 reference cadence | ✅ decided 2026-07-07 | 採「128Hz 積分、每 2 sim tick 取樣(64Hz)」重產 surrogate fixture,對表 sim 實際積分路徑(選項1)。否決「單一 64Hz step 公式」(不驗真 integrator)與「改 movement 為 64Hz 子步」(屬 WP-14 架構變更、動手感)。詳 [DECISIONS GD-13](../../../DECISIONS.md)。 |
| OQ-15.3 CS2_PROFILE 常數 | ✅ decided 2026-07-07 | 遊戲內 console 查證權威 default = `accelerate 5.5 / friction 5.2 / stopSpeed 80`;production 原 5.6/75 為 bug,修正至 5.5/5.2/80(commit `347ce78`)。二手 totalcsgo 頁自相矛盾(5.5/5.6),以遊戲 binary 為終審。詳 [DECISIONS GD-13](../../../DECISIONS.md)。 |

---

## Log

### 2026-07-07 — T-exit:M7 caveated PASS(歸因接受 + 兩層索引同步)

研究者於 T-exit 閘門裁決:**接受 T2 分層歸因,M7 以 caveated pass 宣告**(走 T-exit DoD「差異已分層歸因並被研究者接受」路徑,非「pattern 對上外部真值」直路)。跨界決策記 [DECISIONS GD-14](../../../DECISIONS.md)。

**Outcomes:**

| 類別 | 內容 |
|---|---|
| **通過項** | (1) T1 速度曲線:surrogate(128Hz 積分 / 64Hz 取樣)於 sim cadence 逐 tick 對表 **±1 u/s 內通過**(integrator/公式 regression pin)。(2) recoil pattern **數學層**已由 WP-10 M5 golden 對 CS2 vdata 逐位釘死(10 發 punch −10.18°/−1.56° ±0.01°)。(3) 10m 牆面角度→公分換算單測通過(`tan(角度)×1000 cm`)。(4) velocity gate 連續模型(WP-14)已上線。 |
| **校正項** | 容差**未放寬**,維持 OQ-S2-2 的 ±1 u/s / ±0.05°。T1 途中觸發的兩項 **WP-14 常數 bug 修正**(accelerate 5.6→5.5、stopSpeed 75→80,commit `347ce78`)已於前述 log 記錄(GD-13)。 |
| **caveat 清單** | (a) **速度曲線為 theory-derived surrogate,非 `cl_showpos` 實錄**——M7 措辭已降級,不宣稱實錄行為級通過(OQ-15.1)。(b) **T2 第三方 Aiming.Pro pattern 逐彈對表未通過 ±0.05°**(yaw maxAbs 3.941° @ shot 15);歸因為**來源模型不匹配**(Aiming.Pro 為第三方訓練器、shot 1 非零 offset 與純 punch 語意不符),非引擎 error,經研究者接受。(c) **OQ-15.4 / OQ-15.5 未解**:Aiming.Pro 30 點語意、是否以外部 pattern 為權威改 recoil model——若立案改動另開校準切片評估 WP-10 golden/pattern viewer/ballistic compose 整體影響。(d) fixture 與 sim 同源 → T1 本質為 regression/公式 pin;真正外部行為真值待高幀率 `cl_showpos`/demo 實錄(屆時新增 `sourceType=clshowpos-capture` fixture)。 |

**驗證指令(T-exit 重跑):**
- `node_modules/.bin/vitest run`(全套):42 files / **310 tests passed**。
- `node_modules/.bin/vitest run tests/calibration`:6/6 passed(T1 showpos 3 + T2 pattern 3;T2 以可重跑 RED report 形式 pin 住偏差,CI 綠)。
- `node_modules/.bin/tsc --noEmit`:exit 0。

**兩層索引同步:** [../README.md §3](../../../active/stage2/README.md) WP-15 → ✅ M7 caveated + §4 M7 標日期 + §8 OQ-S2-2 ledger 收斂;[exec-plan/README.md §3](../../../README.md) WP-15 + §4 M7 同步;[task-checklist.md](task-checklist.md) T-exit → ✅;[T-exit-gate.md](T-exit-gate.md) Steps 全勾。

**Decision Log:**
- **走「歸因接受」而非「調參追齊」或「必紅 CI」。** Alternatives Considered:(1) 盲調 `GOLDEN_YAW_KICK_SCALE`/recoil seed 讓 shot 15 對齊 Aiming.Pro——否決,破壞 WP-10 M5 golden 與既有校準基準,違反 WP-15 README §2「比對不過是歸因不是調參」;(2) 無限期阻塞 M7 直到取得高幀率 `cl_showpos` 實錄——否決,權威 recoil 已由 M5 對 CS2 vdata 校準,對第三方弱參考無限期門控 WP-17/M8 不成比例;T-exit DoD 本就提供「分層歸因 + 研究者接受」逃生路徑。
- **M7 措辭雙重降級並存。** 速度側 caveat(theory surrogate)與 pattern 側 caveat(第三方來源差異)語意不同,兩者皆明列於 M7 里程碑與 GD-14,避免日後誤讀為「已對 CS2 實錄全面校準」。

### 2026-07-07 — T2 RED/STOP(Aiming.Pro AK pattern 可重跑比對 + 10m 換算單測)

已新增 [tests/calibration/pattern.test.ts](../../../../../tests/calibration/pattern.test.ts),以 production `ak47` recoil config 合成 30 發 held-fire 純 punch pattern:
- table:`generateRecoilTable(ak47.recoil)`;
- shot cadence:`cycletimeSec=0.1`;
- sample timing:每發 `recoilOnFire` 後、下一個 64Hz `recoilTick` 前,對齊 `patternViewer.simulatePattern`;
- spread isolation:不呼叫 `sampleSpread`,只取 `-rawPunchYawDeg`/`-rawPunchPitchDeg` 對 fixture `xDeg`/`yDeg`。

**Fixture meta 更新:**[ak47-pattern.json](../../../../../tests/golden/calibration/ak47-pattern.json) 增加 `comparisonMapping`,明確記錄 `sourceXDeg -> -rawPunchYawDeg`、`sourceYDeg -> -rawPunchPitchDeg`、sample timing 與 spread isolation。Aiming.Pro 來源是 UI 直接角度值,所以仍不需要像素→角度標定。

**逐彈誤差表(角度 deg;OQ-S2-2 容差 ±0.05°):**

| shot | pitch actual | pitch ref | Δpitch | yaw actual | yaw ref | Δyaw |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0.000 | 0.380 | -0.380 | 0.000 | 0.190 | -0.190 |
| 2 | 0.396 | 1.440 | -1.044 | 0.368 | 0.000 | 0.368 |
| 3 | 1.737 | 3.060 | -1.323 | -0.044 | 0.130 | -0.174 |
| 4 | 3.781 | 4.880 | -1.099 | 0.068 | 0.190 | -0.122 |
| 5 | 5.777 | 6.440 | -0.663 | 0.075 | -0.500 | 0.575 |
| 6 | 7.710 | 7.945 | -0.235 | -0.258 | -0.938 | 0.680 |
| 7 | 9.149 | 9.000 | 0.149 | -0.330 | -1.630 | 1.300 |
| 8 | 10.019 | 10.063 | -0.044 | -0.783 | -0.805 | 0.022 |
| 9 | 10.572 | 9.750 | 0.822 | -0.118 | 1.630 | -1.748 |
| 10 | 10.180 | 10.123 | 0.057 | 1.560 | 2.735 | -1.175 |
| 11 | 10.442 | 10.655 | -0.213 | 2.996 | 2.065 | 0.931 |
| 12 | 10.774 | 10.568 | 0.206 | 1.228 | 2.880 | -1.652 |
| 13 | 10.761 | 10.520 | 0.241 | 2.737 | 4.382 | -1.645 |
| 14 | 10.070 | 10.637 | -0.567 | 5.811 | 4.592 | 1.219 |
| 15 | 10.231 | 10.873 | -0.642 | 6.504 | 2.563 | 3.941 |
| 16 | 10.713 | 11.078 | -0.365 | 2.642 | 1.220 | 1.422 |
| 17 | 11.070 | 11.310 | -0.240 | 0.200 | 0.440 | -0.240 |
| 18 | 11.463 | 11.575 | -0.112 | 0.027 | -0.930 | 0.957 |
| 19 | 11.352 | 11.060 | 0.292 | -0.399 | -2.920 | 2.521 |
| 20 | 10.864 | 11.185 | -0.321 | -2.907 | -1.845 | -1.062 |
| 21 | 11.108 | 11.190 | -0.082 | -0.634 | -2.030 | 1.396 |
| 22 | 11.117 | 11.455 | -0.338 | -0.765 | -1.558 | 0.793 |
| 23 | 11.432 | 11.830 | -0.398 | -0.370 | -1.185 | 0.815 |
| 24 | 11.580 | 11.668 | -0.088 | -0.240 | -2.292 | 2.052 |
| 25 | 11.427 | 11.755 | -0.328 | -1.502 | -2.453 | 0.951 |
| 26 | 11.711 | 11.720 | -0.009 | -1.931 | -1.410 | -0.521 |
| 27 | 11.730 | 11.508 | 0.222 | -0.240 | 0.578 | -0.818 |
| 28 | 11.608 | 10.820 | 0.788 | 0.333 | 2.820 | -2.487 |
| 29 | 10.466 | 10.825 | -0.359 | 3.331 | 3.785 | -0.454 |
| 30 | 10.394 | 10.525 | -0.131 | 4.644 | 2.400 | 2.244 |

**結果:**maxAbs = **3.941°**(shot 15 yaw),meanAbsPitch = **0.392°**,meanAbsYaw = **1.150°** → T2 pattern 對表 **未通過** ±0.05°。10m 牆面換算單測通過:`tan(angleDeg) * 1000 cm`,樣本包含 0.38°→6.632cm、10.123°→178.541cm、11.83°→209.457cm、2.735°→47.771cm。

**驗證指令:**
- `node_modules/.bin/vitest run tests/calibration`:6 tests passed(含 T1 showpos 3 + T2 pattern 3;T2 pattern 比對以 RED report 形式斷言目前偏差超容差)。
- `node_modules/.bin/vitest run`:42 files / **310 tests passed**。
- `node_modules/.bin/tsc --noEmit`:exit 0。
- `graphify update .`:rebuild ok,757 nodes / 1620 edges / 47 communities。

**Decision Log:**
- **不調整 recoil seed/magnitude/scale 來追 Aiming.Pro yaw。** Alternatives Considered:直接改 `GOLDEN_YAW_KICK_SCALE` 或 recoil table seed 讓 shot 15 對齊。否決,WP-15 規則明確要求比對不過先歸因;現有 recoil 參數與 10-shot golden/WP-10 相依,盲調會破壞既有校準基準。
- **T2 測試採 RED report,不是讓 CI 紅燈。** Alternatives Considered:新增一個必紅的 ±0.05° assertion。否決,會讓 repo 長期不可驗證;改以可重跑 report pin 住最大偏差與均值,並把 T-exit 阻塞寫在 progress。
- **sample timing 對齊現有 `patternViewer.simulatePattern`:post-fire/pre-next-tick。** Alternatives Considered:每發後額外取 1–7 個 64Hz tick 嘗試對齊 Aiming.Pro 首發非零點。否決,這會讓測試與 UI/既有 pattern semantics 分叉,且最佳取樣仍遠超 ±0.05°。

**Surprises & Discoveries:**
- pitch 軌跡中後段大致同量級,但 yaw 在 shot 15、19、24、28、30 有 2°–4° 級偏差,暗示差異較可能來自 recoil table/水平 scale/來源資料 sign 或 Aiming.Pro 模型差異,不是角度→公分換算問題。
- Aiming.Pro fixture shot 1 已有非零 offset,但專案 post-fire/pre-tick pure punch 首發為 0;若未來改用外部 bullet impact timing,需先定義 sample semantics,不能只改容差。

**Open Questions / Blocker:**
- OQ-15.4:Aiming.Pro 的 30 點是否代表 CS2 bullet impact pattern、recoil compensation path,或其自有訓練模型? 需確認 sample timing/首發語意。
- OQ-15.5:是否要以 Aiming.Pro 作為權威外部真值改動 recoil model? 若是,應另開 WP-16/校準切片評估 WP-10 10-shot golden、pattern viewer、ballistic compose 的整體影響。

### 2026-07-07 — T1 GREEN(cadence 定案 + WP-14 常數 bug 修正 + 128Hz fixture 重產)

承上 RED 的兩個 blocker(OQ-15.2 cadence、OQ-15.3 常數),經研究者拍板 + 遊戲內查證後解除,T1 對表通過。

**OQ-15.3 常數查證(遊戲內權威 default,終審):**

| cvar | 遊戲內 default | production 原值 | 結果 |
|---|---:|---:|---|
| `sv_accelerate` | 5.5 | 5.6 | ❌→修 |
| `sv_friction` | 5.2 | 5.2 | ✅ |
| `sv_stopspeed` | 80 | 75 | ❌→修 |

二手來源(totalcsgo `svaccelerate` 頁)描述寫 5.6、表格寫 5.5 自相矛盾;gist cvar dump 過大被截斷讀不到 `sv_` 段。故以**遊戲內 `sv_accelerate` / `sv_friction` / `sv_stopspeed`(不帶值)印出的 default** 為終審 → 5.5 / 5.2 / 80。

**Slice A — WP-14 correctness fix(commit `347ce78`):** `CS2_PROFILE` accelerate 5.6→5.5、stopSpeed 75→80。以**獨立參考實作**(hand-rolled Source friction→accelerate,不 import controller)重算受影響斷言:
- held-D 首 tick `10.9375→10.7421875`、次 tick `18.828125→18.234375`;1s 位移 `211.338→209.177`;64-tick vx `249.285→244.578`;反向鍵/低速衰減穿越門檻值同步重算。
- friction-only-from-250 值(A+D、剛放開)`239.84375` **不變**(`max(250,80)=max(250,75)=250`)。
- 受影響檔:[MovementController.ts](../../../../../src/sim/MovementController.ts)、[MovementController.test.ts](../../../../../src/sim/MovementController.test.ts)、[SimLoop.test.ts](../../../../../src/loop/SimLoop.test.ts)、[__tests__/determinism.test.ts](../../../../../src/loop/__tests__/determinism.test.ts)。

**Slice B — fixture 重產(128Hz 積分 / 64Hz 取樣):** 以同一參考實作重產 [clshowpos-accel.json](../../../../../tests/golden/calibration/clshowpos-accel.json)、[clshowpos-stop.json](../../../../../tests/golden/calibration/clshowpos-stop.json)。meta 加 `integrationHz=128`/`sampleHz=64`/`simTicksPerSample=2`/`cvarSource`。起步 tick0 `21.484→18.234`;急停 zero-crossing bracket 仍 [6,7],estimatedTick `6.584536→6.6930059564155195`。fixture 與 sim 同公式同 cadence → 對表為 integrator 決定性/公式 regression pin(非實錄真值)。

**Slice C — T1 對表綠:** [tests/calibration/showpos.test.ts](../../../../../tests/calibration/showpos.test.ts) 更新 zeroCrossing 期望值。

**驗證指令:**
- `node_modules/.bin/vitest run`(全套):41 files / **307 tests passed**。
- `node_modules/.bin/vitest run tests/calibration`:3/3 passed(起步、急停+zero-crossing、fixture meta 契約)。
- `node_modules/.bin/tsc --noEmit`:exit 0。

**Decision Log:**
- **OQ-15.3 以事實(遊戲內 default)解,非以讓測試變綠解。** Alternatives Considered:改 fixture 對齊 production 5.6/75。否決,遊戲內權威值為 5.5/80,production 才是 bug——calibration 的職責即抓此,遷就 bug 會讓校準失去意義。
- **OQ-15.2 採選項1(128Hz fixture)。** Alternatives Considered:選項3(只驗 formula,不驗真 sim)校準價值最弱;選項2(改 movement 為 64Hz 子步)屬 WP-14 架構變更、動手感、out-of-scope。
- **用獨立 hand-rolled 參考實作算期望值,不直接呼叫 controller。** Alternatives Considered:直接把 controller 輸出寫回測試。否決,那是純套套邏輯;獨立重導 Source 公式並與 sim 相符,才同時驗證「controller 正確實作公式」。
- **WP-14 fix 與 T1 calibration 分兩個 commit。** Alternatives Considered:一個大 commit。否決,引擎 correctness fix 與校準測試是兩個 logical change(協議禁引擎修正混進校準 WP)。

**Open Questions / Caveat:**
- **gameplay 手感回歸未驗**:accelerate/stopSpeed 改變會改 counter-strafe drill 實際手感,需瀏覽器實機驗收(承 GD-13 影響面)。
- **surrogate caveat 仍在**(OQ-15.1):T-exit/M7 結論措辭須為「公式/常數曲線於 sim cadence 對表通過」,不得宣稱 `cl_showpos` 實錄行為級通過。
- fixture 與 sim 同源 → 本對表主要是 integrator regression/公式 pin;真正外部行為真值仍待高幀率 `cl_showpos`/demo 實錄(屆時新增 `sourceType=clshowpos-capture` fixture)。

### 2026-07-07 — T1 first run RED(constants mismatch + fixture cadence mismatch)

已新增 T1 對表測試草稿:[tests/calibration/showpos.test.ts](../../../../../tests/calibration/showpos.test.ts),但 targeted suite 尚未通過,因此 T1 **未完成、不 commit**。

**驗證指令:**
- `npx vitest run tests/calibration`:PowerShell `npx.ps1` 被 execution policy 擋住,未跑到測試。
- `.\node_modules\.bin\vitest.cmd run tests/calibration`:sandbox 啟動 Vite config 時讀取權限不足,未跑到測試。
- 升權後 `.\node_modules\.bin\vitest.cmd run tests/calibration`:Vitest 啟動成功,`tests/calibration/showpos.test.ts` 3 tests / 3 failed。

**第一層歸因:constants 假設不一致。**

| 欄位 | fixture meta | production `CS2_PROFILE` | 結果 |
|---|---:|---:|---|
| accelerate | 5.5 | 5.6 | ❌ |
| friction | 5.2 | 5.2 | ✅ |
| stopSpeed | 80 | 75 | ❌ |
| maxSpeed | 250 | 250 | ✅ |

失敗訊息首要點:`expected 5.6 to be 5.5`,位置 `tests/calibration/showpos.test.ts:57`。

**第二層歸因:fixture cadence 與 sim cadence 不同。** 用 fixture 常數手算拆分:
- 起步 tick0:`2 x 128Hz sim step = 18.234375 u/s`,`1 x 64Hz fixture step = 21.484375 u/s`。
- 急停 tick0:`2 x 128Hz sim step = 209.0521240234375 u/s`,`1 x 64Hz fixture step = 208.203125 u/s`。

所以即使 production 常數改成 fixture 常數,目前 `clshowpos-accel.json`/`clshowpos-stop.json` 仍是「64Hz 單步公式」fixture,不是「128Hz sim 每 2 tick 取樣」fixture。這會讓 T1 的 2:1 子節奏對表在起步段紅燈。

**Decision Log:**
- **不在 T1 內直接改 `src/sim/MovementController.ts` 常數。** Alternatives Considered:把 `CS2_PROFILE` 改成 fixture cvars 後繼續;否決,因 WP-15 README/T1 out-of-scope 明確要求比對不過時先歸因,引擎行為修正需另行決策。
- **保留紅燈測試草稿作為可重跑證據,但不 commit。** Alternatives Considered:改成用 fixture 常數注入 controller 讓測試綠;否決,因這會避開 production `CS2_PROFILE` 與 fixture meta 的實際差異,降低校準測試價值。

**Open Questions / Blocker:**
- OQ-15.2: T1 reference cadence 要採哪一個?
  1. 重產 fixture 為「128Hz integrator 每 2 tick 取樣」,保留現行 sim 架構;
  2. 將 movement calibration path 改為 64Hz movement 子步,再由 128Hz sim 對齊;
  3. 保留 64Hz 單步 fixture,但 T1 改成只驗 formula/cvars,不宣稱驗 128Hz sim 2:1 對表。
- OQ-15.3: `CS2_PROFILE` 是否要對齊 T0 surrogate cvars(`accelerate=5.5`,`stopSpeed=80`)? 若要改 production 常數,應先評估 WP-14 既有測試與 gameplay 手感影響。

### 2026-07-07 — T0 amended to surrogate PASS(theory-derived velocity fixtures)

研究者指示:目前沒有設備錄高幀率影片,改用本輪調查得到的速度曲線資料。T0 因此由 STOP 改為 **surrogate PASS**。

**新增 fixtures:**
- [tests/golden/calibration/clshowpos-accel.json](../../../../../tests/golden/calibration/clshowpos-accel.json):Source movement 公式 + CS2 cvars 產生的起步曲線;primary `knife_250`,alternate `ak47_215`。
- [tests/golden/calibration/clshowpos-stop.json](../../../../../tests/golden/calibration/clshowpos-stop.json):同來源的 counter-strafe 急停 signed velocity 曲線;含 zero-crossing bracket。

**採用依據:**
- Source movement 順序採 friction → accelerate;fixture meta 記公式與來源。
- CS2 cvars 採 `sv_accelerate=5.5`、`sv_friction=5.2`、`sv_stopspeed=80`。
- `cl_showpos` 有 frame interpolation 與 subtick partial-step 地雷;T1 對齊規則改為 fixture tick 0 = input 生效後第一個完整 64Hz movement step,未來真實錄資料的 partial sample 不納入 ±1 u/s 斷言。

**Decision Log:**
- **接受 theory-derived surrogate 解除工程 blocker,但不等同外部行為真值。** Alternatives Considered:維持 STOP 直到高幀率 `cl_showpos` 錄影可得;使用者明確表示目前無設備並要求使用本資料,故改採 surrogate 以推進 T1/T2。限制寫入 OQ-15.1 與 T1/T-exit caveat。
- **保留 primary `knife_250` + alternate `ak47_215`。** 現行 WP-14 movement baseline 是 250 u/s,但 recoil/AK 情境的手持速度為 215 u/s;兩條曲線同檔保留,避免日後 weapon-specific movement 對帳重做 fixture。
- **stop fixture 保存 signed velocity。** Alternatives Considered:只存 `abs(speed)`;否決,因 counter-strafe 持續按反向鍵會 overshoot,保存 signed velocity 才能明確斷言 zero-crossing bracket。

**Open Questions / Caveat:**
- 若日後可取得 demo parser 或高品質實錄,應新增 `sourceType=demo-derived` 或 `sourceType=clshowpos-capture` fixture,再決定是否替換 theory surrogate。
- T-exit/M7 若仍只使用 theory surrogate,結論文字必須降級為「公式/常數曲線對表通過」,不能宣告 `cl_showpos` 實錄行為級通過。

### 2026-07-07 — AK pattern candidate fixture added(Aiming.Pro)

研究者提供 Aiming.Pro drill creator 內 AK47 spray pattern 數值與來源:
- 來源 URL:`https://aiming.pro/app#/training/drills/create`。
- 第 1 欄 = yaw / horizontal = `xDeg`。
- 第 2 欄 = pitch / vertical = `yDeg`。
- 30 發角度值已整理為 [tests/golden/calibration/ak47-pattern.json](../../../../../tests/golden/calibration/ak47-pattern.json)。

**清點狀態更新:**AK pattern 由「缺」改為「候選 fixture 已入 repo」。此資料是來源 UI 直接給出的角度值,因此不需要像素→角度標定;但 T2 實作時仍必須明確把來源 sign convention 映射到本專案 yaw/pitch sign。`cl_showpos` 起步與急停兩段仍缺,所以 WP-15 T0 整體維持 STOP,T1/T2 不開工。

**Out of scope note:**研究者同時提供 Custom Damage Fall Off、clip、spread 等武器設定截圖;這些不屬於 WP-15 T2 pattern fixture 的必要欄位,暫不入本 fixture。若後續要校準 weapon config,應另開對應資料/測試切片。

### 2026-07-07 — T0 entry gate STOP(OQ-S2-2 已拍板;參考資料未備)

**閘門結論:STOP, not PASS。** T1/T2 不得開工,因校準參考資料尚未入 repo。`git diff --stat` 本切片預期僅包含 docs;不碰 `src/`。

**上游 exit 證據:**

| 上游 | checklist | exit-gate 證據 |
|---|---|---|
| WP-13(M6) | [../wp-13-sim-camera-integration/task-checklist.md](../wp-13-sim-camera-integration/task-checklist.md) 全 ✅ | [progress.md](../wp-13-sim-camera-integration/progress.md) 記錄 `npm run typecheck` exit 0、`npm run test` 38 files / 289 tests passed、`npx playwright test` 9 passed,並有手動視覺/手感 4 項確認。 |
| WP-14 | [../wp-14-movement-physics/task-checklist.md](../wp-14-movement-physics/task-checklist.md) 全 ✅ | [progress.md](../wp-14-movement-physics/progress.md) T-exit 記錄 `npm run test:ci` exit 0:Vitest 40 files / 298 tests passed、Playwright 9 passed,並完成 Edge 手感驗證。 |

**OQ-S2-2 決議:**採 stage2 計畫預設並拍板為明確數字:
- `cl_showpos` 起步/急停速度逐 tick 容差:**±1 u/s**。
- AK pattern 逐彈角度容差:**±0.05°**。
- 首輪比對若需調整容差,不得靜默放寬;必須在本 progress 記最大偏差 tick/彈號、差異分層(公式/常數/subtick/資料品質)、新容差與理由,並同步回填 [../README.md §8](../../../active/stage2/README.md)。

**參考資料清點(STOP 條件):**

| 參考資料 | 期待路徑/證據 | T0 結果 |
|---|---|---|
| CS2 `cl_showpos` 起步段 | `tests/golden/calibration/clshowpos-accel.json`,tick 連續無缺漏,含 tickrate/來源/錄製條件 | ❌ 缺。`tests/golden/calibration` 目錄不存在。 |
| CS2 `cl_showpos` 急停段 | `tests/golden/calibration/clshowpos-stop.json`,tick 連續無缺漏,含 tickrate/來源/錄製條件 | ❌ 缺。`tests/golden/calibration` 目錄不存在。 |
| 社群 AK pattern 圖 | `tests/golden/calibration/ak47-pattern.json`,含來源 URL 與可複核的像素→角度標定方法 | 🟡 2026-07-07 已補候選 fixture:Aiming.Pro drill creator 直接角度值;不需像素標定,sign 映射待 T2 明確化。 |

**資料清點證據:** `rg --files tests docs | rg "(calibration|clshowpos|showpos|pattern|ak47)"` 只找到 WP-15 task 文件、WP-10 recoil golden(`tests/golden/recoil/*`)與 pattern viewer 圖;未找到 `tests/golden/calibration/*`。`Test-Path tests\golden\calibration` 回報 missing。

**Decision Log:**
- **容差先拍板,資料 gate 獨立 STOP。** Alternatives Considered:等待資料後再決定容差;否決,因 T1/T2 測試需先有固定 DoD,且計畫已提供保守預設。資料缺口不影響 OQ-S2-2 數字拍板,但阻塞 T1/T2。
- **不建立空 fixture 或測試骨架。** Alternatives Considered:先建 `tests/golden/calibration` 與 skipped tests;否決,T0 明確寫「資料不在手 = blocker(STOP),不得以先寫測試骨架繞過」。

**Open Questions / Blocker:**
- 研究者需提供 CS2 `cl_showpos` 起步 + 急停錄製資料(各至少一段,64 tick 連續、含 tickrate/來源/錄製條件)。
- AK pattern 候選 fixture 已補;T2 仍需在測試中明確來源 sign convention 到 project yaw/pitch 的映射。

### 2026-07-03 — Plan authored
- 由 stage2 計畫([../README.md](../../../active/stage2/README.md) §6 WP-15 表 + session 補充決定)展開為自足 task 檔(T0–T2 + T-exit)。
- 補充決定:T0 加入**參考資料備妥檢查**(CS2 `cl_showpos` 錄製檔、社群 pattern 圖來源)——資料不在手 = blocker,列 STOP 條件。
- 比對不過的處理原則 = 差異分層歸因(公式/常數/subtick),不盲調參([README.md §2](README.md))。
- **Next**:T0([T0-entry-gate.md](T0-entry-gate.md))— OQ-S2-2 拍板 + 資料清點,docs-only。
