import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import type { CleanPrepareStep } from "../../features/cleanPrepare/useCleanPrepareStep";
import { buildPreparationSignalReport } from "../../features/dataPreparation/preparationSignals";
import {
  buildWorksheetMissingValuePlan,
  classifyColumnMissingTypeGroup,
  clearMissingValueDecision,
  createMissingValueDecision,
  createMissingValueDecisionKey,
  decisionNeedsCustomValue,
  getColumnMissingValueStrategies,
  getWorksheetMissingTypeDecisionColumn,
  getWorksheetMissingTypeStrategies,
  missingValueStrategyHelpers,
  missingValueStrategyLabels,
  missingValueStrategyShortLabels,
  readMissingValueDecisions,
  resetMissingValueDecisionsForWorksheet,
  WORKSHEET_DECISION_COLUMN,
  worksheetMissingTypeGroupLabels,
  worksheetMissingValueStrategies,
  writeMissingValueDecisions,
  type MissingValueStrategy,
  type WorksheetMissingTypeGroup,
} from "../../features/dataPreparation/missingValueDecisions";
import {
  getWorkbookMetadata,
  type WorksheetMetadata,
  type WorksheetStructuralDecisionPlan,
  type WorkbookTransformationPlan,
  type WorksheetTemplateStructureEvidence,
  type WorksheetTemplateStructureEvidenceType,
} from "../../features/workbook";
import {
  applyCleaningRecipe,
  getCleaningRecipePreview,
  type CleaningRecipeApplyResponse,
  type CleaningRecipePreview,
} from "../../services/api";

type ApplyState =
  | { status: "idle" }
  | { status: "confirming" }
  | { status: "applying" }
  | { status: "success"; result: CleaningRecipeApplyResponse }
  | { status: "error"; message: string };

export type RecipePreviewStatus = "idle" | "loading" | "ready" | "error";

type ActivationState =
  | { status: "idle" }
  | { status: "switching"; worksheetId: string }
  | { status: "error"; message: string };

type CleanPrepareReviewPanelProps = {
  dataset: DatasetMetadata;
  sourceName: string;
  onAnalysisSourceSelect?: (worksheetId: string, source: "cleaned" | "original") => Promise<void>;
  onPreviewDataset?: (worksheetId: string) => void;
  restoreContext?: {
    worksheetId: string;
    scrollY: number;
    requestId: number;
  } | null;
  onRestoreContextConsumed?: () => void;
  onContinueInAnalyst?: () => void;
  // When true, the panel is mounted inside a dedicated page (FocusedWorkspaceShell)
  // that already provides intro framing and Back navigation. We then skip the
  // internal "Intelligence Assistant" intro header and the toggle pill, and
  // render the review section directly. No execution change.
  embedded?: boolean;
  activeStep?: CleanPrepareStep;
  onStructuralDecisionReadinessChange?: (readiness: StructuralDecisionReadiness) => void;
  transformationPlan?: WorkbookTransformationPlan | null;
};

type PreparationPriority = "low" | "medium" | "high";

type PreparationIssue = {
  id: string;
  title: string;
  detail: string;
};

export type SuggestedFix = {
  id: string;
  recommendationId: string;
  evidenceType: string;
  evidenceSignalId?: string;
  worksheetId?: string;
  worksheetName?: string;
  affectedRows?: number[];
  affectedColumnIndexes?: number[];
  title: string;
  detail: string;
};

export type SuggestedFixDecision =
  | "unresolved"
  | "use_recommendation"
  | "keep_original"
  | "decide_later";

export type SuggestedFixDecisionMap = Record<string, SuggestedFixDecision>;
export type WorksheetSuggestedFixDecisionDrafts = Record<string, SuggestedFixDecisionMap>;

export type PreparationReview = {
  priority: PreparationPriority;
  issues: PreparationIssue[];
  scopedSuggestedFixes: SuggestedFix[];
  suggestedFixes: SuggestedFix[];
};

type StructuralEvidenceSignal = {
  id: string;
  worksheetId: string;
  worksheetName: string;
  evidence: WorksheetTemplateStructureEvidence;
};

const suggestedFixDecisionStatusLabels: Record<SuggestedFixDecision, string> = {
  unresolved: "Needs decision",
  use_recommendation: "Recommendation accepted",
  keep_original: "Original preserved",
  decide_later: "Deferred",
};

export const structuralDecisionEmptyStateCopy =
  "No structural issues require a decision for this worksheet. Other worksheets may have their own recommendations.";

export const getSuggestedFixRecommendationLabel = (fix: SuggestedFix) => {
  switch (fix.evidenceType) {
    case "side_note_region_candidate":
      return "Exclude side-note columns from the cleaned copy";
    case "generated_columns":
      return "Review generated column names before creating the cleaned copy";
    case "sparse_layout_gap":
      return "Exclude layout separator rows from the cleaned copy";
    case "automatic_blank_row":
      return "Exclude blank layout rows from the cleaned copy";
    case "serial_only_placeholder_rows":
      return "Remove empty template slots from the cleaned copy";
    case "repeated_header":
      return "Remove repeated header rows from the cleaned copy";
    case "section_banner":
      return "Keep section labels out of data rows";
    case "date_title_row":
      return "Carry section dates into the cleaned copy";
    case "missing_values":
    case "repeated_missing_pattern":
      return "Review blanks before filling values";
  }
  return fix.title;
};

export const getSuggestedFixKeepOriginalLabel = (fix: SuggestedFix) => {
  switch (fix.evidenceType) {
    case "side_note_region_candidate":
      return "Keep side-note columns";
    case "generated_columns":
      return "Keep generated columns";
    case "sparse_layout_gap":
      return "Keep layout separator rows";
    case "automatic_blank_row":
      return "Keep blank layout rows";
    case "serial_only_placeholder_rows":
      return "Keep empty template slots";
    case "repeated_header":
      return "Keep repeated header rows";
    case "section_banner":
      return "Keep section labels as rows";
    case "date_title_row":
      return "Keep section dates as rows";
    case "missing_values":
    case "repeated_missing_pattern":
      return "Keep blanks as-is";
  }
  return "Do not apply this fix";
};

export type SuggestedFixDecisionProgress = {
  total: number;
  resolved: number;
  unresolved: number;
  deferred: number;
};

export type StructuralDecisionReadiness = {
  worksheetId: string;
  worksheetName: string;
  totalCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  deferredCount: number;
  canContinueToApply: boolean;
  blockingMessage: string | null;
};

export type StructuralPreviewLifecycleState = {
  status: RecipePreviewStatus;
  isPending: boolean;
  isReady: boolean;
  isError: boolean;
};

type StructuralPreviewValidation =
  | { ok: true; preview: CleaningRecipePreview }
  | { ok: false; message: string };

const STRUCTURAL_PREVIEW_TIMEOUT_MS = 15000;

export const getSuggestedFixDecision = (
  fixId: string,
  decisions: SuggestedFixDecisionMap,
): SuggestedFixDecision => decisions[fixId] || "unresolved";

export const getSuggestedFixDecisionProgress = (
  fixes: SuggestedFix[],
  decisions: SuggestedFixDecisionMap,
): SuggestedFixDecisionProgress =>
  fixes.reduce<SuggestedFixDecisionProgress>(
    (progress, fix) => {
      const decision = getSuggestedFixDecision(fix.id, decisions);
      if (decision === "decide_later") return { ...progress, deferred: progress.deferred + 1 };
      if (decision === "unresolved") return { ...progress, unresolved: progress.unresolved + 1 };
      return { ...progress, resolved: progress.resolved + 1 };
    },
    { total: fixes.length, resolved: 0, unresolved: 0, deferred: 0 },
  );

export const getStructuralDecisionReadiness = (
  fixes: SuggestedFix[],
  decisions: SuggestedFixDecisionMap,
  worksheetId = "dataset",
  worksheetName = "this worksheet",
): StructuralDecisionReadiness => {
  const progress = getSuggestedFixDecisionProgress(fixes, decisions);
  const canContinueToApply = progress.unresolved === 0;
  const blockingMessage = canContinueToApply
    ? null
    : `${progress.unresolved.toLocaleString()} recommendation${
        progress.unresolved === 1 ? "" : "s"
      } still need a decision. Resolve or explicitly defer ${
        progress.unresolved === 1 ? "it" : "them"
      } before continuing.`;

  return {
    worksheetId,
    worksheetName,
    totalCount: progress.total,
    resolvedCount: progress.resolved,
    unresolvedCount: progress.unresolved,
    deferredCount: progress.deferred,
    canContinueToApply,
    blockingMessage,
  };
};

export const getStructuralPreviewLoadingReadiness = (
  worksheetId: string,
  worksheetName: string,
): StructuralDecisionReadiness => ({
  worksheetId,
  worksheetName,
  totalCount: 0,
  resolvedCount: 0,
  unresolvedCount: 0,
  deferredCount: 0,
  canContinueToApply: false,
  blockingMessage: `Checking structural recommendations for ${worksheetName}...`,
});

export const getStructuralPreviewIdleReadiness = (
  worksheetId: string,
  worksheetName: string,
): StructuralDecisionReadiness => ({
  worksheetId,
  worksheetName,
  totalCount: 0,
  resolvedCount: 0,
  unresolvedCount: 0,
  deferredCount: 0,
  canContinueToApply: false,
  blockingMessage: `Structural recommendations for ${worksheetName} have not been checked yet.`,
});

export const getStructuralPreviewErrorReadiness = (
  worksheetId: string,
  worksheetName: string,
  message: string | null,
): StructuralDecisionReadiness => ({
  worksheetId,
  worksheetName,
  totalCount: 0,
  resolvedCount: 0,
  unresolvedCount: 0,
  deferredCount: 0,
  canContinueToApply: false,
  blockingMessage:
    message || `Structural recommendations for ${worksheetName} could not be checked. Try again.`,
});

export const getStructuralPreviewLifecycleState = (
  shouldLoad: boolean,
  status: RecipePreviewStatus,
  hasVerifiedPreview: boolean,
): StructuralPreviewLifecycleState => {
  if (!shouldLoad) {
    return {
      status: "idle",
      isPending: false,
      isReady: false,
      isError: false,
    };
  }
  if (status === "error") {
    return {
      status: "error",
      isPending: false,
      isReady: false,
      isError: true,
    };
  }
  if (status === "loading") {
    return {
      status: "loading",
      isPending: true,
      isReady: false,
      isError: false,
    };
  }
  if (status === "ready" && hasVerifiedPreview) {
    return {
      status: "ready",
      isPending: false,
      isReady: true,
      isError: false,
    };
  }
  if (status === "ready") {
    return {
      status: "error",
      isPending: false,
      isReady: false,
      isError: true,
    };
  }
  return {
    status: "idle",
    isPending: false,
    isReady: false,
    isError: false,
  };
};

export const shouldStartStructuralPreviewRequest = (
  shouldLoad: boolean,
  status: RecipePreviewStatus,
  hasVerifiedPreview: boolean,
): boolean => shouldLoad && status === "idle" && !hasVerifiedPreview;

export const shouldMarkStructuralPreviewVerificationError = (
  shouldLoad: boolean,
  status: RecipePreviewStatus,
  hasVerifiedPreview: boolean,
): boolean => shouldLoad && status === "ready" && !hasVerifiedPreview;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const validateStructuralPreviewResponse = (
  response: CleaningRecipePreview | null | undefined,
  worksheetId: string,
  worksheetName: string,
): StructuralPreviewValidation => {
  if (!isRecord(response)) {
    return {
      ok: false,
      message: `We couldn't check structural recommendations for ${worksheetName}. The preview response was empty.`,
    };
  }
  if (typeof response.worksheet_id !== "string" || response.worksheet_id.length === 0) {
    return {
      ok: false,
      message: `We couldn't check structural recommendations for ${worksheetName}. The preview response did not include a worksheet id.`,
    };
  }
  if (response.worksheet_id !== worksheetId) {
    return {
      ok: false,
      message: `We couldn't verify the structural preview for ${worksheetName}. Try again.`,
    };
  }
  if (!Array.isArray(response.recipe)) {
    return {
      ok: false,
      message: `We couldn't check structural recommendations for ${worksheetName}. The preview recipe was invalid.`,
    };
  }
  if (
    !isRecord(response.excluded) ||
    typeof response.excluded.repeated_headers !== "number" ||
    typeof response.excluded.section_banners !== "number" ||
    typeof response.excluded.date_title_rows !== "number" ||
    typeof response.excluded.layout_rows !== "number" ||
    typeof response.excluded.placeholder_rows !== "number" ||
    typeof response.excluded.side_note_columns !== "number"
  ) {
    return {
      ok: false,
      message: `We couldn't check structural recommendations for ${worksheetName}. The preview exclusion summary was invalid.`,
    };
  }
  const layoutDetails = response.excluded_details?.layout_rows;
  if (
    response.excluded.layout_rows > 0 &&
    (!layoutDetails ||
      !Array.isArray(layoutDetails.row_indexes) ||
      !Array.isArray(layoutDetails.reasons))
  ) {
    return {
      ok: false,
      message: `Structural preview details are incomplete for ${worksheetName}. Restart the local backend and try again.`,
    };
  }
  return { ok: true, preview: response };
};

export const areStructuralDecisionReadinessEqual = (
  left: StructuralDecisionReadiness | null,
  right: StructuralDecisionReadiness,
): boolean =>
  Boolean(
      left &&
      left.worksheetId === right.worksheetId &&
      left.worksheetName === right.worksheetName &&
      left.totalCount === right.totalCount &&
      left.resolvedCount === right.resolvedCount &&
      left.unresolvedCount === right.unresolvedCount &&
      left.deferredCount === right.deferredCount &&
      left.canContinueToApply === right.canContinueToApply &&
      left.blockingMessage === right.blockingMessage,
  );

export const clearSuggestedFixDecision = (
  decisions: SuggestedFixDecisionMap,
  fixId: string,
): SuggestedFixDecisionMap => {
  const nextDecisions = { ...decisions };
  delete nextDecisions[fixId];
  return nextDecisions;
};

export const resetSuggestedFixDecisions = (): SuggestedFixDecisionMap => ({});

export const hasExplicitSuggestedFixDecisions = (
  fixes: SuggestedFix[],
  decisions: SuggestedFixDecisionMap,
): boolean => fixes.some((fix) => getSuggestedFixDecision(fix.id, decisions) !== "unresolved");

export const getSuggestedFixesForWorksheet = (
  fixes: SuggestedFix[],
  worksheetId: string,
): SuggestedFix[] => fixes.filter((fix) => fix.worksheetId === worksheetId);

export const isCleaningRecipePreviewForWorksheet = (
  preview: CleaningRecipePreview | null,
  worksheetId: string,
): preview is CleaningRecipePreview => Boolean(preview && preview.worksheet_id === worksheetId);

export const getCleaningRecipeExcludedCount = (
  preview: Pick<CleaningRecipePreview, "excluded"> | null,
): number =>
  preview
    ? Object.values(preview.excluded).reduce((total, count) => total + count, 0)
    : 0;

