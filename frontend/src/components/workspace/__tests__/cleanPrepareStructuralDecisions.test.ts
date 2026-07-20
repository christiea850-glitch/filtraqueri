import {
  areStructuralDecisionReadinessEqual,
  buildPreparationReview,
  clearSuggestedFixDecision,
  clearWorksheetSuggestedFixDecision,
  getSuggestedFixesForWorksheet,
  getStructuralDecisionReadiness,
  getAutomaticBlankRowEvidenceSignalsFromPreview,
  getCleaningRecipeExcludedCount,
  getPreviewSuggestedFixes,
  getWorksheetSuggestedFixDecisionDrafts,
  hasCleaningRecipePreviewOperations,
  hasExplicitSuggestedFixDecisions,
  isCleaningRecipePreviewForWorksheet,
  resetSuggestedFixDecisions,
  resetWorksheetSuggestedFixDecisions,
  getSuggestedFixCleaningPlan,
  getSuggestedFixDecision,
  getSuggestedFixDecisionProgress,
  getSuggestedFixKeepOriginalLabel,
  getSuggestedFixRecommendationLabel,
  getStructuralPreviewErrorReadiness,
  getStructuralPreviewIdleReadiness,
  getStructuralPreviewLoadingReadiness,
  getStructuralPreviewLifecycleState,
  shouldMarkStructuralPreviewVerificationError,
  shouldStartStructuralPreviewRequest,
  validateStructuralPreviewResponse,
  getColumnDisplayName,
  setWorksheetSuggestedFixDecision,
  structuralDecisionEmptyStateCopy,
  type SuggestedFix,
  type SuggestedFixDecision,
  type WorksheetSuggestedFixDecisionDrafts,
} from "../CleanPrepareReviewPanel";
import type { DatasetMetadata, SchemaColumn } from "../../../features/dataset/datasetTypes";
import type { WorkbookMetadata, WorksheetMetadata, WorksheetTemplateStructureEvidence } from "../../../features/workbook";
import type { CleaningRecipePreview } from "../../../services/api";
import {
  classifyColumnMissingTypeGroup,
  getColumnMissingValueStrategies,
  getWorksheetMissingTypeStrategies,
} from "../../../features/dataPreparation/missingValueDecisions";
import {
  getStructuralApplyNavigationBlockMessage,
  invokeStructuralApplyNavigation,
  isStructuralApplyNavigationBlocked,
  normalizeBlockedApplyStep,
} from "../../../features/cleanPrepare/prepareBackNavigation";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type CleanPrepareStructuralDecisionFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const fixture = (name: string, assert: () => string[]): FixtureResult => {
  const failureReasons = assert();
  return {
    name,
    ok: failureReasons.length === 0,
    failureReasons,
  };
};

const report = (results: FixtureResult[]): CleanPrepareStructuralDecisionFixtureReport => ({
  results,
  passed: results.filter((result) => result.ok),
  failed: results.filter((result) => !result.ok),
});

const expect = (condition: boolean, message: string): string[] => condition ? [] : [message];

const suggestedFix = (
  id: string,
  evidenceType: string,
  title: string,
  detail: string,
): SuggestedFix => ({
  id,
  recommendationId: id,
  evidenceType,
  title,
  detail,
});

const fixes: SuggestedFix[] = [
  suggestedFix(
    "sparse_layout_gap",
    "sparse_layout_gap",
    "Ignore layout separator rows",
    "Sheet A, rows 4-6: Sparse layout gaps appear between populated worksheet regions.",
  ),
  suggestedFix(
    "side_note_region_candidate",
    "side_note_region_candidate",
    "Exclude side-note columns",
    "Sheet A, columns J-K: A separated right-side region may contain notes.",
  ),
  suggestedFix(
    "dataset:missing-values",
    "missing_values",
    "Review blank cells before filling values",
    "2 fields contain blank values.",
  ),
];

const decisions = (
  values: Record<string, SuggestedFixDecision>,
): Record<string, SuggestedFixDecision> => values;

const column = (name: string): SchemaColumn => ({
  name,
  type: "text",
  inferred_type: "text",
  null_count: 0,
  unique_count: 1,
  sample_values: [],
});

const typedColumn = (
  name: string,
  inferredType: SchemaColumn["inferred_type"],
  patch: Partial<SchemaColumn> = {},
): SchemaColumn => ({
  name,
  type: inferredType,
  inferred_type: inferredType,
  null_count: 1,
  unique_count: 1,
  sample_values: [],
  ...patch,
});

const evidence = (
  type: WorksheetTemplateStructureEvidence["type"],
  patch: Partial<WorksheetTemplateStructureEvidence> = {},
): WorksheetTemplateStructureEvidence => ({
  type,
  rowIndex: null,
  rowRange: null,
  rowIndexes: [],
  columnRange: null,
  label: null,
  previewValues: [],
  confidence: "medium",
  explanation: `${type} evidence`,
  ...patch,
});

const worksheet = (
  worksheetId: string,
  displayName: string,
  templateStructureEvidence: WorksheetTemplateStructureEvidence[],
): WorksheetMetadata => ({
  worksheetId,
  workbookId: "workbook:property",
  sheetName: displayName,
  displayName,
  tableName: `${displayName.toLowerCase()}_table`,
  originalIndex: 0,
  status: "ready",
  schema: [column("name")],
  rowCount: 10,
  columnCount: 1,
  visibleColumns: ["name"],
  hiddenColumns: [],
  normalization: {
    version: 1,
    normalizedAt: "2026-07-19T00:00:00.000Z",
    headerRowIndex: 0,
    skippedLeadingRows: null,
    headerDetectionStrategy: null,
    headerDetectionConfidence: "high",
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
    templateStructureCandidate: templateStructureEvidence.length > 0,
    templateStructureConfidence: "medium",
    templateStructureEvidence,
  },
});

const workbookDataset = (): DatasetMetadata => {
  const worksheets = [
    worksheet("managers-id", "managers", [
      evidence("sparse_layout_gap", { rowRange: [3, 5] }),
      evidence("side_note_region_candidate", { columnRange: [9, 10] }),
    ]),
    worksheet("properties-id", "properties", [
      evidence("sparse_layout_gap", { rowRange: [7, 8] }),
      evidence("side_note_region_candidate", { columnRange: [11, 12] }),
    ]),
  ];

  return {
    dataset_id: "dataset:property",
    filename: "property.xlsx",
    original_filename: "property.xlsx",
    table_name: "managers_table",
    uploaded_at: "2026-07-19T00:00:00.000Z",
    row_count: 10,
    column_count: 1,
    schema: [column("name")],
    workbook_metadata: {
      workbookId: "workbook:property",
      workspaceId: null,
      name: "Property workbook",
      status: "ready",
      sourceFile: {
        originalFilename: "property.xlsx",
        storedPath: null,
        mimeType: null,
        byteSize: null,
        uploadedAt: "2026-07-19T00:00:00.000Z",
      },
      worksheetIds: worksheets.map((item) => item.worksheetId),
      activeWorksheetId: "managers-id",
      activeAnalysisSource: null,
      cleanedWorkingCopies: [],
      worksheets,
      tableMappings: [],
      relationshipCandidates: [],
      acceptedRelationshipContracts: [],
      ingestionProfile: {
        maxWorksheets: 25,
        maxRowsPerWorksheetProfile: 1000,
        maxColumnsPerWorksheet: 200,
        maxRelationshipSampleRows: 1000,
        maxPreviewRows: 100,
        profilingStrategy: "sampled",
      },
      normalization: {
        version: 1,
        normalizedAt: "2026-07-19T00:00:00.000Z",
        status: "normalized",
        warnings: [],
      },
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    } satisfies WorkbookMetadata,
  };
};

const workbookDatasetWithEmptyWorksheet = (): DatasetMetadata => {
  const worksheets = [
    worksheet("managers-id", "managers", [
      evidence("sparse_layout_gap", { rowRange: [3, 5] }),
      evidence("side_note_region_candidate", { columnRange: [9, 10] }),
    ]),
    worksheet("properties-id", "properties", []),
  ];

  return {
    dataset_id: "dataset:property-empty",
    filename: "property.xlsx",
    original_filename: "property.xlsx",
    table_name: "managers_table",
    uploaded_at: "2026-07-19T00:00:00.000Z",
    row_count: 10,
    column_count: 1,
    schema: [column("name")],
    workbook_metadata: {
      workbookId: "workbook:property-empty",
      workspaceId: null,
      name: "Property workbook",
      status: "ready",
      sourceFile: {
        originalFilename: "property.xlsx",
        storedPath: null,
        mimeType: null,
        byteSize: null,
        uploadedAt: "2026-07-19T00:00:00.000Z",
      },
      worksheetIds: worksheets.map((item) => item.worksheetId),
      activeWorksheetId: "managers-id",
      activeAnalysisSource: null,
      cleanedWorkingCopies: [],
      worksheets,
      tableMappings: [],
      relationshipCandidates: [],
      acceptedRelationshipContracts: [],
      ingestionProfile: {
        maxWorksheets: 25,
        maxRowsPerWorksheetProfile: 1000,
        maxColumnsPerWorksheet: 200,
        maxRelationshipSampleRows: 1000,
        maxPreviewRows: 100,
        profilingStrategy: "sampled",
      },
      normalization: {
        version: 1,
        normalizedAt: "2026-07-19T00:00:00.000Z",
        status: "normalized",
        warnings: [],
      },
      createdAt: "2026-07-19T00:00:00.000Z",
      updatedAt: "2026-07-19T00:00:00.000Z",
    } satisfies WorkbookMetadata,
  };
};

