# KI-028 — capture script 在 Windows 孤兒化自己的 Vite dev server，後續 e2e 靜默改測另一個 history root

> 類型：測試基礎設施 / 證據效度（**production runtime 無缺陷**，但會**靜默污染 E2E 證據的可歸因性**）。
> 狀態：🔴 **未修（已診斷，含 PID 證據）**。發現於 2026-09-07 WP-56 T-exit。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 已列索引；尚無 `BD-028`——只有診斷與修改計畫，尚未落地修復。
> 相關：[KI-011](KI-011-spider-shot-v1-clearance-rejected-in-field-low.md)（同屬「靜默 fallback 到錯的預設」一類）· `playwright.config.ts` 的 NFR-48.6 / FM-48.4 註解

## 1. 症狀

執行過 `npm run capture:wp56-visuals`（或 `:interactive`）之後，**一個 Vite dev server 會繼續留在 5173 監聽**，即使該指令已正常結束（exit 0）。

之後任何 `npm run test:e2e` 因 `playwright.config.ts` 的 `reuseExistingServer: !process.env.CI` 會**直接重用那個遺留 server**，而不是啟動 config 宣告的那一個。兩者的差別在環境變數：

| | dev server 的 `FPS_HISTORY_ROOT` |
|---|---|
| `playwright.config.ts` 宣告 | `.playwright-tmp/history-dev` |
| capture script 遺留的 server | **`.wp56-capture-tmp/history`** |

**這個偏移完全無聲**：測試照樣通過，log 裡沒有任何一行指出 server 不是自己起的、也沒有指出 history root 被換掉。可觀察的旁證是 run 結束後 `.wp56-capture-tmp/history/` 底下出現本次 run 的 fixture 目錄（`e2e-t5-*`、`stage10-a11y-*`、`ki017-early-replay-*` …）。

2026-09-07 WP-56 T-exit 的全量 Playwright 就是在這個狀態下跑完的（見 [WP-56 progress.md](../exec-plan/active/stage12/wp-56-micro-flick-test-scene/progress.md) 的「Server 環境揭露」）。

## 2. 根因

Windows 上腳本透過 `cmd.exe` wrapper 起 server，收尾只 `kill()` 那個 wrapper，**殺不到真正的 vite 程序**：

```js
// scripts/capture-wp56-visuals.mjs
const args = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npm.cmd run dev -- --host 127.0.0.1']   // ← cmd.exe wrapper
  : ['run', 'dev', '--', '--host', '127.0.0.1'];
return spawn(command, args, { cwd: root, env: { ...process.env, FPS_HISTORY_ROOT: '.wp56-capture-tmp/history' }, ... });
// ...
} finally {
  server.kill();            // ← 只殺最外層 cmd.exe；孫程序全部存活
}
```

`child.kill()` 只對 `spawn()` 直接產生的那一個 process 送訊號。Windows 上實際的程序樹有四層，`kill()` 只終結第一層：

```text
node scripts/capture-wp56-visuals.mjs
└── pid 71840  cmd.exe  /d /s /c npm.cmd run dev -- --host 127.0.0.1   ← server.kill() 殺掉這個（已 DEAD）
    └── pid 480    node  npm-cli.js run dev -- --host 127.0.0.1        ← 存活（孤兒）
        └── pid 57656  cmd.exe  /d /s /c vite --host 127.0.0.1         ← 存活
            └── pid 56748  node  vite.js --host 127.0.0.1              ← 存活，持續監聽 127.0.0.1:5173
```

上表為 2026-09-07 實測的程序祖先鏈：pid 71840 已不存在（確認被 kill），其餘三層仍在，5173 由 pid 56748 持有。

`--host 127.0.0.1` 這個旗標是辨識特徵：config 自己的 `npm run dev` 不帶它。

## 3. 後果（為什麼這不只是「一個沒關掉的 server」）

1. **繞過 NFR-48.6 / FM-48.4 的設計意圖。** `playwright.config.ts` 刻意給 dev 與 preview 兩個**不同**的 temp history root，目的是（a）永不共用真實 `data/session-history/`、（b）避免兩個 server 競爭同一個 history root lease。重用遺留 server 時（a）仍然成立（`.wp56-capture-tmp/history` 也是 temp root，**沒有研究資料安全問題**），但（b）的前提被換掉了。
2. **會把「被環境繞過」誤讀成「已修好」。** WP-56 T0（2026-09-04）記錄過 3 項 preview root-lock（HTTP 423）失敗；2026-09-07 的全量 run 這 3 項未重現。原因是兩個 server 不再競爭同一個 lease，**不是** lease 邏輯被修正。任何看到「3 項自己好了」的人都可能得出錯誤結論。
3. **E2E 證據的可歸因性受損。** 任何依賴 history root 的結果（history/replay/persistence 家族、root lease、跨 server 隔離）都是在一個**未宣告的組態**下量到的。這類數字不該直接寫進 WP 的 exit-gate 證據，除非同時揭露 server 來源。
4. **與既有的「5173 被別人佔用」危害同型、但更難察覺。** 外部 app 佔用 5173 時測試會**紅**（找不到元素）；本案佔用者是同一個 app，測試**全綠**，只有組態悄悄不同。

