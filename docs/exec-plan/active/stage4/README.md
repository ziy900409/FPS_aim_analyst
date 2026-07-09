# 階段 D(stage4)執行計畫【草稿】 — 選手表現分析管線(research 層:瞄準 × 急停診斷指標)

> stage4 頂層索引 + tech spec **草稿(2026-07-09 提案,未採納)**。整合輸入:performance_analysis repo 架構分析與移植評估(2026-07-09)+ 教練視角優先序排序(目標:更有效追蹤選手**瞄準**與**急停**表現)+ stage1–3 既有資料面(WP-16 schema v2、WP-21 偵測 drill、WP-8 `MetricsDashboard`)。
> 格式沿用 [exec-plan/README.md](../../README.md)(每 WP 一個自足子資料夾;task = 垂直切片 = 原子 commit)。文件語言:繁體中文,術語保留英文(D4)。
> **採納前不展開 WP 子資料夾、不動 exec-plan/README.md §2 索引**;採納時執行 §9 文件對帳清單。

| | |
|---|---|
| **交付範圍** | 離線分析 research 層(Python,四目錄制,學 performance_analysis):schema v2 匯出 → 角運動學/submovement 分段地基 → 教練診斷指標(逐 peek 時間軸、Release-to-Click Sync、REC/MR/V phase、L/R 101 點曲線)→ 進階診斷(SPARC、Key-Velocity Coupling、Fitts)→ 成熟指標以 golden parity 晉升 TS `MetricsDashboard` |
| **上游門檻** | M4 ✅(schema v2 匯出鏈)+ WP-16 ✅(v2 欄位);**引擎零改動**(例外:WP-24 T3 選配 key-event 記錄、WP-27 metrics/UI 層,皆不碰 sim);與 WP-18/WP-22 無檔案熱區重疊,可並行 |
| **技術棧** | 新增:Python 3.11+(pyproject;numpy/pandas/scipy;pytest)於 `research/`(OQ-S4-1)。既有 TS 棧僅 WP-27 觸及(`src/metrics/` + 結果頁 DOM) |
| **估時** | 10.5–15 dev-days(WP-23~27) |
| **狀態** | ⬜ **草稿,待採納**(採納 = 使用者確認 §0 排序 + OQ-S4-1 語言決策 → 執行 §9 對帳 → 展開 WP-23 子資料夾) |

---

## 0. 輸入現況:優先序決議 → WP 映射

> 排序原則(2026-07-09 教練視角評估):**一個指標的價值 = 它能不能改變下一週的訓練處方**。四個評估軸:教練決策價值 / 資料就緒度(schema v2 是否已有欄位)/ 演算法風險(移植已驗證 vs 新構念)/ 依賴關係。

| 優先序 | 項目 | 排序理由(一句話) | 落點 |
|---|---|---|---|
| **P0-1** | 逐 peek counter-strafe 時間軸 | 教練第一線是個案回放不是統計量;欄位全在 schema v2,成本趨近零 | WP-24 T1 |
| **P0-2** | 角運動學 ω(t) + submovement 分段 | 單點故障:沒有它,P1/P2 全部軌跡指標沒有立足點;唯一需要認真校參的地基 | WP-23 T2/T3 |
| **P1-1** | REC/MR/V phase 分解 | 回答「慢在哪一段」→ 直接分流訓練處方;與既定 t_detect(GD-8)/t_acquire(GD-7)構念對接,不發明新概念 | WP-25 T1 |
| **P1-2** | Release-to-Click Sync 指標族 | 急停的本質 =「鬆鍵→反向鍵→開槍」三元組時序;既有 `fireTimingAlignmentMs` 的錨點族補齊,成本極低 | WP-24 T2 |
| **P1-3** | L/R 條件化 101 點正規化曲線 | 把既有 L/R symmetry 標量升級成「動作簽名曲線」;performance_analysis 象限儀表板已證明教練價值的形式 | WP-25 T2 |
| **P2-1** | SPARC(逐段平滑度) | 疲勞/緊繃早期警訊,但是監控儀表不是處方箋;價值隨個人基線累積 | WP-26 T1 |
| **P2-2** | Key-Velocity Coupling xcorr(keys vs ω) | strafe-aim 干擾指標,最有原創價值但**構念未驗證**——先過 reliability gate 才能進教練報告 | WP-26 T2 |
| **P2-3** | Fitts ID/MT/TP | 方法學成熟但被 drill 多樣性 gate 住;WP-21 偵測 drill 的 seeded `spawnArea` 提供 D 變異後升值 | WP-26 T3 |
| **P3(backlog)** | LDJ-V、velocity scaling、RawInputTrace/schema v3、瀏覽器保真度 bench、polling rate 實驗 | 研究向/儀器向,不改變教練追蹤選手的能力;唯一動引擎的項目留給明確研究委託 | §2.1 out of scope(附觸發條件) |

