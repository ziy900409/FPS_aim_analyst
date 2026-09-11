# 證據與完成判定

整理結果時讀本檔。一般變更使用簡短報告；正式 task/WP exit-gate 依該 task 的 evidence 要求保存 artifact 與需求對照，不為每次小改動新增 dossier。

## 記錄什麼

| 項目 | 內容 |
|---|---|
| 範圍 | task/WP/KI、基準 HEAD、受測檔案／range、dirty state、時間；能識別未提交內容的 diff／artifact hash 或 snapshot |
| 契約 | requirement／invariant、適用決策、這項 gate 要排除的錯誤 |
| 執行 | runner、command、cwd、exit code、pass/fail/skipped 數；分辨測試執行與 discovery |
| 證據來源 | 自動／量測／檢視／人工；browser/backend、server/root 歸屬或硬體條件只在相關時填寫 |
| 限制 | 未測情境、環境阻塞、flaky、歸因未知、有效 waiver 及下一步 |

對已有但未提交的其他工作，不混入本次驗證結論。HEAD 相同不代表工作樹相同；受測程式、設定或 fixture 後續改動時，更新狀態識別並重跑受影響 gate。只改不影響該 gate 的文件，不需要重跑其程式測試。

## 狀態語意

與 [Stage10EvidenceReporter](../../../../tests/stage10/Stage10EvidenceReporter.ts) 對齊的 evidence kind：`automated`、`measurement`、`inspection`、`manual`。既有 status：

| Status | 適用條件 |
|---|---|
| `pass` | 本次適用主張有執行完成且有效的通過證據；case 數與範圍吻合 |
| `fail` | 實際驗證未達期望；保留 assertion／量測與失敗 artifact |
| `blocked` | 本次必需 gate 因環境、資料、未決判準或必要人工證據不足而無法完成 |
| `not-applicable` | 與本次範圍無關，附理由；不能用來掩蓋 fail 或缺環境 |

尚未執行但已列入計畫的項目另列 `not run`，不冒充已寫入既有 TypeScript schema 的新狀態。不是本次必需的未測情境列在限制；本次必需但無法執行才是 gate blocked。不要讓無關驗收項阻塞局部變更。

waiver 獨立記錄來源、決策人／日期與適用範圍；它只影響 gate 是否阻塞交付，不把缺失證據變成 pass。依原任務授權處理，勿重問已獲准且仍適用的決策。

## 失敗、重跑與歸因

- 保存第一次 command、exit code 與失敗內容；零測試、skip、`--list`、runner 未啟動都不能宣稱 tests passed。
- 同一測試 assertion 失敗後 retry 通過，記錄 `flaky` 及次數，不改寫為首次全綠。環境載入失敗後首次真正執行成功，記錄環境修復，不誤稱 assertion flake。
- 只有相似 KI 名稱不足以判 `pre-existing`。使用相同條件的 base comparison 或可引用且足夠相同的 evidence；沒有就保留未知歸因。需要比對時保留原工作樹，勿 reset 使用者變更。
- 修復在原授權內則修復、重跑受影響項。有效變更可能需要更新版本與 fixture；不得為壓掉失敗而重錄 golden、放寬容差、增加 retry、停用測試或隱藏品質旗標。
- 必要 gate 全過後停止；只有新變更、失敗、未解疑慮或既定 DoD 才擴大／重跑。

## 報告

用實際內容填寫；沒有的區塊省略。正式驗收才要求持久 artifact，一般變更可以引用本次工具輸出。

```text
Verification: <本次 task 與範圍>
Baseline: <HEAD + 受測 dirty/diff identity>
已通過: <需求／gate、命令、exit code、數量、證據位置>
失敗或阻塞: <原因、首次失敗／重跑結果、歸因依據>
尚未執行: <gate、原因、是否為本次必需>
適用 waiver: <來源及範圍>
結論: <證據支持的行為、限制、下一個必要動作>
```

artifact 放在 task 指定位置或現有 git-ignored 測試輸出目錄。不要嵌入完整受試者 payload、真實 history 絕對路徑或把本機 participant 衍生物當作可提交 fixture；可分享報告使用相對路徑或 root alias。

只有本次範圍內必需 gate 具備有效通過證據、或已有適用且明確的豁免處置時，才能宣告相應交付範圍完成。自動測試、實機操作與構念效度分別判定；舊結果不能替新版本背書。里程碑／發布依原 task 與授權，不由測試數量自動宣告。
