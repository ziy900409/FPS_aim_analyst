# WP-57 — progress.md

> 主規格：[README.md](README.md) · 清單：[task-checklist.md](task-checklist.md)

## Progress

| Task | Status | Started | Completed | Evidence |
|---|---|---|---|---|
| T0 Entry Gate | Not started | — | — | 規劃完成，可開工 |
| T1 Geometry Contract and Resolver | Blocked by T0 | — | — | — |
| T2 TargetManager Branch | Blocked by T1 | — | — | — |
| T3 Wide Arena Scene | Blocked by T1 | — | — | — |
| T4 Export and Conditions | Blocked by T2 | — | — | — |
| T5 Repositioning Flag | Blocked by T4 | — | — | — |
| T6 Wiring and E2E | Blocked by T2–T4 | — | — | — |
| T-exit | Blocked by T1–T6 | — | — | — |

## Decision Log

| ID | Date | Decision | Owner | Evidence |
|---|---|---|---|---|
| D-57.P1 | 2026-09-07 | 建立新 drill 檢測**大幅度拉槍**：周邊目標貼近選手使用 FOV 的水平極限角度，高度不超過中心目標 ±15° | 使用者 | 原始需求 |
| D-57.P2 | 2026-09-07 | 周邊 yaw 幅度**依 runtime FOV 比例縮放**（非固定絕對角、非離散 preset 查表），以取得「每位選手同樣貼邊」的主觀等價 | 使用者（AskUserQuestion） | README §2.4 |
| D-57.P3 | 2026-09-07 | 上述比例縮放以 **arm-time 解析一次並凍結進 config** 落地，而非 sim runtime 讀 FOV／aspect。依據：`DataRecorder.ts:124` 記載 drill 內 FOV/sensitivity 不可能變動（KI-003 Lock），故無需 per-spawn 讀取；此結構同時守住 GD-6／GD-10 與逐 tick 決定性 | Engineering | README §2.2／§2.9；NFR-57.5 為其硬閘 |
| D-57.P4 | 2026-09-07 | 目標**完整可見、貼邊但不被切**（非部分裁切、非畫面外靠 cue 引導）。因此不需要任何 cue 子系統，且刺激定義乾淨 | 使用者（AskUserQuestion） | README §1.3 Out of scope、FR-57.4 |
| D-57.P5 | 2026-09-07 | `pitch` 為**干擾項**（均勻隨機防背位置），不是條件變因。分層網格只用它做平衡，`targetConditionCell` 不含 pitch | 使用者（AskUserQuestion） | FR-57.5、README §2.6 |
| D-57.P6 | 2026-09-07 | 低感度選手的**抛滑鼠**混淆因子處置 = 記錄 `cm/360` ＋標註可疑 trial（不封頂 yaw 幅度、不設感度參加門檻） | 使用者（AskUserQuestion） | README §2.8、T5 |
| D-57.P7 | 2026-09-07 | 場景策略 = **新增寬場 arena、距離固定 8u**（不採「距離隨 FOV 一起解析並留在現行房間」）。現行 `[10,10,3]` 房間在任一 FOV 下都穿側牆 | 使用者（AskUserQuestion） | README §2.5、FR-57.9 |
| D-57.P8 | 2026-09-07 | v3 在程式碼裡 = **`SpiderShotScheduleConfig` union 加第三支 kind**（不建在 `targets.spawnArea` 上、不另開獨立 config 欄位） | 使用者（AskUserQuestion） | FR-57.1、README §2.3 |
| D-57.P9 | 2026-09-07 | spawn 幾何改用 **eye-frame 球面**，不沿用 v1/v2 的 origin-frame 圓錐，也不沿用 `angularSpawnPose()` 的圓柱。理由見 Surprises 第 1／2 條 | Engineering | README §2.2；GD-32（T0 入帳） |
| D-57.P10 | 2026-09-07 | 規劃文件採 stage10/WP-50 的 README／checklist／progress／T0～T6／T-exit 結構 | 使用者 | 本文件組 |
| D-57.P11 | 2026-09-07 | v1 交付為 **practice／researcher-only**：不晉升 Assessment、不進 history／compatibility／`DrillMetricRegistry`。理由：時序參數與貼邊係數皆未經實機校準，且每 cell 樣本數不足支撐信度（C-D3） | Planning default，待 T-exit 覆核 | FR-57.13、README §5 |
| D-57.P12 | 2026-09-07 | 「±15°」讀為**上限**而非要求值；實際 pitch 窗由地板淨空反推。完整 ±15° 在 8 u／眼高 1.6 u 下幾何上不存在 | Engineering | README §2.4 |
| D-57.P13 | 2026-09-07 | **OQ-57.1 收斂**：`drillId = 'spider-shot-wide-v1'`。理由：它是 v1/v2 的同輩不同構念（純水平大幅），非後繼版本；`spider-shot-v3` 會誤示替代關係，而 v1/v2 仍有效且已凍結 | 使用者 | README §1.5／§1.6 |
| D-57.P14 | 2026-09-07 | **OQ-57.2 收斂**：`pitchDegRange = [−6.5, 6.5]`，`floorClearanceU = 0.5`（沿用 `CLEARANCE_MARGIN_U` 慣例）。不做懸空平台／虛空 arena，故完整 ±15° 明確不追求 | 使用者 | README §1.5／§2.4；T3 arena 幾何表 |
| D-57.P15 | 2026-09-07 | `docs/exec-plan/README.md` §2 補上 **Stage 12（階段 L）** 區塊與 §4 相依圖，涵蓋 WP-56／WP-57／WP-58 三列，並指向 stage 層 [`active/stage12/README.md`](../README.md)（關閉該檔標註的「上層索引待補」Open Item）。stage11 的 WP-54/WP-55 表列與 M20/M21 門控列缺口**不在本次範圍**，只把 intro 列舉的 WP 區間改為 `WP-52 ~ WP-55` 並加一行警示，讓缺口可見而非隱形 | 使用者 | 見該檔 §2「階段 L」與 §4 |
| D-57.P16 | 2026-09-07 | **編號衝突已解**：WP-57（spider shot）與 session program 排程器同日在兩個平行 session 規劃，一度都暫用 WP-57／GD-32；依 GD-15「先採納先得」（資料夾先建立）由本 WP 保留 **WP-57／GD-32**，排程器順延重編為 **WP-58／GD-33** | 平行 session 對帳 | [`../README.md`](../README.md) §3 編號分配表 |

