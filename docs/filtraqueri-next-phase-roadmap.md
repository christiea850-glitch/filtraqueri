# FiltraQueri Recommended Next Phase Roadmap

## Roadmap Principles

Future phases should prioritize:

- behavior preservation
- deterministic metadata before execution
- explicit user approval before generation or orchestration
- immutable lineage before replay
- backend/frontend contract alignment before new engines
- small UI surfaces rather than dashboards

## Phase R1: Runtime Graph Snapshot Bridge

Goal: create a read-only graph snapshot builder that maps current workspace metadata into UX-F28 contracts.

Scope:

- dataset node
- workbook node
- active result node
- query/filter node references
- narrative node
- investigation node
- analysis package node
- runtime continuation references

No UI, no persistence, no execution.

Success criteria:

- stable graph JSON for current workspace
- no changes to ResultsGrid, ActiveResultModel, routing, query execution, exports, or SQL workspace
- targeted unit tests for graph shape

## Phase R2: Runtime Graph Validation And Governance

Goal: validate graph snapshots before persistence.

Scope:

- schema validation
- stale reference detection
- metadata size limits
- deterministic ID checks
- event immutability checks

No graph UI yet.

## Phase R3: Immutable Metadata Persistence Design

Goal: design where runtime graph, events, and artifact snapshots are stored.

Scope:

- manifest extension proposal
- backend persistence options
- migration/versioning strategy
- retention and pruning policy
- audit export format

Implementation should wait until the design is reviewed.

## Phase R4: Export And Artifact Job Architecture

Goal: prepare package generation and large exports safely.

Scope:

- async export job contracts
- streaming CSV design
- artifact handles
- package manifest to artifact job mapping
- explicit user approval flow

Do not raise export caps before this phase.

## Phase R5: SQL Execution Architecture

Goal: decide how Analyst SQL should execute safely against DuckDB.

Scope:

- SQL safety contract
- result pagination for SQL output
- execution registry integration
- draft persistence preservation
- Monaco independence
- backend endpoint design

No automatic SQL execution.

## Phase R6: Optimization Metadata Contracts

Goal: define optimization problem metadata before any solver.

Scope:

- objective, decision variables, constraints
- input data lineage
- feasibility confidence
- validation references
- expected artifact snapshots

No solver execution.

## Phase R7: Forecasting Metadata Contracts

Goal: define forecast readiness and problem metadata.

Scope:

- date/metric validation
- grain/horizon/seasonality metadata
- forecast confidence
- lineage references
- result artifact shape

No forecast execution.

## Phase R8: Executive Memory Archive

Goal: preserve approved narrative/investigation/package snapshots.

Scope:

- archive artifact schema
- approval metadata
- retention policy
- review UI concept
- governance audit references

No AI generation required.

## Phase R9: Agentic Boundary Specification

Goal: define how future AI/agentic systems may plan without unsafe execution.

Scope:

- allowed advisory actions
- prohibited autonomous actions
- approval gates
- dry-run only planning
- audit log requirements
- rollback/replay safety

No agentic execution.

## Recommended Immediate Next Phase

Start with R1: Runtime Graph Snapshot Bridge. It validates UX-F28 without changing visible behavior and gives reviewers a concrete graph artifact to inspect.
