# Stage3 Pilot Protocol — 追蹤 × 場景與解析度 × 偵測

> WP-22 T3 pilot 施測程序。此文件描述研究流程與資料收集紀律;app 內只收 `participantId`/`sessionLabel`,同意書、納排簽核、moderator 備註維持文件/研究行政層。
> Companion:[acceptance-checklist-c.md](acceptance-checklist-c.md) · [analysis-tracking.md](analysis-tracking.md) · [analysis-t-detect.md](analysis-t-detect.md) · [timing-validity.md](timing-validity.md)。

---

## 1. Pilot 目標與範圍

| 實驗 | 目的 | 目前工程入口 | 主要匯出欄 |
|---|---|---|---|
| 追蹤 × 場景 | 驗證移動目標在 BR 場景中的獲取/追隨資料可收集,並檢查場景雜亂度與速度階層的 pilot 可行性。 | `tracking_scene_v1`(field-low canonical;urban-high clearance 已自動驗證) | `ticks.tx/ty/tz`, `ticks.px/pz`, `ticks.aim`, `events.visible`, `meta.scene`, `meta.spawn.motion` |
| 解析度 × 偵測 | 在同一面板、同一 session 內比較 render 解析度條件對偵測 onset proxy 的影響。 | `resolution_detection_v1`(fhd-1080 → qhd-1440;順序由 protocol config 排定) | `meta.protocol`, `meta.display`, `meta.frames`, `meta.spawn`, `ticks.aim`, `events.visible.targetX/Y/Z` |

Out of scope:多受試者管理後端、正式統計分析 pipeline、眼動儀、OS 顯示模式切換、問卷模組。問卷可先外部收集,用 `participantId` 離線 join。

---

## 2. 受試者與設備前置

1. 指派唯一 `participantId`;同一人多次 pilot 用同一 ID,用 `sessionLabel` 區分 `pre`/`post`/`day-1`。
2. 研究行政層確認同意書、納排條件、視力/矯正視力、近期 FPS 經驗與任何 moderator 備註。
3. 使用 Chrome/Edge 桌面版;關閉會干擾 fullscreen 或效能的背景程式。
4. 解析度 × 偵測 protocol 必須通過資格閘:原生解析度至少 `2560×1440`,真 fullscreen, warmup p95 frame time ≤ `PERF_FLOOR_MS`。
5. 資格閘不通過即不收該 protocol 的實驗資料;保留 gate details 作篩選紀錄。

---

## 3. 實驗 A:追蹤 × 場景

### 3.1 條件規劃

Pilot 起點使用 `tracking_scene_v1`:scene=`field-low`,motion=`pingpong horizontal`,speed=`2u/s`,range=`0.25u`,presentation=`2000ms`,10 presentations。

研究設計若要跑完整「場景 × 速度」pilot,以 config 資料新增條件,不要改引擎:

| 因子 | Pilot 建議水準 | 備註 |
|---|---|---|
| Scene | `field-low`, `urban-high` | 兩者都需通過 moving-envelope clearance;urban-high 已有自動淨空複驗。 |
| Speed | `1`, `2`, `4` u/s | `2u/s` 是目前 `tracking_scene_v1` 基準;其他速度需 materialize 為獨立 drill config 並跑清單 C 的淨空與決定性測試。 |

### 3.2 施測步驟

1. 讓受試者完成一輪非記錄練習,確認滑鼠感度與 pointer lock 操作。
2. 載入追蹤條件;確認場景顯示與條件表一致。
3. 受試者在每個 presentation 中盡快獲取目標並持續追蹤;不要刻意點射作為主要反應。
4. 每個條件完成後匯出 JSON;檢查 `meta.drillId`, `meta.scene`, `meta.spawn.motion`, `meta.suspect=false`。
5. 條件間允許短休息;下一條件開始前重新確認場景/速度條件。

### 3.3 追蹤分析

使用 [analysis-tracking.md](analysis-tracking.md) 離線推導:

- `t_acquire = t_first_on_target - t_visible`
- `acquisitionFailureRate`
- `TOT%` inside tracking window
- primary: `RMS(ε)` inside tracking window

指標全部由 raw ticks/events 離線推導(GD-7 raw-over-derived)。若整段未 on-target,該 presentation 是 acquisition failure,不進 TOT/RMS 聚合。

---

## 4. 實驗 B:解析度 × 偵測

### 4.1 條件與對抗平衡

目前 shared config `resolution_detection_v1` 順序:

