# Runtime Bridge Consumers Governance

`runtimeBridgeConsumers` is the S5 home for read-only consumer and view-model adapter contracts.

This folder is intentionally separate from `runtimeBridge`. Runtime Bridge remains metadata-only. Consumer modules may read metadata and return deterministic view models, but they must not render UI, execute workflows, mutate navigation, persist state, call backend services, or orchestrate runtime behavior.

## Allowed

- Pure TypeScript types.
- Deterministic helper functions.
- Type-only Runtime Bridge references.
- Read-only consumer/view-model adapter contracts.
- Consumer modules marked with `kind: "consumer-readonly"`.

## Forbidden

- React, JSX, TSX components, and hooks.
- DOM, SVG, canvas, or chart rendering.
- Backend services, execution modules, export modules, persistence modules, or navigation mutation modules.
- Storage APIs, network APIs, timers, random IDs, current-time IDs, async IO, or filesystem scanning.
- Runtime Bridge value imports.

## Guardrail Check

`npm.cmd run governance:audit` scans this folder and hard-fails examples such as:

```ts
import React from "react";
```

```ts
import { runtimeBridgeGovernanceSnapshot } from "../runtimeBridge";
```

```ts
const id = Math.random();
```

Runtime Bridge imports must be type-only:

```ts
import type { RuntimeBridgeGovernanceSnapshot } from "../runtimeBridge";
```

