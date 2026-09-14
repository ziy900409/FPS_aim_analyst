# T0 — entry-gate:上游閘 + 授權判定 + OQ 收斂

> Part of [WP-NN `<scene-id>`](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | — |
| **Risk / Cplx** | Low / Low |
| **Touches** | 無程式碼異動(純讀碼 + 文件) |
| **狀態** | ⬜ |

## Objective

在寫任何一行場景程式碼之前,確認:上游 WP 的 exit-gate 已綠、參考素材的授權判定已定案、
分析報告的 Open Questions 已關閉或降級為非阻塞。

## Steps

- [ ] 驗上游 WP exit-gate:`<列出 WP 與證據連結>`(協議 §3.6)
- [ ] **R1 授權判定落地**:確認場景命名不沿用原地圖、參考素材未進 repo、
      幾何路線 = `props.json → gen script → CC0 原創`。判定寫進 `progress.md` Decision Log。
- [ ] **R2/R3 複驗**:確認本 WP 的 Task 清單中,無任何一項會讓 sim 讀場景幾何或改動 sim 常數。
- [ ] 逐條關閉分析報告 §4 的 OQ;無法關閉者標「非阻塞 + 何時解」。
- [ ] 若與既有決策衝突 → 寫入 `docs/exec-plan/DECISIONS.md`(協議 §3.7)。

## Definition of Done

上游 gate 證據連結齊全;R1/R2/R3 三條判定各有一行結論記入 `progress.md`;
OQ 表每一列非「關閉」即「非阻塞 + 解法與時點」,無懸空項。

## Commit

`docs(wp-NN): T0 entry-gate — <scene-id> 上游閘與授權判定`
