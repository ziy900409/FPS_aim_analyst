# WP-71 Progress — Spider Shot Wide opening target cue

## Snapshot

| | |
|---|---|
| **Status** | 🟡 規劃完成，未開工 |
| **Current task** | T0 entry gate |
| **Next** | 重查 WP-71／GD-48、跑 baseline、關閉兩個視覺 OQ |
| **Blocked by** | 無；OQ-71.1/71.2 有明確 default，不阻塞 T0 |
| **Last updated** | 2026-09-18 |

## Progress

| Task | Status | Evidence / commit |
|---|---|---|
| T0 | ⬜ | — |
| T1 | ⬜ | — |
| T2 | ⬜ | — |
| T3 | ⬜ | — |
| T4 | ⬜ | — |
| T5 | ⬜ | — |
| T-exit | ⬜ | — |

## Planning decisions (2026-09-18)

| ID | Decision | Alternatives considered |
|---|---|---|
| **D-71.P1** | 採 render-only opening target cue；不 pre-spawn 正式 `TargetState`。 | 真 target pre-spawn 會迫使 hit/t_visible/timeout/export 全面加 activation gate，風險不成比例。 |
| **D-71.P2** | 只在 fixed countdown 顯示；armed 不顯示。 | armed exposure 時長由受試者決定，會把不受控預曝帶進刺激。 |
| **D-71.P3** | 首版只 opt-in `spider-shot-wide-v1`，mode=`countdown-anchor-v1`。 | 通用 cue DSL 是未被第二個 use case 證明的抽象。 |
| **D-71.P4** | metadata 放 `meta.targets.openingCue`，與未落地 WP-67 的 `meta.opening.protocol` 正交。 | 等 WP-67 會不必要阻塞；把兩者混成單一 protocol 會讓 arming 與視覺刺激互相綁死。 |
| **D-71.P5** | 正規名用 `opening target cue`，禁 `preAimCue`。 | Repo 已有 `preAim` 量測構念；重名會違反 C-D4。 |
| **D-71.P6** | stage16 為使用者指定落點；不假裝與 WP-70 有程式相依。 | 另開 stage17 會偏離使用者明確指定。 |

## Surprises & Discoveries

1. `spiderWideEyePos()` 已是共享 pure helper，且 scene validation 也跨模組重用；不需抽取或修改 `TargetManager`。
2. WP-67 的 `meta.opening` 執行計畫仍未落 production；本案若不留下正交契約，未來 classifier 會把 cue 有／無誤混為同一 `armed-countdown-v1`。
3. Repo 已有 `preAimDeg` 指標，故功能命名不能直譯成 `preAimCue`。

## Open Questions

| ID | Status | Owner / deadline | Default |
|---|---|---|---|
| OQ-71.1 cue 材質 | 🟡 T0 收斂 | 使用者／研究者，T0 結束 | neutral wireframe + 40% opacity，無動畫 |
| OQ-71.2 顯示窗 | 🟡 T0 收斂 | 使用者／研究者，T0 結束 | initial countdown 全程；running tick 原子隱藏 |

## Outcomes & Retrospective

待 T-exit 回填。
