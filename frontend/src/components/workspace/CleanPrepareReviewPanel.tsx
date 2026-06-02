import { useEffect, useMemo, useState } from "react";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import { buildPreparationSignalReport } from "../../features/dataPreparation/preparationSignals";
import {
  getWorkbookMetadata,
  type WorksheetMetadata,
  type WorksheetTemplateStructureEvidence,
  type WorksheetTemplateStructureEvidenceType,
} from "../../features/workbook";
import {
  getCleaningRecipePreview,
  type CleaningRecipePreview,
} from "../../services/api";

type CleanPrepareReviewPanelProps = {
  dataset: DatasetMetadata;
  sourceName: string;
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
}: CleanPrepareReviewPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedWorksheetId, setSelectedWorksheetId] = useState<string | null>(null);
  const [recipePreview, setRecipePreview] = useState<CleaningRecipePreview | null>(null);
  const [recipeStatus, setRecipeStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [recipeError, setRecipeError] = useState<string | null>(null);
  const review = useMemo(() => buildPreparationReview(dataset), [dataset]);
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
  const previewWorksheetId = selectedWorksheet?.worksheetId;
  const previewWorksheetStatus = selectedWorksheet?.status;
  const excludedEntries = recipePreview
    ? (Object.entries(recipePreview.excluded) as [
        keyof CleaningRecipePreview["excluded"],
        number,
      ][]).filter(([, count]) => count > 0)
    : [];

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
      className={`clean-prepare-assistant${isPrioritized ? " is-prioritized" : ""}`}
      aria-label="Intelligence Assistant clean and prepare guidance"
    >
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

      {isOpen && (
        <div id="clean-prepare-review" className="clean-prepare-review">
          <div className="clean-prepare-review-heading">
            <div>
              <p className="section-label">Read-only preparation review</p>
              <h3>Clean &amp; Prepare Data</h3>
            </div>
            <button type="button" className="secondary-button" onClick={() => setIsOpen(false)}>
              Close review
            </button>
          </div>

          <section>
            <h4>Issues found</h4>
            {review.issues.length > 0 ? (
              <ul>
                {review.issues.map((issue) => (
                  <li key={issue.id}>
                    <strong>{issue.title}</strong>
                    <span>{issue.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No urgent preparation issues were detected from the current dataset profile.</p>
            )}
          </section>

          <section>
            <h4>Suggested fixes</h4>
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
          </section>

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
                {worksheets.map((worksheet) => (
                  <button
                    type="button"
                    key={worksheet.worksheetId}
                    className={worksheet.worksheetId === selectedWorksheet?.worksheetId ? "is-active" : ""}
                    disabled={worksheet.status !== "ready" && worksheet.status !== "empty"}
                    onClick={() => selectWorksheet(worksheet)}
                  >
                    {worksheet.displayName || worksheet.sheetName}
                  </button>
                ))}
              </div>

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
                    <ul className="clean-prepare-recipe-list">
                      {recipePreview.recipe.map((step) => (
                        <li key={step.type}>
                          <strong>{recipeStepLabels[step.type] || step.type}</strong>
                          <span>{step.explanation}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="clean-prepare-preview-state">
                      No cleaning recipe is needed for this worksheet.
                    </p>
                  )}

                  {excludedEntries.length > 0 && (
                    <div className="clean-prepare-excluded">
                      <strong>Proposed exclusions</strong>
                      <div>
                        {excludedEntries.map(([key, count]) => (
                          <span key={key}>
                            {excludedLabels[key]}: {count.toLocaleString()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {recipePreview.after_preview.rows.length > 0 ? (
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
                  ) : (
                    <p className="clean-prepare-preview-state">
                      No cleaned rows are available to preview for this worksheet.
                    </p>
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
            <strong>Preview only — no changes have been applied.</strong>
            <p>Creating a cleaned working copy will come in a later phase.</p>
          </section>
        </div>
      )}
    </section>
  );
}
