# CONTEXT — 專有名詞詞彙表

> 本專案：FPS 反向急停（counter-strafe）瞄準訓練器（Three.js + WebGPU）。
> 本檔記錄領域與架構的「正規術語」（canonical terms），供開發者與 agent 對齊用語。撰寫語言：繁體中文，技術術語保留英文原文。
> 相關文件：[`docs/PLAN.md`](./docs/PLAN.md)、[`docs/規格書_Three.js_WebGPU_反向急停瞄準訓練器.md`](./docs/規格書_Three.js_WebGPU_反向急停瞄準訓練器.md)。

---

## A. 領域術語（domain — 對研究者/玩家有意義）

| 術語 | 定義 |
|---|---|
| **counter-strafe（反向急停）** | CS 系列的核心技巧：移動中按下**反向鍵**讓角色速度迅速歸零，在 `v≈0` 的瞬間開火以取得最高精準度。本專案量測的目標行為。 |
| **反向鍵（counter key）** | 與當前移動方向相反的按鍵（向右 D 移動時的 A，反之亦然）。按下即觸發急停判定。 |
| **drill** | 由**資料（config）**定義的一次訓練單元，規定目標數、位置、時序、左右交替方向與結束條件。新增 drill 不需改引擎程式碼（F4）。 |
| **peek** | 一次「探頭—對齊—開火」的循環，**1 個目標 presentation ⇄ 1 個 peek**。**推進政策 = P2（命中才推進）**：目標可見後持續存在，未命中不撤；**第一次命中 = kill → 撤掉、生成下一個**（左右交替「擊殺右→生成左」因此原樣成立）。每 peek 開槍數可變（0+ 次 miss 後 1 次命中）。設 `peekTimeoutMs`（config）：逾時未 kill → 記為 `timeout`、推進，避免卡死。drill 結束 = 目標數達標 **或** 總時長到（雙閘）。左右 peek 對稱性是量測指標之一。 |
| **首發（first shot / firstShot）** | 每個 peek 的**第一發**，帶 `firstShot=true` 旗標。首發命中率 = 首發命中 peek 數 / peek 數；不被後續掃射稀釋（P2 下靠**旗標**保證，非靠推進政策）。**counter-strafe 的時序/精度指標（急停反應、停火對齊、殘餘速度、準心偏移）一律錨在首發的 `t_fire`**；後續補槍只為 kill、不計入 counter-strafe 量測。Projectile 模式下 `fire.hit=false` 是產彈瞬間觀測；首發 outcome 由同 `shotSeq` 的 additive `hit` 事件回填，錨點仍是 `t_fire`，不移到 `t_hit`。`DataRecorder` 須能還原兩個錨點 `t_firstShot/t_fire` 與 `t_hit/t_kill`（hitscan 下可同時刻），故每 peek 記 `shotCount` 與逐發事件。**full-auto(WP-11)下 `firstShot` 仍錨定 peek**(每 peek 的第一發 shot),不隨扳機開合移動;與 `recoil index=0`(每段連續射擊,§F)為**可分岔**的兩件事——同一 peek 內 double-tap 的第二次 fire-down,其 shot `firstShot=false` 但 recoil index 重新從 0。 |
| **急停反應時間** | `t_counter − t_visible`：敵人可見 → 按下反向鍵的時間差。 |
| **速度歸零誤差（residual speed）** | 開火瞬間殘餘速度的絕對值，越接近 0 越精準。⚠️ **階段 A 立即停止（M1）下退化成二元**（velocity ∈ {0, ±v}），量不出連續精度；屬 counter-strafe 的「停得多準」維度，要等階段 B physics。`DataRecorder` 仍每 tick 記 velocity、開火 tick 記此欄（欄位先存、階段 B 自動升級成連續值）；結果頁以**分類**（開火時「已停止/移動中」、「有無反向」）呈現，不顯示誤導性 u/s。 |
| **停火時序對齊** | `t_fire − t_velocity_zero`：速度歸零到開火的時間差；負值代表「人未停先開槍」。階段 A 立即停止下 `t_velocity_zero` 塌縮成 `t_counter`，故量的是「開火相對**急停輸入**」的時序（語意改變但仍可用）。 |
| **首發命中率** | （首發命中 / 總 peek）× 100%。Hitscan 直接讀首發 `fire.hit`; projectile 讀首發 `fire.shotSeq` 是否存在對應 `type:'hit'` row。 |
| **準心對齊偏移** | 開火事件在排序串流中那一點，準心射線與目標 hitbox 中心的距離／角度（**sub-tick 忠實、零內插**，見 simStep 順序）。「準心射線」≡ **camera 正向（螢幕中心）射線**，HitDetector raycast 同此；畫面十字（階段 A = DOM overlay）純裝飾、**必須精確置中**（注意 `devicePixelRatio`），指標**不讀**該元素座標。 |
| **追蹤誤差 ε(t)（tracking error）／on-target** | ε(t) = 逐 tick 的「準心射線 vs 目標 hitbox 中心」夾角（deg）——**準心對齊偏移由 fire 瞬間推廣到逐 tick**，同一數學、同一單位。**on-target（逐 tick 二元）**= 準心射線 ∩ H1 hitbox（與命中判定同幾何，**零新門檻參數**）。全部由 schema v2 原始欄位（aim + 玩家/目標位置）**離線推導**，不進 sim 熱路徑（GD-7）。 |
| **角速度 ω(t)（angular speed）** | 128Hz aim 串流相鄰 tick 的無號角速度（deg/s）；yaw 分量以兩 tick 的 midpoint pitch 做 `cos(pitch)` 校正，首筆為 `nan`。rad→deg 只在 kinematics 邊界轉換，下游 research 模組一律消費 degree。 |
| **submovement 分段** | 將 SG 平滑後的 ω(t) 依 peak 與 low/stop crossing 切成一個 `primary_flick`（第一次主要彈道式甩動）及其後零到多個 `micro_adjustment`（較低幅度修正）。參數以版本化 `SegmentParams` pre-register；`seg-v1` 在六組合成情境的邊界誤差 ≤1 tick，並於 2026-08-05 以一份匿名真實 `counterstrafe_ad_v1` 匯出完成 M14 檢核（19/20 peeks、成功率 0.95，20 張疊圖人工邊界合理；效度範圍仍限單一樣本）。**分段吃 ω(t) 的已測樣本（`omega[1:]`）**：首筆 `nan` 是「未定義」不是缺值，整條餵入會讓每一段都掛 `non_finite_interpolated` 而被聚合排除。定義見 [analysis-segments.md](docs/operational/analysis-segments.md)。 |
| **quality flags（逐段品質旗標）** | 逐 peek／逐段結果上 machine-readable 的**封閉詞彙表**（`QUALITY_FLAG_VOCABULARY`），例如 `no_segment`／`below_floor`／`non_uniform_dt`／`truncated_at_window_edge`；動態失敗只能是 `compute_failed:<reason>`。**品質失敗是資料，不吞成 NaN**：計算失敗的列仍在，只有數值變 `NaN` 並帶原因。聚合（`summarize_with_flags`）排除任何帶旗標的列，故報告必須同時顯示 `n` 與 `n_flagged`。 |
| **peek 時間軸（peek timeline，`timeline-v1`）** | 每個 `visible` 事件恰好產生一個窗 `[t_visible, next_visible.t)`（末筆為 +∞，tick 歸屬容差 1e-9 ms），窗內重建五個錨點 `t_visible → t_counter → t_release → t_first_shot → t_hit`。**不丟窗、不合併窗**，窗數恆等於 `visible` 事件數。Python 為新構念權威（`research/src/modules/metrics/algorithms/peek.py`），三個既有聚合量仍由 `compute.ts` 的 `compute-v1` 權威、逐位對表 ≤1e-9。定義見 [analysis-peek-timeline.md](docs/operational/analysis-peek-timeline.md)。 |
| **`t_release`（放鍵時刻）** | 「原方向鍵」被鬆開的時刻。原方向鍵 = counter 鍵的反向鍵（A ⇄ D）；`t_release` 取窗內該鍵最後一次「仍持壓、下一 tick 已放開」的那個 tick。**tick-derived、非 input 事件時戳**，故帶最多 1 個 128 Hz tick（7.8125 ms）的量化誤差。無 counter 事件時退化為「窗內最後一次 A/D held→released」並標 `release_inferred_no_counter`（**聚合預設排除**，OQ-S4-10）。WP-29 T3 另加 additive `t_release_event`（`events[].key` 的 input timeStamp，sub-tick）與 `release_source`（`key_event`/`tick_keys`）作為**不重定義** `t_release` 的直接證據。 |
| **`outcome`（逐 peek 結果）** | 逐 peek 的三值分類：窗內零發 = `no_shot`；有發且任一發命中 = `hit`；有發但全未命中 = `timeout`。**與首發命中率刻意不同構念** —— outcome 看整個 peek 的任一發（含補槍），`firstShotHitRate` 只看相容首發且分母為全部 `visible`，故一個 peek 可以 `outcome=hit` 但首發是 miss。schema v2 無 `kill`/`timeout` 事件，`outcome` 由 fire/hit 串流推導；projectile 以 `shotSeq` 關聯且**不受窗界限制**，跨窗命中標 `hit_outside_window` 但仍計為 `hit`。 |
| **Release-to-Click Sync（放鍵—點擊同步性，`sync-v1`）** | counter-strafe 的「手部時序協調」指標族，逐 peek 一列、不丟列：`release_to_fire_ms` = `t_first_shot − t_release`、`counter_hold_ms` = `t_counter` 到最後一個仍持壓 counter 鍵的窗內 tick、`counter_to_fire_ms` = `t_first_shot − t_counter`（等同 `compute-v1` 的 `fireTimingAlignmentMs`）。前兩者的 release 端點為 tick-derived，故附 **pre-registered 精度判定**：`SyncParams(min_samples=10, sd_ratio_threshold=1/3)`，量化 SD = `tick/√12 = 2.255274489021976 ms`；三分支 `blocked-by-data` / `insufficient` / `sufficient` 在看到資料前凍結，事後只能升 version 重跑。 |
| **peek / Sync quality flags（封閉詞彙表）** | §A `quality flags` 的同一紀律套到時間軸層：`empty_window`／`no_counter`／`multiple_counters`／`unsupported_counter_key`／`release_inferred_no_counter`／`no_key_transition`／`no_first_shot`／`hit_outside_window`／`missing_release`／`missing_counter`／`missing_first_shot`／`counter_hold_truncated`。演算法斷言只能吐這張表內的旗標。**正式 Sync 聚合規則 = 數值有限且整列 `flags` 為空**（整列制，不逐欄例外），故 inferred release 與截斷的持壓時間可檢視但不進分母。**缺錨點是合法語意，不補 0、不吞成 NaN。** |
| **軌跡診斷（`phase-v1`／`curve-v1`）** | 每 peek 的 **REC/MR/V**：REC=`[t_visible, primary_flick.start)`、MR=凍結 `seg-v2` 的唯一 `primary_flick`、V=`[primary_flick.end, t_first_shot]`；`t_detect` 僅交叉檢查，不改寫邊界。101 點曲線把 `[t_visible,t_first_shot]` 的 ω(t)/ε(t) 線性重採樣，逐 side 以 mean + IQR 呈現；數值有限且整列 flags 為空才進 `n`。兩者都只接受 strict tick-integral + eye-origin 匯出，凍結參數改動須升版重跑。REC-end−`t_detect` 在三 session pooled `n=21` 為系統性分歧（p50 −78.1 ms），保留研究向、不得作校正值（OQ-S4-17）。 |
| **SPARC（頻譜弧長平滑度，`sparc-v1`）** | 一次**主要動作**的角速度軌跡有多平滑：正規化速度頻譜在 0–20 Hz 內的弧長取負值（越負 = 越不平滑）。逐段單位**就是** `phase-v1` 的 MR 區間（逐 peek 窗內 `seg-v2` 的第一個 `primary_flick`），本模組零分段、零偵測——換一種 scoping 就是給 `primary_flick` 第三個定義（C-D4），且整條軌跡分段只切出 pooled n=3 而非 59。演算法逐位移植 performance_analysis 的 `compute_sparc`（`MIN_SAMPLES=16`／`FC_HZ=20`／`AMP_THRESH=0.03`／8-bin 回退／零填充至 2 的冪／退化回傳 `0.0` 而非 NaN），常數不得在地調整——跨 repo golden 是**外部**驗證，改參數就退化成自我對表。**已知使用限制**：128 Hz 下段長 24–32 tick 補到 N=32（6 bins）、33–58 補到 N=64（11 bins），實測 step_ratio **0.7643 ≥ 0.5** → verdict **`stratified_only`**，**SPARC 僅可在同一 `padded_n` bucket 內比較**；該階梯無法歸因為純 padding 假象（段長同時決定解析度與動作性質，共變不可分離）。封閉 flags：`no_primary_flick`／`too_few_samples`／`degenerate_spectrum`／`window_too_short`。已於 WP-31 T-exit 進 `coach-report-v2` 的**研究向區塊**（不進主表,C-D3）,無 `blocked-by-data` 分支,恆呈現。 |
| **Key-Velocity Coupling xcorr（`xcorr-v1`）** | 一次 peek 內 signed A/D 鍵狀態（`D`→+1／`A`→−1／同按或都沒按→0）與角速度 ω(t) 之間帶時延的耦合：逐 lag（`[-max_lag_ms, +max_lag_ms]`,`max_lag_ms=250`）算 signed Pearson r,取 `|r|` 最大者為 peak（lag 符號慣例：**負 lag = key 領先 ω;正 lag = ω 領先 key**）,輸出完整 correlogram（每點帶 `n_overlap`,避免大 lag 處樣本稀少被誤讀成耦合,S-31.1）。key-state 一律取自 `ticks[].keys`（與 ω 同一 128Hz sim 迴圈取樣,免對時);`key` 事件（WP-29 T3 additive）僅作交叉檢核,非主資料源。封閉 flags：`window_too_short`／`key_state_constant`／`omega_constant`／`non_finite_omega`／`no_finite_lag`。已於 WP-31 T-exit 進 `coach-report-v2` 研究向區塊（`gate-v1` 判 `research_only` 時呈現;`blocked-by-data` 時改列缺口說明,不進報告任何指標區塊）。 |
| **reliability gate(`gate-v1`)** | 指標進教練報告前必須通過的信度／效度門檻；未過的指標**寧可不出**（C-D3／GD-20）。WP-31 T0 於 2026-08-10 把 OQ-S4-3 原提案 `split-half r ≥ 0.7`（在 1 受試者 × 3 session × 20 peeks 下數學上不可計算——split-half 需要跨受試者變異維度,該維度 n=1）**重新操作化**為在此樣本結構下可計算的**三件組**：① circular-shift shuffle null(`p<0.01`,1000 iters)② 逐 session bootstrap 95% CI 寬度(`≤0.20`,2000 iters)③ 奇偶 peek 半分 \|Δ\| 落在②的 CI 內;`min_samples=10`、`seed=20260810`。**三分支判定**：`blocked-by-data`(n 不足)／`research_only`(n 足but①②③任一未過或全過)／`coach_report`——但 `coach_report` 在本樣本結構下由**程式碼保證不可達**(`reliability_gate` 無此分支),因為三件組只證明「訊號非偶然 + 估計量穩定」,不證明個體差異可靠度,比 split-half r 弱。與 **construct presence gate**（見下一條）為不同層級、不同時機的閘,勿混淆:本閘問的是「指標」夠不夠可信,落在**指標進報告前**;construct presence gate 問的是「資料」裡有沒有這個行為,落在 **ingest 時**。 |
| **Fitts ID/MT/TP（`fitts-v1`）** | Fitts 定律的觀察性(非受控)應用:`D` = spawn 瞬間偏心角(重用 `epsilon_deg`／`detect-v1` 的 spawn eccentricity 路徑)、`W` = 目標角尺寸(重用 `meta.targets.hitbox` 的 H1 單一來源,GD-7)、`ID = log2(1 + D/W)`、`MT = t_firstShot − t_visible`,以 `MT = a + b·ID` 回歸出 slope／intercept／r²／throughput(`TP = 1/slope`)。門檻依序檢查 `min_samples=10`／`min_d_ratio=2.0`(`max(D)/min(D)`)／`min_id_range_bits=0.5`,任一不足或 slope 非正 → `blocked-by-data`(不硬給結論)。**兩項限制逐字隨結果**:① D 內生(幾乎全來自上一個 peek 結束時準星停在哪,非實驗操弄的受控設計);② MT 含反應時間與 counter-strafe 停止時間(截距吸收兩者,`t_detect` 樣本不足以逐 peek 扣除)。已於 WP-31 T-exit 進 `coach-report-v2` 研究向區塊,但只限 `status='ok'` 的 session;`blocked-by-data` 者改列缺口說明。 |
| **教練報告 v2（coach report，`coach-report-v2`）** | 一道指令把一份匯出轉成**單檔自足靜態 HTML**（inline CSS + inline SVG，零外部資源、可直接寄送）：drill 摘要、逐 peek 時間軸、timeline/Sync 六量、phase 三量、L/R ω(t)/ε(t) 曲線、n／flags／版本／效度層級、精度判定與限制,**加上 WP-31 T-exit 新增的研究向區塊**（`#advanced`:SPARC 恆呈現、xcorr 於 `gate-v1` 判 `research_only` 時呈現、Fitts 於 `status='ok'` 時呈現,三者皆帶 n／flags／version／效度層級句／限制句)與缺口說明區塊(`#advanced-gaps`:xcorr 或 Fitts 為 `blocked-by-data` 時的一行「為何沒有這個指標／需要什麼樣本」,不含任何數值指標)。C-D3 上限:研究向區塊內容永不進主表。`--group-by side｜ads｜weapon_mode` 只**切分**已算好的列,不改任何參數或版本(分層前後參數區塊逐位相同),且不逐組重跑 pre-registered 判定。未解的 REC–`t_detect` 分歧只在研究向區塊顯示。真實 trajectory 證據只限 P001、同一 240 Hz 機器／drill config 的三 session,不支持母體或訓練效果推論。 |
| **TS 晉升面（`researchMetrics.ts` / `PromotedMetrics`，WP-32）** | `phase-v1`／`sync-v1`／`curve-v1` 三個新構念由 Python 為權威、以 golden parity（`research/fixtures/golden/*.json`）晉升進 `src/metrics/researchMetrics.ts` 的 `computePromotedMetrics(payload)`，對表面 = 四支 `tests/golden/research/promoted-*.test.ts`（P3 三級容差：SG 係數 ≤1e-12、浮點 ≤1e-9、整數/flag/verdict 逐位相等）。`sg-seg-v2` = 凍結的 Savitzky-Golay（window=11/poly=3）係數表（`src/metrics/filters/savitzkyGolay.ts` 的 `SG_SEG_V2`），由 Python 產出、TS 內嵌為生產碼常數（不在 runtime 讀 fixture），改動 = 升 `seg` 版號。`PromotedMetrics` 回傳型別為 `{status:'ok', phase, sync, curve} | {status:'blocked', reason}`：**`blocked` 優於錯值**——`meta.mouseIntegration` 缺席時回 `blocked`，**禁止**回退 `aim-diff-legacy` ω（[KI-005](docs/known_issue/KI-005-omega-render-sim-aliasing.md) 的教訓）。結果頁 `ResultScreen` 的**research-promoted 區塊**消費同一 `computePromoted()`：封閉 8 個 `data-metric-id`，每量帶 n／flags 計數／version／效度層級，`blocked` 態顯示理由而非空白或錯值；曲線量（ω/ε）以 inline SVG 呈現 L/R mean + IQR。**C-D5**（晉升指標雙實作對表紀律，GD-21）：任一端（Python 或 TS）改動語意須同步重跑 golden 並讓對表全綠，版本字串只能升版。 |
| **parity fixture（跨語言對表夾具）** | Python 側算出、**commit 進 repo** 的 JSON（`research/fixtures/parity/`），由既有 `npm run test:ci` 內的 vitest 對表 TS 權威實作（ε 層對 `deriveTrackingMetrics` 五個量 ≤1e-9）。跨語言漂移由此在引擎閘變紅，`test:ci` 本身**不引入 Python 相依**（GD-19）。 |
| **construct presence gate（構念存在性閘，`construct-v1`）** | 由 drill 家族宣告其核心構念（如 `counterstrafe_*` 家族的「橫移 → 反向急停」），ingest 時斷言該構念**在資料中確實出現**：三態 `present`／`absent`／`unknown`（家族未在 `CONSTRUCT_REGISTRY` 註冊 → `unknown`，**未知不阻擋**，與缺席不同後果，見 KI-006-C FR-C-9）。構念缺席時 `run_pipeline` 以專屬非零 exit code **2** 結束（與既有 schema/IO 失敗的 exit 1 可區分），該 session **不得**作為該 drill 家族的效度證據；三個 artifact 仍照常寫出，受限的是**用途**不是**載入**。閾值以具版本 registry 凍結（初版 `construct-v1`：`counterstrafe_*` 需 `counter` 事件數 ≥1 且橫移 tick 佔比 ≥0.05），調整須升版不得原地改值。落地計畫見 [KI-006-C](docs/known_issue/KI-006-C/README.md)（診斷上游：[KI-006](docs/known_issue/KI-006-m14-sample-no-counterstrafe.md)）。**與 reliability gate 的差異**：本閘問「資料裡有沒有這個行為」（層級 = session／資料，時機 = ingest，權威 = `construct-v1`）；reliability gate 問「這個指標夠不夠可信」（層級 = metric／報告，時機 = 指標進教練報告前，權威 = WP-31 T0 pre-register）。**本閘通過不代表任何指標已過 reliability gate**，兩者互不替代、互不滿足對方的條件。drill 家族命名慣例（家族解析依賴此慣例）：`<family>_<variant>_v<n>`；合成匯出額外帶 `synthetic_` 前綴，家族解析須先剝離該前綴再比對（否則合成 fixture 會誤落 `construct_unknown`，見 KI-006-C §2.4①）。 |
| **獲取時間（t_acquire）** | `t_first_on_target − t_visible`：目標可見到首次 on-target 的時間——flick／獲取構念，與追隨（pursuit）分離。整段 presentation 未 on-target → 記**獲取失敗**（計入獲取失敗率、該 presentation 不進 TOT 聚合；失敗是資料不是缺失值）（GD-7）。 |
| **time-on-target（TOT%）／追蹤窗口** | **追蹤窗口 = [t_first_on_target, presentation 結束)**——TOT% 與 ε 統計只在窗內算，獲取能力不污染追隨量測（能力混淆的**指標層**緩解）。TOT% = 窗內 on-target tick 比例；**pre-registered 主統計量 = RMS(ε)**（對跟丟瞬間平方級敏感）；median／P95／streak 為離線副指標（GD-7）。 |
| **偵測反應時間（detection RT）／t_detect** | `t_detect − t_visible`（量測時鐘域）。**t_detect = 瞄準移動 onset**：`t_visible` 後第一個「ε(t) 以超過雜訊底的角速度下降、持續 k tick」的 tick——**離線**從 128Hz aim 流推導，雜訊底以 **per-trial 前刺激窗口**（spawn 前 aim 抖動）校準，θ_v／k 為 pre-registered 分析參數。無眼動儀下的標準 proxy（含動作啟動成分）。副構念 **engagement time** = `t_first_fire − t_visible`（GD-8）。 |
| **偏心度（eccentricity）** | spawn 瞬間「玩家瞄準方向 vs 目標」的角距離——偵測 RT 的最強預測子之一。**記錄為共變數**（aim@spawn + 目標位置離線推導）；不做 fixation gate（那會讓 aim 成為 sim 演進輸入，動 GD-4「aim 僅觀測」契約）（GD-8）。 |
| **pop-in／slide-in（偵測刺激）** | **pop-in**：目標瞬現，`t_visible` = spawn tick（現行語意，OQ-4.2）；偵測 drill 起手式。**slide-in**：目標自宣告式 occluder 後滑出；判準已預先釘死＝**目標中心穿越 DrillConfig 宣告可見性邊界的那一 tick** 蓋 `t_visible`（camera 無關、決定性）——落地待 GD-6 升級路徑 C 觸發（GD-8）。 |
| **`visibleFraction(t)`／可見度時間線（`visibility-v1`，WP-34 T1）** | 逐 tick 的幾何可見比例：對目標當前 tick hitbox 的 N 個取樣點（pre-registered candidate `N=9`＝中心+8 hitbox 角，另接受 `N=1` 診斷模式）各射一條 `eyeOriginForTick(tick)` → 取樣點線段，以既有 `segmentIntersectsAabb()` 對 `SceneConfig.propBounds` 測遮擋，`visibleFraction = 未遮擋點數/N`。純**離線 metrics 層**函式（`src/metrics/visibilityDerivation.ts`），輸入只吃已匯出的 `ExportPayload` + `SceneConfig`，零 render/sim/`SharedState` 依賴（GD-6）。由此推導三個時間錨：**`t_first_visible`**（首個 `visibleFraction>0`）、**`t_measurement_onset`**（首個 `visibleFraction ≥` 凍結門檻——**正式反應起點**，非 `t_visible`）、**`t_full_exposure`**（首個 `visibleFraction=1`）。取樣密度 N 會改變靠近遮蔽物邊緣時的 onset 判定（OQ-S6-12 合成 fixture 已量化：同一幾何 N=1 報 1.0、N=9 報 5/9），故 N 與門檻皆走 pre-registered 紀律，凍結留給 WP-39 pilot。定義見 [analysis-visibility.md](docs/operational/analysis-visibility.md)。 |
| **`fireLocked`（fire-gating,`hold-track-v1`,WP-35 T1）** | `TargetState` 的 additive、sim 唯讀旗標:為 `true` 時 `SimLoop.scheduleFire()` 拒絕消費本 tick 的 held-fire 輸入(`nextFireT`/彈藥不變,只是延後消費,不遺失事件);由 `TargetManager` 依 `DrillConfig.timing.trackingStopMs` 寫入,省略＝既有開火語意逐位不變。**不是**新的 sim 狀態機——與 `persistent` 同層級的附加判定旗標,不併入 `WeaponConfig`/`nextFireT` 彈匣語意。定義見 [analysis-hold-track.md](docs/operational/analysis-hold-track.md)。 |
| **`target_stop`（原地凍結,`hold-track-v1`,WP-35 T1）** | 到期(`timing.trackingStopMs`)後目標**不** `markKilled`——與既有 `presentationMs` 到期即撤除(`markKilled`)的語意相反。同一 tick 內:停止 `motion` drive(`pos` 定格)、`fireLocked` 翻 `false`、寫入 `SharedState.tStop: Map<targetId, number>`(sim clock,比照 `tVisible` 慣例)。匯出面為 additive `target_stop` event(帶凍結座標,供 `deriveStopTransitions` 複用角度誤差計算)。`presentationMs` 與 `trackingStopMs` 互斥(`schema.ts` 驗證),不得同時宣告 advance 與 stop。玩家下一次開火(命中或未命中)後,目標恢復非 persistent 行為,既有 `markKilled` 路徑撤除、推進下一目標。定義見 [analysis-hold-track.md](docs/operational/analysis-hold-track.md)。 |
| **掉靶次數／重新取得時間(`hold-track-v1`,WP-35 T2)** | `deriveTrackingTransitions()`([trackingTransitions.ts](src/metrics/trackingTransitions.ts))消費既有 `deriveTrackingSamples()` 輸出的 `TrackingSample[]`,掃描首次 on-target 後的 true→false(掉靶,`dropCount`)與其後 false→true(重新取得,記入 `reacquireMs`)。**排除規則(OQ-S6-15)**:窗口結束前未重新取得的掉靶仍計入 `dropCount`,但**不**計入 `reacquireMs`(不用剩餘窗口時間填補右截尾觀測);呈現層需同時顯示 `reacquireMs.length` 與 `dropCount` 的差異,避免統計量樣本數混淆。零修改既有 `trackingDerivation.ts` 幾何(C-D4)。 |
| **停止轉換指標(stop transition,`hold-track-v1`,WP-35 T2)** | `deriveStopTransitions()`([stopTransitionDerivation.ts](src/metrics/stopTransitionDerivation.ts))讀匯出的 `target_stop` event,以既有 `buildPeekWindows()` 首發判定(C-D4,不另立第二套)找出 `t_fire ≥ t_stop` 的停止後首發,產出 `fireToStopMs`(`t_fire − t_stop`)、`firstShotHitAfterStop`(沿用該 fire event 既有 hit outcome)、`fireAngleErrorDeg`(複用 `eyeOrigin.ts` 既有角度誤差計算,對齊凍結的停止座標)。定義見 [analysis-hold-track.md](docs/operational/analysis-hold-track.md)。 |
| **`spider-shot-v1`／`spiderShot` schedule(中心—周邊排程,WP-36 T1)** | `DrillConfig.spiderShot?: SpiderShotScheduleConfig`(top-level additive;`kind: 'center-peripheral'`、`seed`、`centerDistanceU`、`peripheral.{angularRadiusDegRange,azimuthDegRange,distanceURange}`)。`TargetManager` 依其存在與否二選一進入完全獨立分支,內部 `nextSpiderZone: 'center' \| 'peripheral'` 取代該分支的既有 `nextSide`(L/R 交替),不讀寫 `nextSide`;既有 `sequence.alternation` 型別仍必填但值不被讀取(C-D4 精神延伸)。`schema.ts` 拒絕 `spiderShot` 與 `targets.spawnArea`/`sequence.spawnDelayMsRange`/`sequence.seed` 併用,避免雙重排程/seed 權威。周邊位置以繞「中心目標視線」的二維球面極角(方位角 `azimuthDeg` + 徑向角距 `angularRadiusDeg` + 世界距離)取樣,與既有 `SpawnAreaConfig` 的一維水平 yaw 模型不同源。定義見 [analysis-spider-shot.md](docs/operational/analysis-spider-shot.md)。 |
| **`zone`(中心/周邊標記,`spider-shot-v1`,WP-36 T1)** | `DrillEvent{type:'visible'}` 的 additive 欄位 `zone?: 'center' \| 'peripheral'`,由 `TargetManager` 於 spawn 時蓋章;省略時(既有 drill)零回溯相容成本。`side` 在此分支恆為 `'R'`,僅維持既有型別相容位置,不承載象限語意——象限改由 `zone` + 抵達座標離線重建。定義見 [analysis-spider-shot.md](docs/operational/analysis-spider-shot.md)。 |
| **`D_deg`／`W_deg`／象限標籤(`spider-shot-v1`,WP-36 T2)** | `D_deg` 是前一目標與抵達目標(皆由玩家原點指向目標中心)兩個方向向量的無號球面夾角,複用 `angularEccentricityDeg()` 底層的 `angularDistanceDeg()`,不另立第二套夾角公式(C-D4)。`W_deg = 2 × atan((hitbox 半寬)/世界距離) × 180/π`,`hitbox` 唯一來自 `meta.targets.hitbox`(GD-7)。象限(`horizontal`/`vertical`/`oblique`)由抵達周邊目標的方位角以 45° 分箱,是**呈現層標籤**,不進 `targetConditionCell`,分箱門檻調整不觸發 `protocolVersion` 升版(OQ-S6-18)。`targetConditionCell` 格式固定 `spider:d=<6 位小數 D_deg>;w=<6 位小數 W_deg>`。定義見 [analysis-spider-shot.md](docs/operational/analysis-spider-shot.md)。 |
| **Spider Shot 五類指標(切換反應/移動執行/停止控制/首發/節奏,WP-36 T3)** | `deriveSpiderShotMetrics()`([spiderShotMetrics.ts](src/metrics/spiderShotMetrics.ts))在 `deriveSpiderShotTransitions()` 的 anchors 上組裝,全數複用既有 canonical derivations(`deriveDetectionMetrics`/`omegaDegPerSec`+`buildPeekWindows`/`trackingDerivation.ts`+`deriveTrackingTransitions`/`angularEccentricityDeg`),僅「節奏」為新加總。四類逐目標構念(切換反應/移動執行/停止控制/首發)只對 `zone: 'peripheral'` 的抵達目標輸出;回中心只計入節奏的連續 `visible.t` 間隔(D-36.5,承構念量測範圍)。停止控制的 `overshootDeg` 為進靶後所有 off-target 樣本的最大無號 `epsilonDeg`(逸出幅度),因 canonical samples 無有號誤差,不宣稱能分類 overshoot 與 undershoot。定義見 [analysis-spider-shot.md](docs/operational/analysis-spider-shot.md)。 |
| **`cue` 事件(急停方向提示,WP-37 T1)** | `DrillEvent` 的 additive 變體 `{ type: 'cue'; t: number; direction: 'A' \| 'D' }`([DataRecorder.ts](src/data/DataRecorder.ts))。是量測時間戳,不參與輸入或命中判定。`SharedState.cues` 暫態佇列由 sim 分支 push,`SimLoop.recordCueEvents()` 在同一 tick 的 `visible` 事件**之前**匯出並清空,保證同 tick cue 恆先於 visible。`PeekWindowTs.cues: readonly CueEvent[]` 是零語意變更既有欄位的擴充;既有 drill(省略 `cue`)恆為空陣列。定義見 [analysis-counterstrafe.md](docs/operational/analysis-counterstrafe.md)。 |
| **`CueScheduleConfig`(`kind: 'single' \| 'hold-reversal'`,WP-37 T1/T2)** | `DrillConfig.cue?: CueScheduleConfig` 頂層 additive 欄位,省略時 `TargetManager`/`DrillRunner`/`schema.ts` 逐位等同現行行為。`single`(`counterstrafe-cued-v1`):`TargetManager` 在既有 `pendingSpawnAtMs` 首次設定的同一 tick 額外蓋一次 cue,方向取當下已決定的 `nextSide`,不改 spawn delay/時刻/side。`hold-reversal`(`counterstrafe-reversal-v1`):必須帶正有限的 `holdDurationMs`,狀態機落在 `DrillRunner`(見下一術語)。`schema.ts` 執行期強制此辨別聯集的互斥/必填規則。定義見 [analysis-counterstrafe.md](docs/operational/analysis-counterstrafe.md)。 |
| **`holdDurationMs`／hold→reversal 狀態機(`counterstrafe-reversal-v1`,WP-37 T2)** | `DrillRunner.tickHoldReversal()` 只追蹤目前可見目標:目標可見的第一個 tick 以其 `side` 決定方向並蓋第一個 cue(量測起點=可見,不耦合 foreperiod/spawn);之後每 tick 檢查 `state.held.left/right` 是否仍持有該方向鍵——**放開即把計時器重設為 `null`**,重新按住從當下時刻重新起算,沒有「累積按住時間」語意;連續按住達 `holdDurationMs` 的同一 tick 蓋第二個(反向)cue,每個目標最多兩個 cue。落在 `DrillRunner` 而非 `TargetManager`(D-37.1:`DrillRunner` 已持有 `state.held` 與生命週期/reset 邊界)。既有 `peekTimeoutMs`/`presentationMs` 到期閘先撤除目標,`tickHoldReversal()` 才執行,不建立第二套逾時語意;目標撤除時整組追蹤狀態重設。反向輸入的成功/失敗留給離線 metrics 判定,sim 內只記錄事件。定義見 [analysis-counterstrafe.md](docs/operational/analysis-counterstrafe.md)。 |
| **`timeToAccuracyGateMs`／`zeroCrossingMs`／`stopDistanceU`／`overReversalUPerS`(制動四量,WP-37 T3)** | `deriveBrakingSamples()`([brakingDerivation.ts](src/metrics/brakingDerivation.ts))自每個 peek 的 `tCounter` 起、至首發或窗口結束為止逐 tick 掃描 `vx`/`px`。速度門檻唯一讀取 `CS2_PROFILE.accuracyThreshold`(`MovementController`),不新增第二套常數(C-D4 精神延伸)。四量分別是:首次 `\|vx\|<threshold` 的時刻差(`timeToAccuracyGateMs`)、首次 `vx` 變號的時刻差(`zeroCrossingMs`)、gate 命中 tick 與 `tCounter` 的 `px` 差值(`stopDistanceU`)、變號後 `\|vx\|` 峰值(`overReversalUPerS`)。缺失**不以零值補**,一律回傳 `undefined` 並記對應 flag(`no_accuracy_gate`/`no_zero_crossing`/`window_truncated_by_fire`/`no_counter`/`no_counter_tick`)。定義見 [analysis-counterstrafe.md](docs/operational/analysis-counterstrafe.md)。 |
| **`counterstrafe-cued-v1`／`-reversal-v1`／`-free-v1`(急停三協定,WP-37)** | `cued`(assessment,`cue:{kind:'single'}`)/`reversal`(assessment,`cue:{kind:'hold-reversal',holdDurationMs}`)/`free`(practice,省略 `cue`,既有自訂節奏的等價包裝)。`deriveCounterstrafeMetrics()`([counterstrafeMetrics.ts](src/metrics/counterstrafeMetrics.ts))組裝三協定共用指標(`cueToKeyMs?`/`releaseToFireMs`/`counterHoldMs`/`counterToFireMs`/制動四量/`fireBeforeGateRate`/`firstShotHitRate`),`SidedStat` 一律用 `compute.ts` 既有「依 `side` 分兩組 `stat()`」型式,**不含任何單一分數欄位**——三個急停子協定不共用未分層總分。`cueToKeyMs` 的反應構念錨點是**系統發出的 cue 時刻**,與 `hold-click-v1`/`hold-track-v1` 的可見度 onset 錨點不同,不可跨家族直接比較(OQ-S6-22)。定義見 [analysis-counterstrafe.md](docs/operational/analysis-counterstrafe.md)。 |
| **切換時間** | `t_next_acquisition − t_prev_kill`：擊殺一目標到對下一目標有效對齊的時間。WP-25 projectile 下「是否 kill」可由 `hit.shotSeq` 回填，但時間錨仍用成功 shot 的 `t_fire`，避免既有時序指標被飛行時間重定義。 |
| **節奏穩定度** | 各循環耗時的標準差／變異係數。⚠️ P2 下「循環耗時」有兩種錨可選：`t_visible→t_kill`（含補槍 cleanup）或首發間隔（`t_firstShot`）；兩者量的是不同技能（清目標節奏 vs 首發節奏），分析端擇一——**兩個錨都要記**。 |
| **左右對稱性** | 左 peek 與右 peek 在反應時間與命中率上的差異。 |
| **速度 gate（velocity gate）** | 以速度是否夠低（階段 A 為「已停止」flag；階段 B 為精準度門檻 ~88 u/s）決定開火是否精準的判定機制。 |
| **pre/post（前後測）** | 研究方法學：證明訓練成效需前後測對照與適應週期。**單純本地觀察只能得到受試者內相對值。** |
| **雜亂度階層（clutter tier）** | 場景的實驗定義軸：以可量測的視覺統計（雜亂度／對比分佈／深度線索密度）分階（`field-low`／`urban-high`／`mixed-mid`），取代品牌擬真作為場景需求規格。偵測 RT 受背景雜亂度調變——雜亂度是要控制／操弄的自變因，「像哪款遊戲」不是。場景為**寫實原創**：不複製特定遊戲地圖配置（GD-9）。 |
| **資格閘（eligibility gate）** | 遠端施測 session 開始的**軟體自動檢查**：原生解析度 ≥ 實驗最高條件（`screen.width × devicePixelRatio`）、fullscreen 強制、效能地板（frame-time 超標 → `suspect`／剔除）；**不合格拒入實驗，非僅記錄**。搭配**受試者內解析度對比**（同面板跑全部條件、順序對抗平衡，面板特性一階抵銷）；解析度實驗構念＝「同一面板上的 render 解析度效應」。螢幕型號／觀看距離等自陳欄位僅作 moderator（GD-10）。 |
| **三層實驗結構（experiment→session→drill）** | 對映 FPSci 的 experiment→session→trial。**drill** = 本表既有定義；**session** = 一次施測（資格閘 → setup 表單 → 條件序列 → 匯出），引擎面宣告 = `ProtocolConfig`（WP-22 T2）；**experiment** = 多 session 的組合與統計設計，屬**分析端概念、引擎不實作**。跨場次串接鍵 = **`participantId`**（研究者發放代號）+ **`sessionLabel`**（pre/post/day-N），setup 表單自陳、進 meta `session` 區塊——前後測資料離線串接不靠檔名人工紀律（2026-07-07 grill，FPSci R3 對齊；授權紅線 GD-11）。 |
| **ADS（開鏡 / aim-down-sight）** | 右鍵**按住**開瞄準鏡（hold 語意，OQ-S5-6）：視野收窄（FOV↓）放大目標、滑鼠感度依 **GD-16** 換算（通常變慢），放開回復。屬**視覺/操作**層，**不改** sim 演進、命中幾何或彈道語意（GD-16）。研究構念 = ADS 條件下的獲取／首發／追蹤表現；效度靠逐 tick `ads` flag ＋ ads 事件離線還原（FR-E6，缺記錄該 drill 分析無效）。管線術語見 §G。 |

