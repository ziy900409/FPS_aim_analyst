# Performance Checklist — ES Analysis

> 本專案的效能瓶頸集中在：**大型 C3D 檔案 I/O、NumPy 向量運算、pandas 操作、matplotlib figure 記憶體管理**。以下清單對應這四個域。

---

## 1. NumPy / SciPy 向量運算

```
[ ] 不用 Python for-loop 逐點計算可向量化的運算
    反例：for i in range(len(arr)): result[i] = arr[i] * 2
    正例：result = arr * 2
[ ] 避免在 hot path 重複呼叫 np.concatenate / np.vstack（累積方式改用 list append + np.array(...)）
[ ] 避免不必要的 .copy()（np.ndarray 的視圖夠用時不需 copy）
[ ] scipy.signal.butter / sosfilt 的 filter 係數在 __init__ 預先計算，不在每次呼叫 process() 時重算
[ ] 大陣列切片用 view（arr[start:end]），不用 arr[start:end].copy() 除非確實需要
```

**紅旗**：
```python
# ❌ 逐點 loop
for i, sample in enumerate(emg_signal):
    filtered[i] = bandpass_filter(sample)

# ✅ 向量化
filtered = sosfilt(sos, emg_signal)
```

---

## 2. pandas 操作

```
[ ] 不用 df.iterrows() 逐行處理 — 改用向量化、apply（必要時）或 numpy 直接運算
[ ] 欄位 dtype 在讀取後立即確認（float32 vs float64 對記憶體影響 2x）
[ ] 大 DataFrame merge 確認 key 有索引（df.set_index 或 merge key 的基數合理）
[ ] 讀取 CSV 時指定 dtype 參數，避免自動推斷耗時
[ ] 不在迴圈中 df = pd.concat([df, new_row]) — 改用 list 先收集再一次 concat
```

**紅旗**：
```python
# ❌ iterrows 逐行
for _, row in df.iterrows():
    process(row)

# ❌ 迴圈 concat
for chunk in chunks:
    result = pd.concat([result, chunk])  # O(n^2)

# ✅ 一次 concat
result = pd.concat(chunks)
```

---

## 3. C3D / 大型檔案 I/O

```
[ ] C3DRepository.load() 不在每次 service 呼叫時重新讀取——由 use case 層做快取（或傳入已讀取的 RawC3D）
[ ] ezc3d 讀取後立即取出所需 channel，不持有整個 ezc3d 物件進入 application 層
[ ] 批次分析（run_largeflick_batch_analysis）確認逐 subject 釋放大物件（del raw_c3d; gc.collect() 若 RAM 受限）
[ ] JSON / XLSX staging 讀取：讀一次、快取結果，不重複 I/O
```

---

## 4. matplotlib Figure 記憶體管理

```
[ ] 每次 savefig 後呼叫 plt.close(fig)（不 close 會累積 figure，RAM 隨批次分析線性增長）
[ ] 批次繪圖迴圈確認每次迭代結束時 figure 已關閉
[ ] 不用 plt.show() 在批次/非互動模式（會 block + 保留 figure 參考）
[ ] 使用 matplotlib.use('Agg') 在 CLI / headless 環境，避免初始化 GUI backend
[ ] subplots 數量大時（> 20）考慮分批寫出，不一次建立超大 figure
```

**紅旗**：
```python
# ❌ 未 close
for subject in subjects:
    fig, ax = plt.subplots()
    ax.plot(data)
    fig.savefig(path)
    # plt.close(fig) 缺失 → 記憶體洩漏

# ✅
plt.close(fig)
```

---

## 5. 演算法複雜度

```
[ ] find_zmin / group_zmin — 確認分段演算法不是 O(n²)（nested loop over long signal）
[ ] exclude_center 的過濾邏輯不重複遍歷同一陣列多次（一次 pass 完成）
[ ] segment_processing_service 的分段結果若被多次消費，考慮 tuple 快取而非重複計算
[ ] kinematic_cloud_stats 若對每個 frame 計算旋轉矩陣，確認已做 batch matrix multiplication（np.einsum 或 @ operator）
```

---

## 6. 記憶體佔用

```
[ ] 大型 np.ndarray（C3D analog data）確認在使用後由 GC 回收（不被閉包或 self 意外持有）
[ ] domain model 的 slots=True 減少每個實例的 __dict__ 記憶體開銷（已在規範中，確認有落實）
[ ] DataFrame 讀取後若只需部分欄位，在讀取時 usecols 過濾，不讀全表再 drop
```

---

## 快速紅旗表

| 模式 | 嚴重度 | 說明 |
|---|---|---|
| `for i in range(len(arr)): result[i] = ...` | HIGH | 應向量化 |
| `df.iterrows()` in hot path | HIGH | 改用 vectorized |
| `pd.concat` in loop | HIGH | O(n²) 記憶體複製 |
| `plt.close(fig)` 缺失 | HIGH | 批次分析記憶體洩漏 |
| C3D 每次重新讀取 | MEDIUM | I/O 瓶頸 |
| `np.concatenate` in loop | MEDIUM | 改用 list + 單次 stack |
| filter 係數在每次呼叫重算 | MEDIUM | 移至 __init__ |
| `plt.show()` in CLI mode | LOW | blocking + backend issue |

---

**維護者**：principal-framework-architect
**最後更新**：2026-04-28