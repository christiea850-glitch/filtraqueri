/**
 * T-14C - Ask FiltraQueri interaction and preview visibility fixtures.
 *
 * Pure fixture runner only. No Run Query, Monaco/editor mutation, backend/API,
 * execution, source resolution, worksheet scope, Business SQL contract, adaptive
 * proposal, provider, or preview handoff behavior.
 */

import type { BusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type { WorkbookMetadata, WorksheetMetadata } from "../../../workbook";
import {
  ASK_FILTRAQUERI_BUTTON_LABEL,
  ADVANCED_PLANNING_DETAILS_COPY,
  ADVANCED_PLANNING_DETAILS_LABEL,
  BUSINESS_SQL_PREVIEW_IDLE_COPY,
  BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_HELPER,
  BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_TITLE,
  ASK_RECOMMENDATION_ALREADY_INSERTED_COPY,
  createBusinessSqlPreviewVisibilityModel,
  createSqlAskRecommendationInsertModel,
  createSqlAskFiltraQueriModel,
  createSqlAskFiltraQueriSuggestionModel,
  shouldSubmitSqlAskFiltraQueriKey,
} from "../sqlAskFiltraQueriAdapter";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlAskFiltraQueriAdapterFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

const column = (
  name: string,
  inferred_type: SchemaColumn["inferred_type"] = "text",
): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "number" : "string",
  inferred_type,
  null_count: 0,
  unique_count: inferred_type === "categorical" ? 3 : 10,
  sample_values: [],
});

const worksheet = (
  worksheetId: string,
  displayName: string,
  tableName: string,
  schema: SchemaColumn[],
): WorksheetMetadata => ({
  worksheetId,
  workbookId: "workbook:ask-fixture",
  sheetName: displayName,
  displayName,
  tableName,
  originalIndex: 0,
  status: "ready",
  schema,
  rowCount: 25,
  columnCount: schema.length,
  visibleColumns: schema.map((item) => item.name),
  hiddenColumns: [],
  normalization: {
    version: 1,
    normalizedAt: "2026-01-01T00:00:00.000Z",
    headerRowIndex: null,
    skippedLeadingRows: null,
    headerDetectionStrategy: null,
    headerDetectionConfidence: null,
    headerDetectionWarning: null,
    originalFirstRowPreview: null,
    selectedHeaderRowPreview: null,
    structuralColumnCandidates: [],
    structuralColumnDetectionWarning: null,
    structuralColumnDetectionConfidence: null,
    structuralColumnSampleSize: null,
    recommendedHiddenColumns: [],
    duplicateColumnCount: 0,
    emptyColumnCount: 0,
    warnings: [],
    templateStructureCandidate: false,
    templateStructureConfidence: "low",
    templateStructureEvidence: [],
  },
});

const leasesWorksheet = worksheet("worksheet:leases", "leases", "leases", [
  column("lease_id"),
  column("status", "categorical"),
  column("monthly_rent", "numeric"),
]);

const managersWorksheet = worksheet("worksheet:managers", "managers", "managers", [
  column("manager_id"),
  column("manager_name", "categorical"),
  column("email"),
  column("phone"),
]);

