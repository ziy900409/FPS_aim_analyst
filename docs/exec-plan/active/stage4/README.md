# 階段 D(stage4)執行計畫 — 選手表現分析管線(research 層:瞄準 × 急停診斷指標)

> stage4 頂層索引 + tech spec。**✅ 已採納(2026-08-04,GD-19/GD-20)**;草稿原案 2026-07-09 提案。
> 整合輸入:performance_analysis repo 架構分析與移植評估(2026-07-09)+ 教練視角優先序排序(目標:更有效追蹤選手**瞄準**與**急停**表現)+ stage1–3 既有資料面(WP-16 schema v2、WP-21 偵測 drill、WP-8 `MetricsDashboard`)+ **採納期讀碼對帳(2026-08-04,見 §0.1)**。
> 格式沿用 [exec-plan/README.md](../../README.md)(每 WP 一個自足子資料夾;task = 垂直切片 = 原子 commit)。文件語言:繁體中文,術語保留英文(D4)。

| | |
|---|---|
| **交付範圍** | 離線分析 research 層(Python,四目錄制,學 performance_analysis):schema v2 匯出 → 角運動學/submovement 分段地基(**含 ε 層雙向 parity**)→ 教練診斷指標(逐 peek 時間軸、Release-to-Click Sync、REC/MR/V phase、L/R 101 點曲線)→ 進階診斷(SPARC、Key-Velocity Coupling、Fitts)→ 成熟指標以 golden parity 晉升 TS `MetricsDashboard` |
| **上游門檻** | M4 ✅(schema v2 匯出鏈)+ WP-16 ✅(v2 欄位)+ **M11/M12 ✅**(`meta.targets.hitbox`/tick `ads`/`hit` 事件語意已鎖);**引擎零改動**(例外:WP-29 T3 選配 key-event 記錄、WP-32 metrics/UI 層,皆不碰 sim)。M13 手動回填(#32)**不阻塞** |
| **技術棧** | 新增:**Python 3.12 + uv + pyproject**(numpy/pandas/scipy;pytest)於 `research/`(OQ-S4-1 ✅);既有 TS 棧觸及點 = 對表 vitest(WP-28 T2、WP-32 T1)+ `src/metrics/` 與結果頁(WP-32) |
| **估時** | 11–16 dev-days(WP-28~32) |
| **狀態** | 🟡 **已採納;WP-28 完成,但 M14 ② 於 2026-08-05 撤回**([KI-004](../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) / K-2)· WP-29 🟡(**T0 entry gate ✅,不受 KI-004 阻塞**)· WP-30 ⬜(**entry blocker 恢復**)· WP-31 ⬜(**entry blocker 恢復**)· WP-32 ⬜。M14 ①③④⑤⑥ 維持(分段走 ω(t),只依賴 `aim`);② ε parity 因量測原點錯誤(實測偏差 12.5°/67°)撤回,待 KI-004 S1 落地後重新宣告 |

---

## 0. 輸入現況

### 0.0 優先序決議 → WP 映射

> 排序原則(2026-07-09 教練視角評估):**一個指標的價值 = 它能不能改變下一週的訓練處方**。四個評估軸:教練決策價值 / 資料就緒度(schema v2 是否已有欄位)/ 演算法風險(移植已驗證 vs 新構念)/ 依賴關係。**本表為 scope 憲法**。

| 優先序 | 項目 | 排序理由(一句話) | 落點 |
|---|---|---|---|
| **P0-1** | 逐 peek counter-strafe 時間軸 | 教練第一線是個案回放不是統計量;欄位全在 schema v2,成本趨近零 | WP-29 T1 |
| **P0-2** | 角運動學 ω(t) + submovement 分段 | 單點故障:沒有它,P1/P2 全部軌跡指標沒有立足點;唯一需要認真校參的地基 | WP-28 T2/T3 |
| **P1-1** | REC/MR/V phase 分解 | 回答「慢在哪一段」→ 直接分流訓練處方;與既定 t_detect(GD-8)/t_acquire(GD-7)構念對接,不發明新概念 | WP-30 T1 |
| **P1-2** | Release-to-Click Sync 指標族 | 急停的本質 =「鬆鍵→反向鍵→開槍」三元組時序;既有 `fireTimingAlignmentMs` 的錨點族補齊,成本極低 | WP-29 T2 |
| **P1-3** | L/R 條件化 101 點正規化曲線 | 把既有 L/R symmetry 標量升級成「動作簽名曲線」;performance_analysis 象限儀表板已證明教練價值的形式 | WP-30 T2 |
| **P2-1** | SPARC(逐段平滑度) | 疲勞/緊繃早期警訊,但是監控儀表不是處方箋;價值隨個人基線累積 | WP-31 T1 |
| **P2-2** | Key-Velocity Coupling xcorr(keys vs ω) | strafe-aim 干擾指標,最有原創價值但**構念未驗證**——先過 reliability gate 才能進教練報告 | WP-31 T2 |
| **P2-3** | Fitts ID/MT/TP | 方法學成熟但被 drill 多樣性 gate 住;WP-21 偵測 drill 的 seeded `spawnArea` 提供 D 變異後升值 | WP-31 T3 |
| **P3(backlog)** | LDJ-V、velocity scaling、RawInputTrace/schema v3、瀏覽器保真度 bench、polling rate 實驗 | 研究向/儀器向,不改變教練追蹤選手的能力;唯一動引擎的項目留給明確研究委託 | §2.1 out of scope(附觸發條件) |

**與 performance_analysis 的關係**(移植評估結論,2026-07-09):

- performance_analysis 的 fusion 模組在解「三時鐘域對齊」;本專案單一 `performance.now()` 時鐘 + 128Hz 均勻 tick,**該層成本歸零**,移植重心全在 analysis 演算法。
- 可移植:submovement 分段(閾值演算法)、SPARC、REC/MR/V phase、101 點正規化、Release-to-Click Sync、Key-Velocity xcorr、`per_segment_apply` 模式、四目錄制紀律(`algorithms/` 純函式 + `notebooks/` + `parity_generators/` + `tests/`)。
- **參數不可照搬**:px/s → deg/s(yaw 乘 cos(pitch));SG window 於 128Hz 重掃(performance_analysis Go 用 w=7/p=3 是高頻資料)。
- 授權:performance_analysis 為自有 repo,程式碼可移植;FPSci 紅線不變(GD-11,方法學可參考、程式碼不可抄)。

### 0.1 採納期對帳(2026-08-04):草稿寫成後的四項現況變更

| # | 草稿假設(2026-07-09) | 現況(2026-08-04) | 對計畫的影響 |
|---|---|---|---|
| 0-1 | 預留 WP-23~27 / M11~M12 | stage5 取 WP-23~26 / M11~M13(GD-15)、muzzle-tracer 取 WP-27(GD-18) | **重編為 WP-28~32 / M14~M15 / 驗收清單 D**(`docs/operational/acceptance-stage-d.md`) |
| 0-2 | 「schema v2 = ticks(aim/keys) + events(visible/counter/fire)」 | stage5 additive 已上線:tick `ads`、event `hit`(`t_hit`/`timeOfFlightMs`/`shotSeq`)、`meta.weapon.ads/bullet`、`meta.targets.hitbox` | ingest 必須認全部 additive 欄;**ADS/projectile 成為分析的條件分層維度**(不是雜訊) |
| 0-3 | 「ε(t) 是本 stage 新推導」 | ε(t) 語意、`eyeY=1.6`、hitbox 來源、peek 窗 `[t_visible, nextVisible.t)` **已被 TS 實作釘死**([trackingDerivation.ts](../../../../src/metrics/trackingDerivation.ts)、[detectionDerivation.ts](../../../../src/metrics/detectionDerivation.ts) + [analysis-tracking.md](../../../operational/analysis-tracking.md)/[analysis-t-detect.md](../../../operational/analysis-t-detect.md)) | **parity 由單向改雙向**(§2.4a,本計畫最重要的設計修正):既有構念 TS 為權威、Python 對表;新構念 Python 為權威、TS 對表 |
| 0-4 | 「與 WP-18/WP-22 並行、無熱區重疊」 | 兩者皆已交付;目前**無 active WP** | 零檔案競爭;唯一 open 的上游是 M13 手動回填(#32),**不阻塞** research 層 |

**兩項讀碼發現(影響 FR 定義)**:

- **schema 沒有 `kill`/`timeout` 事件**([schema.md](../../../operational/schema.md) events = visible/counter/ads/fire/hit)。草稿 FR-D6 的 `t_kill/timeout` 必須**推導**:hitscan → `fire.hit === true`;projectile → 以 `shotSeq` 關聯的 `hit` 事件;timeout → 窗內無命中。窗界必須沿用 TS 既有定義,不得另立。
- **`counter` 事件是條件性的**:[SimLoop.ts:73-76](../../../../src/loop/SimLoop.ts#L73-L76) 只在 `ev.down && !held(反向) && vx 反號` 時記錄 → 已停住才開槍的 peek **沒有 counter 事件**。故 Sync 族的缺事件是常態語意,必須是 `flag` 而非 NaN。t_release(原方向鍵放開)無事件,只能自 `ticks[].keys` 取(±1 tick = 7.8125ms)。

### 0.2 編號重編對照(GD-19)

| 草稿編號 | 採納後 | 目標 |
|---|---|---|
| WP-23 research-foundation | **WP-28** | research 地基(M14) |
| WP-24 coach-timeline | **WP-29** | 教練第一層 |
| WP-25 trajectory-metrics | **WP-30** | 軌跡診斷 |
| WP-26 advanced-diagnostics | **WP-31** | 進階診斷 |
| WP-27 dashboard-integration | **WP-32** | 晉升整合(M15) |
| M11 / M12 | **M14 / M15** | research 地基 / stage4 交付 |
| 驗收清單 D | 不變(`acceptance-stage-d.md`) | — |

> OQ 編號 **`OQ-S4-n` 保持不變**(草稿期已被引用,保留可追溯性);新增者續編 OQ-S4-7/8。

---

## 1. 需求(Requirements)

### 1.1 Functional Requirements

| # | 需求(系統必須…) | 映射 |
|---|---|---|
| FR-D1 | `research/` 四目錄制成立:`modules/{ingest,kinematics,segments,metrics}/` 各含 `algorithms/`(純函式,禁 plotting/print/file I/O)+ `notebooks/` + `tests/`;`shared/filters/`(SG/Butterworth) | WP-28 T1 |
| FR-D2 | schema v2 匯出 loader:JSON → meta/ticks/events(pandas),欄位/單位對表 [schema.md](../../../operational/schema.md),**含 stage5 additive 欄**(tick `ads`、`hit` 事件、`meta.weapon.ads/bullet`、`meta.targets.hitbox`、`meta.scene/display/session`);dt 均勻性檢查(128Hz、缺 tick 偵測);壞值/缺欄拋 field-path 錯誤 | WP-28 T1 |
| FR-D3 | 角運動學:由 `ticks[].aim`(rad)推導 ω(t)(deg/s,yaw 分量乘 cos(pitch))與 ε(t)(deg);ε(t) 的 `eyeY`/hitbox/窗界語意**逐項沿用** [analysis-tracking.md](../../../operational/analysis-tracking.md),零新定義;rad→deg 轉換為全 research 層唯一發生點 | WP-28 T2 |
| FR-D4 | **ε 層雙向 parity**:Python 對同一匯出算出的 `tAcquireMs`/`totPercent`/`rmsEpsilonDeg`/`medianEpsilonDeg`/`p95EpsilonDeg` 與 TS `deriveTrackingMetrics` 逐 presentation 相對誤差 ≤ 1e-9;閘門落在**既有 `test:ci`**(vitest 讀 Python 產出的 parity JSON) | WP-28 T2 |
| FR-D5 | submovement 分段:ω(t) 經 SG 平滑後切 `primary_flick` / `micro_adjustment`(演算法骨架移植 performance_analysis,閾值/單位重校並 pre-registered 凍結);合成 fixture 邊界誤差 ≤ 2 tick;真實資料附分段成功率與疊圖 | WP-28 T3 |
| FR-D6 | `per_segment_apply` 泛用逐段計算 + 逐 peek/逐段 quality `flags`(失敗是資料不是缺失值;fallback reason 全記錄且可枚舉) | WP-28 T4 |
| FR-D7 | 逐 peek 時間軸:每 peek 的 t_visible → t_counter → t_release → t_fire(首發 + 補槍)→ **t_hit/timeout(推導,§0.1)** 事件時間軸圖 + drill 級摘要表;**窗界 = `[t_visible, nextVisible.t)`**(末筆 +∞,與 TS 同義) | WP-29 T1 |
| FR-D8 | 時間軸交叉驗證:同一匯出上,Python 重算的 `counterReactionMs`/`fireTimingAlignmentMs`/`firstShotHitRate` 與 [compute.ts](../../../../src/metrics/compute.ts) 相對誤差 ≤ 1e-9;不一致即 bug 或語意分歧,須入 [DECISIONS.md](../../DECISIONS.md) | WP-29 T1 |
| FR-D9 | Release-to-Click Sync 族:`t_fire − t_release(原方向鍵)`(自 `ticks[].keys`,±1 tick)、counter 鍵持續時間、`t_fire − t_counter`(對表既有指標);缺事件 peek 標 flag 不進聚合;附**量化精度評估報告** | WP-29 T2 |
| FR-D10 | (選配,gated)`DataRecorder` 增 `key` 事件(down/up,input `timeStamp`):**僅當** T2 精度評估依 §2.4d 判準判定不足;additive schema v2 optional 欄、data 層改動、sim 零侵入、既有決定性 baseline 零重錄 | WP-29 T3 |
| FR-D11 | REC/MR/V phase 分解:每 peek 切反應期/主運動期/驗證期(Butterworth 零相位邊界偵測,參數校 128Hz);輸出三段時長 + peak ω + flags;REC 邊界與 t_detect 推導([analysis-t-detect.md](../../../operational/analysis-t-detect.md))一致性檢查 | WP-30 T1 |
| FR-D12 | L/R 101 點正規化曲線:每 peek `[t_visible, t_firstShot]`(OQ-S4-5)重採樣 101 點,ω(t)/ε(t) 逐 side 平均曲線 + 分佈帶 + L/R 疊圖,圖上顯示 n(L)/n(R) | WP-30 T2 |
| FR-D13 | SPARC:逐 `primary_flick`(20Hz cutoff;fs=128 相容性斷言);與 performance_analysis Python 實作 golden 對表(同輸入同輸出,≤1e-9) | WP-31 T1 |
| FR-D14 | Key-Velocity Coupling:signed A/D key state(自 `ticks[].keys`)vs ω(t) 的 lagged xcorr(peak lag/strength + correlogram);**內建構念驗證 gate**(split-half reliability + shuffle baseline),未達標 → 標研究向、不進教練報告 | WP-31 T2 |
| FR-D15 | Fitts ID/MT/TP:ID = log₂(1 + D/W)(D = spawn 偏心角,自 `visible.targetX/Y/Z` + aim@spawn;W = 目標角尺寸,自 `meta.targets.hitbox`);MT = t_firstShot − t_visible;D 變異不足時輸出明確 `blocked-by-data` 判定 | WP-31 T3 |
| FR-D16 | 教練報告管線:單一 drill 匯出 → 一鍵產出靜態報告(時間軸 + sync + phase + L/R 曲線 + 通過 gate 的 P2 指標),含每指標 n、quality flags 與參數版本 metadata;**條件分層可切**(ads on/off、hitscan/projectile、scene、解析度) | WP-29/30/31 T-exit 累積 |
| FR-D17 | 晉升機制:選定指標由 Python 產 golden fixtures → `src/metrics/` TS 實作 + table-driven 對表(≤1e-9);結果頁擴充(純 TS + DOM,D1);**統計 = 匯出**不變式維持 | WP-32 T1/T2 |

### 1.2 Non-functional Requirements

| 類別 | 量化需求 |
|---|---|
| 效度 | 每個進教練報告的指標:合成 fixture 測試 + 真實資料檢核 + 已知限制記錄三者齊;新構念(P2)過 reliability gate 才可對選手解讀 |
| 決定性 | research 層唯讀消費匯出,引擎決定性 baseline 零影響;WP-29 T3(若觸發)與 WP-32 走既有 additive schema 政策(stage3 §2.5),**不 bump `schemaVersion`、不重錄任何 golden** |
| 可重現 | 分析參數(SG window、分段閾值、Butterworth cutoff、gate 門檻)全部設定常數 + 版本字串寫入報告 metadata;同一匯出 + 同參數 → 同報告(圖檔除外) |
| 純度 | `algorithms/` 零副作用:測試斷言 import 後無檔案寫入、無 matplotlib import;繪圖與 I/O 只在 `notebooks/` |
| 單位 | 角度 deg、時間 ms(量測時鐘域)、速度 u/s——對齊 CONTEXT 正規單位;rad→deg 只在 kinematics 層一處 |
| 工具鏈 | `uv run pytest` 全綠為 research 閘;engine `npm run test:ci` **不引入 Python 相依**(OQ-S4-7 ✅) |
| Fixture 體積 | 真實匯出 fixture ≤ 30s drill(≈3840 ticks)、`participantId` 匿名化後才可進 repo(OQ-S4-8 ✅) |

### 1.3 Constraints(硬約束;WP-28 T0 回寫 CLAUDE.md §4)

- 沿用 [CLAUDE.md §4](../../../../CLAUDE.md) 全部既有硬約束(不逐條重抄);本 stage 特別相關:GD-11 FPSci 紅線、統計 = 匯出、sim 熱路徑零侵入、禁 `Date.now()`(量測時鐘域 = `performance.now()`)。
- **C-D1**:`research/` ↔ `src/` **單向隔離** — research 只讀匯出 JSON/CSV 與 golden fixture,**不得 import 任何 TS 模組**;`src/` 不得 import Python 產物(唯一例外 = committed golden/parity JSON fixture)。
- **C-D2**:`algorithms/` 純函式紀律(禁 matplotlib/print/file I/O;繪圖與 I/O 落 `notebooks/`)。
- **C-D3**:**教練報告紅線** — 未通過構念驗證(reliability gate)的指標不得進教練報告;寧可少一個指標,不能有一個會說錯話的指標。
- **C-D4**:**既有構念不得有第二定義** — ε(t)/on-target/t_acquire/t_detect/peek 窗界以 `docs/operational/analysis-*.md` + `src/metrics/` TS 實作為權威;Python 側任何差異視為 bug,或屬須入帳的語意分歧(不得靜默各算一套)。

---

## 2. 系統設計(Technical Design)

### 2.1 System boundary

**In scope**:`research/`(新,全部)· `research/fixtures/`(匯出樣本 + parity/golden JSON)· `tests/golden/research/` + 對表 vitest(新,§2.4a)· `docs/operational/analysis-segments.md`(新,分段參數 registry)+ `acceptance-stage-d.md`(新,驗收清單 D)· `src/data/DataRecorder.ts` + [schema.md](../../../operational/schema.md)(**僅** WP-29 T3 觸發時,additive `key` 事件)· `src/metrics/` + 結果頁(**僅** WP-32)。

**Out of scope**(防蔓延,各附觸發條件):

- **LDJ-V**:觸發 = SPARC 上線後需要第二平滑度指標交叉驗證(需先解 128Hz 頻帶限制:jerk 二階微分放大高頻噪音,須共同頻帶低通)。
- **velocity scaling 回歸**(peak ω vs D):觸發 = 偵測/移動 drill 累積跨 D 範圍資料量(每條件 n ≥ 5 primary_flick 且 D 變異跨 ≥ 2 倍)。
- **RawInputTrace + schema v3、瀏覽器輸入保真度 bench、polling rate(1k/2k/4k/8k)實驗**:儀器研究,唯一需要動輸入/匯出鏈的項目;觸發 = 明確硬體研究委託 → 另立 stage/WP(先跑保真度 spike,以 performance_analysis 原生採集為 ground-truth 交叉驗證)。
- **即時(drill 中)指標回饋**:本 stage 全部離線;觸發 = 教練工作流需要 drill 中介入。
- **移動目標(F5)追蹤指標的 drill 面整合**:屬 WP-18/WP-23(已交付);research 只複用 ε(t) 演算法,不搶跑整合。
- **跨 session / 跨選手縱貫資料庫**:觸發 = pilot 後累積 ≥ 3 session 或 ≥ 3 選手;本 stage 以 `meta.session` 離線串接即可。

### 2.2 資料流

```mermaid
graph LR
  subgraph engine["引擎(既有,零改動;例外 = WP-29 T3 gated)"]
    EXP["schema v2 匯出 JSON<br/>meta / ticks(aim,keys,ads) / events(visible,counter,fire,hit)"]
    TSD["src/metrics 既有推導<br/>tracking / detection / lead / compute"]
  end
  subgraph research["research/(新,Python 離線)"]
    ING["ingest: load_export + dt/欄位檢查"] --> KIN["kinematics: ω(t), ε(t)(rad→deg 唯一點)"]
    KIN --> SEG["segments: SG + primary_flick/micro_adjustment"]
    SEG --> PSA["per_segment_apply + quality flags"]
    ING --> TL["peek 窗重建 → 時間軸 + Sync 族"]
    PSA --> MET["phase / 101pt / SPARC / xcorr / Fitts"]
    TL --> RPT["教練報告(單 drill 一鍵,條件可分層)"]
    MET --> RPT
    KIN --> PAR["parity JSON(ε 層)"]
    MET --> GOLD["golden JSON(新指標)"]
  end
  subgraph gate["對表閘(vitest,在既有 test:ci 內)"]
    PAR --> V1["ε parity test:Python 值 vs deriveTrackingMetrics"]
    GOLD --> V2["晉升指標 table-driven test"]
  end
  EXP --> ING
  TSD --> V1
  V2 --> TSM["src/metrics 新實作"] --> DASH["MetricsDashboard 結果頁"]
```

### 2.3 research/ 目錄形狀(學 performance_analysis `research/framework.md`)

```
research/
├── pyproject.toml            # Python 3.12(uv 管理);numpy/pandas/scipy/pytest
├── README.md                 # 閘門指令(uv run pytest)+ 參數 registry 連結 + fixture 體積上限
├── fixtures/
│   ├── exports/              # 真實匯出樣本(≤30s、匿名)+ 合成匯出(產生器輸出)
│   ├── parity/               # ε 層 parity JSON(Python 產 → vitest 讀)
│   └── golden/               # 晉升指標 golden(Python 產 → vitest 讀)
└── src/
    ├── modules/
    │   ├── ingest/           # loader、schema 對表、dt/品質檢查、合成匯出產生器
    │   ├── kinematics/       # ω(t)、ε(t)、rad→deg(唯一轉換點)
    │   ├── segments/         # SG 平滑、submovement 分段、per_segment_apply
    │   └── metrics/          # 時間軸、sync、phase、101pt、SPARC、xcorr、fitts
    │       └── (各模組:algorithms/ + algorithms/tests/ + notebooks/<task>/outputs/)
    ├── report/               # 教練報告組裝(notebook → 靜態 HTML)
    └── shared/filters/       # sg_filter、butter_filter(移植)
```

### 2.4 關鍵設計決策

#### (a) parity 雙向、單一機制、閘門落在既有 CI(對草稿的最重要修正)

草稿只規劃「Python 研究 → TS 生產」單向 golden。但 ε(t)/on-target/t_acquire/t_detect/peek 窗界**已有 TS 權威實作**;若 Python 各算一套,stage4 每一條逐段指標都建在未對表的 ε 上,M14 綠燈也是假的。

| 方向 | 權威 | 產出 | 消費 | 閘 |
|---|---|---|---|---|
| **TS → Python**(既有構念) | `src/metrics/*Derivation.ts` + `analysis-*.md` | Python 算出 `research/fixtures/parity/*.json`(逐 presentation:`tAcquireMs`/`totPercent`/`rmsEpsilonDeg`/`medianEpsilonDeg`/`p95EpsilonDeg`) | `tests/golden/research/*.test.ts` 對同一匯出跑 `deriveTrackingMetrics` 比對 ≤1e-9 | **既有 `test:ci`** |
| **Python → TS**(新構念,WP-32) | `research/src/modules/metrics/` | `research/fixtures/golden/*.json`(輸入匯出片段 + 期望值) | `src/metrics/` 新實作 table-driven vitest | **既有 `test:ci`** |

刻意的副作用:對表面 = TS **既有公開輸出**([`TrackingPresentationDerivation`](../../../../src/metrics/trackingDerivation.ts) 已含 t_acquire/TOT%/RMS/median/p95),**不為對表新增任何 TS API**;per-tick ε 序列由合成幾何 fixture(已知答案)另行釘死。Python 值以 committed fixture 進 repo → engine CI 不需要 Python(OQ-S4-7),但跨語言漂移仍會讓 `test:ci` 紅。

#### (b) 既有構念零重定義(C-D4)

peek 窗 = `[t_visible, nextVisible.t)`(末筆 +∞)、`eyeY = 1.6`、hitbox 取 `meta.targets.hitbox`(缺 → H1 `{1,2,1}`)、ε = aim 前向與目標中心的無號夾角 — 全部照抄 spec,不重推。

#### (c) 條件分層是一等公民

stage5 之後同一 drill 可能帶 ads on/off × hitscan/projectile × scene × 解析度。ingest 一律把這些欄帶進 peek 級索引,報告支援 `group_by`;**分段/phase 參數不得隨條件切換**(否則跨條件不可比)。

#### (d) t_release 精度先走 tick 量化 + 明文升級判準

`ticks[].keys` → ±7.8125ms;`counter` 事件是 input timeStamp(sub-tick)故 `t_fire − t_counter` 高精度。WP-29 T2 精度評估給明確判定,**判準 pre-registered**:量化誤差 SD ≥ 指標樣本 SD 的 1/3 即判定不足 → 觸發 T3 additive `key` 事件。

#### (e) 演算法與 performance_analysis 的差異點

| 項目 | performance_analysis | 本專案(stage4) |
|---|---|---|
| 訊號源 | raw mouse counts(px),~1kHz 非等間隔 QPC | `ticks[].aim`(rad→deg),128Hz 均勻 → **免重採樣、免對時** |
| 速度定義 | speed_px_s(SG 平滑) | ω(t) deg/s:`√((Δyaw·cos(pitch))² + Δpitch²)/Δt` |
| 分段閾值 | peak = max(mean+0.5σ, 200 px/s);邊界 0.1×/0.2× peak | 骨架相同;數值於 T3 以合成 fixture + 真實資料重掃(OQ-S4-2)後**凍結** |
| SG 參數 | Go w=7/p=3(高頻) | 128Hz 下重掃(w=7 ≈ 55ms 為起點候選) |
| 鍵盤源 | keyboardTrace(µs, wallclock 對時) | `ticks[].keys`(±1 tick 量化)+ `counter` 事件(input timeStamp);不足 → WP-29 T3 |
| 時鐘對齊 | fusion 模組(MAE ≈ 0.6ms) | 不需要(單一量測時鐘域) |

### 2.5 Interface contracts(關鍵簽名)

```python
# research/src/modules/ingest/algorithms/loader.py
@dataclass(frozen=True)
class Export:
    meta: dict                    # schemaVersion 必為 2;additive 欄缺席 = 該功能未啟用
    ticks: pd.DataFrame           # t, vx, vz, px, pz, tx, ty, tz, yaw, pitch, keys(list[str]), ads
    events: pd.DataFrame          # type, t, + 各 variant 稀疏欄(shotSeq/hit/firstShot/...)
    source_path: Path

def load_export(path: Path) -> Export: ...
    # raises SchemaError(field_path=...) 於缺必填欄 / 非有限值 / schemaVersion != 2

@dataclass(frozen=True)
class DtReport:
    tick_count: int; median_dt_ms: float; expected_dt_ms: float
    gap_count: int; gaps: list[tuple[int, float]]; uniform: bool

def check_dt(ticks: pd.DataFrame, sim_hz: int = 128) -> DtReport: ...

# research/src/modules/ingest/algorithms/synthetic.py(T1;決定性,無時鐘無隨機或 seeded)
def make_synthetic_export(spec: SyntheticSpec) -> dict: ...   # schema-faithful v2 payload

# research/src/modules/kinematics/algorithms/angular.py
def omega_deg_s(ticks: pd.DataFrame) -> np.ndarray: ...        # len == len(ticks);[0] = nan
def epsilon_deg(ticks: pd.DataFrame, meta: dict, eye_height: float = 1.6) -> np.ndarray: ...
def on_target(ticks: pd.DataFrame, meta: dict, eye_height: float = 1.6) -> np.ndarray: ...  # bool

# research/src/modules/segments/algorithms/submovement.py
@dataclass(frozen=True)
class SegmentParams:                     # pre-registered;凍結後只能改 version
    sg_window: int; sg_poly: int
    peak_sigma_k: float; peak_floor_deg_s: float
    low_ratio: float; stop_ratio: float
    version: str

@dataclass(frozen=True)
class Segment:
    kind: Literal['primary_flick', 'micro_adjustment']
    start_idx: int; end_idx: int; peak_omega: float; flags: tuple[str, ...]

def segment_submovements(omega: np.ndarray, params: SegmentParams) -> list[Segment]: ...
def per_segment_apply(segments: Sequence[Segment], fn: Callable[[Segment], dict]) -> pd.DataFrame: ...
    # 每列必含 flags;fn 拋錯 → flags += ('compute_failed:<reason>',),不吞成 NaN

# research/src/modules/metrics/algorithms/peek.py
@dataclass(frozen=True)
class PeekWindow:
    index: int; target_id: str; side: Literal['L', 'R']
    t_visible: float; t_end: float                  # nextVisible.t 或 +inf(與 TS 同義)
    t_counter: float | None; counter_key: str | None
    t_release: float | None                         # 自 ticks.keys 推導,±1 tick
    fires: tuple[float, ...]; t_first_shot: float | None
    t_hit: float | None                             # fire.hit / hit 事件(shotSeq)推導
    outcome: Literal['hit', 'timeout', 'no_shot']
    ads: bool | None; flags: tuple[str, ...]

def build_peek_windows(export: Export) -> list[PeekWindow]: ...
def sync_metrics(peeks: Sequence[PeekWindow]) -> pd.DataFrame: ...   # 三個錨點差 + flags
def phase_decompose(peek: PeekWindow, omega: np.ndarray, ticks: pd.DataFrame,
                    params: PhaseParams) -> PhaseSample: ...          # rec/mr/v 時長 + peak_omega + flags
def normalize_101(values: np.ndarray, t: np.ndarray, t0: float, t1: float) -> np.ndarray: ...  # (101,)
def compute_sparc(omega_seg: np.ndarray, fs: float = 128.0, cutoff_hz: float = 20.0) -> float: ...
def key_velocity_xcorr(key_state: np.ndarray, omega: np.ndarray,
                       max_lag_ticks: int) -> XcorrResult: ...        # peak_lag, peak_r, correlogram
def reliability_gate(samples: Sequence[XcorrResult],
                     thresholds: GateThresholds) -> GateVerdict: ...  # 'coach_report' | 'research_only'
def fitts_samples(peeks: Sequence[PeekWindow], export: Export) -> FittsResult: ...  # 'ok' | 'blocked-by-data'
```

```ts
// src/metrics/researchMetrics.ts(WP-32 T1;新檔,純函式,消費 ExportPayload)
export interface PromotedMetrics { /* phase 時長統計 + sync 統計 + L/R 101pt 縮圖資料 */ }
export function computePromotedMetrics(payload: ExportPayload): PromotedMetrics;
// 對表:tests/golden/research/promoted-metrics.test.ts 讀 research/fixtures/golden/*.json,容差 1e-9
```

### 2.6 Failure modes

| 觸發條件 | 影響 | 處理策略 |
|---|---|---|
| **Python ε(t) 與 TS 不一致**(座標慣例/窗界/hitbox fallback) | 全部逐段指標建在錯誤地基,M14 假綠 | FR-D4 parity 為 WP-28 T2 DoD 首項;不一致 → 先修 Python,若屬 spec 分歧則入 DECISIONS 後才續 |
| 分段閾值在 128Hz/deg/s 下不穩(碎段/漏段) | 全部逐段指標失真 | 合成 fixture 釘死已知邊界;真實資料掃參 + 疊圖人工檢核為 T3 DoD;fallback = 加大 SG window / 雙門檻遲滯;參數凍結 + version 字串 |
| **無真實匯出樣本** | WP-28 T1 之後真實資料項全 blocked | T1 交付**合成匯出產生器**解鎖演算法與 parity;真實資料四項標為 M14 阻塞項,樣本到位後補跑 |
| t_release ±1 tick 量化吃掉 Sync 族效應 | P1-2 指標解析度不足 | T2 內建精度評估 + §2.4d pre-registered 判準 → 觸發 T3 additive key 事件(data 層,零 sim 侵入) |
| xcorr 構念不可靠(128Hz + 階段 A 二元速度) | 對選手講錯故事 | reliability gate 為 T2 DoD;未達標明確標「研究向」,不進教練報告(C-D3) |
| Python/TS 雙實作漂移 | dashboard 數字 ≠ 研究數字 | 雙向 golden 皆在 `test:ci` 內;任一端改動 CI 立即紅 |
| Python 閘在 engine CI 之外 → 靜默腐化 | research 測試長期紅而無人知 | `research/README.md` 明列 `uv run pytest`;每 task DoD 貼 pytest 輸出;M15 需雙閘證據 |
| 匯出 fixture 過大進 repo | repo 膨脹、diff 不可讀 | ≤30s 截斷 + 合成 fixture 優先;上限寫入 `research/README.md` |
| 單 drill peek 數少(n ~ 數十) | 聚合統計不穩 | 報告一律顯示 n + 分佈(非只均值);跨 session 聚合靠 `meta.session`(WP-20 已交付)離線串接 |
| Butterworth cutoff ≥ Nyquist 等退化輸入 | crash 或靜默錯值 | 退化情境走 fallback + flag(不 crash)為 WP-30 T1 DoD |
| ε(t) 需要 camera 位置(eye height) | 推導錯 → ε 系統性偏移 | `eyeY` 沿用 spec 常數 1.6,ingest 對表 meta;合成 fixture 含已知幾何驗證 |

### 2.7 Concurrency model

**N/A(單程序批次)**。research 層為單執行緒批次腳本:`algorithms/` 純函式、無共享可變狀態、無背景執行緒、無 cancellation 語意。若日後跨 drill 批量分析需並行,只能以 process pool 對純函式 fan-out(out of scope,觸發 = 單批 > 50 匯出)。引擎側零併發變更(單 rAF 超級迴圈不變,ADR-2)。

---

## 3. WP 索引(⬜ 未開始 · 🟡 進行中 · ✅ 完成)

> 每 WP 一個自足子資料夾(`README.md` + `task-checklist.md` + `progress.md` + `T0` → `Tn` → `T-exit`)。編號分配見 GD-19。

| WP | 子資料夾 | 目標 | 優先序 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|---|
| **WP-28** | [wp-28-research-foundation/](wp-28-research-foundation/README.md) | research 地基:scaffold + ingest + 角運動學(**含 ε parity**)+ submovement 分段 + quality flags + 一鍵 pipeline | P0-2 | **M14 🟡** | M4 ✅ + WP-16 ✅ + M11/M12 ✅ | 3.5–4.5 | 🟡 **task 全數完成,但 M14 ② 於 2026-08-05 撤回**(KI-004);①③④⑤⑥ 維持 |
| **WP-29** | [wp-29-coach-timeline/](wp-29-coach-timeline/README.md) | 教練第一層:逐 peek 時間軸(交叉驗證 compute.ts)+ Release-to-Click Sync 族(+ 選配 key 事件) | P0-1 + P1-2 | — | WP-28 **T1**(僅 ingest) | 1.5–2.5 | 🟡 **T0 entry gate ✅(2026-08-05)** |
| **WP-30** | `wp-30-trajectory-metrics/` | 軌跡診斷:REC/MR/V phase 分解 + L/R 101 點曲線 | P1-1 + P1-3 | — | **M14** | 2–3 | ⬜ |
| **WP-31** | `wp-31-advanced-diagnostics/` | 進階診斷:SPARC + Key-Velocity xcorr(reliability gate)+ Fitts | P2 | — | **M14** | 2–3 | ⬜ |
| **WP-32** | `wp-32-dashboard-integration/` | 晉升整合:golden parity → TS metrics + 結果頁擴充 + 驗收清單 D | — | **M15** | WP-29 + WP-30(WP-31 選項) | 2–3 | ⬜ |

---

## 4. 里程碑門控

| 里程碑 | 完成條件(可機械判定) | 對應 WP | 意義 |
|---|---|---|---|
| **M14 🟡 (② 撤回,2026-08-05)** | ① ✅ 真實匯出 ingest/dt:3,507 ticks / 7.8125ms / gap 0 ② ❌ **撤回** —— ε parity 機制仍綠(Python 與 TS 逐位一致),但兩側**一致地錯**:量測原點遺漏 camera base offset(D2a)與 `SIM_TO_WORLD`(D2b),對引擎 `fire.offsetDeg` 實測偏差 12.52°(08:03)/ 67.11°(09:39),見 [KI-004](../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) ③ ✅ 合成邊界 max error 1 tick ④ ✅ 真實 `seg-v1`:19/20(0.95)+20 張疊圖 ⑤ ✅ pre-registered 參數保留且人工檢核/限制已記 `analysis-segments.md` ⑥ ✅ `uv run pytest`:74 passed | WP-28 | ③④⑤ 的分段地基走 ω(t)(只依賴 `aim`),**不受 KI-004 影響**;ε 地基未成立 → **WP-30/31 entry blocker 恢復**,待 KI-004 S1 落地 + ② 重新宣告 |
| **M15** | 驗收清單 D 全項通過:教練報告一鍵產出(FR-D16)、晉升指標 TS golden 對表綠、`test:ci` exit 0 **且** `uv run pytest` 綠、每指標附效度證據(fixture + 真實檢核 + 限制)、P2 三指標各有明確進退判定 | WP-32 | **stage4 交付**:瞄準 × 急停教練分析管線 pilot-ready |

---

## 5. 相依圖(關鍵路徑)

```
                     ┌─(T1 ingest 綠即可)─→ WP-29(時間軸 + Sync,P0-1/P1-2)──┐
WP-28(地基,M14)──┤                                                          ├→ WP-32(晉升整合,M15)= stage4 交付
                     ├─(M14 過後)─────────→ WP-30(phase + 101pt 曲線,P1)────┤
                     └─(M14 過後)─────────→ WP-31(SPARC/xcorr/Fitts,P2)─────┘
                                                    (WP-31 為 M15 選項:未過 reliability gate 的指標不晉升)
```

- **最短價值路徑 = WP-28 T1 → WP-29 T1/T2**:教練最快拿到逐 peek 時間軸與 sync(兩者只吃 ingest 與 events,不吃分段)。
- **M14 ② 已於 2026-08-05 撤回**([KI-004](../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md) / K-2)→ **WP-30/31 entry blocker 恢復**,須待 KI-004 S1 落地並重新宣告 ② 後才可展開;`seg-v1` 與單樣本效度限制的引用要求不變。**WP-29 不受影響**(只吃 `events` 與 `ticks[].keys`,不碰 `px/pz`),為目前唯一可展開的 WP。
- WP-31 三個 task 互不相依,可依資料就緒度亂序執行(Fitts 等偵測 drill 資料;xcorr 等 reliability 判定)。
- 目前**無 active WP**,零檔案熱區競爭。

---

## 6. 任務拆解(採納後每 task 展開自足檔:Steps / DoD / Commit)

### WP-28 research-foundation(P0-2 → M14;3.5–4.5d)

| Task | Scope | Definition of Done | Risk |
|---|---|---|---|
| **T0 entry-gate** | ① OQ-S4-1/7/8 拍板落地(已由使用者確認,記證據)② C-D1~C-D4 回寫 CLAUDE.md §4 ③ GD-19/GD-20 入帳確認 ④ 真實匯出樣本狀態記錄(未取得 → 記 M14 阻塞項 + 合成產生器替代方案) | `uv run pytest` 空跑綠(pyproject 可解析);CLAUDE.md 四條硬約束 commit;樣本狀態與阻塞項記 progress | Low |
| **T1 scaffold + ingest** | `research/` 四目錄制 + pyproject(uv);`load_export` → meta/ticks/events;欄位/單位對表 schema.md **含 stage5 additive 欄**;`check_dt`;**合成匯出產生器**(schema-faithful、決定性) | 合成匯出 round-trip 綠;缺欄/非有限值/`schemaVersion!=2` fixture 各拋 field-path 錯誤;dt 報告含 tick 數/缺口/中位間隔;`algorithms/` 純度測試綠(無 I/O、無 matplotlib import);真實匯出 round-trip 標 M14 阻塞項 | Low |
| **T2 angular kinematics + ε parity** | `omega_deg_s`/`epsilon_deg`/`on_target`(rad→deg 唯一點;`eyeY`/hitbox 由 meta 解析);產 `fixtures/parity/*.json`;新增 `tests/golden/research/epsilon-parity.test.ts` | ① ω 合成 fixture(常數角速度/純 yaw/純 pitch/高 pitch 邊界)相對誤差 ≤ 1e-6 ② ε 已知幾何 fixture 綠 ③ **parity test 在 `npm run test:ci` 內綠,逐 presentation 五個量 ≤1e-9** ④ 差異若源於 spec 分歧 → DECISIONS 入帳後才算 PASS | **High** |
| **T3 SG + submovement 分段** | 移植分段骨架(peak 偵測 + low/stop 邊界);SG window/閾值以合成 fixture + 真實資料掃參(OQ-S4-2);分段疊圖 notebook | 合成 fixture(已知 primary/micro 邊界)誤差 ≤ 2 tick;真實 drill 分段成功率報告 + 疊圖產出(**樣本到位後**);掃參證據記 progress;`SegmentParams` 落設定常數 + `version` | **High** |
| **T4 per_segment_apply + flags** | 泛用逐段 map;逐 peek/逐段 `flags` 全 fallback reason 可枚舉 | 單元測試綠(空段/單樣本/NaN 注入/fn 拋錯 → flag 不吞成 NaN);下游任一指標輸出皆含 flags 欄 | Low |
| **T-exit(M14)** | 全鏈驗證 + 文件 | `uv run pytest` 全綠 + `npm run test:ci` exit 0;「匯出 → 分段 + 品質報告」一鍵 script 綠;分段參數/限制記 `docs/operational/analysis-segments.md`;M14 六項證據齊(§4) | — |

### WP-29 coach-timeline(P0-1 + P1-2;1.5–2.5d)

| Task | Scope | Definition of Done | Risk |
|---|---|---|---|
| **T0 entry-gate** | 驗 WP-28 T1 exit;記錄 `compute.ts` 交叉驗證基準清單與其**條件性語意**(counter 事件缺席場景) | ingest 綠;基準清單 + 語意註記記 progress | Low |
| **T1 逐 peek 時間軸** | `build_peek_windows`(窗界沿用 TS;t_hit/timeout 由 `fire.hit`/`hit` 事件推導);每 peek 時間軸圖 + drill 摘要表 | ① 重算 `counterReactionMs`/`fireTimingAlignmentMs`/`firstShotHitRate` 與 `compute.ts` 相對誤差 ≤ 1e-9(不一致 → bug 或語意分歧須入 DECISIONS)② ≥1 drill 全 peek 時間軸產出 ③ `outcome` 分類單元測試綠 | Med |
| **T2 Sync 族 + 精度評估** | `t_fire − t_release`(ticks.keys)、counter 持續時間、`t_fire − t_counter`;缺事件標 flag 不進聚合;量化精度評估 | 單元測試(正常/缺 release/缺 counter/亂序 fixture)綠;精度評估報告依 §2.4d 判準給出**明確判定**(觸發 T3 或不觸發 + 理由) | Med |
| **T3(選配,gated)key 事件** | **僅當 T2 判定不足**:`DataRecorder` 增 `key` 事件(down/up + input timeStamp);additive v2 optional;schema.md 對帳 | 既有決定性 baseline 綠(**零重錄**);新事件 vitest 綠;schema.md 更新;未觸發則記 skipped + 判定證據 | Med |
| **T-exit** | 教練報告 v0(時間軸 + sync,含條件分層) | 一鍵 script 綠;報告含每指標 n + flags + 參數版本;範例報告存 `notebooks/*/outputs/` | — |

### WP-30 trajectory-metrics(P1;entry = M14;2–3d)

| Task | Scope | Definition of Done | Risk |
|---|---|---|---|
| **T0 entry-gate** | 驗 M14 六項;t_detect 推導參數(θ_v/k)對表 [analysis-t-detect.md](../../../operational/analysis-t-detect.md) | M14 證據確認記 progress;t_detect 參數引用記錄 | Low |
| **T1 REC/MR/V phase** | Butterworth 零相位邊界偵測(參數校 128Hz);每 peek rec/mr/v 時長 + peak ω + flags;REC-end vs t_detect 一致性檢查 | 合成 fixture 相位邊界誤差 ≤ 2 tick;真實資料 phase 分佈報告;REC-end 與 t_detect 差異分佈報告(系統性分歧 → 記 OQ);cutoff ≥ Nyquist 等退化走 fallback + flag(不 crash) | Med |
| **T2 L/R 101 點曲線** | `[t_visible, t_firstShot]`(OQ-S4-5)重採樣 101 點;ω(t)/ε(t) 逐 side 平均 + 分佈帶 + 疊圖 | 插值單元測試(<2 樣本/全零/缺值/端點重合)綠;≥1 真實 drill L/R 曲線圖產出且圖上顯示 n(L)/n(R) | Low |
| **T-exit** | phase + 曲線併入報告 v1 | 報告 v1 一鍵綠;新增段落含解讀指引(哪段長 → 練什麼);`uv run pytest` 綠 | — |

### WP-31 advanced-diagnostics(P2;entry = M14;2–3d)

| Task | Scope | Definition of Done | Risk |
|---|---|---|---|
| **T0 entry-gate** | 驗 M14;reliability gate 門檻拍板並 **pre-register 凍結**(OQ-S4-3) | gate 門檻數值 + 凍結時點記 progress(事後不得調整) | Low |
| **T1 SPARC** | 移植 `compute_sparc`(20Hz cutoff、fs=128 相容斷言);逐 primary_flick;對表 performance_analysis 實作 | golden(同輸入同輸出 ≤1e-9)綠;真實資料分佈報告;退化輸入(<16 樣本)回傳語意與 performance_analysis 一致 | Med |
| **T2 Key-Velocity xcorr** | signed A/D state vs ω(t);per-window peak lag/strength + correlogram;split-half + shuffle baseline | 單元測試綠(含已知相位差合成訊號 → 已知 lag);gate 報告產出並給**明確判定**(進教練報告 / 研究向);判定與證據記 progress | Med |
| **T3 Fitts** | D = spawn 偏心角(`visible.targetX/Y/Z` + aim@spawn)、W = 目標角尺寸(`meta.targets.hitbox`);MT = t_firstShot − t_visible;逐 peek ID/MT → TP + 回歸診斷 | 已知幾何 fixture 綠;偵測 drill r² 報告;D 變異不足 → 輸出 `blocked-by-data`(不硬給結論) | Low |
| **T-exit** | 三指標效度判定收斂 | 每指標一份「進教練報告與否」判定 + 證據;通過者併入報告 v2 | — |

### WP-32 dashboard-integration(→ M15;entry = WP-29 + WP-30 exit;2–3d)

| Task | Scope | Definition of Done | Risk |
|---|---|---|---|
| **T0 entry-gate** | 晉升清單拍板(OQ-S4-4;預設 phase 時長統計 + sync 統計 + L/R 曲線縮圖);WP-31 通過項納入評估 | 晉升清單 + 納入/排除理由記 progress | Low |
| **T1 golden parity** | Python 產 `fixtures/golden/*.json` → `src/metrics/researchMetrics.ts` + table-driven vitest | TS 測試綠且對表 golden ≤1e-9;「任一端改動須重跑對表」紀律入 CLAUDE.md §4 | Med |
| **T2 結果頁擴充** | `MetricsDashboard` 增晉升指標區塊(純 TS + DOM,D1);「統計 = 匯出」不變式維持 | vitest 綠;既有 dashboard 測試零修改全綠;手動視覺確認項記 progress | Med |
| **T-exit(M15)** | 驗收清單 D 定稿 + 全項通過 | `test:ci` exit 0 + `uv run pytest` 綠;`acceptance-stage-d.md` 逐項證據連結;stage4 狀態翻 ✅ + exec-plan/README.md 對帳 + 移入 `completed/stage4/` | — |

---

## 7. 風險分析

| 風險 | 等級 | 說明與緩解 |
|---|---|---|
| **ε(t) 雙實作分裂**(Python vs 既有 TS) | **High** | 採納期加固:FR-D4 parity 為 WP-28 T2 DoD 首項、閘門在既有 `test:ci`、對表面用 TS 既有公開輸出(零新 TS API);分歧一律入帳不靜默 |
| 分段參數在 128Hz/deg/s 不穩 | **High** | M14 硬閘;合成 fixture 釘死 + 真實掃參 + 疊圖人工檢核;fallback = 遲滯雙門檻/加大 window;參數凍結 + version |
| 真實匯出樣本未到位 | Med | ✅ 2026-08-05 樣本到位;真實 ingest/dt、19/20 成功率與 20 張疊圖人工檢核完成,M14 阻塞解除;合成證據未被用來替代真實檢核 |
| t_release ±1 tick 量化不足 | Med | T2 精度評估 + pre-registered 判準(§2.4d)+ T3 additive 升級路徑(data 層,零 sim 侵入,不 bump schema) |
| xcorr 構念不可靠 | Med | reliability gate 前置(C-D3);最壞情況 = 降級研究向,不影響 P0/P1 交付 |
| Python 閘在 engine CI 之外 → 靜默腐化 | Med | 每 task DoD 貼 pytest 輸出;雙向 golden fixture 進 `test:ci`;M15 需雙閘證據 |
| 單 drill 樣本數少 | Med | 報告強制顯示 n + 分佈;跨 session 靠 `meta.session` 離線串接 |
| 範圍蔓延(研究向指標擠掉教練交付) | Med | §0.0 排序為 scope 憲法;P3 全 out of scope 附觸發條件;WP-31 為 M15 選項而非必要條件 |
| **Technical debt(有意識妥協)** | — | ① t_release 先走 tick 量化(觸發 = §2.4d 判準)② xcorr 在階段 A 二元速度下 vx 通道退化,只做 ω 通道(觸發 = 連續移動模型上線)③ SPARC/phase 參數為 pilot 前暫定(觸發 = pilot 後校準)④ Fitts 的 W 用單一 hitbox 角尺寸(頭/身分解沿 CONTEXT 既有延後)⑤ 教練報告為靜態 HTML(觸發 = 教練需互動篩選,OQ-S4-6) |

---

## 8. Open Questions

| # | 問題 | 建議 / 決議 | Owner | Deadline | 未決影響 |
|---|---|---|---|---|---|
| **OQ-S4-1** | research 層語言/工具鏈 | ✅ **決議(2026-08-04):Python 3.12 + uv + pyproject**(環境已驗:Python 3.12.10 / uv 0.9.18)。移植對象是 performance_analysis Python 實作,scipy 生態必要;TS 僅承接晉升後生產實作 | 使用者 | WP-28 T0 ✅ | unblocked |
| **OQ-S4-7** | Python 閘是否進 `npm run test:ci` | ✅ **決議(2026-08-04):不進**。`test:ci` 是每 stage 的引擎不變式閘,加 Python 相依會讓純引擎工作在無 uv 機器上卡住。改為:① `uv run pytest` 為 research 獨立閘 ② 雙向 golden/parity fixture 進 `test:ci`(跨語言漂移仍紅)③ M15 要求雙閘證據 | 使用者 | WP-28 T0 ✅ | unblocked |
| **OQ-S4-8** | 真實匯出 fixture 政策 | ✅ **關閉(2026-08-05)**:政策維持 ≤30s + 匿名 ID;27.390625s `counterstrafe_ad_v1`/`P001` 已進 `research/fixtures/exports/` 並完成 M14 ①④⑤ | 使用者 | 2026-08-05 | unblocked;M14 已宣告 |
| **OQ-S4-2** | 分段閾值 deg/s 起點(peak 門檻、low/stop 比例、SG window) | 骨架沿 performance_analysis(mean+0.5σ、0.1×/0.2× peak、w=7 起點);數值由 T3 掃參定,**pre-registered 記錄後凍結** | 研究者 | WP-28 T3 | M14 無法判定 |
| **OQ-S4-3** | reliability gate 門檻(split-half r、shuffle 顯著水準) | split-half r ≥ 0.7 + shuffle p < 0.01(T0 拍板凍結) | 研究者 | WP-31 T0 | P2 指標無法判定進退 |
| **OQ-S4-4** | 晉升 dashboard 的指標清單 | phase 時長統計 + sync 統計 + L/R 曲線縮圖(P0/P1 全數;P2 視 gate) | 使用者 | WP-32 T0 | WP-32 scope 不定 |
| **OQ-S4-5** | 101 點正規化窗口錨 | **`[t_visible, t_firstShot]`**(counter-strafe 錨定首發,CONTEXT §A;t_kill 版含補槍屬「清目標節奏」,留分析端副版) | 研究者 | WP-30 T2 | 曲線語意不定 |
| **OQ-S4-6** | 教練報告載體 | notebook → 靜態 HTML(單檔可寄送);觸發升級 = 教練需要互動篩選 | 使用者 | WP-29 T-exit | 報告形式不定 |
| ~~**OQ-S4-12**~~ | ~~缺「含真實 A/D strafe」的 counter-strafe 匯出~~ | ✅ **關閉(2026-08-05)**:09:39 匯出已補錄並進 `research/fixtures/exports/`(21.27s ≤30s、匿名 `P001`、PII-like 掃描無命中、counter 24、三個對表量各 n=20) | 使用者 | 2026-08-05 | unblocked；T2 可依 `sync-v1` 作實質判定 |
| **OQ-S4-10** | `t_release` 在無 counter 事件時的 fallback 是否足以支撐跨 peek 比較 | 先採窗內最後一次 A/D held→released + `release_inferred_no_counter` flag，聚合預設排除；09:39 樣本到位後於 T-exit 複核 | 研究者 | WP-29 T-exit | Sync 族分母與跨 peek 可比性仍待驗證 |
| **OQ-S4-11** | 兩份真實 fixture 皆無 `ads` 事件、皆為 hitscan | `--group-by` 仍須實作並以合成 fixture 驗證；真實報告明示條件分層只有單一 cell 有樣本 | 研究者 | WP-29 T-exit | 條件分層缺真實對照，但不阻塞實作 |

> parity 方向(既有構念 TS 權威、新構念 Python 權威)**不列為 OQ**:C-D4 已定為硬約束,理由是「同一構念兩個定義」本身即效度缺陷,無取捨空間。

---

## 9. 文件對帳清單

- [x] [DECISIONS.md](../../DECISIONS.md) **GD-19**(stage4 採納:WP-28~32/M14~M15/清單 D 重編 + research 層單向隔離 + parity 雙向與 CI 落點)入帳。(2026-08-04 本計畫)
- [x] [DECISIONS.md](../../DECISIONS.md) **GD-20**(教練報告 reliability gate 紅線 + P3 延遲決策與觸發條件)入帳。(2026-08-04 本計畫)
- [x] [exec-plan/README.md](../../README.md):§2 加階段 D 索引表;§3 加 M14–M15;§4 相依圖擴充;§6 目錄慣例。(2026-08-04 本計畫)
- [x] [docs/MAP.md](../../../MAP.md):§3 導航更新(stage4 已採納 + research 層入口)。(2026-08-04 本計畫)
- [x] [CLAUDE.md](../../../../CLAUDE.md) §4 硬約束追加 C-D1~C-D4(WP-28 T0,2026-08-04)。
- [ ] [CONTEXT.md](../../../../CONTEXT.md) 新術語(各 task 隨切片回寫):submovement 分段(primary_flick/micro_adjustment)、ω(t) 角速度、REC/MR/V phase、Release-to-Click Sync、101 點正規化曲線、reliability gate、parity fixture;§B 增 research 層元件列。
- [x] `docs/operational/analysis-segments.md`(新:`seg-v1` 參數 registry + flags 詞彙表 + 一鍵 pipeline 契約 + 已知限制;WP-28 T3 建立、T-exit 補齊,2026-08-04)。
- [ ] `docs/operational/acceptance-stage-d.md`(新,WP-32 T-exit:驗收清單 D)。
- [ ] 規格書版本對帳:新增「階段 D」節 + 附錄 E 增「驗收清單 D」(M15 前完成)。
- [ ] (WP-29 T3 若觸發)[schema.md](../../../operational/schema.md):`key` 事件 additive 對帳。

---

## 10. 執行規則

沿用 [exec-plan/README.md §5](../../README.md):一 task = 一垂直切片 = 一原子 commit;task 完成更新該 WP `progress.md` + checklist;跨 WP 先驗上游 exit-gate。**M14 已於 2026-08-05 通過,WP-30/31 可展開**;後續仍須引用 WP-28 的單樣本效度限制與 `seg-v1` version。WP 展開格式以 [`completed/stage5/wp-25-ballistics-tracer/`](../../completed/stage5/wp-25-ballistics-tracer/README.md) 為模板。Python 側紅綠燈證據(`uv run pytest` 輸出)比照 CI 紀律記 progress。