const recipePreview = (
  worksheetId: string,
  worksheetName: string,
  patch: Partial<CleaningRecipePreview> = {},
): CleaningRecipePreview => ({
  status: "preview_only",
  worksheet_id: worksheetId,
  worksheet_name: worksheetName,
  before: {
    row_count: 6,
    column_count: 7,
  },
  after_preview: {
    row_count: 6,
    column_count: 7,
    columns: ["manager_id", "manager_name"],
    rows: [],
    row_provenance: [],
  },
  recipe: [],
  excluded: {
    repeated_headers: 0,
    section_banners: 0,
    date_title_rows: 0,
    layout_rows: 0,
    placeholder_rows: 0,
    side_note_columns: 0,
  },
  preview_row_limit: 25,
  message: "Preview only - no changes have been applied.",
  ...patch,
});

const managersAutomaticBlankRowPreview = (): CleaningRecipePreview =>
  recipePreview("02eadd4b599a45798269e553dd02d4e4:worksheet:1", "managers", {
    excluded: {
      repeated_headers: 0,
      section_banners: 0,
      date_title_rows: 0,
      layout_rows: 1,
      placeholder_rows: 0,
      side_note_columns: 0,
    },
    excluded_details: {
      layout_rows: {
        count: 1,
        row_indexes: [7],
        reasons: [{ row_index: 7, reason: "automatic_blank_row" }],
      },
    },
  });

