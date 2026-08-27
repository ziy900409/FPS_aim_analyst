# WP-51 T3 — Failure, Recovery, Data Safety, and Races

## Objective

以可控制的失敗注入與cross-WP race驗證使用者能恢復、identity不被晚到工作覆蓋，且任何錯誤都不造成root escape、silent overwrite或背景Replay/live presentation並存。

## Dependencies

- T1 harness可注入isolated roots與evidence。
- T2 canonical journey已建立可比較的success baseline。

## Failure matrix

| Case | Injection | Required result |
|---|---|---|
| API unavailable | server未啟動／中途停止 | historical retry/return；current Result/manual download仍可用 |
| save failure | approved fs seam拒絕temp/write/rename | 明確unsaved state、retry/download；無half file/tmp leak |
| duplicate same/different content | 重送同runId | identical idempotent；different content 409/conflict且原檔不變 |
| corrupt/unsupported/Practice file | pre-start bootstrap fixtures | counts/reasons正確；不列為可用Assessment，不crash |
| not found / late delete-equivalent | load未知runId | stable not-found UI、返回可用；不顯示前一run |
| traversal/symlink/root escape | malicious IDs與outside sentinel | request被拒、outside不變、error不洩漏absolute path |
| scene asset failure/mismatch | WP-50 loader seam | degrade/unsupported/retry/return符合reason contract；late asset dispose |
| rapid navigation | A→B→Back/close during load | abort/generation阻止stale commit，route/focus正確 |
| replay ownership race | enter/leave/re-enter/visibility | single owner，live pump/input在Replay為0，dispose後恢復baseline |

## Work

1. 以domain-approved injectable seams產生失敗；不得改OS真實ACL或破壞project data。
2. 對每個case同時assert user message/action、API code、filesystem tree/hash、controller generation與resource counters。
3. path/symlink案例只在run root內建立link與outside synthetic sentinel；不接受任意request path。
4. race cases使用deferred promises/controllable clock/scene loader，不用增加長sleep。
5. critical canonical + race specs執行`--repeat-each=5 --retries=0`，保存每次run token與零stale-server evidence。
6. 每個failure發現依README §2.6歸屬，upstream修復回來後重跑owning exit + affected suite。

## Definition of Done

- [ ] failure matrix每列有automated evidence與user recovery action。
- [ ] atomic/idempotent/conflict/path/symlink/sentinel assertions通過，無半檔與root escape。
- [ ] API/save failure不抹除current Result/manual download；retry成功只建立一筆Assessment。
- [ ] corrupt/unsupported/not-found/scene failure不crash、不stale commit、不假裝可Replay。
- [ ] navigation/payload/scene/presentation races repeat×5 zero failure/retry。
- [ ] 真實root/outside sentinel前後hash/mtime一致，錯誤訊息無絕對path/stack洩漏到UI。

## Suggested commit

```text
test(stage10): verify recovery safety and cross-module races
```