## Surprises

> 規劃階段（2026-09-07）從 repo 讀出、與原先假設不同的事實。

1. **既有 spider shot 的錐軸原點不是眼睛。** `peripheralPos()`（`src/sim/TargetManager.ts:150-157`）以 `(0, TARGET_Y, -centerDistanceU)` 建立中心視線正交框，起點是**世界原點**；但眼睛在 `y ≈ 1.6`（`src/metrics/eyeOrigin.ts:69`、`PLAYER_EYE_HEIGHT_U`）。錐軸因此相對真實視線仰起 `atan(1.5/8) ≈ 10.6°`。手算一個「radius 45°、azimuth 90°（正右）」的點：世界座標 `(5.66, 1.04, −5.56)`，從眼睛看是 yaw 45.5°／**pitch −4.0°**，而非設計意圖的 0°。
   `deriveSpiderShotTransitions()` 同樣以世界原點正規化，故 v1/v2 的 spawn 與離線推導**兩端一致地偏移** —— 指標內部自洽、既有結論不失效，但幾何語意與玩家所見不同源。v1/v2 參數已凍結，本 WP 不回頭改，入帳 GD-32。

2. **另一套 yaw/pitch 取樣器是圓柱不是球面。** `angularSpawnPose()`（`TargetManager.ts:102-113`）的 `y = TARGET_Y + tan(pitch)·d` 使水平半徑恆為 `d`，3D 距離 `= d/cos(pitch)`。pitch 15° → 距離 +3.5%、角徑 −3.4%。對 `micro_flick` 的 ±12° 影響小，但本 WP 要把 `W_deg` 當條件變因，不能沿用（且改它會動到 `micro_flick` 逐位行為）。

3. **`ndc_x` 只含 yaw。** 直線透視下 `ndc_x = tan(yaw)/tan(halfHFOV)`，與 pitch 完全無關。所以「貼邊但不被切」是一個**純 yaw 條件**，yaw 與 pitch 可獨立取樣。反查垂直方向：FOV 75、yaw 52°、pitch 15° → `abs(ndc_y) = 0.57`，離上下邊還有四成餘裕 ⇒ 題目給的 ±15° 從來不會造成垂直裁切。

