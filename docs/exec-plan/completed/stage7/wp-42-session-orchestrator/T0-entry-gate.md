# T0 — entry-gate:覆核讀碼發現 + 五個關鍵決策拍板

> Part of [WP-42 session-orchestrator](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | 無(WP-41 T-exit 只是 T3 的前提,不阻塞 T0 開工) |
| **Risk / Cplx** | Med(決策①直接決定 T1 骨架設計;決策②的範圍判定直接決定 T1 估時是否落在 1.5d 或逼近 2.25d 上緣) |
| **Touches** | 無程式碼;決策記錄於 `progress.md` |
| **狀態** | ⬜ 待開工 |

## Objective

在動筆前重新覆核 [README.md §0](README.md) 的讀碼發現在當下 `src/` 上仍然成立(尤其 `main.ts` 的 `availableDrills` 現況、`ProtocolRunner.ts` 現況、四家族 `mode` 欄位現況——這些都可能被同時並行的 WP-40/WP-41 或其他人的變更影響);正式拍板 §2①②③④⑤ 五個決策;關閉 OQ-S7-2。零程式碼,零測試異動。

**預設立場**:[README.md §2.6](README.md#26-建議修復方法總覽工程師建議t0-可直接採用或讀碼後提出異議並記錄覆核理由) 已把五個決策點各自收斂成一個具體建議。T0 的預設動作是**逐列覆核是否仍成立,成立就直接採用**(Decision Log 記一句「採用 §2.6 建議,理由同上」即可,不需要重新分析一輪);只有讀碼發現與 §2.6 假設不符時,才需要重新判斷並記錄新的理由。不得跳過覆核直接假設 §2.6 仍然有效。

## In scope

1. **重新覆核 §0-2 的 `availableDrills` 缺口**:重新 `grep` `main.ts` 確認 `spiderShotV1`/`counterstrafeReversalV1`/`counterstrafeFreeV1`/`counterstrafeCuedV1` 是否仍然不在陣列中(若同期有其他人已經補上,T1 範圍相應收縮,更新估時)。
2. **拍板 §2① 引擎選擇**:`SessionRunner` 新建小狀態機,或重用 `ProtocolRunner<TPayload>`。重新讀 `ProtocolRunner.ts`/`brTrackingProtocol.ts` 確認 §0-3 的兩個結構性不合(`mode: ResolutionMode` 必填、手動按鈕觸發)仍然成立;若讀碼後認為重用收益(現成測試覆蓋)大於代價,記錄 `D-42.1` 並更新 §5 interface contracts 的實際落點。
3. **拍板 §2② `availableDrills` 補齊清單的實際項目數**:三個(`spider-shot-v1`/`counterstrafe-reversal-v1`/`counterstrafe-free-v1`)還是四個(含 `counterstrafe-cued-v1`,對應 OQ-S7-12)。
4. **拍板 §2③/OQ-S7-2 熱身降級語意**:確認 hold-click/hold-track/spider-shot 三家族現況仍無 Practice 變體(重新讀 `mode` 欄位),正式關閉 OQ-S7-2,決定 UI 提示的具體文字/型式。
5. **拍板 §2④ preset 草稿**:確認 `pilot-default` 的 `perFamilyTrialShape` 是否可以直接引用既有凍結值(`endCondition.value`/`targets.count` 等),或需要研究者額外輸入(對應 OQ-S7-13,可留待 T1 但 T0 應先判斷是否阻塞)。

## Out of scope

- 任何程式碼實作(T1/T2/T3)。
- `src/drill/*.ts`/`ProtocolRunner.ts`/`resolutionDetectionProtocol.ts`/`brTrackingProtocol.ts` 本體的任何修改。

## Steps

- [ ] 重新讀取 `src/main.ts` 的 `availableDrills`(現行行號約 114-150)與 `loadDrillById()`(約 948-974),確認 §0-1/§0-2 讀碼發現仍成立或記錄差異。
- [ ] 重新讀取 `src/display/ProtocolRunner.ts` 全文與 `src/display/brTrackingProtocol.ts`,確認 §0-3 的兩個結構性不合仍成立;拍板引擎選擇,寫 `D-42.1`。
- [ ] 重新讀取四個協定檔案的 `mode` 欄位(`hold_click_v1.ts`/`hold_track_v1.ts`/`spider_shot_v1.ts`/`counterstrafe_free_v1.ts`/`counterstrafe_cued_v1.ts`/`counterstrafe_reversal_v1.ts`),確認 §0-7 讀碼發現仍成立;正式關閉 OQ-S7-2,寫 `D-42.2`。
- [ ] 拍板 `availableDrills` 補齊清單範圍(OQ-S7-12),寫 `D-42.3`。
- [ ] 初判 `perFamilyTrialShape`(OQ-S7-13)是否阻塞 T1 開工,若不阻塞則留待 T1 讀碼時確認,記錄於 progress.md。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | README §0 讀碼發現已重新覆核(或明確記錄差異) | progress.md 記錄核對結果 |
| ② | 引擎選擇(§2①)已拍板 | Decision Log `D-42.1` |
| ③ | 熱身降級語意(OQ-S7-2)已正式關閉 | Decision Log `D-42.2` |
| ④ | `availableDrills` 補齊範圍(OQ-S7-12)已拍板 | Decision Log `D-42.3` |
| ⑤ | 零程式碼、零測試改動 | `git diff` 為空(僅 `docs/`) |

## Commit

`docs(wp-42): T0 — entry-gate(讀碼覆核 + 五個關鍵決策拍板)`
