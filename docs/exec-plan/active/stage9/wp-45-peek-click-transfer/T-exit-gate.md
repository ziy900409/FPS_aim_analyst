# WP-45 / T-exit — Pilot-ready 驗收與文件對帳

## Entry criteria

- T0–T5 checklist 全勾且各 task commit 可追溯。
- WP-44、WP-43 dependency gates 已滿足。
- 無未分類的 test failure 或 schema/fixture drift。

## Automated gate

1. `npm run typecheck`
2. `npm test`
3. `npm run test:e2e`
4. `npm run test:ci`
5. targeted determinism：60/120/240 Hz transfer fixture deep-equal
6. stage6 frozen drill/config/schedule golden tests

所有命令 exit code 必須為 0；若環境性 skip，須記 test name、理由、owner，不得以「大致通過」替代。

## Manual gate

- [ ] center 起點左右 target 皆被 cover 遮蔽。
- [ ] cue A/D 與實際 exposure side 相同。
- [ ] wall shot 不 kill，tracer/impact 停在 cover。
- [ ] 正確方向 strafe 後 target 曝光；反向急停後可命中。
- [ ] first miss 可補槍；hit 後翻面。
- [ ] 20 trials/timeout/backstop 皆能結束。
- [ ] 1.5°/2.0°/3.0° cells 可識別且 metadata 正確。
- [ ] transfer report 無 composite score，且 Practice 不進正式 history。
- [ ] transfer-pilot-v1 三條件順序、60 秒 rest、export context 正確。

## Documentation gate

- [ ] `docs/operational/analysis-peek-click-transfer.md` 定稿。
- [ ] `CONTEXT.md` 術語回寫。
- [ ] `DECISIONS.md` 記錄 transfer/component 邊界與 occlusion kernel。
- [ ] `docs/exec-plan/active/stage9/README.md` 狀態更新。
- [ ] 使用者若正式採納，`docs/exec-plan/README.md`/`docs/MAP.md` 同步；否則 progress 明文保留 proposal 狀態。
- [ ] `git status --short`、`git diff --cached --stat`、staged filenames 僅含 WP-45 預期檔案。

## Exit result

Exit 只代表 **pilot-ready**。下列事項不因本 gate 自動成立：

- target size/timeout 已正式凍結；
- transfer test 已通過 construct validity/reliability；
- pilot trial 數可當作獨立 participant sample size；
- transfer task 可取代 hold-click/counterstrafe Assessment。

## Commit

`Complete peek-click transfer pilot exit gate`
