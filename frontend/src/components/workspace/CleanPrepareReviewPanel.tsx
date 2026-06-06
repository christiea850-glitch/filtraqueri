import { useEffect, useMemo, useRef, useState } from "react";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import { buildPreparationSignalReport } from "../../features/dataPreparation/preparationSignals";
import {
  createMissingValueDecision,
  createMissingValueDecisionKey,
  decisionNeedsCustomValue,
  getColumnMissingValueStrategies,
  missingValueStrategyLabels,
  readMissingValueDecisions,
  WORKSHEET_DECISION_COLUMN,
  worksheetMissingValueStrategies,
  writeMissingValueDecisions,
  type MissingValueStrategy,
} from "../../features/dataPreparation/missingValueDecisions";
import {
  getWorkbookMetadata,
  type WorksheetMetadata,
  type WorksheetTemplateStructureEvidence,
  type WorksheetTemplateStructureEvidenceType,
} from "../../features/workbook";
import {
  applyCleaningRecipe,
  applyMissingValueDecisions,
  getCleaningRecipePreview,
  type CleaningRecipeApplyResponse,
  type CleaningRecipePreview,
  type MissingValueDecisionApplyResponse,
} from "../../services/api";

type ApplyState =
  | { status: "idle" }
  | { status: "confirming" }
  | { status: "applying" }
  | { status: "success"; result: CleaningRecipeApplyResponse }
  | { status: "error"; message: string };

type ActivationState =
  | { status: "idle" }
  | { status: "switching"; worksheetId: string }
  | { status: "error"; message: string };

type MissingValueApplyState =
  | { status: "idle" }
  | { status: "applying" }
  | { status: "success"; result: MissingValueDecisionApplyResponse }
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
  // When true, the panel is mounted inside a dedicated page (FocusedWorkspaceShell)
  // that already provides intro framing and Back navigation. We then skip the
  // internal "Intelligence Assistant" intro header and the toggle pill, and
  // render the review section directly. No execution change.
  embedded?: boolean;
};

type PreparationPriority = "low" | "medium" | "high";

type PreparationIssue = {
  id: string;
  title: string;
  detail: string;
};

type SuggestedFix = {
  id: string;
  title: string;
  detail: string;
};

