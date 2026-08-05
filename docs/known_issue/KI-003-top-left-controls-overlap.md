# KI-003 — 左上角 session/protocol 啟動按鈕與 SettingsPanel 重疊

> 類型：UI overlay bugfix 紀錄。
> 狀態：**✅ 已修**（2026-08-05）。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) BD-003。

## 1. 症狀

Pointer Lock 解鎖時，左上角的「實驗 session」、「解析度 protocol」與「BR protocol」按鈕覆蓋
SettingsPanel 的 Sensitivity、FOV 與 Resolution 控制項。按鈕位於面板上層，因此文字與輸入元件雖仍
存在，部分區域會被遮蔽或攔截點擊。

## 2. 根因

兩組 overlay 都直接掛在 `document.body`，並各自使用相同的 viewport 固定定位區域：

- `#settings-panel`：`position:fixed; top:16px; left:16px; z-index:11`。
- 三個啟動按鈕：`left:12px`，分別使用 `top:12px / 54px / 96px`，且 `z-index:40`。
- Pointer Lock 解鎖時兩組 UI 會同時顯示，所以重疊是確定性的版面衝突，不是特定解析度或
  `ResolutionMode` 計算造成。

## 3. 修復決策

採用單一 `#top-left-controls` 流式版面容器：

```text
#top-left-controls（唯一 viewport fixed 定位）
├── #session-launch-controls（實驗 / 解析度 / BR 啟動按鈕）
└── #settings-panel（Sensitivity / FOV / Resolution）
```

- 外層容器唯一負責 `top/left` 固定定位，子項改走 column flex 正常排版。
- 啟動按鈕群組保留原本較高的 overlay 層級；SettingsPanel 保留自身層級語意。
- Pointer Lock 改為一次顯示或隱藏整個 `#top-left-controls`，避免個別元件狀態漂移。
- `createSettingsPanel` 新增 optional `parent` 掛載點；未提供時仍掛到 `document.body` 並維持原本
  固定定位，避免破壞其他呼叫方式。

未採用只調高 `top` 或把面板向右移的做法，因硬編碼位移仍會受文字長度、瀏覽器縮放及未來新增
控制項影響。

## 4. 修改紀錄

| 檔案 | 修改 |
|---|---|
| `src/main.ts` | 建立共用左上角容器與啟動按鈕群組；移除三顆按鈕各自的 fixed/top/left；統一 Pointer Lock 可見性。 |
| `src/ui/SettingsPanel.ts` | `SettingsPanelOptions` 新增 optional `parent`；嵌入容器時使用相對定位，未傳入時維持既有獨立 overlay 行為。 |
| `tests/e2e/overlay-layering.spec.ts` | 新增真實瀏覽器 bounding-box 回歸，斷言三顆啟動按鈕皆不與 `#settings-panel` 相交。 |

## 5. TDD 與驗證證據

1. **RED**：先加入 bounding-box E2E；舊版回傳三個相交按鈕：
   `['實驗 session', '解析度 protocol', 'BR protocol']`。
2. **GREEN**：共用容器落地後，同一測試回傳空陣列並通過。
3. `npm run typecheck`：通過。
4. `npm test`：82 files / 641 tests 全綠。
5. `npx playwright test tests/e2e/overlay-layering.spec.ts --project=edge`：2 tests 全綠。
6. `npm run test:e2e`：19 tests 全綠。

## 6. 影響範圍

修正只涉及 DOM overlay 的掛載、排版與可見性。未修改解析度套用、ProtocolRunner、輸入、sim tick、
recorder 或匯出資料語意。
