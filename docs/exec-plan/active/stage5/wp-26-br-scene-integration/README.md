# WP-26 — br-scene-integration:實作大逃殺跟槍測試場景(br-field)+ 整合 drill 與驗收清單 E

> stage5 執行計畫的 WP 子資料夾。上層 spec:[../README.md](../README.md) · 決議依據:**GD-9**(寫實原創 + CC0/CC-BY 白名單)/ **GD-6**(純裝飾場景 + 淨空驗證)/ GD-16/GD-17(WP-24/25 T0 拍板後引用)。
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | **實際做出大逃殺跟槍測試**:寫實開闊 BR 場景 `br-field`(原創資產,麥田/丘陵/遠山地貌)上線 + 整合 drill `tracking_br_v1`(BR 場景 × 遠距小目標移動 × ADS × 彈道模型)+ protocol 條件序列 + E2E + **驗收清單 E = stage5 交付** |
| **里程碑** | **M13**(stage5 交付) |
| **相依** | WP-23(M11)+ WP-24(exit)+ WP-25(M12);**T1 資產工作可提前並行**(僅依賴 OQ-S5-3 拍板) |
| **對應 FR** | FR-E11 ~ FR-E13 |
| **估時** | 3–5 dev-days |
| **狀態** | 🟡 T0 ✅;T1 ✅;T2 ✅;T3 ✅;T4 ✅;T-exit 可開 |

---

## 1. 範圍

**In scope**:

```
public/assets/scenes/br-field/       ← ADD 原創寫實開闊場景資產(GD-9 白名單)                    [T1]
ATTRIBUTIONS.md                      ← MODIFY 逐項 attribution(資產名/作者/來源/授權/取得日)     [T1]
src/scene/(SceneConfig 資料)       ← ADD br-field config(sceneId/propBounds/corridor;零引擎碼)[T2]
src/main.ts(場景選單)             ← MODIFY 掛載(比照 field-low/urban-high)                    [T2]
src/drill/tracking_br_v1.ts          ← ADD 整合 drill(場景×遠距×ADS×彈道 全 config 宣告)        [T3]
src/protocol/(條件序列)           ← MODIFY ProtocolConfig 增 BR 跟槍 protocol(WP-22 T2 機制)  [T3]
tests/e2e/ + tests/regression/       ← ADD 整合 E2E + 三條決定性不變性                             [T4]
docs/operational/acceptance-stage-e.md ← ADD 驗收清單 E                                            [T4]
```

**Out of scope**:品牌擬真/特定地圖復刻(GD-9 排除;附圖為情境參考非復刻目標)、宣告式 occluder/slide-in(GD-8 觸發條件不變)、多人/縮圈/物資等 BR 玩法機制(本專案 = 瞄準量測,場景只是視覺情境)、W/S 移動。

## 2. 關鍵契約

- **場景 = 資料(M9 既定機制)**:`br-field` 走 WP-19 全套——SceneConfig(`sceneId` 中性
  命名、`assetPackVersion`、`clutterTier`、propBounds、playerCorridor)+ GLTF 管線 +
  淨空驗證 + meta.scene,**零引擎碼**。做不到零引擎碼 = 機制有缺口,記 DECISIONS 再動工。
- **授權紅線(GD-9)**:寫實原創,**不得**使用 PUBG 等遊戲抽取資產、不得復刻其地圖配置;
  CC0 優先(程序化生成先例:`field-low` 204 tri / `urban-high` 804 tri 皆自產 CC0);
  CC-BY 需 `ATTRIBUTIONS.md` 逐項可稽核。
- **遠距淨空**:BR 跟槍的視線走廊比既有場景長(WP-23 遠距檔位)——`br-field` 的
  propBounds 佈局必須讓遠距走廊淨空(開闊地形本質有利);淨空驗證拒載 = config 修正,
  不是繞過。
- **整合 = 純 config 組合**:`tracking_br_v1` 只是宣告——`sceneId: 'br-field'` +
  WP-23 hitbox/motion 檔位 + WP-24 ads 武器 + WP-25 bullet 欄(M12 後解鎖);
  protocol 條件序列(ADS on/off × hitscan/projectile × 角尺寸檔)沿 WP-22 T2 機制。
- **三條決定性不變性(FR-E13)**:同輸入序列下——①跨場景(br-field vs 佔位房間)
  sim 狀態逐位一致;②ADS 顯示層(overlay/FOV)不改 sim 序列(ads 事件相同前提);
  ③彈道模型 gate(hitscan 武器檔在 br-field)與既有 baseline 逐位一致。
- **效能地板**:frame log(WP-20)外顯;`br-field` 三角形預算 < 20k(沿 WP-19 budget);
  drill 中 p95 超標 → `suspect`(既有機制)。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| 寫實資產壓垮 render(草叢 instancing/貼圖) | 顯示鏈延遲汙染追蹤量測 | 三角形/材質預算前置(T1 選型即驗證);frame log DoD(T2);fallback = 降階 clutter |
| 遠距走廊被地形起伏擋住(淨空拒載) | drill 做不出來 | 地形設計時走廊先行(T1 與 WP-23 距離檔位對帳);拒載錯誤指名 prop 可修 config |
| 場景需要引擎改動(顯露機制缺口) | 「換場景零引擎碼」承諾破功 | 停手記 DECISIONS(跨 WP 矛盾),按協議處理;不得繞過淨空/config 機制硬塞 |
| 條件組合爆炸(protocol 過長) | pilot 不可行 | protocol 為資料宣告,條件數 = 研究設計決策(T3 OQ);工程只保證機制 |
| 整合後三不變性任一紅 | stage5 交付效度破口 | 分層歸因(場景/ADS/彈道各自有單獨 fixture,T4 先跑分項再跑整合) |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 上游三 WP exit 驗證 + OQ-S5-3 資產路線拍板 | — | Low |
| **T1** | [T1-br-scene-assets.md](T1-br-scene-assets.md) | br-field 原創資產(地形/植被/遠山)+ attribution | T0(可提前) | Med |
| **T2** | [T2-br-scene-online.md](T2-br-scene-online.md) | SceneConfig 上線 + 淨空 + perf + 跨場景決定性 | T1 + WP-23 | Med |
| **T3** | [T3-br-tracking-drill.md](T3-br-tracking-drill.md) | tracking_br_v1 + protocol 條件序列(純 config) | T2 + WP-24/25 exit | Med |
| **T4** | [T4-e2e-acceptance.md](T4-e2e-acceptance.md) | 整合 E2E + 三不變性 + 驗收清單 E | T3 | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | M13 宣告 = stage5 交付 | T1–T4 | — |