**與 performance_analysis 的關係**(移植評估結論,2026-07-09):

- performance_analysis 的 fusion 模組在解「三時鐘域對齊」;本專案單一 `performance.now()` 時鐘 + 128Hz 均勻 tick,**該層成本歸零**,移植重心全在 analysis 演算法。
- 可移植:submovement 分段(閾值演算法)、SPARC、REC/MR/V phase、101 點正規化、Release-to-Click Sync、Key-Velocity xcorr、`per_segment_apply` 模式、四目錄制紀律(`algorithms/` 純函式 + `notebooks/` + `parity_generators/` + `tests/`)。
- **參數不可照搬**:px/s → deg/s(yaw 乘 cos(pitch));SG window 於 128Hz 重掃(performance_analysis Go 用 w=7/p=3 是高頻資料)。
- 授權:performance_analysis 為自有 repo,程式碼可移植;FPSci 紅線不變(GD-11,方法學可參考、程式碼不可抄)。

---

## 1. 需求(Requirements)

### 1.1 Functional Requirements

| # | 需求(系統必須…) | 映射 |
|---|---|---|
| FR-D1 | `research/` 四目錄制成立:`modules/{ingest,kinematics,segments,metrics}/` 各含 `algorithms/`(純函式,禁 plotting/print/file I/O)+ `notebooks/` + `tests/`;`shared/filters/`(SG/Butterworth) | WP-23 T1 |
| FR-D2 | schema v2 匯出 loader:JSON → ticks/events DataFrames,欄位/單位對表 [schema.md](../../../operational/schema.md);dt 均勻性檢查(128Hz、缺 tick 偵測);壞值/缺欄拋 field-path 錯誤 | WP-23 T1 |
| FR-D3 | 角運動學:由 `ticks[].aim`(rad)推導 ω(t)(deg/s,yaw 分量乘 cos(pitch))與 ε(t)(deg,語意 = CONTEXT §A 追蹤誤差,零新定義) | WP-23 T2 |
| FR-D4 | submovement 分段:ω(t) 經 SG 平滑後切 `primary_flick` / `micro_adjustment`(演算法骨架移植 performance_analysis,閾值/單位重校);合成 fixture 邊界誤差 ≤ 2 tick;真實資料附分段成功率與疊圖 | WP-23 T3 |
| FR-D5 | `per_segment_apply` 泛用逐段計算 + 逐 peek/逐段 quality `flags`(失敗是資料不是缺失值;fallback reason 全記錄) | WP-23 T4 |
| FR-D6 | 逐 peek 時間軸:每 peek 的 t_visible → t_counter → t_release → t_fire(首發 + 補槍)→ t_kill/timeout 事件時間軸圖 + drill 級摘要表;數值與 `compute.ts` 既有 `counterReactionMs`/`fireTimingAlignmentMs` 交叉一致 | WP-24 T1 |
| FR-D7 | Release-to-Click Sync 族:`t_fire − t_release(原方向鍵)`、counter 鍵持續時間、`t_fire − t_counter`(對表既有指標);t_release 自 `ticks[].keys` 推導(±1 tick 量化),精度評估報告隨附 | WP-24 T2 |
| FR-D8 | (選配,gated)DataRecorder 增 `key` 事件(down/up,input `timeStamp`):**僅當** T2 精度評估判定 ±1 tick 不足;additive schema v2 optional 欄、data 層改動、sim 零侵入 | WP-24 T3 |
| FR-D9 | REC/MR/V phase 分解:每 peek 切反應期/主運動期/驗證期(Butterworth 邊界偵測參數校 128Hz);REC 邊界與 t_detect 推導([analysis-t-detect.md](../../../operational/analysis-t-detect.md))一致性檢查 | WP-25 T1 |
| FR-D10 | L/R 101 點正規化曲線:每 peek [t_visible, t_firstShot] 重採樣 101 點,ω(t)/ε(t) 逐 side 平均曲線 + 分佈帶;L/R 疊圖 | WP-25 T2 |
| FR-D11 | SPARC:逐 primary_flick(20Hz cutoff;128Hz 取樣相容性斷言);與 performance_analysis Python 實作 golden 對表(同輸入同輸出) | WP-26 T1 |
| FR-D12 | Key-Velocity Coupling:signed A/D key state(自 `ticks[].keys`)vs ω(t) 的 lagged xcorr(peak lag/strength + correlogram);**內建構念驗證 gate**(split-half reliability + shuffle baseline),未達標 → 標研究向、不進教練報告 | WP-26 T2 |
| FR-D13 | Fitts ID/MT/TP:ID = log₂(1 + D/W)(D = spawn 偏心角、W = 目標角尺寸,皆由 DrillConfig/visible 事件推導);MT = t_firstShot − t_visible;D 變異不足時輸出明確 `blocked-by-data` 判定 | WP-26 T3 |
| FR-D14 | 教練報告管線:單一 drill 匯出 → 一鍵產出報告(時間軸 + sync + phase + L/R 曲線 + 通過驗證的 P2 指標),含每指標 n 與 quality flags | WP-24/25/26 T-exit 累積 |
| FR-D15 | 晉升機制:選定指標由 Python 產 golden fixtures → `src/metrics/` TS 實作 table-driven 對表;結果頁擴充(純 TS + DOM,D1);**統計 = 匯出**不變式維持 | WP-27 T1/T2 |

