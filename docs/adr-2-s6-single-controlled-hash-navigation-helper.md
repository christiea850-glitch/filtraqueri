# ADR-2: Single Controlled Hash Navigation Helper

Status: accepted, implemented in S6-B

## Context

Results insight detail and Dataset intelligence detail currently use staged hash-backed navigation locally. That is acceptable for the first two proof flows, but adding more local `globalThis.history`, `hashchange`, or `popstate` handling would duplicate behavior and weaken route governance.

S6-B extracts `frontend/src/features/navigation/controlledHashDetailHelper.ts` without migrating App ownership or creating a global route controller.

## Decision

After S6-B, only `controlledHashDetailHelper.ts` may touch `globalThis.history`, `hashchange`, and `popstate` for controlled detail navigation.

The former local proof surfaces now call the helper instead of owning hash/history behavior directly.

## Consequences

- New routed detail flows must wait for the helper extraction.
- Workspace routing must not bypass the helper.
- The helper must remain controlled and narrow; it must not become a global router, deep-link restoration engine, persistence engine, or App ownership migration.
