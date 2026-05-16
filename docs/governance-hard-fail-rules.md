# Governance Hard-Fail Rules

## Purpose

S2-C3 upgrades the governance boundary audit from warning-only reporting to a narrow hard-fail model for high-confidence advisory and metadata-only violations.

This remains lint-only governance. It does not add runtime assertions, wrappers, execution guards, route guards, persistence writes, or UI behavior changes.

## What Fails

The governance audit exits with code `1` only when it finds one or more hard-fail errors.

Hard-fail categories:

- `advisory-import-backend-execution`
  - advisory modules importing `executeWorkspaceQuery`
  - advisory modules importing `src/services/api`
- `metadata-only-import-execution`
  - `runtimeIntelligence` importing execution owners, export owners, dataset execution controllers, SQL workspace execution, or backend services
- `metadata-only-import-persistence`
  - `runtimeIntelligence` importing workspace persistence, runtime persistence, SQL workspace persistence, dataset sessions, or investigation workspace storage
- `continuation-callback-field`
  - continuation metadata files containing callback/function-style fields such as `callback`, `handler`, `onRun`, `onExecute`, `execute`, `run`, `dispatch`, `mutation`, or `effect`

## What Remains Warnings

Warning-only categories:

- `presentational-import-backend-or-executable`
  - presentational components importing backend services or executable owners
- `advisory-import-executable`
  - advisory modules importing non-backend executable owners that still need review
- `metadata-only-import-react-hook`
  - `runtimeIntelligence` importing React hooks
- broad architectural smell warnings
- hybrid composition concerns

Warnings do not fail the command during S2-C3.

## Why Runtime Assertions Are Avoided

Runtime assertions would add behavior inside the application. That is intentionally avoided because the protected surfaces are sensitive:

- query execution timing
- result mutation and activation
- grid rendering
- export downloads
- SQL/Monaco draft behavior
- workbook/session restore
- runtime persistence

S2-C3 protects boundaries by inspecting source imports and metadata shapes before runtime, not by changing how the app runs.

## Why Lint-Only Governance Is Safer Now

FiltraQueri has legitimate hybrid modules, including `App.tsx`, workspace runtime coordination, dataset restore coordination, SQL workspace behavior, and result execution coordination. Static checks can warn or fail on high-confidence boundary violations without wrapping those modules or changing state update order.

The safest path is:

1. keep executable owners untouched
2. fail only high-confidence advisory and metadata-only violations
3. keep hybrid and presentational concerns warning-only
4. tune allowlists narrowly before adding any broader enforcement

## Output Format

The audit reports warnings and errors separately:

```text
Governance boundary audit

WARN:
- presentational-import-backend-or-executable: ...

ERROR:
- metadata-only-import-execution: ...

SUMMARY:
1 warnings, 1 errors
```

Exit behavior:

- `0` when there are warnings only
- `1` when one or more errors are present