### 1.2 Non-functional Requirements

| 類別 | 量化需求 |
|---|---|
| 效度 | 每個進教練報告的指標:有合成 fixture 測試 + 真實資料檢核 + 已知限制記錄;新構念(P2)過 reliability gate 才可對選手解讀 |
| 決定性 | research 層唯讀消費匯出,引擎決定性 baseline 零影響;WP-24 T3(若觸發)與 WP-27 走既有 additive schema 政策(§2.5 stage3),不 bump、不重錄 baseline |
| 可重現 | 分析參數(SG window、分段閾值、phase 參數)全部設定常數 + 版本記錄於報告 metadata;同一匯出 + 同參數 → 同報告 |
| 純度 | `algorithms/` 禁副作用(移植 performance_analysis 不變量);notebooks task-scoped 子資料夾 + 各自 `outputs/` |
| 單位 | 角度 deg、時間 ms(量測時鐘域)、速度 u/s——對齊 CONTEXT 正規單位;rad→deg 轉換只發生在 kinematics 層一處 |

### 1.3 Constraints(硬約束;採納時回寫 CLAUDE.md §4 候選)

- 沿用全部既有硬約束(不逐條重抄);本 stage 特別相關:GD-11 FPSci 紅線、統計 = 匯出、sim 熱路徑零侵入。
- **新增:research 層不得 import 引擎碼**(`research/` ↔ `src/` 單向隔離:research 只讀匯出 JSON/CSV,不讀 TS 模組)。
- **新增:`algorithms/` 純函式紀律**(禁 matplotlib/print/file I/O;繪圖與 I/O 落 `notebooks/`)。
- **新增:教練報告紅線**——未通過構念驗證(reliability gate)的指標不得進教練報告;寧可少一個指標,不能有一個會說錯話的指標。

---

## 2. 系統設計(Technical Design)

### 2.1 System boundary

**In scope**:`research/`(新,全部)、`src/data/DataRecorder.ts` + [schema.md](../../../operational/schema.md)(**僅** WP-24 T3 觸發時,additive `key` 事件)、`src/metrics/` + 結果頁(僅 WP-27)、`docs/operational/`(分析 spec 與參數 registry)。

**Out of scope**(防蔓延,各附觸發條件):

- **LDJ-V**:觸發 = SPARC 上線後需要第二平滑度指標交叉驗證(需先解 128Hz 頻帶限制:jerk 二階微分放大高頻噪音,須共同頻帶低通)。
- **velocity scaling 回歸**(peak ω vs D):觸發 = 偵測/移動 drill 累積跨 D 範圍資料量(每條件 n ≥ 5 primary_flick 且 D 變異跨 ≥ 2 倍)。
- **RawInputTrace + schema v3、瀏覽器輸入保真度 bench、polling rate(1k/2k/4k/8k)實驗**:儀器研究,唯一需要動輸入/匯出鏈的項目;觸發 = 明確硬體研究委託 → 另立 stage/WP(先跑保真度 spike,以 performance_analysis 原生採集為 ground-truth 交叉驗證)。
- **即時(drill 中)指標回饋**:本 stage 全部離線;觸發 = 教練工作流需要 drill 中介入。
- **移動目標(F5)追蹤指標整合**:`t_acquire`/TOT%/RMS ε 的 drill 面屬 WP-18/WP-22;本 stage 的 ε(t) 演算法可被其複用,但不搶跑整合。

