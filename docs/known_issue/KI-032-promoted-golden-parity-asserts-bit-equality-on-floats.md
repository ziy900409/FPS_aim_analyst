# KI-032 — C-D5 晉升指標的 Python golden 以**逐位浮點相等**比對：跨機器必紅，四個測試在 `main` 上長期失敗

> 類型：**test-harness correctness defect**（比對紀律錯，不是演算法錯）。指標數值本身無誤，最大相對偏差
> **~2e-14**，沒有任何判定或門檻因此翻面。真正的損害是 **C-D5 的守門測試長期紅燈 ⇒ 已失去回歸偵測能力**。
> 狀態：🔴 **診斷完成（2026-09-09），修法待落地**。尚無 `BD-032`。
> 決策帳本：[BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引。
> 相關：[CLAUDE.md §4 C-D5](../../CLAUDE.md)（晉升指標雙實作對表紀律）·
> [DECISIONS.md GD-21](../exec-plan/DECISIONS.md)（`seg-v2`／`phase-v1`／`curve-v1`／`sync-v1`／`sg-seg-v2` 晉升）·
> [completed/stage4/](../exec-plan/completed/stage4/README.md)（WP-32 = golden parity 晉升）。
> 發現脈絡：2026-09-09 為判定 `docs/wp-61-lift-off-validation-plan` 能否合併回 `main` 而跑
> `uv run pytest` 全量，得 **4 failed / 488 passed**。在 `main` 上跑同樣四個檔案得到**一字不差的四個失敗**
> ⇒ 與 WP-61 無關，是 `main` 的既有破口。

## 1. 症狀

`research/` 全量 pytest 在 `main`（`445fb7c`）與合併 WP-61 後（`2ceb812`）皆 exit 1，固定四個失敗：

| 測試 | 檔案 |
|---|---|
| `test_committed_sg_coefficients_match_generator` | `src/modules/kinematics/algorithms/tests/test_promoted_kinematics_golden.py:29` |
| `test_committed_omega_fixtures_match_generator` | 同上 `:44` |
| `test_the_committed_verdict_for_one_session_reproduces_bit_for_bit_from_the_seed` | `src/modules/metrics/algorithms/tests/test_coupling_fixture.py` |
| `test_committed_real_segment_fixtures_match_generator` | `src/modules/segments/algorithms/tests/test_promoted_segments_golden.py:35` |

四者的差異全部落在浮點尾位：

```
sg leadingEdge[0][0]   0.7902097902097885  vs  0.7902097902097882   （rel ~3.8e-16）
sg leadingEdge[0][1]   0.33566433566433557 vs  0.3356643356643363   （rel ~2.2e-15）
coupling observed      0.9040849348933115  vs  0.9040849348933118   （rel ~3.3e-16）
coupling ci_width      0.0318615932266868  vs  0.03186159322668669  （rel ~3.5e-15）
coupling half_delta    0.011883647677947917 vs 0.011883647677947695 （rel ~1.9e-14）
```

**所有決定性欄位皆相同**：`verdict` 三筆全為 `research_only`、`n` 全為 20、`gate_thresholds` 與
`xcorr_params` 逐欄相等、segments 的 `tickRange` 逐位相等。⇒ 沒有任何結論、門檻或晉升判定被影響。

## 2. 根因

比對用的是 **dict 的 `==`，對 float 逐位相等**：

```python
# test_promoted_kinematics_golden.py:26-29
actual = generator.sg_coefficients_payload()
expected = _load_json(GOLDEN_DIR / "sg-coeffs-seg-v2.json")

assert actual == expected
```

而 golden 的產生鏈走 numpy／scipy 的 LAPACK（SG 係數是 pinv/lstsq），其 wheel 為
**OpenBLAS `DYNAMIC_ARCH`**：

```
openblas configuration: OpenBLAS 0.3.33.112.0 USE64BITINT DYNAMIC_ARCH NO_AFFINITY Haswell MAX_THREADS=24
```

`DYNAMIC_ARCH` 表示實際執行的 SIMD kernel **由執行期 CPU 微架構決定** ⇒ 同一份程式碼、同一個
wheel，在不同 CPU 上的浮點運算次序不同，尾位必然不同。逐位相等因此**不是這條鏈可以滿足的契約**。

### 已排除的其他解釋（實測）

| 假設 | 檢驗 | 結果 |
|---|---|---|
| 相依版本漂移 | `research/uv.lock` 自 `012eddc`（WP-28 T1）起**從未更新**；`.venv` 實際為 numpy 2.5.1／scipy 1.18.0，**與 lock 一致** | ❌ 排除 |
| 產生器被改過（C-D5 「不得原地改語意」） | `git log 8f8048c.. -- .../generate_promoted_kinematics_golden.py .../kinematics/algorithms/` **零 commit**；`fixtures/golden/sg-coeffs-seg-v2.json` 亦停在 `8f8048c` | ❌ 排除 |
| BLAS 多執行緒的 reduction order | `OPENBLAS_NUM_THREADS`／`OMP_NUM_THREADS` = 1／2／4 三組**皆同樣失敗** | ❌ 排除 |
| 本機跑跑不同（非決定性） | 產生器連跑三次，輸出 JSON 的 sha256 **三次完全相同**（`9768075796566c36…`），與 golden（`df6d32770c6eecd3…`）不同 | ❌ 排除 —— **機器內決定性、機器間漂移** |

⇒ golden 是在**另一台 CPU** 上錄的；`main` 上的這四個測試在錄製機以外的任何機器都紅。

### 同一檔案裡就有正確做法的對照

`test_coupling_fixture.py` 內兩個測試量**同一個統計量**，只差比對方式：

```python
# :138 —— 通過
assert verdict["observed"] == pytest.approx(observed, abs=1e-12)

# test_the_committed_verdict_for_one_session_reproduces_bit_for_bit_from_the_seed —— 失敗
assert actual == expected          # dict 逐位相等
```

這是最乾淨的證據：**失效在比對紀律,不在演算法**。

## 3. 影響面

1. **C-D5 的守門能力已喪失**。`npm run` 側的 `promoted-*.test.ts` 仍綠，但 Python 端這四個是
   「Python 產生器 ↔ committed golden」那一半的唯一防線。它們長期紅燈 ⇒ 真正的語意回歸會被當成
   「又是那四個浮點紅燈」放行。這與 [KI-030](KI-030-history-e2e-flaky-under-parallel-workers.md) 對
   Playwright 的損害同型。
2. **`uv run pytest` 目前不是可用的門檻讀數**。任何 WP 的 DoD 若寫「`uv run pytest` exit 0」都無法達成；
   WP-61 task-checklist 的第八項正是這樣寫的。
3. **研究結論不受影響**。~2e-14 遠低於任何 pre-registered 門檻的有效位數；`verdict`／`tickRange`／
   `gate_thresholds` 逐位相同。**不需要重跑任何分析、不需要撤回任何宣稱。**
4. 未登記在本目錄 ⇒ 這是第一次入帳。

## 4. 修改計畫（未落地）

**選項 A（建議）—— 把浮點比對換成有明示容差的對表 helper。**
在 `research/src/modules/` 共用一個 `assert_golden_close(actual, expected, *, rtol, atol)`：對
`float`／`list[float]` 遞迴走 `math.isclose`，對 `int`／`str`／`bool`／結構鍵**維持逐位相等**。
四個測試改呼叫它，容差取 `rtol=1e-12`（比實測漂移 ~2e-14 寬兩個數量級，仍比任何門檻的有效位數緊
上許多）。

- 為何不是「重錄 golden」：重錄只會把紅燈移到**下一台機器**上，並且每次重錄都在稀釋 golden 作為
  回歸基準的意義。C-D5 要保護的是**語意**不漂移，不是尾位不漂移。
- 為何結構鍵仍須逐位：`tickRange`、`peekIndex`、`side`、`verdict`、`flags` 這些是離散判定，
  容差對它們毫無意義且會遮蔽真回歸。
- ⚠️ **不得順手改動任何 `version` 字串**（C-D5：只能升版，不得原地改語意）。本修法**不動語意**，
  故 `sg-seg-v2`／`seg-v2`／`sync-v1` 等版本字串一律不動。

**選項 B —— 在 `pyproject.toml` 釘死 wheel 並宣告「只在錄製機驗證」。**
誠實但沒用：`DYNAMIC_ARCH` 是 wheel 內部的執行期分派，釘版本擋不住換 CPU。實質等於放棄這四個測試。

**選項 C —— 不修，把四個測試標 `xfail`。**
最差：C-D5 的 Python 半邊直接失去防線，且 `xfail` 會連真回歸一起吞掉。

### 落地步驟（選項 A）

1. 先加 helper 與其自身的單元測試（含「結構鍵不同時必須紅」的負向案例），**不改四個測試**。
2. 四個測試逐一改用 helper，每改一個確認它在本機由紅轉綠。
3. 跑全量 `uv run pytest`，取 exit 0 的實際數字。
4. 跑 `npm run test`（`promoted-*.test.ts` 全綠）確認 TS 半邊未受影響 —— 本修法不碰 TS，此步為 C-D5 對表的形式確認。
5. 翻 [BUGFIX-DECISIONS.md](BUGFIX-DECISIONS.md) §1 索引 + 記 `BD-032`。

## 5. 遺留 OQ

- **OQ-KI32-1**：`rtol=1e-12` 是否對每一個 golden 家族都足夠？`half_delta` 已見 ~1.9e-14，而
  permutation null／CI 這類經 1000 次重抽的量可能放大更多。落地時應對每個 golden 家族量出實際最大
  相對偏差並記進 progress，而非四處共用一個猜值。
- **OQ-KI32-2**：這四個測試從 2026-08-17 錄製至今近一個月未被發現紅燈 ⇒ `uv run pytest` 顯然不在任何
  例行門檻裡（`package.json` 的 `test:ci` 只含 tsc／vitest／playwright，**不含 Python**）。
  是否要把 Python 側納入 `test:ci`？納入前必須先修好本 KI，否則等於把 `test:ci` 永久釘紅。
