---
name: engineering-planning
description: Turn feature ideas, PRDs, migration tasks, or vague requirements into a technical specification, task breakdown, risk analysis, acceptance criteria, or exec-plan draft for the FPS_aim_analyst repository. Use when the user asks for engineering planning, a tech spec, system design, task breakdown, risk analysis, acceptance criteria, or to convert requirements into an implementation plan before coding.
---

# Engineering Planning

Use this skill for planning work, not for immediate implementation. Stay in planning mode until the user explicitly asks to move into coding.

## Mandatory context

Before drafting anything:

1. Read `CLAUDE.md` — §3 執行協議(一 task = 一垂直切片 = 一原子 commit)與 §4 不可違反的硬約束(ADR / GD-n)。這是本 repo 的程序記憶,不是 `AGENTS.md`(那份只有 graphify / codegraph 設定)。
2. Read `docs/exec-plan/README.md` — 現行 WP 狀態、里程碑 M1–M15+、相依圖。新計畫必須接在既有 WP 編號與 stage 之後。
3. Read `docs/exec-plan/DECISIONS.md` — 跨 WP / 跨文件的全域決策帳本;若計畫與既有決策衝突,必須入帳而非靜默偏離。
4. If the change belongs to an active work package, read that WP's `README.md` + `progress.md` under `docs/exec-plan/active/`.
5. If the change touches naming (變數/函式/類別/檔案/欄位), read `CONTEXT.md` 對齊正規術語。
6. Load `references/design_standards.md` for quality criteria.
7. Load `assets/tech_spec_template.md` for the target output structure.

## Workflow

### 1. Frame the problem

Collect or infer:

- User problem and expected outcome
- Primary user/operator(研究者 / 受試者 / 分析端)
- Scope, scale, and data volume
- Deployment/runtime constraints
- Stack constraints and compatibility requirements
- Non-negotiable requirements — 逐條對照 `CLAUDE.md §4` 硬約束

Prefer discovering answers from repo context first. Ask concise follow-up questions only for material gaps that change the design.

### 2. Draft the spec

Fill every section of the template:

- Requirements
- Technical design
- Risk analysis
- Task breakdown

Always keep unresolved items in an explicit `Open Questions` section. Do not hide ambiguity.

### 3. Review quality

Check the draft against `references/design_standards.md`:

- Every functional requirement maps to at least one task.
- Every open question has an owner or a deadline if that is known.
- High-risk tasks include failure modes.
- Interface contracts define concrete input/output types.
- Definition of Done is objectively verifiable **證據**(測試 exit code、逐位一致斷言、實機證據),不是主觀語句。
- 硬約束衝擊章節逐條過閘,無「不適用」而未說明理由的項目。

### 4. Choose the output location

Use these defaults unless the user asks otherwise:

- `docs/exec-plan/active/stageN/wp-NN-<slug>/` — 執行計畫。本 repo 的 WP 是**資料夾**,不是單檔:
  `README.md`(§1 範圍 / §2 關鍵契約 / §3 Failure modes / §4 Task 索引)、`T0-entry-gate.md`、
  `T1..Tn-*.md`、`T-exit-gate.md`、`task-checklist.md`、`progress.md`。
  Tech spec 的四個 section 分別餵進:Requirements/Design → `README.md`;Risk → `README.md §3`;
  Task breakdown → `README.md §4` 索引 + 每個 `Tn-*.md` 的 Steps / DoD / Commit。
- `docs/exec-plan/DECISIONS.md` — 穩定的跨 WP 設計決策(本 repo 無 `docs/design-docs/`)。
- `docs/known_issue/KI-NNN-*.md` + `docs/known_issue/BUGFIX-DECISIONS.md` — bug 診斷與修復決策。

Do not write planning files until the user asks for the draft to be saved or clearly approves the plan.

## Operating rules

- Do not write production code while this skill is active unless the user explicitly pivots to implementation.
- Do not skip `CLAUDE.md` §4 或 `docs/exec-plan/README.md`,即使需求看起來很小。
- Do not use subjective Definition of Done language such as "implementation completed".
- Keep scope boundaries explicit: `In scope` and `Out of scope`.
- 若設計觸及 sim 迴圈、`SharedState`、輸入鏈或命中判定,**必須**填寫「決定性契約衝擊」與「三迴圈邊界 (ADR-2)」章節。
- 每個 task 必須自帶一行 conventional-commit 訊息(協議 §3.1:一 task = 一原子 commit)。

## Bundled resources

- `references/design_standards.md`: quality rules for each spec section
- `assets/tech_spec_template.md`: the output skeleton to fill
- `scripts/generate_plan.py`: generate a blank spec draft from the template

Use the script when a file stub is useful before filling details:

```bash
python <skill-dir>/scripts/generate_plan.py "Feature Name"
```

## Expected output

Produce a concise but complete planning artifact that contains:

- Problem statement and scope
- Functional and non-functional requirements
- Technical design with data flow and interfaces
- 硬約束衝擊(GD-n / ADR)逐條過閘
- Risk analysis and failure modes
- Ordered task breakdown with dependencies, DoD, and commit message
- Open questions and assumptions
