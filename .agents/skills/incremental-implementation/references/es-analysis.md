# ES_analysis Incremental Implementation Reference

Use this reference when applying the incremental-implementation skill in this repository.

Source context:
- `AGENTS.md` is currently a placeholder; do not infer agent boundaries from it.
- `ARCHITECTURE.md` is the authoritative layer map.
- `CONTEXT.md` is the authoritative domain language.
- `docs/adr/` records accepted architecture decisions.
- `docs/exec-plans/active/p0-architecture-roadmap.md` records the current P1-P5 roadmap and GitHub issue slices.

## Repository Shape

This is a Python 3.10 Poetry project for FPS gaming biomechanics analysis, combining kinematic and EMG processing.

Main package:
- `src/es_analysis/domain/` - domain models and domain exceptions only.
- `src/es_analysis/application/` - use cases, services, contracts, and orchestration logic.
- `src/es_analysis/infrastructure/` - repositories, mappers, diagnostics adapters, and I/O details.
- `src/es_analysis/interfaces/` - CLI and GUI entry points.
- `src/es_analysis/core/` - settings, logging, and shared utilities.
- `tests/` - pytest suite.

Core verification:

```powershell
poetry run pytest
```

Targeted verification examples:

```powershell
poetry run pytest tests/test_window_feature_service.py -q
poetry run pytest tests/test_combine_c3d_csv_use_case.py -q
```

## Architecture Rules

Respect the DDD dependency direction:

```text
domain <- application <- infrastructure
              ^
          interfaces
```

Increment rules by layer:
- Domain increments add frozen value objects, enums, dataclasses, and domain exceptions without I/O or framework imports.
- Application increments coordinate use cases and services, consume domain models, and depend on ports/protocols rather than concrete I/O.
- Infrastructure increments implement file access, serialization, `ezc3d`, pandas CSV loading, and other external-library details.
- Interfaces increments translate CLI/GUI input into use case calls and present results; they should not hold analysis logic.
- DTOs in `application/contracts/` are cross-layer transfer contracts and are not a replacement for domain models.

Avoid these cross-layer shortcuts:
- Importing infrastructure repositories from domain or low-level domain models.
- Putting file reads/writes inside domain models or Stage implementations.
- Returning anonymous tuples from application use cases when a named result object would prevent invalid states.
- Adding GUI, plotting, or interactive callbacks to pure Pipeline or Stage code.

## Domain Language Guardrails

Prefer the vocabulary in `CONTEXT.md`.

Important terms:
- Participant, Visit, Condition, Session, Task, Repetition, Phase, Frame.
- SpiderShot is the domain task name; LargeFlick is a legacy processing label.
- Target Direction, Movement Direction, and Error Direction are distinct. Avoid unqualified `direction`.
- Movement Archetype is classified from kinematics only. EMG explains neuromuscular strategy after classification.
- Pipeline transforms one Session into a Session Result.
- Orchestrator coordinates a Visit across Sessions and produces a Visit Report.
- Stage is a pure algorithm unit inside a Pipeline.

Terms to avoid or retire in new code unless preserving compatibility:
- Subject -> use Participant.
- Trial -> resolve to Session, Task, or Repetition.
- Experiment for one participant folder -> use Visit.
- Direction without qualifier.
- Result without level qualifier when Session Result or Visit Report is meant.

## Current Roadmap Slices

The active architecture roadmap is P1-P5. Prefer these existing slice boundaries when implementing related work.

P1 - Pipeline / Orchestrator split:
- Introduce typed `FlickSessionResult`, `FatigueSessionResult`, `ConditionResult`, and `VisitReport`.
- Replace tuple returns and index-based access with named fields.
- Keep Pipeline at Session level and Orchestrator at Visit level.

P2 - Stage abstraction:
- Define or use a `Stage` Protocol for swappable algorithm units.
- Keep `Stage.run(input, config) -> output` pure, deterministic, and side-effect-free.
- Wrap the full segmentation strategy as a coarse `SegmentationStage` first; do not split into micro-stages without a concrete need.

P3 - Pipeline as named, versioned artifact:
- Treat Pipeline Preset and resolved configuration as provenance artifacts.
- Persist explicit resolved configuration alongside results so runs can be compared.

P4 - Channel Mapping in Preflight:
- Do Visit-level channel inspection before Pipeline execution.
- Store confirmed mapping as a Channel Mapping Artifact.
- Apply mapping deterministically inside Pipeline only after preflight succeeds.

P5 - Kinematics-only archetype boundary:
- Create Movement Archetype domain concepts separately from EMG analysis.
- Mark EMG pipeline boundaries so EMG does not infer behavioral archetype.

## Recommended Increment Patterns

For architecture refactors:
1. Add or adjust domain model with focused tests.
2. Add application contract/use case behavior with targeted tests.
3. Add infrastructure adapter only if the slice needs I/O.
4. Update interface entry point last.
5. Run the narrow test first, then the full pytest suite if the slice touches shared behavior.

For Pipeline/Orchestrator changes:
1. Add named result type.
2. Update one producer to return it.
3. Update one consumer to use named fields.
4. Add or update tests covering the changed producer-consumer path.
5. Repeat for the next producer or consumer.

For Stage work:
1. Define explicit input, output, and config types.
2. Extract configuration from `AppSettings` before calling the Stage.
3. Keep side effects in use cases, diagnostics ports, renderers, or interfaces.
4. Test the Stage with explicit config objects, not global settings.

For repository/I/O work:
1. Add repository behavior behind a narrow method.
2. Test validation and serialization separately from application orchestration.
3. Inject the repository into the use case rather than constructing it deep inside application logic.

## Verification Discipline

Run the smallest meaningful test after each increment.

Examples by area:
- C3D merge/resample: `tests/test_c3d_emg_merge_service.py`, `tests/test_csv_emg_resample_service.py`, `tests/test_c3d_analog_merge_service.py`
- Repositories: `tests/test_c3d_repository.py`, `tests/test_merge_input_repositories.py`
- Use case integration: `tests/test_combine_c3d_csv_use_case.py`, `tests/test_es_analysis_v1_feature_integration.py`
- Segmentation/feature logic: `tests/test_trigger_onset_service.py`, `tests/test_window_feature_service.py`, `tests/test_largeflick_batch_feature_smoke.py`

Before considering a multi-file change complete:
- Run targeted tests for the touched path.
- Run `poetry run pytest` when the change touches shared contracts, core settings, domain models, or orchestration.
- Note any tests not run and why.

## Scope Discipline For This Repo

Do not combine these in one increment:
- A domain terminology rename and a behavior change.
- A Pipeline/Orchestrator boundary change and GUI changes.
- A new Stage abstraction and a new segmentation algorithm.
- Repository serialization changes and domain model redesign.
- Documentation cleanup and code behavior changes.

When code uses legacy names such as `LargeFlick`, `Subject`, or `Trial`, preserve compatibility unless the current slice explicitly retires that term. If renaming is required, do it as a dedicated increment with tests covering import paths and public call sites.

## Commit Guidance

Commit boundaries should match the roadmap slice or the smallest independently revertable change:
- `Add FlickSessionResult return type`
- `Migrate fatigue pipeline to typed result`
- `Add segmentation stage config extraction`
- `Persist resolved pipeline configuration`
- `Add channel mapping artifact model`

Do not commit generated plots, temp outputs, cache files, or unrelated doc rewrites as part of implementation slices.
