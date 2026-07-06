# T4 — 場景切換 UI + meta.scene + 跨場景決定性斷言

> Part of [WP-19 scene-system](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(GLTF 場景)+ T3(切換即重跑淨空驗證) |
| **Risk / Cplx** | Med / Med |
| **Touches** | MODIFY `src/main.ts`(切換掛線 + 載入時序 gating)、`src/ui/Controls.ts`(場景選擇)、`src/data/metadata.ts`(meta.scene 填值)、`src/loop/__tests__/determinism.test.ts`(跨場景不變性)+ 測試 |
| **狀態** | ⬜ |

## Objective

場景可換、換了有記錄、換了不改 sim(FR-C4):UI 場景選擇(比照換 drill)、
`meta.scene`(sceneId/assetPackVersion/clutterTier/fallback 註記)進匯出、
**跨場景決定性自動化斷言**——「場景 = 純裝飾」的承諾被測試釘死。

## In scope
- `Controls` 場景下拉(placeholder-room / field-low);切換流程:dispose 舊場景 →
  async 載入新場景(期間 drill 控制 disabled,防競態)→ 重跑淨空驗證 → 啟用。
- `meta.scene` 填值(區塊縫由 WP-16 留,OQ-19.2 已對帳):`sceneId`/`assetPackVersion`/
  `clutterTier` + `fallback: boolean`(載入失敗降級的事實)。
- **跨場景決定性斷言**:同一合成輸入序列在 placeholder-room 與 field-low 下,
  sim 狀態(tick index 鍵:位置/velocity/命中)逐位一致——場景根本不該出現在 sim
  資料流,此測試證明它沒有。
- **玩家走廊 runtime 觀測**:sim 每 tick 玩家 x 超出 `playerCorridor.halfWidthU` →
  `suspect` 旗標(比照 `recorderOverflow` 機制;觀測性,不 clamp、不改演進;GD-6c)。

## Out of scope
- 第二場景(T5)、解析度/display meta(WP-20)。

## Steps

- [ ] 切換 UI + 載入時序 gating;競態手動驗證(快速連續切換)記 progress。
- [ ] meta.scene 填值 + 匯出測試(含 fallback 情境)。
- [ ] 跨場景決定性斷言測試綠(兩場景同輸入 → 狀態逐位一致)。
- [ ] 走廊逸出 → suspect 測試(合成輸入把玩家推出走廊)。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 實機可切換兩場景且 drill 正常;匯出 JSON 含 meta.scene 全欄;跨場景決定性測試綠;
  走廊逸出正確升 suspect;快速切換無競態(手動證據)。

## Commit

`feat(wp-19): T4 場景切換 + meta.scene + 跨場景決定性斷言 + 走廊 suspect`