export const hasCleaningRecipePreviewOperations = (
  preview: Pick<CleaningRecipePreview, "recipe" | "excluded"> | null,
): boolean => Boolean(preview && (preview.recipe.length > 0 || getCleaningRecipeExcludedCount(preview) > 0));

export const getMissingValuePreviewChangedColumnCount = (
  summary: CleaningRecipePreview["missing_value_summary"] | undefined,
): number => summary?.columns_changed_count ?? summary?.columns_changed?.length ?? 0;

export const hasMissingValuePreviewSummaryChanges = (
  summary: CleaningRecipePreview["missing_value_summary"] | undefined,
): boolean =>
  Boolean(
    summary?.has_changes ||
      (summary?.cells_filled || 0) > 0 ||
      (summary?.rows_removed || 0) > 0 ||
      getMissingValuePreviewChangedColumnCount(summary) > 0,
  );

export const structuralNoOpApplyHeading = "No cleaned copy needed";
export const structuralNoOpApplyCopy =
  "Your decisions preserve this worksheet as-is. No cleaned working copy was created, and the original workbook remains unchanged.";

export const getDraftRecipeStatusCopy = ({
  embedded,
  hasCleanedWorkingCopy,
  isUsingCleanedCopy,
  isNoOpDecisionPreview,
}: {
  embedded: boolean;
  hasCleanedWorkingCopy: boolean;
  isUsingCleanedCopy: boolean;
  isNoOpDecisionPreview: boolean;
}): { heading: string; body: string } => {
  if (isNoOpDecisionPreview) {
    return {
      heading: structuralNoOpApplyHeading,
      body: structuralNoOpApplyCopy,
    };
  }
  if (isUsingCleanedCopy) {
    return {
      heading: "Active cleaned copy unchanged by this draft.",
      body: "The current analysis source is already a cleaned working copy. New draft decisions have not been applied.",
    };
  }
  if (hasCleanedWorkingCopy) {
    return {
      heading: "Existing cleaned copy unchanged by this draft.",
      body: "A cleaned working copy already exists for this worksheet. New draft decisions have not been applied.",
    };
  }
  return {
    heading: embedded
      ? "No draft changes applied yet."
      : "Preview only - no draft changes have been applied to this worksheet yet.",
    body: "Use Create cleaned working copy on a ready XLSX worksheet to produce a cleaned table alongside the original.",
  };
};

export const isStructuralNoOpDecisionPreview = (
  preview: Pick<CleaningRecipePreview, "recipe" | "excluded"> | null,
  hasDecisionPlan: boolean,
): boolean => Boolean(hasDecisionPlan && preview && !hasCleaningRecipePreviewOperations(preview));

export const getStructuralPreviewComparisonLabels = (isNoOpDecisionPreview: boolean) => ({
  before: "Current analysis table",
  after: isNoOpDecisionPreview
    ? "Worksheet with preserved layout rows"
    : "Preview after cleanup",
});

export const canCreateStructuralCleanedCopy = ({
  preview,
  canContinueToApply,
  worksheetStatus,
}: {
  preview: Pick<CleaningRecipePreview, "recipe" | "excluded"> | null;
  canContinueToApply: boolean;
  worksheetStatus?: string;
}): boolean =>
  Boolean(
    preview &&
      worksheetStatus === "ready" &&
      canContinueToApply &&
      hasCleaningRecipePreviewOperations(preview),
  );

export const getAutomaticBlankRowEvidenceSignalsFromPreview = (
  preview: CleaningRecipePreview | null,
): StructuralEvidenceSignal[] => {
  if (!preview) return [];
  const automaticBlankRows = (preview.excluded_details?.layout_rows?.reasons || [])
    .filter((item) => item.reason === "automatic_blank_row")
    .map((item) => item.row_index)
    .filter((rowIndex, index, rows) => Number.isFinite(rowIndex) && rows.indexOf(rowIndex) === index)
    .sort((left, right) => left - right);
  if (automaticBlankRows.length === 0) return [];

  return [
    {
      id: `${preview.worksheet_id}:automatic_blank_row:0`,
      worksheetId: preview.worksheet_id,
      worksheetName: preview.worksheet_name,
      evidence: {
        type: "automatic_blank_row",
        rowIndex: null,
        rowRange:
          automaticBlankRows.length === 1
            ? [automaticBlankRows[0], automaticBlankRows[0]]
            : [automaticBlankRows[0], automaticBlankRows[automaticBlankRows.length - 1]],
        rowIndexes: automaticBlankRows,
        columnRange: null,
        label: null,
        previewValues: [],
        confidence: "high",
        explanation: "Completely blank rows outside the analysis table were detected.",
      },
    },
  ];
};

export const getPreviewSuggestedFixes = (
  preview: CleaningRecipePreview | null,
): SuggestedFix[] =>
  getAutomaticBlankRowEvidenceSignalsFromPreview(preview).flatMap((signal) => {
    const fix = getSuggestedFix(signal);
    return fix ? [fix] : [];
  });

export const getWorksheetSuggestedFixDecisionDrafts = (
  draftsByWorksheet: WorksheetSuggestedFixDecisionDrafts,
  worksheetId: string,
): SuggestedFixDecisionMap => draftsByWorksheet[worksheetId] || {};

export const setWorksheetSuggestedFixDecision = (
  draftsByWorksheet: WorksheetSuggestedFixDecisionDrafts,
  worksheetId: string,
  fixId: string,
  decision: Exclude<SuggestedFixDecision, "unresolved">,
): WorksheetSuggestedFixDecisionDrafts => ({
  ...draftsByWorksheet,
  [worksheetId]: {
    ...getWorksheetSuggestedFixDecisionDrafts(draftsByWorksheet, worksheetId),
    [fixId]: decision,
  },
});

export const clearWorksheetSuggestedFixDecision = (
  draftsByWorksheet: WorksheetSuggestedFixDecisionDrafts,
  worksheetId: string,
  fixId: string,
): WorksheetSuggestedFixDecisionDrafts => ({
  ...draftsByWorksheet,
  [worksheetId]: clearSuggestedFixDecision(
    getWorksheetSuggestedFixDecisionDrafts(draftsByWorksheet, worksheetId),
    fixId,
  ),
});

export const resetWorksheetSuggestedFixDecisions = (
  draftsByWorksheet: WorksheetSuggestedFixDecisionDrafts,
  worksheetId: string,
): WorksheetSuggestedFixDecisionDrafts => ({
  ...draftsByWorksheet,
  [worksheetId]: resetSuggestedFixDecisions(),
});

export const getSuggestedFixCleaningPlan = (
  fixes: SuggestedFix[],
  decisions: SuggestedFixDecisionMap,
): string[] => {
  const planItems = fixes.flatMap((fix) => {
    const decision = getSuggestedFixDecision(fix.id, decisions);
    if (decision === "use_recommendation") return [getSuggestedFixRecommendationLabel(fix)];
    if (decision === "keep_original") return [getSuggestedFixKeepOriginalLabel(fix)];
    return [];
  });
  const deferredCount = fixes.filter(
    (fix) => getSuggestedFixDecision(fix.id, decisions) === "decide_later",
  ).length;
  if (deferredCount > 0) {
    planItems.push(`${deferredCount} recommendation${deferredCount === 1 ? "" : "s"} deferred`);
  }
  return planItems;
};

const structuralDecisionWireEvidenceTypes = new Set<WorksheetTemplateStructureEvidenceType>([
  "repeated_header",
  "date_title_row",
  "section_banner",
  "sparse_layout_gap",
  "serial_only_placeholder_rows",
  "side_note_region_candidate",
  "repeated_missing_pattern",
  "automatic_blank_row",
]);

const isWorksheetStructuralDecisionEvidenceType = (
  evidenceType: string,
): evidenceType is WorksheetTemplateStructureEvidenceType =>
  structuralDecisionWireEvidenceTypes.has(evidenceType as WorksheetTemplateStructureEvidenceType);

export const buildWorksheetStructuralDecisionPlan = (
  worksheetId: string,
  fixes: SuggestedFix[],
  decisions: SuggestedFixDecisionMap,
): WorksheetStructuralDecisionPlan | null => {
  const planDecisions = fixes.flatMap((fix) => {
    if (fix.worksheetId !== worksheetId) return [];
    if (!isWorksheetStructuralDecisionEvidenceType(fix.evidenceType)) return [];
    const decision = getSuggestedFixDecision(fix.id, decisions);
    if (decision === "unresolved") return [];
    return [
      {
        recommendationId: fix.recommendationId,
        evidenceType: fix.evidenceType,
        decision,
        evidenceIds: fix.evidenceSignalId ? [fix.evidenceSignalId] : [fix.recommendationId],
        evidenceSignalId: fix.evidenceSignalId,
        affectedRows: fix.affectedRows || [],
        affectedColumnIndexes: fix.affectedColumnIndexes || [],
      },
    ];
  });

  if (planDecisions.length === 0) return null;
  return {
    worksheetId,
    decisions: planDecisions,
  };
};

const getIssueCategory = (issue: PreparationIssue) => {
  if (issue.id.includes("side_note_region_candidate")) return "Side-note regions";
  if (
    issue.id.includes("missing-values") ||
    issue.id.includes("missing_pattern") ||
    issue.id.includes("high-blank-rate")
  ) {
    return "Missing values";
  }
  if (issue.id.includes("generated-columns")) return "Generated columns";
  if (
    issue.id.includes("date_title_row") ||
    issue.id.includes("section_banner") ||
    issue.id.includes("sparse_layout_gap") ||
    issue.id.includes("serial_only_placeholder_rows")
  ) {
    return "Template/layout rows";
  }
  return "Structure issues";
};

const issueCategoryCardCopy: Record<string, { title: string; description: string }> = {
  "Side-note regions": {
    title: "Side-note regions",
    description: "Separated note areas may not belong in the analysis table.",
  },
  "Missing values": {
    title: "Missing values",
    description: "Blank cells may be real missing values or intentional template space.",
  },
  "Generated columns": {
    title: "Generated columns",
    description: "Some fields still need clearer business names before analysis.",
  },
  "Template/layout rows": {
    title: "Template / layout rows",
    description: "Headers, banners, or spacing rows may need to stay out of the working copy.",
  },
  "Structure issues": {
    title: "Other detected issues",
    description: "Additional structure signals are available for review.",
  },
};

const getIssueCategoryCardCopy = (category: string) =>
  issueCategoryCardCopy[category] || {
    title: category,
    description: "Detected data-shape signals are available for review.",
  };

const columnIndexToLabel = (index: number) => {
  let remaining = index + 1;
  let label = "";

  while (remaining > 0) {
    const remainder = (remaining - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    remaining = Math.floor((remaining - 1) / 26);
  }

  return label;
};

const formatEvidenceLocation = (evidence: WorksheetTemplateStructureEvidence) => {
  if (evidence.rowRange && evidence.rowRange.length >= 2) {
    return `rows ${evidence.rowRange[0] + 1}-${evidence.rowRange[1] + 1}`;
  }

  if (evidence.rowIndexes.length > 0) {
    const rows = evidence.rowIndexes.slice(0, 4).map((row) => row + 1);
    return `rows ${rows.join(", ")}${evidence.rowIndexes.length > rows.length ? ", ..." : ""}`;
  }

  if (evidence.rowIndex !== null) {
    return `row ${evidence.rowIndex + 1}`;
  }

  if (evidence.columnRange && evidence.columnRange.length >= 2) {
    return `columns ${columnIndexToLabel(evidence.columnRange[0])}-${columnIndexToLabel(
      evidence.columnRange[1],
    )}`;
  }

  return null;
};

const getEvidenceIssueCopy = (
  evidence: WorksheetTemplateStructureEvidence,
): { title: string; detail: string } | null => {
  switch (evidence.type) {
    case "repeated_header":
      return {
        title: "Repeated headers detected",
        detail: "A worksheet header appears again inside the flattened data rows.",
      };
    case "date_title_row":
      return {
        title: "Date or title rows detected",
        detail: "Date or title rows appear between worksheet sections.",
      };
    case "section_banner":
      return {
        title: "Section banners detected",
        detail: "Named section banners appear inside the worksheet body.",
      };
    case "sparse_layout_gap":
      return {
        title: "Empty template rows detected",
        detail: "Sparse layout gaps appear between populated worksheet regions.",
      };
    case "automatic_blank_row":
      return {
        title: "Blank layout rows detected",
        detail: "Completely blank rows outside the analysis table were detected.",
      };
    case "serial_only_placeholder_rows":
      return {
        title: "Empty template slots detected",
        detail: "Some rows contain only a serial value while business fields remain blank.",
      };
    case "side_note_region_candidate":
      return {
        title: "Side-note region detected",
        detail: "A separated right-side region may contain notes rather than analysis fields.",
      };
    case "repeated_missing_pattern":
      return {
        title: "High blank-rate pattern detected",
        detail: "A repeated missing-value shape may represent template space instead of data.",
      };
    case "clean_table_counter_signal":
      return null;
  }
};

export const getColumnDisplayName = (columnName: string) => {
  const generatedMatch = columnName.trim().match(/^column_(\d+)(?:_\d+)?$/i);
  if (!generatedMatch) return columnName;
  return `Unnamed column ${Number(generatedMatch[1])}`;
};

const getEvidenceRows = (evidence: WorksheetTemplateStructureEvidence): number[] => {
  const rows = new Set<number>();
  if (typeof evidence.rowIndex === "number") rows.add(evidence.rowIndex);
  evidence.rowIndexes.forEach((rowIndex) => rows.add(rowIndex));
  if (evidence.rowRange && evidence.rowRange.length >= 2) {
    const [start, end] = [...evidence.rowRange].sort((left, right) => left - right);
    for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
      rows.add(rowIndex);
    }
  }
  return Array.from(rows).sort((left, right) => left - right);
};

const getEvidenceColumnIndexes = (evidence: WorksheetTemplateStructureEvidence): number[] => {
  if (!evidence.columnRange || evidence.columnRange.length < 2) return [];
  const [start, end] = [...evidence.columnRange].sort((left, right) => left - right);
  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
};

