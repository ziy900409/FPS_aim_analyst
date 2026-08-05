# T6 — 帳本 / 里程碑對帳 + M14 ② 重新宣告

> 交付 **FR-S1-12**(K-2 的收尾)· 上游:[S1 README](README.md) · [BD-004](../BUGFIX-DECISIONS.md)
> 依賴:**T5 已 commit 且兩側全綠**(G-1~G-8 已成立)。純文件 task,零程式碼。

**In scope**:KI-004 狀態 · BD-004 條目 · WP-28 `progress.md` · `exec-plan/README.md` · `stage4/README.md` · `MAP.md` · 本 S1 資料夾的 `progress.md` / `task-checklist.md`。
**Out of scope**:`CONTEXT.md` 正規單位改寫 · `schema.md` 單位敘述全面對帳 · `SimU`/`WorldU` branded type(全屬 **S3**)。

---

## 已知的跨文件不一致(T6 必須全部收斂)

M14 ② 於 2026-08-05 撤回,但撤回**沒有傳播到所有文件**。T6 落地時要一起修正:

| 文件 | 現況 | 應為 |
|---|---|---|
| [exec-plan/README.md:125](../../exec-plan/README.md) | M14 列仍寫「**✅** research 地基**六項全綠**……② ε parity `test:ci` 綠……**WP-30/31 entry blocker 已解除**」 | 與撤回**直接矛盾**。S1 落地後改為「M14 ✅(② 於 2026-08-05 撤回、S1 落地後重新宣告)」並註明證據換成閘 ①/閘 ② |
| [exec-plan/README.md:13](../../exec-plan/README.md) | 狀態列寫「WP-28 ✅ 完成,M14 ✅ 達成 2026-08-05,WP-30/31 entry 已解鎖」 | 同上,補撤回與重新宣告的時序 |
| [MAP.md:38](../../MAP.md) | 寫「M14 **②③⑥ 綠 / ①④⑤ 阻塞**於真實匯出樣本 → 未宣告」 | 與 stage4/README 的「①③④⑤⑥ 維持、② 撤回」**相反**(疑為更早版本殘留)。以 stage4/README 為準對齊 |
| [MAP.md:231](../../MAP.md) | KI-004 標「🔴 修法待拍板」 | 修法已拍板且 S1 已落地 → 改為 ✅ S1 已落地 / 🟡 S2·S3 待辦 |
| [stage4/README.md](../../exec-plan/active/stage4/README.md) 第 13 / 324 / 336 / 352 行 | 已正確反映撤回 | 改為「② 已於 S1 落地後重新宣告」+ WP-30/31 entry 解鎖 |

> 這組不一致本身就是 KI-004 的同類病徵:**同一事實有多份副本,只有部分被更新**。T6 收斂時請保持「權威在一處、其餘指路」的寫法,不要再複製第七份。

---

## Steps

### 1. M14 ② 重新宣告(先確認證據門檻)

- [ ] 確認 **OQ-S1-5** 的裁示。預設門檻:**parity 重產後綠 + 閘 ① 在兩份真實 fixture 綠**即可宣告 ②;不要求重新人工檢核疊圖(①③④⑤⑥ 未撤回,分段走 ω(t) 只依賴 `aim`,與原點無關)。
- [ ] 在 [WP-28 progress.md](../../exec-plan/active/stage4/wp-28-research-foundation/progress.md) 的「事後更正(2026-08-05)— M14 ② 撤回」段落**之後**新增一段「M14 ② 重新宣告」,內含:
  - 重新宣告日期與對應 commit
  - 新證據:閘 ① 的 median/max 偏差(修法前 12.52° / 67.11° → 修法後 ≤ 0.5°)、閘 ② 相對誤差、重產後 parity 綠
  - **效度限制不得擴大**:沿用「效度聲稱限單一匿名 counter-strafe 樣本」的既有措辭。修好原點只恢復 ε 地基的**正確性**,不增加樣本效度。

### 2. KI 文件與帳本狀態

