# WP-45 / T-exit — Pilot-ready 驗收與文件對帳

## Entry criteria

- T0–T5 checklist 全勾且各 task commit 可追溯。
- WP-44、WP-43 dependency gates 已滿足。
- 無未分類的 test failure 或 schema/fixture drift。

## Automated gate

1. [x] `npm run typecheck`
2. [x] `npm test`
3. [x] `npm run test:e2e`
4. [x] `npm run test:ci`
5. [x] targeted determinism：60/120/240 Hz transfer fixture deep-equal
6. [x] stage6 frozen drill/config/schedule golden tests

所有命令 exit code 必須為 0；若環境性 skip，須記 test name、理由、owner，不得以「大致通過」替代。

## Manual gate

- [ ] center 起點左右 target 皆被 cover 遮蔽。（自動證據：`peek-ad-corridor.test.ts`）
- [ ] cue A/D 與實際 exposure side 相同。（自動證據：pilot/scene contract tests）
- [ ] wall shot 不 kill，tracer/impact 停在 cover。（自動證據：`SimLoop.test.ts`）
- [ ] 正確方向 strafe 後 target 曝光；反向急停後可命中。（自動證據：pilot hitscan tests）
- [ ] first miss 可補槍；hit 後翻面。（自動證據：pilot hitscan tests）
- [ ] 20 trials/timeout/backstop 皆能結束。（自動證據：unit + Playwright timeout block）
- [ ] 1.5°/2.0°/3.0° cells 可識別且 metadata 正確。（自動證據：builder tests；2° live export E2E）
- [ ] transfer report 無 composite score，且 Practice 不進正式 history。（自動證據：metrics/history tests）
- [ ] transfer-pilot-v1 三條件順序、60 秒 rest、export context 正確。（自動證據：session roster/runner/preset tests）

> 上列為真人 native pointer-lock／視覺手感驗收項，尚待研究者回填；它們不會被自動化測試冒充為人工證據。

## Documentation gate

- [x] `docs/operational/analysis-peek-click-transfer.md` 定稿。
- [x] `CONTEXT.md` 術語回寫。
- [x] `DECISIONS.md` 記錄 transfer/component 邊界與 occlusion kernel。
- [x] `docs/exec-plan/active/stage9/README.md` 狀態更新。
- [x] 使用者尚未把 proposal 升格為 Assessment；`docs/exec-plan/README.md`/`docs/MAP.md` 維持未採納狀態，progress 明文記錄。
- [ ] `git status --short`、`git diff --cached --stat`、staged filenames 僅含 WP-45 預期檔案。（交由提交前檢查）

## Exit result

Exit 只代表 **pilot-ready**。下列事項不因本 gate 自動成立：

- target size/timeout 已正式凍結；
- transfer test 已通過 construct validity/reliability；
- pilot trial 數可當作獨立 participant sample size；
- transfer task 可取代 hold-click/counterstrafe Assessment。

## Commit

`Complete peek-click transfer pilot exit gate`
