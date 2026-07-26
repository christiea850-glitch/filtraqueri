import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type { AnalysisScopeSelection, WorksheetMetadata } from "../../../workbook";
import { createAdaptiveReportProposalFallback } from "../adaptiveReportProposalUiAdapter";
import { createBusinessSqlPlanCandidateViewModel } from "../adaptiveProposalBusinessSqlBridgeUiAdapter";
import { createAdaptiveProposalBusinessSqlPreviewHandoff } from "../adaptiveProposalBusinessSqlPreviewHandoff";
import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import { createBusinessSqlRenderPreviewFromWorkspaceContext } from "../businessSqlRenderPreviewUiAdapter";
import {
  detectBusinessSqlMeasureAmbiguity,
  resolveBusinessSqlMeasureAmbiguity,
} from "../businessSqlMeasureAmbiguity";
import { detectBusinessIntent } from "../businessIntentGrounding";
import {
  createSemanticMeasureClarificationPanelResetKey,
  createSemanticMeasureClarificationPanelViewModel,
} from "../SemanticMeasureClarificationPanel";
import {
  createMeasureClarificationScopeFingerprint,
  createMeasureClarificationSelectionKey,
} from "../SqlAssistantPanel";
import { createSqlAskFiltraQueriSuggestionModel } from "../sqlAskFiltraQueriAdapter";
import { proposeAdaptiveReport } from "../adaptiveReportProposal";
import { attachBusinessSqlJoinResolutionToPlan } from "../businessSqlQueryPlanJoinResolution";
import { evaluateBusinessSqlRenderability } from "../businessSqlRenderabilityGate";
import { renderBusinessSqlFromRenderability } from "../businessSqlRenderer";
import { createBusinessSqlPreviewInsertProvenance } from "../businessSqlPreviewProvenance";
import { createExecutedQuestionSnapshot } from "../sqlPreviewResultAdapter";
import { createSqlResultProvenanceViewModel } from "../sqlResultProvenance";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type BusinessSqlMeasureAmbiguityFixtureReport = {
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
  inferred_type: SchemaColumn["inferred_type"],
): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "DOUBLE" : "VARCHAR",
  inferred_type,
  null_count: 0,
  unique_count: inferred_type === "categorical" ? 4 : 10,
  sample_values: [],
});