### 2.2 資料流

```mermaid
graph LR
  subgraph engine[引擎(既有,零改動)]
    EXP["schema v2 匯出 JSON(meta/ticks/events)"]
  end
  subgraph research[research/(新,Python 離線)]
    ING["ingest: load_export + dt 檢查"] --> KIN["kinematics: ω(t), ε(t)"]
    KIN --> SEG["segments: SG + primary_flick/micro_adjustment"]
    SEG --> PSA["per_segment_apply + quality flags"]
    ING --> TL["逐 peek 時間軸 + Sync 族"]
    PSA --> MET["phase / 101pt 曲線 / SPARC / xcorr / Fitts"]
    TL --> RPT["教練報告(單 drill 一鍵)"]
    MET --> RPT
    MET --> GOLD["parity_generators: golden fixtures"]
  end
  subgraph ts[TS 生產層(WP-27)]
    GOLD --> TSM["src/metrics table-driven 對表"] --> DASH["MetricsDashboard 結果頁擴充"]
  end
  EXP --> ING
```

Parity 方向與 performance_analysis **相反**:那邊 Python 研究 → Go 生產;這邊 Python 研究 → TS 生產(`MetricsDashboard`),golden fixture 紀律相同。

### 2.3 research/ 目錄形狀(學 performance_analysis `research/framework.md`)

```
research/
├── pyproject.toml
└── src/
    ├── modules/
    │   ├── ingest/      # loader、schema 對表、dt/品質檢查
    │   ├── kinematics/  # ω(t)、ε(t)、rad→deg(唯一轉換點)
    │   ├── segments/    # SG 平滑、submovement 分段、per_segment_apply
    │   └── metrics/     # 時間軸、sync、phase、101pt、SPARC、xcorr、fitts
    │   └── (各模組:algorithms/ + algorithms/tests/ + notebooks/<task>/outputs/)
    ├── parity_generators/   # golden JSON → src/metrics 對表(WP-27)
    └── shared/filters/      # sg_filter、butter_filter(移植)
```

### 2.4 關鍵演算法決策(與 performance_analysis 的差異點)

| 項目 | performance_analysis | 本專案(stage4) |
|---|---|---|
| 訊號源 | raw mouse counts(px),~1kHz 非等間隔 QPC | `ticks[].aim`(rad→deg),128Hz 均勻 → **免重採樣、免對時** |
| 速度定義 | speed_px_s(SG 平滑) | ω(t) deg/s:`√((Δyaw·cos(pitch))² + Δpitch²)/Δt` |
| 分段閾值 | peak = max(mean+0.5σ, 200 px/s);邊界 0.1×/0.2× peak | 骨架相同;數值於 T3 以合成 fixture + 真實資料重掃(OQ-S4-2) |
| SG 參數 | Go w=7/p=3(高頻) | 128Hz 下重掃(w=7 ≈ 55ms 為起點候選) |
| 鍵盤源 | keyboardTrace(µs, wallclock 對時) | `ticks[].keys`(±1 tick 量化)+ `counter` 事件(input timeStamp);精度不足 → WP-24 T3 additive key 事件 |
| 時鐘對齊 | fusion 模組(MAE ≈ 0.6ms) | 不需要(單一量測時鐘域) |

### 2.5 Failure modes

| 觸發條件 | 影響 | 處理策略 |
|---|---|---|
| 分段閾值在 128Hz/deg/s 下不穩(碎段/漏段) | 全部逐段指標失真 | 合成 fixture 釘死已知邊界;真實資料掃參 + 疊圖人工檢核為 T3 DoD;fallback = 加大 SG window / 雙門檻遲滯 |
| t_release 的 ±1 tick 量化吃掉 Sync 族效應 | P1-2 指標解析度不足 | T2 內建精度評估(量化誤差 vs 指標分佈寬度);判定不足 → 觸發 T3 additive key 事件(data 層,零 sim 侵入) |
| xcorr 構念不可靠(128Hz + 階段 A 二元速度) | 對選手講錯故事 | reliability gate 為 T2 DoD 的一部分;未達標明確標「研究向」,不進教練報告(§1.3 紅線) |
| Python/TS 雙實作漂移 | dashboard 數字 ≠ 研究數字 | golden parity fixtures(WP-27 T1);晉升後任一端改動須重跑對表 |
| 單 drill peek 數少(n ~ 數十) | 聚合統計不穩 | 報告一律顯示 n + 分佈(非只均值);教練解讀指引記於報告模板 |
| ε(t) 需要 camera 位置(eye height) | 推導錯 → ε 系統性偏移 | eye height 為引擎設定常數,ingest 對表 meta/config;合成 fixture 含已知幾何驗證 |

