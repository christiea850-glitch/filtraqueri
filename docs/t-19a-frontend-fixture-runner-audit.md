# T-19A Frontend Fixture Runner Audit

## Scope

This audit reviews the current frontend test and fixture infrastructure and recommends the safest way to execute FiltraQueri's existing exported fixture modules. It is documentation-only. No dependencies, package scripts, runtime code, SQL behavior, Insert behavior, Run Query behavior, backend/API behavior, or fixture code were changed.

## Files Inspected

- `frontend/package.json`
- root `package.json`
- `frontend/tsconfig.json`
- `frontend/tsconfig.app.json`
- `frontend/tsconfig.node.json`
- `frontend/vite.config.ts`
- `frontend/scripts/audit-governance-boundaries.mjs`
- `frontend/scripts/governance-boundary-rules.mjs`
- `frontend/src/features/analyst/sql/__tests__`
- `frontend/package-lock.json`
- `frontend/node_modules/.bin`
- root `node_modules/.bin`

## Current Test Infrastructure Status

`frontend/package.json` has these scripts:

- `dev`
- `build`
- `governance:audit`
- `lint`
- `preview`

There is no `test` script, no fixture script, and no configured Vitest/Jest runner.

Installed frontend binaries include Vite, TypeScript, ESLint, and supporting tools. They do not include `vitest`, `jest`, `tsx`, or `ts-node` as runnable binaries. `npm.cmd ls tsx vitest jest ts-node --depth=4` reports an empty dependency tree. `frontend/package-lock.json` mentions `tsx` only as an optional dependency entry under another package, not as an installed project runner.

The TypeScript config uses project references:

- `tsconfig.app.json` includes `src`, uses `moduleResolution: "bundler"`, and has `noEmit: true`.
- `tsconfig.node.json` includes only `vite.config.ts` and also has `noEmit: true`.

`npm.cmd run build` type-checks the source tree and bundles the app through Vite, but it does not execute fixture functions.

The governance audit script is a source scanner. It reads and parses source files using Node, but it does not execute TypeScript modules or fixture exports.

## Fixture Module Inventory

The SQL fixture folder currently contains these modules:

- `adaptiveProposalBusinessSqlBridge.test.ts`
- `adaptiveProposalBusinessSqlBridgeUiAdapter.test.ts`
- `adaptiveProposalBusinessSqlPreviewHandoff.test.ts`
- `adaptiveProposalLlmAuditSnapshot.test.ts`
- `adaptiveProposalLlmConsent.test.ts`
- `adaptiveProposalLlmConsentDisclosure.test.ts`
- `adaptiveProposalLlmConsentShell.test.ts`
- `adaptiveProposalLlmPayloadBuilder.test.ts`
- `adaptiveProposalLlmProviderGate.test.ts`
- `adaptiveProposalLlmRefinement.test.ts`
- `adaptiveProposalLlmValidator.test.ts`
- `adaptiveReportProposal.test.ts`
- `adaptiveReportProposalUiAdapter.test.ts`
- `businessIntentGrounding.test.ts`
- `businessSqlJoinPathResolver.test.ts`
- `businessSqlQueryPlan.test.ts`
- `businessSqlQueryPlanner.test.ts`
- `businessSqlRenderPreview.test.ts`
- `businessSqlRenderPreviewUiAdapter.test.ts`
- `businessSqlRenderReadiness.test.ts`
- `businessSqlRenderer.test.ts`
- `resolveSqlTabSourceContext.test.ts`
- `resultLabeling.test.ts`
- `resultNarration.test.ts`
- `semanticHintRegistry.test.ts`
- `sqlAdaptiveFitClassifier.test.ts`
- `sqlAskFiltraQueriAdapter.test.ts`
- `sqlCandidateGrounding.test.ts`
- `sqlDialectDraftConversion.test.ts`
- `sqlDialectExecutionGuidance.test.ts`
- `sqlErrorFormatter.test.ts`
- `sqlReportRuntimeBadges.test.ts`
- `sqlResultProvenance.test.ts`
- `sqlSingleTableTemplateAdapter.test.ts`
- `sqlSourceLineAdapter.test.ts`
- `sqlStaticSyntaxDiagnostics.test.ts`
- `sqlTemplateAdaptiveMetadata.test.ts`
- `sqlTemplateRecommender.test.ts`
- `sqlTemplateRuntimeBadges.test.ts`
- `sqlWorksheetScopeAdapter.test.ts`
- `useSqlWorkspacePreviewResult.test.ts`

