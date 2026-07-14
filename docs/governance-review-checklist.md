# Governance Review Checklist

Use this checklist when reviewing FiltraQueri changes that touch intelligence, runtime metadata, continuations, presentation surfaces, or execution-adjacent modules.

## Advisory Modules

- Advisory modules do not call `executeWorkspaceQuery`.
- Advisory modules do not import export controllers or backend services.
- Advisory modules do not mutate `ResultState`, `ActiveResultModel`, result tabs, workbook state, route state, or runtime persistence.
- Advisory outputs are deterministic and evidence-based.
- Advisory outputs remain recommendations, summaries, diagnostics, readiness, explanations, plans, continuations, or lineage references.

## Metadata-Only Modules

- Metadata-only modules do not execute, schedule, replay, persist, or mutate workspace state.
- `runtimeIntelligence` does not import React hooks, execution owners, persistence modules, backend services, export controllers, or dataset/session restore controllers.
- Runtime graph nodes, edges, artifacts, confidence, events, and continuations remain serializable metadata.

## Continuations

- Continuation metadata does not contain callbacks, handlers, executable function fields, dispatchers, or hidden action triggers.
- Continuations describe possible next steps, evidence, target views, and reasons only.
- Continuations do not include backend payloads ready for automatic dispatch.

## Presentational Components

- Presentational components do not import backend services directly.
- Presentational components receive callbacks from composition or executable owners.
- Presentational components do not decide whether advisory recommendations become executable actions.

## Protected Surfaces

Confirm these remain untouched unless the phase explicitly approves them:

- `executeWorkspaceQuery`
- `ResultsGrid`
- `ActiveResultModel`
- `useResultExecutionCoordinator`
- export execution
- SQL/Monaco behavior
- dataset/session/workbook restore
- runtime persistence
- `App.tsx` routing and mode switching
- backend route handlers

## No Authentication Yet

FiltraQueri currently has no login or authentication feature. Until an explicit authentication and persistence slice is approved:

- Avoid implementing or describing features as account-owned, cloud-persistent, collaborative, or user-secured.
- Treat saved drafts, query history, relationship confirmations, settings, and workspace state as local or session-scoped only.
- Do not imply durable user identity, shared workspaces, team access, cloud sync, account recovery, or secured user storage in UI copy, docs, fixtures, or plans.
- Keep T-13 renderer and manual-insert work unblocked, but preserve this boundary when adding provenance, saved-query behavior, or any future persistence copy.

## Hybrid And Allowlist Review

- Hybrid allowlists stay narrow and path-specific.
- New allowlist entries explain why the module is hybrid.
- Broad allowlists such as all of `features/execution`, `features/dataset`, `services/api`, or `workspaceRuntime` are avoided.
- Type-only imports from protected domains are distinguished from runtime imports where possible.

## Commands

Run the warning-only governance audit:

```sh
npm run governance:audit
```

The audit is warning-only during S2-C2. Warnings should be reviewed, but they do not fail the build.