---

## 3. WP 索引(⬜ 未開始 · 🟡 進行中 · ✅ 完成)

> 編號接續 stage3(WP-19~22)。每 WP 採納後展開自足子資料夾(`README.md` + `task-checklist.md` + `progress.md` + `T0` → `Tn` → `T-exit`)。

| WP | 子資料夾(採納後建) | 目標 | 優先序 | 里程碑 | 相依 | 估時 | 狀態 |
|---|---|---|---|---|---|---|---|
| **WP-23** | `wp-23-research-foundation/` | research/ 地基:scaffold + ingest + 角運動學 + submovement 分段 + quality flags | P0-2 | **M11** | M4 ✅ + WP-16 ✅ | 3–4 | ⬜ 草稿 |
| **WP-24** | `wp-24-coach-timeline/` | 教練第一層:逐 peek 時間軸 + Release-to-Click Sync 族(+ 選配 key 事件) | P0-1 + P1-2 | — | WP-23 **T1**(僅 ingest) | 1.5–2.5 | ⬜ 草稿 |
| **WP-25** | `wp-25-trajectory-metrics/` | 軌跡診斷:REC/MR/V phase 分解 + L/R 101 點曲線 | P1-1 + P1-3 | — | **M11** | 2–3 | ⬜ 草稿 |
| **WP-26** | `wp-26-advanced-diagnostics/` | 進階診斷:SPARC + Key-Velocity xcorr(reliability gate)+ Fitts | P2 | — | **M11** | 2–3 | ⬜ 草稿 |
| **WP-27** | `wp-27-dashboard-integration/` | 晉升整合:golden parity → TS metrics + 結果頁擴充 + 驗收清單 D | — | **M12** | WP-24 + WP-25(WP-26 選項) | 2–3 | ⬜ 草稿 |

---

## 4. 里程碑門控

| 里程碑 | 完成條件 | 對應 WP | 意義 |
|---|---|---|---|
| **M11** | research 地基成立:真實 drill 匯出 ingest 綠 + 合成 fixture 分段邊界誤差 ≤ 2 tick + 真實資料分段成功率/疊圖報告 + 全鏈 pytest 綠 | WP-23 | 分段是單點故障;**M11 未過不展開 WP-25/26**(比照 M1 脊椎邏輯)。WP-24 例外:僅依賴 ingest(T1),可先行 |
| **M12** | 驗收清單 D 全項通過:教練報告一鍵產出(FR-D14)、晉升指標 TS golden 對表綠、`test:ci` exit 0、每指標附效度證據(fixture + 真實檢核 + 限制) | WP-27 | **stage4 交付**:瞄準 × 急停教練分析管線 pilot-ready |

---

## 5. 相依圖(關鍵路徑)

```
                    ┌─(T1 ingest 完成即可)─→ WP-24(時間軸 + Sync,P0-1/P1-2)──┐
WP-23(地基,M11)──┤                                                            ├→ WP-27(晉升整合,M12)= stage4 交付
                    ├─(M11 過後)──────────→ WP-25(phase + 曲線,P1)───────────┤
                    └─(M11 過後)──────────→ WP-26(SPARC/xcorr/Fitts,P2)──────┘
                                                     (WP-26 為 M12 選項:未過 reliability gate 的指標不晉升)
```

- **WP-24 與 WP-23 T2–T4 可並行**(時間軸/Sync 只吃 ingest 與 events,不吃分段)——這條並行線就是「兩週垂直切片」:WP-23 T1 → WP-24 T1/T2 讓教練最快拿到可用工具。
- **M11 未過不進 WP-25/26**(分段參數未鎖,逐段指標全是沙上建塔)。
- WP-26 三個 task 互不相依,可依資料就緒度亂序執行(Fitts 等偵測 drill 資料;xcorr 等 reliability 判定)。
- 與 WP-18/WP-22(stage2/3 殘項)零檔案熱區重疊,可完全並行。

---

## 6. 任務拆解(per-WP task 表 + DoD)

> 採納後每 task 展開為自足檔(Steps / DoD / Commit message);下表為草稿層級的 scope + DoD 定義。

### WP-23 research-foundation(P0-2,→ M11)

