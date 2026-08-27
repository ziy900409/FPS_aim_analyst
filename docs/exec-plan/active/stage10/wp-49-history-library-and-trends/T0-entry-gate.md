# WP-49 T0 — Entry Gate／WP-48 Handoff Audit／PoC／Blocking Decisions

## Objective

在不寫production feature的前提下，確認WP-48實際或凍結中的DTO/API可支撐WP-49，驗證hash navigation、Result extraction seam與paged projection效能，並收斂OQ-49.1～5。T0未通過不得開始T1～T5。

## Inputs to read

- [README.md](README.md) §0～3、[WP-48 README](../wp-48-local-history-foundation/README.md) §2.4/§5
- `AGENTS.md`、`graphify-out/GRAPH_REPORT.md`
- WP-48實際`contracts`／`HistoryClient`／API／repository（若尚未實作，以approved contract為準並標blocked dependency）
- `src/main.ts` history/result/completion seam
- `src/ui/HistoryView.ts`、`src/ui/ResultScreen.ts`
- `src/metrics/sessionHistory.ts`、`compatibilityKey.ts`

## Steps

1. 記錄`git status --short`、HEAD、CodeGraph status/pending與`npm run test:ci` baseline；不處理unrelated changes。
2. 對`createHistoryView`、`createResultScreen`、`buildSessionHistory`、`CompatibilityKey`、WP-48 client/API symbols執行CodeGraph impact並記實際blast radius。
3. 對帳WP-48 handoff：summary fields、Assessment-only witness、sort、URL encoding、loadRun、health/error、abort與test root。
4. 做throwaway pure route PoC：所有route/filter Unicode與`/`, `%`, `#` ids round-trip；invalid encoding不throw；Back/Forward/reload sequence可重建。
5. 用existing fixtures做throwaway result presentation extraction spike；列出必須從`main.ts`移出的pure functions與不能移動的current-run actions。
6. 用100個≤4MiB payload fixture量測parse/project候選方案；比較browser batch與Node paged projection的transfer、memory、latency，記錄採用理由。
7. 與owner收斂OQ-49.1～5；未收斂者標blocked task，不可把recommended default當已確認產品決策；OQ-49.5結論同步回寫WP-48 OQ-48.3。
8. 刪除所有PoC artifacts（只刪已resolve且確認位於T0 temp root的路徑），把evidence寫入[progress.md](progress.md)。

## Failure modes to prove

| Case | Required evidence |
|---|---|
| malformed/deep-link route | safe not-found，無`URIError`／global rejection |
| Back/Forward rapid sequence | final state等於最後route，stale callback無commit |
| 100 full payload browser batch | 有transfer/memory數據，可與Node projection方案比較 |
| Result extraction | current metrics/diagnosis/quality presentation before/after model byte/structural equivalent |

## Definition of Done

- [ ] OQ-49.1～5各有owner-confirmed結論或明確blocked task/deadline。
- [ ] WP-48 handoff逐interface有available／pending／mismatch表；mismatch有owner與修正task。
- [ ] route、Result seam、projection三個PoC各有可重現command/test/measurement evidence。
- [ ] T1～T5 planned files與dependencies已按current worktree更新。
- [ ] baseline test exit 0，或既有failure已證明與T0無關。
- [ ] production code diff=0；PoC artifacts全清；checklist/progress更新。

## Commit

```text
docs(stage10): complete WP-49 entry gate
```
