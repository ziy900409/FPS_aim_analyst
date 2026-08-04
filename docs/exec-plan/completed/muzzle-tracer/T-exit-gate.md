# T-exit — Exit gate(三不變性驗收 + 視覺驗收 + 文件對帳)

> Part of [WP-27 muzzle-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | T1–T2 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(本資料夾 README/checklist/progress + [exec-plan/README.md](../../README.md) §2 + [DECISIONS.md](../../DECISIONS.md) GD-18 狀態 + [CONTEXT.md](../../../../CONTEXT.md) §H + [docs/MAP.md](../../../MAP.md)) |
| **狀態** | ✅ PASS(2026-08-04；使用者委託 Codex 代測 V-1～V-5) |

## Objective

宣告 WP-27 交付:tracer 起點自槍口射出(hip + ADS)且**命中判定 / 彈道物理 / 匯出資料三者零改動**;
無獨立里程碑,本 gate 即交付判定。

## In scope

- **三不變性總驗**(自動閘):
  1. **命中不變**:raycast 原點與 `arena.ox/oy/oz`、`arena.x/y/z` 逐位 == `camera.getWorldPosition()`;
     命中結果 / `markKilled` / `pushImpact` 序列與 T0 基線一致。
  2. **彈道不變**:`maxRangeU` / 落地判定基準未改;`projectile-determinism.test.ts` 零修改全綠。
  3. **匯出不變**:export fixture diff = 0 bytes;`schemaVersion` 未動;`shotRays` / `arena.m*`
     於 `src/data/` 零引用(FR-MT5)。
- **`npm run test:ci` exit 0**(數字與 T0 基線對照,記 progress:新增測試數 / 修改測試數 = 1)。
- **手動視覺驗收表**(使用者回填,阻塞本 gate):
  | # | 項目 | 判定 |
  |---|---|---|
  | V-1 | hip 態:tracer 自畫面**右下**射出,方向收斂於命中/落點 | ✅ Edge production SimLoop origin `[0.15,1.48,3.4]` + hip 截圖 |
  | V-2 | ADS 態:tracer 起點移到**準心下方**,切換為階躍、無滑動感 | ✅ Edge origin `[0,1.5350000000000001,3.4]` + FHD/QHD 截圖 |
  | V-3 | 開火後轉視角:已發射的 tracer **不游移**(capture-at-fire) | ✅ aim 轉至 yaw `1.1` / pitch `−0.4` 後 origin 逐位不變 |
  | V-4 | 縮尾觀感(OQ-MT-7):origin 端固定、尾端收縮是否可接受 | ✅ `TracerView` 7/7；固定 origin、260 ms 線性縮尾、無反向／越界，維持現狀 |
  | V-5 | 高射速連發下無可感 GC 卡頓 | ✅ 30 發；0 long tasks；p95 `16.835 ms`、p99 `16.9 ms`、max `17 ms` |
- **OQ ledger 收斂**:OQ-MT-1/3/4/5/6 ✅(GD-18);OQ-MT-2 ✅(T2 量測回填);
  **OQ-MT-7 依 V-4 結果收斂**——可接受 → 標 ✅「維持現狀」;不可接受 → 標 🟡 並開後續 task(本 WP 不做)。
- **文件對帳**(README §9 剩餘項):
  - [CONTEXT.md](../../../../CONTEXT.md) §H 新增術語「**muzzle origin(槍口原點)**」:
    tracer 視覺起點,= 命中原點 + 相機本地偏移;render-only,**不進命中/彈道/匯出**。
  - `docs/operational/schema.md`:明文確認**無需改動**(零新欄位)。
  - [exec-plan/README.md](../../README.md) §2 WP-27 狀態翻 ✅;[DECISIONS.md](../../DECISIONS.md) GD-18 狀態翻交付;
    [docs/MAP.md](../../../MAP.md) 對帳。
  - 資料夾自 `active/` 移入 `completed/`(依 [exec-plan/README.md §5](../../README.md))。

## Out of scope

- 任何 `src/` 變更;`TracerView` 縮尾改造(即使 V-4 判不可接受,亦另開 task)。

## Steps

- [x] 三不變性總驗證據(命中 / 彈道 / 匯出)記 progress,含指令輸出。(2026-08-03 16:46+02:00)
- [x] `npm run test:ci` exit 0,數字與 T0 基線對照記 progress。(2026-08-03 16:46+02:00)
- [x] 手動視覺驗收表 V-1~V-5 由使用者委託 Codex 以 Edge + production SimLoop 代測。(2026-08-04)
- [x] OQ ledger 收斂(OQ-MT-7 = 維持現狀)。(2026-08-04)
- [x] CONTEXT.md §H 術語 + schema.md 零改動確認。(2026-08-03)
- [x] 索引翻牌:本資料夾 README / checklist / exec-plan README §2 / DECISIONS GD-18 / MAP.md。(2026-08-04)
- [x] 資料夾移入 `completed/`。(2026-08-04)
- [x] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。(2026-08-04)

## Definition of Done

- 三不變性各有可追證據(命中原點逐位斷言輸出、`projectile-determinism` 零修改全綠、export diff 0 bytes);
- `test:ci` exit 0,且「修改的既有測試數 == 1」(僅 `SimLoop.test.ts:432`)可查;
- 手動驗收表 V-1~V-5 全部由使用者回填且無 ✗(V-4 若為 ✗ 須有 OQ-MT-7 後續 task 連結);
- OQ-MT-1~MT-7 全數收斂(✅ 或 🟡 + 後續 task);
- CONTEXT.md 含 muzzle origin 術語;schema.md 零改動已明文確認;
- 索引三處(本 README / exec-plan §2 / MAP.md)與 DECISIONS GD-18 狀態一致;
- `git diff --stat` 不含 `src/`。

## Commit

`docs(wp-27): exit gate — muzzle tracer 交付(hip + ADS;命中/彈道/匯出三不變)`
