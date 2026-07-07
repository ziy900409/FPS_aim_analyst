# T3 — tick 內 cycletime 產彈排程 + 彈匣

> Part of [WP-11 weapon-fire](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T1(WeaponConfig)、T2(heldFire) |
| **Risk / Cplx** | Med / High |
| **Touches** | MODIFY `src/loop/SimLoop.ts`、`src/state/SharedState.ts`(weapon 欄)、`src/main.ts`(注入 ak47)+ 測試 |
| **狀態** | ✅ |

## Objective

產彈與輸入事件解耦:fire down/up 只維護 `heldFire`,**tick 內以 cycletime 排程出彈**
(full-auto)。彈匣盡即停火(OQ-S2-6)。此產彈點即 WP-13 的 recoil `onFire` 唯一掛點。

## In scope
- `SharedState.weapon = { nextFireT: number; ammo: number; magSize: number }`(reset 原地;ammo 初值 = magSize)。
- `createSimLoop(..., weapon?: WeaponConfig)` 注入;`main.ts` 綁 `getWeapon('ak47')`。
- `simStep` 內(consume 之後、movement 之前)排程:

```ts
// fire down 事件(applyInput)只設 heldFire=true 並「武裝」首發:nextFireT = min(nextFireT, ev.t)
while (s.heldFire && s.weapon.ammo > 0 && s.weapon.nextFireT <= tickEndMs) {
  fireOneShot(s, s.weapon.nextFireT);        // 既有單發邏輯搬入:raycast+firstShot+recordEvent(t=排程時刻)
  s.weapon.ammo--;
  s.weapon.nextFireT += weapon.cycletimeSec * 1000;   // 累加制,防漂移
}
```

- **OQ-11.1 定案**:down→up 落同 tick 的單擊,down 事件當下先武裝 `nextFireT = ev.t`,
  排程迴圈在 up 之前的 consume 順序處理 → 保證至少 1 發;測試鎖定。
- T2 暫留在 applyInput 的單發 raycast 搬入 `fireOneShot`(行為守恆:單擊仍一發)。

## Out of scope
- recoilOnFire/spread/彈道方向(WP-13 在 `fireOneShot` 內接);reload;drill 換彈匣重置政策
  (restart 時 `resetState` 回滿,沿用既有 reset 鏈)。

## Steps

- [x] SharedState.weapon 欄 + reset;createSimLoop 簽名 + main 注入。
- [x] `fireOneShot` 抽出(含 fire 事件 recordEvent,t = 排程時刻非事件時刻——記 Design note 與 schema 對帳點 WP-16)。
- [x] 排程迴圈 + 首發武裝;OQ-11.1 單擊測試。
- [x] 測試:合成 held 3.0s(AK)→ 恰 30 發後停(ammo 0);30 發 span = 2900ms ± 7.8125ms;
      放開再按 → 不重填彈匣(restart 才回滿);M4A1-S(mag 20)→ 20 發。
- [x] `npx vitest run` 全綠(含決定性回歸)。

## Definition of Done

- 上述測試全綠;`fireOneShot` 為單一產彈點(grep raycastFromCenter 於 SimLoop 僅此一處);
  排程為累加制(code review 檢查點記 progress)。

## Commit

`feat(wp-11): T3 cycletime 產彈排程(full-auto)+ 彈匣,產彈點收斂為 fireOneShot`