- [ ] [KI-004](../KI-004-sim-world-unit-domain-mismatch.md):
  - 頂部狀態列 🟡 → **「✅ S1 已落地;S2(逐 tick eye pose)/ S3 待辦」**
  - §8「修改紀錄」填入 S1 的實際改動面與 commit
  - §5.1 的 S1 列標記完成;**S2 列改寫** —— ②(`meta.simToWorld`)③(`meta.validity`)與 ① 的**靜態部分**已於 S1 前拉落地,S2 只剩**逐 tick** eye world pose
  - §7 的 OQ 表:OQ-KI4-6 依 T3 的決定(**不拆欄**)關閉或維持;OQ-KI4-2(corridor 觀測粒度)標註「S1 已落布林,粒度升級待定」
- [ ] [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md):
  - §1 索引表 KI-004 狀態改為「🟡 S1 ✅ 已落地 / S2·S3 待辦」
  - BD-004 條目補「**S1 落地(日期 / commit)**」段:實測前後偏差、新增的兩道正確性閘、**S2 ②③ + ① 靜態部分前拉的決定與理由**(2026-08-05 使用者拍板;根治「匯出無法還原原點」的結構性根因)、**偏離計畫**一欄記入「T4+T5 合併為單一 commit(比照 BD-001 的 TDD 偏離慣例)」
  - 條目移入 §3(已修)還是留 §2(進行中)?**建議留 §2** —— S2/S3 未落地,KI-004 整體仍 OPEN;在條目內分段標示 S1 已完成。

### 3. 跨文件對帳(上表逐列)

- [ ] `exec-plan/README.md` 第 13 行狀態列 + 第 125 行 M14 列
- [ ] `stage4/README.md` 第 13 / 324 / 336 / 352 行
- [ ] `MAP.md` 第 38 行(與 stage4/README 對齊)+ 第 231 行(KI-004 狀態)
- [ ] 逐條複查:**「WP-30 / WP-31 entry blocker」的敘述在所有文件中一致**(S1 落地 + ② 重新宣告後 → 解除)。

### 4. S1 資料夾收尾

- [ ] [task-checklist.md](task-checklist.md) 的 Done box 全數翻 ✅。
- [ ] [progress.md](progress.md) 補完 Decision Log / Surprises / Open Questions 三段;把 T0–T5 期間產生的所有歸因與偏離集中在此。
- [ ] 確認 S1 遺留的 OQ(OQ-S1-3 / 4 / 6、OQ-KI4-2 / 5 / 6)在 KI-004 §7 或本檔 progress 有明確落點,**不得只存在於 commit message**。OQ-S1-1 / OQ-S1-2 已於 2026-08-05 隨前拉拍板關閉,兩處狀態需一致。

---

## Definition of Done

- [ ] M14 ② 重新宣告已寫入 WP-28 `progress.md`,含閘 ①/閘 ② 的實際數字與重產 parity 證據,且效度限制措辭未擴大。
- [ ] KI-004 頂部狀態、§5.1 S1 列、§8 修改紀錄三處一致。
- [ ] BD-004 條目含 S1 落地段(前後偏差 + 兩道新閘 + 兩項偏離);§1 索引表狀態同步。
- [ ] 上表五個文件位置全部對帳完成;`grep -n "M14" docs/` 的結果中**不存在**仍宣稱「六項全綠 / ② 綠」的殘留。
- [ ] `grep -rn "entry blocker" docs/` 的敘述彼此一致。
- [ ] `task-checklist.md` 全數 ✅;`progress.md` 三段齊備。
- [ ] 本 task 零程式碼改動:`git diff --stat` 只含 `docs/`。

## Commit message

```
docs(ki-004): S1 落地對帳 — M14 ② 重新宣告 + 帳本/里程碑跨文件收斂

K-2 收尾(FR-S1-12)。S1 修好離線 ε(t) 的量測原點並補上兩道正確性閘後,
M14 ② 以「閘 ① 在兩份真實 fixture 綠 + 重產 parity 綠」為證據重新宣告;
效度聲稱維持「限單一匿名 counter-strafe 樣本」不變。WP-30/31 entry blocker 解除。

一併收斂撤回未傳播造成的跨文件不一致:exec-plan/README.md 的 M14 列仍寫
「六項全綠 / entry blocker 已解除」、MAP.md 寫「②③⑥ 綠 / ①④⑤ 阻塞」——
兩者皆與 stage4/README 的撤回敘述矛盾。
```
