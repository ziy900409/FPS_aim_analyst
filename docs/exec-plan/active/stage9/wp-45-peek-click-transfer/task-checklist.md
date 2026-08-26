# WP-45 — task checklist

> 狀態符號：`[ ]` pending · `[-]` in progress · `[x]` complete。每個 task 完成後更新 [progress.md](progress.md)。

## T0 — Entry gate

- [x] 記錄 HEAD/status/CodeGraph pending/baseline tests
- [x] 覆核核心 symbols blast radius
- [x] 決議 OQ-S9-4
- [x] 記錄 WP-44/WP-43 dependency gate

## T1 — Occlusion kernel / hit gate

- [x] 共用 segment/AABB + visible fraction kernel
- [x] visibilityDerivation refactor，輸出零變更
- [x] SimLoop additive hitscan occlusion context
- [x] main/harness active scene injection
- [x] behind/exposed/no-context/parity/determinism tests

## T2 — Symmetric scene

- [x] props JSON + SceneConfig
- [x] deterministic GLTF generator + asset
- [x] hidden/onset/full exposure tests
- [x] left/right mirror + clearance tests

## T3 — Pilot drill

- [x] 等 WP-44 T-exit
- [x] 1.5°/2.0°/3.0° pilot config builder
- [x] 20-trial LR/cue/timeout/backstop contract
- [x] first miss→second hit / restart determinism tests
- [x] researcher mode 註冊 2.0° default cell

## T4 — Metrics

- [x] targetId-based transfer assembler
- [x] per-trial + aggregate metrics
- [x] flags/缺失值 policy
- [x] Practice history guard 驗證（ResultScreen UI section 有意識延後，見 progress.md D-45.13）
- [x] no-composite-score contract test

## T5 — Versioned pilot session

- [ ] 等 stage8 WP-43 T-exit
- [ ] versioned three-family roster/order
- [ ] transfer-pilot-v1 preset + 60s rest
- [ ] stage6 order golden unchanged
- [ ] session UI/E2E/export context tests

## T-exit

- [ ] `npm run test:ci` exit 0
- [ ] manual 8-item gate complete
- [ ] operational/CONTEXT/DECISIONS/stage9 docs synced
- [ ] staged file audit complete