| Task | Scope | Definition of Done |
|---|---|---|
| **T0 entry-gate** | 驗上游:≥1 份真實 drill 匯出樣本(schema v2,含 ticks aim/keys + events)取得並記錄路徑;OQ-S4-1(Python 工具鏈)拍板;硬約束三條(§1.3)確認並回寫 CLAUDE.md §4 | 樣本檔存在且 `schemaVersion === 2`;pyproject 可 `pytest` 空跑綠;CLAUDE.md 對帳 commit |
| **T1 scaffold + ingest** | `research/` 四目錄制;`load_export(path)` → meta/ticks/events(pandas);欄位/單位對表 schema.md;dt 均勻性檢查(缺 tick、異常間隔報告——raw_sampling_frequency 模式移植) | 真實匯出 round-trip 綠;缺欄/非有限值 fixture 拋 field-path 錯誤;dt 報告含 tick 數/缺口數/中位間隔;`algorithms/` 無副作用(測試斷言不觸 I/O) |
| **T2 angular kinematics** | ω(t)(deg/s,yaw·cos(pitch) 校正)、ε(t)(deg,CONTEXT §A 語意,含 eye-height 常數對表);rad→deg 唯一轉換點 | 合成 fixture(常數角速度/純 yaw/純 pitch/高 pitch 邊界)誤差 ≤ 1e-6 相對容差;ε(t) 已知幾何 fixture 綠 |
| **T3 SG + submovement 分段** | 移植 performance_analysis 分段骨架(peak 偵測 + low/stop 邊界);SG window 與閾值(OQ-S4-2)以合成 fixture + 真實資料掃參;分段疊圖 notebook | 合成 fixture(已知 primary/micro 邊界)誤差 ≤ 2 tick;真實 drill 分段成功率報告 + 疊圖產出;參數決策(掃參證據)記 progress;參數落設定常數 |
| **T4 per_segment_apply + quality flags** | 泛用逐段 map;逐 peek/逐段 `flags`(insufficient_samples/no_segment/…全 fallback reason) | 單元測試綠(空段/單樣本/NaN 注入);下游任一指標輸出皆含 flags 欄 |
| **T-exit(M11)** | 全鏈驗證 + 文件 | pytest 全綠;「匯出 → 分段 + 品質報告」一鍵 script 綠;分段參數/限制記 `docs/operational/analysis-segments.md`(新);M11 證據四項齊(見 §4) |

### WP-24 coach-timeline(P0-1 + P1-2)

| Task | Scope | Definition of Done |
|---|---|---|
| **T0 entry-gate** | 驗 WP-23 T1 exit(ingest 可用);確認 `compute.ts` 既有指標語意(交叉驗證基準) | ingest 綠;基準指標清單記 progress |
| **T1 逐 peek 時間軸** | peek 窗重建(visible→…→kill/timeout,P2 推進語意對齊 CONTEXT §A);每 peek 事件時間軸圖(t_visible/t_counter/t_release/t_fire×n/t_kill)+ drill 摘要表 | 同一匯出上,重算之 counterReactionMs/fireTimingAlignmentMs 與 `compute.ts` 結果一致(容差 ≤ 1e-9;不一致即 bug 或語意分歧,須記 DECISIONS);≥1 真實 drill 全 peek 時間軸產出 |
| **T2 Release-to-Click Sync 族** | `t_fire − t_release(原方向鍵)`(自 ticks.keys,±1 tick)、counter 持續時間、`t_fire − t_counter`;缺事件 peek 標 flag 不進聚合;**量化精度評估**(±1 tick 誤差 vs 指標分佈寬度) | 單元測試(正常/缺 release/缺 counter/亂序 fixture)綠;精度評估報告產出並給出 T3 是否觸發的**明確判定** |
| **T3(選配,gated)key 事件記錄** | **僅當 T2 判定精度不足**:DataRecorder 增 `key` 事件(down/up + input timeStamp);additive v2 optional;schema.md 對帳;決定性回歸不受影響 | 既有決定性 baseline 綠(零重錄);新事件 vitest 綠;schema.md 更新;未觸發則本 task 記 skipped + 理由 |
| **T-exit** | 教練報告 v0:單 drill → 時間軸 + sync 統計一鍵產出 | script 綠;報告含每指標 n + flags;範例報告存 notebooks outputs |

### WP-25 trajectory-metrics(P1-1 + P1-3;entry = M11)

