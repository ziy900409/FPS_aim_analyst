# T2 — 數值凍結:`protocolVersion`/診斷門檻/四協定條件格定案

> Part of [WP-39 calibration-freeze](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(pilot 工具已可產生候選配置並收集 pilot 匯出資料) |
| **Risk / Cplx** | Med / Med(觸碰四個協定 config 與 `main.ts` 版本來源,但皆為既有欄位改值,不改結構) |
| **Touches** | ADD `STAGE6_PROTOCOL_VERSION` 常數(`src/main.ts` 或新增 `src/drill/protocolVersion.ts`);MODIFY `src/metrics/diagnosisRules.ts`(`DIAGNOSIS_THRESHOLDS_V1`)、`src/drill/hold_click_v1.ts`、`src/drill/hold_track_v1.ts`、`src/drill/spider_shot_v1.ts`、`src/drill/counterstrafe_reversal_v1.ts`;MODIFY `docs/exec-plan/DECISIONS.md` |
| **狀態** | ✅ (2026-08-25) |

## Objective

交付 FR-F18 的凍結機制:以 T1 產生器收集的 pilot 匯出資料為依據,把六個 pilot-candidate 位置(可見門檻、架槍近中遠距離、Spider Shot 角度範圍、`holdDurationMs`、診斷規則 8 個門檻、`assessmentFeedbackPolicy` 選定值)換成正式凍結常數,並把 `protocolVersion` 從「現況等同 `drillId`」升級為顯式版本常數 `STAGE6_PROTOCOL_VERSION = '1.0.0'`。**本 task 交付的是凍結的機制與紀律(版本化、可追溯、pilot/正式分離),不是代替研究者做出真人 pilot 的統計判讀**——若 pilot 資料尚未實際收集,允許用「pilot 工具已就緒但沿用既有候選值作為預設凍結值」的方式先完成機制驗證,實際數值調整留待研究者取得真人資料後以本 task 的相同流程覆蓋(不新增機制)。

## In scope

1. `STAGE6_PROTOCOL_VERSION = '1.0.0'` 常數 + `main.ts` 改讀此常數(不再讀 `drillId`)。
2. `diagnosisRules.ts` 新增 `DIAGNOSIS_THRESHOLDS_V1`(`version: 'recommendation-v1.0.0'`),舊 `PILOT_CANDIDATE_DIAGNOSIS_THRESHOLDS` 保留不刪除;`evaluateDiagnosis()` 呼叫端改用新常數。
3. 四個協定 config 的距離/角度/`holdDurationMs` 具體數值定案(依 T0/T1 拍板的 OQ-S6-25 結論決定 `holdDurationMs` 是否分層)。
4. `assessmentFeedbackPolicy` 正式選定值記入 `DECISIONS.md`(依 OQ-S6-26 結論,型別本身不變)。
5. `DECISIONS.md` 新增凍結決策條目:逐一記錄四個 `taskId` 各自的 `protocolVersion` 升版時間點(依 OQ-S6-27 結論,允許分批)。

## Out of scope

- `acceptance-stage-f.md`(T3)。
- 真人 pilot 施測本身(研究行政層工作)。

## Steps

- [ ] `STAGE6_PROTOCOL_VERSION` 常數 + `main.ts` 改讀來源 + 既有 `compatibilityKey.ts` 判定式零修改回歸測試。
- [ ] `DIAGNOSIS_THRESHOLDS_V1` 新增 + 版本升版斷言測試(新舊 `version` 不相等)。
- [ ] 四協定 config 數值定案 + 既有決定性回歸測試(除凍結欄位外逐位不變)。
- [ ] `DECISIONS.md` 凍結決策記錄(含依據的 pilot 統計量或明確標記「沿用候選值,待真人資料覆蓋」)。
- [ ] `npx vitest run` 全綠。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | `protocolVersion` 來源改為顯式常數,不再等同 `drillId` | `main.ts` diff + 回歸測試 |
| ② | 診斷門檻凍結且版本升版,舊常數保留 | `diagnosisRules.test.ts` 斷言新舊 `version` 不同 |
| ③ | 四協定數值定案,既有決定性回歸零破壞 | 既有 `*_v1.test.ts` 全綠 |
| ④ | `DECISIONS.md` 記錄凍結依據 | diff 可見 |
| ⑤ | `npm run test:ci` 全綠 | CI 輸出貼 progress.md |

## Commit

`feat(wp-39): T2 — 數值凍結(protocolVersion 1.0.0 + 診斷門檻版本化 + 四協定條件格定案)`
