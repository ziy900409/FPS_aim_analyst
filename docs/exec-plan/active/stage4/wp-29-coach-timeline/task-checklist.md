# WP-29 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(上游複驗 + `compute.ts` 對表基準凍結 + Sync 精度判準 pre-registration;無演算法碼) | [T0-entry-gate.md](T0-entry-gate.md) | — | Low |
| ✅ | **T1** 逐 peek 時間軸 + **交叉驗證閘(含反 vacuous)** + 窗界實作消重 | [T1-peek-timeline.md](T1-peek-timeline.md) | T0 | **Med** |
| ⬜ | **T2** Release-to-Click Sync 族 + 量化精度**明確判定** | [T2-sync-precision.md](T2-sync-precision.md) | T1 | Med |
| ⬜ | **T3(gated)** `DataRecorder` additive `key` 事件 —— **僅當 T2 判定 `insufficient`** | [T3-key-events.md](T3-key-events.md) | T2 判定 | Med |
| ⬜ | **T-exit** 教練報告 v0 + `analysis-peek-timeline.md` 定稿 + 文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T1–T2(T3 依判定) | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-29 狀態翻 ✅。
- **兩個閘都要貼證據**:`uv run pytest`(research)+ `npm run test:ci`(engine,含 `timeline-parity.test.ts`)。
- **三條不可事後改的凍結**:T0 的 `compute.ts` 對表基準、T0 的 `SyncParams`(`sync-v1`)、WP-28 的 `seg-v1`。要改一律升 version + 重跑全鏈(D-28.7 先例)。
- **T1 的反 vacuous 條款(紀律,非權宜)**:對表閘必須斷言參與比對的樣本數非零(合成 + 09:39 各 `n ≥ 2`),否則換 fixture 時可能無聲退化成 `n=0 vs n=0` 假綠。三份 fixture 分工:合成 = 演算法邊界、08:03 = 零輸入邊界、09:39 = 主要真實效度樣本。
- **KI-004 界線**:09:39 帶 `meta.suspect=true`(corridor gate 單位域錯誤,見 [KI-004](../../../../known_issue/KI-004-sim-world-unit-domain-mismatch.md))。WP-29 全部指標只吃 `events` 與 `ticks[].keys`,**不得**開始消費 `px/pz` —— 一旦消費,T0 的使用界線決議即失效,須重新評估。
