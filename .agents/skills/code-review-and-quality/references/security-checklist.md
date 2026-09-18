# Security Checklist — ES Analysis

> 本專案為 Python 科學計算 / 生物力學分析工具，無 web 後端。安全風險集中在**檔案路徑、反序列化、外部資料驗證**，而非 OWASP web 漏洞。

---

## 1. 檔案路徑與 I/O 邊界

```
[ ] 所有外部傳入的路徑使用 pathlib.Path，不直接串接字串
[ ] 不使用 os.path.join(user_input, ...) — 改用 Path(user_input) / subdir，並驗證不超出預期根目錄
[ ] CLI 的 data_path 參數要檢查是否為存在的目錄（not just "truthy"）
[ ] 不在 log / print 中輸出完整的檔案系統路徑（可能洩漏機器資訊）
[ ] 寫出檔案前確認目標目錄存在（Path.mkdir(parents=True, exist_ok=True)），不靜默覆蓋
```

**紅旗**：
```python
# ❌ 路徑串接
output = base_dir + "/" + subject_id + "/result.json"

# ✅ pathlib
output = base_dir / subject_id / "result.json"
```

---

## 2. 序列化 / 反序列化

```
[ ] 不使用 pickle 讀取外部或不受控的資料來源（pickle 可執行任意程式碼）
[ ] JSON 讀取後以 Pydantic / dataclass 驗證結構，不直接把 dict 傳入業務邏輯
[ ] segment_cfg_map.json 讀取後驗證必要欄位，缺欄位拋 DataValidationError（不 KeyError）
[ ] XLSX / CSV 讀取後驗證欄位名稱存在，不以 df['col'] 直接取值前信任輸入
```

**紅旗**：
```python
# ❌ pickle from unknown source
with open(path, 'rb') as f:
    data = pickle.load(f)

# ❌ 直接取 JSON key 未驗證
cfg = json.load(f)
threshold = cfg['emg']['threshold']  # KeyError if malformed
```

---

## 3. 程式碼注入

```
[ ] 不用 eval() / exec() 處理任何外部輸入（包含 JSON 字串欄位）
[ ] subprocess 呼叫（若有）使用 list 形式，不用 shell=True
[ ] 不把 subject_id / session_name 等外部字串直接拼入 f-string 作為路徑的一部分，需先 sanitize
```

---

## 4. 敏感資料

```
[ ] 受試者 ID、姓名、實驗資料不寫入 log（使用匿名代碼）
[ ] AppSettings 中的 API key / token（如有）從環境變數讀取，不 hardcode
[ ] .env 檔案不提交（確認 .gitignore 包含 .env, *.env）
[ ] 測試資料不使用真實受試者識別資訊
```

---

## 5. 依賴套件

```
[ ] 新增依賴前確認版本未有已知 CVE（pip-audit 或 safety check）
[ ] 不 pin 到有漏洞的版本（scipy < x.y.z 等）
[ ] requirements.txt / pyproject.toml 鎖定最小版本範圍，不用 >=0.0.0
```

---

## 6. 並發與狀態

```
[ ] SegmentCfgRepository 的 JSON 原子讀寫：確認寫出前 read-modify-write 有鎖保護
    （或接受「單使用者 CLI」語意，記錄於 docstring）
[ ] matplotlib 全域狀態：plt.rcParams 修改應在 function scope 內 restore，不永久污染全域
[ ] numpy random seed（若有）在函數頂端顯式設定，不依賴全域 random state
```

---

## 快速紅旗表

| 模式 | 嚴重度 | 說明 |
|---|---|---|
| `pickle.load(f)` 讀外部檔 | HIGH | 任意程式碼執行 |
| `eval(user_str)` | CRITICAL | 程式碼注入 |
| `subprocess(..., shell=True)` | HIGH | shell 注入 |
| `os.path.join(user_input, ...)` 未驗證 | MEDIUM | 路徑穿越 |
| hardcoded API key in settings.py | CRITICAL | 密鑰洩漏 |
| `print(subject_id)` in production log | MEDIUM | 資料隱私 |
| JSON key access without validation | MEDIUM | 缺乏邊界驗證 |

---

**維護者**：principal-framework-architect
**最後更新**：2026-04-28