# T3 — 文件 / 帳本對帳 + A2 前置條件回寫

> 上游:[C README §1.4](README.md)(in scope 文件清單)· C-5(與 reliability gate 區隔)· §6(交給 A2 的驗收清單)
> 交付:**FR-C-10(文件半)· FR-C-12 · FR-C-13 · FR-C-14**
> 本 task **零程式碼改動**;`git diff --stat` 應只有 `docs/` + `CONTEXT.md` + `research/README.md`。

---

## Steps

### 1. flag 詞彙登錄(FR-C-10)

[docs/operational/analysis-segments.md](../../operational/analysis-segments.md) 的 “Quality flag vocabulary” 段:

- [ ] 表格新增 **Level** 欄,既有 13 個 flag 標為 `segment` / `peek`。
- [ ] 新增兩列(Level = **session**):

  | Flag | Level | Meaning |
  |---|---|---|
  | `construct_absent:<construct>` | session | 該 drill 家族宣告的核心構念未出現在資料中;此 session 不得用於該 drill 的效度宣告。 |
  | `construct_unknown` | session | drill 家族未在 `CONSTRUCT_REGISTRY` 註冊;構念存在性**未經檢查**(非「已通過」)。 |

- [ ] 明記兩套詞彙常數的分工:`QUALITY_FLAG_VOCABULARY`(segments,peek/segment 級)與 `CONSTRUCT_FLAG_VOCABULARY`(ingest,session 級)**刻意不合併**,理由 = 避免 ingest 反向依賴 segments。
- [ ] 於參數登錄段新增 `construct-v1`(`min_counter_events=1`、`min_moving_tick_ratio=0.05`),並註明**調整須升版**(C-6),比照 `seg-v1` 的敘述。

### 2. “Real-export validation” 段加註(FR-C-12)

同檔 §Real-export validation(目前約 L84–93)——**不刪除既有敘述**(它是歷史紀錄),於段末加註:

- [ ] 該段所述 27.39 s / 3,507 tick 的樣本即 08:03 匯出,**全程無鍵盤輸入、`vx ≡ 0`、零 `counter` 事件** ⇒ 量到的是站樁純 flick,**不含 counter-strafe 構念**([KI-006](../KI-006-m14-sample-no-counterstrafe.md))。
- [ ] 明記「it … clears M14's real-data validity gate」一句**已撤回**;M14 ④⑤ 的重新宣告需新採樣([A2-T4](../KI-005-A/A2-blocked-plan.md))。
- [ ] 另註 KI-005 的獨立撤回理由(ω beat aliasing),避免讀者以為只有一條。

### 3. fixture 表補構念判定(FR-C-12)

[research/README.md](../../../research/README.md) 的 “Committed real exports” 表:

- [ ] 08:03 列補:`construct-v1` 判定 = **absent**;`run_pipeline` 對其 **exit 2**;仍保留其「零輸入邊界案例」的正當用途(D-C2 的依據,**不得刪**)。
- [ ] 09:39 列補:判定 = **present**(`counter` 24、橫移佔比 0.5196);並更新 KI-004 相關警語(S1 已落地,單位域問題已修)。
- [ ] 於 “Parameter registry” 段補一行 `construct-v1`。

### 4. CONTEXT.md 新增詞條(C-5)

- [ ] 新增 **construct presence gate(構念存在性閘,`construct-v1`)**:由 drill 家族宣告核心構念,ingest 時斷言其在資料中確實出現;三態 `present / absent / unknown`;缺席時 `run_pipeline` exit 2 且該 session 不得作為該 drill 的效度證據。
- [ ] 與既有 **reliability gate(構念驗證閘)** 詞條**互相指路**並明記差異:

  | | construct presence gate | reliability gate |
  |---|---|---|
  | 問的問題 | 資料裡**有沒有**這個行為 | 這個**指標**夠不夠可信 |
  | 層級 | session / 資料 | metric / 報告 |
  | 時機 | ingest | 指標進教練報告前 |
  | 權威 | `construct-v1`(本階段) | WP-31 T0 pre-register(佔位) |

