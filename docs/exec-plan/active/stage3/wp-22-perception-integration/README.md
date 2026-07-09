# WP-22 — perception-integration:感知實驗整合 + 驗收清單 C

> stage3 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 決議依據:[DECISIONS.md](../../../DECISIONS.md) **GD-7**(追蹤指標)/ **GD-10**(受試者內 protocol)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | 兩個感知實驗端到端成立:**追蹤 × 場景**(WP-18 移動目標進 BR 場景)+ **解析度 × 偵測受試者內 protocol**(資格閘 → 條件序列 → 匯出);決定性回歸擴充 + **驗收清單 C** = stage3 交付 |
| **里程碑** | **M10**(stage3 交付) |
| **相依** | WP-19(M9)✅ + WP-20 ✅ + WP-21 ✅ + WP-18 ✅ |
| **對應 FR** | FR-C13 ~ FR-C15 |
| **估時** | 2–3 dev-days |
| **狀態** | 🟡 T2 AUTO PASS(2026-07-09):protocol runner + 2-condition E2E + `test:ci` green;manual true-fullscreen walkthrough pending |

---

## 1. 範圍

**In scope**:

```
src/drill/(追蹤 drill × 場景組合 config)      ← ADD tracking_scene_v1(消費 WP-18 drill 型)[T1]
e2e/(Playwright,WP-9 既有基建)               ← ADD 追蹤×場景 / protocol 兩條 E2E          [T1/T2]
src/ui/ or src/display/(protocol 執行器)      ← ADD 條件序列執行(gate→鎖定→條件→匯出)   [T2]
src/loop/__tests__/(決定性回歸)               ← MODIFY 擴場景/解析度不變性 + seeded 重現    [T3]
docs/operational/acceptance-checklist-c.md      ← ADD 驗收清單 C                              [T3]
docs/operational/pilot-protocol-stage3.md       ← ADD pilot 施測程序(兩實驗)                [T2/T3]
```

**Out of scope**:追蹤 drill 本體/sub-tick 內插/目標 render 內插(WP-18)、對抗平衡的統計設計(protocol config 資料;順序由研究者given,執行器只照表跑)、正式分析 pipeline(WP-21 T3 spec 為介面)、多受試者管理/上傳後端(本地匯出檔案為交付邊界,規格 §14 既定)。

## 2. 關鍵契約

- **T1 追蹤 × 場景**:`tracking_scene_v1` = WP-18 的追蹤 drill config + `sceneId: 'field-low'`;
  淨空驗證必須涵蓋**整段運動包絡**(WP-19 T3 的 motion 極值推導在此實戰);E2E 斷言:
  匯出含逐 tick 目標/玩家位置(GD-7 欄)、`suspect` 未升、淨空驗證綠。
- **T2 protocol 執行器**:`ProtocolConfig` 資料驅動(條件序列 = `[{ mode, sceneId, drillId }]`,
  順序對抗平衡由研究者在 config 排定);流程 = 資格閘(WP-20 T2)→ setup 表單(T4)→
  逐條件:鎖定解析度 → drill → 匯出(帶條件標記)→ 下一條件;中途 fullscreen 退出/
  資格失效 → 該條件 `suspect`。**受試者內全條件同 session**(GD-10 防線②)。
- **T3 決定性回歸擴充(FR-C15)**:三條新不變性——①同輸入序列跨場景 sim 狀態逐位一致
  (WP-19 T4 單元版 → 回歸套件收編)②跨解析度模式同上 ③同 seed spawn 序列重現
  (WP-21 T1 golden 收編);**既有 baseline(stage1/2)全綠維持**。
- **驗收清單 C**(M10 判準;比照附錄 E 清單 A/B 句式,全部可機械判定或有明確手動步驟):
  置換場景×2、淨空拒載、資格閘拒入/放行、三解析度模式 buffer 斷言、受試者內 protocol
  全流程 E2E、偵測 round-trip 推導、追蹤×場景 E2E、決定性三不變性、`test:ci` exit 0。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| WP-18 交付形狀與本 WP 假設不合(presentation policy/欄位) | T1 重工 | OQ-S3-5 對帳點:WP-18 T0 展開時與本 WP README 互驗(雙方 progress 互記) |
| protocol 中途條件失效(fullscreen 退出/掉幀) | 整 session 報廢 vs 局部汙染 | 條件級 `suspect`(非 session 級丟棄);清單 C 含此情境的 E2E |
| 條件間狀態洩漏(前一條件的解析度/場景殘留) | 條件不獨立 | 執行器每條件前 assert 顯示/場景狀態 = config 宣告(E2E 斷言) |
| 兩實驗共用機制互相干擾(meta 區塊互踩) | 匯出欄位錯置 | schema.md 對帳 + 匯出不變式測試(scene/display/spawn/frames 四區塊並存 case) |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 四上游 exit 驗證 + WP-18 交付形狀對帳(OQ-S3-5) | — | Low |
| **T1** | [T1-tracking-in-scene.md](T1-tracking-in-scene.md) | 追蹤 drill × BR 場景 + E2E | T0(WP-18/19) | Med |
| **T2** | [T2-resolution-protocol-e2e.md](T2-resolution-protocol-e2e.md) | protocol 執行器 + 受試者內解析度 × 偵測 E2E | T0(WP-20/21) | **High** |
| **T3** | [T3-determinism-acceptance-c.md](T3-determinism-acceptance-c.md) | 決定性回歸擴充 + 驗收清單 C + pilot protocol 文件 | T1, T2 | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | M10 宣告(stage3 交付) | T1–T3 | — |
