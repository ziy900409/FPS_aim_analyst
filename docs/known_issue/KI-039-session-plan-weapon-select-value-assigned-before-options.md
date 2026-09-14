# KI-039 — Session Plan 逐列武器 select 在 `<option>` 建立前指派 `value`,重繪後「顯示」與「狀態」脫鉤

> 類型：**operator-facing state desync**（不是渲染失敗）。兩種後果:(a) 在 weapon-pinned drill 上
> 產生**無法從 UI 清除**的編譯失敗死結;(b) 在未 pin 的 drill 上**靜默**以操作員看不到的武器開跑。
> 狀態：✅ **已修 + 落地（2026-09-14）**。決策 `BD-037`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引 · §3 `BD-037`。
> 標的：[`src/ui/SessionPlanSetup.ts`](../../src/ui/SessionPlanSetup.ts) `renderItems()` 內的逐列
> 武器 `<select>`（修前 `:408`，`weapon.value` 早於 `weapon.appendChild(...)`）。
> 相關：[CLAUDE.md §4](../../CLAUDE.md)(WP-62 / D-62-1 的武器覆寫紅線) ·
> [`src/session/sessionProgram.ts`](../../src/session/sessionProgram.ts) `requireWeapon()`。
> 發現脈絡：使用者 2026-09-14 在**另一台機器的 Chrome** 實測回報「Session Plan 預覽畫面消失」，
> 附照片:三列 program 的第三列(`tracking_core_pr_3deg_14dps_feedback_v1`)顯示「—（drill 預設）」，
> 但狀態列印的是 `items[2].weaponId … 不可指定其他武器`。

## 1. 症狀

「預覽不可用」本身是**設計行為** —— [`SessionPlanSetup.ts:484`](../../src/ui/SessionPlanSetup.ts)
的 `setCompileFailure()` 在 `compileSessionProgram()` 丟錯時清空預覽並 disable submit（FR-58.7）。
真正的異常是**那一列的下拉選單說謊**：

| | 照片所見 | `item.weaponId` 實際值 |
|---|---|---|
| items[0] `spider-shot-wide-v1` | `usp_s_laser（12 發）` | `usp_s_laser` |
| items[1] `micro_flick_three_target_test_v9` | `usp_s_laser（12 發）` | `usp_s_laser` |
| **items[2]** `tracking_core_pr_3deg_14dps_feedback_v1` | **`—（drill 預設）`** | **某個覆寫值 ≠ `tracking_pilot_hold`** |

該 drill 列在 `DECLARED_WEAPON_ROSTER`（[`drillFamily.ts`](../../src/session/drillFamily.ts)），
`requireWeapon()` 因此拒絕任何覆寫 ⇒ 恆定編譯失敗。

**而且救不回來。** 清除覆寫的唯一途徑是讓該 `<select>` 發出一次 `change` 到空值，但選單**已經**
顯示著空值 —— 重選同一項不觸發任何事件。操作員只能誤打誤撞先選別的武器、再切回預設。

## 2. 根因

```ts
// 修前 SessionPlanSetup.ts:406-419
const weapon = document.createElement('select');
weapon.name = 'sessionPlanWeapon';
weapon.value = item.weaponId ?? '';        // ← 此時 select 一個 <option> 都沒有
...
weapon.appendChild(defaultWeapon);          // option 在這之後才加
for (const [weaponId, config] of ...) { ... weapon.appendChild(option); }
```

HTML 的 selectedness 規則：`select.value = X` 若沒有任何 `<option>` 的 value 等於 X，
`selectedIndex` 停在 `-1`、指派被**靜默丟棄**；隨後插入的第一個 option（此處正是
「—（drill 預設）」）自動成為選取項。真 Chromium 實測（`about:blank`，兩種順序對照）:

| 指派順序 | `select.value` | `selectedIndex` | 使用者看到 |
|---|---|---|---|
| value 先、option 後（**修前**） | `''` | `0` | `—（drill 預設）` |
| option 先、value 後（**修後**） | `usp_s_laser` | `1` | `usp_s_laser` |

