# T3 — tracking_br_v1 整合 drill + protocol 條件序列(純 config 組合)

> Part of [WP-26 br-scene-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(br-field 上線)+ WP-24 exit(ads 武器檔)+ **WP-25 M12**(`bullet` 欄解鎖;未過則 hitscan-only 先行) |
| **Risk / Cplx** | Med / Low(純 config;風險在條件設計而非程式) |
| **Touches** | ADD `src/drill/tracking_br_v1.ts`(+ 變體);MODIFY protocol config(WP-22 T2 機制)、`src/main.ts`(掛載);config 驗證測試 |
| **狀態** | ⬜ |

## Objective

大逃殺跟槍測試的 drill 面收斂(FR-E12):`tracking_br_v1` = br-field ×
遠距小目標移動(WP-23 檔位)× ADS 武器(WP-24)× 彈道模型(WP-25)——
**全部 config 宣告,零引擎碼**;protocol 條件序列宣告式定義。

## In scope

- `tracking_br_v1.ts`:`sceneId: 'br-field'` + WP-23 的 hitbox/distance/motion 檔位 +
  timed presentation + ads 武器檔;變體(條件軸):
  - ADS on/off(武器檔帶/不帶 `ads`,或同武器由受試者自由開鏡——依 OQ-26.2 設計決議;
    自由開鏡時 ads flag 記錄承擔條件還原);
  - hitscan / projectile(武器檔帶/不帶 `bullet`;**M12 未過只落 hitscan 變體**);
  - 角尺寸檔(WP-23 矩陣的 2 檔)。
- protocol:`ProtocolConfig` 增 BR 跟槍 protocol(條件序列 + 對抗平衡宣告,
  沿 WP-22 T2 機制;`meta.protocol` 條件標記自動生效)。
- config 驗證測試(每變體 validateDrill/validateWeapon/validateClearance 全過)+
  掛載 smoke。
- **條件矩陣決議(OQ-26.2)**:條件數/順序/平衡記 ledger(研究設計輸入,
  pre-registered 候選)。

## Out of scope

- E2E/驗收(T4);新引擎機制(紅線);正式 pilot protocol 文件(T4 隨清單 E)。

## Steps

- [ ] OQ-26.2 條件矩陣決議記 ledger。
- [ ] `tracking_br_v1` + 變體 config + 驗證測試(含淨空)。
- [ ] protocol config + `meta.protocol` 生效測試。
- [ ] 掛載 + 手動 smoke(至少一條件完整一輪:開鏡追蹤 → 擊殺 → 匯出)記 progress。
- [ ] `npx vitest run` 全綠。

## Definition of Done

- 全變體 config 驗證綠(淨空含);protocol 條件標記進 meta;手動一輪證據;
  引擎碼零改動;M12 門控遵守證據(未過則無任何 `bullet` 欄 config)。

## Commit

`feat(wp-26): T3 tracking_br_v1 整合 drill + BR 跟槍 protocol(純 config 組合)`
