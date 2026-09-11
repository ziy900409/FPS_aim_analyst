---
name: fps-verification
description: "驗證 FPS Aim Analyst 的程式變更、bug 修復與 task/WP exit-gate。用於「驗證這次修改」「確認修好了」「交付前驗收」，依影響範圍選擇引擎、瀏覽器及資料分析檢查並回報證據。純架構問答不觸發；純文件變更只做文件驗證。"
---

# FPS verification

將需求對應到可觀察行為，執行足以支持結論的檢查；分別判斷程式正確性、操作表現與研究效度。

## 界定範圍

1. 從目前工作目錄解析 repo root，確認 `package.json` 的 name 是 `fps-aim-analyst`。以下專案路徑皆相對此 root；skill 內 reference 連結相對本檔。其他 repo 不直接套用本矩陣。
2. 讀適用的 [AGENTS.md](../../../AGENTS.md) 與本次 task DoD／FR／NFR。記錄 HEAD、staged／unstaged／untracked 變更；使用者指定 range 或檔案時以其為範圍，不預設 `HEAD~1`。把同一工作樹中其他人的改動列為背景，避免混入本次結論。
3. 把每項需求寫成可驗證主張，例如「相同 input/seed 在不同 render cadence 下的逐 tick state 一致」。圖譜回答影響面，測試與量測回答是否成立。

## 選擇與執行

- 純文件變更：檢查內容、連結與指令是否符合現況；不因此啟動遊戲、GPU 或全量測試。
- 程式、設定或資料契約變更：讀 [verification-matrix.md](references/verification-matrix.md)，依契約及 blast radius 選擇 gate。沿 AGENTS 的圖譜流程查受影響 symbols／consumers，補上 config、schema、fixture 與 UI 接線；pending files 直接讀檔。
- 用當前 package scripts、runner config 與 task DoD 確認命令。先相關 tests，再執行影響範圍或既有 exit-gate 所需的較廣檢查。必要檢查全過後，不無故反覆重跑。
- 跑 E2E、視覺或效能驗收時，先讀 [runtime-evidence.md](references/runtime-evidence.md)。確認 server 歸屬、synthetic history roots、browser/backend 與證據來源。
- 同 input/seed 的逐 tick 決定性不等於 wall-clock 計時效度。synthetic harness、live 接線、實體硬體與真人操作各自支持不同主張。
- Python 演算法修改另跑 Python gate；parity 修改需指認權威端與適用容差。synthetic/golden 一致不自動證明研究構念有效。

## 處理結果

保存第一次失敗與 exit code；環境啟動失敗、assertion failure、flaky、已證實的既有問題分開記錄。缺環境只阻塞依賴它的 gate，繼續完成其他必要且已授權的檢查。

沿原任務授權處理修復，不為換取綠燈而改 golden、放寬容差、停用測試或修改 frozen protocol。有效的語意變更依原決策完成版本與 fixture 更新；修改受測內容後重跑受影響 gate。不要替驗證專用請求擴增功能。

產出結果時讀 [evidence.md](references/evidence.md)，回報範圍、命令與結果、限制及下一個必要動作。零測試、skip、未執行與 waiver 不等於 pass；manual／research 證據缺席時不宣稱該 gate 完成。

引用與本次受測狀態相符的證據。Commit、merge、發佈、里程碑更新沿原任務授權處理，驗證通過本身不新增授權。
