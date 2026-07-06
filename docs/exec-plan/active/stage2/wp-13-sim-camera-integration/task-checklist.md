# WP-13 — Master Task Checklist

> 每 task 一個自足檔:執行時**只開該 task 檔 + 其指名原始檔**,單 task context < 40%。
> Spec:[README.md](README.md) · Running log:[progress.md](progress.md)

| Done | Task | 檔案 | 相依 | Risk |
|------|------|------|------|------|
| ✅ | **T0** entry gate(M5/WP-11/WP-12 全綠,無程式碼) | [T0-entry-gate.md](T0-entry-gate.md) | WP-10/11/12 | Low |
| ✅ | **T1** simStep recoil 佈線(64Hz 子節奏 + onFire/spread) | [T1-simstep-recoil-wiring.md](T1-simstep-recoil-wiring.md) | T0 | High |
| ✅ | **T2** adapter 轉換 + 彈道合成 + 視覺 punch compose | [T2-camera-ballistic-compose.md](T2-camera-ballistic-compose.md) | T1 | High |
| ✅ | **T3** 彈孔 InstancedMesh + debug overlay | [T3-bullet-holes-debug.md](T3-bullet-holes-debug.md) | T2 | Low |
| ✅ | **T-exit** M6 門(E2E golden 綠 + 手動視覺 4 項 pending) | [T-exit-gate.md](T-exit-gate.md) | T1–T3 | — |

## 執行規則(沿用 [exec-plan/README.md §5](../../../README.md))

- 一個 task = 一個垂直切片 = 一個原子 commit;先驗證再 commit,未 commit 不開下一個。
- 每個 task 檔自帶 Steps / Definition of Done / Commit message,照著走。
- task 完成:更新 [progress.md](progress.md) 與切片一起 stage;把上表 Done 翻 ✅。
- WP 完成:把 [../README.md §3](../README.md) 的 WP-13 狀態翻 ✅(M6)。