const getSuggestedFix = (signal: StructuralEvidenceSignal): SuggestedFix | null => {
  const type = signal.evidence.type;
  const baseFix = {
    id: signal.id,
    recommendationId: signal.id,
    evidenceType: type,
    evidenceSignalId: signal.id,
    worksheetId: signal.worksheetId,
    worksheetName: signal.worksheetName,
    affectedRows: getEvidenceRows(signal.evidence),
    affectedColumnIndexes: getEvidenceColumnIndexes(signal.evidence),
  };
  switch (type) {
    case "repeated_header":
      return {
        ...baseFix,
        title: "Remove repeated header rows",
        detail: "Exclude repeated headers from a future working copy.",
      };
    case "date_title_row":
      return {
        ...baseFix,
        title: "Keep section dates",
        detail: "Preserve applicable date labels as a future `_section_date` field.",
      };
    case "section_banner":
      return {
        ...baseFix,
        title: "Keep section labels",
        detail: "Preserve applicable banners as a future `_section_label` field.",
      };
    case "sparse_layout_gap":
      return {
        ...baseFix,
        title: "Ignore layout separator rows",
        detail: "Exclude empty template spacing from a future working copy.",
      };
    case "automatic_blank_row":
      return {
        ...baseFix,
        title: "Exclude blank layout rows",
        detail: "Completely blank rows outside the analysis table were detected.",
      };
    case "serial_only_placeholder_rows":
      return {
        ...baseFix,
        title: "Remove empty template slots",
        detail: "Exclude serial-only placeholder rows from a future working copy.",
      };
    case "side_note_region_candidate":
      return {
        ...baseFix,
        title: "Exclude side-note columns",
        detail: "Keep note regions outside the future analysis table.",
      };
    case "repeated_missing_pattern":
      return {
        ...baseFix,
        title: "Review blank cells",
        detail: "Confirm which blanks are missing values and which are layout space.",
      };
    case "clean_table_counter_signal":
      return null;
  }
};

const buildEvidenceIssues = (
  templateEvidenceSignals: ReturnType<typeof buildPreparationSignalReport>["templateEvidenceSignals"],
) =>
  templateEvidenceSignals.flatMap((signal) => {
    const { evidence } = signal;
    const copy = getEvidenceIssueCopy(evidence);
    if (!copy) return [];

    const location = formatEvidenceLocation(evidence);
    const label = evidence.label ? ` Label: ${evidence.label}.` : "";

    return [
      {
        id: signal.id,
        title: copy.title,
        detail: `${signal.worksheetName}${location ? `, ${location}` : ""}: ${copy.detail}${label}`,
      },
    ];
  });

export const buildPreparationReview = (dataset: DatasetMetadata): PreparationReview => {
  const report = buildPreparationSignalReport(dataset);
  const issues = buildEvidenceIssues(report.templateEvidenceSignals);
  const scopedSuggestedFixes: SuggestedFix[] = [];
  const visibleSuggestedFixes = new Map<string, SuggestedFix>();

  report.templateEvidenceSignals.forEach((signal) => {
    const fix = getSuggestedFix(signal);
    if (!fix) return;
    scopedSuggestedFixes.push(fix);
    // UX-S2D-7A-1 temporary boundary: keep the current visible Decide list
    // deduped by recommendation type until the next slice introduces active
    // worksheet filtering. The scoped collection above preserves every
    // worksheet/evidence identity for the future Apply contract.
    if (!visibleSuggestedFixes.has(fix.evidenceType)) {
      visibleSuggestedFixes.set(fix.evidenceType, fix);
    }
  });

  const { missingColumns, highBlankColumns, generatedColumns, hasRepeatedHighBlankPattern } =
    report;

  if (missingColumns.length > 0) {
    issues.push({
      id: "dataset:missing-values",
      title: "Missing values detected",
      detail: `${missingColumns.length} field${missingColumns.length === 1 ? "" : "s"} contain blank values that should be reviewed before preparation.`,
    });
    visibleSuggestedFixes.set("dataset:missing-values", {
      id: "dataset:missing-values",
      recommendationId: "dataset:missing-values",
      evidenceType: "missing_values",
      title: "Review blank cells before filling values",
      detail: "Confirm whether each blank pattern means missing data or intentional template space.",
    });
  }

  if (hasRepeatedHighBlankPattern) {
    issues.push({
      id: "dataset:repeated-high-blank-rate",
      title: "Repeated high blank-rate pattern detected",
      detail: `${highBlankColumns.length} fields share a mostly blank pattern that may represent template layout.`,
    });
  }

  if (generatedColumns.length > 0) {
    const firstGeneratedColumn = getColumnDisplayName(generatedColumns[0]);
    issues.push({
      id: "dataset:generated-columns",
      title: "Generated column names detected",
      detail: `${generatedColumns.length} field${
        generatedColumns.length === 1 ? "" : "s"
      } have no detected header, such as ${firstGeneratedColumn}.`,
    });
    visibleSuggestedFixes.set("dataset:generated-columns", {
      id: "dataset:generated-columns",
      recommendationId: "dataset:generated-columns",
      evidenceType: "generated_columns",
      title: "Rename unclear fields",
      detail: "Replace generated names in a future working copy after confirming their meaning.",
    });
  }

  const hasTemplateCandidate = report.templateCandidateWorksheets.length > 0;
  const hasActionableEvidence = report.templateEvidenceSignals.some(
    ({ evidence }) => evidence.type !== "clean_table_counter_signal",
  );
  const priority: PreparationPriority =
    hasTemplateCandidate || hasRepeatedHighBlankPattern
      ? "high"
      : missingColumns.length > 0 || generatedColumns.length > 0 || hasActionableEvidence
        ? "medium"
        : "low";

  return {
    priority,
    issues,
    scopedSuggestedFixes,
    suggestedFixes: Array.from(visibleSuggestedFixes.values()),
  };
};

const priorityLabel = {
  high: "Recommended",
  medium: "Review suggested",
  low: "Optional review",
};

const recipeStepLabels: Record<string, string> = {
  remove_repeated_header_rows: "Remove repeated header rows",
  remove_section_banner_rows: "Keep section banners out of data rows",
  carry_forward_section_context: "Keep section dates and labels",
  ignore_layout_rows: "Ignore layout separator rows",
  remove_serial_only_placeholder_rows: "Remove empty template slots",
  exclude_side_note_columns: "Exclude side-note columns",
  review_blank_cells: "Review blank cells before filling values",
};

const excludedLabels: Record<keyof CleaningRecipePreview["excluded"], string> = {
  repeated_headers: "Repeated headers",
  section_banners: "Section banners",
  date_title_rows: "Date/title rows",
  layout_rows: "Layout rows",
  placeholder_rows: "Placeholder rows",
  side_note_columns: "Side-note columns",
};

const formatPreviewCell = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