| Task | Scope | Definition of Done |
|---|---|---|
| **T0 entry-gate** | 驗 M11;t_detect 推導 spec([analysis-t-detect.md](../../../operational/analysis-t-detect.md))參數對表 | M11 證據四項確認;t_detect 參數(θ_v/k)引用記錄 |
| **T1 REC/MR/V phase 分解** | 移植 phase 骨架(Butterworth 零相位邊界偵測,參數校 128Hz);每 peek 輸出 rec/mr/v 時長 + peak ω + flags;REC 邊界 vs t_detect 一致性檢查 | 合成 fixture 相位邊界誤差 ≤ 2 tick;真實資料 phase 分佈報告;REC-end 與 t_detect 推導差異分佈報告(系統性分歧 → 記 OQ);cutoff ≥ Nyquist 等退化情境走 fallback + flag(不 crash) |
| **T2 L/R 101 點曲線** | 每 peek [t_visible, t_firstShot](OQ-S4-5)重採樣 101 點(移植 101pt 插值 + 缺值政策);ω(t)/ε(t) 逐 side 平均 + 分佈帶;L/R 疊圖 | 插值單元測試(<2 樣本/全零/缺值)綠;≥1 真實 drill L/R 曲線圖產出;n(L)/n(R) 顯示於圖 |
| **T-exit** | phase + 曲線併入教練報告 | 報告 v1 一鍵綠;新增段落含解讀指引(哪段長 → 練什麼) |

### WP-26 advanced-diagnostics(P2;entry = M11)

| Task | Scope | Definition of Done |
|---|---|---|
| **T0 entry-gate** | 驗 M11;構念驗證政策拍板(reliability gate 門檻,OQ-S4-3) | gate 門檻數值記 progress(pre-registered) |
| **T1 SPARC** | 移植 `compute_sparc`(20Hz cutoff、fs=128 相容斷言);逐 primary_flick;golden 對表 performance_analysis 實作 | golden(同輸入同輸出,容差 ≤ 1e-9)綠;真實資料分佈報告;退化輸入(<16 樣本)回傳語意與 performance_analysis 一致 |
| **T2 Key-Velocity Coupling xcorr** | signed A/D state(ticks.keys)vs ω(t);per-window peak lag/strength + 全 correlogram;**reliability gate**:split-half + shuffle baseline | 單元測試綠;gate 報告產出並給**明確判定**(進教練報告 / 標研究向);判定與證據記 progress |
| **T3 Fitts ID/MT/TP** | D = spawn 偏心角(visible 事件 targetXYZ + aim@spawn)、W = 目標角尺寸(DrillConfig hitbox);MT = t_firstShot − t_visible;逐 peek ID/MT → TP;回歸診斷 | 單元測試(已知幾何 fixture)綠;偵測 drill 資料 r² 報告;D 變異不足 → 輸出 `blocked-by-data` 判定(不硬給結論) |
| **T-exit** | 三指標效度判定收斂 | 每指標一份「進教練報告與否」判定 + 證據;通過者併入報告 v2 |

### WP-27 dashboard-integration(→ M12;entry = WP-24 + WP-25 exit)

| Task | Scope | Definition of Done |
|---|---|---|
| **T0 entry-gate** | 晉升清單拍板(OQ-S4-4;預設:phase 時長統計 + sync 統計 + L/R 曲線縮圖);WP-26 通過項納入評估 | 晉升清單 + 理由記 progress |
| **T1 golden parity fixtures** | `parity_generators/` 產 golden JSON(輸入匯出片段 + 期望指標值)→ `src/metrics/` TS 實作 + table-driven 測試 | TS 測試綠且對表 golden(容差 ≤ 1e-9);Python/TS 任一端改動須重跑對表之紀律記 CLAUDE.md 候選 |
| **T2 結果頁擴充** | `MetricsDashboard` 增晉升指標區塊(純 TS + DOM,D1);「統計 = 匯出」不變式維持(dashboard 只消費 snapshot) | vitest 綠;既有指標回歸零變化;手動視覺確認項記 progress |
| **T-exit(M12)** | 驗收清單 D 定稿 + 全項通過 | `test:ci` exit 0;清單 D 逐項證據連結;stage4 狀態翻 ✅ + exec-plan/README.md 對帳 |

---

## 7. 風險分析

