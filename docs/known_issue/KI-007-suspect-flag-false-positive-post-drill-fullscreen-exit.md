# KI-007 — `meta.suspect` 對「drill 結束後才退出全螢幕」誤判為條件失效

> 類型:研究效度 / 觀測旗標邏輯缺陷。
> 狀態:✅ **已修(F-1,2026-08-07)**。
> 決策帳本:[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-007。
> 發現於:[KI-005-A / A2-T1](KI-005-A/A2-blocked-plan.md) 新採樣驗證(09:18/09:24 兩份匯出 `meta.suspect === true`)。

---

## 1. 症狀

2026-08-07 A2-T1 新採樣的三份 `counterstrafe_ad_v1` 匯出中,09:18 與 09:24 兩份 `meta.suspect === true`,09:37 為 `false`。研究者確認:三次錄製過程中皆**未**中途退出全螢幕,只在**整個測試結束後**才退出全螢幕(以取得匯出檔)。

`meta.suspect` 的設計語意(GD-10)是「條件在**記錄期間**失效,但資料仍照收」的純觀測旗標——若研究者的說法正確,`suspect === true` 是**誤判**,不是真的偵測到條件失效。

## 2. 根因

[`experimentSession`](../../src/display/experimentSession.ts) 是一個最小狀態機:

```ts
handleFullscreenChange(present: boolean): void {
  if (!active || present || suspect) return;
  suspect = true;
  options.onSuspect?.();
},
```

只要 `active === true` 期間偵測到 `document.fullscreenElement == null`,就把 `suspect` **釘死為 `true`**(無重置路徑,只能靠整頁重新載入清空閉包狀態)。

`active` 只在 `enter()` 時翻 `true`,在 `exit()` 時翻 `false`。但 [main.ts](../../src/main.ts) 呼叫 `experimentSession.exit()` 的地方只有兩處:

| 呼叫點 | 觸發條件 |
|---|---|
| [main.ts:939](../../src/main.ts#L939) | `beginNextProtocolCondition()` 判定**已無下一條件**(協定模式跑完全部 condition) |
| [main.ts:970](../../src/main.ts#L970) | `completeActiveProtocolCondition()` 判定**已無下一條件** |

兩處都只在**多條件 protocol**(解析度 protocol / BR protocol)流程下觸發。**單一「實驗 session」按鈕**([main.ts:311-314](../../src/main.ts#L311-L314),`pendingSessionMode = 'session'`)驅動的一般 drill 流程,**在任何地方都不呼叫 `exit()`**。

後果:通過資格閘一次(`enter()`)後,`active` 對整頁生命週期保持 `true`——不論是 drill 正在跑、drill 已經 `ended`、還是研究者已經看完結果畫面準備下載檔案,`active` 都不會變回 `false`。於是「drill 錄完後、研究者按照正常流程退出全螢幕去抓檔案」這個動作,和「drill 錄製中途意外掉出全螢幕」在程式碼眼中**完全無法區分**——兩者都會把 `suspect` 釘成 `true`。

09:37 之所以是 `false`,幾乎可以確定是因為那次擷取剛好在**匯出動作先於退出全螢幕**發生(或該次擷取本身是不同頁面載入,`experimentSession` 閉包狀態重新歸零)——純屬操作順序的巧合,不是三次錄製本身有任何行為差異。

**這不是資料品質問題**:`ticks`/`counter`/`key` 事件/`omegaSource`/`constructPresence` 皆不讀取 `suspect`,三份匯出的核心量測資料完整無誤。問題僅限於 `meta.suspect` 這個旗標本身對「單一實驗 session」流程失真。

## 3. 為何不是「顯而易見」的一行修法

`實驗 session` 流程刻意支援**同一次資格閘通過後連續跑多個 drill**(`restartActiveDrill()` / `onLoadDrill` 重啟,不需重新過閘,[main.ts:723-771](../../src/main.ts#L723-L771) 附近的 restart/換 drill 路徑)。若天真地在 `phase === 'ended'` 那一刻([main.ts:1027](../../src/main.ts#L1027))對所有模式都呼叫 `experimentSession.exit()`,會讓「同一次 fullscreen 坐下、連續錄好幾個 drill」這個合法用例的 `active` 在第一個 drill 結束後就永久關閉——後續 drill 若真的中途掉出全螢幕反而不會被偵測到,等於把偵測窗口開錯方向。

真正該問的問題不是「session 什麼時候該結束」,而是「**這次 fullscreen 退出,發生在 drill 正在錄製,還是 drill 已經結束、正在等下一步?**」——`suspect` 要偵測的是前者,不是後者。

## 4. 候選修法

| # | 做法 | 優點 | 缺點 / 風險 |
|---|---|---|---|
| **F-1(建議)** | `handleFullscreenChange` 的判定改為 `active && drillRunner.phase 屬於「正在錄製」的階段`(即 `'countdown'` 或 `'running'`,不含 `'idle'`/`'ended'`),而非只看 `experimentSession.active` | 精準對應 GD-10 的原始意圖(「記錄期間條件失效」);不需要在多個呼叫點手動插入 `exit()`,不影響「連續多 drill」的合法流程;`experimentSession` 本身不需改介面,只改 `main.ts` 傳入判定的組合條件 | 需要把 `DrillRunner.phase` 傳進 `handleFullscreenChange` 的呼叫點(目前是頂層 `document.addEventListener`,已可直接讀 `drillRunner.phase`,無需改介面) |
| F-2 | 在 `phase === 'ended'` 時,若目前是**非 protocol** 的 `session` 模式,呼叫 `experimentSession.exit()` | 直覺、改動小 | 需要額外追蹤「這個 drill 是哪個模式啟動的」;且如上述,會誤關掉「連續多 drill」用例的偵測窗口——除非同時在下一次 `restart`/`loadDrillById` 時重新呼叫 `enter()`,但這需要重新拿到 `GateReport`,而 restart 路徑目前沒有保留它 |
| F-3 | 不修程式碼,靠研究者「先匯出再退出全螢幕」的操作紀律規避 | 零風險零改動 | 治標不治本,且與 GD-10「純觀測、不假設操作者記得遵守紀律」的設計哲學相反;下一個研究者一樣會踩到 |

**建議採 F-1**:改動最小、語意最貼合原始 GD-10 意圖、不影響多 drill 連續錄製的既有支援。

## 4a. F-1 落地(2026-08-07)

`experimentSession.handleFullscreenChange` 新增第二參數 `recording: boolean`,由呼叫端傳入:

```ts
// experimentSession.ts
handleFullscreenChange(present: boolean, recording: boolean): void {
  if (!active || !recording || present || suspect) return;
  suspect = true;
  options.onSuspect?.();
},
```

```ts
// main.ts —— 唯一呼叫點
document.addEventListener('fullscreenchange', () => {
  const fullscreen = document.fullscreenElement != null;
  const recording = drillRunner.phase === 'countdown' || drillRunner.phase === 'running';
  experimentSession.handleFullscreenChange(fullscreen, recording);
  if (!fullscreen) markProtocolFullscreenExit?.();
});
```

**OQ-KI7-1 已拍板**:`recording` 涵蓋 `'countdown'`(暖身期退出全螢幕會延續污染接下來的 `'running'`),不含 `'idle'`/`'ended'`。`markProtocolFullscreenExit`(protocol condition 層級的獨立 suspect 機制)不受影響,原樣保留。

`experimentSession` 介面變更是本模組唯一消費端(`main.ts`)的內部改動,不影響任何匯出 schema 或既有 API 契約。

**新增測試**([experimentSession.test.ts](../../src/display/experimentSession.test.ts)):① 錄製中(`recording=true`)退出仍正確標記 `suspect`(既有五案改傳 `recording=true` 延續覆蓋);② 非錄製期間(`recording=false`)退出**不**標記(KI-007 核心回歸);③ 非錄製期間退出後,錄製恢復時若真的再退出,偵測仍然生效(證明 F-1 不是把偵測整個關掉,只是縮小視窗)。

**回歸**:`npx tsc --noEmit` exit 0;`npm run test:ci` Vitest **89 files / 741 tests**(739 + 2 新增)全綠、Playwright **21/21** 不變;`git diff --stat` 僅 `src/display/experimentSession.ts`/`.test.ts` + `src/main.ts` 三檔,未觸及 `src/sim/`、`SharedState`、匯出 schema。

## 5. 對 A2-T1/A2-T2 既有資料的影響

- **不需要重採**。三份匯出的 `ticks`/`events`/`omegaSource`/`constructPresence` 不受此 bug 影響,A2-T1 的 DoD 判定不變。
- 09:18/09:24 的 `meta.suspect === true` 應視為**已確認的誤判**(研究者已證實錄製期間未退出全螢幕),記錄於 [KI-005-A/progress.md](KI-005-A/progress.md) 供後續稽核,但不影響這兩份匯出作為 M14 效度證據的可信度。
- A2-T2 的四項複驗(凹口偵測器 / `merged_adjacent_peaks` / 未 flag 樣本數 / 守恆閘)皆只讀 `ticks`,與 `meta.suspect` 無關,可正常進行。

## 6. Open Questions

| # | 問題 | 現況 |
|---|---|---|
| ~~**OQ-KI7-1**~~ | ~~F-1 的 `phase` 判定是否也該涵蓋 `'countdown'`?~~ | ✅ **關閉(2026-08-07)**:**涵蓋**——`countdown` 掉出全螢幕大機率會延續到 `running`,且涵蓋不會產生誤判(countdown 期間退出全螢幕確實不對勁) |
| **OQ-KI7-2** | 舊有兩份真實 fixture(08:03/09:39)是否需要回溯核對 `suspect` 語意? | 🟡 **不需要**——比照 KI-006 OQ-C-5 精神,既有 committed fixture 是證據不回溯清洗;且 08:03/09:39 是 KI-004 S1 之前的舊 schema,無 `experimentSession` 相關欄位可比對 |