---

## B. 架構元件（components — 系統內部正規名）

| 元件 | 職責 | 層 |
|---|---|---|
| **`InputSampler`** | ~1000 Hz 事件驅動採樣鍵鼠、蓋高解析度時間戳、寫入輸入緩衝（F1） | 輸入 |
| **`SharedState`** | 三迴圈唯一溝通管道：輸入緩衝（固定欄位 ring buffer）、player velocity、準心、目標狀態、`t_visible`（單例）。階段 B 的兩道跨執行緒縫＝**輸入佇列**（主→worker）與 **`RenderSnapshot`**（worker→主）；其餘狀態跟著 sim 進 worker、不跨界。 | 狀態 |
| **`research/` 離線分析層** | 單向消費 schema v2 匯出，提供 ingest、角運動學、版本化 submovement 分段及後續逐段指標（含 WP-31 的 SPARC／Key-Velocity xcorr／Fitts）；`algorithms/` 維持純函式，掃參、疊圖與檔案輸出只在 notebooks。跨模組 CLI 入口 = `src/report/run_pipeline.py`（匯出 → dt 報告 → ω/ε → 分段 → 品質摘要，一道指令），為 WP-29/30/31 的共同入口；教練面的單一交付入口 = `src/report/coach_report.py`（匯出 → 單檔靜態 HTML 教練報告 **v2**：主表 + phase/curve 新構念 + WP-31 研究向區塊）。 | Python / 離線研究 |
| **`SimLoop`** | 128 Hz 固定步長 accumulator 迴圈：消費輸入 → movement → 急停判定 → 命中判定 → 記錄（F2/F3） | 模擬 |
| **`MovementController`** | A/D 橫移 + 急停（階段 A 簡化「立即停止」/ 階段 B physics）；介面跨階段不變（F3）。**狀態機 = M1**：鍵恆為移動鍵，反向鍵在穿越方向那一 tick 把 velocity **snap 到 0**（即「立即停止」）＋升 `stopped` flag，續按反向鍵 → 下一 tick `−v`（反向/過衝）。橫移亦為**瞬間 snap**（按 A/D → velocity 瞬間 ±`v_strafe`、放開 → 0；無 accel ramp，velocity 為純階梯函數），`v_strafe` config 預設 ~250 u/s。階段 B 把起步與停止都換成 friction+accel integrator，狀態機外形不變。 | 模擬 |
| **`TargetManager`** | 目標 spawn／可見性、左右交替序列、蓋 `t_visible`（F2/F4） | 模擬 |
| **`HitDetector`** | Raycaster 命中判定、首發判定（F3）。**階段 A 單一 hitbox**（命中/未命中；`part` 欄位保留選填、向後相容，頭/身分解延後至「精準射擊」維度）。**hitbox 尺寸為資料**（WP-23）：`DrillConfig.targets.hitbox?` 省略 = 唯一預設 H1 `{1,2,1}` 逐位不變;H1 **單一 hitbox 語意不變**,只是尺寸從寫死常數變成 config 值。**單一來源**貫穿 sim 命中(`TargetState.hitbox`)、渲染、淨空、離線 on-target 推導(讀 `meta.targets.hitbox`),同幾何零新門檻由測試釘死(GD-7)。 | 模擬 |
| **`RenderLoop`** | rAF 迴圈，讀 sim 最新狀態做 alpha 內插後繪製 | 渲染 |
| **`SceneManager`** | Three.js 場景、camera、room、crosshair、HUD 容器 | 渲染 |
| **`DataRecorder`** | 每 tick 記錄、**preallocated arena**（**非環狀**；drill 內線性不 wrap，容量 `N = ceil(maxDrillSeconds × simHz)` + 裕度，`maxDrillSeconds` 預設 **300s（5 分鐘）** → ≈ 38,400 槽；跨 drill index 歸零、覆寫同一塊；超出升 `recorderOverflow` 標 suspect）、JSON/CSV 匯出（F1/F2）。容量上限與 drill 雙閘的「總時長」是**同一個數**，正常會先因總時長結束、碰不到上限。定位在 **sim 下游**，由 `simStep` 末端呼叫（非被 render／UI 直接讀）；階段 B 跟著 sim 進 worker、worker 內記錄、drill 結束才 `postMessage` 匯出，故不經 SAB。 | 資料 |
| **`DrillConfig`** | 由資料定義 drill 的 schema（F4） | 設定 |
| **`MetricsDashboard`** | drill 後統計第 5 節全部指標 | 指標 |

