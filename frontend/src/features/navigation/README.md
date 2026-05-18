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
