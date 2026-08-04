# FPS Aim Analyst research layer

Python 3.12 offline analysis for committed schema v2 exports. The engine and this layer remain
one-way isolated: `research/` consumes export JSON/CSV and committed golden/parity fixtures, while
`src/` may only consume committed golden/parity JSON. Code under `algorithms/` must not plot,
print, or write files; rendering and output belong under `notebooks/`.

## Verification

From this directory:

```powershell
uv run pytest
```

The Python gate is intentionally independent from the engine's `npm run test:ci`. Cross-language
drift is checked by committed parity/golden JSON in the engine gate.

## Fixtures

- Committed real exports must be at most 30 seconds (about 3,840 ticks at 128 Hz).
- `meta.session.participantId` must be anonymized before commit.
- Longer exports stay local and must not be committed.
- Synthetic exports unlock development but do not replace M14's real-data evidence.

Fixtures live in `fixtures/exports/`; cross-language files live in `fixtures/parity/` and
`fixtures/golden/`.

## Parameter registry

Submovement parameters will be pre-registered and versioned in
[`docs/operational/analysis-segments.md`](../docs/operational/analysis-segments.md) at WP-28 exit.
