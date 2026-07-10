# 階段 C 驗收清單 C — WP-22 T3 / FR-C15

> M10(stage3 交付)的驗收對照。句式比照 [acceptance-stage-a.md](acceptance-stage-a.md):
> 每項要嘛有自動測試入口,要嘛有明確手動步驟。自動證據以 2026-07-09 T3 首輪執行為準。
> Companion:[pilot-protocol-stage3.md](pilot-protocol-stage3.md) · [schema.md](schema.md) · [timing-validity.md](timing-validity.md)。

---

## 0. 首輪執行基線

| 命令 | 結果 |
|---|---|
| `npm.cmd test -- src/loop/__tests__/wp22-determinism.test.ts` | ✅ 1 file / 4 tests passed |
| `npm.cmd test -- src/loop/__tests__/wp22-determinism.test.ts src/loop/__tests__/determinism.test.ts tests/regression/determinism.test.ts src/display/resolutionMode.test.ts tests/regression/moving-target-determinism.test.ts` | ✅ 5 files / 38 tests passed |
| `npm.cmd run typecheck` | ✅ `tsc --noEmit` clean |
| `npm.cmd run test:ci` | ✅ exit 0 (`tsc --noEmit`;Vitest 65 files / 505 tests;Playwright 14 tests) |

手動補項:真 fullscreen 的 `resolution_detection_v1` walk-through **已由研究者於 2026-07-10 在本機執行**(Chrome/Edge Edg/146,240Hz 面板,真 fullscreen)。自動 E2E 覆蓋 gate→setup→兩條件→兩份匯出與低解析度拒入;手動補項驗證瀏覽器 fullscreen/下載路徑的實機操作 + 條件級 suspect 隔離。證據見 §2 與 [wp-22 progress](../exec-plan/completed/stage3/wp-22-perception-integration/progress.md)。

---

## 1. 清單 C 驗收項

| # | 驗收項 | 判定方式 | 證據入口 | 首輪狀態 |
|---|---|---|---|---|
| C-1 | 場景置換 ×2 可載入且 metadata 可辨識 | **A**:兩個 `SceneConfig` 測試通過;tracking E2E 匯出 `meta.scene=field-low`。 | `src/scene/scenes/field-low.test.ts`;`src/scene/scenes/urban-high.test.ts`;`tests/e2e/full-drill.spec.ts` `WP-22 tracking_scene_v1` | ✅ |
| C-2 | 淨空拒載會指出違規 prop id | **A**:構造 blocker 進視線走廊,`validateClearance` 回報 prop id;`DrillLoader` 對淨空違規 loud fail。 | `src/scene/clearance.test.ts`;`src/scene/scenes/urban-high.test.ts` intentional blocker case | ✅ |
| C-3 | 資格閘拒入/放行正確 | **A**:native/fullscreen/perf 三軸矩陣;低解析度 protocol gate 拒入且無匯出。 | `src/display/eligibilityGate.test.ts`;`tests/e2e/full-drill.spec.ts` `WP-22 protocol gate` | ✅ |
| C-4 | 三解析度模式 buffer 斷言 | **A**:`native`/`fhd-1080`/`qhd-1440` buffer 尺寸固定;protocol E2E 斷 fhd/qhd 條件匯出 buffer。 | `src/display/resolutionMode.test.ts`;`src/loop/__tests__/wp22-determinism.test.ts`;`tests/e2e/full-drill.spec.ts` protocol case | ✅ |
| C-5 | 受試者內 protocol 全流程 | **A**:`resolution_detection_v1` 兩條件同 session 匯出,各含 `meta.protocol`/`meta.display`/`meta.scene`/`meta.spawn`/`meta.frames`。**M**:真 fullscreen 手動 walk-through 見 §2。 | `src/display/ProtocolRunner.test.ts`;`tests/e2e/full-drill.spec.ts` `WP-22 protocol`;**M 證據**:[wp-22 progress 2026-07-10](../exec-plan/completed/stage3/wp-22-perception-integration/progress.md) T-exit 證據表(三份匯出) | ✅ A / ✅ M(2026-07-10) |
| C-6 | 偵測 round-trip 推導 | **A**:已知 onset 合成匯出 round-trip 後,`t_detect` 誤差 ≤ 1 tick;timeout/anticipation/baseline insufficient 明確。 | `src/metrics/detectionDerivation.test.ts`;[analysis-t-detect.md](analysis-t-detect.md) | ✅ |
| C-7 | 追蹤 × 場景 E2E | **A**:`tracking_scene_v1` 在 `field-low` 跑完,匯出逐 tick `tx/ty/tz` + `px/pz` + aim;`suspect=false`;tracking 指標 sanity 通過。 | `src/drill/tracking_scene_v1.test.ts`;`tests/e2e/full-drill.spec.ts` `WP-22 tracking_scene_v1` | ✅ |
| C-8 | 決定性三不變性 | **A**:跨場景 sim 狀態逐 tick bit-exact;跨解析度模式同上;`detection_popin_v1` 同 seed spawn golden 重現,legacy slot seed path 不漂移。 | `src/loop/__tests__/wp22-determinism.test.ts` | ✅ |
| C-9 | `test:ci` exit 0 | **A**:typecheck + Vitest + Playwright 一條命令全綠。 | `npm.cmd run test:ci` | ✅ |
| C-10 | 場景資產 attribution 可稽核 | **A/M**:`ATTRIBUTIONS.md` 逐項列 `field-low`/`urban-high` 來源、授權、路徑;禁止 CC-BY-NC/遊戲抽取/付費原始檔。 | [ATTRIBUTIONS.md](../../ATTRIBUTIONS.md);場景資產路徑 `public/assets/scenes/` | ✅ |

