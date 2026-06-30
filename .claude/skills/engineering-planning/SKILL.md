---
name: engineering-planning
description: Turn feature ideas, PRDs, migration tasks, or vague requirements into a technical specification, task breakdown, risk analysis, acceptance criteria, or exec-plan/design-doc draft for the performance_analysis repository. Use when the user asks for engineering planning, a tech spec, system design, task breakdown, risk analysis, acceptance criteria, or to convert requirements into an implementation plan before coding.
---

# Engineering Planning

Use this skill for planning work, not for immediate implementation. Stay in planning mode until the user explicitly asks to move into coding.

## Mandatory context

Before drafting anything:

1. Read `AGENTS.md`.
2. If the change belongs to an active migration, read the relevant exec-plan in `docs/exec-plans/active/`.
3. If the design touches `backend/`, read `docs/design-docs/architecture-invariants.md` and `backend/.golangci.yml`.
4. Load `references/design_standards.md` for quality criteria.
5. Load `assets/tech_spec_template.md` for the target output structure.

## Workflow

### 1. Frame the problem

Collect or infer:

- User problem and expected outcome
- Primary user/operator
- Scope, scale, and data volume
- Deployment/runtime constraints
- Stack constraints and compatibility requirements
- Non-negotiable requirements

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
- Definition of Done is objectively verifiable.

### 4. Choose the output location

Use these defaults unless the user asks otherwise:

- `docs/exec-plans/active/` for execution plans tied to active work
- `docs/design-docs/` for stable design decisions

Do not write planning files until the user asks for the draft to be saved or clearly approves the plan.

## Operating rules

- Do not write production code while this skill is active unless the user explicitly pivots to implementation.
- Do not skip architecture or migration documents when the request touches those areas.
- Do not use subjective Definition of Done language such as "implementation completed".
- Keep scope boundaries explicit: `In scope` and `Out of scope`.
- If concurrency, channels, mutexes, or cancellation are involved, require a concrete concurrency model section.

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
- Risk analysis and failure modes
- Ordered task breakdown with dependencies and DoD
- Open questions and assumptions
