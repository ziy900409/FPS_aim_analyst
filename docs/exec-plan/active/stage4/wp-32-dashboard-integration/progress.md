# WP-32 — Progress / Decision Log / Surprises / Open Questions

> Running log。每個 task 完成時與切片一起 stage。
> Spec:[README.md](README.md) · Checklist:[task-checklist.md](task-checklist.md)

---

## Progress

| Task | 狀態 | 日期 | 證據 |
|---|---|---|---|
| T0 entry gate | ⬜ | — | — |
| T1 TS kinematics + SG | ⬜ | — | — |
| T2 TS seg-v2 分段 | ⬜ | — | — |
| T3 phase + sync 晉升 | ⬜ | — | — |
| T4 curve 晉升 | ⬜ | — | — |
| T5 結果頁擴充 | ⬜ | — | — |
| T-exit(M15) | ⬜ | — | — |

**兩閘證據**(每 task 完成時貼原始輸出):

| Task | `uv run pytest` | `npm run test:ci` |
|---|---|---|
| — | — | — |

---

## Decision Log

> 編號 `D-32.n`。跨 WP / 跨文件的決策改入 [DECISIONS.md](../../../DECISIONS.md)。

### D-32.0 — 與規劃稿的偏離:task 數 2 → 7,估時 2–3d → 4.5–5.75d(2026-08-12,規劃期)

**規劃稿**([stage4 README §6](../README.md))把 WP-32 寫成 `T0 / T1 golden parity / T2 結果頁 / T-exit` 四項、2–3d。

**偏離理由(讀碼事實,非估計)**:`grep -rniE "savgol|sg_window|submovement|primary_flick|omega" src/ --include=*.ts` 對 `src/metrics/` 零命中 —— TS 側沒有 ω(t)、沒有 Savitzky-Golay、沒有 submovement 分段。而 `phase-v1` 的 MR 邊界 = 逐 peek 窗內 `seg-v2` 的第一個 `primary_flick`(D-30.1/D-30.1b)→ **晉升 phase 必然連帶晉升整條分段鏈**(ω + SG + `seg-v2`)。把這三層折進單一「T1 golden parity」會產生一個 3 天以上、無法獨立驗證的 task,違反「一 task = 一垂直切片」。

**Alternatives considered**:
- **(a) 只晉升 sync + curves,phase 留 Python**:成本 2.5–3.5d,不需移植 SG/分段。**未採納** —— 使用者於 2026-08-12 拍板三項全晉升。
- **(b) 只晉升 sync**:成本 2–2.5d,M15 最快到,但結果頁新增價值最小。未採納,同上。
- **(c) 維持兩 task 但放大顆粒**:違反 task 粒度原則(0.5–3d)且對表失敗時無法定位是 ω、SG 還是分段出錯。未採納。

**採納**:七 task。切法依「可獨立對表的最小單位」:T1 = ω + SG(各自有 golden)、T2 = 分段(吃 T1 產物,golden 為整數 index)、T3 = phase + sync、T4 = curve、T5 = 呈現。

**估時**:0.375 + 1.125 + 1.125 + 0.875 + 0.625 + 0.625 + 0.5 ≈ 5.25 → **4.5–5.75d**。

### D-32.1 — WP-31 由「M15 選項」升為 WP-32 硬相依(2026-08-12,規劃期)

[stage4 README §5](../README.md) 原寫「WP-31 為 M15 選項:未過 reliability gate 的指標不晉升」,§3 相依欄亦寫「WP-29 + WP-30(WP-31 選項)」。但 **OQ-S4-4 的決議欄要求「WP-31 通過項納入評估」** —— 沒有三份完整判定,T0 的晉升清單就只能靠推定。

使用者於 2026-08-12 拍板:**先完成 WP-31 T3(Fitts)+ T-exit,再開 WP-32 T0**。故 WP-32 entry = WP-29 ✅ + WP-30 ✅ + **WP-31 T-exit ✅**。

**代價**:M15 延後約 0.5–1d。**換得**:晉升清單的排除理由是證據(三份判定 + `analysis-advanced-diagnostics.md` 定稿)而非推定,符合 C-D3「寧可少一個指標,不能有一個會說錯話的指標」的舉證責任方向。

*(以下由各 task 落地時續寫:D-32.2 起)*

---

## Surprises

> 編號 `S-32.n`。規劃期已知的兩項先記在此,落地時補證據。

### S-32.1 — Butterworth 不必移植(規劃期讀碼)

`phase-v1` 的 Butterworth 只出現在 `smooth_report_omega`,模組 docstring 明寫 "never a boundary input" —— 邊界全部來自 `seg-v2` 的 `primary_flick`。故 TS 晉升面**不需要** `butter_filter`/`filtfilt`(scipy `filtfilt` 的零相位雙向濾波在 TS 重現遠比 SG 困難)。

代價是 `filter_degenerate` 這一個 flag 在 TS 側無法產生 → T0 須明文凍結為「刻意的詞彙表子集」,並在 golden 對表時排除該 flag(其餘 flag 逐 peek **相等**)。

### S-32.2 — SG 的難點在 edge,不在 interior(規劃期讀碼)

`sg_filter` = `scipy.signal.savgol_filter(window_length, polyorder)`,預設 `mode='interp'`:內部是固定 FIR 卷積(可直接抄係數),但**前/後各 `(window-1)/2` 個樣本另以三次多項式擬合**(scipy `_fit_edges_polyfit` → `np.polyfit` → `lstsq`)。在 TS 重寫 lstsq 不可能可靠達 ≤1e-9。

→ 契約改為「由 Python 產出係數矩陣、TS 內嵌為凍結常數」,把問題從**重寫演算法**降為**套用矩陣**。殘餘風險記為 **OQ-S4-21**,T1 驗。

---

## Open Questions

| # | 問題 | 狀態 | Owner | Deadline |
|---|---|---|---|---|
| **OQ-S4-4** | 晉升 dashboard 的指標清單 | 🟡 **T0 關閉**:已由使用者於 2026-08-12 拍板三項全晉升(`phase-v1` + `sync-v1` + `curve-v1`);T0 須把 WP-31 三指標的逐項排除理由與證據位置寫入 | 使用者 | WP-32 T0 |
| **OQ-S4-21**(新) | scipy `savgol_filter(mode='interp')` 的 edge polyfit 以凍結矩陣重現後能否穩定達 ≤1e-9 | 🟡 open,T1 驗;不達標一律停手入帳,**不得靜默放寬容差** | 研究者 | WP-32 T1 |
| **OQ-S4-22**(新) | 結果頁單 drill n ≈ 20 peeks,phase/sync 均值是否穩定到可對選手呈現 | 🟡 open,T5 以呈現形式解(強制 n + p50 + SD,不給單一分數) | 使用者 / 研究者 | WP-32 T5 |
| **OQ-S4-23**(新) | `curve-v1` 在結果頁的縮圖形式 | 🟡 open,T5 拍板;建議與教練報告 v1 同形式(inline SVG L/R 疊圖 + IQR 帶 + `n(L)`/`n(R)`) | 使用者 | WP-32 T5 |
| **OQ-S4-24**(新) | 雙實作維護紀律是否升為硬約束 | 🟢 建議升 **C-D5**(CLAUDE.md §4)+ 候選 **GD-21**(DECISIONS.md);T-exit 落地 | 使用者 | WP-32 T-exit |
| **OQ-S4-17 / 19 / 20 / 10 / 11** | 承上游,均維持 open | 本 WP 不解;T-exit 須在 `acceptance-stage-d.md` 逐條列為「stage4 交付時的已知限制」 | 研究者 | pilot 後 |