| conditionIndex | label | mode | scene | drill |
|---:|---|---|---|---|
| 0 | `fhd-1080-field-low-detection` | `fhd-1080` | `field-low` | `detection_popin_v1` |
| 1 | `qhd-1440-field-low-detection` | `qhd-1440` | `field-low` | `detection_popin_v1` |

受試者內設計要求同一 session 完成所有條件(GD-10)。正式 pilot 需要對抗平衡時,研究者應準備等價的反向順序 `ProtocolConfig`;順序是資料,不是引擎邏輯。

### 4.2 施測步驟

1. 點「解析度 protocol」,填 `participantId`/`sessionLabel`。
2. 進入 fullscreen 並通過 eligibility gate;未通過則停止。
3. 完成條件 0;系統鎖定解析度模式、載入 scene/drill,條件完成後匯出 JSON。
4. 點下一條件;完成條件 1,匯出第二份 JSON。
5. 每份 JSON 必須含 `meta.protocol.protocolId`, `conditionIndex`, `conditionLabel`, `meta.display.mode`, `meta.frames.summary`, `meta.spawn.seed=21021`。
6. 若某條件 fullscreen 退出或效能超地板,只標該條件 `suspect`;後續條件仍可繼續,但分析時剔除 suspect 條件。

### 4.3 偵測分析

使用 [analysis-t-detect.md](analysis-t-detect.md) 離線推導:

- `eccentricity_at_spawn`
- `t_detect`:瞄準 eccentricity 持續下降的 onset proxy
- `reactionMs = t_detect - t_visible`
- `timeout`, `anticipation`, `baselineInsufficient`
- secondary: `engagement_time = t_first_fire - t_visible`

預設參數是 pilot 起點:pre-stimulus window `500ms`,threshold `3×SD(|dε/dt|)`,持續 `k=4` ticks,human lower bound `100ms`。正式分析需做 threshold/k 敏感度分析。

---

## 5. 匯出命名與收集慣例

建議命名片段:

```text
<participantId>_<sessionLabel>_<experiment>_<conditionLabel>_<startedAt>.json
```

範例:

```text
P003_day-1_detection_fhd-1080-field-low-detection_2026-07-09T150000Z.json
P003_day-1_tracking_field-low-speed2_2026-07-09T151500Z.json
```

權威 join key 仍是 JSON 內的 `meta.session.participantId`, `meta.session.sessionLabel`, `meta.protocol`, `meta.scene`, `meta.display`,而非檔名。檔名只供人工檢查與資料夾整理。

---

## 6. 已知誤差界線與判讀紅線

| 來源 | 量級/語意 | 判讀 |
|---|---|---|
| `t_visible` tick 量化 | ≤ 1 sim tick,128Hz 約 `7.8ms` | 所有 reaction/onset 指標最多有 tick 邊界量化。 |
| rAF 呈現量化 | ≤ 1 render frame,60Hz 約 `16.7ms` | 狀態翻轉到光學呈現需下一幀;frame log 用來審查而非消除此限制。 |
| display/compositor latency | 數 ms 到數十 ms | 瀏覽器測不到 absolute click-to-photon;本研究只解釋受試者內相對值。 |
| `t_detect` | 瞄準移動 onset proxy | 不是純知覺 RT;混有感知、決策、動作準備與滑鼠啟動。若需要純知覺,需眼動儀或專用反應鍵另立研究。 |
| upscale 語意 | `fhd-1080`/`qhd-1440` 是 render buffer + CSS fullscreen upscale | 構念是「同一面板上的 render 解析度效應」,不是不同螢幕或 OS display mode 比較。 |
| 追蹤指標 | `t_acquire` 與 pursuit window 分離 | TOT%/RMS ε 不含 acquisition failure 段;需同時報告 acquisition failure rate。 |
| `suspect=true` | 條件品質旗標 | 不得與乾淨條件混併;至少做剔除分析,必要時重跑條件。 |

---

## 7. Pilot 結束檢查

每位受試者結束後確認:

- 解析度 protocol 產生兩份 JSON,conditionIndex 覆蓋 `0` 與 `1`。
- 每份偵測 JSON 有 `meta.display.gate.pass=true`, `meta.frames.summary`, `meta.spawn.seed=21021`。
- 追蹤 JSON 有 `meta.scene`, `meta.spawn.motion`,且 tick rows 中存在非空 `tx/ty/tz`。
- `suspect=false` 的條件才進 primary analysis;`suspect=true` 保留但標註。
- 行政紀錄包含 participant/session 對應、條件順序、任何中斷/重跑原因。
