# KI-025 — protocol version 字串停在 `tracking-pilot-v1`:D-54.49 換代後,**G5 與 G6 拿到同一把 compatibility key**

> 類型:tech spec(診斷 + 修改計畫)。語言:繁中,術語保留英文(D4)。
> 狀態:✅ **已修**(2026-09-07,WP-54 T7 slice 21,使用者決定「招募前修」)。
> 決策帳本:[BD-025](BUGFIX-DECISIONS.md)。相關決策:**D-54.11**(凍結 v1)、**D-54.49**(宣告 v2)。
> 發現於 **T7 G6 乾跑分析**——逐 run 行印出的 `cell=tracking-pilot-v1:P07:session-0` 與 gate §2.1
> 已改寫的「Protocol version = `tracking-pilot-v2`」不一致。
> 這是 [KI-020](KI-020-core-matrix-size-speed-manipulation-not-delivered.md) /
> [KI-023](KI-023-target-speed-set-point-is-per-axis-not-2d.md) /
> [KI-024](KI-024-field-low-eye-not-anchored-halves-delivered-angles.md) 同一家族的第四次:
> **宣稱的值不是交付的值**。前三次的落差在角度與速度,這一次在**資料的身分標籤**。

---

## 1. 症狀

D-54.49(2026-09-04)決定 scored 窗改為「全程按住左鍵」,並明文宣告 **新 protocol version
`tracking-pilot-v2`** + 新刺激世代 **G6**。gate §2.1、`analysis-tracking.md` 世代表、runbook、
`CONTEXT.md` §P 全部照這個決定更新了。**但程式沒有。**

T7 slice 12–18 的 progress 條目明載「未動 production code」(slice 18)。換代所需的 runtime 改動
(v2 武器、`requireFire` guard、逐 tick `fire`)都落地了,**唯獨版本字串沒有跟上**:

| 位置 | 值 | 效果 |
|---|---|---|
| `src/pilot/trackingCompatibilityKey.ts` `TRACKING_PILOT_PROTOCOL_VERSION` | `'tracking-pilot-v1'` | compatibility key 的 `protocolVersion` 軸 |
| `src/pilot/trackingPilotEvidence.ts` `TRACKING_PILOT_EVIDENCE_PROTOCOL_VERSION` | `'tracking-pilot-v1'`(**另一份手寫字面值**) | evidence JSON / HTML 的 `protocolVersion` 戳記 |
| `src/session/trackingPilotManifest.ts` `TrackingPilotManifest.protocolVersion` | 型別為字面值 `'tracking-pilot-v1'`(**第三份**) | manifest 驗證 + `generatedFromCounterbalanceCell` |

G6 乾跑 9 份 payload 的實測結果:

```
cell=tracking-pilot-v1:P07:session-0        (全部 9 份)
evidence protocolVersion = tracking-pilot-v1
```

## 2. 根因

**同一個常數有三份來源**:一個 `export const`,加上兩份各自手寫的字面值(一個是第二個 const、
一個是型別標註)。D-54.49 要改的是「那個協定版本」,但沒有任何單一位置可改——這正是
C-D4「同一構念不得有第二定義」在**版本字串**上的具體形態。

三份都停在 v1,所以彼此一致、任何測試都不會紅,**不一致的對象是文件與決策帳本**——而那是唯一
記錄「協定已經換代」的地方。

## 3. 影響面:為什麼這在招募前必須修

`analysis-tracking.md` 與 gate §3 的作廢框都特別警告過:

> ⚠️ **這是唯一一次 layer 3b 攔不住的世代分界** —— 它比對刺激軌跡,而軌跡確實逐位相同。
> G5 與 G6 的區分只能靠 `meta.weaponId === 'tracking_pilot_hold'` 與 `meta.protocolGuard`。

而 **compatibility key 本應是那道機器可讀的防線**:NFR-54-7 把 `protocolVersion` 列為 8 軸之一,
目的正是「不同協定收的 run 不進同一個 cohort」。字串停在 v1 ⇒

