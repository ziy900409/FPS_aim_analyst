# WP-48 T0 — Entry Gate／Filesystem PoC／Blocking Decisions

## Objective

在不寫 production API 的前提下，驗證 Node 20 在本專案／Windows workspace 的 containment、atomic publication、root lease 與 Vite adapter 可行性，並凍結 blocking OQ-48.1～2。T0 未通過不得開始 T1/T2。

## Inputs to read

- [README.md](README.md) §0～3
- `AGENTS.md`
- `vite.config.ts`、`package.json`、`playwright.config.ts`、`tsconfig.json`
- `src/data/export.ts`、`src/data/metadata.ts`、`src/data/sessionHistoryLoader.ts`
- `src/main.ts` completion seam（先 CodeGraph impact；注意現有 dirty change）

## Steps

1. 記錄 `git status --short` 與 `npm run test:ci` baseline；不處理、不覆蓋 unrelated changes。
2. 以 workspace 內明確 temporary root 做 throwaway PoC，逐項驗證：
   - resolved/real path containment 對正常、`..`、absolute、encoded separator、symlink/junction escape 的行為；
   - 同目錄 temp write → close/flush → rename publication；scanner 在 publication 前看不到 `.json`；
   - root lease exclusive create、正常釋放與 stale lease 判定方案；
   - Node middleware 在 Vite dev/preview lifecycle 的 close hook 可釋放 lease。
3. 比較兩個 hosting 選項：
   - A：Vite `configureServer` + `configurePreviewServer` middleware；
   - B：standalone Node process + Vite proxy／process orchestration。
   以依賴數、preview、Playwright、typecheck、root ownership 與未來抽離成本記錄結論。
4. 與使用者收斂：OQ-48.1 hosting、OQ-48.2 history root；OQ-48.3 corrupt-file UX 明確延至 WP-49。
5. 凍結 Node typecheck strategy（建議 `tsconfig.node.json` + `@types/node`）與 test glob 落點。
6. 刪除 T0 temporary artifacts；只能刪已 resolve 且確認位於 T0 temp root 的明確路徑。
7. 把原始觀察、決策與 baseline test counts 寫入 [progress.md](progress.md)，同步 README Open Questions status。

## Failure modes to prove

| Case | Required evidence |
|---|---|
| path escape | PoC 明確拒絕且 root 外 sentinel 未變 |
| partial write | final `.json` 在 publish 前不存在；temp 不被 scanner 收錄 |
| duplicate owner | 第二 lease create 失敗，不可進 writable health |
| middleware shutdown | close hook 後 lease 可由新 instance 取得 |

## Definition of Done

- [ ] OQ-48.1～2 皆有結論、owner confirmation 或明確 blocked 狀態；未解決不得假裝採 default 開 T2/T3/T5。OQ-48.3 已記錄 deferred owner/deadline。
- [ ] 四個 PoC failure mode 都有可重現命令／測試輸出，且 root 外 sentinel byte-identical。
- [ ] Node typecheck、test glob、dev/preview/E2E root 注入方式寫成具體檔案與 script 計畫。
- [ ] `npm run test:ci` baseline exit 0，或既有 failure 已記錄且證明與 T0 無關。
- [ ] production code diff 為零；T0 temp artifacts 全部清除。
- [ ] [task-checklist.md](task-checklist.md) T0 翻 ✅，progress 更新。

## Commit

```text
docs(stage10): complete WP-48 filesystem entry gate
```
