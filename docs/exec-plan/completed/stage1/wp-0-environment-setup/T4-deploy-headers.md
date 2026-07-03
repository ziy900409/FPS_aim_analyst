# T4 — Deploy headers（host-agnostic）

> Part of [WP-0 exec-plan](README.md). 同伴：[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **Depends on** | T2 |
| **Risk / Complexity** | Low / Low |
| **Touches** | NEW `public/_headers`；NEW `docs/operational/deploy-headers.md`；MODIFY `package.json`（build/preview script 確認） |
| **Status** | ✅ PASS（deploy 待 D3） |

## Objective

讓**線上靜態主機**也能 `crossOriginIsolated === true`：產出 host-agnostic 標頭設定與文件，使 D3 拍板任何主機後都能即時套用（FR-0.4）。實際 deploy 因 D3 後定而為**條件性步驟**。

## In scope
- `public/_headers`（Netlify / Cloudflare Pages 相容語法）。
- `docs/operational/deploy-headers.md`：列 Netlify / CF Pages / nginx / Express 各自設 COOP/COEP 的方式。
- 確認 `vite build` 把 `public/_headers` 原樣複製到 `dist/`。

## Out of scope
- 綁定特定廠商或實際上線（D3 後定）。
- dev/preview 標頭（已在 T2 完成）。

## Design notes

- `_headers` 語法（Netlify/CF Pages 通用）：
  ```
  /*
    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: require-corp
  ```
- nginx 片段（文件用）：
  ```nginx
  add_header Cross-Origin-Opener-Policy same-origin always;
  add_header Cross-Origin-Embedder-Policy require-corp always;
  ```
- **COEP 副作用**：`require-corp` 下，所有跨源資源需帶 CORP/CORS 標頭才載得進來。階段 A 資源全部 same-origin（無外部 CDN），故無礙；文件需註明此限制，避免日後加外部資源踩雷。

## Steps

- [x] 建 `public/_headers`（上方語法）。
- [x] `npm run build`，確認 `dist/_headers` 存在且內容正確。
- [x] 寫 `docs/operational/deploy-headers.md`：四種 host 設標頭方式 + COEP 跨源限制註記 + 上線後驗證步驟（開 console 跑 `crossOriginIsolated`）。
- [ ] （條件性，D3 拍板後）deploy 到選定 host，線上頁面 console 驗證 `crossOriginIsolated === true`，URL 記入 progress.md。

## Definition of Done

- [x] `public/_headers` committed 且 `vite build` 複製到 `dist/`。
- [x] `docs/operational/deploy-headers.md` 涵蓋 ≥ 3 種 host + COEP 限制說明。
- [ ] （若已 deploy）線上 URL `crossOriginIsolated === true`；否則 progress.md 標記「deploy 待 D3」。

## Commit

`feat(wp-0): host-agnostic COOP/COEP deploy headers + 文件（FR-0.4）`
