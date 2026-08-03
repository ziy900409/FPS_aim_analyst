# T-exit — Exit gate(三不變性驗收 + 視覺驗收 + 文件對帳)

> Part of [WP-27 muzzle-tracer](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)
> **Docs-only。NO production code。**

| | |
|---|---|
| **相依** | T1–T2 |
| **Risk / Cplx** | — / Low |
| **Touches** | docs(本資料夾 README/checklist/progress + [exec-plan/README.md](../../README.md) §2 + [DECISIONS.md](../../DECISIONS.md) GD-18 狀態 + [CONTEXT.md](../../../../CONTEXT.md) §H + [docs/MAP.md](../../../MAP.md)) |
| **狀態** | ⬜ 未開始 |

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
  | V-1 | hip 態:tracer 自畫面**右下**射出,方向收斂於命中/落點 | ⬜ |
  | V-2 | ADS 態:tracer 起點移到**準心下方**,切換為階躍、無滑動感 | ⬜ |
  | V-3 | 開火後轉視角:已發射的 tracer **不游移**(capture-at-fire) | ⬜ |
  | V-4 | 縮尾觀感(OQ-MT-7):origin 端固定、尾端收縮是否可接受 | ⬜ |
  | V-5 | 高射速連發下無可感 GC 卡頓 | ⬜ |
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

- [ ] 三不變性總驗證據(命中 / 彈道 / 匯出)記 progress,含指令輸出。
- [ ] `npm run test:ci` exit 0,數字與 T0 基線對照記 progress。
- [ ] 手動視覺驗收表 V-1~V-5 由使用者實機回填。
- [ ] OQ ledger 收斂(含 OQ-MT-7 依 V-4 判定)。
- [ ] CONTEXT.md §H 術語 + schema.md 零改動確認。
- [ ] 索引翻牌:本資料夾 README / checklist / exec-plan README §2 / DECISIONS GD-18 / MAP.md。
- [ ] 資料夾移入 `completed/`。
- [ ] progress.md 寫 Outcomes(交付了什麼 / Surprises / 帶著走的決定)。

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
