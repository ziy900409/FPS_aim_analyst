# KI-030 — history 三個 e2e 在多 worker 下間歇性紅燈，`npm run test:e2e` 因此不是可信的門檻

> 類型：測試基礎設施 / 證據效度（**production runtime 未觀察到缺陷**，但**全量 Playwright 的通過與否不可重現**）。
> 狀態：🔴 **未修（已觀察並縮小範圍，但根因未定；失敗當下的錯誤文字未被保存 —— 見 §4）**。發現於 2026-09-08 WP-57 T-exit。
> 決策帳本：尚無 `BD-030`——只有觀察與修改計畫，尚未落地修復。
> 相關：[KI-028](KI-028-capture-script-orphans-dev-server-hijacking-e2e-history-root.md)（同屬「e2e history root 的環境不可歸因」一類）· [KI-027](KI-027-overlay-layering-researcher-submenu-guard-dead.md)（同一支全量 Playwright 裡的**確定性**失敗，兩者不要混為一談）· `playwright.config.ts` 的 NFR-48.6 / FM-48.4 註解

## 1. 症狀

同一個 HEAD（`f3bc045`）、同一台機器、同一個 session 內連跑三次全量 Playwright，結果不一致：

| # | 命令 | 結果 | 耗時 |
|---|---|---|---|
| A | `npm run test:e2e`（預設 worker 數，**本 session 首次**，含 preview 的 `npm run build`） | **87 passed / 4 failed** | 4.4 min |
| B | `npx playwright test --workers=1` | **90 passed / 1 failed** | 5.1 min |
| C | `npm run test:e2e`（預設 worker 數，第二次） | **90 passed / 1 failed** | 2.6 min |

B／C 的那 1 個失敗是 [KI-027](KI-027-overlay-layering-researcher-submenu-guard-dead.md)（確定性、已診斷）。A 多出來的 **3 個**是：

- `tests/e2e/history-library.spec.ts:196` — WP-49 T3「opens two different Assessment runs from the same drill's run list…（FM-49.8）」
- `tests/e2e/history-library.spec.ts:288` — WP-49 T5「a saved Assessment Result shows「查看此 Drill 歷史」…（FR-49.12）」
- `tests/e2e/history-persistence.spec.ts:44` — WP-48 T5「Assessment save: created then existing on retry…」

三者**單獨重跑全部通過**：`history-persistence.spec.ts --workers=1` → 3 passed；`history-library.spec.ts --workers=1` → 11 passed。

## 2. 已確認不是什麼

- **不是 production 缺陷。** 三個測試都在單獨執行與 `--workers=1` 全量執行下通過。
- **不是資料安全問題。** 真實 `data/session-history/` 的目錄數在整段 T-exit 前後皆為 **41**，無新增。
- **不是 [KI-028](KI-028-capture-script-orphans-dev-server-hijacking-e2e-history-root.md)（被孤兒 server 挾持）。** 本次執行前已確認 5173／4173 皆無監聽程序，兩個 server 都由 Playwright 自己起、各自帶 `playwright.config.ts` 宣告的 temp root。
- **不是本次程式碼變更引入。** WP-57 T5 只新增一個**零 importer** 的離線模組（`vite build` 產物不含它），且沒有新增或修改任何 e2e spec。

## 3. 目前的假設（未證實）

三個受影響的測試都對**同一個 dev server 的同一個 history temp root**（`.playwright-tmp/history-dev`）做寫入與列舉。預設 worker 數下多個 browser context 並行，於是有兩條路徑可能出問題：

1. **跨 worker 的 fixture 干擾** —— 兩個 worker 同時 seed／列舉 participant 目錄，其中一個看到另一個的中間狀態。
2. **冷啟動時序** —— run A 是本 session 首次執行，preview server 要先跑完 `npm run build`（A 耗時 4.4 min vs C 的 2.6 min）。第一批平行 worker 可能在 server 尚未穩定時就開始寫入。

假設 1 與 2 並不互斥。WP-56 T0（2026-09-04）記錄過**三個** preview root-lock（HTTP 423）失敗，數量與位置都相近；WP-56 T-exit 明言那三個是「被環境繞過、不是被修好」。本條目可能與那次是同一個病理，但**沒有證據可以斷言**。

## 4. ⚠️ 缺口：失敗當下的錯誤文字未保存

run A 的 `test-results/**/error-context.md` 在後續的隔離重跑中被覆寫，因此**沒有留下 3 個失敗的實際錯誤訊息**（是 HTTP 423？是斷言不符？是 timeout？）。這直接決定上面兩個假設哪一個成立，缺了它就無法定案。

**下一次重現時的第一件事**：在跑任何其他指令之前，先把 `test-results/` 整個複製出來。建議用
`npx playwright test --workers=<預設> --reporter=list,html` 並保留 `playwright-report/`。

## 5. 為什麼要記這一條

WP-56 T-exit 已經留下一個教訓：**一個「通過」的 gate 可能根本沒在量它宣稱的東西**。這裡是它的孿生形態 —— 一個**不可重現**的 gate。`npm run test:e2e` 現在有兩種可能的輸出（87/4 與 90/1），後續 WP 若只跑一次就把結果寫進 progress，等於在證據裡擲骰子：真正的回歸會被當成「又是那三個 flake」而放行。

## 6. 修改計畫（未執行）

1. **先取得證據**（§4）。在拿到錯誤文字之前不要改任何測試 —— 依 WP-56 T-exit 的教訓，「同時被改動」不等於因果。
2. 依根因二選一：
   - 若是跨 worker 干擾 → 讓 history 相關 spec 使用**每個 worker 自己的 history root**（`FPS_HISTORY_ROOT` 帶 worker index），或把它們標成同一個 serial group。
   - 若是冷啟動時序 → 在 `playwright.config.ts` 的 dev webServer 加上一個真正檢查 history API 就緒的 `url`／健康檢查，而不是只等首頁回應。
3. 修好之後，**連跑三次全量 Playwright 且結果一致**才算關閉；只跑一次綠燈不足以關閉一個 flake。

## 7. 範圍

不屬 WP-57。WP-57 T-exit 依 scope 紀律不在該切片內修，只如實記錄三次執行的完整結果，並以 `--workers=1` 的 **90 passed / 1 failed** 作為可重現的門檻讀數。
