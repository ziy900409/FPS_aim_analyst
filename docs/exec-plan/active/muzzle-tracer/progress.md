# WP-27 — Progress Log

> Running log,最新在上。每勾一個 checklist box 記錄指令輸出/檔案路徑作為證據。
> Companion:[README.md](README.md) · [task-checklist.md](task-checklist.md)

---

## Status: ⬜ 已採納待開工(2026-08-03 採納,GD-18)

| Task | 狀態 |
|---|---|
| T0 entry gate | ⬜ |
| T1 hip muzzle tracer | ⬜ |
| T2 ADS muzzle | ⬜ |
| T-exit | ⬜ |

---

## Open Questions ledger

| ID | 狀態 | 決議 |
|----|------|------|
| OQ-MT-1 offset config 落點 | ✅ 採納時決議(GD-18) | `src/render/muzzleOffset.ts`,與 `WeaponConfig` 解耦(保 weapon config = 命中/彈道語意純淨)。`SimLoop` 的 import 為 render-only 常數的刻意單向引用,檔頭註記可稽核。per-weapon 槍口偏移待「第二把幾何差異顯著的武器」觸發再晉升 `WeaponConfig`。 |
| OQ-MT-2 **ADS 槍口相對準心的下方偏移量** | 🔴 **未解(唯一待決)** | Owner:研究者/使用者。Deadline:**T2 前**。方法:實機影格量測槍口在畫面中的像素位置 → 依當時 FOV 與解析度換算視角度 → 反推 world 偏移。未回填前 T2 可用佔位值 `{rightU 0, upU −0.08, forwardU 0.60}` 接線並使自動測試綠,但 T2 DoD ⑥ 需回填後才可勾。 |
| OQ-MT-3 capture-at-fire vs 顯示時重算 | ✅ 採納時決議(GD-18) | **capture-at-fire**。F-3 使其零額外成本:muzzle 由既有 `ballisticQ` 於開火 tick 算出,hitscan 直寫 ring、projectile 寫 `arena.m*`,顯示端不重算 → 開火後轉視角 tracer 不游移。 |
| OQ-MT-4 hip 偏移方向/量值 | ✅ 採納時決議(GD-18) | `{rightU 0.15, upU −0.12, forwardU 0.60}`(右 ≈14°、下 ≈11°)。**前向必須 ≫ 側向**——初版草稿的 `[0.18, −0.12, 0.10]` 會使 muzzle 落在光軸外 ≈63°(畫面外)。實機可微調,不改介面。 |
| OQ-MT-5 WP 編號與採納 | ✅ 採納時決議(GD-18) | **WP-27**,單 WP 資料夾 `active/muzzle-tracer/`,**無獨立里程碑**(exit gate 即交付判定)。stage4 草稿順延重編 **WP-28+ / M14+**。 |
| OQ-MT-6 hip↔ads 平滑內插 vs 階躍 | ✅ 採納時決議(GD-18) | **階躍**。tracer origin 是 capture-at-fire 的 sim 值,平滑內插必然是 render 幀狀態,兩者互斥;且與 GD-16「ADS gain 階躍」慣例一致。 |
| OQ-MT-7 tracer 縮尾方向(origin 端固定) | 🟡 新增,待 T-exit V-4 | `TracerView` 現行以 origin 為固定端縮短([TracerView.ts:148-163](../../../../src/render/TracerView.ts#L148-L163))。origin 從眼睛(看不見)移到槍口後,此行為**第一次真正可見**,可能讀作「線往槍口縮回」而非「子彈往前飛」。先維持現狀,T-exit 視覺驗收判定;不可接受則另開 task(本 WP out of scope)。 |

---

## Log

### 2026-08-03 — 採納 + 計畫展開(GD-18)

- **採納決定**(使用者):初版草稿 → 正式 **WP-27**,四個 task 子檔展開,入 [exec-plan/README.md](../../README.md) §2 索引;
  OQ-MT-1/3/4/6 四項設計問題一次拍板(見上方 ledger),入帳 [DECISIONS.md](../../DECISIONS.md) **GD-18**。
- **規劃期讀碼核實(五項,改寫了契約與 task 拆解)**——詳見 [README.md §0](README.md):
  - **F-1**:C-0 前置 **KI-002 D1 已落地**(BD-002,2026-07-15),`br-field` 設 `eyeZ:0` → 偏移基準已正確。
    初版草稿列為阻塞相依的項目**已解**,T0 降為基線核對。
  - **F-2 ⚠️ 最重要**:`arena.ox/oy/oz` 是**雙重角色**——既是 projectile tracer origin([SimLoop.ts:324](../../../../src/loop/SimLoop.ts#L324)/[:353](../../../../src/loop/SimLoop.ts#L353)),
    **也是** `maxRangeU` 與落地判定的距離基準([:339-343](../../../../src/loop/SimLoop.ts#L339-L343))。
    初版草稿「三個 `pushShotRay` 點都改用 muzzleOrigin」會**改變子彈存活長度與命中數** → 違反 C-1。
    修正:新增 `BulletArena.mx/my/mz` 三欄僅供 tracer 消費(契約 **C-1b**)。
  - **F-3**:初版 C-4 的 `camera.getWorldQuaternion()` 會讓 sim 讀 render 幀狀態(camera 朝向由
    `CameraController` 每幀寫入,含內插 punch)→ **破壞跨 FPS 決定性**。既有 `ballisticRaycast` 刻意
    只用 `state.aim + rawPunch×2` 合成 `ballisticQ`([:127-133](../../../../src/loop/SimLoop.ts#L127-L133))。
    修正:muzzle 旋轉複用同一 `ballisticQ`——零額外計算、與彈道方向同源、capture-at-fire 天然成立。
  - **F-4**:初版 hip 初值 `[0.18, −0.12, 0.10]` 前向分量最小 → muzzle 落在光軸外 ≈63°(畫面外);
    且「前 = +z」與 THREE(前 = **−Z**)相反。修正見 OQ-MT-4 + 契約 **C-6**(符號慣例明文釘死)。
  - **F-5**:[SimLoop.test.ts:432](../../../../src/loop/SimLoop.test.ts#L432) 硬斷言 tracer origin `== [0,1.5,5]`
    → T1 **唯一允許修改**的既有斷言(預期變更,須改為顯式期望值而非放寬)。
    [projectile-determinism.test.ts](../../../../tests/regression/projectile-determinism.test.ts) 的 `tracers` 是
    run-vs-run 跨 FPS 比較、**非**存檔 golden → 應零修改全綠,直接充當 C-4 決定性證據。
- **範圍確認**:`TracerView` / `Controls` / `src/data/` / `src/metrics/` **零改動**;不新增匯出欄位(FR-MT5)。
- **帶著走的決定**:本 WP 的唯一嚴重風險是「muzzle 誤入命中權威」,且 F-2 讓它比初版估計更易誤觸
  (`arena.o*` 看起來像純 tracer 欄位)。緩解沿用 BD-002 已驗證的手法——**新增專屬回歸檔封測試盲區**
  (`tests/regression/muzzle-tracer-invariants.test.ts`),而非只靠既有測試。
- **Surprises**:初版草稿的三項技術假設(相依未解 / 三點同源 / camera quat 取旋轉)皆與實況不符,
  但三項都在讀碼階段被攔下、未進入實作。這佐證「entry-gate 讀碼證據」的價值 —— T0 保留此步驟。