1. **G5 與 G6 的 run 產生逐位相同的 compatibility key**,`checkTrackingCompatibility()` 判它們可合併。
   兩批唯一的差異(受測者要做的事)在 key 上完全不可見。
2. **evidence 戳記說謊**:v2 協定下收的資料被標成 v1 產出。
3. gate §7「必須標註哪批資料以哪一版判準判定」只能靠文件旁證,**資料本身無法自證**。

**對 G6 乾跑判定沒有影響**:9 份都能以 `meta.weaponId === 'tracking_pilot_hold'` +
`meta.protocolGuard` 證明是 G6,且乾跑本就不計入 Gate B 證據(gate §3 第 5 點)。
**風險在招募**:12–20 人 × 9 block 的 payload 會全部蓋上已被取代的協定版本。

## 4. 為什麼可以直接修(不是研究決策)

D-54.49 **已經**由研究者拍板「新 protocol version = `tracking-pilot-v2`」。把常數改成 v2 是
**執行那個決定**,不是做新決定。反過來說,**維持 v1 才需要新決策**,因為那會與 D-54.49 矛盾。

唯一需要留意的副作用不是研究性的:升版會改變 `sessionLabel` 與 compatibility key 的字面值 ⇒
既有 payload(含 G6 乾跑)帶 v1 前綴,新 payload 帶 v2。§5 的 F-3 處理它。

## 5. 修法(已落地)

| # | 內容 |
|---|---|
| **F-1** | `TRACKING_PILOT_PROTOCOL_VERSION` → `'tracking-pilot-v2'`,並在該常數上寫明它是**唯一來源**、升版是 research-visible 行為(改 cohort key 與 sessionLabel),依 README §5 只能與新 protocol decision row 同時移動 |
| **F-2** | **消掉另外兩份來源**(根因):`TRACKING_PILOT_EVIDENCE_PROTOCOL_VERSION` 改為**引用** F-1 的常數;`TrackingPilotManifest.protocolVersion` 的型別改為 `typeof TRACKING_PILOT_PROTOCOL_VERSION`。此後不存在「只改到一份」的可能 |
| **F-3** | **seed family 偵測必須與版本無關**:`trackingGateBExtract.ts` 本來就以 `.endsWith('session-1')` 判定(非前綴比對),故既有 v1 標籤的 payload 不受影響。**補一條回歸測試把這個保證釘住**——若有人日後改成比對前綴,所有既有 family B 的 run 會被靜默重分類成 family A |
| **F-4** | 測試端:evidence 戳記維持**字面值 pin**(預註冊戳記,誤改必須紅);其餘(manifest cell 標籤、runner fixture、e2e sessionLabel)改為由常數導出——它們斷言的是**形狀**而非版本。compatibility key 與 manifest 的「版本不符」案例改用**被取代的 v1** 當輸入:語意上更準確(v1 run 不得與 v2 run 同 cohort),且不會與現值碰撞 |

### 5.1 驗證(2026-09-07)

- `npx vitest run` **222 files / 2175 tests passed**(+1:F-3 的版本無關測試)、`tsc --noEmit` ×2 exit 0。
- `npx playwright test tracking-pilot-live --project=edge` **1 passed**:真實 app 匯出的
  `meta.session.sessionLabel` 確實變成 `tracking-pilot-v2:e2e-pilot:session-0`(該斷言由常數導出,
  跑在真的 export 上)。閒置 run 判 `Blocked — insufficient-fire-hold-coverage` 為 v2 下的預期。

## 6. 遺留

- **OQ-KI25-1 — evidence 戳記是常數而非逐 payload 推導**:重新分析一批舊世代資料時,evidence 會蓋上
  現行協定版本而非該批當時的版本。這是既有性質(v1 時期對 G1–G4 一樣不準),不是本次引入;
  在「舊世代資料一律作廢」的現行紀律下不影響判定。若日後要跨世代重分析,得改為由
  `meta` 推導。**未修,入帳。**
- G6 乾跑那 9 份 payload 仍帶 v1 標籤(修法之前收的)。它們的世代身分由 `weaponId` /
  `protocolGuard` 承載,且不計入 Gate B 證據,故不重收。