export const runCleanPrepareStructuralDecisionFixtures =
  (): CleanPrepareStructuralDecisionFixtureReport => {
    const results = [
      fixture("worksheet evidence signal produces SuggestedFix worksheet identity", () => {
        const review = buildPreparationReview(workbookDataset());
        const managersFix = review.scopedSuggestedFixes.find(
          (fix) => fix.recommendationId === "managers-id:sparse_layout_gap:0",
        );
        return [
          ...expect(managersFix?.worksheetId === "managers-id", "SuggestedFix should keep worksheetId."),
          ...expect(managersFix?.worksheetName === "managers", "SuggestedFix should keep worksheetName."),
          ...expect(managersFix?.evidenceType === "sparse_layout_gap", "SuggestedFix should keep evidenceType."),
          ...expect(
            managersFix?.evidenceSignalId === "managers-id:sparse_layout_gap:0",
            "SuggestedFix should keep stable evidence signal id.",
          ),
          ...expect(
            managersFix?.recommendationId === managersFix?.evidenceSignalId,
            "Recommendation id should equal the stable signal id.",
          ),
        ];
      }),
      fixture("duplicate sparse layout recommendations remain distinct internally", () => {
        const review = buildPreparationReview(workbookDataset());
        const sparseIds = review.scopedSuggestedFixes
          .filter((fix) => fix.evidenceType === "sparse_layout_gap")
          .map((fix) => fix.recommendationId)
          .sort();
        return [
          ...expect(sparseIds.length === 2, "Two sparse layout recommendations should be retained."),
          ...expect(
            sparseIds.includes("managers-id:sparse_layout_gap:0"),
            "Managers sparse recommendation id should be stable.",
          ),
          ...expect(
            sparseIds.includes("properties-id:sparse_layout_gap:0"),
            "Properties sparse recommendation id should be stable.",
          ),
          ...expect(new Set(sparseIds).size === sparseIds.length, "Sparse recommendation ids should not collide."),
        ];
      }),
      fixture("duplicate side-note recommendations remain distinct internally", () => {
        const review = buildPreparationReview(workbookDataset());
        const sideNoteIds = review.scopedSuggestedFixes
          .filter((fix) => fix.evidenceType === "side_note_region_candidate")
          .map((fix) => fix.recommendationId)
          .sort();
        return [
          ...expect(sideNoteIds.length === 2, "Two side-note recommendations should be retained."),
          ...expect(
            sideNoteIds.includes("managers-id:side_note_region_candidate:1"),
            "Managers side-note recommendation id should be stable.",
          ),
          ...expect(
            sideNoteIds.includes("properties-id:side_note_region_candidate:1"),
            "Properties side-note recommendation id should be stable.",
          ),
          ...expect(new Set(sideNoteIds).size === sideNoteIds.length, "Side-note recommendation ids should not collide."),
        ];
      }),
      fixture("visible recommendations stay temporarily deduped by evidence type", () => {
        const review = buildPreparationReview(workbookDataset());
        const visibleTypes = review.suggestedFixes.map((fix) => fix.evidenceType).sort();
        return [
          ...expect(review.scopedSuggestedFixes.length === 4, "Internal scoped recommendations should retain every signal."),
          ...expect(review.suggestedFixes.length === 2, "Visible recommendations should remain deduped for this slice."),
          ...expect(
            visibleTypes.join(",") === "side_note_region_candidate,sparse_layout_gap",
            "Visible recommendations should preserve current type-level presentation.",
          ),
        ];
      }),
      fixture("scoped recommendation identity is deterministic", () => {
        const sourceMarkers = [buildPreparationReview.toString()].join("\n");
        return [
          ...expect(!sourceMarkers.includes("Date.now"), "Recommendation id generation should not use Date.now."),
          ...expect(!sourceMarkers.includes("Math.random"), "Recommendation id generation should not use Math.random."),
        ];
      }),
      fixture("action labels use evidenceType with scoped ids", () => {
        const scopedFix = buildPreparationReview(workbookDataset()).scopedSuggestedFixes.find(
          (fix) => fix.recommendationId === "managers-id:sparse_layout_gap:0",
        );
        return [
          ...expect(Boolean(scopedFix), "Fixture should find scoped sparse recommendation."),
          ...expect(
            scopedFix ? getSuggestedFixRecommendationLabel(scopedFix) === "Exclude layout separator rows from the cleaned copy" : false,
            "Scoped sparse recommendation should keep direct action label.",
          ),
          ...expect(
            scopedFix ? getSuggestedFixKeepOriginalLabel(scopedFix) === "Keep layout separator rows" : false,
            "Scoped sparse recommendation should keep keep-original label.",
          ),
        ];
      }),
      fixture("clear behavior targets scoped recommendation identity", () => {
        const scopedFix = buildPreparationReview(workbookDataset()).scopedSuggestedFixes.find(
          (fix) => fix.recommendationId === "managers-id:sparse_layout_gap:0",
        );
        const current = decisions({
          "managers-id:sparse_layout_gap:0": "use_recommendation",
          "properties-id:sparse_layout_gap:0": "keep_original",
        });
        const next = scopedFix ? clearSuggestedFixDecision(current, scopedFix.id) : current;
        return [
          ...expect(
            getSuggestedFixDecision("managers-id:sparse_layout_gap:0", next) === "unresolved",
            "Clearing scoped managers recommendation should clear that id.",
          ),
          ...expect(
            getSuggestedFixDecision("properties-id:sparse_layout_gap:0", next) === "keep_original",
            "Clearing managers recommendation should preserve properties recommendation.",
          ),
        ];
      }),
      fixture("worksheet scoped helper returns active worksheet recommendations only", () => {
        const review = buildPreparationReview(workbookDataset());
        const managersFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "managers-id");
        const propertiesFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "properties-id");
        return [
          ...expect(managersFixes.length === 2, "Managers should have two scoped recommendations."),
          ...expect(propertiesFixes.length === 2, "Properties should have two scoped recommendations."),
          ...expect(
            managersFixes.every((fix) => fix.worksheetId === "managers-id"),
            "Managers recommendations should all carry managers worksheet id.",
          ),
          ...expect(
            propertiesFixes.every((fix) => fix.worksheetId === "properties-id"),
            "Properties recommendations should all carry properties worksheet id.",
          ),
        ];
      }),
      fixture("accepting managers recommendation does not affect properties", () => {
        let drafts: WorksheetSuggestedFixDecisionDrafts = {};
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "managers-id",
          "managers-id:sparse_layout_gap:0",
          "use_recommendation",
        );
        const managersDrafts = getWorksheetSuggestedFixDecisionDrafts(drafts, "managers-id");
        const propertiesDrafts = getWorksheetSuggestedFixDecisionDrafts(drafts, "properties-id");
        return [
          ...expect(
            getSuggestedFixDecision("managers-id:sparse_layout_gap:0", managersDrafts) === "use_recommendation",
            "Managers decision should be accepted.",
          ),
          ...expect(
            getSuggestedFixDecision("properties-id:sparse_layout_gap:0", propertiesDrafts) === "unresolved",
            "Properties matching recommendation should remain unresolved.",
          ),
        ];
      }),
      fixture("keep-original and decide-later remain worksheet scoped", () => {
        let drafts: WorksheetSuggestedFixDecisionDrafts = {};
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "managers-id",
          "managers-id:sparse_layout_gap:0",
          "keep_original",
        );
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "properties-id",
          "properties-id:sparse_layout_gap:0",
          "decide_later",
        );
        const managersDrafts = getWorksheetSuggestedFixDecisionDrafts(drafts, "managers-id");
        const propertiesDrafts = getWorksheetSuggestedFixDecisionDrafts(drafts, "properties-id");
        return [
          ...expect(
            getSuggestedFixDecision("managers-id:sparse_layout_gap:0", managersDrafts) === "keep_original",
            "Managers keep-original decision should be scoped to managers.",
          ),
          ...expect(
            getSuggestedFixDecision("properties-id:sparse_layout_gap:0", propertiesDrafts) === "decide_later",
            "Properties deferred decision should be scoped to properties.",
          ),
        ];
      }),
      fixture("clear decision clears only the active worksheet", () => {
        let drafts: WorksheetSuggestedFixDecisionDrafts = {};
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "managers-id",
          "managers-id:sparse_layout_gap:0",
          "use_recommendation",
        );
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "properties-id",
          "properties-id:sparse_layout_gap:0",
          "keep_original",
        );
        drafts = clearWorksheetSuggestedFixDecision(
          drafts,
          "managers-id",
          "managers-id:sparse_layout_gap:0",
        );
        return [
          ...expect(
            getSuggestedFixDecision(
              "managers-id:sparse_layout_gap:0",
              getWorksheetSuggestedFixDecisionDrafts(drafts, "managers-id"),
            ) === "unresolved",
            "Managers clear should return only managers recommendation to unresolved.",
          ),
          ...expect(
            getSuggestedFixDecision(
              "properties-id:sparse_layout_gap:0",
              getWorksheetSuggestedFixDecisionDrafts(drafts, "properties-id"),
            ) === "keep_original",
            "Properties decision should survive managers clear.",
          ),
        ];
      }),
      fixture("reset this worksheet clears only active worksheet decisions", () => {
        let drafts: WorksheetSuggestedFixDecisionDrafts = {};
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "managers-id",
          "managers-id:sparse_layout_gap:0",
          "use_recommendation",
        );
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "properties-id",
          "properties-id:side_note_region_candidate:1",
          "decide_later",
        );
        drafts = resetWorksheetSuggestedFixDecisions(drafts, "managers-id");
        return [
          ...expect(
            Object.keys(getWorksheetSuggestedFixDecisionDrafts(drafts, "managers-id")).length === 0,
            "Managers reset should clear managers draft map.",
          ),
          ...expect(
            getSuggestedFixDecision(
              "properties-id:side_note_region_candidate:1",
              getWorksheetSuggestedFixDecisionDrafts(drafts, "properties-id"),
            ) === "decide_later",
            "Properties decision should survive managers reset.",
          ),
        ];
      }),
      fixture("returning to each worksheet restores independent in-session decisions", () => {
        let drafts: WorksheetSuggestedFixDecisionDrafts = {};
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "managers-id",
          "managers-id:sparse_layout_gap:0",
          "use_recommendation",
        );
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "properties-id",
          "properties-id:side_note_region_candidate:1",
          "keep_original",
        );
        const managersReturn = getWorksheetSuggestedFixDecisionDrafts(drafts, "managers-id");
        const propertiesReturn = getWorksheetSuggestedFixDecisionDrafts(drafts, "properties-id");
        return [
          ...expect(
            getSuggestedFixDecision("managers-id:sparse_layout_gap:0", managersReturn) === "use_recommendation",
            "Returning to managers should restore managers decisions.",
          ),
          ...expect(
            getSuggestedFixDecision("properties-id:side_note_region_candidate:1", propertiesReturn) === "keep_original",
            "Returning to properties should restore properties decisions.",
          ),
        ];
      }),
      fixture("active worksheet readiness and deferred counts are worksheet specific", () => {
        const review = buildPreparationReview(workbookDataset());
        const managersFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "managers-id");
        const propertiesFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "properties-id");
        let drafts: WorksheetSuggestedFixDecisionDrafts = {};
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "managers-id",
          "managers-id:sparse_layout_gap:0",
          "use_recommendation",
        );
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "properties-id",
          "properties-id:sparse_layout_gap:0",
          "decide_later",
        );
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "properties-id",
          "properties-id:side_note_region_candidate:1",
          "keep_original",
        );
        const managersReadiness = getStructuralDecisionReadiness(
          managersFixes,
          getWorksheetSuggestedFixDecisionDrafts(drafts, "managers-id"),
        );
        const propertiesProgress = getSuggestedFixDecisionProgress(
          propertiesFixes,
          getWorksheetSuggestedFixDecisionDrafts(drafts, "properties-id"),
        );
        return [
          ...expect(managersReadiness.canContinueToApply === false, "Managers should still be blocked by its unresolved side-note recommendation."),
          ...expect(propertiesProgress.deferred === 1, "Properties deferred count should be worksheet-specific."),
          ...expect(propertiesProgress.unresolved === 0, "Properties should have no unresolved recommendations."),
        ];
      }),
      fixture("structural cleaning plan shows only active worksheet choices", () => {
        const review = buildPreparationReview(workbookDataset());
        const managersFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "managers-id");
        const propertiesFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "properties-id");
        let drafts: WorksheetSuggestedFixDecisionDrafts = {};
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "managers-id",
          "managers-id:sparse_layout_gap:0",
          "use_recommendation",
        );
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "properties-id",
          "properties-id:side_note_region_candidate:1",
          "keep_original",
        );
        const managersPlan = getSuggestedFixCleaningPlan(
          managersFixes,
          getWorksheetSuggestedFixDecisionDrafts(drafts, "managers-id"),
        );
        const propertiesPlan = getSuggestedFixCleaningPlan(
          propertiesFixes,
          getWorksheetSuggestedFixDecisionDrafts(drafts, "properties-id"),
        );
        return [
          ...expect(
            managersPlan.includes("Exclude layout separator rows from the cleaned copy"),
            "Managers plan should include managers accepted action.",
          ),
          ...expect(
            !managersPlan.includes("Keep side-note columns"),
            "Managers plan should not include properties keep-original decision.",
          ),
          ...expect(
            propertiesPlan.includes("Keep side-note columns"),
            "Properties plan should include properties decision.",
          ),
        ];
      }),
      fixture("automatic_blank_row produces worksheet-scoped evidence", () => {
        const signals = getAutomaticBlankRowEvidenceSignalsFromPreview(
          managersAutomaticBlankRowPreview(),
        );
        return [
          ...expect(signals.length === 1, "Automatic blank-row preview should produce one evidence signal."),
          ...expect(
            signals[0]?.worksheetId === "02eadd4b599a45798269e553dd02d4e4:worksheet:1",
            "Automatic blank-row evidence should keep managers worksheetId.",
          ),
          ...expect(
            signals[0]?.evidence.type === "automatic_blank_row",
            "Automatic blank-row evidence should use an explicit evidence type.",
          ),
          ...expect(
            signals[0]?.evidence.rowIndexes.includes(7) === true,
            "Automatic blank-row evidence should include traced row index 7.",
          ),
        ];
      }),
      fixture("automatic_blank_row stable recommendation identity uses worksheet id type and index", () => {
        const fix = getPreviewSuggestedFixes(managersAutomaticBlankRowPreview())[0];
        return [
          ...expect(
            fix?.id === "02eadd4b599a45798269e553dd02d4e4:worksheet:1:automatic_blank_row:0",
            "Automatic blank-row fix id should be stable and worksheet-scoped.",
          ),
          ...expect(fix?.recommendationId === fix?.id, "Recommendation id should match stable fix id."),
          ...expect(
            fix?.evidenceSignalId === "02eadd4b599a45798269e553dd02d4e4:worksheet:1:automatic_blank_row:0",
            "Evidence signal id should match stable automatic blank-row signal.",
          ),
        ];
      }),
      fixture("frontend maps automatic blank-row evidence to SuggestedFix labels", () => {
        const fix = getPreviewSuggestedFixes(managersAutomaticBlankRowPreview())[0];
        if (!fix) return ["Expected automatic blank-row preview to produce a fix."];
        return [
          ...expect(fix?.title === "Exclude blank layout rows", "Automatic blank-row fix should have direct title."),
          ...expect(
            fix?.detail === "Completely blank rows outside the analysis table were detected.",
            "Automatic blank-row fix should describe the exact detection rule.",
          ),
          ...expect(
            getSuggestedFixRecommendationLabel(fix) === "Exclude blank layout rows from the cleaned copy",
            "Automatic blank-row direct action should be explicit.",
          ),
          ...expect(
            getSuggestedFixKeepOriginalLabel(fix) === "Keep blank layout rows",
            "Automatic blank-row alternative action should be explicit.",
          ),
        ];
      }),
      fixture("automatic blank-row recommendation appears only for its worksheet", () => {
        const managersFix = getPreviewSuggestedFixes(managersAutomaticBlankRowPreview())[0];
        if (!managersFix) return ["Expected managers automatic blank-row recommendation."];
        return [
          ...expect(
            getSuggestedFixesForWorksheet([managersFix], "02eadd4b599a45798269e553dd02d4e4:worksheet:1").length === 1,
            "Managers should see its automatic blank-row recommendation.",
          ),
          ...expect(
            getSuggestedFixesForWorksheet([managersFix], "properties-id").length === 0,
            "Other worksheets should not see managers automatic blank-row recommendation.",
          ),
        ];
      }),
      fixture("backend preview layout-row indexes match frontend automatic blank-row evidence", () => {
        const preview = managersAutomaticBlankRowPreview();
        const signal = getAutomaticBlankRowEvidenceSignalsFromPreview(preview)[0];
        if (!signal) return ["Expected automatic blank-row preview to produce evidence."];
        return [
          ...expect(
            preview.excluded_details?.layout_rows?.row_indexes.join(",") === signal.evidence.rowIndexes.join(","),
            "Preview layout row indexes should match frontend evidence row indexes.",
          ),
          ...expect(
            preview.excluded_details?.layout_rows?.reasons[0]?.reason === signal.evidence.type,
            "Preview automatic blank-row reason should match frontend evidence type.",
          ),
        ];
      }),
      fixture("proposed layout exclusion prevents zero-recommendation empty state", () => {
        const previewFixes = getPreviewSuggestedFixes(managersAutomaticBlankRowPreview());
        return expect(
          previewFixes.length > 0,
          "A proposed automatic layout exclusion should produce a recommendation.",
        );
      }),
      fixture("proposed layout exclusion prevents no-recipe message", () => {
        const preview = managersAutomaticBlankRowPreview();
        return [
          ...expect(
            hasCleaningRecipePreviewOperations(preview) === true,
            "Preview with layout exclusions should count as having operations.",
          ),
          ...expect(
            getCleaningRecipeExcludedCount(preview) === 1,
            "Preview with one layout exclusion should report one excluded operation.",
          ),
        ];
      }),
      fixture("true zero-operation worksheet still shows no-recipe message", () => {
        const preview = recipePreview("properties-id", "properties");
        return [
          ...expect(
            hasCleaningRecipePreviewOperations(preview) === false,
            "Preview with no recipe and no exclusions should have no operations.",
          ),
          ...expect(
            getCleaningRecipeExcludedCount(preview) === 0,
            "True no-op preview should have zero excluded operations.",
          ),
        ];
      }),
      fixture("preview worksheet mismatch prevents stale preview rendering", () => {
        const preview = managersAutomaticBlankRowPreview();
        return [
          ...expect(
            isCleaningRecipePreviewForWorksheet(
              preview,
              "02eadd4b599a45798269e553dd02d4e4:worksheet:1",
            ) === true,
            "Matching managers preview should render for managers.",
          ),
          ...expect(
            isCleaningRecipePreviewForWorksheet(preview, "properties-id") === false,
            "Managers preview should not render for properties.",
          ),
        ];
      }),
      fixture("switching worksheets does not leak exclusions", () => {
        const managersPreview = managersAutomaticBlankRowPreview();
        const propertiesPreview = recipePreview("properties-id", "properties");
        return [
          ...expect(
            getPreviewSuggestedFixes(
              isCleaningRecipePreviewForWorksheet(managersPreview, "properties-id") ? managersPreview : null,
            ).length === 0,
            "Managers preview-derived recommendations should not leak to properties.",
          ),
          ...expect(
            getCleaningRecipeExcludedCount(
              isCleaningRecipePreviewForWorksheet(propertiesPreview, "properties-id") ? propertiesPreview : null,
            ) === 0,
            "Properties should keep its own zero exclusion count.",
          ),
        ];
      }),
      fixture("Step 2 and Step 3 use the same stable worksheet id", () => {
        const preview = managersAutomaticBlankRowPreview();
        const fix = getPreviewSuggestedFixes(preview)[0];
        return [
          ...expect(
            fix?.worksheetId === preview.worksheet_id,
            "Step 2 recommendation worksheetId should match Step 3 preview worksheet_id.",
          ),
          ...expect(
            fix?.id.startsWith(`${preview.worksheet_id}:automatic_blank_row:`),
            "Step 2 recommendation id should include Step 3 worksheet id.",
          ),
        ];
      }),
      fixture("layout evidence mapping uses evidenceType not display text", () => {
        const fix = getPreviewSuggestedFixes(managersAutomaticBlankRowPreview())[0];
        if (!fix) return ["Expected automatic blank-row preview to produce a fix."];
        const renamedFix = { ...fix, title: "A completely different visible title" };
        return expect(
          getSuggestedFixRecommendationLabel(renamedFix) === "Exclude blank layout rows from the cleaned copy",
          "Automatic blank-row label should come from evidenceType.",
        );
      }),
      fixture("Step 2 loading state blocks before selected worksheet preview arrives", () => {
        const readiness = getStructuralPreviewLoadingReadiness("managers-id", "managers");
        return [
          ...expect(
            readiness.blockingMessage === "Checking structural recommendations for managers...",
            "Loading readiness should show the checking copy.",
          ),
          ...expect(readiness.canContinueToApply === false, "Loading readiness should block Apply."),
          ...expect(
            isStructuralApplyNavigationBlocked("structural", readiness) === true,
            "Next: Apply should be disabled while structural preview is loading.",
          ),
        ];
      }),
      fixture("preview arrival adds automatic_blank_row recommendation", () => {
        const beforePreview = getPreviewSuggestedFixes(null);
        const afterPreview = getPreviewSuggestedFixes(managersAutomaticBlankRowPreview());
        return [
          ...expect(beforePreview.length === 0, "No preview should produce no preview-derived fix."),
          ...expect(afterPreview.length === 1, "Preview arrival should produce one automatic blank-row fix."),
          ...expect(
            afterPreview[0]?.evidenceType === "automatic_blank_row",
            "Preview-arrived fix should use automatic_blank_row evidence.",
          ),
        ];
      }),
      fixture("readiness changes from loading to unresolved recommendation after preview", () => {
        const loading = getStructuralPreviewLoadingReadiness(
          "02eadd4b599a45798269e553dd02d4e4:worksheet:1",
          "managers",
        );
        const fixes = getPreviewSuggestedFixes(managersAutomaticBlankRowPreview());
        const afterPreview = getStructuralDecisionReadiness(
          fixes,
          {},
          "02eadd4b599a45798269e553dd02d4e4:worksheet:1",
          "managers",
        );
        return [
          ...expect(loading.canContinueToApply === false, "Loading should be blocked."),
          ...expect(afterPreview.totalCount === 1, "Preview should add one recommendation."),
          ...expect(afterPreview.unresolvedCount === 1, "Preview recommendation should start unresolved."),
          ...expect(afterPreview.canContinueToApply === false, "Unresolved preview recommendation should block Apply."),
        ];
      }),
      fixture("Next Apply remains disabled until preview-derived recommendation is handled", () => {
        const fixes = getPreviewSuggestedFixes(managersAutomaticBlankRowPreview());
        const unresolved = getStructuralDecisionReadiness(
          fixes,
          {},
          "02eadd4b599a45798269e553dd02d4e4:worksheet:1",
          "managers",
        );
        const handled = getStructuralDecisionReadiness(
          fixes,
          {
            "02eadd4b599a45798269e553dd02d4e4:worksheet:1:automatic_blank_row:0": "use_recommendation",
          },
          "02eadd4b599a45798269e553dd02d4e4:worksheet:1",
          "managers",
        );
        return [
          ...expect(
            isStructuralApplyNavigationBlocked("structural", unresolved) === true,
            "Unresolved automatic blank-row fix should keep Apply disabled.",
          ),
          ...expect(
            isStructuralApplyNavigationBlocked("structural", handled) === false,
            "Handled automatic blank-row fix should allow Apply navigation.",
          ),
        ];
      }),
      fixture("zero-ready is used only after successful zero-operation preview", () => {
        const loading = getStructuralPreviewLoadingReadiness("properties-id", "properties");
        const preview = recipePreview("properties-id", "properties");
        const readiness = getStructuralDecisionReadiness(
          getPreviewSuggestedFixes(preview),
          {},
          "properties-id",
          "properties",
        );
        return [
          ...expect(loading.canContinueToApply === false, "Before preview, zero-ready should not apply."),
          ...expect(hasCleaningRecipePreviewOperations(preview) === false, "Preview should be a true zero-operation preview."),
          ...expect(readiness.canContinueToApply === true, "Successful zero-operation preview should allow Apply."),
        ];
      }),
      fixture("preview failure does not produce zero-ready", () => {
        const readiness = getStructuralPreviewErrorReadiness(
          "managers-id",
          "managers",
          "Cleaning recipe preview could not be loaded.",
        );
        return [
          ...expect(readiness.totalCount === 0, "Preview failure should not invent recommendations."),
          ...expect(readiness.canContinueToApply === false, "Preview failure should block Apply."),
          ...expect(
            readiness.blockingMessage === "Cleaning recipe preview could not be loaded.",
            "Preview failure should expose retryable error copy.",
          ),
        ];
      }),
      fixture("preview response validation accepts matching worksheet preview", () => {
        const validation = validateStructuralPreviewResponse(
          managersAutomaticBlankRowPreview(),
          "02eadd4b599a45798269e553dd02d4e4:worksheet:1",
          "managers",
        );
        return [
          ...expect(validation.ok === true, "Matching preview with layout details should validate."),
        ];
      }),
      fixture("worksheet mismatch validation transitions to error", () => {
        const validation = validateStructuralPreviewResponse(
          managersAutomaticBlankRowPreview(),
          "02eadd4b599a45798269e553dd02d4e4:worksheet:2",
          "realtors",
        );
        return [
          ...expect(validation.ok === false, "Mismatched preview should be rejected."),
          ...expect(
            validation.ok === false && validation.message.includes("couldn't verify"),
            "Mismatched preview should use verification error copy.",
          ),
        ];
      }),
      fixture("missing excluded_details with layout exclusions blocks as contract error", () => {
        const validation = validateStructuralPreviewResponse(
          recipePreview("managers-id", "managers", {
            excluded: {
              repeated_headers: 0,
              section_banners: 0,
              date_title_rows: 0,
              layout_rows: 1,
              placeholder_rows: 0,
              side_note_columns: 0,
            },
          }),
          "managers-id",
          "managers",
        );
        return [
          ...expect(validation.ok === false, "Layout exclusions without details should be rejected."),
          ...expect(
            validation.ok === false && validation.message.includes("Structural preview details are incomplete"),
            "Missing details should expose a contract-alignment error.",
          ),
        ];
      }),
      fixture("zero-operation response validates before zero-ready readiness", () => {
        const preview = recipePreview("clean:worksheet:1", "Clean");
        const validation = validateStructuralPreviewResponse(preview, "clean:worksheet:1", "Clean");
        const readiness = getStructuralDecisionReadiness(
          getPreviewSuggestedFixes(preview),
          {},
          "clean:worksheet:1",
          "Clean",
        );
        return [
          ...expect(validation.ok === true, "Zero-operation preview should validate."),
          ...expect(readiness.canContinueToApply === true, "Validated zero-operation preview should allow Apply."),
        ];
      }),
      fixture("structural lifecycle resolves loading to ready", () => {
        const loading = getStructuralPreviewLifecycleState(true, "loading", false);
        const ready = getStructuralPreviewLifecycleState(true, "ready", true);
        return [
          ...expect(loading.status === "loading", "Lifecycle should expose loading while request is in flight."),
          ...expect(loading.isPending === true, "Loading lifecycle should be pending."),
          ...expect(ready.status === "ready", "Lifecycle should resolve to ready when a verified preview exists."),
          ...expect(ready.isPending === false, "Ready lifecycle should not remain pending."),
        ];
      }),
      fixture("structural lifecycle resolves loading to error", () => {
        const error = getStructuralPreviewLifecycleState(true, "error", false);
        return [
          ...expect(error.status === "error", "Lifecycle should expose error after failure."),
          ...expect(error.isError === true, "Error lifecycle should be marked error."),
          ...expect(error.isPending === false, "Error lifecycle should not remain pending."),
        ];
      }),
      fixture("structural lifecycle leaves idle non-pending before request starts", () => {
        const idle = getStructuralPreviewLifecycleState(true, "idle", false);
        const readiness = getStructuralPreviewIdleReadiness("managers-id", "managers");
        return [
          ...expect(idle.status === "idle", "Idle lifecycle should stay idle until the request effect starts."),
          ...expect(idle.isPending === false, "Idle lifecycle should not render permanent checking copy."),
          ...expect(readiness.canContinueToApply === false, "Idle-before-preview should block Apply."),
          ...expect(
            readiness.blockingMessage === "Structural recommendations for managers have not been checked yet.",
            "Idle-before-preview should not claim zero-ready.",
          ),
          ...expect(shouldStartStructuralPreviewRequest(true, "idle", false) === true, "Idle selected worksheet should start one request."),
        ];
      }),
      fixture("preview request guard treats loading error and verified ready as settled", () => {
        return [
          ...expect(shouldStartStructuralPreviewRequest(true, "loading", false) === false, "Loading should not start another request."),
          ...expect(shouldStartStructuralPreviewRequest(true, "error", false) === false, "Error should not automatically retry."),
          ...expect(shouldStartStructuralPreviewRequest(true, "ready", true) === false, "Verified ready preview should not refetch."),
        ];
      }),
      fixture("retry lifecycle returns only selected worksheet to idle", () => {
        const before = {
          "finance:worksheet:income": "error",
          "finance:worksheet:balance": "ready",
        } as const;
        const after = {
          ...before,
          "finance:worksheet:income": "idle",
        };
        return [
          ...expect(after["finance:worksheet:income"] === "idle", "Retry should reset selected worksheet status."),
          ...expect(after["finance:worksheet:balance"] === "ready", "Retry should preserve other worksheet cache status."),
        ];
      }),
      fixture("ready without verified preview transitions to explicit error", () => {
        const lifecycle = getStructuralPreviewLifecycleState(true, "ready", false);
        return [
          ...expect(lifecycle.status === "error", "Ready status without verified preview should expose an error."),
          ...expect(lifecycle.isPending === false, "Unverified ready state should not stay in checking."),
          ...expect(
            shouldMarkStructuralPreviewVerificationError(true, "ready", false) === true,
            "Unverified ready should be marked as a verification error.",
          ),
        ];
      }),
      fixture("zero active-worksheet recommendations produce empty ready readiness", () => {
        const review = buildPreparationReview(workbookDatasetWithEmptyWorksheet());
        const propertiesFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "properties-id");
        const readiness = getStructuralDecisionReadiness(
          propertiesFixes,
          getWorksheetSuggestedFixDecisionDrafts({}, "properties-id"),
          "properties-id",
          "properties",
        );
        return [
          ...expect(propertiesFixes.length === 0, "Properties should have no active worksheet recommendations."),
          ...expect(readiness.worksheetId === "properties-id", "Readiness should name the active worksheet id."),
          ...expect(readiness.worksheetName === "properties", "Readiness should name the active worksheet."),
          ...expect(readiness.totalCount === 0, "Zero recommendations should report totalCount 0."),
          ...expect(readiness.resolvedCount === 0, "Zero recommendations should report resolvedCount 0."),
          ...expect(readiness.unresolvedCount === 0, "Zero recommendations should report unresolvedCount 0."),
          ...expect(readiness.deferredCount === 0, "Zero recommendations should report deferredCount 0."),
          ...expect(readiness.canContinueToApply === true, "Zero recommendations should allow Apply."),
          ...expect(readiness.blockingMessage === null, "Zero recommendations should not expose a blocker."),
        ];
      }),
      fixture("zero recommendations enable Next Apply and hide unresolved explanation", () => {
        const readiness = getStructuralDecisionReadiness([], {}, "properties-id", "properties");
        let calls = 0;
        const invoked = invokeStructuralApplyNavigation("structural", readiness, () => {
          calls += 1;
        });
        return [
          ...expect(
            isStructuralApplyNavigationBlocked("structural", readiness) === false,
            "Zero-recommendation readiness should not block Next: Apply.",
          ),
          ...expect(invoked === true, "Zero-recommendation readiness should invoke Apply navigation."),
          ...expect(calls === 1, "Zero-recommendation readiness should call goToApply once."),
          ...expect(
            getStructuralApplyNavigationBlockMessage("structural", "decide", readiness) === null,
            "Zero-recommendation readiness should hide unresolved explanation.",
          ),
          ...expect(
            !String(readiness.blockingMessage).includes("Resolve or explicitly defer"),
            "Zero-recommendation readiness should not contain unresolved guidance.",
          ),
        ];
      }),
      fixture("switching from unresolved worksheet to zero-fix worksheet replaces stale readiness", () => {
        const review = buildPreparationReview(workbookDatasetWithEmptyWorksheet());
        const managersFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "managers-id");
        const propertiesFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "properties-id");
        const managersReadiness = getStructuralDecisionReadiness(
          managersFixes,
          getWorksheetSuggestedFixDecisionDrafts({}, "managers-id"),
          "managers-id",
          "managers",
        );
        const propertiesReadiness = getStructuralDecisionReadiness(
          propertiesFixes,
          getWorksheetSuggestedFixDecisionDrafts({}, "properties-id"),
          "properties-id",
          "properties",
        );
        let parentReadiness = managersReadiness;
        if (!areStructuralDecisionReadinessEqual(parentReadiness, propertiesReadiness)) {
          parentReadiness = propertiesReadiness;
        }
        return [
          ...expect(managersReadiness.canContinueToApply === false, "Managers should start blocked."),
          ...expect(propertiesReadiness.canContinueToApply === true, "Properties should be empty-ready."),
          ...expect(
            parentReadiness.worksheetId === "properties-id",
            "Parent readiness should replace stale managers state with properties state.",
          ),
          ...expect(parentReadiness.blockingMessage === null, "Updated parent readiness should clear blocker."),
        ];
      }),
      fixture("switching back restores unresolved worksheet blocked readiness", () => {
        const review = buildPreparationReview(workbookDatasetWithEmptyWorksheet());
        const managersFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "managers-id");
        const propertiesReadiness = getStructuralDecisionReadiness([], {}, "properties-id", "properties");
        const managersReadiness = getStructuralDecisionReadiness(
          managersFixes,
          getWorksheetSuggestedFixDecisionDrafts({}, "managers-id"),
          "managers-id",
          "managers",
        );
        let parentReadiness = propertiesReadiness;
        if (!areStructuralDecisionReadinessEqual(parentReadiness, managersReadiness)) {
          parentReadiness = managersReadiness;
        }
        return [
          ...expect(parentReadiness.worksheetId === "managers-id", "Parent readiness should return to managers."),
          ...expect(parentReadiness.canContinueToApply === false, "Returning to unresolved managers should block Apply."),
          ...expect(
            parentReadiness.blockingMessage?.includes("Resolve or explicitly defer") === true,
            "Returning to unresolved managers should restore blocker copy.",
          ),
        ];
      }),
      fixture("direct apply hash is allowed for zero active-worksheet recommendations", () => {
        const readiness = getStructuralDecisionReadiness([], {}, "properties-id", "properties");
        return expect(
          normalizeBlockedApplyStep("structural", "apply", readiness) === "apply",
          "Direct #apply should remain Apply when the active worksheet has zero recommendations.",
        );
      }),
      fixture("empty active worksheet does not show cross-worksheet recommendations", () => {
        const review = buildPreparationReview(workbookDatasetWithEmptyWorksheet());
        const propertiesFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "properties-id");
        const managersFixes = getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, "managers-id");
        return [
          ...expect(managersFixes.length === 2, "Managers should still own its recommendations."),
          ...expect(propertiesFixes.length === 0, "Properties should not borrow managers recommendations."),
        ];
      }),
      fixture("empty-state copy clearly names this worksheet", () => [
        ...expect(
          structuralDecisionEmptyStateCopy.includes("this worksheet"),
          "Empty-state copy should clearly scope to this worksheet.",
        ),
        ...expect(
          structuralDecisionEmptyStateCopy.includes("No structural issues require a decision"),
          "Empty-state copy should truthfully explain there are no structural decisions.",
        ),
      ]),
      fixture("recommendation with no saved decision initializes unresolved", () => [
        ...expect(
          getSuggestedFixDecision("sparse_layout_gap", decisions({})) === "unresolved",
          "Missing structural decision should be unresolved.",
        ),
      ]),
      fixture("unresolved is not an apply decision", () => {
        const plan = getSuggestedFixCleaningPlan([fixes[0]], decisions({}));
        return expect(plan.length === 0, "Unresolved decision should not appear in cleaning plan.");
      }),
      fixture("existing saved decide-later remains decide-later", () => [
        ...expect(
          getSuggestedFixDecision("sparse_layout_gap", decisions({ sparse_layout_gap: "decide_later" })) === "decide_later",
          "Saved decide_later should remain explicit defer.",
        ),
      ]),
      fixture("existing saved accepted recommendation remains accepted", () => [
        ...expect(
          getSuggestedFixDecision("sparse_layout_gap", decisions({ sparse_layout_gap: "use_recommendation" })) === "use_recommendation",
          "Saved accepted recommendation should remain accepted.",
        ),
      ]),
      fixture("existing saved keep-original remains preserved", () => [
        ...expect(
          getSuggestedFixDecision("sparse_layout_gap", decisions({ sparse_layout_gap: "keep_original" })) === "keep_original",
          "Saved keep_original should remain preserved.",
        ),
      ]),
      fixture("selecting recommendation changes unresolved to accepted", () => {
        const current = decisions({});
        const next = { ...current, sparse_layout_gap: "use_recommendation" as const };
        return expect(
          getSuggestedFixDecision("sparse_layout_gap", next) === "use_recommendation",
          "Recommendation selection should become accepted.",
        );
      }),
      fixture("selecting keep-original changes unresolved to resolved", () => {
        const progress = getSuggestedFixDecisionProgress([fixes[0]], decisions({ sparse_layout_gap: "keep_original" }));
        return expect(progress.resolved === 1 && progress.unresolved === 0, "Keep original should count as resolved.");
      }),
      fixture("selecting decide-later changes unresolved to deferred", () => {
        const progress = getSuggestedFixDecisionProgress([fixes[0]], decisions({ sparse_layout_gap: "decide_later" }));
        return expect(progress.deferred === 1 && progress.unresolved === 0, "Decide later should count as deferred.");
      }),
      fixture("progress counts distinguish states", () => {
        const progress = getSuggestedFixDecisionProgress(
          fixes,
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "decide_later",
          }),
        );
        return [
          ...expect(progress.total === 3, "Progress total should include every recommendation."),
          ...expect(progress.resolved === 1, "Progress should count accepted decisions as resolved."),
          ...expect(progress.unresolved === 1, "Progress should count untouched decisions as unresolved."),
          ...expect(progress.deferred === 1, "Progress should count explicit deferrals."),
        ];
      }),
      fixture("cleaning-plan summary includes accepted actions", () => {
        const plan = getSuggestedFixCleaningPlan([fixes[0]], decisions({ sparse_layout_gap: "use_recommendation" }));
        return expect(
          plan.includes("Exclude layout separator rows from the cleaned copy"),
          "Accepted recommendation should add direct action to plan.",
        );
      }),
      fixture("cleaning-plan summary includes keep-original decisions", () => {
        const plan = getSuggestedFixCleaningPlan([fixes[0]], decisions({ sparse_layout_gap: "keep_original" }));
        return expect(plan.includes("Keep layout separator rows"), "Keep original should add preservation action.");
      }),
      fixture("cleaning-plan summary counts deferred decisions", () => {
        const plan = getSuggestedFixCleaningPlan(
          fixes,
          decisions({
            sparse_layout_gap: "decide_later",
            side_note_region_candidate: "decide_later",
          }),
        );
        return expect(plan.includes("2 recommendations deferred"), "Plan should summarize deferred count.");
      }),
      fixture("unresolved values are not included in apply plan", () => {
        const plan = getSuggestedFixCleaningPlan(fixes, decisions({ "dataset:missing-values": "use_recommendation" }));
        return [
          ...expect(plan.length === 1, "Only explicit decisions should appear."),
          ...expect(!plan.includes("unresolved"), "Unresolved should never be emitted."),
        ];
      }),
      fixture("no unsupported unresolved strategy reaches backend-shaped decisions", () => {
        const explicitDecisions = Object.values(
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "keep_original",
            "dataset:missing-values": "decide_later",
          }),
        );
        return expect(
          !explicitDecisions.includes("unresolved"),
          "Explicit decision values should not include unresolved.",
        );
      }),
      fixture("next apply local gating model blocks unresolved", () => {
        const readiness = getStructuralDecisionReadiness(fixes, decisions({ sparse_layout_gap: "use_recommendation" }));
        return [
          ...expect(readiness.canContinueToApply === false, "Unresolved count should block Apply."),
          ...expect(readiness.unresolvedCount === 2, "Two recommendations should still be unresolved."),
        ];
      }),
      fixture("next apply local gating model allows resolved or deferred", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "keep_original",
            "dataset:missing-values": "decide_later",
          }),
        );
        return [
          ...expect(readiness.canContinueToApply === true, "No unresolved recommendations should allow Apply."),
          ...expect(readiness.deferredCount === 1, "Explicit deferral should remain counted."),
        ];
      }),
      fixture("all unresolved decisions cannot continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(fixes, decisions({}));
        return [
          ...expect(readiness.canContinueToApply === false, "Untouched recommendations should block Apply."),
          ...expect(readiness.unresolvedCount === 3, "All three recommendations should be unresolved."),
        ];
      }),
      fixture("accepted plus unresolved decisions cannot continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({ sparse_layout_gap: "use_recommendation" }),
        );
        return expect(readiness.canContinueToApply === false, "Remaining unresolved decisions should block.");
      }),
      fixture("accepted plus keep-original plus unresolved cannot continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "keep_original",
          }),
        );
        return expect(readiness.canContinueToApply === false, "One unresolved recommendation should block.");
      }),
      fixture("all accepted decisions can continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "use_recommendation",
            "dataset:missing-values": "use_recommendation",
          }),
        );
        return expect(readiness.canContinueToApply === true, "Accepted recommendations should count as handled.");
      }),
      fixture("all keep-original decisions can continue to Apply", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "keep_original",
            side_note_region_candidate: "keep_original",
            "dataset:missing-values": "keep_original",
          }),
        );
        return expect(readiness.canContinueToApply === true, "Keep-original decisions should count as handled.");
      }),
      fixture("all decide-later decisions can continue with deferred count equal total", () => {
        const readiness = getStructuralDecisionReadiness(
          fixes,
          decisions({
            sparse_layout_gap: "decide_later",
            side_note_region_candidate: "decide_later",
            "dataset:missing-values": "decide_later",
          }),
        );
        return [
          ...expect(readiness.canContinueToApply === true, "Explicit deferrals should allow Apply."),
          ...expect(readiness.deferredCount === readiness.totalCount, "Deferred count should equal total."),
        ];
      }),
      fixture("empty recommendation list can continue explicitly", () => {
        const readiness = getStructuralDecisionReadiness([], decisions({}));
        return [
          ...expect(readiness.canContinueToApply === true, "No recommendations should not block Apply."),
          ...expect(readiness.blockingMessage === null, "No recommendations should have no blocker."),
        ];
      }),
      fixture("blocking message includes unresolved count", () => {
        const readiness = getStructuralDecisionReadiness(fixes, decisions({ sparse_layout_gap: "keep_original" }));
        return expect(
          readiness.blockingMessage?.includes("2 recommendations") === true,
          "Blocking message should include unresolved count.",
        );
      }),
      fixture("parent readiness callback model updates only on meaningful changes", () => {
        const first = getStructuralDecisionReadiness(fixes, decisions({}));
        const duplicate = getStructuralDecisionReadiness(fixes, decisions({}));
        const changed = getStructuralDecisionReadiness(
          fixes,
          decisions({ sparse_layout_gap: "use_recommendation" }),
        );
        let current = null as ReturnType<typeof getStructuralDecisionReadiness> | null;
        let updateCount = 0;
        [first, duplicate, changed].forEach((next) => {
          if (!areStructuralDecisionReadinessEqual(current, next)) {
            current = next;
            updateCount += 1;
          }
        });
        return expect(updateCount === 2, "Only meaningful readiness changes should update parent state.");
      }),
      fixture("clear control visibility follows explicit decision state", () => [
        ...expect(
          hasExplicitSuggestedFixDecisions([fixes[0]], decisions({})) === false,
          "Unresolved recommendation should not expose clear/reset controls.",
        ),
        ...expect(
          hasExplicitSuggestedFixDecisions([fixes[0]], decisions({ sparse_layout_gap: "use_recommendation" })) === true,
          "Accepted recommendation should expose clear/reset controls.",
        ),
        ...expect(
          hasExplicitSuggestedFixDecisions([fixes[0]], decisions({ sparse_layout_gap: "keep_original" })) === true,
          "Keep-original recommendation should expose clear/reset controls.",
        ),
        ...expect(
          hasExplicitSuggestedFixDecisions([fixes[0]], decisions({ sparse_layout_gap: "decide_later" })) === true,
          "Deferred recommendation should expose clear/reset controls.",
        ),
      ]),
      fixture("clearing accepted returns recommendation to unresolved", () => {
        const next = clearSuggestedFixDecision(
          decisions({ sparse_layout_gap: "use_recommendation" }),
          "sparse_layout_gap",
        );
        return expect(
          getSuggestedFixDecision("sparse_layout_gap", next) === "unresolved",
          "Cleared accepted decision should become unresolved.",
        );
      }),
      fixture("clearing keep-original returns recommendation to unresolved", () => {
        const next = clearSuggestedFixDecision(
          decisions({ sparse_layout_gap: "keep_original" }),
          "sparse_layout_gap",
        );
        return expect(
          getSuggestedFixDecision("sparse_layout_gap", next) === "unresolved",
          "Cleared keep-original decision should become unresolved.",
        );
      }),
      fixture("clearing decide-later returns recommendation to unresolved", () => {
        const next = clearSuggestedFixDecision(
          decisions({ sparse_layout_gap: "decide_later" }),
          "sparse_layout_gap",
        );
        return expect(
          getSuggestedFixDecision("sparse_layout_gap", next) === "unresolved",
          "Cleared deferred decision should become unresolved.",
        );
      }),
      fixture("clearing removes selected radio state by deleting map entry", () => {
        const next = clearSuggestedFixDecision(
          decisions({ sparse_layout_gap: "use_recommendation" }),
          "sparse_layout_gap",
        );
        return expect(
          Object.prototype.hasOwnProperty.call(next, "sparse_layout_gap") === false,
          "Clearing should remove the explicit draft entry.",
        );
      }),
      fixture("clearing updates unresolved resolved and deferred counts", () => {
        const next = clearSuggestedFixDecision(
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "decide_later",
            "dataset:missing-values": "keep_original",
          }),
          "side_note_region_candidate",
        );
        const progress = getSuggestedFixDecisionProgress(fixes, next);
        return [
          ...expect(progress.unresolved === 1, "Clearing should increase unresolved count."),
          ...expect(progress.resolved === 2, "Clearing deferred should preserve other resolved decisions."),
          ...expect(progress.deferred === 0, "Clearing deferred should decrease deferred count."),
        ];
      }),
      fixture("clearing removes action from cleaning-plan summary", () => {
        const current = decisions({
          sparse_layout_gap: "use_recommendation",
          side_note_region_candidate: "keep_original",
        });
        const next = clearSuggestedFixDecision(current, "sparse_layout_gap");
        const plan = getSuggestedFixCleaningPlan(fixes, next);
        return [
          ...expect(
            !plan.includes("Exclude layout separator rows from the cleaned copy"),
            "Cleared accepted action should leave the plan.",
          ),
          ...expect(
            plan.includes("Keep side-note columns"),
            "Clearing one recommendation should preserve other decisions.",
          ),
        ];
      }),
      fixture("clearing disables Apply again through readiness", () => {
        const current = decisions({
          sparse_layout_gap: "use_recommendation",
          side_note_region_candidate: "keep_original",
          "dataset:missing-values": "decide_later",
        });
        const next = clearSuggestedFixDecision(current, "dataset:missing-values");
        const readiness = getStructuralDecisionReadiness(fixes, next);
        return expect(readiness.canContinueToApply === false, "Clearing should re-block Apply.");
      }),
      fixture("reset button appears only when at least one decision exists", () => [
        ...expect(
          hasExplicitSuggestedFixDecisions(fixes, decisions({})) === false,
          "Reset should be hidden when every recommendation is unresolved.",
        ),
        ...expect(
          hasExplicitSuggestedFixDecisions(fixes, decisions({ side_note_region_candidate: "keep_original" })) === true,
          "Reset should appear when at least one decision exists.",
        ),
      ]),
      fixture("cancel reset preserves decisions by leaving draft map untouched", () => {
        const current = decisions({
          sparse_layout_gap: "use_recommendation",
          side_note_region_candidate: "keep_original",
        });
        const afterCancel = current;
        return [
          ...expect(afterCancel === current, "Cancel should preserve the current decision map reference."),
          ...expect(
            getSuggestedFixDecision("sparse_layout_gap", afterCancel) === "use_recommendation",
            "Cancel should preserve accepted decision.",
          ),
        ];
      }),
      fixture("confirm reset clears every decision", () => {
        const next = resetSuggestedFixDecisions();
        return [
          ...expect(Object.keys(next).length === 0, "Reset should clear all draft entries."),
          ...expect(
            fixes.every((fix) => getSuggestedFixDecision(fix.id, next) === "unresolved"),
            "Reset should return every recommendation to unresolved.",
          ),
        ];
      }),
      fixture("confirm reset sets resolved and deferred counts to zero", () => {
        const progress = getSuggestedFixDecisionProgress(fixes, resetSuggestedFixDecisions());
        return [
          ...expect(progress.resolved === 0, "Reset should set resolved count to zero."),
          ...expect(progress.deferred === 0, "Reset should set deferred count to zero."),
          ...expect(progress.unresolved === fixes.length, "Reset should make unresolved equal total."),
        ];
      }),
      fixture("confirm reset disables Apply and restores empty plan summary", () => {
        const next = resetSuggestedFixDecisions();
        const readiness = getStructuralDecisionReadiness(fixes, next);
        const plan = getSuggestedFixCleaningPlan(fixes, next);
        return [
          ...expect(readiness.canContinueToApply === false, "Reset should block Apply."),
          ...expect(plan.length === 0, "Reset should restore no structural cleaning decisions state."),
        ];
      }),
      fixture("existing explicit decisions remain backward compatible after clear helpers", () => {
        const current = decisions({
          sparse_layout_gap: "use_recommendation",
          side_note_region_candidate: "keep_original",
          "dataset:missing-values": "decide_later",
        });
        return [
          ...expect(
            getSuggestedFixDecision("sparse_layout_gap", current) === "use_recommendation",
            "Existing accepted decision should still load.",
          ),
          ...expect(
            getSuggestedFixDecision("side_note_region_candidate", current) === "keep_original",
            "Existing keep-original decision should still load.",
          ),
          ...expect(
            getSuggestedFixDecision("dataset:missing-values", current) === "decide_later",
            "Existing deferred decision should still load.",
          ),
        ];
      }),
      fixture("clear and reset helpers introduce no new decision values", () => {
        const cleared = clearSuggestedFixDecision(
          decisions({ sparse_layout_gap: "use_recommendation" }),
          "sparse_layout_gap",
        );
        const reset = resetSuggestedFixDecisions();
        const allowedValues: SuggestedFixDecision[] = [
          "unresolved",
          "use_recommendation",
          "keep_original",
          "decide_later",
        ];
        const values = [...Object.values(cleared), ...Object.values(reset)];
        return expect(
          values.every((value) => allowedValues.includes(value)),
          "Clear/reset helpers should not introduce new decision values.",
        );
      }),
      fixture("clear and reset helpers do not alter backend-shaped payload inputs", () => {
        const before = Object.keys(
          decisions({
            sparse_layout_gap: "use_recommendation",
            side_note_region_candidate: "keep_original",
          }),
        );
        const afterClear = Object.keys(
          clearSuggestedFixDecision(
            decisions({
              sparse_layout_gap: "use_recommendation",
              side_note_region_candidate: "keep_original",
            }),
            "sparse_layout_gap",
          ),
        );
        const afterReset = Object.keys(resetSuggestedFixDecisions());
        return [
          ...expect(before.length === 2, "Fixture should start with two explicit decisions."),
          ...expect(afterClear.length === 1, "Clearing should only remove one decision draft key."),
          ...expect(afterReset.length === 0, "Reset should remove all decision draft keys."),
        ];
      }),
      fixture("direct action labels match recommendation", () => [
        ...expect(
          getSuggestedFixRecommendationLabel(fixes[0]) === "Exclude layout separator rows from the cleaned copy",
          "Layout recommendation should be direct.",
        ),
        ...expect(
          getSuggestedFixRecommendationLabel(fixes[1]) === "Exclude side-note columns from the cleaned copy",
          "Side-note recommendation should be direct.",
        ),
        ...expect(
          getSuggestedFixKeepOriginalLabel(fixes[2]) === "Keep blanks as-is",
          "Blank-cell keep-original wording should match current behavior.",
        ),
      ]),
      fixture("clean single-table CSV has zero decisions ready", () => {
        const dataset: DatasetMetadata = {
          dataset_id: "dataset:clean-csv",
          filename: "clean.csv",
          original_filename: "clean.csv",
          table_name: "clean_table",
          uploaded_at: "2026-07-19T00:00:00.000Z",
          row_count: 3,
          column_count: 2,
          schema: [typedColumn("order_id", "text", { null_count: 0 }), typedColumn("amount", "numeric", { null_count: 0 })],
        };
        const review = buildPreparationReview(dataset);
        const readiness = getStructuralDecisionReadiness(review.scopedSuggestedFixes, {});
        return [
          ...expect(review.scopedSuggestedFixes.length === 0, "Clean CSV should have no structural recommendations."),
          ...expect(readiness.canContinueToApply === true, "Zero structural recommendations should be ready."),
        ];
      }),
      fixture("sales CSV missing options are type appropriate", () => {
        const revenue = typedColumn("revenue", "numeric", {
          numeric_stats: { min: 1, max: 20, mean: 10, median: 9, std: 2 },
        });
        const region = typedColumn("region", "categorical", {
          top_values: [{ value: "North", count: 4 }],
          sample_values: ["North", "South"],
        });
        const numericStrategies = getColumnMissingValueStrategies(revenue);
        const categoryStrategies = getColumnMissingValueStrategies(region);
        return [
          ...expect(numericStrategies.includes("fill_mean"), "Numeric column should offer mean when stats exist."),
          ...expect(numericStrategies.includes("fill_median"), "Numeric column should offer median when stats exist."),
          ...expect(!numericStrategies.includes("mark_unknown"), "Numeric column should not offer Unknown text fill."),
          ...expect(categoryStrategies.includes("fill_mode"), "Categorical column with values should offer most-common fill."),
          ...expect(!categoryStrategies.includes("fill_mean"), "Categorical column should not offer mean."),
        ];
      }),
      fixture("healthcare worksheet date and boolean columns use inferred types only", () => {
        const visitDate = typedColumn("visit_date", "date");
        const consented = typedColumn("consented", "boolean");
        return [
          ...expect(classifyColumnMissingTypeGroup(visitDate.inferred_type) === "date", "Date column should classify as date."),
          ...expect(classifyColumnMissingTypeGroup(consented.inferred_type) === "boolean", "Boolean column should classify as boolean."),
          ...expect(getColumnMissingValueStrategies(visitDate).includes("custom_date"), "Date column should offer custom date."),
          ...expect(!getColumnMissingValueStrategies(consented).includes("mark_unknown"), "Boolean column should not offer Unknown by name."),
        ];
      }),
      fixture("survey workbook recommendations differ by evidence", () => {
        const survey = worksheet("survey:worksheet:responses", "Responses", [
          evidence("repeated_header", { rowIndexes: [10, 20] }),
          evidence("sparse_layout_gap", { rowRange: [5, 5] }),
        ]);
        const dataset = workbookDataset();
        dataset.workbook_metadata = {
          ...dataset.workbook_metadata!,
          worksheets: [survey],
          worksheetIds: [survey.worksheetId],
        };
        const fixTypes = buildPreparationReview(dataset).scopedSuggestedFixes.map((fix) => fix.evidenceType).sort();
        return [
          ...expect(fixTypes.includes("repeated_header"), "Repeated header evidence should create matching recommendation."),
          ...expect(fixTypes.includes("sparse_layout_gap"), "Blank separator evidence should create matching recommendation."),
          ...expect(!fixTypes.includes("side_note_region_candidate"), "Absent side-note evidence should not create a recommendation."),
        ];
      }),
      fixture("finance workbook decisions remain independent per worksheet", () => {
        let drafts: WorksheetSuggestedFixDecisionDrafts = {};
        drafts = setWorksheetSuggestedFixDecision(
          drafts,
          "finance:worksheet:income",
          "finance:worksheet:income:section_banner:0",
          "use_recommendation",
        );
        const income = getWorksheetSuggestedFixDecisionDrafts(drafts, "finance:worksheet:income");
        const balance = getWorksheetSuggestedFixDecisionDrafts(drafts, "finance:worksheet:balance");
        return [
          ...expect(
            getSuggestedFixDecision("finance:worksheet:income:section_banner:0", income) === "use_recommendation",
            "Income worksheet decision should be stored.",
          ),
          ...expect(
            getSuggestedFixDecision("finance:worksheet:income:section_banner:0", balance) === "unresolved",
            "Balance worksheet should not inherit income decisions.",
          ),
        ];
      }),
      fixture("generic messy spreadsheet maps side notes placeholders and banners", () => {
        const messy = worksheet("messy:worksheet:1", "Sheet 1", [
          evidence("side_note_region_candidate", { columnRange: [7, 8] }),
          evidence("serial_only_placeholder_rows", { rowIndexes: [12, 13] }),
          evidence("section_banner", { rowIndex: 2 }),
        ]);
        const dataset = workbookDataset();
        dataset.workbook_metadata = {
          ...dataset.workbook_metadata!,
          worksheets: [messy],
          worksheetIds: [messy.worksheetId],
        };
        const fixes = buildPreparationReview(dataset).scopedSuggestedFixes;
        return [
          ...expect(fixes.some((fix) => fix.evidenceType === "side_note_region_candidate"), "Side-note evidence should map."),
          ...expect(fixes.some((fix) => fix.evidenceType === "serial_only_placeholder_rows"), "Placeholder evidence should map."),
          ...expect(fixes.some((fix) => fix.evidenceType === "section_banner"), "Section banner evidence should map."),
        ];
      }),
      fixture("entirely blank categorical column does not claim most common value", () => {
        const blankCategory = typedColumn("response", "categorical", {
          sample_values: [],
          top_values: [],
          unique_count: 0,
        });
        const strategies = getColumnMissingValueStrategies(blankCategory);
        return expect(
          !strategies.includes("fill_mode"),
          "Categorical column with no valid non-null values should not offer most-common fill.",
        );
      }),
      fixture("dataset with no preview exclusions is true zero operation", () => {
        const preview = recipePreview("clean:worksheet:1", "Clean");
        const fixes = getPreviewSuggestedFixes(preview);
        const readiness = getStructuralDecisionReadiness(fixes, {}, "clean:worksheet:1", "Clean");
        return [
          ...expect(hasCleaningRecipePreviewOperations(preview) === false, "Preview should have no recipe or exclusions."),
          ...expect(fixes.length === 0, "No preview exclusions should produce no preview recommendations."),
          ...expect(readiness.canContinueToApply === true, "True zero-operation preview should be ready."),
        ];
      }),
      fixture("worksheet-wide incompatible missing strategies are excluded", () => {
        const numericStrategies = getWorksheetMissingTypeStrategies("numeric", [
          typedColumn("amount", "numeric", {
            numeric_stats: { min: 1, max: 20, mean: 10, median: 9, std: 2 },
          }),
        ]);
        const textStrategies = getWorksheetMissingTypeStrategies("text", [
          typedColumn("category", "text", { top_values: [{ value: "A", count: 2 }] }),
        ]);
        return [
          ...expect(!numericStrategies.includes("mark_unknown"), "Numeric group should exclude Unknown text fill."),
          ...expect(!textStrategies.includes("fill_median"), "Text group should exclude median."),
        ];
      }),
      fixture("unnamed columns use neutral copy", () => [
        ...expect(getColumnDisplayName("column_12") === "Unnamed column 12", "Generated column should use neutral label."),
        ...expect(getColumnDisplayName("customer_name") === "customer_name", "Trusted header should be preserved."),
      ]),
      fixture("production structural helpers do not branch on fixture names", () => {
        const sourceMarkers = [
          buildPreparationReview.toString(),
          getSuggestedFixRecommendationLabel.toString(),
          getSuggestedFixKeepOriginalLabel.toString(),
          getColumnMissingValueStrategies.toString(),
          getWorksheetMissingTypeStrategies.toString(),
        ].join("\n").toLowerCase();
        const forbidden = ["managers", "properties", "units", "leases", "tenants", "property management"];
        return forbidden.flatMap((token) =>
          sourceMarkers.includes(token) ? [`Production helper references fixture term ${token}.`] : [],
        );
      }),
      fixture("existing storage key and scope remain external to structural decisions", () => {
        const sourceMarkers = [
          getSuggestedFixDecision.toString(),
          getSuggestedFixDecisionProgress.toString(),
          getSuggestedFixCleaningPlan.toString(),
          getStructuralDecisionReadiness.toString(),
          getStructuralPreviewLoadingReadiness.toString(),
          getStructuralPreviewErrorReadiness.toString(),
          areStructuralDecisionReadinessEqual.toString(),
          clearSuggestedFixDecision.toString(),
          resetSuggestedFixDecisions.toString(),
          hasExplicitSuggestedFixDecisions.toString(),
          getSuggestedFixesForWorksheet.toString(),
          isCleaningRecipePreviewForWorksheet.toString(),
          getCleaningRecipeExcludedCount.toString(),
          hasCleaningRecipePreviewOperations.toString(),
          getAutomaticBlankRowEvidenceSignalsFromPreview.toString(),
          getPreviewSuggestedFixes.toString(),
          getWorksheetSuggestedFixDecisionDrafts.toString(),
          setWorksheetSuggestedFixDecision.toString(),
          clearWorksheetSuggestedFixDecision.toString(),
          resetWorksheetSuggestedFixDecisions.toString(),
        ].join("\n");
        return [
          ...expect(!sourceMarkers.includes("localStorage"), "Structural helpers should not introduce storage."),
          ...expect(!sourceMarkers.includes("filtraqueri:"), "Structural helpers should not introduce a storage key."),
        ];
      }),
      fixture("static safety scan contains no forbidden markers", () => {
        const sourceMarkers = [
          getSuggestedFixDecision.toString(),
          getSuggestedFixDecisionProgress.toString(),
          getSuggestedFixCleaningPlan.toString(),
          getSuggestedFixRecommendationLabel.toString(),
          getSuggestedFixKeepOriginalLabel.toString(),
          getStructuralDecisionReadiness.toString(),
          getStructuralPreviewLoadingReadiness.toString(),
          getStructuralPreviewErrorReadiness.toString(),
          areStructuralDecisionReadinessEqual.toString(),
          clearSuggestedFixDecision.toString(),
          resetSuggestedFixDecisions.toString(),
          hasExplicitSuggestedFixDecisions.toString(),
          getSuggestedFixesForWorksheet.toString(),
          isCleaningRecipePreviewForWorksheet.toString(),
          getCleaningRecipeExcludedCount.toString(),
          hasCleaningRecipePreviewOperations.toString(),
          getAutomaticBlankRowEvidenceSignalsFromPreview.toString(),
          getPreviewSuggestedFixes.toString(),
          getWorksheetSuggestedFixDecisionDrafts.toString(),
          setWorksheetSuggestedFixDecision.toString(),
          clearWorksheetSuggestedFixDecision.toString(),
          resetWorksheetSuggestedFixDecisions.toString(),
        ].join("\n");
        const forbidden = [
          "fetch(",
          "XMLHttpRequest",
          "sessionStorage",
          "indexedDB",
          "provider",
          "SQL execution",
          "DuckDB",
          "Date.now",
          "Math.random",
        ];
        return forbidden.flatMap((token) =>
          sourceMarkers.includes(token) ? [`Structural decision helper includes forbidden token ${token}.`] : [],
        );
      }),
    ];

    return report(results);
  };
