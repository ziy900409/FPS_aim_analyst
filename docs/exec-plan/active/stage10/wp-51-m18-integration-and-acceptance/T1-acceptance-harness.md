# WP-51 T1 — Isolated Acceptance Harness and Evidence

## Objective

建立一次一個run的Stage 10 acceptance runner：擁有dev/preview process、隔離History roots、deterministic fixtures與machine-readable evidence，失敗時也不碰真實資料。

## Dependencies

- T0已確認root injection、public History API、DEV completion driver與server commands。
- 若testability seam缺失，先回owning WP補最小可測contract與regression。

## Work

1. 定義`Stage10AcceptanceEnvironment`與root allocator：`.playwright-tmp/stage10/<runToken>/{dev,preview,downloads}`，startup與cleanup皆驗證resolved containment。
2. 建立outside/real-root sentinel inspection；History root env缺失、指向真實root或dev/preview相同時fail closed。
3. 建立runner：port preflight、fresh dev、fresh build+preview、`reuseExistingServer=false`、signal/exception/finally shutdown；未知port owner時fail fast而非kill。
4. 建立deterministic fixture factory，涵蓋多Participant、exact drills、同時刻tie-break、unknown metric、incompatible cohort、full/partial/unsupported/invalid；只用synthetic IDs。
5. preview normal fixture經public POST API seed；corrupt/unsupported bootstrap fixture只在server start前寫入該run root。
6. 建立evidence reporter，記commit/Node/OS/browser/backend/roots alias、command、status、timings/artifacts；redact payload與絕對真實path。
7. 新增單一`test:stage10`入口及harness tests：re-entry、occupied port、invalid root、startup failure、test failure與cleanup failure。

## Concurrency/lifecycle rules

- runner是process/root唯一owner；page object不得啟停server或刪root。
- fixed ports使runner持有exclusive lock；同時第二個run立即失敗並指出owner manifest。
- stateful restart/corrupt suites使用dedicated root並serial；一般browser cases以unique identities並行。
- cleanup順序：browser contexts → servers → evidence flush → sentinel/containment check → run root removal。

## Failure modes and response

| Failure | Expected behavior |
|---|---|
| env未注入或server落到default root | server readiness/diagnostic必須回報resolved synthetic root；不符立即停止 |
| preview build/server起不來 | 保存log/evidence，停止dev，sentinels不變，command non-zero |
| test中斷／Ctrl-C | finally停止children、flush partial report；只刪validated run root |
| report寫入失敗 | command non-zero；不得以console-only結果宣告M18 |
| fixture collision | runToken + deterministic sequence保證unique；collision視為harness bug |

## Definition of Done

- [ ] 一個命令可fresh啟動dev與preview，且manifest證明root分離、server未reuse。
- [ ] containment、sentinel、port/re-entry與abnormal-exit regressions全綠。
- [ ] preview fixture只經public API植入；DEV hook未出現在preview bundle。
- [ ] evidence report schema完整、可讀、無payload/PII/真實root洩漏。
- [ ] command結束後無owned process，真實root與outside sentinel前後一致。

## Suggested commit

```text
test(stage10): add isolated M18 acceptance harness
```