`renderItems()` 會在**新增 / 刪除 / ▲▼ / 拖曳**時重建每一列，於是每次重繪都把所有武器選單的
*顯示*重設回「drill 預設」，而閉包裡的 `item.weaponId` 原封不動。照片的狀態完全吻合：第 1、2 列是
最後一次重繪**之後**才選的，第 3 列的覆寫值是重繪**之前**留下的、已經看不見。

與機器無關 —— 任何 Chrome 都成立;換一台只是剛好按到了那個操作順序。

同檔案 130 行前的 drill picker（[`:287`](../../src/ui/SessionPlanSetup.ts)）順序是**對的**
（optgroup/option 先、`picker.value` 後），`SettingsPanel` / `TrackingPilotOperatorScreen` /
`Controls` 的 select 亦然 ⇒ 全 repo 僅此一處寫反。

## 3. 影響面

1. **報錯版本（weapon-pinned drill）**：`tracking_reversal_feedback_v1`、
   `tracking_core_pr_3deg_14dps_feedback_v1`、八個 `tracking_br_v1__*` 格 —— 操作員面對一個講不清
   來源、且 UI 上清不掉的「預覽不可用」。**不產生錯資料**（submit 被擋住）。
2. **沉默版本（未 pin 的 drill）—— 比報錯版本危險**：殘留的 weaponId 對該 drill 合法時，編譯通過、
   預覽照常、直接開跑,受測者用的是操作員**沒看到**的武器。而 `CompatibilityKey` 含 `weaponId`
   （UI 自己就寫著「逐列換武器會讓 history 趨勢分群」）⇒ 趨勢線被靜默切成兩群。
3. **不影響** sim/命中/決定性/schema：本 bug 只在 UI 的 select 顯示層，`item.weaponId` 一直是對的，
   送出的 plan 與預覽所編譯的 program 也一直一致（兩者同源）。錯的只有「操作員看到什麼」。

## 4. 修法（已落地 = 選項 A）

**選項 A（採用）—— 把 `weapon.value = item.weaponId ?? ''` 移到 option 迴圈之後。**
一行位移，與同檔案 drill picker 的既有寫法對齊，無新概念、無新狀態。

**選項 B —— 改在每個 option 上設 `selected`。** 等價但更囉嗦，且要自行處理「預設」那一項，
反而多一個判斷分支。無收益。

**選項 C —— 重繪時保留舊 DOM 節點、只更新變動的列。** 能一併省掉重繪成本，但那是
`renderItems()` 的架構改寫，遠超本 bug 的範圍，且 NFR-58.4 的重繪預算（p95 1.7ms / 50ms）
顯示現行全量重建毫無壓力。否決。

## 5. 為何 6 次綠燈都沒抓到 —— 假 DOM 的失真

[`SessionPlanSetup.test.ts`](../../src/ui/SessionPlanSetup.test.ts) 用自製 `FakeElement`：
`value` 是純欄位、`appendChild()` 只 push 陣列，**不跑 selectedness 演算法** ⇒ 早於 option 的指派
在假 DOM 裡完好存活。這個 bug 從 `2806c37 feat(ui): choose a weapon per session plan item` 起就在，
期間該檔案的測試一路全綠。

修法同時讓假 DOM 忠實：`FakeElement` 的 `value` 改為 accessor，`<select>` 只接受**當下**已有
`<option>` 承載的值（遞迴含 optgroup）。這才是讓回歸測試有意義的前提 —— 兩個新測試在修前確認為紅
（`expected '' to be 'usp_s_laser'` / `'m4a1s'`）。

**其餘 22 個測試檔各自持有 `FakeElement` 的副本，本次未動** —— 見 OQ-KI39-1。

## 6. 遺留 OQ

- **OQ-KI39-1**：`FakeElement` 在 23 個測試檔各有一份複本，只有本檔的那份現在忠實模型 `<select>`。
  其餘各檔仍會原諒同類順序錯誤。是否抽成共用測試工具（並讓 23 份都升級）？本次刻意不做 —— 屬跨檔
  重構，不該搭 bug 修復的便車。
- **OQ-KI39-2**：修前若已有以「看不見的武器」跑出的 custom Session Plan 匯出，需以 `meta` 的
  `weaponId` 對帳。無法從既有資料反推操作員當時「看到」什麼 ⇒ 只能逐份確認 weaponId 是否為預期值。