---

## C. 架構概念（concepts）

| 術語 | 定義 |
|---|---|
| **雙迴圈（dual-loop）** | 邏輯（sim）與渲染（render）解耦，加上事件驅動的輸入採樣，共三條速率不同的迴圈，互不直接呼叫、全透過 `SharedState` 溝通（ADR-2）。 |
| **fixed-timestep** | sim 以固定步長（128 Hz / 7.8125 ms）推進，產生與幀率無關、deterministic 的 velocity 軌跡。 |
| **accumulator** | fixed-timestep 的實作模式：累加經過時間，每滿一個 TICK 就跑一次 `simStep`，餘量夾住避免 spiral of death。 |
| **simStep 順序（tick 內）** | 每 tick 依序：① 階段 B 目標 motion 更新到本 tick 位置（ADR-6）；② 依 `timeStamp` 排序處理事件串流——鍵事件更新 strafe velocity 與急停 snap（M1）、滑鼠樣本更新準心、**開火事件就地 raycast**（打「本 tick 目標位置 × `t_fire` 當下準心」）；③ 由 velocity 推進玩家位置（固定步長，tick 解析度可接受）；④ `DataRecorder` 記錄 tick row 與事件。玩家側因就地評估而 **sub-tick 忠實、零內插**；目標側 ADR-6 最近-tick 偏差只剩階段 B 移動目標。 |
| **alpha 內插（interpolation）** | render 在兩個 sim tick 之間用係數 `alpha = acc / TICK` 內插，畫面才不抖。 |
| **決定性（determinism）** | 同一輸入序列在不同 render FPS 下，sim **狀態**一致。WP-2.4 / WP-9.3 斷言「同一 tick index 的位置／velocity／命中與否／事件落在第幾 tick」相等，**不**斷言 wall-clock 時間戳（後者本質非決定性）。 |
| **量測時鐘 vs 決定性時鐘（two-clock model）** | 系統用兩個時鐘、各司其職。**量測時鐘** = `performance.now()`，與 `event.timeStamp` 同 time origin、**直接可減**，所有跨角色延遲指標（反應時間、停火時序對齊、切換時間）都在此域計算；非決定性、接受 ≤1 tick／render-frame 量化，量化寫成誤差界線（同 §15 顯示延遲誤差數量級）。**決定性時鐘** = 邏輯 tick index（`tick0 + n·TICK`），`DataRecorder` 每-tick row 以 tick index 為鍵，供決定性測試斷言狀態。⚠️ `event.timeStamp` 與 `performance.now()` 同源可減**僅在 Chromium（鎖定的 Chrome/Edge）成立**；若哪天要支援非 Chromium，這個假設要重新驗。 |
| **`t_visible`** | 目標可見瞬間，在**狀態翻轉那個 sim tick 執行當下**蓋的 `performance.now()` 時間戳（量測時鐘域，F2）；所有反應時間量測的起點。因 tick 在 rAF frame 開頭爆發執行，帶 ≤1 render-frame／1 tick 的量化，記為已知誤差界線。 |
| **sim tick rate** | 階段 A = 128 Hz（= 64×2，便於對照 CS2 的 15.625 ms tick）；設為設定常數，不寫死。 |
| **ring buffer** | 固定大小、物件重用的環狀緩衝，避免配置物件造成 GC 週期性卡頓。**ring buffer 專指輸入緩衝**：真環狀、**消費後槽位重用、drill 內持續繞圈**（事件被 sim 消費即不再需要）；每個 ~1000Hz 事件壓成固定數值欄位 `type,t,a,b`、不 `push` 物件——當下擋 GC、未來 SAB-portable。⚠️ `DataRecorder` 雖也預配置+重用防 GC，但**不是環狀**（每 tick row 要留到匯出）——見 `DataRecorder` 元件列的 **preallocated arena**。<br>**實作定案（WP-3 T4b，[SharedState.ts](src/state/SharedState.ts) `createInputRing`）**：`RING_CAPACITY=512`（2 的冪、`& MASK` 繞圈）；`Uint8Array type`（`EV_KEY=0`/`EV_MOUSE=1`/`EV_FIRE=2`）+ `Float64Array t/a/b`（key：`a`=code enum、`b`=down 0/1；mouse：`a`=dx、`b`=dy；fire 無 payload）。**code enum**（[types.ts](src/state/types.ts)）：`KEY_CODE = { KeyA:0, KeyD:1, KeyW:2, KeyS:3 }` + 反向 `CODE_KEY`。寫入端 **bounded insertion** 保序、`consume` 沿 head 游標排空並解碼進**單一重用 `InputEventView`**（handle 不得保留參考）；滿則 `bufferOverflow++`、拒新不丟舊（GD-2）。 |
| **`RenderSnapshot`** | render 讀 sim 狀態的**唯一窄介面**：一束數值化、可複製的快照（velocity、crosshair、active targets 的 id/position）。render **不得**伸手進 sim 物件圖。語意是「讀一份一致快照」，階段 A 為 plain struct，階段 B 換成 SAB + seqlock／double-buffer 做無撕裂讀取而 consumer 不改。 |
| **cross-origin isolation** | 經 COOP（`same-origin`）/COEP（`require-corp`）標頭啟用，把 `performance.now()` 解析度從 100 µs 提升到 5 µs，並解鎖 `SharedArrayBuffer`（ADR-4）。 |
| **原始輸入（`unadjustedMovement`）** | Pointer Lock 關閉 OS 滑鼠加速，確保 sensitivity 可重現；僅 Chromium 支援，須捕捉 `NotSupportedError` fallback（ADR-5）。 |
| **coalesced events** | `getCoalescedEvents()` 取回次幀的滑鼠樣本，1000 Hz 滑鼠下不遺失中間軌跡（ADR-5）。 |
| **輸入分桶（input bucketing）** | `InputSampler`↔`SimLoop` 的消費契約：事件以 `event.timeStamp` 落在哪個 tick 的**邏輯時間窗 `[tickStart, tickEnd)`** 決定它在哪個 tick 被消費（**非** rAF 爆發時把緩衝清空）——這是決定性的前提。桶內先依 `timeStamp` 排序再處理（解 coalesced 樣本與鍵盤事件的 append 亂序）。遲到落在已關閉 tick 的事件，夾進當前最舊未關閉 tick 並計入 `lateEventCount`；ring buffer 溢位升 `bufferOverflow` flag、該 drill 標 suspect（**不靜默丟最舊**）。`lateEventCount` / `bufferOverflow` 須寫進匯出 metadata。**容量政策**：`RING_CAPACITY = nextPow2(MAX_EVENT_RATE_HZ × MAX_STALL_S × SAFETY)` 為**靜態常數**，彈性放在設定/建置期、**執行期不動態 resize**（resize 會在 burst 當下 realloc+copy、正是 ring buffer 要消除的 GC 抖動，且 SAB 不可調整大小；溢位已由 `bufferOverflow` flag 兜底）。要支援 8000Hz 只改 `MAX_EVENT_RATE_HZ` 重建（最壞 ≈ 8000×0.25 ≈ 2K → next-pow2 4096），記憶體成本可忽略。 |
| **backend（render backend）** | 實際使用的渲染後端：`webgpu` 或 `webgl2`（fallback）。延遲特性不同，必須寫入匯出資料 metadata（ADR-1）。 |
| **正規單位（canonical unit）** | sim 與**所有記錄/匯出資料**一律用 **CS Source unit（u、u/s）**：最大跑速 ~250 u/s、`sv_stopspeed` 75、精準度門檻 ~88 u/s 原樣落地，階段 B 對照 CS2 `cl_showpos` 校準時零換算。`DrillConfig` 座標/range/速度、`velocity`、`residualSpeed` 全部 u/s。render 端可另套 **display scale** 做直覺場景尺度，但 **sim/資料不得用公尺**——避免換算因子在量測鏈埋人為誤差。 |
| **純裝飾場景（decorative scene）** | 場景（佔位房間、未來 BR 背景）只存在 render 層，sim 對其**零知識**；玩家位置在 sim 無界、牆不擋人——本系統既有本體論。場景幾何**不得**成為 sim 輸入（決定性 baseline 不分裂、F4 換場景零引擎碼）。視覺=物理一致性由**淨空驗證**在載入期保證，非 runtime 計算（GD-6）。 |
| **淨空驗證（clearance validation）** | drill 載入時的自動幾何 gate：**視線走廊（sightline corridor）**＝「玩家 strafe 走廊 ∪ 目標運動包絡」之凸包（保守過近似），與場景資產附帶的 **prop-bounds** 清單（僅驗證器可讀、**永不進 sim**）相交即**拒載 drill**（大聲失敗，不靠人工紀律）。玩家活動範圍為 config 宣告假設，runtime 逸出 → 標 `suspect`（純觀測）。走廊淨空 ⇒ 對場景 raycast 與無場景逐位元等價。prop-bounds 為未來宣告式 occluder / 授權 collision 的前身資料（GD-6）。 |
| **occlusion-aware clearance（`ClearanceOptions`，WP-34 T2）** | 淨空驗證的**additive、opt-in** 擴充，解決「一般 drill 要求整條 envelope 零遮蔽」與「`hold-click-v1` 需要目標在 emergence 前被刻意遮蔽」的語意互斥：`validateClearance(scene, drill, options?)` 第三參數 `ClearanceOptions{ allowedOcclusionPropIds?, exposedRestEnvelope? }`。省略時逐位等同現行 strict 行為（既有 `clearance.test.ts` 零修改為機械判準）；帶入時①只有明確列名的 propBounds 可遮蔽 emergence 前路徑，其餘 prop 仍須對整條 envelope 零遮蔽（防止意外遮蔽被誤判為設計意圖），②曝光後靜止子範圍（`exposedRestEnvelope`）必須對**全部** propBounds（含被列名允許遮蔽的）零遮蔽，避免首發判定混入視覺可見性雜訊。Occlusion 語意刻意掛在**呼叫端明確傳入的選項**、不掛在 `sceneId`——`peek-corridor` 場景搭配未帶選項的 `loadDrill(source, scene)` 仍會被 strict clearance 拒載。 |
| **SceneConfig／sceneId（場景為資料）** | 場景比照 drill 為**資料驅動**：`sceneId`（中性命名，不掛遊戲名）＋ `assetPackVersion` ＋ prop-bounds 清單，全部進匯出 metadata；資產改版即斷代。授權紀律：CC0 優先、CC-BY 附 `ATTRIBUTIONS.md` 可 commit；NC／遊戲抽取資產／付費包原始檔**不得**入 public repo（GD-9）。 |