const employeesWorksheet: WorksheetMetadata = {
  worksheetId: "worksheet:employees",
  workbookId: "workbook:employees",
  displayName: "Employees",
  sheetName: "Employees",
  tableName: "employees",
  originalIndex: 0,
  status: "ready",
  rowCount: 25,
  columnCount: 4,
  schema: [
    column("employee_id", "text"),
    column("department", "categorical"),
    column("salary", "numeric"),
    column("hire_date", "date"),
  ],
  visibleColumns: ["employee_id", "department", "salary", "hire_date"],
  hiddenColumns: [],
  normalization: {
    version: 1,
    normalizedAt: "2026-01-01T00:00:00.000Z",
    headerRowIndex: 0,
    skippedLeadingRows: 0,
    headerDetectionStrategy: "fixture",
    headerDetectionConfidence: "high",
    headerDetectionWarning: null,
    originalFirstRowPreview: null,
    selectedHeaderRowPreview: ["employee_id", "department", "salary", "hire_date"],
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
};

const dataset: DatasetMetadata = {
  dataset_id: "dataset:employees",
  filename: "employees.xlsx",
  original_filename: "employees.xlsx",
  table_name: "employees",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 25,
  column_count: 4,
  schema: employeesWorksheet.schema,
  workbook_metadata: {
    workbookId: "workbook:employees",
    workspaceId: "workspace:employees",
    name: "Employees",
    status: "ready",
    sourceFile: {
      originalFilename: "employees.xlsx",
      storedPath: null,
      mimeType: null,
      byteSize: null,
      uploadedAt: "2026-01-01T00:00:00.000Z",
    },
    worksheetIds: [employeesWorksheet.worksheetId],
    activeWorksheetId: employeesWorksheet.worksheetId,
    activeAnalysisSource: null,
    cleanedWorkingCopies: [],
    worksheets: [employeesWorksheet],
    tableMappings: [
      {
        sheetName: employeesWorksheet.sheetName,
        tableName: employeesWorksheet.tableName,
        originalIndex: employeesWorksheet.originalIndex,
      },
    ],
    relationshipCandidates: [],
    acceptedRelationshipContracts: [],
    ingestionProfile: {
      maxWorksheets: 1,
      maxRowsPerWorksheetProfile: 25,
      maxColumnsPerWorksheet: 4,
      maxRelationshipSampleRows: 25,
      maxPreviewRows: 25,
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
  },
};

const scope: AnalysisScopeSelection[] = [
  {
    worksheetId: employeesWorksheet.worksheetId,
    sourceType: "original",
    tableName: employeesWorksheet.tableName,
    originalTableName: employeesWorksheet.tableName,
  },
];

const question = "Show the top departments.";
const intent = detectBusinessIntent(question);
const ambiguity = detectBusinessSqlMeasureAmbiguity({
  prompt: question,
  intent,
  worksheets: [employeesWorksheet],
  appliedScopeSelections: scope,
});

const optionByLabel = (label: string) =>
  ambiguity?.options.find((option) => option.label === label) || null;

const resolvedPipeline = (optionLabel: string) => {
  if (!ambiguity) return null;
  const option = optionByLabel(optionLabel);
  if (!option) return null;
  const resolution = resolveBusinessSqlMeasureAmbiguity({
    ambiguity,
    chosenOptionId: option.optionId,
    originalIntent: intent,
  });
  if (!resolution.resolved) return null;
  const proposal = proposeAdaptiveReport({
    prompt: question,
    detectedIntent: resolution.intent,
    worksheets: [employeesWorksheet],
    appliedScopeSelections: scope,
    selectedGuidanceDialect: "duckdb",
  });
  const bridge = createBusinessSqlPlanFromAdaptiveProposal({
    proposal,
    selectedGuidanceDialect: "duckdb",
  });
  if (!bridge.plan) return null;
  const integrated = attachBusinessSqlJoinResolutionToPlan({ plan: bridge.plan });
  const renderability = evaluateBusinessSqlRenderability({ integrated });
  const renderResult = renderBusinessSqlFromRenderability({ integrated, renderability });
  return { option, resolution, proposal, bridge, integrated, renderability, renderResult };
};

const pendingFallback = createAdaptiveReportProposalFallback({
  taskPrompt: question,
  dataset,
  selectedDialect: "duckdb",
  appliedScopeLabels: ["Employees"],
  recommendations: [],
});

const totalSalaryPipeline = resolvedPipeline("Total salary");
const averageSalaryPipeline = resolvedPipeline("Average salary");
const employeeCountPipeline = resolvedPipeline("Employee count");

const selectionFor = (
  store: Record<string, string>,
  key: string | null,
  currentAmbiguity: typeof ambiguity,
): string | null => {
  if (!key || !currentAmbiguity) return null;
  const stored = store[key] || null;
  return stored && currentAmbiguity.options.some((option) => option.optionId === stored)
    ? stored
    : null;
};

const fixtures: Fixture[] = [
  {
    name: "top departments produces a pending measure ambiguity",
    assert: () => [
      ...(ambiguity ? [] : ["Expected pending ambiguity."]),
      ...(ambiguity?.groupingFieldName === "department" ? [] : ["Expected department grouping field."]),
      ...(ambiguity?.requestedDirection === "desc" ? [] : ["Expected descending requested direction."]),
      ...(intent.metrics.length === 0 ? [] : ["Pending ambiguity should not have a metric."]),
    ],
  },
  {
    name: "ambiguity options are grounded compatible and deterministic",
    assert: () => {
      const labels = ambiguity?.options.map((option) => option.label) || [];
      return [
        ...(labels.includes("Employee count") ? [] : ["Expected Employee count option."]),
        ...(labels.includes("Total salary") ? [] : ["Expected Total salary option."]),
        ...(labels.includes("Average salary") ? [] : ["Expected Average salary option."]),
        ...(ambiguity?.options.every((option) => option.tableName === "employees")
          ? []
          : ["Options must come from grounded employees table."]),
        ...(labels.join(",") === "Employee count,Total salary,Average salary"
          ? []
          : [`Unexpected deterministic option order: ${labels.join(",")}`]),
      ];
    },
  },
  {
    name: "no Business SQL plan candidate is created while ambiguity is pending",
    assert: () => {
      const model = createBusinessSqlPlanCandidateViewModel({
        fallback: pendingFallback,
        dataset,
        businessSqlRenderPreview: createBusinessSqlRenderPreviewFromWorkspaceContext({
          taskPrompt: question,
          selectedGuidanceDialect: "duckdb",
          appliedScopeSelections: scope,
          worksheets: [employeesWorksheet],
        }).preview,
        activeSqlDraft: "",
        selectedGuidanceDialect: "duckdb",
      });
      return [
        ...(pendingFallback.measureAmbiguity ? [] : ["Expected pending fallback ambiguity."]),
        ...(pendingFallback.proposal === null ? [] : ["Pending ambiguity must not create an adaptive proposal."]),
        ...(model === null ? [] : ["Pending ambiguity must not create a plan candidate."]),
      ];
    },
  },
  {
    name: "adaptive fit classification is skipped while ambiguity is pending",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: question,
        dataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: scope,
      });
      return [
        ...(model.measureAmbiguity ? [] : ["Expected Ask model measure ambiguity."]),
        ...(model.adaptiveFitSummaries.length === 0 ? [] : ["Adaptive fit summaries must be empty."]),
        ...(model.recommendedAnalysis.primary === null ? [] : ["Recommended analysis should be empty while pending."]),
      ];
    },
  },
  {
    name: "preview handoff is blocked while ambiguity is pending",
    assert: () => {
      const previewResult = createBusinessSqlRenderPreviewFromWorkspaceContext({
        taskPrompt: question,
        selectedGuidanceDialect: "duckdb",
        appliedScopeSelections: scope,
        worksheets: [employeesWorksheet],
      });
      return [
        ...(previewResult.preview.status === "needs_review" ? [] : ["Expected blocked/needs-review preview."]),
        ...(previewResult.preview.sql === null ? [] : ["Pending ambiguity preview must not contain SQL."]),
        ...(previewResult.preview.actions.canInsertSql === false ? [] : ["Pending ambiguity cannot insert SQL."]),
        ...(previewResult.preview.actions.canRunSql === false ? [] : ["Pending ambiguity cannot run SQL."]),
      ];
    },
  },
  {
    name: "clarification panel view model renders options without auto-selection",
    assert: () => {
      if (!ambiguity) return ["Expected ambiguity."];
      const model = createSemanticMeasureClarificationPanelViewModel(ambiguity);
      return [
        ...(model.optionLabels.includes("Total salary") ? [] : ["Expected Total salary option label."]),
        ...(model.initialSelectedOptionId === null ? [] : ["Panel must not auto-select an option."]),
        ...(model.applyDisabled ? [] : ["Apply must be disabled before selection."]),
        ...(model.noSqlPreview && model.noInsert && model.noRun
          ? []
          : ["Panel must not preview, insert, or run SQL."]),
      ];
    },
  },
  {
    name: "same prompt in different SQL tabs does not reuse measure selection",
    assert: () => {
      if (!ambiguity) return ["Expected ambiguity."];
      const option = optionByLabel("Total salary");
      if (!option) return ["Expected Total salary option."];
      const scopeFingerprint = createMeasureClarificationScopeFingerprint(scope);
      const tabAKey = createMeasureClarificationSelectionKey({
        activeSqlTabId: "sql-tab:a",
        scopeFingerprint,
        ambiguityId: ambiguity.ambiguityId,
      });
      const tabBKey = createMeasureClarificationSelectionKey({
        activeSqlTabId: "sql-tab:b",
        scopeFingerprint,
        ambiguityId: ambiguity.ambiguityId,
      });
      const store = { [tabAKey]: option.optionId };
      return [
        ...(selectionFor(store, tabAKey, ambiguity) === option.optionId
          ? []
          : ["Expected same tab to preserve valid session selection."]),
        ...(selectionFor(store, tabBKey, ambiguity) === null
          ? []
          : ["Expected different tab not to reuse selection."]),
      ];
    },
  },
  {
    name: "applied or selected scope changes invalidate old clarification selection",
    assert: () => {
      if (!ambiguity) return ["Expected ambiguity."];
      const option = optionByLabel("Total salary");
      if (!option) return ["Expected Total salary option."];
      const originalScopeKey = createMeasureClarificationSelectionKey({
        activeSqlTabId: "sql-tab:a",
        scopeFingerprint: [
          `applied:${createMeasureClarificationScopeFingerprint(scope)}`,
          `selected:${createMeasureClarificationScopeFingerprint(scope)}`,
        ].join("||"),
        ambiguityId: ambiguity.ambiguityId,
      });
      const changedScopeKey = createMeasureClarificationSelectionKey({
        activeSqlTabId: "sql-tab:a",
        scopeFingerprint: [
          `applied:${createMeasureClarificationScopeFingerprint(scope)}`,
          `selected:${createMeasureClarificationScopeFingerprint([
            {
              worksheetId: "worksheet:employees-q2",
              sourceType: "original",
              tableName: "employees_q2",
              originalTableName: "employees_q2",
            },
          ])}`,
        ].join("||"),
        ambiguityId: ambiguity.ambiguityId,
      });
      const store = { [originalScopeKey]: option.optionId };
      return selectionFor(store, changedScopeKey, ambiguity) === null
        ? []
        : ["Expected changed applied or selected scope not to reuse old selection."];
    },
  },
  {
    name: "ambiguity id and option-set changes reset or ignore stale selection",
    assert: () => {
      if (!ambiguity) return ["Expected ambiguity."];
      const option = optionByLabel("Total salary");
      if (!option) return ["Expected Total salary option."];
      const scopeFingerprint = createMeasureClarificationScopeFingerprint(scope);
      const originalKey = createMeasureClarificationSelectionKey({
        activeSqlTabId: "sql-tab:a",
        scopeFingerprint,
        ambiguityId: ambiguity.ambiguityId,
      });
      const changedAmbiguity = {
        ...ambiguity,
        ambiguityId: `${ambiguity.ambiguityId}:changed`,
      };
      const changedKey = createMeasureClarificationSelectionKey({
        activeSqlTabId: "sql-tab:a",
        scopeFingerprint,
        ambiguityId: changedAmbiguity.ambiguityId,
      });
      const changedOptions = {
        ...ambiguity,
        options: ambiguity.options.filter((candidate) => candidate.optionId !== option.optionId),
      };
      const store = { [originalKey]: option.optionId };
      return [
        ...(selectionFor(store, changedKey, changedAmbiguity) === null
          ? []
          : ["Expected changed ambiguity id not to reuse old selection."]),
        ...(selectionFor(store, originalKey, changedOptions) === null
          ? []
          : ["Expected missing candidate option id to be ignored."]),
        ...(createSemanticMeasureClarificationPanelResetKey(ambiguity) !==
        createSemanticMeasureClarificationPanelResetKey(changedAmbiguity)
          ? []
          : ["Expected panel reset key to change with ambiguity id."]),
        ...(createSemanticMeasureClarificationPanelResetKey(ambiguity) !==
        createSemanticMeasureClarificationPanelResetKey(changedOptions)
          ? []
          : ["Expected panel reset key to change with candidate option ids."]),
      ];
    },
  },
  {
    name: "selecting Total salary resolves to SUM salary descending without limit",
    assert: () => [
      ...(totalSalaryPipeline?.bridge.state === "render_ready_plan" ? [] : ["Expected render-ready bridge."]),
      ...(totalSalaryPipeline?.bridge.plan?.measures.length === 1 &&
      totalSalaryPipeline.bridge.plan.measures[0]?.kind === "sum" &&
      totalSalaryPipeline.bridge.plan.measures[0]?.field === "salary"
        ? []
        : ["Expected one SUM(salary) measure."]),
      ...(totalSalaryPipeline?.bridge.plan?.orderBy[0]?.target.kind === "measure" &&
      totalSalaryPipeline.bridge.plan.orderBy[0]?.target.measureId ===
        totalSalaryPipeline.bridge.plan.measures[0]?.measureId &&
      totalSalaryPipeline.bridge.plan.orderBy[0]?.direction === "desc"
        ? []
        : ["Expected descending sort by selected measure id."]),
      ...(totalSalaryPipeline?.bridge.plan?.rowLimit === null ? [] : ["Expected rowLimit null."]),
      ...(totalSalaryPipeline?.renderResult.sql?.includes("LIMIT")
        ? ["Resolved top departments must not add LIMIT."]
        : []),
    ],
  },
  {
    name: "selecting Average salary resolves to AVG salary descending without limit",
    assert: () => [
      ...(averageSalaryPipeline?.bridge.plan?.measures.length === 1 &&
      averageSalaryPipeline.bridge.plan.measures[0]?.kind === "average" &&
      averageSalaryPipeline.bridge.plan.measures[0]?.field === "salary"
        ? []
        : ["Expected one AVG(salary) measure."]),
      ...(averageSalaryPipeline?.bridge.plan?.orderBy[0]?.direction === "desc"
        ? []
        : ["Expected descending sort."]),
      ...(averageSalaryPipeline?.bridge.plan?.rowLimit === null ? [] : ["Expected rowLimit null."]),
    ],
  },
  {
    name: "selecting Employee count resolves to existing count behavior descending",
    assert: () => [
      ...(employeeCountPipeline?.resolution.intent.analysisPath?.aggregation === "count"
        ? []
        : ["Expected count-compatible analysisPath aggregation."]),
      ...(employeeCountPipeline?.resolution.intent.analysisPath?.aggregation === "sum"
        ? ["Employee count must not resolve internally as sum."]
        : []),
      ...(employeeCountPipeline?.bridge.plan?.measures.length === 1 &&
      employeeCountPipeline.bridge.plan.measures[0]?.kind === "count_entities"
        ? []
        : ["Expected one count measure."]),
      ...(employeeCountPipeline?.renderResult.sql?.includes("COUNT(")
        ? []
        : ["Expected existing count SQL expression."]),
      ...(employeeCountPipeline?.renderResult.sql?.includes("SUM(")
        ? ["Employee count must not render SUM SQL."]
        : []),
      ...(employeeCountPipeline?.bridge.plan?.orderBy[0]?.direction === "desc"
        ? []
        : ["Expected descending count sort."]),
      ...(employeeCountPipeline?.bridge.plan?.rowLimit === null ? [] : ["Expected rowLimit null."]),
    ],
  },
  {
    name: "clarification decisions preserve friendly selected option labels",
    assert: () => [
      ...(totalSalaryPipeline?.resolution.decision.chosenOptionLabel === "Total salary"
        ? []
        : ["Expected Total salary decision label."]),
      ...(averageSalaryPipeline?.resolution.decision.chosenOptionLabel === "Average salary"
        ? []
        : ["Expected Average salary decision label."]),
      ...(employeeCountPipeline?.resolution.decision.chosenOptionLabel === "Employee count"
        ? []
        : ["Expected Employee count decision label."]),
      ...(totalSalaryPipeline &&
      totalSalaryPipeline.resolution.decision.chosenOptionId === totalSalaryPipeline.option.optionId
        ? []
        : ["Expected chosen option id to be preserved."]),
      ...(totalSalaryPipeline &&
      totalSalaryPipeline.resolution.decision.presentedOptionIds.includes(totalSalaryPipeline.option.optionId)
        ? []
        : ["Expected presented option ids to be preserved."]),
    ],
  },
  {
    name: "clarification decision is preserved through preview insert and run provenance",
    assert: () => {
      if (!totalSalaryPipeline) return ["Expected total salary pipeline."];
      const handoff = createAdaptiveProposalBusinessSqlPreviewHandoff({
        candidateState: totalSalaryPipeline.bridge.state,
        plan: totalSalaryPipeline.bridge.plan,
        readiness: totalSalaryPipeline.bridge.readiness,
        issues: totalSalaryPipeline.bridge.issues,
        activeSqlDraft: "",
        existingPreview: null,
        clarificationDecision: totalSalaryPipeline.resolution.decision,
      });
      const sql = handoff.preview?.sql || "";
      const insertProvenance = createBusinessSqlPreviewInsertProvenance({
        activeTabId: "tab:1",
        planId: handoff.preview?.planId || "missing",
        sqlText: sql,
        clarificationDecision: handoff.preview?.clarificationDecision,
      });
      const executedQuestion = createExecutedQuestionSnapshot({
        taskPrompt: question,
        sqlAtRun: sql,
        ranAt: "2026-01-01T00:00:00.000Z",
        sourceLabel: "Employees",
        sourceTableName: "employees",
        dataset,
        clarificationDecision: insertProvenance.clarificationDecision,
      });
      const viewModel = createSqlResultProvenanceViewModel({
        previewResult: { columns: [], rows: [], message: "done", executedQuestion },
        currentTaskPrompt: question,
        currentSqlDraft: sql,
      });
      const legacyViewModel = createSqlResultProvenanceViewModel({
        previewResult: {
          columns: [],
          rows: [],
          message: "done",
          executedQuestion: {
            ...executedQuestion,
            clarificationDecision: insertProvenance.clarificationDecision
              ? {
                  ambiguityId: insertProvenance.clarificationDecision.ambiguityId,
                  chosenOptionId: insertProvenance.clarificationDecision.chosenOptionId,
                  presentedOptionIds: insertProvenance.clarificationDecision.presentedOptionIds,
                }
              : undefined,
          },
        },
        currentTaskPrompt: question,
        currentSqlDraft: sql,
      });
      return [
        ...(insertProvenance.clarificationDecision?.ambiguityId === ambiguity?.ambiguityId
          ? []
          : ["Expected insert provenance ambiguity id."]),
        ...(executedQuestion.clarificationDecision?.chosenOptionId === totalSalaryPipeline.option.optionId
          ? []
          : ["Expected executed snapshot chosen option id."]),
        ...(insertProvenance.clarificationDecision?.chosenOptionLabel === "Total salary"
          ? []
          : ["Expected insert provenance friendly option label."]),
        ...(executedQuestion.clarificationDecision?.chosenOptionLabel === "Total salary"
          ? []
          : ["Expected executed snapshot friendly option label."]),
        ...(viewModel.clarificationText === "Clarification: ranked departments by Total salary."
          ? []
          : [`Expected friendly result provenance clarification, received ${viewModel.clarificationText || "none"}.`]),
        ...(legacyViewModel.clarificationText?.includes(totalSalaryPipeline.option.optionId)
          ? []
          : ["Expected legacy clarification provenance fallback to chosen option id."]),
      ];
    },
  },
  {
    name: "explicit PS-1b aggregate question does not trigger clarification",
    assert: () => {
      const explicitIntent = detectBusinessIntent("Show departments with the highest average salary.");
      const explicitAmbiguity = detectBusinessSqlMeasureAmbiguity({
        prompt: "Show departments with the highest average salary.",
        intent: explicitIntent,
        worksheets: [employeesWorksheet],
        appliedScopeSelections: scope,
      });
      return explicitAmbiguity === null ? [] : ["Explicit aggregate question must not trigger clarification."];
    },
  },
  {
    name: "resolved previews never auto-insert or auto-run",
    assert: () => [
      ...(totalSalaryPipeline?.bridge.noInsertPerformed ? [] : ["Bridge must not insert."]),
      ...(totalSalaryPipeline?.bridge.noRunPerformed ? [] : ["Bridge must not run."]),
      ...(totalSalaryPipeline?.renderResult.inserted === false ? [] : ["Renderer must not insert."]),
      ...(totalSalaryPipeline?.renderResult.ranQuery === false ? [] : ["Renderer must not run."]),
    ],
  },
];

export function runBusinessSqlMeasureAmbiguityFixtures(): BusinessSqlMeasureAmbiguityFixtureReport {
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

export const allBusinessSqlMeasureAmbiguityFixturesPass = (): boolean =>
  runBusinessSqlMeasureAmbiguityFixtures().failed.length === 0;
