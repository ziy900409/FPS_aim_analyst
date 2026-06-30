# ES Analysis — Architecture Quick Reference

> 供 `code-review-and-quality` skill 的 Architecture 軸使用。完整規則見 `es-analysis-code-review` skill。

---

## 分層依賴方向

```
domain  ←  application  ←  infrastructure
               ↑
           interfaces
```

**黃金規則**：外層依賴內層；`domain` 不依賴任何外層。

---

## 各層一句話職責

| 層 | 路徑 | 職責 |
|---|---|---|
| **domain** | `src/es_analysis/domain/` | 業務模型與例外，不含 I/O 與框架 |
| **application** | `src/es_analysis/application/` | 用例協調、演算法服務，依賴注入 |
| **infrastructure** | `src/es_analysis/infrastructure/` | 檔案 I/O、序列化、ezc3d/pandas 封裝 |
| **interfaces** | `src/es_analysis/interfaces/` | CLI / GUI 進入點，呼叫 use case |
| **core** | `src/es_analysis/core/` | `AppSettings`（橫切所有層）、logging |

---

## 禁止的 Import 組合（CRITICAL）

| 違規 | 說明 |
|---|---|
| `domain` → `application.*` | 內層不得知道外層 |
| `domain` → `infrastructure.*` | 同上 |
| `application` → `infrastructure.*` | 應透過 DI，不直接 import |
| `application` → `ezc3d` | ezc3d 屬 infrastructure |
| `domain` → `core.settings` (global) | Settings 應注入，不全域取用 |

---

## 主要 Domain Models

| 類別 | 用途 |
|---|---|
| `RawC3D` | C3D 原始資料封裝（markers + analogs）|
| `EmgModel` | EMG 時域/頻域結果 |
| `DirectionalEmgResult` | 方向性 EMG 切片 |
| `SegmentationResult` | 分段管線完整輸出 |
| `ShootingReport` | 射擊/視角聚合根 |
| `WindowFeatureTable` | 特徵長表格 |
| `SegmentCenterConfig` | 分段中心排除設定（值物件）|
| `MvcBatchResult` | MVC 峰值聚合 |

**所有 Domain Model 規範**：`@dataclass(frozen=True, slots=True)`，無 I/O，無 scipy 運算。

---

## 主要 Application Services

| 子目錄 | 代表服務 | 職責 |
|---|---|---|
| `services/c3d/` | `C3DEmgMergeService` | C3D + EMG CSV 合併、觸發偵測 |
| `services/emg/` | `EMGProcessingService` | EMG 濾波、正規化、cloud stats |
| `services/segment/` | `segment_processing_service` | 分段（find_zmin, group_zmin, exclude_center）|
| `services/feature/` | `compute_window_features` | 時窗特徵萃取 |
| `services/kinematic/` | `kinematic_cloud_stats` | 關節角度、座標系計算 |
| `services/plot/` | `plot_emg_cloud`, `FileSegmentPlotter` | 繪圖輸出 |

---

## Settings 注入模式

```python
# ✅ 正確：透過建構子注入
class EMGProcessingService:
    def __init__(self, cfg: AppSettings) -> None:
        self._cfg = cfg

# ❌ 錯誤：domain 層全域取用
from es_analysis.core.settings import settings
THRESHOLD = settings.EMG_CONFIG.DEFAULT_BANDPASS_CUTOFF
```

---

## 繪圖風格規範（services/plot/）

```python
# 色盤
PRIMARY = '#CC0040'    # 紅
SECONDARY = '#000000'  # 黑
GRAY = '#757575'

# 輸出
fig.savefig(path, dpi=300, transparent=True)
plt.close(fig)         # 必須 close，避免記憶體洩漏

# Axes 清理
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
```

---

## Architecture Review 快速問題清單

```
[ ] 新類別在正確的層（不把 I/O 塞進 domain，不把演算法塞進 infrastructure）？
[ ] Import 方向合法（見上方禁止表）？
[ ] 新 service 的 __init__ 只做 DI，不執行業務邏輯？
[ ] 新 use case 只協調 service，不直接操作 repository 或 I/O？
[ ] 跨層傳遞用 DTO（application/contracts/），不直接暴露 Domain Model？
[ ] AppSettings 透過參數注入，不從全域取用？
[ ] 新的繪圖函數接收處理好的資料（list/dict/DataFrame），不接收 Domain Model？
[ ] 繪圖後有 plt.close(fig)？
```

---

**對應技能**：`es-analysis-code-review`（執行自動化掃描與完整人工清單）
**完整架構圖**：`ARCHITECTURE.md`
**最後更新**：2026-04-28