---

## D. 階段定義

| 術語 | 定義 |
|---|---|
| **階段 A（Stage A）** | 本次交付：F1–F4 + 1 個靜止 counter-strafe drill，急停為簡化「立即停止」判定。鎖定 Chrome/Edge 桌面版。 |
| **F5 接縫（seam-in, drills-out）** | 階段 A **建好 F5 的架構接縫**（`SimLoop` step 順序保留 target-motion slot、`TargetManager` 帶 motion registry、`DrillConfig.targets.motion?` 選填欄位、預設 `static` 為恆等策略），但**不交付移動目標 drill**。～2026-07-06 更新：當年延後的三個未決已全數拍板——能力混淆已解（GD-7：drill 分離＋指標層獲取／追隨分離）、追蹤指標已定義（GD-7：TOT%／RMS ε／t_acquire）、slide-in `t_visible` 判準已定義（GD-8：中心穿越宣告邊界；落地待 GD-6 路徑 C 觸發）。移動 drill 交付時程隨 WP-18（entry 僅餘 M8）。規格 v1.1 把 F5 列為階段 A 必要功能，與 seam-in/drills-out 決議不一致，**規格／PLAN／exec-plan 待做一次版本對帳**。 |
| **階段 B（Stage B）** | 未來：以 Source friction + acceleration integrator 復刻 CS2 真實 physics、速度 gate 精準度模型、sim loop 移入 Web Worker、移動目標 sub-tick 命中位置內插。架構已預留。 |

