# WP-NN — `<scene-id>`:<一句話目標>

> 來源分析報告:[`docs/scene-specs/<scene-id>-analysis.md`](../../../../scene-specs/<scene-id>-analysis.md)
> Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **目標** | `<場景要服務哪個 drill、提供什麼交戰拓撲>` |
| **里程碑** | `<Mn 或 —>` |
| **相依** | `<上游 WP + 其 exit-gate 狀態>` |
| **對應 FR** | `<FR-xx>` |
| **估時** | `<n–m dev-days>` |
| **狀態** | ⬜ |

## 1. 範圍

**In scope**
- `src/scene/scenes/<scene-id>.props.json`(權威 prop 清單)
- `scripts/gen-<scene-id>-gltf.mjs` + `public/assets/scenes/<scene-id>/`
- `src/scene/scenes/<scene-id>.ts` + `.test.ts`
- registry 掛線:`main.ts availableScenes` · `ResultPresentation.KNOWN_SCENES` · replay 解析
- `ATTRIBUTIONS.md` 逐項 + 重生指令
- clearance / occlusion 對抗性 fixture

**Out of scope**
- `<明列;例:新 drill 本體、新指標、既有場景改版>`

## 2. 關鍵契約

- **`props.json` 為唯一權威**:gltf 由 script 生成、`propBounds` 由同檔 map;兩邊不得各寫一份。
- **GD-6**:場景資料只給 render + validation 層;`src/sim` / `SharedState` / `HitDetector` / `TargetManager` 不得引用。
- **GD-9**:原創程序化幾何,CC0;`ATTRIBUTIONS.md` 逐項可稽核。
- **決定性**:同輸入序列跨場景 sim 狀態逐位一致。
- **`eyeZ`**:`<0 / 省略>`,理由 `<KI-024:radial-spawn 前向目標需 eyeZ:0>`。

## 3. Failure modes

| 觸發 | 影響 | 處理 |
|---|---|---|
| prop 壓到目標包絡 | drill 被淨空驗證拒載 | T3 對抗性 fixture(恰相交/恰不相交);違規訊息指名 prop id |
| `roomSize` 寫成 `[寬,高,深]` | camera z 錯位,交戰距離失真 | T2 單測斷言 `resolveEyeWorldBase` 回傳值 |
| gltf 與 `propBounds` 漂移 | 看得到的牆擋不住 / 擋得住的牆看不到 | gltf 一律由 gen script 生成,禁手改 |
| 場景資產壓垮 render | 顯示鏈延遲汙染量測 | T5 記 draw call / 三角形數 + 無掉 tick |
| 忘記 registry 三處其一 | 結果頁或 replay 掉回 fallback 場景 | T4 DoD 三處逐一列證據 |

## 4. Task 索引

| Task | 檔案 | Objective | 相依 | Risk |
|---|---|---|---|---|
| **T0** | [T0-entry-gate.md](T0-entry-gate.md) | 上游 gate + 授權判定 + OQ 收斂 | — | Low |
| **T1** | [T1-props-and-asset.md](T1-props-and-asset.md) | `props.json` + gen script + gltf + ATTRIBUTIONS | T0 | Med |
| **T2** | [T2-scene-config.md](T2-scene-config.md) | `SceneConfig` + `validateScene` + 場景單測 | T1 | Low |
| **T3** | [T3-clearance.md](T3-clearance.md) | 淨空/遮蔽 + 對抗性 fixture | T2 | **High** |
| **T4** | [T4-registry-and-meta.md](T4-registry-and-meta.md) | registry 三處 + `meta.scene` round-trip | T2 | Med |
| **T5** | [T5-determinism-and-load.md](T5-determinism-and-load.md) | 跨場景逐位一致 + 負載基準 | T3, T4 | Med |
| **T-exit** | [T-exit-gate.md](T-exit-gate.md) | 四項證據宣告 | T1–T5 | — |
