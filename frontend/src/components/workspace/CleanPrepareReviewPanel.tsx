import { useMemo, useState } from "react";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import { buildPreparationSignalReport } from "../../features/dataPreparation/preparationSignals";
import {
  type WorksheetTemplateStructureEvidence,
  type WorksheetTemplateStructureEvidenceType,
} from "../../features/workbook";

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

export function CleanPrepareReviewPanel({
  dataset,
  sourceName,
}: CleanPrepareReviewPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const review = useMemo(() => buildPreparationReview(dataset), [dataset]);
  const isPrioritized = review.priority !== "low";

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
          onClick={() => setIsOpen((current) => !current)}
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

          <section className="clean-prepare-draft-status">
            <h4>Draft recipe status</h4>
            <strong>Draft only - no changes have been applied.</strong>
            <p>Apply to working copy will come in a later phase.</p>
          </section>
        </div>
      )}
    </section>
  );
}