export function CleanPrepareReviewPanel({
  dataset,
  sourceName,
  onAnalysisSourceSelect,
  onPreviewDataset,
  restoreContext,
  onRestoreContextConsumed,
  onContinueInAnalyst,
  embedded = false,
  activeStep = "review",
  onStructuralDecisionReadinessChange,
  transformationPlan = null,
}: CleanPrepareReviewPanelProps) {
  const reviewRef = useRef<HTMLDivElement | null>(null);
  const structuralProgressRef = useRef<HTMLDivElement | null>(null);
  const resetStructuralDecisionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const resetMissingValueDecisionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const structuralPreviewRequestIdsRef = useRef<Record<string, number>>({});
  const decisionPreviewRequestIdsRef = useRef<Record<string, number>>({});
  // When embedded, the review is the whole reason the dedicated page exists,
  // so start open.
  const [isOpen, setIsOpen] = useState(embedded);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(null);
  const [recipePreviewByWorksheet, setRecipePreviewByWorksheet] = useState<
    Record<string, CleaningRecipePreview>
  >({});
  const [recipeStatusByWorksheet, setRecipeStatusByWorksheet] = useState<
    Record<string, RecipePreviewStatus>
  >({});
  const [recipeErrorByWorksheet, setRecipeErrorByWorksheet] = useState<
    Record<string, string | null>
  >({});
  const [recipeRetryByWorksheet, setRecipeRetryByWorksheet] = useState<Record<string, number>>({});
  const [decisionRecipePreviewByWorksheet, setDecisionRecipePreviewByWorksheet] = useState<
    Record<string, CleaningRecipePreview>
  >({});
  const [decisionRecipeStatusByWorksheet, setDecisionRecipeStatusByWorksheet] = useState<
    Record<string, RecipePreviewStatus>
  >({});
  const [decisionRecipeErrorByWorksheet, setDecisionRecipeErrorByWorksheet] = useState<
    Record<string, string | null>
  >({});
  const [decisionRecipePlanKeyByWorksheet, setDecisionRecipePlanKeyByWorksheet] = useState<
    Record<string, string>
  >({});
  const [applyStateByWorksheet, setApplyStateByWorksheet] = useState<
    Record<string, ApplyState>
  >({});
  const [activationState, setActivationState] = useState<ActivationState>({ status: "idle" });
  const [missingValueDecisions, setMissingValueDecisions] = useState(readMissingValueDecisions);
  const [fixDecisionDraftsByWorksheet, setFixDecisionDraftsByWorksheet] =
    useState<WorksheetSuggestedFixDecisionDrafts>({});
  const [isResetStructuralDecisionsConfirming, setIsResetStructuralDecisionsConfirming] =
    useState(false);
  const [isResetMissingValueDecisionsConfirming, setIsResetMissingValueDecisionsConfirming] =
    useState(false);
  const [shouldFocusStructuralProgress, setShouldFocusStructuralProgress] = useState(false);
  // C-7B — UI view mode for the Missing-value handling card. "wide" shows
  // type-grouped fill choices for the whole worksheet; "perColumn" reveals
  // the existing per-column override UI from C-7. Defaults to "perColumn"
  // when the user already saved decide_per_column on the worksheet decision.
  const [missingValueViewMode, setMissingValueViewMode] = useState<
    "wide" | "perColumn"
  >("wide");
  const review = useMemo(() => buildPreparationReview(dataset), [dataset]);
  const supportsRecipePreview = dataset.original_filename.toLowerCase().endsWith(".xlsx");
  const workbook = useMemo(() => getWorkbookMetadata(dataset), [dataset]);
  const worksheets = workbook?.worksheets || [];
  const firstPreviewableWorksheet =
    worksheets.find((worksheet) => worksheet.status === "ready") ||
    worksheets.find((worksheet) => worksheet.status === "empty") ||
    null;
  const activePreviewableWorksheet = worksheets.find(
    (worksheet) =>
      worksheet.worksheetId === workbook?.activeWorksheetId &&
      (worksheet.status === "ready" || worksheet.status === "empty"),
  );
  const selectedWorksheet =
    worksheets.find((worksheet) => worksheet.worksheetId === selectedWorksheetId) ||
    activePreviewableWorksheet ||
    firstPreviewableWorksheet;
  const decisionWorksheetId = selectedWorksheet?.worksheetId || "dataset";
  const decisionWorksheetName =
    selectedWorksheet?.displayName || selectedWorksheet?.sheetName || "this worksheet";
  const selectedWorksheetRecipeStatus = recipeStatusByWorksheet[decisionWorksheetId] || "idle";
  const selectedWorksheetRecipeError = recipeErrorByWorksheet[decisionWorksheetId] || null;
  const selectedWorksheetRecipeRetry = recipeRetryByWorksheet[decisionWorksheetId] || 0;
  const selectedWorksheetRecipePreview = isCleaningRecipePreviewForWorksheet(
    recipePreviewByWorksheet[decisionWorksheetId] || null,
    decisionWorksheetId,
  )
    ? recipePreviewByWorksheet[decisionWorksheetId]
    : null;
  const shouldLoadSelectedWorksheetPreview = Boolean(
    isOpen &&
      supportsRecipePreview &&
      selectedWorksheet &&
      (selectedWorksheet.status === "ready" || selectedWorksheet.status === "empty"),
  );
  const structuralPreviewLifecycle = getStructuralPreviewLifecycleState(
    shouldLoadSelectedWorksheetPreview,
    selectedWorksheetRecipeStatus,
    Boolean(selectedWorksheetRecipePreview),
  );
  const isStructuralPreviewPending = structuralPreviewLifecycle.isPending;
  const isStructuralPreviewAwaitingRequest =
    shouldLoadSelectedWorksheetPreview &&
    selectedWorksheetRecipeStatus === "idle" &&
    !selectedWorksheetRecipePreview;
  const previewSuggestedFixes = useMemo(
    () => getPreviewSuggestedFixes(selectedWorksheetRecipePreview),
    [selectedWorksheetRecipePreview],
  );
  const visibleStructuralFixes = useMemo(
    () => {
      const fixesById = new Map(
        getSuggestedFixesForWorksheet(review.scopedSuggestedFixes, decisionWorksheetId).map(
          (fix) => [fix.id, fix],
        ),
      );
      previewSuggestedFixes.forEach((fix) => fixesById.set(fix.id, fix));
      return Array.from(fixesById.values());
    },
    [decisionWorksheetId, previewSuggestedFixes, review.scopedSuggestedFixes],
  );
  const fixDecisionDrafts = useMemo(
    () => getWorksheetSuggestedFixDecisionDrafts(fixDecisionDraftsByWorksheet, decisionWorksheetId),
    [decisionWorksheetId, fixDecisionDraftsByWorksheet],
  );
  const planDecisionColumns = useMemo(() => {
    const sourceColumns = selectedWorksheet?.schema || dataset.schema;
    if (!selectedWorksheetRecipePreview?.after_preview.columns.length) return sourceColumns;
    const previewColumnSet = new Set(selectedWorksheetRecipePreview.after_preview.columns);
    return sourceColumns.filter((column) => previewColumnSet.has(column.name));
  }, [dataset.schema, selectedWorksheet?.schema, selectedWorksheetRecipePreview]);
  const planWorksheetDecisionKey = createMissingValueDecisionKey(
    dataset.dataset_id,
    decisionWorksheetId,
    WORKSHEET_DECISION_COLUMN,
  );
  const planWorksheetDecision = missingValueDecisions[planWorksheetDecisionKey];
  const planIsPerColumnDecision = planWorksheetDecision?.strategy === "decide_per_column";
  const missingValuePlanReadiness = useMemo(
    () =>
      buildWorksheetMissingValuePlan({
        datasetId: dataset.dataset_id,
        worksheetId: decisionWorksheetId,
        columns: planDecisionColumns,
        decisions: missingValueDecisions,
      }),
    [dataset.dataset_id, planDecisionColumns, decisionWorksheetId, missingValueDecisions],
  );
  const readyMissingValuePlan = missingValuePlanReadiness.ready
    ? missingValuePlanReadiness.totalColumns > 0
      ? missingValuePlanReadiness.plan
      : null
    : null;
  useEffect(() => {
    setMissingValueViewMode(planIsPerColumnDecision ? "perColumn" : "wide");
  }, [decisionWorksheetId, planIsPerColumnDecision]);
  const selectedWorksheetStructuralDecisionPlan = useMemo(
    () =>
      buildWorksheetStructuralDecisionPlan(
        decisionWorksheetId,
        visibleStructuralFixes,
        fixDecisionDrafts,
      ),
    [decisionWorksheetId, fixDecisionDrafts, visibleStructuralFixes],
  );
  const suggestedFixDecisionProgress = useMemo(
    () => getSuggestedFixDecisionProgress(visibleStructuralFixes, fixDecisionDrafts),
    [fixDecisionDrafts, visibleStructuralFixes],
  );
  const structuralDecisionReadiness = useMemo(
    () => {
      if (isStructuralPreviewAwaitingRequest) {
        return getStructuralPreviewIdleReadiness(decisionWorksheetId, decisionWorksheetName);
      }
      if (isStructuralPreviewPending) {
        return getStructuralPreviewLoadingReadiness(decisionWorksheetId, decisionWorksheetName);
      }
      if (selectedWorksheetRecipeStatus === "error" && !selectedWorksheetRecipePreview) {
        return getStructuralPreviewErrorReadiness(
          decisionWorksheetId,
          decisionWorksheetName,
          selectedWorksheetRecipeError,
        );
      }
      return getStructuralDecisionReadiness(
        visibleStructuralFixes,
        fixDecisionDrafts,
        decisionWorksheetId,
        decisionWorksheetName,
      );
    },
    [
      decisionWorksheetId,
      decisionWorksheetName,
      fixDecisionDrafts,
      isStructuralPreviewAwaitingRequest,
      isStructuralPreviewPending,
      selectedWorksheetRecipeError,
      selectedWorksheetRecipePreview,
      selectedWorksheetRecipeStatus,
      visibleStructuralFixes,
    ],
  );
  const suggestedFixCleaningPlan = useMemo(
    () => getSuggestedFixCleaningPlan(visibleStructuralFixes, fixDecisionDrafts),
    [fixDecisionDrafts, visibleStructuralFixes],
  );
  const combinedDecisionReadiness = useMemo<StructuralDecisionReadiness>(() => {
    if (!structuralDecisionReadiness.canContinueToApply) return structuralDecisionReadiness;
    if (missingValuePlanReadiness.ready) {
      return {
        ...structuralDecisionReadiness,
        totalCount: structuralDecisionReadiness.totalCount + missingValuePlanReadiness.totalColumns,
        resolvedCount:
          structuralDecisionReadiness.resolvedCount + missingValuePlanReadiness.decidedColumns,
        unresolvedCount: missingValuePlanReadiness.unresolvedColumns,
        blockingMessage: null,
        canContinueToApply: true,
      };
    }
    return {
      ...structuralDecisionReadiness,
      totalCount: structuralDecisionReadiness.totalCount + missingValuePlanReadiness.totalColumns,
      resolvedCount:
        structuralDecisionReadiness.resolvedCount + missingValuePlanReadiness.decidedColumns,
      unresolvedCount: Math.max(1, missingValuePlanReadiness.unresolvedColumns),
      canContinueToApply: false,
      blockingMessage:
        missingValuePlanReadiness.blockingMessage ||
        "Resolve missing-value decisions before previewing Apply.",
    };
  }, [missingValuePlanReadiness, structuralDecisionReadiness]);
  const readyStructuralDecisionPlan = combinedDecisionReadiness.canContinueToApply
    ? selectedWorksheetStructuralDecisionPlan
    : null;
  const readyTransformationPlan =
    transformationPlan?.worksheetId === decisionWorksheetId && transformationPlan.steps.length > 0
      ? transformationPlan
      : null;
  const readyPreviewPlanKey = JSON.stringify({
    structuralDecisionPlan: readyStructuralDecisionPlan,
    missingValuePlan: readyMissingValuePlan,
    transformationPlan: readyTransformationPlan,
  });
  const selectedWorksheetDecisionRecipePreview = isCleaningRecipePreviewForWorksheet(
    decisionRecipePreviewByWorksheet[decisionWorksheetId] || null,
    decisionWorksheetId,
  )
    ? decisionRecipePreviewByWorksheet[decisionWorksheetId]
    : null;
  const selectedWorksheetDecisionRecipeStatus =
    decisionRecipeStatusByWorksheet[decisionWorksheetId] || "idle";
  const selectedWorksheetDecisionRecipeError =
    decisionRecipeErrorByWorksheet[decisionWorksheetId] || null;
  const hasReadyDecisionPlan = Boolean(readyStructuralDecisionPlan || readyMissingValuePlan || readyTransformationPlan);
  const isSelectedWorksheetDecisionRecipeCurrent =
    decisionRecipePlanKeyByWorksheet[decisionWorksheetId] === readyPreviewPlanKey;
  const selectedWorksheetDisplayRecipePreview =
    hasReadyDecisionPlan
      ? isSelectedWorksheetDecisionRecipeCurrent
        ? selectedWorksheetDecisionRecipePreview
        : null
      : selectedWorksheetRecipePreview;
  const isDecisionRecipePreviewPending = Boolean(
    hasReadyDecisionPlan &&
    activeStep === "apply" &&
    selectedWorksheetDecisionRecipeStatus === "loading",
  );
  const hasStructuralDecisionDrafts = useMemo(
    () => hasExplicitSuggestedFixDecisions(visibleStructuralFixes, fixDecisionDrafts),
    [fixDecisionDrafts, visibleStructuralFixes],
  );
  useEffect(() => {
    onStructuralDecisionReadinessChange?.(combinedDecisionReadiness);
  }, [combinedDecisionReadiness, onStructuralDecisionReadinessChange]);
  useEffect(() => {
    if (!hasStructuralDecisionDrafts) {
      setIsResetStructuralDecisionsConfirming(false);
    }
  }, [hasStructuralDecisionDrafts]);
  useEffect(() => {
    setRecipePreviewByWorksheet({});
    setRecipeStatusByWorksheet({});
    setRecipeErrorByWorksheet({});
    setRecipeRetryByWorksheet({});
    setDecisionRecipePreviewByWorksheet({});
    setDecisionRecipeStatusByWorksheet({});
    setDecisionRecipeErrorByWorksheet({});
    setDecisionRecipePlanKeyByWorksheet({});
  }, [dataset.dataset_id]);
  useEffect(() => {
    setIsResetStructuralDecisionsConfirming(false);
  }, [decisionWorksheetId]);
  useEffect(() => {
    if (!shouldFocusStructuralProgress) return;
    structuralProgressRef.current?.focus();
    setShouldFocusStructuralProgress(false);
  }, [shouldFocusStructuralProgress]);
  const clearStructuralDecision = useCallback((fixId: string) => {
    setFixDecisionDraftsByWorksheet((current) =>
      clearWorksheetSuggestedFixDecision(current, decisionWorksheetId, fixId),
    );
  }, [decisionWorksheetId]);
  const beginResetStructuralDecisions = useCallback(() => {
    setIsResetStructuralDecisionsConfirming(true);
  }, []);
  const cancelResetStructuralDecisions = useCallback(() => {
    setIsResetStructuralDecisionsConfirming(false);
    resetStructuralDecisionsButtonRef.current?.focus();
  }, []);
  const confirmResetStructuralDecisions = useCallback(() => {
    setFixDecisionDraftsByWorksheet((current) =>
      resetWorksheetSuggestedFixDecisions(current, decisionWorksheetId),
    );
    setIsResetStructuralDecisionsConfirming(false);
    setShouldFocusStructuralProgress(true);
  }, [decisionWorksheetId]);
  const handleResetStructuralDecisionsKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      cancelResetStructuralDecisions();
    },
    [cancelResetStructuralDecisions],
  );
  const hasMissingValueDecisionDrafts = useMemo(() => {
    const prefix = `${dataset.dataset_id}:${decisionWorksheetId}:`;
    return Object.keys(missingValueDecisions).some((key) => key.startsWith(prefix));
  }, [dataset.dataset_id, decisionWorksheetId, missingValueDecisions]);
  const clearOneMissingValueDecision = useCallback((key: string) => {
    setMissingValueDecisions((current) => {
      const next = clearMissingValueDecision(current, key);
      writeMissingValueDecisions(next);
      return next;
    });
  }, []);
  const beginResetMissingValueDecisions = useCallback(() => {
    setIsResetMissingValueDecisionsConfirming(true);
  }, []);
  const cancelResetMissingValueDecisions = useCallback(() => {
    setIsResetMissingValueDecisionsConfirming(false);
    resetMissingValueDecisionsButtonRef.current?.focus();
  }, []);
  const confirmResetMissingValueDecisions = useCallback(() => {
    setMissingValueDecisions((current) => {
      const next = resetMissingValueDecisionsForWorksheet(
        current,
        dataset.dataset_id,
        decisionWorksheetId,
      );
      writeMissingValueDecisions(next);
      return next;
    });
    setIsResetMissingValueDecisionsConfirming(false);
  }, [dataset.dataset_id, decisionWorksheetId]);
  const issueGroups = useMemo(
    () =>
      Array.from(
        review.issues.reduce<Map<string, PreparationIssue[]>>((groups, issue) => {
          const category = getIssueCategory(issue);
          groups.set(category, [...(groups.get(category) || []), issue]);
          return groups;
        }, new Map()),
      ),
    [review.issues],
  );
  const isPrioritized = review.priority !== "low";
  const decisionColumns = planDecisionColumns;
  const decisionRowCount = selectedWorksheet?.rowCount || dataset.row_count;
  const missingValueColumns = decisionColumns
    .filter((column) => column.null_count > 0)
    .sort((left, right) => right.null_count - left.null_count);
  const worksheetDecisionKey = planWorksheetDecisionKey;
  const worksheetDecision = planWorksheetDecision;
  const isPerColumnDecision = planIsPerColumnDecision;
  const decidedColumnCount = missingValuePlanReadiness.decidedColumns;
  const missingValueColumnsByGroup = useMemo(() => {
    const groups: Record<WorksheetMissingTypeGroup, typeof missingValueColumns> = {
      numeric: [],
      text: [],
      date: [],
      boolean: [],
      unknown: [],
    };
    for (const column of missingValueColumns) {
      groups[classifyColumnMissingTypeGroup(column.inferred_type)].push(column);
    }
    return groups;
  }, [missingValueColumns]);

  const presentMissingTypeGroups = useMemo<WorksheetMissingTypeGroup[]>(
    () =>
      (["numeric", "text", "date", "boolean", "unknown"] as WorksheetMissingTypeGroup[]).filter(
        (group) => missingValueColumnsByGroup[group].length > 0,
      ),
    [missingValueColumnsByGroup],
  );
  // C-7B — Group missing-value columns by type so the worksheet-wide UI can
  // expose type-aware fill choices (Replace with 0 / mean / Unknown / etc.).

  // C-7B — Tally how many of the present type-groups have a saved decision.
  // Drives the readiness logic so users get credit for picking worksheet-wide
  // type-aware fills (not just the legacy "treatment" worksheet strategies).
  const worksheetTypeGroupDecisionCount = useMemo(() => {
    let count = 0;
    for (const group of presentMissingTypeGroups) {
      const key = createMissingValueDecisionKey(
        dataset.dataset_id,
        decisionWorksheetId,
        getWorksheetMissingTypeDecisionColumn(group),
      );
      const decision = missingValueDecisions[key];
      if (
        decision &&
        (!decisionNeedsCustomValue(decision.strategy) || decision.customValue?.trim())
      ) {
        count += 1;
      }
    }
    return count;
  }, [
    presentMissingTypeGroups,
    missingValueDecisions,
    dataset.dataset_id,
    decisionWorksheetId,
  ]);

  // C-7B — Sync the view-mode toggle with the persisted worksheet decision
  // when the user navigates back to this worksheet. If they previously chose
  // decide_per_column the UI lands in per-column view; otherwise it stays
  // on the type-grouped worksheet-wide view.
  useEffect(() => {
    setMissingValueViewMode(isPerColumnDecision ? "perColumn" : "wide");
  }, [decisionWorksheetId, isPerColumnDecision]);

  const missingValueDecisionReady = missingValuePlanReadiness.ready;
  // C-7C tri-state status for the Missing-value section's strong tag.
  // The "Some decisions made" branch fires when the user has saved any
  // worksheet-level, type-group, or per-column decision but hasn't reached
  // the ready threshold yet.
  const missingValueDecisionStatus = missingValueDecisionReady
    ? "Decisions ready"
    : Boolean(worksheetDecision) ||
        decidedColumnCount > 0 ||
        worksheetTypeGroupDecisionCount > 0
      ? "Some decisions made"
      : "Not reviewed yet";
  const worstBlankColumns = missingValueColumns.slice(0, 3);
  const previewWorksheetId = selectedWorksheet?.worksheetId;
  const previewWorksheetStatus = selectedWorksheet?.status;
  const excludedEntries = selectedWorksheetDisplayRecipePreview
    ? (Object.entries(selectedWorksheetDisplayRecipePreview.excluded) as [
        keyof CleaningRecipePreview["excluded"],
        number,
      ][]).filter(([, count]) => count > 0)
    : [];

  useEffect(() => {
    if (!restoreContext) return;
    setSelectedWorksheetId(restoreContext.worksheetId);
    setIsOpen(true);
    window.setTimeout(() => {
      window.scrollTo({ top: restoreContext.scrollY, behavior: "auto" });
      reviewRef.current?.focus({ preventScroll: true });
      onRestoreContextConsumed?.();
    }, 0);
  }, [onRestoreContextConsumed, restoreContext]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;
    if (
      !isOpen ||
      !supportsRecipePreview ||
      !previewWorksheetId ||
      (previewWorksheetStatus !== "ready" && previewWorksheetStatus !== "empty")
    ) {
      return undefined;
    }
    if (!shouldStartStructuralPreviewRequest(
      true,
      selectedWorksheetRecipeStatus,
      Boolean(selectedWorksheetRecipePreview),
    )) {
      return undefined;
    }

    const requestId = (structuralPreviewRequestIdsRef.current[previewWorksheetId] || 0) + 1;
    structuralPreviewRequestIdsRef.current[previewWorksheetId] = requestId;
    setRecipeStatusByWorksheet((current) => ({
      ...current,
      [previewWorksheetId]: "loading",
    }));
    setRecipeErrorByWorksheet((current) => ({
      ...current,
      [previewWorksheetId]: null,
    }));

    const timeoutPromise = new Promise<CleaningRecipePreview>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(`We couldn't check structural recommendations for ${decisionWorksheetName}. The request timed out.`));
      }, STRUCTURAL_PREVIEW_TIMEOUT_MS);
    });

    Promise.race([getCleaningRecipePreview(dataset.dataset_id, previewWorksheetId), timeoutPromise])
      .then((response) => {
        if (cancelled) return;
        if (structuralPreviewRequestIdsRef.current[previewWorksheetId] !== requestId) return;
        const validation = validateStructuralPreviewResponse(
          response,
          previewWorksheetId,
          decisionWorksheetName,
        );
        if (!validation.ok) {
          setRecipeErrorByWorksheet((current) => ({
            ...current,
            [previewWorksheetId]: validation.message,
          }));
          setRecipePreviewByWorksheet((current) => {
            const next = { ...current };
            delete next[previewWorksheetId];
            return next;
          });
          setRecipeStatusByWorksheet((current) => ({
            ...current,
            [previewWorksheetId]: "error",
          }));
          return;
        }
        setRecipePreviewByWorksheet((current) => ({
          ...current,
          [previewWorksheetId]: validation.preview,
        }));
        setRecipeStatusByWorksheet((current) => ({
          ...current,
          [previewWorksheetId]: "ready",
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        if (structuralPreviewRequestIdsRef.current[previewWorksheetId] !== requestId) return;
        setRecipeErrorByWorksheet((current) => ({
          ...current,
          [previewWorksheetId]:
            error instanceof Error && error.message
              ? error.message
              : `We couldn't check structural recommendations for ${decisionWorksheetName}. Try again.`,
        }));
        setRecipeStatusByWorksheet((current) => ({
          ...current,
          [previewWorksheetId]: "error",
        }));
        setRecipePreviewByWorksheet((current) => {
          const next = { ...current };
          delete next[previewWorksheetId];
          return next;
        });
      })
      .finally(() => {
        if (timeoutId !== undefined) {
          window.clearTimeout(timeoutId);
        }
      });

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    dataset.dataset_id,
    decisionWorksheetName,
    isOpen,
    previewWorksheetId,
    previewWorksheetStatus,
    selectedWorksheetRecipePreview,
    selectedWorksheetRecipeRetry,
    supportsRecipePreview,
  ]);

  useEffect(() => {
    if (
      !previewWorksheetId ||
      !shouldMarkStructuralPreviewVerificationError(
        shouldLoadSelectedWorksheetPreview,
        selectedWorksheetRecipeStatus,
        Boolean(selectedWorksheetRecipePreview),
      )
    ) {
      return;
    }
    setRecipeErrorByWorksheet((current) => ({
      ...current,
      [previewWorksheetId]: `We couldn't verify the structural preview for ${decisionWorksheetName}. Try again.`,
    }));
    setRecipePreviewByWorksheet((current) => {
      const next = { ...current };
      delete next[previewWorksheetId];
      return next;
    });
    setRecipeStatusByWorksheet((current) => ({
      ...current,
      [previewWorksheetId]: "error",
    }));
  }, [
    decisionWorksheetName,
    previewWorksheetId,
    selectedWorksheetRecipePreview,
    selectedWorksheetRecipeStatus,
    shouldLoadSelectedWorksheetPreview,
  ]);

  useEffect(() => {
    if (
      !selectedWorksheet ||
      activeStep !== "apply" ||
      !combinedDecisionReadiness.canContinueToApply ||
      (!readyStructuralDecisionPlan && !readyMissingValuePlan && !readyTransformationPlan)
    ) return;
    const worksheetId = selectedWorksheet.worksheetId;
    if (
      decisionRecipePlanKeyByWorksheet[worksheetId] === readyPreviewPlanKey &&
      selectedWorksheetDecisionRecipePreview
    ) {
      return;
    }

    const requestId = (decisionPreviewRequestIdsRef.current[worksheetId] || 0) + 1;
    decisionPreviewRequestIdsRef.current[worksheetId] = requestId;
    setDecisionRecipeStatusByWorksheet((current) => ({
      ...current,
      [worksheetId]: "loading",
    }));
    setDecisionRecipeErrorByWorksheet((current) => ({
      ...current,
      [worksheetId]: null,
    }));

    let cancelled = false;
    getCleaningRecipePreview(dataset.dataset_id, worksheetId, {
      rowLimit: 10,
      structuralDecisionPlan: readyStructuralDecisionPlan,
      missingValuePlan: readyMissingValuePlan,
      transformationPlan: readyTransformationPlan,
    })
      .then((response) => {
        if (cancelled) return;
        if (decisionPreviewRequestIdsRef.current[worksheetId] !== requestId) return;
        const validation = validateStructuralPreviewResponse(response, worksheetId, decisionWorksheetName);
        if (!validation.ok) {
          throw new Error(validation.message);
        }
        setDecisionRecipePreviewByWorksheet((current) => ({
          ...current,
          [worksheetId]: validation.preview,
        }));
        setDecisionRecipePlanKeyByWorksheet((current) => ({
          ...current,
          [worksheetId]: readyPreviewPlanKey,
        }));
        setDecisionRecipeStatusByWorksheet((current) => ({
          ...current,
          [worksheetId]: "ready",
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        if (decisionPreviewRequestIdsRef.current[worksheetId] !== requestId) return;
        setDecisionRecipeErrorByWorksheet((current) => ({
          ...current,
          [worksheetId]:
            error instanceof Error && error.message
              ? error.message
              : "Decision-aware cleaning preview could not be loaded.",
        }));
        setDecisionRecipeStatusByWorksheet((current) => ({
          ...current,
          [worksheetId]: "error",
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeStep,
    dataset.dataset_id,
    decisionRecipePlanKeyByWorksheet,
    decisionWorksheetName,
    combinedDecisionReadiness.canContinueToApply,
    readyMissingValuePlan,
    readyTransformationPlan,
    readyPreviewPlanKey,
    readyStructuralDecisionPlan,
    selectedWorksheet,
    selectedWorksheetDecisionRecipePreview,
  ]);

  const selectWorksheet = (worksheet: WorksheetMetadata) => {
    if (worksheet.status !== "ready" && worksheet.status !== "empty") return;
    setSelectedWorksheetId(worksheet.worksheetId);
  };

  const selectedWorksheetApplyState: ApplyState =
    (selectedWorksheet && applyStateByWorksheet[selectedWorksheet.worksheetId]) || {
      status: "idle",
    };
  const activeAnalysisSource = workbook?.activeAnalysisSource || null;
  const selectedCleanedCopy = workbook?.cleanedWorkingCopies.find(
    (copy) => copy.sourceWorksheetId === selectedWorksheet?.worksheetId,
  );
  const locallyCreatedCleanedCopy =
    selectedWorksheetApplyState.status === "success" &&
    selectedWorksheetApplyState.result.status === "applied_to_working_copy"
      ? selectedWorksheetApplyState.result.cleaned_table_name
      : null;
  const hasCleanedWorkingCopy = Boolean(
    selectedCleanedCopy?.cleanedTableName || locallyCreatedCleanedCopy,
  );
  const isSelectedWorksheetActive = activeAnalysisSource?.worksheetId === selectedWorksheet?.worksheetId;
  const isUsingCleanedCopy =
    isSelectedWorksheetActive && activeAnalysisSource?.type === "cleaned_working_copy";

  // Worksheets that the user just applied a recipe to in this session but for
  // which the server-side workbook metadata has not yet refreshed. Used so the
  // badges and summary reflect freshly-created cleaned copies immediately.
  const locallyAppliedWorksheetIds = Object.entries(applyStateByWorksheet)
    .filter(
      ([, state]) =>
        state.status === "success" && state.result.status === "applied_to_working_copy",
    )
    .map(([worksheetId]) => worksheetId);

  type WorksheetCleaningStatus = "original" | "needs-review" | "available" | "active";

  const getWorksheetCleaningStatus = (
    worksheet: WorksheetMetadata,
  ): WorksheetCleaningStatus => {
    const worksheetHasCleaned =
      workbook?.cleanedWorkingCopies.some(
        (copy) => copy.sourceWorksheetId === worksheet.worksheetId,
      ) || locallyAppliedWorksheetIds.includes(worksheet.worksheetId);
    const worksheetIsActive =
      worksheetHasCleaned &&
      activeAnalysisSource?.type === "cleaned_working_copy" &&
      activeAnalysisSource.worksheetId === worksheet.worksheetId;
    if (worksheetIsActive) return "active";
    if (worksheetHasCleaned) return "available";
    if (
      worksheet.status === "ready" &&
      worksheet.normalization.templateStructureCandidate
    ) {
      return "needs-review";
    }
    return "original";
  };

  const worksheetCleaningStatusLabel: Record<WorksheetCleaningStatus, string> = {
    original: "Original",
    "needs-review": "Needs review",
    available: "Cleaned copy available",
    active: "Active cleaned copy",
  };

  const workbookCleanedCount =
    (workbook?.cleanedWorkingCopies.length || 0) +
    locallyAppliedWorksheetIds.filter(
      (worksheetId) =>
        !workbook?.cleanedWorkingCopies.some((copy) => copy.sourceWorksheetId === worksheetId),
    ).length;
  const workbookActiveCleanedCount =
    activeAnalysisSource?.type === "cleaned_working_copy" ? 1 : 0;
  const workbookNeedsReviewCount = worksheets.filter(
    (worksheet) => getWorksheetCleaningStatus(worksheet) === "needs-review",
  ).length;
  const hasWorkbookCleaningSummary =
    workbookCleanedCount > 0 || workbookNeedsReviewCount > 0;
  const pluralise = (count: number, singular: string, plural = `${singular}s`) =>
    `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
  const hasSelectedWorksheetPreviewOperations = hasCleaningRecipePreviewOperations(
    selectedWorksheetDisplayRecipePreview,
  );
  const missingValuePreviewSummary = selectedWorksheetDisplayRecipePreview?.missing_value_summary;
  const transformationPreviewSummary = selectedWorksheetDisplayRecipePreview?.transformation_summary;
  const hasMissingValuePreviewChanges = hasMissingValuePreviewSummaryChanges(
    missingValuePreviewSummary,
  );
  const hasActionableRecipe = Boolean(
    selectedWorksheetDisplayRecipePreview &&
      selectedWorksheet?.status === "ready" &&
      combinedDecisionReadiness.canContinueToApply &&
      isSelectedWorksheetDecisionRecipeCurrent &&
      (hasSelectedWorksheetPreviewOperations || hasMissingValuePreviewChanges),
  );
  const isSelectedWorksheetNoOpDecisionPreview = Boolean(
    hasReadyDecisionPlan &&
      selectedWorksheetDisplayRecipePreview &&
      !hasSelectedWorksheetPreviewOperations &&
      !hasMissingValuePreviewChanges,
  );
  const structuralPreviewComparisonLabels = getStructuralPreviewComparisonLabels(
    isSelectedWorksheetNoOpDecisionPreview,
  );
  const selectedWorksheetName =
    selectedWorksheet?.displayName || selectedWorksheet?.sheetName || "Selected worksheet";
  const selectedWorksheetStatusLabel = isUsingCleanedCopy
    ? "Active cleaned copy"
    : hasCleanedWorkingCopy
      ? "Cleaned copy available"
      : selectedWorksheetDisplayRecipePreview
        ? "Preview only"
        : "Original";
  const selectedWorksheetChangeSummary = selectedWorksheetDisplayRecipePreview
    ? hasSelectedWorksheetPreviewOperations || hasMissingValuePreviewChanges
      ? [
          selectedWorksheetDisplayRecipePreview.recipe.length > 0
            ? pluralise(selectedWorksheetDisplayRecipePreview.recipe.length, "draft recipe step")
            : null,
          getCleaningRecipeExcludedCount(selectedWorksheetDisplayRecipePreview) > 0
            ? pluralise(getCleaningRecipeExcludedCount(selectedWorksheetDisplayRecipePreview), "proposed exclusion")
            : null,
          getMissingValuePreviewChangedColumnCount(missingValuePreviewSummary) > 0
            ? pluralise(getMissingValuePreviewChangedColumnCount(missingValuePreviewSummary), "missing-value column")
            : null,
          (missingValuePreviewSummary?.cells_filled || 0) > 0
            ? pluralise(missingValuePreviewSummary?.cells_filled || 0, "cell fill")
            : null,
          (missingValuePreviewSummary?.rows_removed || 0) > 0
            ? pluralise(missingValuePreviewSummary?.rows_removed || 0, "missing-value row removal")
            : null,
        ]
          .filter(Boolean)
          .join(" and ") + " ready to review."
      : isSelectedWorksheetNoOpDecisionPreview
        ? "Your decisions preserve this worksheet as-is."
        : "No cleaning recipe is needed for this worksheet."
    : "Choose a ready worksheet to preview its draft cleaning recipe.";
  const draftRecipeStatusCopy = getDraftRecipeStatusCopy({
    embedded,
    hasCleanedWorkingCopy,
    isUsingCleanedCopy,
    isNoOpDecisionPreview: isSelectedWorksheetNoOpDecisionPreview,
  });
  const updateApplyState = (worksheetId: string, next: ApplyState) => {
    setApplyStateByWorksheet((current) => ({ ...current, [worksheetId]: next }));
  };

  const saveMissingValueDecision = (
    key: string,
    strategy: MissingValueStrategy,
    customValue?: string,
  ) => {
    setMissingValueDecisions((current) => {
      const next = {
        ...current,
        [key]: createMissingValueDecision(strategy, customValue),
      };
      writeMissingValueDecisions(next);
      return next;
    });
  };

  const beginApplyConfirm = () => {
    if (!selectedWorksheet || !hasActionableRecipe) return;
    updateApplyState(selectedWorksheet.worksheetId, { status: "confirming" });
  };

  const cancelApplyConfirm = () => {
    if (!selectedWorksheet) return;
    updateApplyState(selectedWorksheet.worksheetId, { status: "idle" });
  };

  const confirmApply = async () => {
    if (
      !selectedWorksheet ||
      !hasActionableRecipe ||
      !combinedDecisionReadiness.canContinueToApply ||
      !isSelectedWorksheetDecisionRecipeCurrent
    ) return;
    const worksheetId = selectedWorksheet.worksheetId;
    updateApplyState(worksheetId, { status: "applying" });
    try {
      const result = await applyCleaningRecipe(dataset.dataset_id, worksheetId, {
        structuralDecisionPlan: readyStructuralDecisionPlan,
        missingValuePlan: readyMissingValuePlan,
        transformationPlan: readyTransformationPlan,
      });
      updateApplyState(worksheetId, { status: "success", result });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Cleaned working copy could not be created.";
      updateApplyState(worksheetId, { status: "error", message });
    }
  };

  const retryApply = () => {
    if (!selectedWorksheet) return;
    updateApplyState(selectedWorksheet.worksheetId, { status: "confirming" });
  };

  const retryStructuralPreview = () => {
    if (!selectedWorksheet) return;
    const worksheetId = selectedWorksheet.worksheetId;
    structuralPreviewRequestIdsRef.current[worksheetId] =
      (structuralPreviewRequestIdsRef.current[worksheetId] || 0) + 1;
    setRecipePreviewByWorksheet((current) => {
      const next = { ...current };
      delete next[worksheetId];
      return next;
    });
    setRecipeErrorByWorksheet((current) => ({
      ...current,
      [worksheetId]: null,
    }));
    setRecipeStatusByWorksheet((current) => ({
      ...current,
      [worksheetId]: "idle",
    }));
    setRecipeRetryByWorksheet((current) => ({
      ...current,
      [worksheetId]: (current[worksheetId] || 0) + 1,
    }));
  };

  const useCleanedCopy = async () => {
    if (!selectedWorksheet || !hasCleanedWorkingCopy || !onAnalysisSourceSelect) return;
    const shouldActivate = window.confirm(
      "Use this cleaned working copy for analysis? The original workbook and original analysis table will remain available.",
    );
    if (!shouldActivate) return;

    setActivationState({ status: "switching", worksheetId: selectedWorksheet.worksheetId });
    try {
      await onAnalysisSourceSelect(selectedWorksheet.worksheetId, "cleaned");
      setActivationState({ status: "idle" });
    } catch (error) {
      setActivationState({
        status: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Cleaned working copy could not be activated.",
      });
    }
  };

  const returnToOriginal = async () => {
    if (!selectedWorksheet || !onAnalysisSourceSelect) return;
    const shouldActivate = window.confirm(
      "Return to the original analysis table? The cleaned working copy will remain available.",
    );
    if (!shouldActivate) return;

    setActivationState({ status: "switching", worksheetId: selectedWorksheet.worksheetId });
    try {
      await onAnalysisSourceSelect(selectedWorksheet.worksheetId, "original");
      setActivationState({ status: "idle" });
    } catch (error) {
      setActivationState({
        status: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Original analysis table could not be activated.",
      });
    }
  };

  const previewDataset = () => {
    if (!selectedWorksheet || !onPreviewDataset) return;
    onPreviewDataset(selectedWorksheet.worksheetId);
  };

  const toggleReview = () => {
    setIsOpen((current) => !current);
  };

  return (
    <section
      className={`clean-prepare-assistant${isPrioritized ? " is-prioritized" : ""}${embedded ? " is-embedded" : ""}`}
      aria-label="Intelligence Assistant clean and prepare guidance"
    >
      {!embedded && (
        <div className="clean-prepare-assistant-header">
          <div>
            <p className="section-label">Intelligence Assistant</p>
            <strong>Prepare your data before analysis</strong>
            <p>
              {review.priority === "low"
                ? "No urgent preparation signals were detected. A read-only review remains available."
                : `${review.issues.length} preparation signal${review.issues.length === 1 ? "" : "s"} detected for ${sourceName}.`}
            </p>
          </div>
          <button
            type="button"
            className="clean-prepare-pill"
            onClick={toggleReview}
            aria-expanded={isOpen}
            aria-controls="clean-prepare-review"
          >
            <span>Clean &amp; Prepare Data</span>
            <small>{priorityLabel[review.priority]}</small>
          </button>
        </div>
      )}

      {isOpen && (
        <div
          id="clean-prepare-review"
          className="clean-prepare-review"
          ref={reviewRef}
          tabIndex={-1}
        >
          {!embedded && (
            <div className="clean-prepare-review-heading">
              <div>
                <p className="section-label">Read-only preparation review</p>
                <h3>Clean &amp; Prepare Data</h3>
              </div>
              <button type="button" className="secondary-button" onClick={() => setIsOpen(false)}>
                Close review
              </button>
            </div>
          )}

          <div className={embedded ? "clean-prepare-embedded-layout" : "clean-prepare-standard-layout"}>
            <div className="clean-prepare-step-content">
          <div
            className="clean-prepare-step-pane"
            hidden={embedded && activeStep !== "review"}
          >
            <section className="clean-prepare-issue-groups">
              {embedded ? (
                <>
                  <div className="clean-prepare-review-step-heading">
                    <p className="section-label">Step 1 · Review</p>
                    <h4>Scan what we noticed</h4>
                    <p>Here's what we noticed about your data. No decisions yet - just scan.</p>
                    <small>Click any card to see the specific issues underneath.</small>
                  </div>
                  {review.issues.length > 0 ? (
                    <div className="clean-prepare-issue-card-grid">
                      {issueGroups.map(([category, issues]) => {
                        const cardCopy = getIssueCategoryCardCopy(category);
                        return (
                          <details className="clean-prepare-issue-card" key={category}>
                            <summary>
                              <span className="clean-prepare-issue-card-status">
                                {review.priority === "low" ? "Optional" : "Review"}
                              </span>
                              <strong>{cardCopy.title}</strong>
                              <span>{cardCopy.description}</span>
                              <small>{pluralise(issues.length, "issue")}</small>
                            </summary>
                            <ul>
                              {issues.map((issue) => (
                                <li key={issue.id}>
                                  <strong>{issue.title}</strong>
                                  <span>{issue.detail}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        );
                      })}
                    </div>
                  ) : (
                    <p>No urgent preparation issues were detected from the current dataset profile.</p>
                  )}
                </>
              ) : (
                <>
                  <div className="clean-prepare-compact-heading">
                    <h4>Issues found</h4>
                    <span>{pluralise(review.issues.length, "issue")}</span>
                  </div>
                  {review.issues.length > 0 ? (
                    issueGroups.map(([category, issues]) => (
                      <details className="clean-prepare-disclosure" key={category}>
                        <summary>
                          <strong>{category}</strong>
                          <span>{pluralise(issues.length, "issue")}</span>
                        </summary>
                        <ul>
                          {issues.map((issue) => (
                            <li key={issue.id}>
                              <strong>{issue.title}</strong>
                              <span>{issue.detail}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    ))
                  ) : (
                    <p>No urgent preparation issues were detected from the current dataset profile.</p>
                  )}
                </>
              )}
            </section>
          </div>

          <div
            className="clean-prepare-step-pane"
            hidden={embedded && activeStep !== "decide"}
          >
            {embedded && (
              <div className="clean-prepare-decide-heading">
                <p className="section-label">Step 2 · Decide</p>
                <h4>Choose cleaning decisions</h4>
                <p>Tell us how you want to handle the messy bits. Nothing applies yet.</p>
              </div>
            )}

            <details className="clean-prepare-disclosure clean-prepare-decision-card" open={embedded}>
            <summary>
              <strong>{embedded ? "Suggested cleaning fixes" : "Choose cleaning fixes"}</strong>
              <span>
                {isStructuralPreviewPending
                  ? "Checking"
                  : pluralise(visibleStructuralFixes.length, "draft recommendation")}
              </span>
            </summary>
            {embedded && (
              <p>
                FiltraQueri recommends a path. You decide what belongs in the cleaned working copy.
                Nothing changes until Step 3 Apply.
              </p>
            )}
            {embedded && !isStructuralPreviewPending && selectedWorksheetRecipeStatus !== "error" && visibleStructuralFixes.length > 0 && (
              <>
                <div
                  className="clean-prepare-structural-progress"
                  aria-live="polite"
                  tabIndex={-1}
                  ref={structuralProgressRef}
                >
                  <span>{pluralise(suggestedFixDecisionProgress.total, "recommendation")}</span>
                  <span>{suggestedFixDecisionProgress.resolved.toLocaleString()} resolved</span>
                  <span>{suggestedFixDecisionProgress.unresolved.toLocaleString()} unresolved</span>
                  <span>{suggestedFixDecisionProgress.deferred.toLocaleString()} deferred</span>
                </div>
                <div className="clean-prepare-structural-plan">
                  <div className="clean-prepare-structural-plan-heading">
                    <strong>Structural cleaning plan</strong>
                    {hasStructuralDecisionDrafts && (
                      <button
                        type="button"
                        className="secondary-button clean-prepare-reset-decisions-button"
                        onClick={beginResetStructuralDecisions}
                        ref={resetStructuralDecisionsButtonRef}
                        aria-expanded={isResetStructuralDecisionsConfirming}
                      >
                        Reset worksheet decisions
                      </button>
                    )}
                  </div>
                  {isResetStructuralDecisionsConfirming && (
                    <div
                      className="clean-prepare-reset-confirm"
                      role="group"
                      aria-label="Reset all structural decisions"
                      onKeyDown={handleResetStructuralDecisionsKeyDown}
                    >
                      <strong>Reset structural decisions for this worksheet?</strong>
                      <p>
                        This will clear accepted, preserved, and deferred choices for the selected
                        worksheet and return its recommendations to Needs decision. Nothing has been
                        applied to the workbook.
                      </p>
                      <div className="clean-prepare-reset-confirm-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={cancelResetStructuralDecisions}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={confirmResetStructuralDecisions}
                        >
                          Reset worksheet decisions
                        </button>
                      </div>
                    </div>
                  )}
                  {suggestedFixCleaningPlan.length > 0 ? (
                    <>
                      <ul>
                        {suggestedFixCleaningPlan.map((planItem) => (
                          <li key={planItem}>{planItem}</li>
                        ))}
                      </ul>
                      <p>These decisions will be reviewed in Step 3 before creating a cleaned working copy.</p>
                    </>
                  ) : (
                    <p>No structural cleaning decisions have been made yet.</p>
                  )}
                </div>
              </>
            )}
            {isStructuralPreviewPending ? (
              <p>{`Checking structural recommendations for ${decisionWorksheetName}...`}</p>
            ) : isStructuralPreviewAwaitingRequest ? (
              <p>{`Preparing structural recommendation check for ${decisionWorksheetName}...`}</p>
            ) : selectedWorksheetRecipeStatus === "error" && !selectedWorksheetRecipePreview ? (
              <div className="clean-prepare-preview-state is-error" role="alert">
                <p>
                  {selectedWorksheetRecipeError ||
                    `Structural recommendations for ${decisionWorksheetName} could not be checked. Try again.`}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={retryStructuralPreview}
                >
                  Retry
                </button>
              </div>
            ) : visibleStructuralFixes.length > 0 ? (
              <ul className={embedded ? "clean-prepare-decision-rows" : undefined}>
                {visibleStructuralFixes.map((fix) => {
                  const decision = getSuggestedFixDecision(fix.id, fixDecisionDrafts);
                  const recommendationLabel = getSuggestedFixRecommendationLabel(fix);
                  const keepOriginalLabel = getSuggestedFixKeepOriginalLabel(fix);
                  const radioGroupId = `clean-prepare-fix-${fix.id}`;
                  return (
                    <li key={fix.id} className={`is-${decision}`}>
                      <div className="clean-prepare-decision-row-copy">
                        <div className="clean-prepare-structural-card-heading">
                          <strong id={`${radioGroupId}-heading`}>{fix.title}</strong>
                          <div className="clean-prepare-structural-card-actions">
                            <span className={`clean-prepare-decision-status is-${decision}`}>
                              {suggestedFixDecisionStatusLabels[decision]}
                            </span>
                            {decision !== "unresolved" && (
                              <button
                                type="button"
                                className="clean-prepare-clear-decision-button"
                                onClick={() => clearStructuralDecision(fix.id)}
                                aria-label={`Clear decision for ${fix.title}`}
                              >
                                Clear decision
                              </button>
                            )}
                          </div>
                        </div>
                        <span className="clean-prepare-structural-evidence">{fix.detail}</span>
                      </div>
                      {embedded ? (
                        <fieldset
                          className="clean-prepare-decision-control"
                          aria-labelledby={`${radioGroupId}-heading`}
                        >
                          <legend>Your decision</legend>
                          {([
                            ["use_recommendation", "Recommended action", recommendationLabel, ""],
                            ["keep_original", "Alternative", keepOriginalLabel, ""],
                            ["decide_later", "Defer", "Decide later", "Leave this recommendation unresolved for now."],
                          ] as Array<[Exclude<SuggestedFixDecision, "unresolved">, string, string, string]>).map(
                            ([value, groupLabel, label, helper]) => (
                              <label
                                key={value}
                                className={decision === value ? "is-selected" : ""}
                              >
                                <input
                                  type="radio"
                                  name={radioGroupId}
                                  value={value}
                                  checked={decision === value}
                                  onChange={() =>
                                    setFixDecisionDraftsByWorksheet((current) =>
                                      setWorksheetSuggestedFixDecision(
                                        current,
                                        decisionWorksheetId,
                                        fix.id,
                                        value,
                                      ),
                                    )
                                  }
                                />
                                <span>
                                  <small>{groupLabel}</small>
                                  <strong>{label}</strong>
                                  {helper && <em>{helper}</em>}
                                </span>
                              </label>
                            ),
                          )}
                        </fieldset>
                      ) : (
                        <span>{recommendationLabel}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>{structuralDecisionEmptyStateCopy}</p>
            )}
            </details>

            {missingValueColumns.length > 0 && (
            <section className="clean-prepare-missing-decisions clean-prepare-decision-card">
              <div className="clean-prepare-section-heading">
                <div>
                  <h4>{embedded ? "Missing-value handling" : "Missing value decisions"}</h4>
                  <p>
                    {embedded
                      ? "Choose how blanks should be treated. You can use one strategy for the worksheet or customize individual columns. Nothing changes until Apply."
                      : "Blanks may be intentional layout space, empty future-entry rows, real missing values, unknown values, or fields that should be completed later."}
                  </p>
                </div>
                <strong>{missingValueDecisionStatus}</strong>
              </div>

              {hasMissingValueDecisionDrafts && (
                <button
                  type="button"
                  className="secondary-button clean-prepare-reset-decisions-button"
                  ref={resetMissingValueDecisionsButtonRef}
                  onClick={beginResetMissingValueDecisions}
                  disabled={isResetMissingValueDecisionsConfirming}
                >
                  Reset missing-value decisions
                </button>
              )}

              {isResetMissingValueDecisionsConfirming && (
                <div
                  className="clean-prepare-reset-confirm"
                  role="group"
                  aria-label="Confirm reset missing-value decisions"
                  onKeyDown={(event) => {
                    if (event.key !== "Escape") return;
                    event.stopPropagation();
                    cancelResetMissingValueDecisions();
                  }}
                >
                  <p>
                    Reset missing-value decisions for {selectedWorksheetName}? Other worksheets
                    keep their own decisions.
                  </p>
                  <div className="clean-prepare-reset-confirm-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={cancelResetMissingValueDecisions}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={confirmResetMissingValueDecisions}
                    >
                      Reset decisions
                    </button>
                  </div>
                </div>
              )}

              {selectedWorksheet?.normalization.templateStructureCandidate && (
                <p className="clean-prepare-missing-warning">
                  This worksheet has template-layout signals. Review blanks before choosing any fill
                  strategy.
                </p>
              )}

              <div className="clean-prepare-missing-summary">
                <span>{pluralise(missingValueColumns.length, "column")} with blanks</span>
                <span>{worksheetDecision ? "Reviewed" : "Not reviewed"}</span>
                <span>
                  {worksheetDecision
                    ? `Selected strategy: ${missingValueStrategyLabels[worksheetDecision.strategy]}`
                    : "Selected strategy: Decision needed"}
                </span>
                {isPerColumnDecision && (
                  <span>{decidedColumnCount.toLocaleString()} of {missingValueColumns.length.toLocaleString()} columns decided</span>
                )}
              </div>

              {!missingValuePlanReadiness.ready && (
                <p className="clean-prepare-preview-state is-error">
                  {missingValuePlanReadiness.blockingMessage}
                </p>
              )}

              {/*
                C-7B — Prominent "Customize by column" toggle. Switches the
                Missing-value handling card between worksheet-wide type-grouped
                fills (default) and the per-column override UI from C-7.
              */}
              <div className="clean-prepare-missing-mode-toggle" role="group" aria-label="Choose how to apply missing-value strategies">
                <button
                  type="button"
                  className={missingValueViewMode === "wide" ? "is-active" : ""}
                  onClick={() => {
                    setMissingValueViewMode("wide");
                    // Clear decide_per_column so the worksheet decision no
                    // longer pins the user into per-column mode.
                    if (isPerColumnDecision) {
                      saveMissingValueDecision(worksheetDecisionKey, "leave_unchanged");
                    }
                  }}
                  aria-pressed={missingValueViewMode === "wide"}
                >
                  Worksheet-wide
                </button>
                <button
                  type="button"
                  className={missingValueViewMode === "perColumn" ? "is-active" : ""}
                  onClick={() => {
                    setMissingValueViewMode("perColumn");
                    saveMissingValueDecision(worksheetDecisionKey, "decide_per_column");
                  }}
                  aria-pressed={missingValueViewMode === "perColumn"}
                >
                  Customize by column
                </button>
              </div>

              {/*
                C-7B — Type-grouped worksheet-wide fill choices. Visible when
                missingValueViewMode === "wide". Each present column type
                (numeric / text / date / unknown) gets its own sub-card with
                a radio cluster pulling from getWorksheetMissingTypeStrategies.
                Each cluster persists to its own type-scoped decision key
                inside the existing localStorage map — no new persistence
                layer. The choices the user picks here become draft state;
                nothing applies until Step 3 Apply.
              */}
              {missingValueViewMode === "wide" && presentMissingTypeGroups.length > 0 && (
                <div className="clean-prepare-missing-type-groups">
                  {presentMissingTypeGroups.map((group) => {
                    const groupColumns = missingValueColumnsByGroup[group];
                    const groupKey = createMissingValueDecisionKey(
                      dataset.dataset_id,
                      decisionWorksheetId,
                      getWorksheetMissingTypeDecisionColumn(group),
                    );
                    const groupDecision = missingValueDecisions[groupKey];
                    const groupStrategies = getWorksheetMissingTypeStrategies(group, groupColumns);
                    return (
                      <article
                        className="clean-prepare-missing-type-group"
                        key={group}
                        aria-label={`${worksheetMissingTypeGroupLabels[group]} strategy`}
                      >
                        <header className="clean-prepare-missing-type-head">
                          <div>
                            <strong>{worksheetMissingTypeGroupLabels[group]}</strong>
                            <span>{pluralise(groupColumns.length, "column")} with blanks</span>
                          </div>
                          <span className={`clean-prepare-missing-type-status is-${groupDecision ? "ready" : "pending"}`}>
                            {groupDecision
                              ? missingValueStrategyShortLabels[groupDecision.strategy] ||
                                missingValueStrategyLabels[groupDecision.strategy]
                              : "Decision needed"}
                          </span>
                          {groupDecision && (
                            <button
                              type="button"
                              className="clean-prepare-clear-decision-button"
                              onClick={() => clearOneMissingValueDecision(groupKey)}
                            >
                              Clear
                            </button>
                          )}
                        </header>
                        <fieldset className="clean-prepare-missing-strategy-control">
                          <legend className="visually-hidden-legend">
                            {worksheetMissingTypeGroupLabels[group]}
                          </legend>
                          <div className="clean-prepare-missing-strategy-options">
                            {groupStrategies.map((strategy) => {
                              const isSelected = groupDecision?.strategy === strategy;
                              return (
                                <label
                                  key={strategy}
                                  className={isSelected ? "is-selected" : ""}
                                >
                                  <input
                                    type="radio"
                                    name={`clean-prepare-missing-${group}-${decisionWorksheetId}`}
                                    value={strategy}
                                    checked={isSelected}
                                    onChange={() => saveMissingValueDecision(groupKey, strategy)}
                                  />
                                  <span>
                                    <strong>
                                      {missingValueStrategyShortLabels[strategy] ||
                                        missingValueStrategyLabels[strategy]}
                                    </strong>
                                    <small>
                                      {missingValueStrategyHelpers[strategy] ||
                                        missingValueStrategyLabels[strategy]}
                                    </small>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                          {groupDecision &&
                            decisionNeedsCustomValue(groupDecision.strategy) && (
                              <label className="clean-prepare-missing-custom-input">
                                <span>
                                  {groupDecision.strategy === "custom_date"
                                    ? "Custom date"
                                    : "Custom value"}
                                </span>
                                <input
                                  type={
                                    groupDecision.strategy === "custom_date" ? "date" : "text"
                                  }
                                  value={groupDecision.customValue || ""}
                                  placeholder={
                                    groupDecision.strategy === "custom_date"
                                      ? "yyyy-mm-dd"
                                      : "Type a value"
                                  }
                                  aria-label={`Custom missing value for ${worksheetMissingTypeGroupLabels[group]}`}
                                  onChange={(event) =>
                                    saveMissingValueDecision(
                                      groupKey,
                                      groupDecision.strategy,
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                            )}
                        </fieldset>
                      </article>
                    );
                  })}
                  <p className="clean-prepare-missing-draft-note">
                    These choices will be included in the Step 3 preview. Nothing changes until you create the cleaned working copy.
                  </p>
                </div>
              )}

              {/*
                C-7B — Demoted legacy worksheet treatment options. These
                cover "Treat as layout space" and "Remove rows that are
                mostly blank" — they apply to the rows themselves, not to
                the fill values. Kept available behind a disclosure so the
                K1/K2 worksheet-level treatments remain reachable without
                cluttering the primary type-grouped fill UI above.
              */}
              {missingValueViewMode === "wide" && (
                <details className="clean-prepare-disclosure" open={false}>
                  <summary>
                    <strong>Other worksheet options</strong>
                    <span>Row-level treatment</span>
                  </summary>
                  <fieldset className="clean-prepare-missing-strategy-control">
                    <legend className="visually-hidden-legend">Worksheet treatment</legend>
                    {worksheetDecision && worksheetDecision.strategy !== "decide_per_column" && (
                      <button
                        type="button"
                        className="clean-prepare-clear-decision-button"
                        onClick={() => clearOneMissingValueDecision(worksheetDecisionKey)}
                      >
                        Clear worksheet treatment
                      </button>
                    )}
                    <div className="clean-prepare-missing-strategy-options">
                      {worksheetMissingValueStrategies
                        .filter((strategy) => strategy !== "decide_per_column")
                        .map((strategy) => {
                          const isSelected = worksheetDecision?.strategy === strategy;
                          return (
                            <label
                              key={strategy}
                              className={isSelected ? "is-selected" : ""}
                            >
                              <input
                                type="radio"
                                name={`clean-prepare-missing-treatment-${decisionWorksheetId}`}
                                value={strategy}
                                checked={isSelected}
                                onChange={() =>
                                  saveMissingValueDecision(worksheetDecisionKey, strategy)
                                }
                              />
                              <span>
                                <strong>
                                  {missingValueStrategyShortLabels[strategy] ||
                                    missingValueStrategyLabels[strategy]}
                                </strong>
                                <small>
                                  {missingValueStrategyHelpers[strategy] ||
                                    missingValueStrategyLabels[strategy]}
                                </small>
                              </span>
                            </label>
                          );
                        })}
                    </div>
                  </fieldset>
                </details>
              )}

              <details className="clean-prepare-disclosure" open={embedded}>
                <summary>
                  <strong>Worst blank-rate fields</strong>
                  <span>{pluralise(worstBlankColumns.length, "field")}</span>
                </summary>
                <ul>
                  {worstBlankColumns.map((column) => {
                    const rate = decisionRowCount > 0
                      ? (column.null_count / decisionRowCount) * 100
                      : 0;
                    return (
                      <li key={column.name}>
                        <strong>{getColumnDisplayName(column.name)}</strong>
                        <span>{column.null_count.toLocaleString()} blanks ({rate.toFixed(1)}%). {rate >= 70 ? "High blank rate: review before filling." : "Review before the Step 3 preview."}</span>
                      </li>
                    );
                  })}
                </ul>
              </details>

              {missingValueViewMode === "perColumn" && (
                <section className="clean-prepare-missing-per-column" aria-label="Per-column missing-value strategies">
                  <header className="clean-prepare-missing-per-column-head">
                    <strong>Customize by column</strong>
                    <span>{pluralise(missingValueColumns.length, "field")}</span>
                  </header>
                  <p className="clean-prepare-missing-strategy-helper">
                    A per-column decision overrides the worksheet choice for
                    that column only. Choices below match the column type.
                  </p>
                  {/*
                    C-7 — Per-column strategy cards. Same radio-card pattern
                    as the worksheet-wide cluster above, but the strategy set
                    is type-aware (numeric / text / date / unknown). Custom
                    value / custom date prompts appear inline below the radio
                    row only when their strategy is selected.
                  */}
                  <div className="clean-prepare-missing-columns">
                    {missingValueColumns.map((column) => {
                      const decisionKey = createMissingValueDecisionKey(
                        dataset.dataset_id,
                        decisionWorksheetId,
                        column.name,
                      );
                      const decision = missingValueDecisions[decisionKey];
                      const rate = decisionRowCount > 0
                        ? (column.null_count / decisionRowCount) * 100
                        : 0;
                      const columnStrategies = getColumnMissingValueStrategies(column);
                      const columnDisplayName = getColumnDisplayName(column.name);
                      const radioGroupName = `clean-prepare-missing-col-${decisionWorksheetId}-${column.name}`;
                      return (
                        <article
                          className="clean-prepare-missing-column"
                          key={column.name}
                        >
                          <div className="clean-prepare-missing-column-head">
                            <div>
                              <strong>{columnDisplayName}</strong>
                              <span>
                                {column.inferred_type || "unknown type"} ·{" "}
                                {rate.toFixed(1)}% blank
                              </span>
                            </div>
                          </div>
                          <fieldset className="clean-prepare-missing-strategy-control is-per-column">
                            <legend>Strategy for this column</legend>
                            <div className="clean-prepare-missing-strategy-options">
                              {columnStrategies.map((strategy) => {
                                const isSelected = decision?.strategy === strategy;
                                return (
                                  <label
                                    key={strategy}
                                    className={isSelected ? "is-selected" : ""}
                                  >
                                    <input
                                      type="radio"
                                      name={radioGroupName}
                                      value={strategy}
                                      checked={isSelected}
                                      onChange={() =>
                                        saveMissingValueDecision(
                                          decisionKey,
                                          strategy,
                                        )
                                      }
                                    />
                                    <span>
                                      <strong>
                                        {missingValueStrategyShortLabels[strategy] ||
                                          missingValueStrategyLabels[strategy]}
                                      </strong>
                                      <small>
                                        {missingValueStrategyHelpers[strategy] ||
                                          missingValueStrategyLabels[strategy]}
                                      </small>
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                            {decision &&
                              decisionNeedsCustomValue(decision.strategy) && (
                                <label className="clean-prepare-missing-custom-input">
                                  <span>
                                    {decision.strategy === "custom_date"
                                      ? "Custom date"
                                      : "Custom value"}
                                  </span>
                                  <input
                                    type={
                                      decision.strategy === "custom_date" ? "date" : "text"
                                    }
                                    value={decision.customValue || ""}
                                    placeholder={
                                      decision.strategy === "custom_date"
                                        ? "yyyy-mm-dd"
                                        : "Type a value"
                                    }
                                    aria-label={`Custom missing value for ${columnDisplayName}`}
                                    onChange={(event) =>
                                      saveMissingValueDecision(
                                        decisionKey,
                                        decision.strategy,
                                        event.target.value,
                                      )
                                    }
                                  />
                                </label>
                              )}
                          </fieldset>
                          {decision && (
                            <button
                              type="button"
                              className="clean-prepare-clear-decision-button"
                              onClick={() => clearOneMissingValueDecision(decisionKey)}
                            >
                              Clear decision
                            </button>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}

              <p className="clean-prepare-missing-draft-note">
                This choice will be included in the Step 3 preview. Nothing changes until you create the cleaned working copy.
              </p>
              </section>
            )}
          </div>

          <div
            className="clean-prepare-step-pane"
            hidden={embedded && activeStep !== "apply"}
          >
            {supportsRecipePreview && worksheets.length > 0 && (
            <>
              {embedded && (
                <div className="clean-prepare-apply-step-heading">
                  <p className="section-label">Step 3 &middot; Apply</p>
                  <h4>Create the cleaned working copy</h4>
                  <p>
                    Create a cleaned working copy for the worksheet you select. The original
                    workbook and other worksheets remain unchanged.
                  </p>
                </div>
              )}
            <section className={embedded ? "clean-prepare-apply-card" : "clean-prepare-recipe-preview"}>
              <div className="clean-prepare-section-heading">
                <div>
                  <h4>{embedded ? selectedWorksheetName : "Preview cleaned working copy"}</h4>
                  <p>
                    {embedded
                      ? "Review the draft shape for this worksheet before creating a cleaned copy."
                      : "Review a proposed analysis shape for one worksheet at a time."}
                  </p>
                </div>
                <strong>{embedded ? selectedWorksheetStatusLabel : "Preview only"}</strong>
              </div>

              <div className="clean-prepare-worksheet-tabs" aria-label="Cleaning recipe worksheets">
                {worksheets.map((worksheet) => {
                  const worksheetStatus = getWorksheetCleaningStatus(worksheet);
                  const statusLabel = worksheetCleaningStatusLabel[worksheetStatus];
                  const worksheetLabel = worksheet.displayName || worksheet.sheetName;
                  return (
                    <button
                      type="button"
                      key={worksheet.worksheetId}
                      className={worksheet.worksheetId === selectedWorksheet?.worksheetId ? "is-active" : ""}
                      disabled={worksheet.status !== "ready" && worksheet.status !== "empty"}
                      onClick={() => selectWorksheet(worksheet)}
                      aria-label={`${worksheetLabel}, ${statusLabel}`}
                      title={`${worksheetLabel} - ${statusLabel}`}
                    >
                      <span className="clean-prepare-worksheet-tab-label">{worksheetLabel}</span>
                      <span
                        className={`clean-prepare-worksheet-badge is-${worksheetStatus}`}
                        aria-hidden="true"
                      >
                        {statusLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {hasWorkbookCleaningSummary && (
                <div className="clean-prepare-workbook-summary" aria-live="polite">
                  <strong>Workbook cleaning status</strong>
                  <span>
                    {workbookCleanedCount > 0 &&
                      `${pluralise(workbookCleanedCount, "cleaned working copy", "cleaned working copies")} available`}
                    {workbookCleanedCount > 0 && workbookActiveCleanedCount > 0 && " - 1 active"}
                    {workbookCleanedCount > 0 && workbookNeedsReviewCount > 0 && " - "}
                    {workbookNeedsReviewCount > 0 &&
                      `${pluralise(workbookNeedsReviewCount, "worksheet")} needs review`}
                  </span>
                  <p>Each worksheet keeps its own original data and its own cleaned working copy.</p>
                </div>
              )}

              {embedded && selectedWorksheet && (
                <div className="clean-prepare-apply-card-summary" aria-live="polite">
                  <strong>
                    {isUsingCleanedCopy
                      ? "Using cleaned copy"
                      : hasCleanedWorkingCopy
                        ? "Cleaned copy available"
                        : "No cleaned working copy yet."}
                  </strong>
                  <p>
                    {isUsingCleanedCopy
                      ? "This worksheet's cleaned working copy is active for analysis."
                      : hasCleanedWorkingCopy
                        ? "You can activate the cleaned copy when you are ready to use it for analysis."
                        : "Create a cleaned working copy after reviewing the preview. The original workbook remains unchanged."}
                  </p>
                  <span>{selectedWorksheetChangeSummary}</span>
                </div>
              )}

              {selectedWorksheetRecipeStatus === "loading" ||
              isStructuralPreviewPending ||
              isDecisionRecipePreviewPending ? (
                <p className="clean-prepare-preview-state">Loading draft recipe preview...</p>
              ) : hasReadyDecisionPlan && selectedWorksheetDecisionRecipeStatus === "error" ? (
                <p className="clean-prepare-preview-state is-error">
                  {selectedWorksheetDecisionRecipeError ||
                    "Decision-aware cleaning recipe preview could not be loaded."}
                </p>
              ) : selectedWorksheetRecipeStatus === "error" ? (
                <p className="clean-prepare-preview-state is-error">
                  {selectedWorksheetRecipeError || "Cleaning recipe preview could not be loaded."}
                </p>
              ) : selectedWorksheetDisplayRecipePreview ? (
                <>
                  <div className="clean-prepare-summary-grid">
                    <div>
                      <span>{structuralPreviewComparisonLabels.before}</span>
                      <strong>
                        {selectedWorksheetDisplayRecipePreview.before.row_count.toLocaleString()} rows /{" "}
                        {selectedWorksheetDisplayRecipePreview.before.column_count.toLocaleString()} columns
                      </strong>
                    </div>
                    <div>
                      <span>{structuralPreviewComparisonLabels.after}</span>
                      <strong>
                        {selectedWorksheetDisplayRecipePreview.after_preview.row_count.toLocaleString()} rows /{" "}
                        {selectedWorksheetDisplayRecipePreview.after_preview.column_count.toLocaleString()} columns
                      </strong>
                    </div>
                  </div>

                  {selectedWorksheetDisplayRecipePreview.recipe.length > 0 ? (
                    <details className="clean-prepare-disclosure" open={embedded}>
                      <summary>
                        <strong>Draft recipe steps</strong>
                        <span>{pluralise(selectedWorksheetDisplayRecipePreview.recipe.length, "step")}</span>
                      </summary>
                      <ul className="clean-prepare-recipe-list">
                        {selectedWorksheetDisplayRecipePreview.recipe.map((step) => (
                          <li key={step.type}>
                            <strong>{recipeStepLabels[step.type] || step.type}</strong>
                            <span>{step.explanation}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : isSelectedWorksheetNoOpDecisionPreview ? (
                    <section className="clean-prepare-apply-area is-no-op" aria-live="polite">
                      <h4>{structuralNoOpApplyHeading}</h4>
                      <p className="clean-prepare-apply-helper">{structuralNoOpApplyCopy}</p>
                      <div className="clean-prepare-apply-confirm-actions">
                        <a className="secondary-button" href="#decide">
                          Back to Decide
                        </a>
                        {onContinueInAnalyst && (
                          <button
                            type="button"
                            className="primary-button"
                            onClick={onContinueInAnalyst}
                          >
                            Continue with original in Analyst
                          </button>
                        )}
                      </div>
                    </section>
                  ) : !hasSelectedWorksheetPreviewOperations && !hasMissingValuePreviewChanges ? (
                    <p className="clean-prepare-preview-state">
                      No cleaning recipe is needed for this worksheet.
                    </p>
                  ) : (
                    <p className="clean-prepare-preview-state">
                      Review the proposed changes before creating a cleaned working copy.
                    </p>
                  )}

                  {excludedEntries.length > 0 && (
                    <details className="clean-prepare-disclosure" open={embedded}>
                      <summary>
                        <strong>Proposed exclusions</strong>
                        <span>{pluralise(excludedEntries.length, "category", "categories")}</span>
                      </summary>
                      <div className="clean-prepare-excluded">
                        <div>
                          {excludedEntries.map(([key, count]) => (
                            <span key={key}>
                              {excludedLabels[key]}: {count.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      </div>
                    </details>
                  )}

                  {missingValuePreviewSummary && (
                    <details className="clean-prepare-disclosure" open={embedded}>
                      <summary>
                        <strong>Missing-value changes</strong>
                        <span>
                          {hasMissingValuePreviewChanges
                            ? `${getMissingValuePreviewChangedColumnCount(missingValuePreviewSummary).toLocaleString()} columns / ${(missingValuePreviewSummary.cells_filled || 0).toLocaleString()} cells`
                            : "No changes"}
                        </span>
                      </summary>
                      <div className="clean-prepare-missing-summary">
                        <span>
                          Worksheet strategy:{" "}
                          {String(missingValuePreviewSummary.worksheet_strategy || "leave_unchanged")}
                        </span>
                        <span>
                          {pluralise(getMissingValuePreviewChangedColumnCount(missingValuePreviewSummary), "column")} affected
                        </span>
                        <span>{pluralise(missingValuePreviewSummary.cells_filled || 0, "cell")} filled</span>
                        <span>{pluralise(missingValuePreviewSummary.rows_removed || 0, "row")} removed</span>
                      </div>
                      {missingValuePreviewSummary.operations &&
                        missingValuePreviewSummary.operations.length > 0 && (
                          <ul className="clean-prepare-recipe-list">
                            {missingValuePreviewSummary.operations.map((operation, index) => (
                              <li key={`missing-preview:${index}`}>
                                <strong>
                                  {operation.column_name
                                    ? getColumnDisplayName(String(operation.column_name))
                                    : "Worksheet rows"}
                                </strong>
                                <span>
                                  {String(operation.strategy)}
                                  {typeof operation.affected_cells === "number"
                                    ? ` - ${pluralise(operation.affected_cells, "cell")} filled`
                                    : ""}
                                  {typeof operation.affected_rows === "number"
                                    ? ` - ${pluralise(operation.affected_rows, "row")} removed`
                                    : ""}
                                  {operation.preview_value !== undefined
                                    ? ` - preview value ${formatPreviewCell(operation.preview_value)}`
                                    : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                    </details>
                  )}

                  {transformationPreviewSummary && transformationPreviewSummary.step_count > 0 && (
                    <details className="clean-prepare-disclosure" open={embedded}>
                      <summary>
                        <strong>Transformation changes</strong>
                        <span>
                          {transformationPreviewSummary.step_count.toLocaleString()} steps / {transformationPreviewSummary.cells_changed.toLocaleString()} cells
                        </span>
                      </summary>
                      <div className="clean-prepare-missing-summary">
                        <span>Status: {String(transformationPreviewSummary.status)}</span>
                        <span>{pluralise(transformationPreviewSummary.changed_columns.length, "changed column")}</span>
                        <span>{pluralise(transformationPreviewSummary.added_columns.length, "added column")}</span>
                      </div>
                      {transformationPreviewSummary.operations.length > 0 && (
                        <ul className="clean-prepare-recipe-list">
                          {transformationPreviewSummary.operations.map((operation, index) => (
                            <li key={`transformation-preview:${index}`}>
                              <strong>{String(operation.kind || operation.type || "Transformation")}</strong>
                              <span>{String(operation.detail || operation.column_name || operation.target_column || "Applied by backend preview")}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  )}

                  {selectedWorksheetDisplayRecipePreview.after_preview.rows.length > 0 ? (
                    <details className="clean-prepare-disclosure" open={embedded}>
                      <summary>
                        <strong>Preview cleaned rows</strong>
                        <span>{pluralise(selectedWorksheetDisplayRecipePreview.after_preview.rows.length, "sample row")}</span>
                      </summary>
                      <div className="clean-prepare-preview-table-wrap">
                        <table className="clean-prepare-preview-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            {selectedWorksheetDisplayRecipePreview.after_preview.columns.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedWorksheetDisplayRecipePreview.after_preview.rows.map((row, index) => {
                            const provenance =
                              selectedWorksheetDisplayRecipePreview.after_preview.row_provenance[index]?.original_row_index;
                            return (
                              <tr key={`${provenance ?? "preview"}:${index}`}>
                                <td title={provenance === undefined ? undefined : `Original workbook row ${provenance + 1}`}>
                                  {index + 1}
                                </td>
                                {selectedWorksheetDisplayRecipePreview.after_preview.columns.map((column) => (
                                  <td key={column}>{formatPreviewCell(row[column])}</td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                        </table>
                      </div>
                    </details>
                  ) : (
                    <p className="clean-prepare-preview-state">
                      No cleaned rows are available to preview for this worksheet.
                    </p>
                  )}

                  {hasActionableRecipe &&
                    selectedWorksheet &&
                    (!hasCleanedWorkingCopy || selectedWorksheetApplyState.status !== "idle") && (
                    <div
                      className={`clean-prepare-apply-area is-${selectedWorksheetApplyState.status}`}
                      aria-live="polite"
                    >
                      {selectedWorksheetApplyState.status === "idle" && (
                        <>
                          {embedded && (
                            <h4>Create cleaned working copy</h4>
                          )}
                          <p className="clean-prepare-apply-helper">
                            The original workbook will not be changed. A new cleaned table is created alongside the existing analysis table.
                          </p>
                          <button
                            type="button"
                            className="primary-button"
                            onClick={beginApplyConfirm}
                          >
                            Create cleaned working copy
                          </button>
                        </>
                      )}
                      {selectedWorksheetApplyState.status === "confirming" && (
                        <div className="clean-prepare-apply-confirm" role="group" aria-label="Confirm create cleaned working copy">
                          <p>
                            Create a cleaned working copy from this worksheet? The original workbook will remain unchanged.
                          </p>
                          <div className="clean-prepare-apply-confirm-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={cancelApplyConfirm}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="primary-button"
                              onClick={confirmApply}
                            >
                              Create cleaned working copy
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedWorksheetApplyState.status === "applying" && (
                        <p className="clean-prepare-apply-progress">
                          Creating cleaned working copy...
                        </p>
                      )}

                      {selectedWorksheetApplyState.status === "success" && (
                        <div className="clean-prepare-apply-success" role="status">
                          <strong>Cleaned working copy created. Original workbook unchanged.</strong>
                          {selectedWorksheetApplyState.result.status === "no_recipe_needed" ? (
                            <p>{selectedWorksheetApplyState.result.message}</p>
                          ) : (
                            <>
                              <div className="clean-prepare-summary-grid">
                                <div>
                                  <span>Before</span>
                                  <strong>
                                    {selectedWorksheetApplyState.result.before.row_count.toLocaleString()} rows /{" "}
                                    {selectedWorksheetApplyState.result.before.column_count.toLocaleString()} columns
                                  </strong>
                                </div>
                                <div>
                                  <span>After cleanup</span>
                                  <strong>
                                    {selectedWorksheetApplyState.result.after.row_count.toLocaleString()} rows /{" "}
                                    {selectedWorksheetApplyState.result.after.column_count.toLocaleString()} columns
                                  </strong>
                                </div>
                              </div>
                              {selectedWorksheetApplyState.result.cleaned_table_name && (
                                <p className="clean-prepare-apply-table-name">
                                  Cleaned table: <code>{selectedWorksheetApplyState.result.cleaned_table_name}</code>
                                </p>
                              )}
                              <p className="clean-prepare-apply-activation-note">
                                The active analysis table is unchanged until you choose to use this copy.
                              </p>
                              {selectedWorksheetApplyState.result.preview_rows.length > 0 && (
                                <details className="clean-prepare-disclosure">
                                  <summary>
                                    <strong>Preview created copy rows</strong>
                                    <span>{pluralise(selectedWorksheetApplyState.result.preview_rows.length, "sample row")}</span>
                                  </summary>
                                  <div className="clean-prepare-preview-table-wrap">
                                    <table className="clean-prepare-preview-table">
                                    <thead>
                                      <tr>
                                        <th>#</th>
                                        {selectedWorksheetApplyState.result.after.columns.map((column) => (
                                          <th key={column}>{column}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {selectedWorksheetApplyState.result.preview_rows.map((row, index) => (
                                        <tr key={`applied:${index}`}>
                                          <td>{index + 1}</td>
                                          {selectedWorksheetApplyState.result.after.columns.map((column) => (
                                            <td key={column}>{formatPreviewCell(row[column])}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                    </table>
                                  </div>
                                </details>
                              )}
                            </>
                          )}
                        </div>
                      )}

                      {selectedWorksheetApplyState.status === "error" && (
                        <div className="clean-prepare-apply-error" role="alert">
                          <strong>Could not create cleaned working copy.</strong>
                          <p>{selectedWorksheetApplyState.message}</p>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={retryApply}
                          >
                            Try again
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedWorksheet?.status === "ready" && hasCleanedWorkingCopy && (
                    <div className="clean-prepare-activation-area" aria-live="polite">
                      {isUsingCleanedCopy ? (
                        <>
                          <strong>
                            Active for this worksheet: Cleaned working copy
                            {selectedWorksheet && ` (${selectedWorksheet.displayName || selectedWorksheet.sheetName})`}
                          </strong>
                          <p>Original workbook preserved. You can switch this worksheet back to its original analysis table.</p>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={returnToOriginal}
                            disabled={activationState.status === "switching"}
                          >
                            Return to original analysis table
                          </button>
                        </>
                      ) : (
                        <>
                          <strong>Cleaned working copy available</strong>
                          <p>Original workbook preserved. Activation changes the analysis source only.</p>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={useCleanedCopy}
                            disabled={activationState.status === "switching"}
                          >
                            Use cleaned copy for analysis
                          </button>
                        </>
                      )}
                      {activationState.status === "switching" && (
                        <p>Switching analysis source...</p>
                      )}
                      {activationState.status === "error" && (
                        <p className="clean-prepare-activation-error">{activationState.message}</p>
                      )}
                      {onPreviewDataset && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={previewDataset}
                          disabled={activationState.status === "switching"}
                        >
                          Preview dataset
                        </button>
                      )}
                    </div>
                  )}
                </>
              ) : recipeStatusByWorksheet[decisionWorksheetId] === "ready" && !selectedWorksheetDisplayRecipePreview ? (
                <p className="clean-prepare-preview-state">
                  Loading the selected worksheet preview...
                </p>
              ) : (
                <p className="clean-prepare-preview-state">
                  Choose a ready worksheet to preview its draft cleaning recipe.
                </p>
              )}
              </section>
            </>
            )}

            <section className="clean-prepare-draft-status">
            <h4>Draft recipe status</h4>
            {selectedWorksheetApplyState.status === "success" &&
            selectedWorksheetApplyState.result.status === "applied_to_working_copy" &&
            !isSelectedWorksheetNoOpDecisionPreview ? (
              <>
                <strong>
                  Cleaned working copy created for {selectedWorksheetApplyState.result.worksheet_name}. Original workbook unchanged.
                </strong>
                <p>
                  Other worksheets that have not been applied remain preview-only. Original workbook preserved.
                </p>
              </>
            ) : (
              <>
                <strong>
                  {draftRecipeStatusCopy.heading}
                </strong>
                <p>
                  {draftRecipeStatusCopy.body}
                </p>
              </>
            )}
            </section>
            {embedded && onContinueInAnalyst && !isSelectedWorksheetNoOpDecisionPreview && (
              <section className="clean-prepare-analyst-handoff">
                <div>
                  <strong>Ready for analysis?</strong>
                  <p>
                    Continue when you're ready to analyze the active source. Run Query stays manual in Analyst.
                  </p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={onContinueInAnalyst}
                >
                  Continue in Analyst &rarr;
                </button>
              </section>
            )}
          </div>
            </div>

          </div>
        </div>
      )}
    </section>
  );
}
