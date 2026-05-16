# FiltraQueri Runtime Readiness Review

## Runtime Foundation State

FiltraQueri has two runtime layers:

- `workspaceRuntime`: current UI-facing runtime context, trail, guidance, continuation metadata, and localStorage persistence.
- `runtimeIntelligence`: UX-F28 canonical graph foundation with runtime node, edge, artifact, event, continuation, and confidence contracts.

This separation is healthy for now. `workspaceRuntime` keeps the current product usable. `runtimeIntelligence` establishes future governance contracts without visible behavior changes.

## Replay Readiness

Status: medium-low.

Ready:

- execution records exist in frontend execution registry
- workspace manifests persist selected metadata
- runtime graph contracts include `replayed_from`
- runtime event contracts include `replayed`

Missing:

- durable runtime event store
- full result artifact snapshots
- backend replay endpoints
- deterministic replay inputs for every execution source
- replay UI and approval model

Recommended next step: build a read-only replay manifest spec before implementing replay.

## Lineage Graph Readiness

Status: medium.

Ready:

- runtime node and edge contracts
- node families for dataset, workbook, query, result, narrative, optimization, forecast, scenario, recommendation, validation, export, investigation
- edge types for derived/generated/recommended/validated/continued/replayed/supersedes
- narrative runtime node integration
- investigation session runtime references

Missing:

- graph snapshot builder for the whole workspace
- persistence layer
- graph validation
- graph visualization
- backend alignment

Recommended next step: add a read-only graph snapshot builder that consumes current active workspace metadata and emits canonical graph JSON.

## Continuation Orchestration Readiness

Status: medium.

Ready:

- workspace runtime continuations for current UI
- UX-F28 continuation contracts for optimize, forecast, investigate, monitor, compare, rerun, explain, export
- investigation session continuation references

Missing:

- continuation permission model
- continuation-to-action mapper
- execution-neutral guardrails in tests
- orchestration history

Recommended next step: define continuation governance before mapping continuations to actions.

## Optimization Intelligence Readiness

Status: low-medium.

Ready:

- runtime node family includes optimization
- artifact kind includes optimization summary
- deliverable hub can reference optimization outputs
- planning layers can support future analysis recommendations

Missing:

- optimization input contract
- objective/constraint schema
- solver selection
- result validation
- backend execution engine
- UI boundary for proposed versus executed optimization

Recommended next step: add optimization metadata contracts only, then audit before execution.

## Forecasting Intelligence Readiness

Status: low.

Ready:

- runtime node family includes forecast
- continuation category includes forecast
- data intelligence can detect date/metric readiness

Missing:

- forecast problem contract
- time-series validation
- seasonality/horizon metadata
- backend engine
- result confidence model

Recommended next step: define forecast readiness metadata and validation rules.

## Executive Memory Readiness

Status: medium.

Ready:

- narrative reports
- investigation workspace sessions
- analysis package manifests
- runtime artifact snapshots
- confidence and event metadata contracts

Missing:

- durable executive memory store
- versioned narrative snapshots
- user approval/archive flow
- governance review model

Recommended next step: define immutable memory artifact schema and retention policy.

## Agentic Planning Readiness

Status: low-medium.

Ready:

- advisory-only contracts
- explicit metadata/execution separation
- runtime continuation categories
- confidence weakest-link metadata
- investigation and package lineage references

Missing:

- permission model
- tool/action registry
- dry-run planner
- approval gates
- rollback/replay controls
- audit log persistence

Recommended next step: write an agentic boundaries specification before introducing any planner.

## Runtime Readiness Conclusion

The runtime foundation is well-shaped for governance and lineage but should remain non-executable until graph persistence, event immutability, explicit permissioning, and replay safety are designed.
