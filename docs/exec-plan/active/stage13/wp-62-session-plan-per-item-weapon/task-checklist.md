# WP-62 — Task Checklist

> Tech spec：[README.md](README.md) · Running log：[progress.md](progress.md) · 決策 [GD-38](../../../DECISIONS.md)

| Done | Task | Objective | Dependencies | Risk |
|---|---|---|---|---|
| ⬜ | **T0** Entry gate／基線復現／編號重查／決策凍結 | [T0-entry-gate.md](T0-entry-gate.md) | WP-58 T-exit ✅ | Low |
| ⬜ | **T1** Drill 自宣告武器的推導註冊表 | [T1-declared-weapon-registry.md](T1-declared-weapon-registry.md) | T0 | Low |
| ⬜ | **T2** 編譯器 `weaponId` 穿透與驗證 | [T2-compiler-weapon-passthrough.md](T2-compiler-weapon-passthrough.md) | T1 | Med |
| ⬜ | **T3** SessionRunner／`activateDrill()` 接線 | [T3-runner-and-activation-wiring.md](T3-runner-and-activation-wiring.md) | T2 | **High** |
| ⬜ | **T4** 表單每列武器選單／預覽 | [T4-setup-ui-weapon-picker.md](T4-setup-ui-weapon-picker.md) | T2（可與 T3 並行） | Med |
| ⬜ | **T5** Metadata 稽核欄位／意圖 vs 事實對帳 | [T5-metadata-and-export.md](T5-metadata-and-export.md) | T3 | Med |
| ⬜ | **T6** E2E 整合／frozen 逐位不變回歸 | [T6-e2e-and-regression.md](T6-e2e-and-regression.md) | T3 + T4 + T5 | Med |
| ⬜ | **T-exit** WP-62 驗收 | [T-exit-gate.md](T-exit-gate.md) | T1～T6 | Low |

## Package Definition of Done

- [ ] 使用者情境「Drill A ×3（武器 X）→ Drill B ×2（武器 Y）→ Drill C ×1（預設）」可在表單編排、在預覽表看見每步武器、並無人工介入跑完
- [ ] 未知武器 id 與覆蓋 BR 四格皆為**編譯期**錯誤且定位到列；非法計畫無法送出
- [ ] 省略 `weaponId` 時，編譯輸出與 runtime 行為與本 WP 前**逐位一致**（含物件鍵集合）
- [ ] frozen「標準 Assessment」路徑的編譯、runtime 與匯出與本 WP 前**逐位一致**，且有實跑 digest 證據
- [ ] 同一 program 跨 ≥ 4 種 render FPS 的 sim 狀態逐位一致；武器賦值早於 `buildSimLoop()` 有測試釘死
- [ ] 匯出可對帳：`sessionPlanItems[].weaponId`（意圖）vs `meta.weaponId`（事實）
- [ ] 全 repo 仍只有一份武器 allowlist（`WEAPONS` / `isWeaponId`）與一份 drill-宣告武器來源（`DECLARED_WEAPON_BY_DRILL_ID`，推導而非手寫）
- [ ] `research/` ingest 對新欄位零修改相容（真實 `load_export()` 證據）
- [ ] 既有決定性／hit／recoil／ADS／result／history／replay 回歸**零修改**全綠；build／typecheck ×2／Vitest／Playwright 皆 exit 0

## Commit discipline

每個 task 單獨 commit；subject 見各 task file。完成 task 後同步本清單、[progress.md](progress.md)與上層 [stage13 checklist](../README.md)。