---

## E. CS2 physics 常數（階段 B 校準起點，附錄 D）

| 常數 | 值 | 用途 |
|---|---|---|
| 最大跑速 | ~250 u/s | movement 上限 |
| `sv_friction` | 5.2 | 地面摩擦 |
| `sv_accelerate` | 5.6 | 加速度 |
| `sv_stopspeed` | 75 | 摩擦下限速度 |
| 精準度門檻 | ~max 的 34%（步槍 ~88 u/s） | 速度 gate |

---

## F. CS2 後座力系統術語（階段 B / WP-10；數學核心 `src/recoil/`）

> 後座力數學核心於 WP-10 移植為純數學 TS 模組（零 three/DOM 相依），M5 golden 全綠 2026-07-05。模組輸出一律 **degree**（Source 慣例：pitch 正值朝下）；`degToRad` 與符號翻轉由 WP-13 接線處一次完成。

| 術語 | 定義 |
|---|---|
| **彈道表（recoil table）** | 以武器 `seed` 決定性生成的 64 筆 `(angleDeg, magnitude)` 序列（[recoilTable.ts](src/recoil/recoilTable.ts) `generateRecoilTable`）。ran1 RNG（IA=16807/IM=2147483647）+ full-auto 相鄰彈 Lerp 平滑（0.55）+ 前 4 發抑制係數（0.75→1.0）。AK-47（seed 223）前 8 筆逐位鎖定於 golden。 |
| **ran1** | Numerical Recipes 可攜式 seeded PRNG（[rng.ts](src/recoil/rng.ts) `createRan1`），Valve `CUniformRandomStream` 慣用序列的移植。輸出 `Rng = () => number` ∈ [0,1)；**sim/recoil 禁 `Math.random()`**（GD-5），所有隨機性注入此 stream 且 seed 寫入 metadata。 |
| **aimPunch** | 命中/開火造成的準心角度偏移狀態（pitch/yaw，degree）。每 recoil tick 以 HybridDecay 衰減，開火時由角速度 leapfrog 積分累積。 |
| **rawPunch×2（`aimPunch × 2`）** | 實際**彈道方向**採用的 punch 量 = `aimPunch` 的兩倍（Source 慣例：視覺 punch 與彈道 punch 分離）。AK 10 發後 `rawPunch×2` = pitch −10.18° / yaw −1.56°（golden，±0.01°）。視覺渲染角度用 `viewPunch`（另存、render 端內插）。 |
| **punch 動力學** | [punch.ts](src/recoil/punch.ts) 的 `RecoilState` + `recoilTick`（固定 1/64s）+ `recoilOnFire`。積分順序：先 HybridDecay → leapfrog 半步 → 角速度 `exp(−4.5·dt)` 衰減 → leapfrog 半步；對齊 CS2「先 decay 再 kick」。`recoilTick` 對非 1/64 dt 拋錯（硬約束）。 |
| **HybridDecay** | punch 每 tick 的混合衰減：指數項 `exp(−8·dt)` × 線性項（每 tick 減 `18·dt`，過零即歸零）。以 1/64s 步長定義，禁用變動 dt 代入。 |
| **recoil index** | 已連續開火發數計數，決定查彈道表第幾筆。停火超過 `cycletime × 1.1` 後以 `exp(−dt·ln10·2)` 衰減歸零；開槍時遞增。 |
| **cycletime** | 武器連射週期（秒）。AK-47 = 0.1s。決定產彈節奏（WP-11）與 recoil index 衰減延遲門檻（`× 1.1`）。 |
| **inaccuracy 三成分** | 擴散總量 = 站立基礎值（stand）+ 每發累積 `inaccuracyFire`（以 `exp(−dt·ln10/recoveryTime)` 回復）+ 移動附加 `(v/vmax)^0.25 × move`（[spread.ts](src/recoil/spread.ts) `sampleSpread`）。取樣 θ 均勻、半徑 = U(0,1)×inaccuracy（中心偏置），每發固定 2 次注入式 RNG 取樣（θ 先、radius 後）。 |
| **理想壓槍路徑（ideal recoil-compensation path）** | 完美抵銷 `rawPunch×2` 累積偏移所需的反向滑鼠軌跡；結果頁以玩家實際補償 vs 此理想路徑對照量測壓槍表現（WP-16）。彈道檢查頁（[patternViewer.ts](src/recoil/patternViewer.ts)，dev-only `#pattern`）以 `-aimPunch×2` 逐發點與連線人工核對 pattern 形狀。 |

