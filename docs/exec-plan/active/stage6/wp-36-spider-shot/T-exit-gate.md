# T-exit — 驗收 + 文件定稿

> Part of [WP-36 spider-shot](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T3 |
| **Risk / Cplx** | — |
| **Touches** | `docs/operational/analysis-spider-shot.md`、[CONTEXT.md](../../../../../CONTEXT.md)、本 WP README/task-checklist、[../README.md](../README.md) |
| **狀態** | ⬜ |

## Objective

收斂 WP-36:驗證框架 v1 對 `spider-shot-v1` 的驗收條件——「Spider Shot 每次 transition 保存方向、角距與角尺寸」——在最終落地的程式碼上仍成立;定稿 `analysis-spider-shot.md`;完成文件對帳;把 stage6 README 的 WP-36 狀態翻 ✅,開放 WP-38 entry 的其中一個條件(尚需 WP-34/35/37 一併 T-exit)。

## In scope

1. 執行 [../README.md](../README.md) 驗收條件覆核(對照框架 v1 §"v1 驗收條件"清單中與 Spider Shot 相關的一條)。
2. 定稿 `docs/operational/analysis-spider-shot.md`:center-peripheral 排程語意、`zone` 欄位定義、`D_deg`/`W_deg`/象限公式(含分箱門檻為呈現層標籤的說明)、`targetConditionCell` 格式、五類指標公式、與既有 L/R 交替/`SpawnAreaConfig` 語意的差異說明(避免未來讀者誤用兩者)。
3. [CONTEXT.md](../../../../../CONTEXT.md) 補新術語:`spiderShot` schedule(`SpiderShotScheduleConfig`/`SpiderPeripheralConfig`)、`zone`、`D_deg`、`W_deg`、象限標籤、`spider-shot-v1`。
4. [../README.md](../README.md) §3 WP 索引:WP-36 狀態翻 ✅。
5. 覆核 §7 Open Questions 是否全部關閉或明確移交(OQ-S6-16/17/18)。

## Out of scope

- WP-34/35/37/38 的任何工作。

## Steps

- [ ] 逐一覆核框架 v1 Spider Shot 相關驗收條件,附證據連結(測試檔案/合成 fixture 名稱)。
- [ ] 定稿 `analysis-spider-shot.md`。
- [ ] 回寫 CONTEXT.md 新術語。
- [ ] 翻 stage6 README §3 WP-36 狀態。
- [ ] 覆核 §7 OQ 逐條關閉或移交狀態。
- [ ] 最終 `npm run test:ci` 全綠證據貼 progress.md。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 「每次 transition 保存方向/角距/角尺寸」驗收條件通過 | T2/T3 端到端合成 drill 測試 + 本 task 覆核連結 |
| ② | `analysis-spider-shot.md` 定稿 | 文件存在且涵蓋 §Objective 列出的五項內容 |
| ③ | CONTEXT.md 新術語回寫 | diff 可見 |
| ④ | stage6 README WP-36 狀態翻 ✅ | diff 可見 |
| ⑤ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`docs(wp-36): T-exit — spider-shot 驗收 + analysis-spider-shot.md 定稿 + 文件對帳`