const workbook = (): WorkbookMetadata => ({
  workbookId: "workbook:ask-fixture",
  workspaceId: null,
  name: "Property Management Company.xlsx",
  status: "ready",
  sourceFile: {
    originalFilename: "Property Management Company.xlsx",
    storedPath: null,
    mimeType: null,
    byteSize: null,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  },
  worksheetIds: [leasesWorksheet.worksheetId, managersWorksheet.worksheetId],
  activeWorksheetId: leasesWorksheet.worksheetId,
  activeAnalysisSource: {
    type: "original",
    worksheetId: leasesWorksheet.worksheetId,
    tableName: leasesWorksheet.tableName,
    originalTableName: leasesWorksheet.tableName,
    activatedAt: "2026-01-01T00:00:00.000Z",
  },
  cleanedWorkingCopies: [],
  worksheets: [leasesWorksheet, managersWorksheet],
  tableMappings: [],
  relationshipCandidates: [],
  acceptedRelationshipContracts: [],
  ingestionProfile: {
    maxWorksheets: 50,
    maxRowsPerWorksheetProfile: 1000,
    maxColumnsPerWorksheet: 200,
    maxRelationshipSampleRows: 1000,
    maxPreviewRows: 100,
    profilingStrategy: "metadata-only",
  },
  normalization: {
    version: 1,
    normalizedAt: "2026-01-01T00:00:00.000Z",
    status: "normalized",
    warnings: [],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const dataset = (): DatasetMetadata => ({
  dataset_id: "dataset:ask-fixture",
  filename: "Property Management Company.xlsx",
  original_filename: "Property Management Company.xlsx",
  table_name: leasesWorksheet.tableName,
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: leasesWorksheet.rowCount,
  column_count: leasesWorksheet.columnCount,
  schema: leasesWorksheet.schema,
  workbook_metadata: workbook(),
});

const failedPreview: BusinessSqlRenderPreview = {
  planId: "plan:needs-details",
  title: "Business SQL preview not ready",
  status: "needs_review",
  body: "Plan support must be supported before rendering.",
  sql: null,
  reasons: [
    "Plan support must be supported before rendering.",
    "Plan must include a metric.",
  ],
  warnings: ["Plan status must be resolved before rendering."],
  rendererTarget: "duckdb",
  guidanceDialect: "duckdb",
  actions: {
    canCopySql: false,
    canInsertSql: false,
    canRunSql: false,
  },
};

const readyPreview: BusinessSqlRenderPreview = {
  planId: "plan:ready",
  title: "Business SQL preview ready",
  status: "ready",
  body: "Preview SQL is ready.",
  sql: 'SELECT status, COUNT(*) AS lease_count FROM "leases" GROUP BY status;',
  reasons: [],
  warnings: [],
  rendererTarget: "duckdb",
  guidanceDialect: "duckdb",
  actions: {
    canCopySql: true,
    canInsertSql: false,
    canRunSql: false,
  },
};

const expectNoBehaviorChange = (model: {
  noRunQuery: true;
  noBackendCall: true;
  noEditorMutation: true;
}): string[] => [
  ...(model.noRunQuery === true ? [] : ["Ask must not call Run Query."]),
  ...(model.noBackendCall === true ? [] : ["Ask must not call backend/API."]),
  ...(model.noEditorMutation === true ? [] : ["Ask must not mutate the editor draft."]),
];

const expectNoInsertSideEffects = (model: {
  noRunQuery: true;
  noBackendCall: true;
}): string[] => [
  ...(model.noRunQuery === true ? [] : ["Insert must not call Run Query."]),
  ...(model.noBackendCall === true ? [] : ["Insert must not call backend/API."]),
];

const fixtures: Fixture[] = [
  {
    name: "Ask FiltraQueri input model exposes visible button label",
    assert: () => {
      const model = createSqlAskFiltraQueriModel("Count leases by status");
      return [
        ...(model.buttonLabel === ASK_FILTRAQUERI_BUTTON_LABEL
          ? []
          : ["Expected visible Ask FiltraQueri button label."]),
        ...(model.buttonLabel === "Ask FiltraQueri"
          ? []
          : [`Expected Ask FiltraQueri label, received ${model.buttonLabel}.`]),
        ...(model.canSubmit ? [] : ["Expected non-empty prompt to enable Ask."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask button stays disabled for empty prompt",
    assert: () => {
      const model = createSqlAskFiltraQueriModel("   ");
      return [
        ...(model.canSubmit ? ["Expected empty prompt to disable Ask."] : []),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Enter submits Ask when prompt has text",
    assert: () => [
      ...(shouldSubmitSqlAskFiltraQueriKey({
        key: "Enter",
        prompt: "Count leases by status",
      })
        ? []
        : ["Expected Enter to submit Ask for a non-empty prompt."]),
    ],
  },
  {
    name: "Shift Enter does not submit Ask",
    assert: () => [
      ...(shouldSubmitSqlAskFiltraQueriKey({
        key: "Enter",
        shiftKey: true,
        prompt: "Count leases by status",
      })
        ? ["Expected Shift+Enter to avoid submitting Ask."]
        : []),
    ],
  },
  {
    name: "Ask and Enter do not imply Run Query",
    assert: () => {
      const model = createSqlAskFiltraQueriModel("Count leases by status");
      const enterSubmits = shouldSubmitSqlAskFiltraQueriKey({
        key: "Enter",
        prompt: model.prompt,
      });
      return [
        ...(enterSubmits ? [] : ["Expected Enter to submit the Ask action."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask reuses deterministic template recommendation flow",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });

      return [
        ...(model.recommendations.length > 0
          ? []
          : ["Expected deterministic template recommendations after Ask."]),
        ...(model.recommendations.some((recommendation) => /count|summary|status/i.test(recommendation.title))
          ? []
          : [`Expected count/status recommendation, received ${model.recommendations.map((item) => item.title).join(", ")}.`]),
        ...(model.guidanceTitle === "Suggested template"
          ? []
          : [`Expected suggested-template guidance, received ${model.guidanceTitle}.`]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask recommendation exposes Insert into editor for deterministic SQL",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const insertState = model.recommendations[0]
        ? createSqlAskRecommendationInsertModel(model.recommendations[0])
        : null;

      return [
        ...(insertState ? [] : ["Expected an insertable recommendation fixture."]),
        ...(insertState?.buttonLabel === "Insert into editor"
          ? []
          : ["Expected Insert into editor button label."]),
        ...(insertState?.canInsert ? [] : ["Expected deterministic SQL recommendation to be insertable."]),
        ...(insertState?.sql ? [] : ["Expected insert state to expose SQL for insertion."]),
        ...(insertState ? expectNoInsertSideEffects(insertState) : []),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask insert uses existing append-safe metadata shape",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const recommendation = model.recommendations[0];
      if (!recommendation) return ["Expected recommendation fixture."];
      const insertState = createSqlAskRecommendationInsertModel(recommendation);
      const metadata = {
        id: recommendation.id,
        label: recommendation.title,
        createdFrom: recommendation.kind,
      };

      return [
        ...(insertState.canInsert ? [] : ["Expected insert state to allow existing insert path."]),
        ...(metadata.createdFrom === "template" || metadata.createdFrom === "report"
          ? []
          : ["Expected existing template/report insert metadata shape."]),
        ...(metadata.label === recommendation.title ? [] : ["Expected insert label to preserve recommendation title."]),
        ...(insertState.sql === recommendation.sql ? [] : ["Expected inserted SQL to come from recommendation SQL."]),
        ...expectNoInsertSideEffects(insertState),
      ];
    },
  },
  {
    name: "Ask keeps multiple recommendations visible for comparison",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });

      return [
        ...(model.recommendations.length > 1
          ? []
          : [`Expected multiple visible recommendations, received ${model.recommendations.length}.`]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask disables other recommendation inserts after one is inserted",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const selected = model.recommendations[0];
      const other = model.recommendations[1];
      if (!selected || !other) return ["Expected at least two recommendations."];
      const activeSqlDraft = selected.sql;
      const selectedState = createSqlAskRecommendationInsertModel(selected, {
        activeSqlDraft,
        insertedAskRecommendationId: selected.id,
      });
      const otherState = createSqlAskRecommendationInsertModel(other, {
        activeSqlDraft,
        insertedAskRecommendationId: selected.id,
      });

      return [
        ...(selectedState.isInsertedRecommendation
          ? []
          : ["Expected selected recommendation to be marked inserted."]),
        ...(selectedState.canInsert ? ["Inserted recommendation button should be disabled."] : []),
        ...(otherState.canInsert ? ["Other Ask recommendation insert should be disabled."] : []),
        ...(otherState.disabledReason === ASK_RECOMMENDATION_ALREADY_INSERTED_COPY
          ? []
          : ["Expected one-suggestion-already-inserted helper copy."]),
        ...expectNoInsertSideEffects(selectedState),
        ...expectNoInsertSideEffects(otherState),
      ];
    },
  },
  {
    name: "Ask does not append into pre-existing editor draft by default",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const recommendation = model.recommendations[0];
      if (!recommendation) return ["Expected recommendation fixture."];
      const insertState = createSqlAskRecommendationInsertModel(recommendation, {
        activeSqlDraft: 'SELECT * FROM "leases";',
        insertedAskRecommendationId: null,
      });

      return [
        ...(insertState.canInsert ? ["Ask insert must be guarded when editor already has SQL."] : []),
        ...(insertState.disabledReason === ASK_RECOMMENDATION_ALREADY_INSERTED_COPY
          ? []
          : ["Expected clear/new-tab helper for pre-existing draft."]),
        ...expectNoInsertSideEffects(insertState),
      ];
    },
  },
  {
    name: "non-insertable Ask recommendation stays disabled with user-facing reason",
    assert: () => {
      const insertState = createSqlAskRecommendationInsertModel({ id: "empty", sql: "   " });

      return [
        ...(insertState.canInsert ? ["Expected empty SQL suggestion to be disabled."] : []),
        ...(insertState.sql === null ? [] : ["Disabled insert must not expose SQL."]),
        ...(insertState.disabledReason === "No safe SQL is available for this suggestion yet."
          ? []
          : ["Expected user-facing disabled insert reason."]),
        ...expectNoInsertSideEffects(insertState),
      ];
    },
  },
  {
    name: "Ask surfaces relevant worksheet guidance",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Show manager email and phone contacts",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });

      return [
        ...(model.scopeRecommendations.some((recommendation) => recommendation.tableName === "managers")
          ? []
          : [`Expected managers worksheet guidance, received ${model.scopeRecommendations.map((item) => item.tableName).join(", ")}.`]),
        ...(model.guidanceCopy.includes("managers") || model.scopeRecommendations.length > 0
          ? []
          : ["Expected needed/relevant table guidance."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask with no safe suggestion uses friendly needs-details guidance",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "florbnicate the unknowable",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });

      return [
        ...(model.recommendations.length === 0 ? [] : ["Expected no template suggestion."]),
        ...(model.scopeRecommendations.length === 0 ? [] : ["Expected no worksheet suggestion."]),
        ...(model.guidanceTitle === BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_TITLE
          ? []
          : ["Expected friendly needs-details guidance."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Business SQL preview panel is hidden before Ask attempt",
    assert: () => {
      const model = createBusinessSqlPreviewVisibilityModel({
        hasPreviewAttempt: false,
        prompt: "Count leases by status",
        preview: failedPreview,
      });

      return [
        ...(model.shouldShowPanel ? ["Preview panel must stay hidden before Ask."] : []),
        ...(model.shouldShowDefaultPreviewPanel ? ["Default preview panel must stay hidden before Ask."] : []),
        ...(model.shouldShowAdvancedPlanningDetails ? ["Advanced details must stay hidden before Ask."] : []),
        ...(model.shouldShowIdleCopy ? [] : ["Expected quiet no-preview copy before Ask."]),
        ...(BUSINESS_SQL_PREVIEW_IDLE_COPY.includes("Ask FiltraQueri")
          ? []
          : ["Idle copy should direct the user to Ask FiltraQueri."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "non-ready Business SQL diagnostics are collapsed by default after Ask",
    assert: () => {
      const model = createBusinessSqlPreviewVisibilityModel({
        hasPreviewAttempt: true,
        prompt: "tickets per account",
        preview: failedPreview,
      });

      return [
        ...(model.shouldShowPanel ? [] : ["Expected preview content to remain available."]),
        ...(model.shouldShowDefaultPreviewPanel
          ? ["Non-ready Business SQL Preview must not show in default flow."]
          : []),
        ...(model.shouldShowAdvancedPlanningDetails
          ? []
          : ["Expected non-ready preview diagnostics behind advanced details."]),
        ...(model.advancedDetailsLabel === ADVANCED_PLANNING_DETAILS_LABEL
          ? []
          : ["Expected Advanced planning details disclosure label."]),
        ...(model.advancedDetailsCopy === ADVANCED_PLANNING_DETAILS_COPY
          ? []
          : ["Expected quiet advanced planning note."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "failed preview attempt shows user-facing guidance without technical reasons",
    assert: () => {
      const model = createBusinessSqlPreviewVisibilityModel({
        hasPreviewAttempt: true,
        prompt: "tickets per account",
        preview: failedPreview,
      });

      return [
        ...(model.shouldShowPanel ? [] : ["Expected preview panel after Ask attempt."]),
        ...(model.shouldShowDefaultPreviewPanel
          ? ["Failed preview must not show as default Business SQL Preview panel."]
          : []),
        ...(model.shouldShowAdvancedPlanningDetails
          ? []
          : ["Failed preview diagnostics should be available in collapsed details."]),
        ...(model.failureTitle === BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_TITLE
          ? []
          : ["Expected user-facing failure title."]),
        ...(model.failureHelper === BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_HELPER
          ? []
          : ["Expected user-facing failure helper."]),
        ...(model.shouldShowTechnicalReasons
          ? ["Technical planner reasons must not be shown prominently."]
          : []),
        ...(model.failureTitle?.includes("Plan support must be supported")
          ? ["Failure title must not expose raw planner wording."]
          : []),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "ready preview attempt shows panel without failure copy",
    assert: () => {
      const model = createBusinessSqlPreviewVisibilityModel({
        hasPreviewAttempt: true,
        prompt: "Count leases by status",
        preview: readyPreview,
      });

      return [
        ...(model.shouldShowPanel ? [] : ["Expected ready preview panel after Ask."]),
        ...(model.shouldShowDefaultPreviewPanel ? [] : ["Ready preview should stay visible by default."]),
        ...(model.shouldShowAdvancedPlanningDetails ? ["Ready preview must not require advanced details."] : []),
        ...(model.failureTitle === null ? [] : ["Ready preview must not show failure title."]),
        ...(model.failureHelper === null ? [] : ["Ready preview must not show failure helper."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
];

export function runSqlAskFiltraQueriAdapterFixtures(): SqlAskFiltraQueriAdapterFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const allSqlAskFiltraQueriAdapterFixturesPass = (): boolean =>
  runSqlAskFiltraQueriAdapterFixtures().failed.length === 0;