4. **±15° 的真正阻擋是地板，不是 FOV。** 眼高 1.6 u、距離 8 u 時，向下超過 `atan(1.6/8) = 11.31°` 目標球心就貼地；扣掉球半徑與淨空後只剩約 6.9°（0.5 u 淨空）或 8.0°（0.25 u 淨空）。

5. **現行房間在任何 FOV 下都裝不下。** `roomSize: [10,10,3]`、眼睛 `(0,1.6,4)` ⇒ 側牆在 `x = ±5`。8 u 球面上、`k=0.9` 的側向落點：FOV 60 → 5.26 u、FOV 75 → 5.98 u、FOV 120 → 7.24 u —— **每一格都穿牆**；pitch 方向在原 3 u 牆高下亦受限。

6. **FOV／aspect 在 run 內本來就是常數。** `src/data/DataRecorder.ts:124` 已明文記載 KI-003 的 Lock 行為使 drill 內 sensitivity/FOV 不可能變動。這把「arm 時解析一次」從權宜之計變成有依據的正解。

7. **aspect 目前完全不在匯出裡。** `meta.fovDeg` 是**垂直** FOV；水平 FOV 需要 aspect，而 aspect 只活在 `SceneManager.camera.aspect`（`src/render/SceneManager.ts:57`）。這是 `resolvedFrom` 必須存在的直接原因，也是 OQ-57.6（晉升時 `compatibilityKey` 必須補 aspect）的來源。

8. **resolved 參數不需要新 schema 欄位。** `meta.spawn.spiderShot` 是 opaque `unknown`（`src/data/metadata.ts:25`），且 `src/main.ts:741` 已把整塊 config 複製進去 ⇒ 只要參數在 resolved config 裡就自動落匯出。

9. **指標棧完全不用改。** `deriveSpiderShotMetrics()` 的五類構念（switchReaction／movementExecution／stopControl／firstShot／rhythm）只吃 visible 事件 anchors 與既有 canonical derivations，對 spawn 排程方式不敏感，而且正好覆蓋大幅度拉槍的主要失效模式（`overshootDeg`／`microAdjustCount`）。`D_deg` 自然從 ~10–25° 升到 ~45–55°，那是操弄變因而非新指標。

10. **`quadrant` 標籤會退化。** `quadrantForPeripheral()` 對本 drill 會恆定回 `'horizontal'` —— 該標籤是**正確的、只是無辨別力**。故左右分區改由 additive `side` 承載；而 v1/v2 的 `side` 恆為 `'R'`（僅型別佔位，`CONTEXT.md` 第 52 列），兩者語意不同，必須記名。

11. **牆與地板沒有自動淨空閘。** `validateClearance()` 只檢查 target envelope 對 **props**；牆／地板不在檢查範圍內（`src/scene/clearance.ts`）。所以「穿牆／埋地板」目前完全靠人眼，本 WP 必須自帶幾何斷言（T3）。

12. **`playerControl.translation: 'locked'` 已經存在。** WP-56 交付的 additive seam 可直接沿用；而對本 drill 它不是偏好而是**契約前提** —— yaw/pitch 是相對 `eye = sim 原點` 定義的，玩家一橫移，角度語意即失效。

## Open Questions（追蹤用，權威定義見 README §1.6）

| ID | 狀態 | 待誰 |
|---|---|---|
| OQ-57.1 `drillId` 命名 | ✅ 已收斂 2026-09-07：`spider-shot-wide-v1`（D-57.P13） | — |
| OQ-57.2 pitch 窗 | ✅ 已收斂 2026-09-07：`±6.5°`，`floorClearanceU = 0.5`（D-57.P14） | — |
| OQ-57.3 `kLo` / `screenMargin` 貼邊感 | 待實機 | 使用者，T6 |
| OQ-57.4 `peekTimeoutMs` / `timeLimitMs` | 待實機 | 使用者，T6 |
| OQ-57.5 repositioning 門檻 | 待資料 | 使用者 + 工程，T5 |
| OQ-57.6 晉升時 `compatibilityKey` 補 aspect | 已有結論（必須補），不阻塞本 WP | 晉升 WP 的 T0 |
