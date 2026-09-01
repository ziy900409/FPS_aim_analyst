# KI-016 — `sessionPlanFamilyOrder` metadata 驗證仍鎖死 `TEST_FAMILY_IDS`，未跟上 WP-45 的家族聯集

> 類型：latent correctness bug（尚未被任何已知操作路徑觸發）。
> 狀態：🟢 已修復（WP-52 T2，2026-09-01）：單一來源允許清單落地，見 §5 DoD。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-016。
> 發現脈絡：稽核「Session Plan 家族清單能否改成下拉式選單/置換 preset」時讀碼發現。

## 1. 症狀（尚未實際觸發，屬讀碼發現的地雷）

`main.ts:516-521` 匯出 metadata 時，若 `sessionPlanRunner.phase.kind === 'family'`，會把
`activeSessionPlanSelection.families` 原封不動塞進 `sessionPlanFamilyOrder` 欄位：

```ts
...(sessionPlanRunner.phase.kind === 'family' && activeSessionPlanSelection !== undefined
  ? {
      sessionPlanRestSeconds: activeSessionPlanSelection.restSeconds,
      sessionPlanFamilyOrder: activeSessionPlanSelection.families,
    }
  : {}),
```

這個值最終流進 [`src/data/metadata.ts:330-338`](../../src/data/metadata.ts#L330) 的 `requireSessionPlanFamilyOrder`：

```ts
function requireSessionPlanFamilyOrder(value: unknown): readonly string[] {
  if (!Array.isArray(value)) throw new Error('sessionPlanFamilyOrder must be an array');
  return value.map((family, index) => {
    if (typeof family !== 'string' || !(TEST_FAMILY_IDS as readonly string[]).includes(family)) {
      throw new Error(`sessionPlanFamilyOrder[${index}] must be a configured test family`);
    }
    return family;
  });
}
```

只認 `TEST_FAMILY_IDS`（`hold-click`/`hold-track`/`spider-shot`/`counterstrafe`）四個值。只要
`activeSessionPlanSelection.families` 裡出現 `'peek-click-transfer'`（`TRANSFER_PILOT_FAMILY_IDS` 的成員，
WP-45 T5 新增），這個 map 會在第一次踩到它時 throw，**整個 `buildMetadata()` 呼叫失敗**，等於該 drill
的匯出直接中止。

## 2. 根因

WP-45 T5 在 [`SessionRunner.ts:49`](../../src/session/SessionRunner.ts#L49) 新增了聯集允許清單：

```ts
const KNOWN_SESSION_FAMILY_IDS: ReadonlySet<SessionFamilyId> = new Set([
  ...TEST_FAMILY_IDS,
  ...TRANSFER_PILOT_FAMILY_IDS,
]);
```

這條允許清單只更新了 `SessionRunner.ts` 自己那份，`metadata.ts` 的 `requireSessionPlanFamilyOrder` 是
獨立寫死的第二份，WP-45 T5 完全沒有觸碰它（T5 的 DoD 沒有涵蓋 metadata 匯出路徑）。兩份允許清單各自
維護，其中一份忘了跟著改——這正是專案在 GD-7（hitbox 單一來源）想避免的「同一構念兩個定義」模式，
只是這次沒有硬約束把它釘住。

**目前為什麼從沒炸過**：稽核當下發現，操作端 `main.ts:360-361` 的 `createSessionPlanSetup({ families:
TEST_FAMILY_IDS, ... })` 是寫死餵入四家族常數，從未把 `TRANSFER_PILOT_FAMILY_IDS` 或
`sessionPlanPresets.ts` 的 preset 註冊表接進操作端 UI。所以 `activeSessionPlanSelection.families` 實務上
永遠是 `TEST_FAMILY_IDS` 的子集，`'peek-click-transfer'` 從未真的流進這條路徑。**這個 bug 是被「另一個
從未落地的功能」意外遮住，不是被修好。**只要有任何後續改動（例如把 preset 切換開放給操作端 UI，或任何
其他方式讓 `SessionRunner.start()` 吃到含 `'peek-click-transfer'` 的 `families`），匯出會立刻在
`buildMetadata()` 中段失敗。

## 3. 修復計畫（尚未落地）

**單一來源化**：把 `KNOWN_SESSION_FAMILY_IDS`（或等價的完整 `SessionFamilyId` 允許清單）搬到
`src/session/sessionSchedule.ts`（該模組已經是 `TEST_FAMILY_IDS`/`TRANSFER_PILOT_FAMILY_IDS`/
`SessionFamilyId` 的定義處，語意上最貼近的家）並 `export`；`SessionRunner.ts` 改成 import 它，刪掉自己
那份本地重複定義；`metadata.ts` 的 `requireSessionPlanFamilyOrder` 改成用同一份聯集驗證，取代硬寫的
`TEST_FAMILY_IDS`。

不採用「metadata.ts 自己再拼一次聯集」（`[...TEST_FAMILY_IDS, ...TRANSFER_PILOT_FAMILY_IDS]`）：這只是
把兩份重複變不同位置的兩份重複，同樣的漂移問題下次還會發生；必須收斂成一個 export。

## 4. 影響面

- **受影響**：任何未來讓 `SessionRunner.start()` 的 `families` 包含 `TRANSFER_PILOT_FAMILY_IDS` 專屬成員
  （目前只有 `'peek-click-transfer'`）並嘗試匯出的路徑——目前唯一已知會這樣做的候選是「把 session-plan
  preset 切換開放給操作端 UI」這個尚未動工的功能（見對話中另外討論的置換/preset 下拉需求）。
- **不受影響**：現行 stage6/stage7 四家族 Session Plan 操作流程（`TEST_FAMILY_IDS` 子集），因為從未觸發
  這條驗證分支的失敗路徑；既有 `test:ci` 全綠不代表這個 gap 不存在，只代表沒有測試覆蓋含
  `'peek-click-transfer'` 的 `sessionPlanFamilyOrder`。

## 5. Definition of Done（修法落地時驗收）

- [x] `sessionSchedule.ts` 匯出單一 `SessionFamilyId` 允許清單常數（`KNOWN_SESSION_FAMILY_IDS`）；`SessionRunner.ts` 改為 import，刪除本地重複定義。
- [x] `metadata.ts` 的 `requireSessionPlanFamilyOrder` 改用同一份允許清單驗證。
- [x] 新增回歸測試（`metadata.test.ts`）：`sessionPlanFamilyOrder` 含 `'peek-click-transfer'` 時 `buildMetadata()` 不再 throw。
- [x] 既有四家族的 `sessionPlanFamilyOrder` 正向/負向 case（`metadata.test.ts`）零修改全綠。
- [x] `sessionPlanPresets.test.ts` / `SessionRunner.test.ts` 既有行為零修改全綠（不得動到凍結順序邏輯）。
- [x] `npx vitest run src/session/sessionSchedule.test.ts src/session/SessionRunner.test.ts src/session/SessionRunnerPoll.test.ts src/data/metadata.test.ts src/session/sessionPlanPresets.test.ts` exit 0（5 files / 81 tests）。

## 6. Commit（落地時）

`fix(ki-016): sessionPlanFamilyOrder metadata 驗證改用單一來源允許清單`

落地於 WP-52 T2（[wp-52 progress.md](../exec-plan/active/stage11/wp-52-peek-click-transfer-pilot-v2/progress.md)）。