Most modules export a `run...Fixtures()` function returning a report with `results`, `passed`, and `failed`. Several also export a boolean pass constant. The modules are written as pure fixture runners, not test-framework suites.

Representative examples:

- `sqlAskFiltraQueriAdapter.test.ts` explicitly documents that it is a pure runner with no Run Query, Monaco/editor mutation, backend/API, execution, source resolution, worksheet scope mutation, provider, or preview handoff behavior.
- `adaptiveProposalLlmProviderGate.test.ts` explicitly documents no provider calls, SQL generation, SQL rendering, Monaco insertion, Run Query, backend/API, or execution behavior.
- `useSqlWorkspacePreviewResult.test.ts` tests preview-state builders without mounting the React hook or invoking backend execution.

## Are Fixtures Executable Today?

Not through an existing project command.

The fixture modules are structurally executable because they export pure runner functions. However, they cannot be run directly with plain Node in the current setup because:

- The source files are TypeScript.
- Imports are extensionless and rely on `moduleResolution: "bundler"`.
- `tsconfig.app.json` uses `noEmit: true`, so there is no emitted JS test tree.
- Vite build outputs an application bundle, not fixture modules.
- No direct TS runner such as `tsx` or `ts-node` is installed as a project binary.

Node 25 has TypeScript stripping capabilities, but plain Node still does not resolve the project's extensionless TypeScript imports the same way Vite/TypeScript bundler resolution does. A runner needs either Vite's module loader, a TS runner, or a test framework.

## Pure And Safe Fixture Candidates

The existing SQL fixture modules are good candidates for a pure fixture runner when they follow the `run...Fixtures()` report pattern and do not mount React components or touch browser APIs.

Safe first-pass candidates:

- Ask/model fixtures: `sqlAskFiltraQueriAdapter.test.ts`
- Single-table adapter: `sqlSingleTableTemplateAdapter.test.ts`
- Adaptive metadata/classifier: `sqlTemplateAdaptiveMetadata.test.ts`, `sqlAdaptiveFitClassifier.test.ts`
- Template/recommender/runtime badges: `sqlTemplateRecommender.test.ts`, `sqlTemplateRuntimeBadges.test.ts`, `sqlReportRuntimeBadges.test.ts`
- Relationship/planning model-adjacent fixtures: `businessSqlJoinPathResolver.test.ts`, `businessSqlQueryPlan.test.ts`, `businessSqlQueryPlanner.test.ts`, `businessSqlRenderer.test.ts`, `businessSqlRenderPreview.test.ts`, `businessSqlRenderPreviewUiAdapter.test.ts`, `businessSqlRenderReadiness.test.ts`
- Result presentation: `resultLabeling.test.ts`, `resultNarration.test.ts`, `sqlResultProvenance.test.ts`, `useSqlWorkspacePreviewResult.test.ts`
- SQL helpers: `sqlSourceLineAdapter.test.ts`, `sqlWorksheetScopeAdapter.test.ts`, `sqlStaticSyntaxDiagnostics.test.ts`, `sqlErrorFormatter.test.ts`, `sqlDialectExecutionGuidance.test.ts`, `sqlDialectDraftConversion.test.ts`
- Adaptive proposal and governance-style fixtures: `adaptiveReportProposal*.test.ts`, `adaptiveProposalLlm*.test.ts`, `adaptiveProposalBusinessSql*.test.ts`, `semanticHintRegistry.test.ts`, `businessIntentGrounding.test.ts`

Type-check-only for now:

- Component click/back/state-preservation tests for `SqlWorkspace` and `SqlEditorPanel`. These need a DOM-capable component test harness, such as Vitest plus React Testing Library and jsdom, or an end-to-end/browser runner. The current pure fixture pattern cannot prove DOM rendering, click navigation, or React state preservation.

## Options Considered

### 1. No Dependency, Build-Output Runner

Strict build-output execution is not viable today. TypeScript is configured with `noEmit: true`, and Vite build creates an app bundle rather than per-fixture JS modules. There is no build artifact that cleanly exposes the fixture modules for Node execution.

A better no-new-dependency variant is a Vite SSR fixture runner script. Because Vite is already installed and already understands the project source graph, a Node `.mjs` script can create a Vite server in middleware/custom mode, call `server.ssrLoadModule()` for selected fixture modules, execute their exported `run...Fixtures()` functions, print pass/fail totals, and close the server. This avoids new dependencies and respects the existing bundler resolution model.

