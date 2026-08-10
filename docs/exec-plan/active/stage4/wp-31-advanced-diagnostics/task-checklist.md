# WP-31 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ⬜ | **T0** entry gate(M14 + WP-30 複驗 · fixture roster 沿用 · **`gate-v1` 三件組重新操作化與凍結** · `sparc-v1`/`xcorr-v1`/`fitts-v1` pre-registration · OQ-S4-3 關閉;無演算法碼) | [T0-entry-gate.md](T0-entry-gate.md) | WP-30 T-exit ✅ | Low |
| ⬜ | **T1** SPARC 逐位移植 + **跨 repo golden 對表 ≤1e-9(含 7 個中間值)** + 逐 MR 段表 + **N=32/64 階梯診斷** | [T1-sparc.md](T1-sparc.md) | T0 | Med |
| ⬜ | **T2** Key-Velocity xcorr(signed A/D × ω)+ correlogram + **`gate-v1` 明確判定(逐 session,seeded)** | [T2-key-velocity-xcorr.md](T2-key-velocity-xcorr.md) | T0 | **Med** |
| ⬜ | **T3** Fitts ID/MT/TP + 回歸 + **`blocked-by-data` 判準** + D 內生性/MT 含 RT 限制聲明 | [T3-fitts.md](T3-fitts.md) | T0 | Low |
| ⬜ | **T-exit** 三份判定收斂 + 教練報告 v2(研究向區塊分離)+ `analysis-advanced-diagnostics.md` 定稿 + 文件對帳 | [T-exit-gate.md](T-exit-gate.md) | T1 + T2 + T3 | — |

**T1 / T2 / T3 互不相依,可亂序執行。** 建議序 **T2 → T1 → T3**:T2 是唯一可能改變報告 v2 內容的判定,先跑完它,後兩者的風險就只剩實作。

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / OQ)與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-31 狀態翻 ✅。
- **兩個閘都要貼證據**:`uv run pytest`(research)+ `npm run test:ci`(engine)。

## 本 WP 特有的五條紀律

1. **五條凍結不可事後改**:T0 的 fixture roster、T0 的 `gate-v1`(含 seed)、T0 的 `sparc-v1`/`xcorr-v1`/`fitts-v1`、上游 `seg-v2`/`phase-v1`/`curve-v1`、上游 `sync-v1`/`timeline-v1`/`compute-v1`/`detect-v1`/`construct-v1`。要改一律升 version + 全鏈重跑(D-28.7 先例)。
2. **`npm run test:ci` 在本 WP 是回歸閘,不是對表閘**:本 WP 不新增任何 TS 測試,`src/` 與 `tests/` 應為零 diff。出現 diff = 該 task 越界,立即 fail 並回頭檢視。
3. **交付物是判定,不是數字**(C-D3 / GD-20):三個指標各需一份「進教練報告 / 研究向 / blocked-by-data」的判定與證據。**三個全判研究向也是合格交付**;把一個未驗證的指標放進主表才是失敗。
4. **SPARC 的段來源唯一**:= `phase-v1` 的 MR 區間(逐 peek 窗內 `seg-v2` 第一個 `primary_flick`)。整條軌跡分段在真實 fixture 上只切出 3 段(pooled),逐 peek 分段切出 59/60 —— 兩者不可混用,更不可新增第三種。
5. **fixture roster 界線**:只用三份 `tick-integral` 真實匯出(09:18 / 09:24 / 09:37)+ 合成。08:03 / 09:39 **禁用**(beat aliasing + 無 eye origin);所有入口 `strict=True`,legacy 匯出必定拋錯——以測試斷言,不靠文件自律。
