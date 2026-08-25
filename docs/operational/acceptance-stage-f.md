# Acceptance Checklist F — Stage6 Assessment Framework v1

All checks below are verified by `npm run test:ci` on 2026-08-25.

| # | Acceptance condition | Evidence | Status |
|---:|---|---|---|
| 1 | Assessment/practice contract is closed | `assessmentContract.ts`, `compatibilityKey.test.ts` | ✅ |
| 2 | Shared event timestamps are consistent; exclusive events do not leak | `stage6-cross-family-consistency.test.ts` | ✅ |
| 3 | Hold-click visibility is geometry-derived | `visibilityDerivation.test.ts`, `holdClickMetrics.test.ts` | ✅ |
| 4 | Hold-track stop window is distinct from fire timing | `holdTrackWindowInvariant.test.ts` | ✅ |
| 5 | Spider Shot preserves transition direction, D and W geometry | `spiderShotConditions.test.ts`, `spiderShotMetrics.test.ts` | ✅ |
| 6 | Counterstrafe protocols expose stratified measures, no composite score | `counterstrafeMetrics.test.ts` | ✅ |
| 7 | Assessment and practice cannot share a formal baseline | `pilotConfigs.test.ts`, `sessionHistory.test.ts` | ✅ |
| 8 | Compatibility-key changes reject historical comparison | `compatibilityKey.test.ts`, `sessionHistory.test.ts` | ✅ |
| 9 | Diagnosis presents source, n, flags and a version | `diagnosisRules.test.ts`, `ResultScreen.test.ts` | ✅ |
| 10 | Quality failure short-circuits diagnosis | `diagnosisRules.test.ts` | ✅ |
| 11 | Pilot parameters remain separate from formal constants | `pilotConfigs.test.ts`, `protocolFreeze.test.ts` | ✅ |
| 12 | Formal release is versioned and reproducible | `protocolVersion.ts`, `protocolFreeze.test.ts` | ✅ |
