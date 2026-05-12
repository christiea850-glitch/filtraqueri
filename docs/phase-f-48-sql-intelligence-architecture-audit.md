# Phase F-48 SQL Intelligence & Analytics Architecture Audit

## Current Readiness

FiltraQueri is ready for a SQL intelligence layer if it is introduced as a separate feature boundary. The existing SQL Workspace already has an editor host, schema suggestions, keyword help, and dataset-aware templates. SQL execution is still intentionally a placeholder that wraps output through the shared execution contract, so a future real SQL path can be added without rewriting Results, Export CSV, pagination, workspace orchestration, or the active result model.

The safest integration point is before execution:

1. SQL Workspace captures user intent and SQL draft.
2. SQL intelligence validates, explains, or translates the draft without mutating results.
3. Execution Pipeline receives only executable DuckDB SQL or an existing wrapped placeholder.
4. Execution Registry records the execution result.
5. Active Result Model remains the UI read layer.

## Missing Layers

The app is missing these dedicated SQL intelligence layers:

- Dialect metadata for DuckDB, MariaDB, and Oracle.
- Function compatibility tables for string, numeric, date, aggregate, and conditional functions.
- A parser/normalizer boundary for safe query inspection.
- A dialect translator that can adapt known syntax into DuckDB-compatible SQL.
- A validator that reports beginner-friendly and advanced diagnostics separately from execution.
- A deterministic explainer for SQL concepts and query structure.
- Query Builder to SQL serialization.
- SQL to Query Builder explanation and partial mapping.
- Business question templates that map common questions to safe query patterns.
- Future AI adapter interfaces that consume structured context but do not execute or mutate state.

## Recommended Module Structure

Place the foundation under `frontend/src/features/sqlIntelligence/`:

- `types.ts`: dialect ids, SQL AST-ish metadata, validation findings, explanations, translation results, business question types.
- `dialects/duckdb.ts`: DuckDB executable syntax, quoting, functions, supported joins, date syntax, limits.
- `dialects/mariadb.ts`: MariaDB syntax profile, function aliases, LIMIT behavior, date formatting notes.
- `dialects/oracle.ts`: Oracle syntax profile, function aliases, ROWNUM/FETCH handling, date formatting notes.
- `dialects/index.ts`: dialect registry and lookup helpers.
- `concepts/`: deterministic SQL concept cards for joins, grouping, HAVING, CASE, aliases, functions.
- `templates/`: dataset-aware SQL templates, eventually replacing the local SQL Workspace template logic.
- `validator/`: read-only validation and warnings; no execution calls.
- `translator/`: dialect adaptation into DuckDB SQL; no UI state and no active result mutation.
- `explainer/`: deterministic query explanations and concept breakdowns.
- `businessQuestions/`: question-to-template mappings for beginner analytics flows.
- `adapters/monaco.ts`: completion/hover payloads for Monaco.
- `adapters/queryBuilder.ts`: Query Builder to SQL and SQL explanation back to builder concepts.
- `adapters/execution.ts`: prepares translated SQL metadata for the execution pipeline.
- `adapters/ai.ts`: future AI input/output contracts only, with no provider calls.

Keep UI components as renderers. They should receive suggestions, findings, explanations, and translated SQL from hooks/controllers, not own dialect rules.

## Dialect Support Strategy

DuckDB should remain the internal execution dialect. MariaDB and Oracle support should be adaptation layers, not alternate execution engines.

- MariaDB input: accept common functions such as `LENGTH`, `SUBSTRING`, `INSTR`, `LPAD`, `RPAD`, `REPLACE`, `ROUND`, `TRUNCATE`, `CEIL`, `FLOOR`, `DATE_FORMAT`, `LIMIT`.
- Oracle input: accept concepts such as `LENGTH`, `SUBSTR`, `INSTR`, `LPAD`, `RPAD`, `REPLACE`, `ROUND`, `TRUNC`, `CEIL`, `FLOOR`, `TO_CHAR`, `FETCH FIRST`, and Oracle-style date formatting.
- DuckDB output: translate only known safe patterns into DuckDB-compatible SQL. Unknown or ambiguous syntax should produce a validation finding, not a guess.

Important function differences:

- `TRUNC` vs `TRUNCATE`: Oracle commonly uses `TRUNC` for numbers and dates. MariaDB commonly uses `TRUNCATE(number, decimals)`. DuckDB support must be verified per function category before execution.
- `SUBSTRING` vs `SUBSTR`: treat as dialect aliases where semantics match.
- Date formatting tokens differ heavily between MariaDB, Oracle, and DuckDB. Keep a token compatibility table rather than string replacing blindly.
- Right and full joins should be validated against DuckDB support before translation. If a rewrite is needed later, it belongs in the translator, not the UI.