---

## 2. 手動補項:真 fullscreen protocol walk-through

此步驟補 E2E 無法可靠代表的瀏覽器 fullscreen/下載互動。

1. 啟動本機 dev server,用 Chrome/Edge 桌面版開啟 app。
2. 點「解析度 protocol」,填 `participantId` 與選填 `sessionLabel`。
3. 進入真 fullscreen,確認資格閘通過;若未通過,記錄 gate details 並停止收案。
4. 完成條件 0 `fhd-1080-field-low-detection`,確認下載/匯出 JSON 含 `meta.protocol.conditionIndex=0`、`meta.display.mode='fhd-1080'`。
5. 點下一條件,完成條件 1 `qhd-1440-field-low-detection`,確認第二份 JSON 含 `conditionIndex=1`、`meta.display.mode='qhd-1440'`。
6. 若中途退出 fullscreen 或 frame p95 超過地板,該條件應 `suspect=true`,下一條件不得被整 session 汙染。

手動結果回填位置:[WP-22 progress.md](../exec-plan/completed/stage3/wp-22-perception-integration/progress.md)。

---

## 3. M10 判定

✅ **M10 達成(2026-07-10)**:清單 C 全 10 項綠(自動 9 項 + C-5 真 fullscreen 實機補項)。真 fullscreen walk-through 三份 `resolution_detection_v1` 匯出證據回填 [wp-22 progress](../exec-plan/completed/stage3/wp-22-perception-integration/progress.md);WP-22 T-exit gate 已宣告 stage3 交付。兩感知實驗(追蹤×場景、解析度×偵測)pilot-ready。

> 手動 walk-through 附帶診斷(非缺陷,供施測判讀):QHD 首跑 `suspect=true` = 操作者 strafe 逸出 player corridor(GD-6c 純觀測),靜止補跑即 `suspect=false`;同 run 條件 0 clean / 條件 1 flagged 證明條件級 suspect 隔離。`detection_popin_v1` 為靜止 pop-in 任務,正式 pilot 受試者靜止。