---

## G. CS2 開火 / ADS 管線術語（WP-11 開火；WP-24 ADS 開鏡；武器抽象 `src/weapon/` + 輸入事件鏈）

> full-auto 開火管線於 WP-11 建立：武器抽象 → fire down/up 事件 → `heldFire` → tick 內 cycletime 產彈 + 彈匣；產彈點保留為 WP-13 recoil `onFire` 的唯一掛點。
> **ADS 開鏡管線**於 WP-24 建立，全面比照 fire 事件模式：`WeaponConfig.ads` → ads down/up 事件（`EV_ADS`）→ `heldAds` → render 端 FOV/感度 gain + scope overlay + 逐 tick 記錄。**只落 input/render/data 層**，不改 sim/命中/彈道（GD-16）。
> **「fire」正名（消歧）**：input 端 = **fire down/up**（扣／放扳機的*意圖*）；產出的一次擊發 = **shot（發）**（≡「產彈」），與既有 `首發`／`shotCount` 一致。`DataRecorder`／metrics 內既有的 `type:'fire'` row 語意是「一發 shot」（legacy 欄名，**不改**）。WP-25 projectile 另有 `type:'hit'` row 表示 delayed impact；`timeOfFlightMs = t_hit - t_fire`，但既有八指標的時序錨不從 `fire.t` 搬到 `hit.t`。

