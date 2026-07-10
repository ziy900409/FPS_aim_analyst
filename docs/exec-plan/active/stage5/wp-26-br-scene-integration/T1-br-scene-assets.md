# T1 — br-field 原創資產(寫實開闊地形/植被/遠山 + attribution)

> Part of [WP-26 br-scene-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(OQ-S5-3 路線 + 走廊需求表);**可在 WP-23/24/25 進行中提前並行** |
| **Risk / Cplx** | Med / Med(風險在效能預算與授權紀律,非程式) |
| **Touches** | ADD `public/assets/scenes/br-field/`(GLTF + 貼圖)或程序化生成器擴充;MODIFY `ATTRIBUTIONS.md`;propBounds 資料(隨資產同源產出) |
| **狀態** | ⬜ |

## Objective

大逃殺情境的寫實開闊場景資產落地(FR-E11):麥田/草原丘陵地貌 + 散生樹叢 +
遠山/天際線——**原創**(GD-9:不復刻特定地圖)、CC0/CC-BY 可稽核、
propBounds 與視覺同源、遠距視線走廊淨空。

## In scope

- **地貌組成**(寫實情境對標附圖氛圍,不復刻佈局):
  - 地形:起伏緩坡地面(暖色草地/麥田材質);**視線走廊帶依 T0 需求表保持平整淨空**;
  - 植被:草叢簇/矮灌木(InstancedMesh 或合併 geometry,控 draw calls)、
    散生樹木(propBounds 逐棵);
  - 遠景:遠山剪影 + 天空(skybox 或漸層背景;無限遠、不進 propBounds);
  - 走廊外側允許較高 clutter(BR 氛圍),走廊內淨空。
- **路線**(OQ-S5-3 決議):
  - 程序化生成(預設):生成器 script 產 GLTF + propBounds JSON **同源輸出**
    (seed 固定、可重現;比照 WP-19 先例);
  - 或 CC0 pack 組裝:逐資產記 `ATTRIBUTIONS.md`(資產名/作者/來源 URL/授權/取得日)。
- **預算**:三角形 < 20k、材質數上限(T0 定稿);毛量記 progress。
- `ATTRIBUTIONS.md` 對帳(lint/檢查機制沿 WP-19)。
- **紅線自檢**:無任何遊戲抽取資產;無特定地圖佈局復刻;NC 授權零混入。

## Out of scope

- SceneConfig/上線/切換(T2)、drill(T3)、動態元素(縮圈/載具等 BR 玩法,永久 out)。

## Steps

- [ ] 資產產出(生成器或組裝)+ propBounds 同源輸出。
- [ ] 走廊淨空自檢(T0 需求表逐項比對)記 progress。
- [ ] 預算證據(三角形/材質/貼圖尺寸)記 progress。
- [ ] `ATTRIBUTIONS.md` 逐項 + 紅線自檢記 progress。
- [ ] 視覺 smoke(獨立 viewer 或暫掛 SceneManager)截圖記 progress。

## Definition of Done

- 資產檔 + propBounds 入 repo;預算內(數字證據);attribution 可稽核
  (每資產一列);走廊需求逐項自檢通過;紅線自檢記錄(GD-9)。

## Commit

`feat(wp-26): T1 br-field 原創寫實開闊場景資產(地形/植被/遠山 + attribution)`