- [ ] 順帶記下 drill 家族命名慣例(`<family>_<variant>_v<n>`,合成加 `synthetic_` 前綴),因為家族解析依賴它(FM-1)。

### 5. 帳本對帳(FR-C-13)

- [ ] [KI-006](../KI-006-m14-sample-no-counterstrafe.md):頂部狀態改「🟡 **C 已落地**(construct presence gate);B(重新採樣)待 [A2](../KI-005-A/A2-blocked-plan.md)」;§4 選項 C 標「✅ 已落地,計畫見 [KI-006-C/](README.md)」;§6 **OQ-KI6-2 關閉**(納入本輪)、**OQ-KI6-3 關閉**(門檻以 `construct-v1` 凍結,證據見 README §2.3);OQ-KI6-1/4 維持並指向 §6 的 B-1~B-5。
- [ ] [BUGFIX-DECISIONS.md](../BUGFIX-DECISIONS.md):§1 索引的 KI-006 列狀態更新;BD-006 新增「**C 落地(日期)**」段,含:四份 fixture 的判定與實測值、凍結門檻與其 pre-register 理由(D-C5)、D-C1(Python registry 而非引擎自我描述)的取捨與殘餘風險(TD-3)、以及**明確聲明 C 不解除任何 M14 撤回**。
- [ ] [KI-005-A / A2-blocked-plan.md](../KI-005-A/A2-blocked-plan.md):「前置條件」清單中的 KI-006 兩項改為引用 [KI-006-C README §6](README.md) 的 B-1~B-5;A2-T1 的 checklist 補「採完立即跑 construct presence gate,不合格當場重採」(B-3)。
- [ ] [MAP.md](../../MAP.md) / [exec-plan/README.md](../../exec-plan/README.md):KI-006 的敘述與狀態對齊(**WP-30/31 entry blocker 三條理由中的 KI-006 這條仍維持** —— C 只補閘,不恢復效度)。

### 6. 誤導性敘述複查(G-8)

- [ ] `grep -rn "construct" docs/ research/README.md CONTEXT.md` —— 確認無任何地方暗示「construct gate 落地 ⇒ M14 ④⑤ 可重新宣告」。
- [ ] `grep -rn "M14" docs/` —— 確認 ④⑤ 的撤回狀態敘述在所有檔案一致。
- [ ] `grep -rn "entry blocker" docs/` —— 確認三條理由的解除狀態敘述一致(KI-004 已解除;KI-005 / KI-006 仍維持)。

---

## Definition of Done

- [ ] flag 表含 Level 欄與兩個 session 級 flag;`construct-v1` 已進參數登錄段並註明調整須升版。
- [ ] “Real-export validation” 段已加註「所述樣本不含 counter-strafe」且「clears M14's real-data validity gate」已標明撤回。
- [ ] `research/README.md` fixture 表兩列皆有構念判定,且 08:03 的邊界案例用途**未被刪除**。
- [ ] `CONTEXT.md` 有 **construct presence gate** 詞條,與 **reliability gate** 互相指路且差異表存在。
- [ ] KI-006 狀態 / §4-C / OQ-KI6-2 / OQ-KI6-3 已更新;BD-006 有「C 落地」段且含「不解除任何 M14 撤回」的明文。
- [ ] A2-blocked-plan 的前置條件已改為引用本檔 §6,不再各寫一半。
- [ ] 三條 `grep` 複查輸出貼於 [progress.md](progress.md),無矛盾殘留。
- [ ] `git diff --stat` 僅 `docs/` + `CONTEXT.md` + `research/README.md`;**零程式碼改動**。

## Commit message

```
docs(ki-006): C T3 — flag 詞彙 / CONTEXT 詞條 / 帳本對帳 + A2 採集條件回寫

analysis-segments.md flag 表加 Level 欄與兩個 session 級 flag、參數登錄新增
construct-v1;Real-export validation 段加註所述樣本不含 counter-strafe 並標明
M14 效度宣告已撤回。CONTEXT.md 新增 construct presence gate 並與 reliability gate
區隔。KI-006 / BD-006 狀態更新;KI-005-A2 的前置條件改為引用 KI-006-C §6。
```
