# FPS Aim Analyst

瀏覽器中執行的第一人稱 **counter-strafe(反向急停)瞄準訓練器**(Three.js
`WebGPURenderer` + TypeScript + Vite)。精準採集鍵鼠輸入與遊戲狀態,量測「急停
時機」與「首發命中」,匯出資料供研究分析。

## 需求

- **瀏覽器**:Chrome 或 Edge 桌面版(階段 A 鎖定 Chromium,需要 WebGPU 支援)
- **Node.js**:18.19+ 或 20.6+(Vite 6 最低需求)

## 快速開始

```bash
npm install
npm run dev
```

開發伺服器會在 `http://localhost:5173` 啟動,並自動注入
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` 標頭,讓
`crossOriginIsolated === true`(高精度計時所需,見 [CLAUDE.md](CLAUDE.md) §4)。

## 常用指令

| 指令 | 說明 |
|---|---|
| `npm run dev` | 啟動開發伺服器 |
| `npm run build` | 型別檢查 + 打包(`tsc --noEmit && vite build`) |
| `npm run preview` | 預覽打包後的成品 |
| `npm run typecheck` | 只跑 TypeScript 型別檢查 |
| `npm test` | 跑 Vitest 單元/整合測試 |
| `npm run test:e2e` | 跑 Playwright e2e 測試 |
| `npm run test:ci` | 型別檢查 + Vitest + Playwright 全套 |

## 文件

完整文件從 [docs/MAP.md](docs/MAP.md) 開始導覽,包含需求規格、ADR、執行計畫
(WP 狀態 / 里程碑)、決策帳本、已知問題等。專案術語與領域詞彙見
[CONTEXT.md](CONTEXT.md)。

`research/` 目錄是獨立的 Python 分析側(離線指標驗證與研究方法),與 `src/`
單向隔離,不影響瀏覽器端執行(細節見 [CLAUDE.md](CLAUDE.md) 決策 C-D1)。
