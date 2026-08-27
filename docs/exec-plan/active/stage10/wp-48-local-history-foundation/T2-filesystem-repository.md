# WP-48 T2 — Project Folder History Repository

## Objective

實作與 HTTP/Vite/DOM 無關的 `HistoryRepository`：安全 root containment、deterministic identity、原子保存、idempotency/conflict、重啟掃描、summary index 與 root lease。

## Planned files

```text
server/history/HistoryRepository.ts       NEW
server/history/historyPaths.ts            NEW（若單檔過大才拆）
tests/history/historyRepository.test.ts   NEW
tests/history/historyRepository.perf.test.ts NEW（可用明確 opt-in benchmark）
tsconfig.node.json                        NEW
package.json / package-lock.json          MODIFY Node typecheck / typings
.gitignore                                MODIFY ignore data/session-history/**/*.json
data/session-history/README.md             NEW，零真人資料
```

## Interface to implement

實作 [README.md](README.md) §2.4 的 `HistoryRepository`／`HistoryIndexReport`／`SaveHistoryRunResult`，factory 必須接受 explicit root，測試不得讀 default production root。

## Steps

1. 先寫 temporary-root tests；每個 cleanup 前 resolve 並 assert 位於測試 root。
2. 在任何 identity/path 推導前執行 archival policy：Practice 拒絕為 `PRACTICE_NOT_ARCHIVABLE`；Assessment 缺 Participant ID 拒絕為 `MISSING_PARTICIPANT`；兩者均不可建立 temp/final file。
3. 實作 readable-prefix + hash directory segments、run identity/runId、timestamp filename；測 collision 與 Unicode。
4. 實作 root lease。第二 repository instance 指向同 root 必須失敗；close 後可重新取得。stale lease 行為依 T0 決議實作並測試。
5. 實作 `initialize()` recursive scan：只收 final `.json`；strict parse；套用 Assessment-only policy；metadata/path cross-check；valid/invalid/unsupported/excluded-Practice counts；建立 immutable summaries/index。既有 Practice JSON 不得出現在 normal index。
6. 實作 serialized mutation queue：identity check → canonical hash → temp write/flush/close → atomic publish → index snapshot swap。
7. 實作 same content `existing`、different content `conflict`；並行送同 run 的測試不得產生兩檔或覆寫。
8. 實作 list sort：participants/drills latest-desc，runs `startedAt` desc；tie-breaker 固定 `runId`。
9. 實作 `loadRun(runId)` 再 parse、Assessment-only policy 與 identity verify；檔案被外部改壞或是 Practice 時不得回傳 typed history payload。
10. 建 5,000 summary fixture benchmark；若 cold scan ≥10 s，先記 evidence 再依 README technical debt policy 決定可重建 cache。
11. 建 Node typecheck command並納入 `build`/CI script，不讓 `server/` 成為 untyped island。

## High-risk failure modes

| Trigger | Required handling |
|---|---|
| traversal/symlink escape | reject before mutation；root 外 sentinel 不變 |
| disk error after temp write | final absent；temp 可於 initialize 清理 |
| concurrent same identity | exactly one final；others existing/conflict |
| corrupt/unsupported file | initialize continues；count increments；normal list excludes |
| second process/root owner | lease refusal；no writes |
| Practice submission／existing Practice JSON | reject or exclude；no identity/path/temp/final/index entry |

## Definition of Done

- [ ] save/list/load/close/reinitialize 全部 interface tests 通過。
- [ ] Assessment 寫入正確 hierarchy/filename；Practice save 被拒絕且零 temp/final file；既有 Practice JSON 不進 normal index；metadata/path mismatch 被排除。
- [ ] traversal、absolute、separator、Unicode collision、symlink/junction escape tests 全綠且 root 外 sentinel byte-identical。
- [ ] kill/error injection 證明 final file 不會半寫；scanner 忽略/清理 stale temp。
- [ ] 20 個並行 same-run save 最終只有 1 個 JSON；same content 其餘 existing，different content conflict。
- [ ] 5,000-run benchmark：warm list P95 <100 ms、cold rebuild <10 s；未達標則有量測與依 policy 實作的可重建 cache。
- [ ] 真實 `data/session-history/` 無測試 JSON；`.gitignore` 規則與 tracked README 正確。
- [ ] browser typecheck + Node typecheck + targeted/full Vitest exit 0。

## Commit

```text
feat(history): add safe project-folder repository
```
