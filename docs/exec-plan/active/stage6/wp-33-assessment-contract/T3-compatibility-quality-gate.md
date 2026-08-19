# T3 — `checkCompatibility()` / `checkQualityGate()` 純函式 + 單元測試

> Part of [WP-33 assessment-contract](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(需要 `AssessmentMeta` 型別) |
| **Risk / Cplx** | Med(OQ-S6-10/11 需在本 task 拍板初版) |
| **Touches** | `src/metrics/compatibilityKey.ts`(新) |
| **狀態** | ⬜ |

## Objective

把 FR-F4 的相容比較鍵與品質旗標判定,從「文件描述的九個欄位」變成一支所有下游 WP 都必須呼叫的純函式,杜絕「每個 WP 各自寫一份相容性判斷」(C-D4 的另一種犯法方式:不是重新定義既有構念,而是重複實作同一個新構念)。

## In scope

1. `src/metrics/compatibilityKey.ts`(新檔):

   ```ts
   export interface CompatibilityKey {
     readonly participantId: string;
     readonly taskId: string;
     readonly protocolVersion: string;
     readonly gameMovementProfile: string;
     readonly weaponId: string;
     readonly weaponMode: string;
     readonly sensitivityFovKey: string;
     readonly targetConditionCell: string;
     readonly assessmentFeedbackPolicy: string;
     readonly qualityGateStatus: string;
   }

   export function deriveSessionId(meta: Meta): string;
   // = `${meta.session.participantId}:${meta.startedAt}`(缺 meta.session → throw,契約要求 Assessment 匯出必含 session)

   export function buildCompatibilityKey(
     meta: Meta,
     taskId: string,
     targetConditionCell: string,
     qualityGateStatus: QualityGateStatus,
   ): CompatibilityKey;

   export function checkCompatibility(a: CompatibilityKey, b: CompatibilityKey): boolean;
   // 九欄位全等才 true;任一欄位不等即 false(非模糊比對)

   export type QualityGateStatus = 'ok' | 'insufficient-n' | 'incompatible-protocol' | 'suspect-run';

   export function checkQualityGate(args: {
     n: number;
     minN: number;
     suspect: boolean;
     compatible: boolean;
   }): QualityGateStatus;
   ```

2. **OQ-S6-10 拍板(初版)**:讀 `activeWeaponConfig()`/`WeaponConfig` 現況,確認目前只有單一 hip/ADS 變體是否共用同一 `weaponId`。若無獨立 ADS-only 變體概念,`weaponMode` 初版直接等於 `weaponId`(留 TODO 註解,待多武器/ADS Assessment 出現時再拆分為獨立欄位)。
3. **OQ-S6-11 拍板(初版)**:`targetConditionCell` 定為「呼叫端自行序列化的非空字串」,`buildCompatibilityKey()` 只驗證非空,不解析內容;三家族(WP-34~37)各自決定序列化格式,寫入 `analysis-assessment-contract.md` 作為約定(而非本 WP 強制格式)。

## Out of scope

- WP-38 如何呼叫這兩支函式做 session history 聚合(WP-38 T0/T2)。
- 三家族各自的 `targetConditionCell` 序列化實作(WP-34~37)。

## Steps

- [ ] 讀 `WeaponConfig`/`activeWeaponConfig()`,拍板 OQ-S6-10,記入 progress.md。
- [ ] 拍板 OQ-S6-11(非空字串鍵,格式留家族決定),記入 progress.md。
- [ ] 實作 `deriveSessionId`/`buildCompatibilityKey`/`checkCompatibility`/`checkQualityGate`。
- [ ] 單元測試:
  - `deriveSessionId`:合法 `meta.session` → 穩定字串;缺 `meta.session` → throw。
  - `checkCompatibility`:九欄位全等 → true;逐一改動任一欄位 → false(9 個反例案例)。
  - `checkQualityGate`:`n<minN` → `insufficient-n`;`!compatible` → `incompatible-protocol`;`suspect` → `suspect-run`;三者皆否 → `ok`;優先序需覆蓋多條件同時成立時的判定順序(合成案例)。
- [ ] 於 `analysis-assessment-contract.md` §1 補相容鍵欄位定義表 + OQ-S6-10/11 拍板結果。

## Definition of Done

| # | 條件 | 判定方式 |
|---|---|---|
| ① | 四支函式落地且為純函式(無副作用/無 I/O) | code review 檢查點 + `tsc --noEmit` |
| ② | `checkCompatibility` 九欄位全等/任一不等的正反例全覆蓋 | 單元測試 10 案例(1 正 + 9 反)全綠 |
| ③ | `checkQualityGate` 四種狀態 + 優先序案例全覆蓋 | 單元測試全綠 |
| ④ | OQ-S6-10/OQ-S6-11 拍板結果記入 progress.md 與 `analysis-assessment-contract.md` | 兩處皆有記錄 |
| ⑤ | `npm run test:ci` 全綠 | 貼原始輸出到 progress.md |

## Commit

`feat(wp-33): T3 — checkCompatibility/checkQualityGate 純函式(FR-F4,OQ-S6-10/11 初版拍板)`
