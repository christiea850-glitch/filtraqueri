# UX-F23 Workbook Relationship Intelligence

## Goal

UX-F23 adds a presentation-only workbook intelligence layer so multi-sheet Excel uploads read more like connected business datasets. It infers likely worksheet relationships, business roles, and starting points without changing workbook data, execution logic, exports, or query request shapes.

## Preserved Systems

- `executeWorkspaceQuery`
- Query Builder request shapes and filtering/grouping behavior
- `ActiveResultModel` and `ResultsGrid`
- Monaco editor behavior and SQL draft restore
- workbook/session restore and workbook switching
- exports, pagination, routing, and back behavior
- Human/Analyst switching
- upload/session persistence, continuation wrappers, and runtime persistence

## Implementation

New feature area:

- `frontend/src/features/workbookIntelligence/workbookRelationshipTypes.ts`
- `frontend/src/features/workbookIntelligence/workbookRelationshipInference.ts`

The layer is deterministic and advisory. It reads existing workbook metadata and worksheet schema samples, then returns a Human Mode summary contract with:

- relationship candidates
- confidence scoring
- inferred worksheet roles
- business-language connection guidance
- workbook complexity level
- recommended starting sheet
- future graph metadata nodes and edges

No joins are executed, no source columns are rewritten, and no workbook structures are mutated.

## Inference Rules

Relationship signals are inferred from:

- shared normalized field names such as `customer_id`, `CustomerId`, `CUSTOMER ID`, and `customer-id`
- compatible field types
- ID-like field names such as invoice, order, customer, product, manager, reference, SKU, and code fields
- sampled value overlap across sheets
- uniqueness similarity and row coverage consistency

Worksheet roles are inferred from sheet names and column language. Supported advisory roles are:

- customers
- orders
- invoices
- products
- employees
- managers
- transactions
- inventory
- payments
- regions
- unknown

## Confidence Model

Confidence levels are `high`, `medium`, and `low`.

The score favors exact normalized field-name matches, overlapping sampled values, identifier patterns, compatible field types, uniqueness similarity, and consistent row coverage. Scores are intentionally conservative and only inform Human Mode guidance.

## Human Mode Surface

The Data page now includes a compact Workbook Connections panel when a ready workbook has multiple sheets. It shows:

- number of likely related sheets
- detected business entities
- recommended starting sheet
- up to three likely sheet connections in business language

The surface stays flat and compact, following the canonical hierarchy: page context first, primary data task second, relationship guidance as supporting detail.

## Future Graph Readiness

The intelligence contract includes graph metadata:

- worksheet nodes with inferred roles and shape information
- relationship edges with confidence, source/target fields, and relationship type

No graph renderer is included in UX-F23.

## Manual Validation Checklist

- Upload or restore a multi-sheet workbook.
- Confirm the Data page shows workbook connection guidance.
- Confirm worksheet switching still works.
- Confirm Results exports still use original datasets.
- Confirm Query Builder filtering and grouping still use original columns.
- Confirm Analyst Mode, Monaco restore, and SQL execution remain unchanged.
- Confirm browser routing and back behavior remain unchanged.
- Confirm there is no horizontal overflow on Data, Build, Results, or Analyst workspaces.