type PreparationReview = {
  priority: PreparationPriority;
  issues: PreparationIssue[];
  suggestedFixes: SuggestedFix[];
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

const getSuggestedFix = (
  type: WorksheetTemplateStructureEvidenceType,
): SuggestedFix | null => {
  switch (type) {
    case "repeated_header":
      return {
        id: type,
        title: "Remove repeated header rows",
        detail: "Exclude repeated headers from a future working copy.",
      };
    case "date_title_row":
      return {
        id: type,
        title: "Keep section dates",
        detail: "Preserve applicable date labels as a future `_section_date` field.",
      };
    case "section_banner":
      return {
        id: type,
        title: "Keep section labels",
        detail: "Preserve applicable banners as a future `_section_label` field.",
      };
    case "sparse_layout_gap":
      return {
        id: type,
        title: "Ignore layout separator rows",
        detail: "Exclude empty template spacing from a future working copy.",
      };
    case "serial_only_placeholder_rows":
      return {
        id: type,
        title: "Remove empty template slots",
        detail: "Exclude serial-only placeholder rows from a future working copy.",
      };
    case "side_note_region_candidate":
      return {
        id: type,
        title: "Exclude side-note columns",
        detail: "Keep note regions outside the future analysis table.",
      };
    case "repeated_missing_pattern":
      return {
        id: type,
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

const buildPreparationReview = (dataset: DatasetMetadata): PreparationReview => {
  const report = buildPreparationSignalReport(dataset);
  const issues = buildEvidenceIssues(report.templateEvidenceSignals);
  const suggestedFixes = new Map<string, SuggestedFix>();

  report.templateEvidenceSignals.forEach(({ evidence }) => {
    const fix = getSuggestedFix(evidence.type);
    if (fix) suggestedFixes.set(fix.id, fix);
  });

  const { missingColumns, highBlankColumns, generatedColumns, hasRepeatedHighBlankPattern } =
    report;

  if (missingColumns.length > 0) {
    issues.push({
      id: "dataset:missing-values",
      title: "Missing values detected",
      detail: `${missingColumns.length} field${missingColumns.length === 1 ? "" : "s"} contain blank values that should be reviewed before preparation.`,
    });
    suggestedFixes.set("dataset:missing-values", {
      id: "dataset:missing-values",
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
    issues.push({
      id: "dataset:generated-columns",
      title: "Generated column names detected",
      detail: `${generatedColumns.length} field${generatedColumns.length === 1 ? "" : "s"} still use names such as ${generatedColumns[0]}.`,
    });
    suggestedFixes.set("dataset:generated-columns", {
      id: "dataset:generated-columns",
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
    suggestedFixes: Array.from(suggestedFixes.values()),
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
  embedded = false,
}: CleanPrepareReviewPanelProps) {
  const reviewRef = useRef<HTMLDivElement | null>(null);
  // When embedded, the review is the whole reason the dedicated page exists,
  // so start open.
  const [isOpen, setIsOpen] = useState(embedded);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(null);
  const [recipePreview, setRecipePreview] = useState<CleaningRecipePreview | null>(null);
  const [recipeStatus, setRecipeStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const [applyStateByWorksheet, setApplyStateByWorksheet] = useState<
    Record<string, ApplyState>
  >({});
  const [activationState, setActivationState] = useState<ActivationState>({ status: "idle" });
  const [missingValueApplyStateByWorksheet, setMissingValueApplyStateByWorksheet] = useState<
    Record<string, MissingValueApplyState>
  >({});
  const [missingValueDecisions, setMissingValueDecisions] = useState(readMissingValueDecisions);
  const review = useMemo(() => buildPreparationReview(dataset), [dataset]);
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
  const workbook = useMemo(() => getWorkbookMetadata(dataset), [dataset]);
  const worksheets = workbook?.worksheets || [];
  const supportsRecipePreview = dataset.original_filename.toLowerCase().endsWith(".xlsx");
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
  const decisionColumns = selectedWorksheet?.schema || dataset.schema;
  const decisionRowCount = selectedWorksheet?.rowCount || dataset.row_count;
  const missingValueColumns = decisionColumns
    .filter((column) => column.null_count > 0)
    .sort((left, right) => right.null_count - left.null_count);
  const worksheetDecisionKey = createMissingValueDecisionKey(
    dataset.dataset_id,
    decisionWorksheetId,
    WORKSHEET_DECISION_COLUMN,
  );
  const worksheetDecision = missingValueDecisions[worksheetDecisionKey];
  const isPerColumnDecision = worksheetDecision?.strategy === "decide_per_column";
  const decidedColumnCount = missingValueColumns.filter((column) => {
    const decision =
      missingValueDecisions[
        createMissingValueDecisionKey(dataset.dataset_id, decisionWorksheetId, column.name)
      ];
    return Boolean(
      decision &&
      (!decisionNeedsCustomValue(decision.strategy) || decision.customValue?.trim()),
    );
  }).length;
  const missingValueDecisionReady =
    missingValueColumns.length > 0 &&
    Boolean(worksheetDecision) &&
    (!isPerColumnDecision || decidedColumnCount === missingValueColumns.length);
  const missingValueDecisionStatus = !worksheetDecision
    ? "Not reviewed"
    : missingValueDecisionReady
      ? "Ready for cleanup plan"
      : "Decision needed";
  const worstBlankColumns = missingValueColumns.slice(0, 3);
  const selectedMissingValueApplyState: MissingValueApplyState =
    missingValueApplyStateByWorksheet[decisionWorksheetId] || { status: "idle" };
  const previewWorksheetId = selectedWorksheet?.worksheetId;
  const previewWorksheetStatus = selectedWorksheet?.status;
  const excludedEntries = recipePreview
    ? (Object.entries(recipePreview.excluded) as [
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
    if (
      !isOpen ||
      !supportsRecipePreview ||
      !previewWorksheetId ||
      (previewWorksheetStatus !== "ready" && previewWorksheetStatus !== "empty")
    ) {
      return undefined;
    }

    const requestTimeout = window.setTimeout(() => {
      setRecipePreview(null);
      setRecipeStatus("loading");
      setRecipeError(null);
      getCleaningRecipePreview(dataset.dataset_id, previewWorksheetId)
        .then((response) => {
          if (cancelled) return;
          setRecipePreview(response);
          setRecipeStatus("success");
        })
        .catch((error) => {
          if (cancelled) return;
          setRecipeError(
            error instanceof Error && error.message
              ? error.message
              : "Cleaning recipe preview could not be loaded.",
          );
          setRecipeStatus("error");
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(requestTimeout);
    };
  }, [dataset.dataset_id, isOpen, previewWorksheetId, previewWorksheetStatus, supportsRecipePreview]);

  const selectWorksheet = (worksheet: WorksheetMetadata) => {
    if (worksheet.status !== "ready" && worksheet.status !== "empty") return;
    setRecipePreview(null);
    setRecipeStatus("loading");
    setRecipeError(null);
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
  const hasActionableRecipe =
    recipePreview !== null &&
    recipePreview.recipe.length > 0 &&
    recipeStatus === "success" &&
    selectedWorksheet?.status === "ready";

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

  const applyMissingValueDecisionDraft = async () => {
    if (
      !selectedWorksheet ||
      !worksheetDecision ||
      !missingValueDecisionReady ||
      !hasCleanedWorkingCopy ||
      isUsingCleanedCopy
    ) {
      return;
    }
    const shouldApply = window.confirm(
      "Apply missing-value decisions to cleaned working copy? Original workbook will remain unchanged.",
    );
    if (!shouldApply) return;

    const worksheetId = selectedWorksheet.worksheetId;
    setMissingValueApplyStateByWorksheet((current) => ({
      ...current,
      [worksheetId]: { status: "applying" },
    }));
    try {
      const columnDecisions =
        worksheetDecision.strategy === "decide_per_column"
          ? missingValueColumns.flatMap((column) => {
              const decision =
                missingValueDecisions[
                  createMissingValueDecisionKey(dataset.dataset_id, worksheetId, column.name)
                ];
              return decision
                ? [{
                    column_name: column.name,
                    strategy: decision.strategy,
                    custom_value: decision.customValue,
                  }]
                : [];
            })
          : [];
      const result = await applyMissingValueDecisions(dataset.dataset_id, worksheetId, {
        worksheet_strategy: worksheetDecision.strategy,
        column_decisions: columnDecisions,
      });
      setMissingValueApplyStateByWorksheet((current) => ({
        ...current,
        [worksheetId]: { status: "success", result },
      }));
    } catch (error) {
      setMissingValueApplyStateByWorksheet((current) => ({
        ...current,
        [worksheetId]: {
          status: "error",
          message:
            error instanceof Error && error.message
              ? error.message
              : "Missing-value decisions could not be applied.",
        },
      }));
    }
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
    if (!selectedWorksheet || !hasActionableRecipe) return;
    const worksheetId = selectedWorksheet.worksheetId;
    updateApplyState(worksheetId, { status: "applying" });
    try {
      const result = await applyCleaningRecipe(dataset.dataset_id, worksheetId);
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
    if (!isOpen && supportsRecipePreview && selectedWorksheet) {
      setRecipePreview(null);
      setRecipeStatus("loading");
      setRecipeError(null);
    }
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

          <section className="clean-prepare-issue-groups">
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
          </section>

          <details className="clean-prepare-disclosure">
            <summary>
              <strong>Suggested fixes</strong>
              <span>{pluralise(review.suggestedFixes.length, "draft recommendation")}</span>
            </summary>
            {review.suggestedFixes.length > 0 ? (
              <ul>
                {review.suggestedFixes.map((fix) => (
                  <li key={fix.id}>
                    <strong>{fix.title}</strong>
                    <span>{fix.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No draft fixes are suggested yet.</p>
            )}
          </details>

          {missingValueColumns.length > 0 && (
            <section className="clean-prepare-missing-decisions">
              <div className="clean-prepare-section-heading">
                <div>
                  <h4>Missing value decisions</h4>
                  <p>
                    Blanks may be intentional layout space, empty future-entry rows, real missing
                    values, unknown values, or fields that should be completed later.
                  </p>
                </div>
                <strong>{missingValueDecisionStatus}</strong>
              </div>

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

              <label className="clean-prepare-missing-strategy">
                <span>Worksheet strategy</span>
                <select
                  value={worksheetDecision?.strategy || ""}
                  onChange={(event) =>
                    saveMissingValueDecision(
                      worksheetDecisionKey,
                      event.target.value as MissingValueStrategy,
                    )
                  }
                >
                  <option value="" disabled>Choose a draft decision</option>
                  {worksheetMissingValueStrategies.map((strategy) => (
                    <option key={strategy} value={strategy}>
                      {missingValueStrategyLabels[strategy]}
                    </option>
                  ))}
                </select>
              </label>

              <details className="clean-prepare-disclosure">
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
                        <strong>{column.name}</strong>
                        <span>{column.null_count.toLocaleString()} blanks ({rate.toFixed(1)}%). {rate >= 70 ? "High blank rate: review before filling." : "Review before future cleanup."}</span>
                      </li>
                    );
                  })}
                </ul>
              </details>

              {isPerColumnDecision && (
                <details className="clean-prepare-disclosure" open>
                  <summary>
                    <strong>Decide per column</strong>
                    <span>{pluralise(missingValueColumns.length, "field")}</span>
                  </summary>
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
                      return (
                        <div className="clean-prepare-missing-column" key={column.name}>
                          <div>
                            <strong>{column.name}</strong>
                            <span>{column.inferred_type} / {rate.toFixed(1)}% blank</span>
                          </div>
                          <select
                            aria-label={`Missing value strategy for ${column.name}`}
                            value={decision?.strategy || ""}
                            onChange={(event) =>
                              saveMissingValueDecision(
                                decisionKey,
                                event.target.value as MissingValueStrategy,
                              )
                            }
                          >
                            <option value="" disabled>Choose decision</option>
                            {getColumnMissingValueStrategies(column).map((strategy) => (
                              <option key={strategy} value={strategy}>
                                {missingValueStrategyLabels[strategy]}
                              </option>
                            ))}
                          </select>
                          {decisionNeedsCustomValue(decision?.strategy) && (
                            <input
                              type={decision?.strategy === "custom_date" ? "date" : "text"}
                              value={decision?.customValue || ""}
                              placeholder="Custom value"
                              aria-label={`Custom missing value for ${column.name}`}
                              onChange={(event) =>
                                saveMissingValueDecision(
                                  decisionKey,
                                  decision.strategy,
                                  event.target.value,
                                )
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}

              <p className="clean-prepare-missing-draft-note">
                Draft decision only. Decision saved for a future cleanup plan; no values have been
                changed.
              </p>

              {missingValueDecisionReady && hasCleanedWorkingCopy && !isUsingCleanedCopy && (
                <button
                  type="button"
                  className="primary-button clean-prepare-missing-apply-button"
                  onClick={applyMissingValueDecisionDraft}
                  disabled={selectedMissingValueApplyState.status === "applying"}
                >
                  {selectedMissingValueApplyState.status === "applying"
                    ? "Applying missing-value decisions..."
                    : "Apply missing-value decisions"}
                </button>
              )}

              {missingValueDecisionReady && isUsingCleanedCopy && (
                <p className="clean-prepare-missing-warning">
                  Return to the original analysis table before updating this cleaned working copy.
                </p>
              )}

              {selectedMissingValueApplyState.status === "error" && (
                <p className="clean-prepare-preview-state is-error">
                  {selectedMissingValueApplyState.message}
                </p>
              )}

              {selectedMissingValueApplyState.status === "success" && (
                <div className="clean-prepare-missing-apply-summary" role="status">
                  <strong>Missing-value decisions applied to cleaned working copy.</strong>
                  <p>{selectedMissingValueApplyState.result.worksheet_name}</p>
                  <div className="clean-prepare-missing-summary">
                    <span>Cleaned working copy updated</span>
                    <span>{pluralise(selectedMissingValueApplyState.result.decisions_applied.length, "decision")} applied</span>
                    <span>{pluralise(selectedMissingValueApplyState.result.columns_changed.length, "column")} changed</span>
                    <span>{selectedMissingValueApplyState.result.rows_removed.toLocaleString()} rows removed</span>
                    <span>{pluralise(selectedMissingValueApplyState.result.skipped_decisions.length, "decision")} skipped</span>
                  </div>
                  <p>
                    Cleaned table: <code>{selectedMissingValueApplyState.result.cleaned_table_name}</code>
                  </p>
                  <p>
                    Columns changed:{" "}
                    {selectedMissingValueApplyState.result.columns_changed.length > 0
                      ? selectedMissingValueApplyState.result.columns_changed.join(", ")
                      : "None"}
                  </p>
                  {selectedMissingValueApplyState.result.decisions_applied.length > 0 && (
                    <details className="clean-prepare-disclosure">
                      <summary>
                        <strong>Applied decisions</strong>
                        <span>{selectedMissingValueApplyState.result.decisions_applied.length.toLocaleString()}</span>
                      </summary>
                      <ul>
                        {selectedMissingValueApplyState.result.decisions_applied.map((decision, index) => (
                          <li key={`${decision.column_name || decision.scope || "worksheet"}:${decision.strategy}:${index}`}>
                            <strong>{decision.column_name || "Worksheet decision"}</strong>
                            <span>{decision.strategy.replace(/_/g, " ")}. {decision.explanation}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {selectedMissingValueApplyState.result.skipped_decisions.length > 0 && (
                    <details className="clean-prepare-disclosure">
                      <summary>
                        <strong>Skipped decisions</strong>
                        <span>{selectedMissingValueApplyState.result.skipped_decisions.length.toLocaleString()}</span>
                      </summary>
                      <ul>
                        {selectedMissingValueApplyState.result.skipped_decisions.map((decision) => (
                          <li key={`${decision.column_name}:${decision.strategy}`}>
                            <strong>{decision.column_name || "Worksheet decision"}</strong>
                            <span>{decision.explanation}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <p>Original workbook unchanged. Activation remains a separate user choice.</p>
                  {onPreviewDataset && selectedWorksheet && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={previewDataset}
                    >
                      Preview dataset
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {supportsRecipePreview && worksheets.length > 0 && (
            <section className="clean-prepare-recipe-preview">
              <div className="clean-prepare-section-heading">
                <div>
                  <h4>Draft cleaning recipe</h4>
                  <p>Review a proposed analysis shape for one worksheet at a time.</p>
                </div>
                <strong>Preview only</strong>
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
                      title={`${worksheetLabel} — ${statusLabel}`}
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
                    {workbookCleanedCount > 0 && workbookActiveCleanedCount > 0 && " · 1 active"}
                    {workbookCleanedCount > 0 && workbookNeedsReviewCount > 0 && " · "}
                    {workbookNeedsReviewCount > 0 &&
                      `${pluralise(workbookNeedsReviewCount, "worksheet")} needs review`}
                  </span>
                  <p>Each worksheet keeps its own original data and its own cleaned working copy.</p>
                </div>
              )}

              {recipeStatus === "loading" ? (
                <p className="clean-prepare-preview-state">Loading draft recipe preview...</p>
              ) : recipeStatus === "error" ? (
                <p className="clean-prepare-preview-state is-error">
                  {recipeError || "Cleaning recipe preview could not be loaded."}
                </p>
              ) : recipePreview ? (
                <>
                  <div className="clean-prepare-summary-grid">
                    <div>
                      <span>Before</span>
                      <strong>
                        {recipePreview.before.row_count.toLocaleString()} rows /{" "}
                        {recipePreview.before.column_count.toLocaleString()} columns
                      </strong>
                    </div>
                    <div>
                      <span>Preview after cleanup</span>
                      <strong>
                        {recipePreview.after_preview.row_count.toLocaleString()} rows /{" "}
                        {recipePreview.after_preview.column_count.toLocaleString()} columns
                      </strong>
                    </div>
                  </div>

                  {recipePreview.recipe.length > 0 ? (
                    <details className="clean-prepare-disclosure">
                      <summary>
                        <strong>Draft recipe steps</strong>
                        <span>{pluralise(recipePreview.recipe.length, "step")}</span>
                      </summary>
                      <ul className="clean-prepare-recipe-list">
                        {recipePreview.recipe.map((step) => (
                          <li key={step.type}>
                            <strong>{recipeStepLabels[step.type] || step.type}</strong>
                            <span>{step.explanation}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <p className="clean-prepare-preview-state">
                      No cleaning recipe is needed for this worksheet.
                    </p>
                  )}

                  {excludedEntries.length > 0 && (
                    <details className="clean-prepare-disclosure">
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

                  {recipePreview.after_preview.rows.length > 0 ? (
                    <details className="clean-prepare-disclosure">
                      <summary>
                        <strong>Preview cleaned rows</strong>
                        <span>{pluralise(recipePreview.after_preview.rows.length, "sample row")}</span>
                      </summary>
                      <div className="clean-prepare-preview-table-wrap">
                        <table className="clean-prepare-preview-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            {recipePreview.after_preview.columns.map((column) => (
                              <th key={column}>{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recipePreview.after_preview.rows.map((row, index) => {
                            const provenance =
                              recipePreview.after_preview.row_provenance[index]?.original_row_index;
                            return (
                              <tr key={`${provenance ?? "preview"}:${index}`}>
                                <td title={provenance === undefined ? undefined : `Original workbook row ${provenance + 1}`}>
                                  {index + 1}
                                </td>
                                {recipePreview.after_preview.columns.map((column) => (
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
                          Creating cleaned working copy…
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
              ) : (
                <p className="clean-prepare-preview-state">
                  Choose a ready worksheet to preview its draft cleaning recipe.
                </p>
              )}
            </section>
          )}

          <section className="clean-prepare-draft-status">
            <h4>Draft recipe status</h4>
            {selectedWorksheetApplyState.status === "success" &&
            selectedWorksheetApplyState.result.status === "applied_to_working_copy" ? (
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
                <strong>Preview only — no changes have been applied to this worksheet yet.</strong>
                <p>Use Create cleaned working copy on a ready XLSX worksheet to produce a cleaned table alongside the original.</p>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