| 術語 | 定義 |
|---|---|
| **`WeaponConfig`** | 武器抽象 schema（[WeaponConfig.ts](src/weapon/WeaponConfig.ts)）：`cycletimeSec`、`magSize`、`recoil{seed, magnitude, magnitudeVariance, angleVariance}`、`inaccuracy{stand, crouch, fire, move, recoveryTimeStand, recoveryTimeCrouch}`、選填 `recoveryTransition{startBullet, endBullet}`。`validateWeapon` 為零相依 runtime guard（比照 [drill/schema.ts](src/drill/schema.ts)），field-path 錯誤訊息、成功回窄化 config。⚠️ 階段 A（靜止站立 + strafe）僅用到 `inaccuracy.stand/move` 與 recoil 欄；`crouch`／`recoveryTimeCrouch` 為未來預留。 |
| **內建三把（`WEAPONS`）** | [weapons.ts](src/weapon/weapons.ts)：`ak47`（seed 223）、`m4a4`（seed 38965）、`m4a1s`（seed 38965）。`getWeapon(id)` 取用，未知 id 拋錯。M4 系列的 stand/crouch/move/recovery 暫繼承 AK 同一 stage2 baseline（`BASE_INACCURACY`），待 **WP-15 calibration** 補齊 per-weapon CS2 vdata 後再調。 |
| **fire down/up 事件** | input 端的擊發**意圖**：`{ type:'fire'; down: boolean; t: number }`。ring packed 以既有閒置 `b` 欄存 `down`（0/1），容量／佈局不變。fire-up（`down=false`）與 PointerLock 解鎖時補送的 **stuck-fire 防護** fire-up，共同維護 `heldFire`。⚠️ 與 §A 的「shot（發）」是不同層次的事件，勿混。 |
| **`heldFire`** | `SharedState` 旗標：扳機是否按住。fire-down 置真、fire-up／解鎖置假；為 full-auto 產彈排程的閘之一。 |
| **產彈排程（shot scheduler）** | `SimLoop` tick 內的**累加制**產彈（防漂移）：`while (heldFire && ammo > 0 && nextFireT <= tickEndMs) { 產一發 shot; nextFireT += cycletimeSec*1000 }`。首發（從閒置／停火後）`nextFireT = fire-down 事件的 t`。**禁**用 `nextFireT = now + cycletime` 重設制（會累積漂移；T3 DoD：30 發 span = 2900ms ± 1 tick）。 |
| **`nextFireT`** | 下一發 shot 預定產出的量測時鐘時間（ms）。以 `+= cycletimeSec*1000` 累加推進，非「當下 + cycletime」重設。 |
| **彈匣政策（ammo / magSize）** | `ammo` 每發遞減，`ammo === 0` 即停火；**stage2 不做 reload**（OQ-S2-6）。**`ammo` 於每個 peek／每次目標 spawn 重置回 `magSize`**——每 peek 一整匣，噴射獨立、左右 peek 可對照（不被殘彈污染），「drill 一 peek ≤ 一匣」由此成立。 |
| **產彈點 = recoil 掛點 seam** | WP-11 的產彈仍走既有 camera-center raycast（WP-5 路徑）；WP-13 在**同一點**呼叫 `recoilOnFire` + `sampleSpread` 並替換方向來源。此點是 recoil `onFire` 的**唯一**掛點。 |
| **`recoveryTransition`（選填）** | 每武器覆寫前段彈抑制斜坡的彈序窗 `{startBullet, endBullet}`，對應 §F 彈道表「前 4 發抑制係數 0.75→1.0」；未給則用預設。 |
| **`WeaponConfig.ads`（選填）** | 武器 ADS 光學：`{ fovDeg, sensitivityRatio }`。**省略 = 該武器不可開鏡**（ADS 為 no-op，維持 hip 視角）。`fovDeg` 只驗**正有限**（zoom-in 由 `fovDeg < hipFov` 於相機層自然成立；hipFov 為使用者/相機設定，不在武器資料內，validator 無從夾）；`sensitivityRatio` 正有限、預設 `1.0`。additive optional 加欄，對既有武器資料／schema **零破壞**；示範值加在 `ak47`（預設 drill 武器）。 |
| **ADS down/up 事件** | input 端開鏡**意圖**：`{ type:'ads'; down: boolean; t: number }`，event code `EV_ADS = 3`。ring packed 佈局**比照 fire**（`a=0`、`b=down` 0/1），容量／佈局不變、既有解碼零破壞。右鍵（`button===2`）down 走 pointer-lock 採計閘門、up 不受閘門（但需已採計 down）；鎖定中 `contextmenu` 抑制。走既有升冪分桶消費（`consume` 零改）。 |
| **stuck-ads 防護** | PointerLock 解鎖／blur 時若右鍵仍按住，由 `InputSampler.releaseAds(t)` 補送一筆**可被消費/記錄**的 ads-up（非直接寫旗標），避免 `heldAds` 永真跨 drill 汙染。比照 stuck-fire，掛在 `main.ts` 的 PointerLock onChange。 |
| **`heldAds`** | `SharedState` 旗標：右鍵是否按住開鏡。ads-down 置真、ads-up／解鎖置假（比照 `heldFire`）。**只 input/render/data 層可讀**：render 端切 camera FOV 目標 + 感度 gain、資料端逐 tick 記為 `ads` flag；`SimLoop.applyInput` 的 ads 分支**只翻此旗標**，不觸發 raycast／weapon schedule／目標演進（GD-16）。 |
| **ADS 感度換算（GD-16）** | 開鏡有效感度 = `sensitivity × sensitivityRatio × (adsFov / hipFov)`（CS2 式 FOV-ratio；pre-registered 後凍結）。gain 只乘 `CameraController.applyDelta` 的**使用者 delta**，**不**套到 punch／彈道／sim（避免雙重計入）。gain 為**階躍**（切換即完整目標態，分析可分），非隨 FOV 漸變。 |
| **ADS FOV 過渡（render-only）** | 開鏡切 camera FOV 目標值（hip↔ads），實際 FOV 以 render 幀線性內插趨近（`ADS_FOV_TRANSITION_MS = 120`，OQ-24.1）；**不進 sim／記錄**（記錄的是 `heldAds` 事件與 flag，非視覺過渡）。`CameraController.setAds(active, nowMs)` 顯式收 render `now`、不讀時鐘（可測、守時鐘域紀律）；過渡中反向切換自當前值起不跳變。 |
| **scope overlay** | 純 TS + DOM overlay（D1，[ScopeOverlay.ts](src/ui/ScopeOverlay.ts)）：ADS 時顯示圓形鏡框 + 周邊暗化，120ms 淡入淡出。`pointer-events:none`（不影響 Pointer Lock／canvas click）；準心（`Crosshair`）以較高 z-index **維持精確置中**（§A 準心紀律不變）。顯隱有效態 = `heldAds && weapon.ads !== undefined`。 |
| **ADS 記錄（FR-E6，效度必要條件）** | aim 資料已含 gain，離線分析**必須**靠 `ads` flag 還原構念：tick row required `ads` boolean（取 `state.heldAds`）+ ads down/up 進 `events[]`；JSON／CSV 皆含。metadata `meta.weapon`（additive optional snapshot：`id` + `ads{fovDeg,sensitivityRatio}`）供分析端重建 gain。缺記錄 = 測試紅。 |

---

## H. 彈道 / tracer 術語（WP-25，M12；純數學核心 `src/ballistics/` + render `src/render/TracerView.ts`）

> **雙軌分離**於 WP-25 建立：**(a) tracer 軌跡顯示**是 render-only 顯示層（sim 演進零改動）；**(b) projectile 彈道模型**才動命中語意，且 **config-gated——`WeaponConfig.bullet` 省略時走現行 hitscan 路徑、逐位不變**（M12 門控核心，比照 WP-21「無 seed 逐位不變」）。
> **M12 門控**：hitscan 逐位回歸綠 + projectile golden（位置序列／命中 tick）+ tracer 單 draw call／sim 零改動 + shot/hit 事件 schema 對帳全綠後，`bullet` 欄自此可進 drill config（WP-26 T3 整合 drill 解鎖）。