Pros:

- No dependency installation.
- Works with extensionless TypeScript imports.
- Can run the existing exported fixture functions without converting them to Vitest/Jest tests.
- Keeps runtime app behavior unchanged.

Risks:

- It uses Vite as a source-module loader, not production build output.
- It may need an explicit allowlist so accidental component/browser fixtures are not executed in Node.
- It is less familiar than Vitest for developers expecting standard test output.

### 2. `tsx`-Based Runner

Adding `tsx` would allow a simple Node-style TypeScript runner. However, `tsx` is not currently installed as a project dependency or binary. It would require a dependency change.

Pros:

- Simple runner script.
- Good fit for pure TypeScript fixtures.

Risks:

- Requires adding a dependency.
- Still needs verification that extensionless imports and bundler resolution behave correctly for this project.

### 3. Vitest

Vitest is the natural long-term test framework for a Vite React app. Existing fixture functions could be wrapped in `test.each` or a fixture sweep test. Component tests could later use React Testing Library and jsdom.

Pros:

- Standard Vite-native test runner.
- Good future path for component and DOM tests.
- CI-friendly reporting.

Risks:

- Requires dependency additions.
- Would require decisions about environment (`node` for pure fixtures, `jsdom` for components).
- More setup than needed for the immediate fixture sweep.

### 4. Jest

Jest could run tests, but it is not aligned with the current Vite setup and would require more transform/config work for ESM, TypeScript, and React.

Pros:

- Mature ecosystem.

Risks:

- Requires dependency additions.
- More configuration overhead than Vitest.
- Higher chance of divergence from Vite module semantics.

### 5. Leave As Build-Only

This preserves the current state: `npm.cmd run build` type-checks fixture modules but never executes pass/fail assertions.

Pros:

- No work, no dependencies, no behavior changes.

Risks:

- Fixture pass/fail claims remain unaudited.
- Regression-catching value is limited to type errors.
- Existing `run...Fixtures()` work remains underused.

## Recommendation

Use a no-new-dependency Vite SSR fixture runner first.

The safest path is:

1. Add a script file that uses the installed Vite module loader to import an explicit allowlist of pure SQL fixture modules.
2. Execute only exported functions named in the allowlist.
3. Require each runner to return a report with `failed`.
4. Print per-module pass/fail counts and a total.
5. Exit nonzero if any fixture fails or if a runner export is missing.
6. Keep component/UI click tests out of this runner until a DOM-capable test framework is approved.

This gives real fixture execution without adding dependencies or changing app runtime behavior. It also leaves the door open for Vitest later.

## Proposed Next Slices

### T-19B: Add No-Runtime-Change Fixture Runner Script

- Add `frontend/scripts/run-sql-fixtures.mjs`.
- Use Vite's existing module loader.
- Hardcode a small allowlist first.
- No `package.json` changes yet.
- Run by direct command only, for example `node scripts/run-sql-fixtures.mjs`.

### T-19C: Wire Selected SQL Fixtures Into Runner

- Expand the allowlist to core pure fixtures:
  - Ask adapter
  - single-table adapter
  - adaptive metadata/classifier
  - relationship/planning model fixtures
  - result labeling/narration/provenance
- Keep component/detail-view DOM assertions out of scope.

### T-19D: Add NPM Script

- Add a script such as `fixtures:sql`.
- Optionally add `test` only if the team wants fixture execution to become the default test command.

### T-19E: CI/Governance Audit Integration

- Decide whether fixture execution belongs in CI, governance audit, or a separate local verification command.
- Keep governance source-boundary scanning separate from fixture execution unless CI needs a single aggregate command.

## Risks And Guardrails

- Do not auto-discover and execute every file in `__tests__` at first. Use an allowlist so only known-pure modules run.
- Do not execute component or browser-dependent tests in the Node fixture runner.
- Do not add provider, backend/API, SQL execution, Run Query, or Monaco/editor side effects to fixtures.
- Keep fixture reports deterministic and synchronous unless a fixture explicitly needs async support.
- Keep build/type-check as a separate verification step; fixture execution does not replace `npm.cmd run build`.

## Conclusion

The project already has substantial pure fixture coverage, but it lacks an execution harness. The lowest-risk next step is a Vite-powered no-new-dependency runner with an explicit allowlist. Vitest is the best longer-term test framework once dependency changes are approved, especially for React component and detail-view navigation tests.
