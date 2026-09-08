# WP-57 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md)

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ✅ | **T0** Entry gate／幾何 PoC／GD-32 | [T0-entry-gate.md](T0-entry-gate.md) | 無 | High |
| ✅ | **T1** Config 契約／eye-frame 投影／resolver | [T1-geometry-contract-and-resolver.md](T1-geometry-contract-and-resolver.md) | T0 ✅ | High |
| ✅ | **T2** TargetManager 分支／分層佇列／決定性 | [T2-target-manager-branch.md](T2-target-manager-branch.md) | T1 ✅ | High |
| ✅ | **T3** 寬場 arena 與幾何斷言 | [T3-wide-arena-scene.md](T3-wide-arena-scene.md) | T1 ✅ | Med/High |
| ✅ | **T4** 匯出 provenance 與 `side` 欄位 | [T4-export-and-conditions.md](T4-export-and-conditions.md) | T2 ✅ + OQ-57.7 ✅（2026-09-07 採選項 (b)，KI-026／GD-32） | Med |
| ✅ | **T5** 抬滑鼠疑慮標註與敏感度表 | [T5-repositioning-flag.md](T5-repositioning-flag.md) | T4 ✅ | Med |
| ✅ | **T6** Arm-time 接線與實機 E2E（**含 T3 延後的 FOV 60／75／120 實機截圖**） | [T6-wiring-and-e2e.md](T6-wiring-and-e2e.md) | T2 ✅ + T3 ✅ + T4 ✅ | High |
| ⬜ | **T-exit** 驗收與晉升 WP handoff | [T-exit-gate.md](T-exit-gate.md) | T1～T6 ✅ | Med |

T1 完成後 **T2 與 T3 可並行**（T3 只需要 resolver，不需要 sim 分支）。T4 需要 T2 產出的真實匯出。**T5 於 2026-09-08 排在 T6 之後執行**（T5 只依 T4，與 T6 無相依），故 T-exit 自此不再被阻塞。**OQ-57.7 已於 2026-09-07 拍板為選項 (b) 並落地**（KI-026／BD-026／GD-32：`deriveSpiderShotTransitions()` 已改用 payload eye，匯出角度為 eye-frame），故 T4 不再阻塞；但 T4 必須**以 eye-frame 為期望值**寫 round-trip 測試，不得沿用 T0／README §2.5.1 記載的 origin-frame 偏差數字（那些是拍板前的量測）。

## Package Definition of Done

- [x] 研究者可載入一個寬場 arena 並跑完整段大幅度拉槍 run；周邊 `D_deg` 落在 45–55° 帶，每個目標完整落在畫面內。（T4：`D_deg` 47.87–51.56°；T6：researcher 控制列可載入並跑到 `ended`，61 個實機 spawn 的 NDC 失敗數 0）
- [x] 周邊 yaw 幅度由當次 FOV／aspect 在 arm 時解析一次並凍結進 config；**run 內 resize／解析度切換不改 spawn 序列**（GD-10 張力已實證化解）。（T2：Node 側 aspect 不變性；T6：實機 16:9 → 5:4 mid-run resize 後 41 個 spawn 逐位一致，且 resize 後重新 arm 的 `yawMax` 由 51.6343 降到 41.6386 ⇒ 不是假陽性）
- [x] 所有 spawn 的 3D 距離嚴格等於 `distanceU`（角徑恆定），pitch 落在對稱窗內且目標下緣對地板淨空 ≥ `CLEARANCE_MARGIN_U`。（T1／T2：10,000／120,000 樣本；T3：612 個落點淨空，最緊為地板 `0.5547 u`；T6：實機每個 spawn `distanceU` = 8）
- [ ] `spider-shot-v1`／`v2` 的 spawn 序列與既有條件欄位輸出**逐位不變**；`spiderShotMetrics.ts` 零修改。
- [x] 刺激幾何（含 aspect）可由匯出 metadata 在零額外假設下重建。（T4：`resolvedFrom` 五欄 round-trip 逐位、由匯出欄位重算 yaw 窗、每個實錄 spawn 皆可由還原參數重建）
- [x] 抬滑鼠疑慮旗標可用、有門檻敏感度表，且明確不進教練報告與 registry（C-D3）。（T5：19 tests；C-D3 閘為「`src/` 內零 importer」；敏感度表與 `cm/360` 方向性表為**合成 cohort**，OQ-57.5 維持開放）
- [x] 本 drill 維持 practice／researcher-only：零 history mutation、無 compatibility cell、不在 `DrillMetricRegistry`。（T1：exact-id／near-miss／replay-profile／persistence short-circuit 純函式負向測試；T6：live `historyPersistence.save()` 回 `excluded/practice`，真實 payload 產不出 compatibility key）
- [ ] build／typecheck／全量 Vitest／全量 Playwright／`test:ci` 全綠；boundary scans 綠。（T6：typecheck／build／全量 Vitest exit 0，全量 Playwright 90 passed／1 failed = 既存 KI-027；**`test:ci` 與 boundary scans 留給 T-exit**）

## Commit discipline

每個 task 單獨 commit；建議 subject 見各 task file。完成 task 後同步本清單與 [progress.md](progress.md)；WP 完成時同步 `docs/exec-plan/README.md` §2 的 stage12 列。
