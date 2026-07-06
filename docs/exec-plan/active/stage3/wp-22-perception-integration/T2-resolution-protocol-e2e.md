# T2 — protocol 執行器 + 解析度 × 偵測受試者內 E2E

> Part of [WP-22 perception-integration](README.md)。Companion:[task-checklist.md](task-checklist.md) · [progress.md](progress.md)

| | |
|---|---|
| **相依** | T0(WP-20/21 上游確認);與 T1 可並行 |
| **Risk / Cplx** | **High** / High(GD-10 三道防線的整合收斂點) |
| **Touches** | ADD `src/display/ProtocolRunner.ts`(或 `src/ui/`)+ `ProtocolConfig` + E2E 一條;MODIFY `src/data/metadata.ts`(meta.protocol 標記)+ 測試 |
| **狀態** | ⬜ |

## Objective

GD-10 的實驗實體成形(FR-C14):受試者內解析度 protocol——資格閘 → setup 表單 →
條件序列(鎖定解析度 → 偵測 drill → 匯出)——端到端可跑;「解析度 × 察覺」從決議
變成可施測的流程。

## In scope
- `ProtocolConfig`(資料驅動):`{ protocolId, requiredDisplay: {minW,minH}, conditions:
  [{ label, mode, sceneId, drillId }] }`;順序 = config 排定(對抗平衡是研究者的
  資料,不是引擎邏輯);`validateProtocol` 比照既有 schema 模式。
- `ProtocolRunner` 流程:資格閘(WP-20 T2)→ setup 表單(WP-20 T4)→ 逐條件:
  `applyResolutionMode` + `lockMode` → 場景就緒 → drill → 匯出(檔名帶條件標記)→
  條件間過場畫面 → 完成頁(匯出檔清單)。
- **條件級防護**:每條件開始 assert 顯示/場景狀態 = config 宣告;條件中 fullscreen
  退出/效能地板超標 → 該條件 `suspect`(不廢整 session);`meta.protocol =
  { protocolId, conditionIndex, conditionLabel }`(OQ-22.1 落點)。
- E2E(**stage3 最重的一條**):合成輸入走完 2 條件 protocol(fhd-1080 / qhd-1440 ×
  偵測 drill)→ 斷言:兩份匯出各含正確 `meta.display.mode`/`meta.protocol`/
  `meta.spawn.seed`、frames 區塊在、資格閘 report 在;+ 一條拒入路徑 E2E(mock 低
  解析度 screen → gate 拒入、無匯出)。
- 條件間狀態隔離測試(failure mode 表):條件 2 開始時 buffer 尺寸/場景 = 宣告值。

## Out of scope
- 對抗平衡順序生成(研究者排 config)、多受試者/上傳後端(本地檔案為邊界)、
  追蹤 drill 進 protocol(pilot 設計決定,清單 C 不含)。

## Steps

- [ ] `ProtocolConfig` + validate + 單元測試。
- [ ] `ProtocolRunner` 流程 + 條件級 suspect + meta.protocol;單元測試(mock 各站)。
- [ ] E2E 主線(2 條件全流程)+ 拒入路徑 + 狀態隔離斷言,全綠。
- [ ] 實機手動走一輪完整 protocol(真 fullscreen/真切換)記 progress。
- [ ] `npx vitest run` + E2E 全綠。

## Definition of Done

- 合成 E2E 全綠(兩條件匯出 + 拒入 + 隔離);實機手動一輪完成(證據記 progress);
  條件失效降級為條件級 suspect(測試證明不廢 session)。

## Commit

`feat(wp-22): T2 protocol 執行器(資格閘→條件序列→匯出)+ 解析度×偵測受試者內 E2E`
