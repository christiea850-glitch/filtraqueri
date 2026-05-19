# Navigation Governance

`features/navigation` is the S5 skeleton for future route hierarchy, route registry, context preservation, and back-behavior ownership.

This phase does not migrate current routing. `App.tsx` remains behaviorally unchanged. Existing Human/Analyst mode switching, upload/session restore, SQL workspace, Monaco, Query Builder, Results pagination, export behavior, and ActiveResultModel behavior remain owned by their current modules.

## Scope

This folder may define:

- route hierarchy types
- route registry metadata
- back-behavior contracts
- navigation context preservation contracts
- navigation origin and back-state preservation contracts
- pure TypeScript helpers for future navigation planning

## Governance Rules

- Runtime Bridge must not import navigation.
- Runtime Bridge Consumers must not mutate or own navigation behavior.
- Consumers and renderers should request navigation through future governed navigation APIs, not mutate routes directly.
- Navigation must not import Runtime Bridge implementation modules.
- Navigation must not execute queries, persist sessions, render UI, call backend APIs, export data, or own workspace runtime behavior.

## Current Status

The current application routing remains in place. This folder is infrastructure only and has no visible UI behavior.

## Preservation Infrastructure

S5-2C adds typed preservation metadata for:

- origin surface id
- source and target route references
- dataset, session, workbook, worksheet, mode, and active result context
- filter state references
- pagination state references
- expanded or collapsed panel references
- selected result or item references

The preservation registry is metadata/contracts only. It does not create a global state manager, does not persist anything, does not use storage APIs, and does not activate browser deep-link restoration. Future routing systems may consume these contracts later.

Consumers and renderers should not mutate preservation state directly. Runtime Bridge must remain separate from navigation and preservation ownership.

## Integrity Assertions

S5-2E adds metadata-level integrity assertions for:

- origin restoration
- dataset, session, workbook, and worksheet continuity
- mode continuity
- pagination preservation
- filter preservation
- expanded-panel preservation
- selected-result preservation

These assertions describe expectations only. They do not control routing, do not create a persistence engine, do not introduce global state, and do not execute navigation behavior. Future navigation systems may consume the assertions when routed detail pages and deep-link restoration are activated.

## Controlled Routed Detail Activation

S5-3A activates the Results insight detail flow through a controlled hash route. S5-3C activates the Dataset intelligence detail flow through the same staged pattern. These are the only active routed detail flows.

This is not a global routing migration. `App.tsx` still owns the current view composition, workspace routing is not active, and the activation metadata remains tied to the existing preservation and integrity descriptors.

Future routed systems should remain staged and should not infer that all detail pages or workspaces are route-backed yet.

## Route Activation Integrity

S5-3B adds metadata-level checks that compare controlled routed detail activations against:

- route registry entries
- preservation registry entries
- integrity assertion references
- allowed route scope
- preservation scope compatibility
- activation ownership metadata

These checks do not activate or deactivate routes, do not own routing execution, and do not introduce persistence or orchestration. They exist so future routed systems can verify governance linkage before more detail flows are activated.

## Controlled Hash Detail Helper

S6-B centralizes controlled detail hash behavior in `controlledHashDetailHelper.ts`. This helper owns the narrow operations required by the two active routed detail flows:

- read the current controlled detail hash
- open a controlled detail hash
- close a controlled detail hash
- subscribe to `hashchange` and `popstate` for controlled detail synchronization
- verify the route is backed by existing routed detail activation metadata

The helper is not a global router, route controller, deep-link restoration engine, persistence engine, workspace routing system, or `App.tsx` ownership migration. New hash/history listeners should not be added outside this helper.

## Route Governance Reporting

S5-3D adds metadata-only reporting for routed detail activation coverage. The reporting layer summarizes:

- active routed detail flows
- inactive routed detail route candidates
- preservation linkage coverage
- integrity assertion coverage
- route ownership coverage
- unsupported or partially linked activation states
- future activation readiness

The reporting layer is governance observability only. It does not render UI, does not control routing execution, does not mutate activation metadata, does not persist telemetry, and does not infer that workspace routing is active. Future workspace systems may consume these summaries later, but workspace routing remains inactive.
