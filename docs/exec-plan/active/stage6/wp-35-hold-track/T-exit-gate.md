# T-exit — 驗收 + 文件定稿

> Part of [WP-35 hold-track](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2 |
| **Risk / Cplx** | — |
| **Touches** | `docs/operational/analysis-hold-track.md`、[CONTEXT.md](../../../../../CONTEXT.md)、本 WP README/task-checklist |
| **狀態** | ⬜ |

## Objective

收斂 WP-35:驗證框架 v1 對 `hold-track-v1` 的驗收條件——「`hold-track` 的追蹤窗不因提早擊殺而縮短」——在最終落地的程式碼上仍成立;定稿 `analysis-hold-track.md`;完成文件對帳;把 stage6 README 的 WP-35 狀態翻 ✅,開放 WP-38 entry 的其中一個條件(尚需 WP-36/37 一併 T-exit)。

## In scope

1. 執行 [../README.md](../README.md) 驗收條件覆核(對照框架 v1 §"v1 驗收條件"清單中與 hold-track 相關的一條)。
2. 定稿 `docs/operational/analysis-hold-track.md`:fire-gating 語意、`target_stop` 定義與時間源、掉靶/重新取得時間排除規則(OQ-S6-15 最終決議)、停止轉換指標公式、與既有 `tracking_br_v1`/`presentationMs` 語意的差異說明(避免未來讀者誤用兩者)。
3. [CONTEXT.md](../../../../../CONTEXT.md) 補新術語:`fireLocked`、`target_stop`、T0/T1 拍板後的最終欄位名(如 `trackingStopMs`)、掉靶次數/重新取得時間。
4. [../README.md](../README.md) §3 WP 索引:WP-35 狀態翻 ✅。
5. 覆核 §7 Open Questions 是否全部關閉或明確移交(OQ-S6-9/14/15)。

## Out of scope

- WP-36/WP-37/WP-38 的任何工作。

## Steps

- [ ] 逐一覆核框架 v1 hold-track 相關驗收條件,附證據連結(測試檔案/合成 fixture 名稱)。
- [ ] 定稿 `analysis-hold-track.md`。
- [ ] 回寫 CONTEXT.md 新術語。
- [ ] 翻 stage6 README §3 WP-35 狀態。
- [ ] 覆核 §7 OQ 逐條關閉或移交狀態。
- [ ] 最終 `npm run test:ci` 全綠證據貼 progress.md。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 追蹤窗不因提早擊殺而縮短的驗收條件通過 | 端到端合成 drill 測試(T2 產出)+ 本 task 覆核連結 |
| ② | `analysis-hold-track.md` 定稿 | 文件存在且涵蓋 §Objective 列出的四項內容 |
| ③ | CONTEXT.md 新術語回寫 | diff 可見 |
| ④ | stage6 README WP-35 狀態翻 ✅ | diff 可見 |
| ⑤ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`docs(wp-35): T-exit — hold-track 驗收 + analysis-hold-track.md 定稿 + 文件對帳`
