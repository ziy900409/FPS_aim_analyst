# WP-70 T6 — 決策落帳與文件

## Objective

把本 WP 改動的**判準**寫進權威帳本，並讓操作員文件與實際行為一致。
⚠️ KI-040 §5 的教訓：T6 若漏掉 `operator-manual.md`，等於這個修法對現場操作員不存在。

## Steps

1. **`GD-47` 落帳**（編號依 T0 重查結果）：
   - 判準：`meta.suspect` 的效力單位是 **run**，不是 session；
   - 依據：使用者 2026-09-15 逐字拍板「session 斷掉沒關係，只要同一個 drill 沒有中斷即可」；
   - 與 WP-69／GD-46 的關係：fullscreen 與 Pointer Lock 的效力語意**自此對稱**；
   - **明帳方向性**：本判準對跨 run **放寬**、對 protocol 路徑（T2）**收緊**，兩個方向都要寫。
2. **GD-10 澄清註記**：依 README §0.2，GD-10 條文並未規定「fullscreen 退出 ⇒ session 級 sticky」
   （那是 WP-20 T2 的實作延伸），故預設**補澄清而非修訂**。
   ⚠️ 若 T0 複核判定這仍構成實質修改 ⇒ 改為修訂 GD-10 並在 `GD-47` 註明偏離，不得靜默擇一。
3. **`BD-040` 落帳**（編號重查）於 [BUGFIX-DECISIONS.md](../../../../known_issue/BUGFIX-DECISIONS.md)：
   選了哪個修法、為何、偏離 KI-040 §6.2 初估之處
   （⭐ 初估「`experimentSession` 改 per-run 計算」被 WP-65 T5 先例取代為「照抄既有 pattern」）。
4. **KI-040 狀態翻 ✅**：更新該檔狀態列與 BUGFIX-DECISIONS §1 索引列；
   `OQ-KI-040-3`（e2e 盲區）依 T5 結果關閉或轉為具名遺留。
5. **operator-manual.md**：更新 §4.4 與 §8.3 —— WP-69 T-exit 才剛把 Esc 語意補進去，本 WP 改了
   失效範圍與恢復路徑，這兩處**必須同步**，否則又回到 KI-040 §5 的狀態。
6. **`CONTEXT.md`**：若 T3 的新術語尚未入檔則補齊（命名前對齊，CLAUDE.md §2）。
7. **`docs/operational/schema.md`**：`meta.validity.fullscreenExited` 欄位語意 + 與
   `pointerLockLost`／`pauseOccurred` 的構念區分（三者常同時為真但判準不同）。
8. **`docs/operational/pause-invalid-restart.md`**：恢復條件入口與 WP-69 三態的關係
   （恢復 ⇒ restart 本項 ⇒ 新 attempt；不是接續）。
9. 清理 T3 交付的「舊 session 級措辭殘留點」清單。
10. `npm run graph:update`（⚠️ 依 CLAUDE.md：**不得**跑裸 `graphify update .`）。

## Definition of Done

- [ ] `GD-47` 已落帳且**落帳前重查過編號**（證據寫在 `progress.md`）
- [ ] GD-10 的處置（澄清 or 修訂）已執行，且**選擇理由**寫在 `GD-47`
- [ ] `BD-040` 已落帳，含「偏離 KI-040 §6.2 初估」的具名說明
- [ ] KI-040 狀態列 + BUGFIX-DECISIONS 索引列一致翻新
- [ ] `operator-manual.md` §4.4／§8.3 已同步，且**實際 UI 字串逐字核對過**（非憑記憶）
- [ ] `schema.md` 有 `fullscreenExited` 條目並說明與另兩個構念的差異
- [ ] 全 repo 搜尋「本 session 資料標記為 suspect」等舊措辭，命中數為 **0**（或逐條有保留理由）
- [ ] `npm run graph:update` exit 0

## Commit

```text
docs(wp-70): record run-scoped validity decisions
```
