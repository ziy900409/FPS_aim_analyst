# T3 segmentation sweep

This notebook-side script keeps parameter sweeps, file output, and plotting outside
`algorithms/`. From `research/` run:

```powershell
uv run python src/modules/segments/notebooks/t3-sweep/run_sweep.py
```

That deterministically rewrites `outputs/synthetic-boundary-errors.csv`. A row passes only when
all six registered synthetic cases have the expected segment count/kinds, every known boundary is
within two ticks, zero/constant motion expose their expected result flags, and the close double
peak is not fragmented.

After an anonymized real export is available, run:

```powershell
uv run python src/modules/segments/notebooks/t3-sweep/run_sweep.py --real-export fixtures/exports/<file>.json
```

The real-data path writes `real-segmentation-summary.csv`, `real-peek-segments.csv`, and one
`real-peek-*-overlay.svg` per visible-event window. These files are the pending M14 validation
evidence; synthetic output must not be presented as a substitute.