## 4. 修改計畫

### 4.1 必要修正：真的把 server 樹殺掉

- **Option A（最小改動）**：`finally` 內在 win32 走 tree-kill，例如 `spawnSync('taskkill', ['/T', '/F', '/PID', String(server.pid)])`，非 win32 保留 `server.kill()`。
- **Option B（消除 wrapper，推薦）**：不經 `cmd.exe`，直接 `spawn(process.execPath, [viteBinJs, '--host', '127.0.0.1'], ...)`（或 `spawn('npm.cmd', [...], { shell: false })` 並確認無中介 shell），使程序樹只有一層、`kill()` 即足夠。
- 兩者皆應加上 `process.on('SIGINT'/'exit')` 的收尾，讓**中斷**（Ctrl-C）也不會留下孤兒——目前即使 `finally` 修好，被中斷的 run 仍可能留下 server。

### 4.2 建議並行的防呆（治「靜默」而非只治「孤兒」）

- **Option C（推薦一併做）**：capture server 不要用 5173。改成獨立埠（例如 5273）並讓腳本自己組 URL；如此**即使**留下孤兒，Playwright 的 `reuseExistingServer` 也不可能誤採它。
- **Option D**：capture script 啟動前若 5173 已被佔用就 fail fast 並印出佔用者，而不是預期自己是唯一擁有者。
- **Option E**：在 `playwright.config.ts` 的 dev webServer 加一個「這是不是我們預期的 server」檢查（例如啟動後斷言 history root 或某個 dev-only 標記），讓組態偏移變成**紅燈而非靜默**。這條最能根治後果 §3.3，但改動面較大，建議獨立評估。

**不採**：把 `reuseExistingServer` 關掉（會讓開發者每次跑 e2e 都得等 server 重啟，且與既有工作流衝突）。

### 4.3 清理

`.wp56-capture-tmp/` 是 capture runner 的 untracked temp 目錄（未提交、不影響 repo）。診斷時刻意**未刪除**：當時仍有 live server 佔用，且該目錄不屬 WP-56 T-exit 切片所有。修復本 KI 時可一併考慮是否把它加進 `.gitignore` 或改用系統 temp。

## 5. 影響範圍

- 只動 `scripts/capture-wp56-visuals.mjs`（Option A/B/C/D），必要時加動 `playwright.config.ts`（Option E）。
- **production runtime、sim、輸入、recorder、匯出語意皆不涉及。**
- 修好之前：任何在剛跑過 capture script 的機器上取得的 E2E 證據，都必須先確認 5173 的擁有者才可引用。

## 6. 驗證計畫

1. **RED**：跑 `npm run capture:wp56-visuals`，結束後 `netstat -ano | grep ":5173.*LISTENING"` 仍有結果 ⇒ 重現。
2. **GREEN**：同一指令結束後 5173 無監聽；`Get-CimInstance Win32_Process` 確認 npm／cmd／vite 三層皆已終結。
3. Ctrl-C 中斷該指令後同樣不留孤兒。
4. 採 Option C 時：capture 期間 5173 從未被佔用，`npm run test:e2e` 自行啟動 server（log 可見 webServer 啟動）。
5. `npm run capture:wp56-visuals` 仍能產出 WP-56 T6 的四張截圖與 metadata（不得因修 server 生命週期而破壞 capture 功能）。

## 7. 遺留 Open Questions 與帳本索引

- **OQ-KI28-1**：是否該建立一條通則——「任何 spawn dev/preview server 的腳本都不得使用 5173／4173」？目前只有一支這樣的腳本（已確認 `scripts/` 內無其他 `spawn` dev server 者），但下一支很可能重蹈。
- **OQ-KI28-2**：T0 記錄的那 3 項 preview root-lock（HTTP 423）失敗**狀態未定**——本次未重現是因為環境繞過，因此它們既未被證明存在、也未被證明修好。需要在一次乾淨（自行啟動兩個 server）的 `npm run test:e2e` 上重新確認；若重現，另立 KI。

[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 的 Known Issues 索引已加入本 KI（狀態 🔴 修法待落地）。依該帳本的寫入慣例，`BD-028` 於修復**落地時**才寫入，並同步翻新本 doc 狀態列、帳本條目與 §1 索引列狀態。