| 風險 | 等級 | 說明與緩解 |
|---|---|---|
| 分段參數在 128Hz/deg/s 不穩 | **High** | 唯一的地基風險,故 M11 設為硬閘;合成 fixture 釘死 + 真實資料掃參 + 疊圖人工檢核;失敗 fallback = 遲滯雙門檻/加大 window(記 progress) |
| t_release ±1 tick 量化不足 | Med | T2 內建精度評估 + T3 additive key 事件升級路徑(data 層,零 sim 侵入,additive 不 bump) |
| xcorr 構念不可靠 | Med | reliability gate 前置(§1.3 紅線);最壞情況 = 降級研究向,不影響 P0/P1 交付 |
| Python/TS 漂移 | Med | golden parity(WP-27 T1);對表紀律入 CLAUDE.md 候選 |
| 單 drill 樣本數少 | Med | 報告強制顯示 n + 分佈;跨 session 聚合靠 `meta.session`(participantId/sessionLabel,WP-20 已交付)離線串接 |
| 範圍蔓延(研究向指標擠掉教練交付) | Med | §0 排序為 scope 憲法;P3 全部 out of scope 附觸發條件;WP-26 為 M12 選項而非必要條件 |
| **Technical debt(有意識妥協)** | — | ① t_release 先走 tick 量化(升級路徑已留)② xcorr 在階段 A 二元速度下 vx 通道退化,只做 ω 通道 ③ SPARC/phase 參數為 pilot 前暫定(pre-registered 後校準)④ Fitts 的 W 用單一 hitbox 角尺寸(H1 語意,頭/身分解延後) |

---

## 8. Open Questions

| # | 問題 | 建議(計畫預設) | Owner | Deadline | 未決影響 |
|---|---|---|---|---|---|
| OQ-S4-1 | research 層語言/工具鏈 | **Python 3.11+ + pyproject(+uv 可選)**:移植對象是 performance_analysis Python 實作,scipy 生態必要;TS 僅承接晉升後的生產實作 | 使用者 | WP-23 T0 | WP-23 全部 blocked |
| OQ-S4-2 | 分段閾值 deg/s 起點(peak 門檻、low/stop 比例、SG window) | 骨架沿 performance_analysis(mean+0.5σ、0.1×/0.2× peak);數值由 T3 掃參定,**pre-registered 記錄後凍結** | 研究者 | WP-23 T3 | M11 無法判定 |
| OQ-S4-3 | reliability gate 門檻(split-half r、shuffle 顯著水準) | split-half r ≥ 0.7 + shuffle p < 0.01(起點,T0 拍板凍結) | 研究者 | WP-26 T0 | P2 指標無法判定進退 |
| OQ-S4-4 | 晉升 dashboard 的指標清單 | phase 時長統計 + sync 統計 + L/R 曲線縮圖(P0/P1 全數;P2 視 gate) | 使用者 | WP-27 T0 | WP-27 scope 不定 |
| OQ-S4-5 | 101 點正規化窗口錨 | **[t_visible, t_firstShot]**(counter-strafe 錨定首發,CONTEXT §A;t_kill 版含補槍屬「清目標節奏」,留分析端副版) | 研究者 | WP-25 T2 | 曲線語意不定 |
| OQ-S4-6 | 教練報告載體 | notebook → 靜態 HTML(單檔可寄送);觸發升級 = 教練需要互動篩選 | 使用者 | WP-24 T-exit | 報告形式不定 |

---

## 9. 文件對帳清單(採納本計畫時執行;跨文件決策入 DECISIONS.md)

- [ ] [DECISIONS.md](../../DECISIONS.md) 新增決議:①「research 層 = Python 離線分析,與 src/ 單向隔離,parity 方向 Python→TS」②「教練報告紅線(構念驗證 gate)」③ P3 項目(polling rate/RawInputTrace 等)延遲決策與觸發條件。
- [ ] [CONTEXT.md](../../../../CONTEXT.md) 新術語:submovement 分段(primary_flick/micro_adjustment)、ω(t) 角速度、REC/MR/V phase、Release-to-Click Sync、101 點正規化曲線、reliability gate;§B 增 research 層元件列。
- [ ] [exec-plan/README.md](../../README.md):§2 加 stage4 索引表;§3 加 M11–M12;§4 相依圖擴充;§6 目錄慣例加 stage4。
- [ ] [CLAUDE.md](../../../../CLAUDE.md) §4 硬約束追加(§1.3 三條新增項)——落 WP-23 T0。
- [ ] `docs/MAP.md` 導航更新(research 層入口)。
- [ ] （WP-24 T3 若觸發)`docs/operational/schema.md`:`key` 事件 additive 對帳。

---

## 10. 執行規則

沿用 [exec-plan/README.md §5](../../README.md):一 task = 一垂直切片 = 一原子 commit;task 完成更新該 WP `progress.md` + checklist;跨 WP 先驗上游 exit-gate;**M11 未過不展開 WP-25/26**(分段地基未鎖不做逐段指標);WP 展開格式以 `completed/stage1/wp-2-dual-loop-skeleton/` 為原始模板。Python 側測試紅綠燈證據(pytest 輸出)比照 CI 紀律記 progress。
