# DESIGN — 執行期與架構設計筆記

> 補規格書（[`規格書_Three.js_WebGPU_反向急停瞄準訓練器.md`](./規格書_Three.js_WebGPU_反向急停瞄準訓練器.md)）與 [`PLAN.md`](./PLAN.md) 沒講白的執行期細節。
> 專有名詞見 [`../CONTEXT.md`](../CONTEXT.md)。撰寫語言：繁體中文，技術術語保留英文。

---

## 1. 執行期與執行緒模型（階段 A）

### 1.1 「雙迴圈」在階段 A 是**單執行緒**

規格稱「雙迴圈」，但附錄 4.3 的 accumulator 虛擬碼裡，**sim 子步進與 render 跑在同一個 `requestAnimationFrame` callback、同一條主執行緒**：

```
function frame(now_ms) {
  acc += Math.min(now - last, 0.25);       // 夾住避免 spiral of death
  while (acc >= TICK) { simStep(TICK); acc -= TICK; }   // ← sim：同一個 callback
  render(acc / TICK);                                   // ← render：緊接著跑
  requestAnimationFrame(frame);
}
```

加上事件驅動的 `InputSampler`（一樣在主執行緒，只是事件驅動、不在固定迴圈）。所以階段 A 的真相是：

> **一條 rAF 超級迴圈（固定步長子步進）＋ 一個事件驅動採樣器**，不是兩條互相獨立、平行推進的迴圈。

三個「角色」速率不同、只透過 `SharedState` 溝通，但**共用同一條執行緒**。

### 1.2 後果 (a)：階段 A 的 sim tick **沒有**真的與 render 隔離

因為共用主執行緒，**任何主執行緒卡頓（GC、shader 編譯、長 render、其他 JS）都會延後 rAF callback**，進而：

1. `now - last` 變大 → `acc` 累積 → `while` 迴圈補跑 catch-up tick（sim 仍試圖追上真實時間）。
2. 但 `Math.min(now - last, 0.25)` 這個夾住代表：**單次停頓超過 250 ms，多出來的時間被丟棄 → sim 直接掉 tick、落後真實時間**（這是刻意防 spiral of death 的取捨，不是 bug）。

換句話說：**「物理 tick 永遠準時、與 render 無關」這個保證，階段 A 並不成立。** 它只在正常無卡頓時近似成立。

### 1.3 階段 A 的防線 vs 階段 B 的真正隔離

| 手段 | 對抗什麼 | 階段 |
|---|---|---|
| ring buffer + 物件重用（`DataRecorder` 與輸入緩衝） | GC 週期性卡頓 | A（必做） |
| WebGPU frame pacing、減少 shader 編譯卡頓（ADR-1） | render 端 micro-stutter | A |
| accumulator 固定步長 + catch-up | 幀率變動下的 movement 一致性 | A |
| **sim loop 移入 Web Worker + `SharedArrayBuffer`** | **主執行緒卡頓污染 sim 計時** | **B（真正的隔離）** |

> 結論：階段 A 把 micro-stutter 的**機率與幅度**壓到夠低以支撐 pilot 量測，但**消除主執行緒對 sim 計時的影響要等階段 B 的 Worker 化**（cross-origin isolation 已為此預先解鎖 `SharedArrayBuffer`）。量測效度的最高保障在階段 B。

### 1.4 與其他決策的關聯

- **時間戳活在哪個時鐘**：見規格 **ADR-7**（量測時鐘 `performance.now()` vs 決定性時鐘 邏輯 tick index）。後果 (a) 正是「為何 wall-clock 時間戳非決定性」的根因——tick 在 rAF frame 開頭爆發執行。
- **階段 B Worker 化的跨界面只有兩道縫**：輸入佇列（主→worker）與 `RenderSnapshot`（worker→主）；`DataRecorder` 跟著 sim 進 worker、不跨界。階段 A 先把這兩道縫畫成固定數值佈局，Worker 化才是搬家而非重寫（見 `CONTEXT.md` C 節）。