## SQL Concepts Coverage

Create deterministic concept entries for:

- Inner join, left outer join, right outer join, full outer join.
- Single-row functions.
- String functions: `LENGTH`, `SUBSTRING`/`SUBSTR`, `INSTR`, `LPAD`, `RPAD`, `REPLACE`.
- Numeric functions: `ROUND`, `TRUNC`/`TRUNCATE`, `CEIL`, `FLOOR`.
- Nested functions and expression order.
- Date functions and date formatting.
- Filtering with `WHERE`.
- Grouping with `GROUP BY`.
- Aggregate functions and aliases.
- `HAVING` after aggregation.
- Sorting with `ORDER BY`.
- `CASE WHEN`.
- Business-question-to-query patterns.

These concepts can power beginner help, Monaco hover text, explain panels, and future AI grounding without coupling to execution.

## Beginner User Support

Beginner support should be deterministic first:

- Offer business question templates such as "top categories", "monthly trend", "missing values", "compare groups", and "filtered summary".
- Generate SQL from structured templates using the active dataset schema.
- Explain each query in plain language before execution.
- Show validation findings as guidance, not raw database errors when possible.
- Keep Query Builder as the safest no-code path.

Natural language to SQL should later be an adapter that returns a proposed structured intent and SQL draft. It should not execute automatically.

## Advanced User Support

Advanced users need control and transparency:

- Let users write raw SQL.
- Show the selected source dialect and translated DuckDB SQL separately.
- Preserve advanced constructs when DuckDB supports them.
- Surface precise validation diagnostics with function, clause, and dialect context.
- Keep SQL execution opt-in and never silently rewrite destructive or unsupported statements into something else.

## Safe Connections

- SQL Workspace: owns editor state and user actions only.
- Monaco: receives completions, hovers, diagnostics, and snippets through `sqlIntelligence/adapters/monaco`.
- Query Builder: serializes to SQL through `sqlIntelligence/adapters/queryBuilder`; SQL-to-builder should explain compatibility, not force state changes.
- Execution Pipeline: receives translated DuckDB SQL plus source dialect metadata. It should not call AI.
- Active Result Model: read-only consumer for analytics guidance and business insights.
- Dataset Registry: supplies dataset identity and schema context.
- Workspace Orchestration: coordinates selected dataset, execution, registry, and result links.
- Future AI Insight layer: reads active result, dataset schema, SQL explanation, and execution history; writes suggestions or drafts, not active results.

## Guardrails

- No SQL intelligence logic in `App.tsx`.
- No dialect logic inside UI components.
- No AI calls inside the execution pipeline.
- No direct mutation of the active result model.
- No change to existing DuckDB execution or placeholder behavior until a dedicated execution phase.
- Dialect translation must happen before execution.
- Explanations must be separate from execution.
- Business insights must read from the active result model and never mutate it.
- Unsupported syntax should produce findings, not speculative rewrites.
- Query Builder state should change only through existing Query Builder controllers.

## Phased Implementation Plan

1. Add `sqlIntelligence` types, dialect registry, concept registry, and deterministic function compatibility tables.
2. Move existing SQL keyword help, schema suggestions, and templates behind SQL intelligence adapters without changing UI.
3. Add deterministic validation findings for SELECT-only safety, known functions, joins, aliases, grouping, HAVING, sorting, and LIMIT/FETCH patterns.
4. Add Query Builder to SQL serialization and SQL explanation back to Query Builder concepts.
5. Add dialect translation for a small safe subset: identifiers, limits, aliases, string functions, numeric functions, date formatting warnings.
6. Connect translated DuckDB SQL to real SQL execution through the existing execution pipeline.
7. Add beginner business-question templates that generate SQL drafts, not auto-executed results.
8. Add future AI adapter contracts after deterministic validation/explanation exists.

## Future AI Path

The app can become AI-intelligent later by grounding AI in structured artifacts:

- Dataset registry schema and lineage.
- Active result model rows, columns, filters, grouping, sorting, and export source.
- Execution registry history.
- SQL intelligence validation findings and dialect metadata.
- Workspace orchestration links.

AI should propose explanations, corrections, query drafts, or business questions. Execution should remain explicit and should still flow through dialect validation, translation, the execution pipeline, the registry, and the active result model.
