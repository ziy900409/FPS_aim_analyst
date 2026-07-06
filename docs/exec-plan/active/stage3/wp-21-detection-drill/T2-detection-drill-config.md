# T2 — 偵測 drill config(pop-in)+ spawn 事件位置欄

> Part of [WP-21 detection-drill](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(seeded spawn 就緒) |
| **Risk / Cplx** | Med / Low |
| **Touches** | ADD `src/drill/detection_popin_v1.ts`;MODIFY spawn 事件記錄(位置欄,v2 additive)、`src/data/metadata.ts`(meta.spawn 填值)、`src/ui/Controls.ts`(drill 清單)+ 測試 |
| **狀態** | ⬜ |

## Objective

第一個偵測 drill 上線(FR-C11):pop-in + seeded 隨機位置/延遲,`t_visible` = spawn
tick(語意零改動);spawn 事件帶目標位置——偵測實驗的最小資料閉環(偏心度離線可推)。

## In scope
- `detection_popin_v1` config:`spawnArea`(T0 定稿範圍)+ `spawnDelayMsRange`
  (如 [800, 2400]ms)+ `seed` + `count` + `peekTimeoutMs`;推進沿用 P2 + timeout
  (GD-8:開火允許,kill/timeout 皆推進)。
- spawn 事件記錄擴欄:`spawn` 事件含目標位置 `(x, y, z)`(v2 additive;偏心度推導
  的直接輸入——逐 tick 目標位置欄是 WP-16 的,本欄是事件級冗餘、兩者互驗)。
- `meta.spawn` 填值:`seed`/`spawnArea`/`spawnDelayMsRange`(區塊縫 WP-16,
  比照 OQ-19.2 對帳模式)。
- Controls drill 清單加入;實機跑一輪:目標在隨機位置/延遲瞬現、可擊殺、逾時推進、
  匯出含 spawn 位置與 meta.spawn。
- E2E 冒煙(`__fpsTest` harness):合成輸入跑完偵測 drill → 匯出斷言(spawn 事件
  位置欄非零、`t_visible` 每 presentation 一次)。

## Out of scope
- t_detect 推導(T3)、場景/解析度組合(WP-22)、多套偵測 drill 變體(pilot 後)。

## Steps

- [ ] drill config + validate 綠;Controls 掛線。
- [ ] spawn 事件位置欄 + meta.spawn + 匯出測試。
- [ ] 實機驗證記 progress(隨機性觀感 + 匯出抽查)。
- [ ] E2E 冒煙綠。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 偵測 drill 實機可跑、行為符合 config;匯出含 spawn 位置 + meta.spawn;
  E2E 冒煙綠;`t_visible` 語意不變(每 presentation 恰一次,測試斷言)。

## Commit

`feat(wp-21): T2 偵測 drill(pop-in seeded 位置/延遲)+ spawn 事件位置欄 + meta.spawn`
