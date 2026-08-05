# KI-004 / S1 — Task checklist

> master task index。一個 task = 一個垂直切片;**當前 task 未 commit 不開下一個**(CLAUDE.md §3.1)。
> tech spec:[README.md](README.md) · running log:[progress.md](progress.md)

---

| # | Task | 交付 FR | 風險 | Done |
|---|---|---|---|---|
| T0 | [Entry gate:基線量測與受影響面盤點](T0-entry-gate.md) | — | Low | ⬜ |
| T1 | [`SIM_TO_WORLD` 升引擎級常數 + eye world base 單一來源](T1-sim-to-world-constant.md) | FR-S1-1 · FR-S1-2 | Med | ⬜ |
| T2 | [匯出自我描述:`meta.simToWorld` + `scene.eye` + `validity`](T2-export-meta-additive.md) | FR-S1-13/14/15 | Med | ⬜ |
| T3 | [corridor gate 改 world 域 + 依 K-3 脫離 `suspect`](T3-corridor-observation.md) | FR-S1-3 · FR-S1-4 | Med | ⬜ |
| T4 | [離線推導 eye pose 契約 + 正確性閘 ①②](T4-eye-origin-derivation.md) | FR-S1-5/6/7/9/10 | **High** | ⬜ |
| T5 | [Python `angular.py` 同步 + parity fixture 重產](T5-python-parity-sync.md) | FR-S1-8/10/11 | Med | ⬜ |
| T6 | [帳本 / 里程碑對帳 + M14 ② 重新宣告](T6-ledger-m14-reconcile.md) | FR-S1-12 | Low | ⬜ |
| T-exit | [Exit gate:交付判定](T-exit-gate.md) | — | Low | ⬜ |

**commit 顆粒度**:T4 + T5 **合併為單一已驗證綠的 commit**(TS 修法會讓 parity 必紅,與 repo 硬規「每個 commit 綠」衝突;比照 [BD-001](../BUGFIX-DECISIONS.md) 的 TDD 偏離慣例)。其餘各自一個 commit。

**相依**:嚴格序列 `T0 → T1 → T2 → T3 → T4 → T5 → T6 → T-exit`。

> **T2 為 2026-08-05 拍板前拉**(OQ-S1-1 + OQ-S1-2 → KI-004 §5.1 的 S2 ②③ 與 ① 靜態部分)。順序放在 T3 之前的理由:corridor 移出 `suspect` 前,`meta.validity` 必須先有落點,越界事實才不會遺失。

---

## 每個 task 完成時

1. 更新 [progress.md](progress.md)(Progress / Decision Log / Surprises / Open Questions),與切片一起 stage。
2. 把上表該列的 **Done** 翻 ✅。
3. 若產生跨計畫 / 偏離協議的決策 → 寫 [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) BD-004;純屬本 S1 的細節寫 progress。

## S1 全部完成時

- [ ] [KI-004](../KI-004-sim-world-unit-domain-mismatch.md) 狀態翻「✅ S1 已落地;S2(逐 tick eye pose)/ S3 待辦」+ §5.1 的 S2 列改寫 + §8 修改紀錄填寫
- [ ] [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md) §1 索引 + BD-004 條目補 S1 落地段
- [ ] [WP-28 progress.md](../../exec-plan/active/stage4/wp-28-research-foundation/progress.md) 記 M14 ② 重新宣告
- [ ] [exec-plan/README.md](../../exec-plan/README.md) · [stage4/README.md](../../exec-plan/active/stage4/README.md) · [MAP.md](../../MAP.md) 三處對帳
