# T3 — scope overlay + ads 記錄(tick flag + 事件;schema 對帳)

> Part of [WP-24 ads-optics](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T2(zoom 鏈可用) |
| **Risk / Cplx** | Med / Med(記錄缺失 = 分析效度破口) |
| **Touches** | ADD `src/ui/`(scope overlay DOM);MODIFY `src/data/DataRecorder.ts`(tick `ads` flag + `ads` 事件)、`src/data/export.ts` + `metadata.ts`(`meta.weapon.ads` 快照)、`docs/operational/schema.md`(對帳)+ 測試 |
| **狀態** | ✅ |

## Objective

ADS 的視覺與資料面收斂(FR-E6):scope overlay(純 TS + DOM,D1)+
**逐 tick `ads` flag 與 ads down/up 事件進匯出**(v2 additive)——
分析端可完整還原「哪些 tick 在鏡內、何時開/關鏡」。

## In scope

- **scope overlay**:DOM 遮罩(圓形鏡框 + 周邊暗化;純 CSS/DOM,不進 three 場景);
  隨 `heldAds` 顯隱(與 FOV 內插同步淡入,OQ-24.1);**DOM 準心維持精確置中**
  (`devicePixelRatio` 既有紀律);開關不影響 pointer lock。
- **記錄(效度必要條件)**:
  - tick row 增 `ads`(boolean,取 simStep 當 tick 分桶消費後的 `heldAds`);
  - events 增 `{ type:'ads', down, t }`(v2 additive;CSV events 加欄);
  - `meta.weapon` 快照含 `ads`(fovDeg/sensitivityRatio)與武器 id
    (分析端重建 gain 的充分資訊);
  - `schema.md` 對帳(JSON/CSV 欄位 + 範例 + 語意)。
- round-trip 測試:合成 ads 事件序 → 錄 → 匯 → 斷言事件↔flag 窗口一致
  (down 後首 tick flag=true、up 後首 tick false;同 tick down+up 語意)。
- 決定性:ads fixture(含 ads 事件的輸入序列)跨 render FPS sim 狀態 + 記錄逐位一致;
  既有 baseline 零重錄。
- E2E smoke:含開鏡的 drill 一輪 → 匯出含 ads 欄位。

## Out of scope

- 倍率 UI、鏡內視覺特效(眩光/黑邊動畫)、結果頁 ads 分組統計(分析端離線)。

## Steps

- [x] overlay DOM + 顯隱佈線 + 準心置中回歸(手動 + 既有測試)。
- [x] DataRecorder tick flag + 事件 + meta 快照(additive)。
- [x] round-trip 一致性測試 + 決定性 ads fixture。
- [x] schema.md 對帳 + export 測試(JSON finite check/CSV 欄)。
- [x] E2E smoke(Playwright)。
- [x] `npm run test:ci` exit 0。

## Definition of Done

- 匯出含 tick `ads`/events `ads`/`meta.weapon.ads`(round-trip 綠);
  決定性(新 fixture 綠 + baseline 零重錄);overlay 手動證據 + 準心置中回歸綠;
  schema.md 已對帳;`test:ci` exit 0。

## Commit

`feat(wp-24): T3 scope overlay + ads 記錄(tick flag/事件/meta;v2 additive)`
