# T1 — WeaponConfig + validateWeapon + 三把內建武器

> Part of [WP-11 weapon-fire](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0 |
| **Risk / Cplx** | Low / Low |
| **Touches** | NEW `src/weapon/WeaponConfig.ts`、`src/weapon/weapons.ts`、`src/weapon/WeaponConfig.test.ts` |
| **狀態** | ⬜ |

## Objective

武器 = 資料(F4 精神延伸):定義 `WeaponConfig` 型別 + 執行期驗證,內建三把
CS2 vdata 預設值;新增武器 = 新 config 物件,零引擎程式碼改動。

## In scope
- `WeaponConfig`(對齊 [../README.md §2.3](../README.md) 契約):

```ts
export interface WeaponConfig {
  id: string;
  cycletimeSec: number;             // AK 0.10 / M4A4 0.09 / M4A1-S 0.10
  magSize: number;                  // 30 / 30 / 20
  recoil: { seed: number; magnitude: number; magnitudeVariance: number; angleVariance: number };
  inaccuracy: { stand: number; crouch: number; fire: number; move: number;
                recoveryTimeStand: number; recoveryTimeCrouch: number };
  recoveryTransition?: { startBullet: number; endBullet: number };
}
```

- `validateWeapon(input: unknown): WeaponConfig`:比照 [drill/schema.ts](../../../../../src/drill/schema.ts)
  的 `err`/`require*` helper 模式(正數、正整數、範圍),錯誤訊息含欄位路徑。
- `weapons.ts`:`ak47` / `m4a4` / `m4a1s` 常數(vdata 值見 [README §2](README.md) 表)+
  `getWeapon(id)`;stand/crouch/move/recovery 值以研究計畫 + vdata 對照填入,出處註解。

## Out of scope
- 產彈排程(T3)、DrillConfig 掛鉤(WP-16)、武器 JSON 外部載入(內建常數即可,F4 對帳延後)。

## Steps

- [ ] `WeaponConfig.ts` 型別 + `validateWeapon`(重用 schema.ts helpers——若 export 需微調,同刀處理並跑其既有測試)。
- [ ] `weapons.ts` 三把內建 + `getWeapon`(未知 id 拋錯含可用清單)。
- [ ] 測試:三把內建全過 validate;缺欄/負值/零 cycletime 各一 case 拒收;`getWeapon('ak47').recoil.seed === 223`。
- [ ] `npx vitest run src/weapon src/drill` 全綠。

## Definition of Done

- 型別與 [../README.md §2.3](../README.md) 契約一致;測試 ≥ 6 cases 全綠;drill schema 既有測試不受影響。

## Commit

`feat(wp-11): T1 WeaponConfig + validateWeapon + 內建 ak47/m4a4/m4a1s(CS2 vdata)`