| 術語 | 定義 |
|---|---|
| **tracer（軌跡顯示）** | 子彈飛行軌跡的**純視覺**呈現。sim 在產彈點已算出射線（hitscan）或子彈路徑（projectile），只多寫一筆 `shotRays` 環形格；**render-only、UI 可開關、不進 export／不改命中或指標語意**（GD-17／WP-25 硬約束）。命中彈端點 = 命中點；未命中 hitscan 端點 = `projectMissOntoEngagementPlane` 交戰平面投影（OQ-25.1），projectile 端點 = 子彈消滅點（`maxRangeU` 到達或失活點）。 |
| **muzzle origin（槍口原點）** | tracer 的**視覺起點**，於開火 tick 由命中／彈道原點加上相機本地 hip 或 ADS 偏移計算並凍結。hitscan 直接寫入 `shotRays`；projectile 先寫入 `BulletArena.mx/my/mz`，消滅時再供 tracer 使用。此座標 **render-only，不進 raycast、`arena.x/y/z`、`arena.ox/oy/oz`、命中事件、彈道存活判定或 export**（WP-27／GD-18）。 |
| **`shotRays`（環形格）** | `SharedState` 的 tracer 專用 preallocated ring（`ShotRayRing`：`ox,oy,oz,ex,ey,ez,seq` typed arrays + `total/cursor`，容量 `TRACER_CAP`），比照 `ImpactRing`。sim 唯寫（`pushShotRay`），render 唯讀；`seq=0` 為空槽哨兵。**sim 產彈點最多寫此 ring**，`TracerView` 不得回寫 sim／不記錄 export（WP-25 硬約束）。 |
| **`TracerView`** | render 唯讀 tracer view（[TracerView.ts](src/render/TracerView.ts)）：單一 `InstancedMesh(TRACER_CAP)` **單 draw call**、`seq` 高水位增量同步、`Object3D`/向量 scratch 重用（比照 `ImpactView`）。壽命漸隱採 **render-time 縮尾**（非 per-instance alpha，保單 draw call）；expired instance 以 `1e-9` 極小 scale 隱藏。tracer 關閉 = render loop 不呼叫 `sync`（零同步工作）。 |
| **彈道模型 gate（`WeaponConfig.bullet`）** | 選填 `{ model:'projectile'; speedU; gravityU; maxRangeU }`。**省略 = hitscan（現行 `ballisticRaycast` 路徑，程式碼路徑零改動、逐位不變）**——這就是使用者要的 Bullet Type Enabled/Disabled 開關，同時保護 stage1–3 全部 golden/決定性 baseline。`validateWeapon` field-path 驗證；對到靶飛行時間 `< 2 ticks` 的組合發 warning（退化 hitscan）。參數域 = GD-17（見 §E 下方註／DECISIONS）。 |
| **`stepBullet` / `BULLET_DT_SEC`** | 子彈演進純函式（[bullet.ts](src/ballistics/bullet.ts)）：**固定 1/128s 步長**（`BULLET_DT_SEC`；非 1/128 拋錯，比照 `recoilTick`）、半隱式 Euler（先 `vy -= g·dt` 再位移）、**禁時鐘、禁 `Math.random`**（方向由產彈點 seeded spread 決定，彈道本身無隨機）。零 three/DOM 相依（比照 `src/recoil/`）。 |
| **`sweptHitTest`（掃掠命中測試）** | slab-method（[sweptHit.ts](src/ballistics/sweptHit.ts)）：子彈 segment（上一 tick position → 本 tick position）對「**本 tick 目標 AABB**」測試，回傳第一個 segment fraction `s∈[0,1]` 或 `null`（OQ-25.3；不做目標 sub-tick path 內插）。**非點採樣 → 高速彈不 tunnel 穿薄 hitbox**。**只測目標 hitbox，永不測場景幾何**（GD-6）。`s` 作為 `t_hit` tick 內插輸入。 |
| **子彈 arena（`BulletArena` / `BULLET_CAP`）** | `SharedState` 的欄位式 typed-array arena（preallocated、物件重用、跨 loop 重用），`BULLET_CAP = 60`（AK `magSize × 2`；一匣連發 + 飛行殘留裕度，OQ-25.2）。滿載 = 拒發、不扣 ammo、不記 fire row、遞增 `state.bullets.overflowCount`；projectile export 於 `meta.weapon.projectileOverflow` 記旗標。simStep 內子彈演進排在「目標 motion 更新到本 tick」**之後**、記錄之前。 |
| **time-of-flight（`timeOfFlightMs` / `t_hit`）** | projectile 專屬 additive `type:'hit'` 事件：`timeOfFlightMs = t_hit − t_fire`，關聯產出它的 shot 序號 `shotSeq`。既有 `type:'fire'` row 語意（= 一發 shot）**不變**；**既有八指標的時序錨不從 `fire.t` 搬到 `hit.t`**（§A 首發／切換時間、§G「fire 正名」）。首發命中率 = 首發 shot 的 outcome，由同 `shotSeq` 的 `hit` 事件回填（hitscan 仍直接讀 `fire.hit`）。 |
| **lead 誤差（提前量，spec-only 離線）** | 移動目標 × 飛行彈下，玩家應提前瞄準的量與實際瞄準的差。**引擎零新計算**——僅 `docs/operational/analysis-lead.md` spec + [leadDerivation.ts](src/metrics/leadDerivation.ts) 離線 verifier，消費 schema v2 export + `meta.weapon.bullet` + fire-time view angles + 目標 tick 軌跡；命中彈用 linked `hit.timeOfFlightMs`，未命中 exploratory sample 標 `timeOfFlightSource:'estimated'`。**不進正式結果頁/八指標**（OQ-S5-5）；pilot 顯示構念有效再另案晉升 pre-registered metric。 |

---

## I. Assessment 契約術語(WP-33,M16;共同契約 `docs/operational/analysis-assessment-contract.md`)

> stage6(個人瞄準能力測試框架 v1)三家族(架槍/Spider Shot/急停)與診斷層共用的契約層;WP-33 只交付型別/純函式,零引擎邏輯。詳見 [analysis-assessment-contract.md](docs/operational/analysis-assessment-contract.md)。

| 術語 | 定義 |
|---|---|
| **`AssessmentMode`**([assessmentContract.ts](src/drill/assessmentContract.ts)) | `'assessment' \| 'practice'` 二態列舉,由 `DrillConfig.mode?` 宣告。**省略 = `'practice'` 語意超集**,既有 63+ 份 drill config 零回溯相容成本。五軸契約(難度/隨機性/即時回饋/歷史比較/重試)見契約文件 §2。 |
| **`Meta.assessment`**([metadata.ts](src/data/metadata.ts)) | 獨立於既有 `Meta.protocol`(WP-20 pilot 條件分組)的 additive 區塊,只承載 `protocolVersion`(凍結的 Assessment 任務協定版本字串,如 `hold-click-v1@1.0.0`)與 `assessmentFeedbackPolicy`(`'minimal-end-of-block' \| 'unrestricted'`)。兩區塊可同時存在、互不覆寫、互不推導對方(C-D4 精神)。 |
| **`gameMovementProfile`** | stage6 文件的概念命名,**權威欄位仍是既有 `Meta.movementModel`**(首版固定 `'cs2-source'`)。禁止新增第二個攜帶相同語意的 metadata key。 |
| **`sessionId`**(推導,非儲存) | 由 `meta.session.participantId + meta.startedAt` 或等價穩定序列化決定性推導,**不**是 `SessionMeta` 的儲存欄位。權威實作為 [`deriveSessionId()`](src/metrics/compatibilityKey.ts);下游一律呼叫此函式,不得另行拼接。 |
| **`CompatibilityKey`**([compatibilityKey.ts](src/metrics/compatibilityKey.ts)) | 十欄位封閉的相容比較鍵(`participantId`/`taskId`/`protocolVersion`/`gameMovementProfile`/`weaponId`/`weaponMode`/`sensitivityFovKey`/`targetConditionCell`/`assessmentFeedbackPolicy`/`qualityGateStatus`)。由 `buildCompatibilityKey()` 組裝、`checkCompatibility()` 全等比較(非模糊比對,任一欄不等即不相容)。新增第十一個欄位須升版並記錄,不得原地插入。v1 `weaponMode = meta.weaponId`(OQ-S6-10 拍板,單武器現況下的非損失性佔位)。 |
| **`qualityGateStatus`** | [`checkQualityGate()`](src/metrics/compatibilityKey.ts) 的**回傳值**(`'insufficient-n' \| 'incompatible-protocol' \| 'suspect-run' \| 'ok'`,固定優先序判定),**不是**逐 drill 記錄的 export metadata 欄位——由呼叫端在診斷/呈現時機當場計算。 |
| **`recommendationVersion`**([diagnosisRules.ts](src/metrics/diagnosisRules.ts),WP-38) | 診斷規則表本身攜帶的版本字串,屬 `DiagnosisResult`(status `'ok'`)欄位,**不進 export meta**——與 `protocolVersion` 獨立(OQ-S6-25):同一份原始匯出可用新版規則表重新診斷,原始指標不變、只有規則解讀可能不同,已記錄的診斷標籤不因規則表升版被回改。門檻改動一律升 `DiagnosisThresholds.version`,見 [analysis-diagnosis.md](docs/operational/analysis-diagnosis.md)。 |
| **`AssessmentTimelinePoint`**([assessmentTimeline.ts](src/data/assessmentTimeline.ts)) | 事件時間線**欄位形狀**契約(`tFirstVisible`/`tMeasurementOnset`/`tFullExposure`/`tStop`,皆 optional readonly),不含計算。既有 `t_visible`/`t_detect`/`t_first_on_target` 等既有構念名稱**禁止**被下游 WP 重新賦予不同語意;新可見度計算由 WP-34 實作。 |

---

## J. 診斷 / 個人歷史術語(WP-38,M16;共同契約 `docs/operational/analysis-diagnosis.md`)

> 消費 WP-34/35/36/37 已落地的逐構念指標,產生單一 session 的診斷標籤與跨 session 個人歷史聚合;零新幾何/時間推導(C-D4 精神延伸)。

| 術語 | 定義 |
|---|---|
| **`DiagnosisLabel`**([diagnosisRules.ts](src/metrics/diagnosisRules.ts)) | 七個訓練限制模式的封閉列舉(`preaim-placement`/`visual-motor-onset`/`flick-control`/`click-timing`/`tracking-maintenance`/`counterstrafe-braking`/`fire-commitment`)。`evaluateDiagnosis()` 依框架 v1 表格順序判定,第一個完整證據鏈為唯一 `primary`,並排除後續模式(`secondary` 恆缺席,D-38.4)。 |
| **`SessionSummary`**([sessionHistory.ts](src/metrics/sessionHistory.ts)) | 個人歷史聚合的輸入單位(`compatibilityKey`/`sessionId`/`startedAt`/`diagnosis`/`speedMetric`/`accuracyMetric`)。純資料形狀,不含載入邏輯——由獨立 loader([sessionHistoryLoader.ts](src/data/sessionHistoryLoader.ts))把磁碟匯出檔轉成陣列,只接受含 `meta.assessment` 的 Assessment 匯出(D-38.6)。 |
| **`SessionHistoryResult`**([sessionHistory.ts](src/metrics/sessionHistory.ts)) | `buildSessionHistory()` 的回傳型別:`status: 'ok'`(附相容 `eligible` 陣列 + median/population SD 的 speed/accuracy)或 `'insufficient-data'`。不含德爾塔或箭頭方向欄位——不相容或 `n < minN` 一律短路,不產生進步/退步結論(FR-F15)。 |
