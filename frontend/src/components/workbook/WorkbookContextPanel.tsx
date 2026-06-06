import { useEffect, useMemo, useState } from "react";
import type { DatasetMetadata } from "../../features/dataset/datasetTypes";
import {
  getWorkbookContractDiagnostics,
  type RelationshipContractDiagnostic,
  type RelationshipContractDiagnosticsResponse,
} from "../../services/api";
import {
  getActiveWorksheet,
  getWorkbookMetadata,
  type AcceptedRelationshipContract,
  type WorkbookIngestionProfile,
  type WorksheetRelationshipCandidate,
  type WorksheetMetadata,
  type WorksheetStatus,
} from "../../features/workbook";
import { useWorkbookRelationships, type WorkbookJoinPlanPreview } from "../../features/workbookRelationships";

type WorkbookContextPanelProps = {
  dataset: DatasetMetadata | null;
  variant?: "results" | "analyst";
  onRelationshipReview?: (
    candidateId: string,
    reviewStatus: "pending" | "accepted" | "dismissed",
    notes?: string,
  ) => void;
  /**
   * Make the existing "Worksheet tables" list the single source of worksheet
   * activation. When provided, every non-active row gets a "Make active" button
   * that promotes the worksheet to the active analysis source (the right-rail
   * duplicate has been removed).
   */
  onWorksheetSelect?: (worksheetId: string) => void;
  isSwitchingWorksheet?: boolean;
};

const statusLabel = (status: WorksheetStatus) => (status === "error" ? "unsupported" : status);

const countByStatus = (worksheets: WorksheetMetadata[], status: WorksheetStatus) =>
  worksheets.filter((worksheet) => worksheet.status === status).length;

const formatProfileValue = (value: number | string) =>
  typeof value === "number" ? value.toLocaleString() : value;

const formatWorkbookColumnPreview = (worksheet: WorksheetMetadata) =>
  worksheet.schema.slice(0, 6).map((column) =>
    column.name
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

function WorkbookProfileList({ profile }: { profile: WorkbookIngestionProfile }) {
  const profileItems = [
    ["Max sheets", profile.maxWorksheets],
    ["Profile rows", profile.maxRowsPerWorksheetProfile],
    ["Profile columns", profile.maxColumnsPerWorksheet],
    ["Preview rows", profile.maxPreviewRows],
  ];

  return (
    <div className="workbook-profile-list" aria-label="Workbook ingestion profile">
      {profileItems.map(([label, value]) => (
        <span key={label}>
          {label}
          <strong>{formatProfileValue(value)}</strong>
        </span>
      ))}
    </div>
  );
}

function JoinPlanPreviewList({ previews }: { previews: WorkbookJoinPlanPreview[] }) {
  if (previews.length === 0) {
    return <p className="workbook-empty-note">No future join plan previews are available yet.</p>;
  }

  return (
    <div className="workbook-join-preview-list" aria-label="Future workbook join plan previews">
      {previews.map((preview) => (
        <div className="workbook-join-preview-card" key={preview.id}>
          <div className="workbook-relationship-path">
            {preview.relatedSheets.map((sheet, index) => (
              <strong key={`${preview.id}:${sheet}`}>
                {index > 0 ? "-> " : ""}
                {sheet}
              </strong>
            ))}
          </div>
          <p>{preview.expectedJoinBehavior}</p>
          <div className="workbook-relationship-tables">
            {preview.suggestedRelationshipPath.map((path) => (
              <span key={`${preview.id}:${path}`}>{path}</span>
            ))}
          </div>
          <div className="workbook-evidence-list">
            {preview.supportedTaskCategories.map((category) => (
              <span key={`${preview.id}:${category}`}>{category.replace(/_/g, " ")}</span>
            ))}
          </div>
          <div className="workbook-join-notes">
            {preview.futureExecutionNotes.map((note) => (
              <small key={`${preview.id}:${note}`}>{note}</small>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const relationshipTypeLabel = (type: WorksheetRelationshipCandidate["relationshipType"]) => {
  if (type === "one_to_many_candidate") return "one to many";
  if (type === "many_to_one_candidate") return "many to one";
  if (type === "one_to_one_candidate") return "one to one";
  return "unknown";
};

const validationLabel = (state: AcceptedRelationshipContract["validationState"]) => {
  if (state === "valid") return "valid";
  if (state === "broken") return "broken";
  return "warning";
};

function AcceptedRelationshipList({
  contracts,
}: {
  contracts: AcceptedRelationshipContract[];
}) {
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const selectedContract =
    contracts.find((contract) => contract.contractId === selectedContractId) || contracts[0] || null;

  if (contracts.length === 0) {
    return <p className="workbook-empty-note">No accepted relationship contracts yet.</p>;
  }

  return (
    <div className="accepted-relationship-section" aria-label="Accepted relationship contracts">
      <div className="accepted-relationship-list">
        {contracts.map((contract) => (
          <button
            type="button"
            className={`accepted-relationship-card ${contract.validationState} ${contract.status}`}
            key={contract.contractId}
            onClick={() => setSelectedContractId(contract.contractId)}
          >
            <span className={`relationship-validation ${contract.validationState}`}>
              {validationLabel(contract.validationState)}
            </span>
            <strong>
              {contract.sourceColumnName} -&gt; {contract.targetColumnName}
            </strong>
            <small>{relationshipTypeLabel(contract.relationshipType)}</small>
            <span>
              {contract.sourceTableName} -&gt; {contract.targetTableName}
            </span>
          </button>
        ))}
      </div>

      {selectedContract && (
        <div className="relationship-detail-panel" aria-label="Accepted relationship detail">
          <div className="builder-block-header">
            <span>Accepted contract</span>
            <small>{selectedContract.status}</small>
          </div>
          <div className="workbook-summary-grid">
            <span>
              Validation
              <strong>{selectedContract.validationState}</strong>
            </span>
            <span>
              Confidence
              <strong>{Math.round(selectedContract.confidence * 100)}%</strong>
            </span>
            <span>
              Overlap
              <strong>{Math.round(selectedContract.overlapRatio * 100)}%</strong>
            </span>
            <span>
              Source unique
              <strong>{Math.round(selectedContract.sourceUniqueRatio * 100)}%</strong>
            </span>
            <span>
              Target unique
              <strong>{Math.round(selectedContract.targetUniqueRatio * 100)}%</strong>
            </span>
            <span>
              Type compatible
              <strong>{selectedContract.inferredTypeCompatible ? "Yes" : "No"}</strong>
            </span>
          </div>
          <div className="workbook-relationship-path">
            <strong>
              {selectedContract.sourceTableName}.{selectedContract.sourceColumnName}
            </strong>
            <span aria-hidden="true">-&gt;</span>
            <strong>
              {selectedContract.targetTableName}.{selectedContract.targetColumnName}
            </strong>
          </div>
          <div className="workbook-evidence-list">
            {selectedContract.validationSummary.map((summary) => (
              <span key={summary}>{summary}</span>
            ))}
          </div>
          <div className="workbook-relationship-tables">
            <span>Accepted {selectedContract.acceptedAt || "unknown"}</span>
            <span>Validated {selectedContract.lastValidatedAt || "not yet"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ContractDiagnosticsPanel({
  diagnostics,
  worksheets,
  contracts,
}: {
  diagnostics: RelationshipContractDiagnosticsResponse | null;
  worksheets: WorksheetMetadata[];
  contracts: AcceptedRelationshipContract[];
}) {
  const [severityFilter, setSeverityFilter] = useState("all");
  const [worksheetFilter, setWorksheetFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filteredDiagnostics = useMemo(() => {
    const items = diagnostics?.diagnostics || [];
    return items.filter((item) => {
      const contract = contracts.find((current) => current.contractId === item.contract_id);
      const matchesSeverity = severityFilter === "all" || item.severity === severityFilter;
      const matchesType = typeFilter === "all" || contract?.relationshipType === typeFilter;
      const matchesWorksheet =
        worksheetFilter === "all" ||
        contract?.sourceWorksheetId === worksheetFilter ||
        contract?.targetWorksheetId === worksheetFilter;
      return matchesSeverity && matchesType && matchesWorksheet;
    });
  }, [contracts, diagnostics, severityFilter, typeFilter, worksheetFilter]);

  if (!diagnostics) {
    return <p className="workbook-empty-note">Contract diagnostics have not been loaded.</p>;
  }

  return (
    <div className="contract-diagnostics-panel" aria-label="Relationship contract diagnostics">
      <div className="workbook-status-grid">
        <span className="relationship-validation valid">
          healthy {diagnostics.summary.healthy}
        </span>
        <span className="relationship-validation warning">
          warning {diagnostics.summary.warning}
        </span>
        <span className="relationship-validation broken">
          broken {diagnostics.summary.broken}
        </span>
        <span className="relationship-review-status pending">stale {diagnostics.summary.stale}</span>
      </div>

      <div className="relationship-review-controls">
        <label>
          <span>Severity</span>
          <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="broken">Broken</option>
          </select>
        </label>
        <label>
          <span>Worksheet</span>
          <select
            value={worksheetFilter}
            onChange={(event) => setWorksheetFilter(event.target.value)}
          >
            <option value="all">All</option>
            {worksheets.map((worksheet) => (
              <option key={worksheet.worksheetId} value={worksheet.worksheetId}>
                {worksheet.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Type</span>
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="one_to_many_candidate">One to many</option>
            <option value="many_to_one_candidate">Many to one</option>
            <option value="one_to_one_candidate">One to one</option>
            <option value="unknown_candidate">Unknown</option>
          </select>
        </label>
      </div>

      <div className="contract-diagnostic-list">
        {filteredDiagnostics.map((item: RelationshipContractDiagnostic) => (
          <button
            type="button"
            className={`contract-diagnostic-row ${item.severity}`}
            key={item.diagnostic_id}
            onClick={() => setExpandedId(expandedId === item.diagnostic_id ? null : item.diagnostic_id)}
          >
            <span className={`relationship-validation ${item.severity === "healthy" ? "valid" : item.severity}`}>
              {item.severity}
            </span>
            <strong>{item.issue_summary}</strong>
            <small>{item.affected_source} -&gt; {item.affected_target}</small>
            {expandedId === item.diagnostic_id && (
              <span className="diagnostic-action-chip">{item.suggested_action}</span>
            )}
          </button>
        ))}
        {filteredDiagnostics.length === 0 && (
          <p className="workbook-empty-note">No diagnostics match these filters.</p>
        )}
      </div>
    </div>
  );
}

function RelationshipCandidateList({
  candidates,
  worksheets,
  onRelationshipReview,
}: {
  candidates: WorksheetRelationshipCandidate[];
  worksheets: WorksheetMetadata[];
  onRelationshipReview?: WorkbookContextPanelProps["onRelationshipReview"];
}) {
  const [searchText, setSearchText] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [worksheetFilter, setWorksheetFilter] = useState("all");
  const [sortMode, setSortMode] = useState("confidence");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const selectedCandidate =
    candidates.find((candidate) => candidate.relationshipId === selectedCandidateId) ||
    candidates[0] ||
    null;
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredCandidates = useMemo(() => {
    const matchingCandidates = candidates.filter((candidate) => {
      const haystack = [
        candidate.sourceWorksheetName,
        candidate.sourceColumn,
        candidate.sourceTable,
        candidate.targetWorksheetName,
        candidate.targetColumn,
        candidate.targetTable,
        candidate.relationshipType,
        ...candidate.evidence.summaries,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = normalizedSearch ? haystack.includes(normalizedSearch) : true;
      const matchesConfidence =
        confidenceFilter === "all" || candidate.confidenceLabel === confidenceFilter;
      const matchesReview =
        reviewFilter === "all" || candidate.reviewStatus === reviewFilter;
      const matchesWorksheet =
        worksheetFilter === "all" ||
        candidate.sourceWorksheetId === worksheetFilter ||
        candidate.targetWorksheetId === worksheetFilter;

      return matchesSearch && matchesConfidence && matchesReview && matchesWorksheet;
    });

    return [...matchingCandidates].sort((left, right) => {
      if (sortMode === "status") return left.reviewStatus.localeCompare(right.reviewStatus);
      if (sortMode === "worksheet") {
        return `${left.sourceWorksheetName}.${left.targetWorksheetName}`.localeCompare(
          `${right.sourceWorksheetName}.${right.targetWorksheetName}`,
        );
      }
      return right.confidence - left.confidence;
    });
  }, [candidates, confidenceFilter, normalizedSearch, reviewFilter, sortMode, worksheetFilter]);
  const pendingCount = candidates.filter((candidate) => candidate.reviewStatus === "pending").length;
  const acceptedCount = candidates.filter((candidate) => candidate.reviewStatus === "accepted").length;
  const dismissedCount = candidates.filter((candidate) => candidate.reviewStatus === "dismissed").length;

  if (candidates.length === 0) {
    return <p className="workbook-empty-note">No relationship candidates profiled yet.</p>;
  }

  const saveReview = (
    candidate: WorksheetRelationshipCandidate,
    reviewStatus: "pending" | "accepted" | "dismissed",
  ) => {
    onRelationshipReview?.(candidate.relationshipId, reviewStatus, reviewNotes);
  };

  return (
    <div className="workbook-relationship-review" aria-label="Relationship review">
      <div className="relationship-review-controls">
        <label>
          <span>Search</span>
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Sheet, column, evidence"
          />
        </label>
        <label>
          <span>Confidence</span>
          <select
            value={confidenceFilter}
            onChange={(event) => setConfidenceFilter(event.target.value)}
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label>
          <span>Review</span>
          <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="dismissed">Dismissed</option>
          </select>
        </label>
        <label>
          <span>Worksheet</span>
          <select
            value={worksheetFilter}
            onChange={(event) => setWorksheetFilter(event.target.value)}
          >
            <option value="all">All</option>
            {worksheets.map((worksheet) => (
              <option key={worksheet.worksheetId} value={worksheet.worksheetId}>
                {worksheet.displayName}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="confidence">Confidence</option>
            <option value="status">Review status</option>
            <option value="worksheet">Worksheet</option>
          </select>
        </label>
      </div>
      <div className="workbook-status-grid" aria-label="Relationship review summary">
        <span className="relationship-review-status accepted">accepted {acceptedCount}</span>
        <span className="relationship-review-status pending">pending {pendingCount}</span>
        <span className="relationship-review-status dismissed">dismissed {dismissedCount}</span>
      </div>

      <div className="workbook-relationship-list" aria-label="Relationship candidates">
        {filteredCandidates.map((candidate) => (
          <div
            className={`workbook-relationship-card ${candidate.reviewStatus}`}
            key={candidate.relationshipId}
          >
            <div className="workbook-relationship-header">
              <button
                type="button"
                className="text-button relationship-detail-button"
                onClick={() => {
                  setSelectedCandidateId(candidate.relationshipId);
                  setReviewNotes(candidate.reviewNotes || "");
                }}
              >
                Details
              </button>
              <span className={`relationship-confidence ${candidate.confidenceLabel}`}>
                {candidate.confidenceLabel}
              </span>
              <small className={`relationship-review-status ${candidate.reviewStatus}`}>
                {candidate.reviewStatus}
              </small>
              <small>{relationshipTypeLabel(candidate.relationshipType)}</small>
            </div>
            <div className="workbook-relationship-path">
              <strong>
                {candidate.sourceWorksheetName}.{candidate.sourceColumn}
              </strong>
              <span aria-hidden="true">-&gt;</span>
              <strong>
                {candidate.targetWorksheetName}.{candidate.targetColumn}
              </strong>
            </div>
            <div className="workbook-relationship-tables">
              <span>{candidate.sourceTable}</span>
              <span>{candidate.targetTable}</span>
            </div>
            <div className="workbook-evidence-list">
              {candidate.evidence.summaries.map((summary) => (
                <span key={summary}>{summary}</span>
              ))}
            </div>
            {onRelationshipReview && (
              <div className="relationship-review-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => saveReview(candidate, "accepted")}
                  disabled={candidate.reviewStatus === "accepted"}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => saveReview(candidate, "dismissed")}
                  disabled={candidate.reviewStatus === "dismissed"}
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => saveReview(candidate, "pending")}
                  disabled={candidate.reviewStatus === "pending"}
                >
                  Pending
                </button>
              </div>
            )}
          </div>
        ))}
        {filteredCandidates.length === 0 && (
          <p className="workbook-empty-note">No relationship candidates match these filters.</p>
        )}
      </div>

      {selectedCandidate && (
        <div className="relationship-detail-panel" aria-label="Relationship candidate details">
          <div className="builder-block-header">
            <span>Candidate detail</span>
            <small>{selectedCandidate.confidenceLabel}</small>
          </div>
          <div className="workbook-summary-grid">
            <span>
              Overlap
              <strong>{Math.round(selectedCandidate.evidence.sampledOverlapRatio * 100)}%</strong>
            </span>
            <span>
              Type compatible
              <strong>{selectedCandidate.evidence.typeCompatible ? "Yes" : "No"}</strong>
            </span>
            <span>
              Source unique
              <strong>{Math.round(selectedCandidate.evidence.sourceUniqueRatio * 100)}%</strong>
            </span>
            <span>
              Target unique
              <strong>{Math.round(selectedCandidate.evidence.targetUniqueRatio * 100)}%</strong>
            </span>
            <span>
              Direction
              <strong>{selectedCandidate.direction.replace(/_/g, " ")}</strong>
            </span>
            <span>
              Reviewed
              <strong>{selectedCandidate.reviewedAt ? "Yes" : "No"}</strong>
            </span>
          </div>
          <div className="workbook-relationship-path">
            <strong>
              {selectedCandidate.sourceWorksheetName}.{selectedCandidate.sourceColumn}
            </strong>
            <span aria-hidden="true">-&gt;</span>
            <strong>
              {selectedCandidate.targetWorksheetName}.{selectedCandidate.targetColumn}
            </strong>
          </div>
          <div className="workbook-relationship-tables">
            <span>{selectedCandidate.sourceTable}</span>
            <span>{selectedCandidate.targetTable}</span>
          </div>
          <div className="workbook-evidence-list">
            {selectedCandidate.evidence.summaries.map((summary) => (
              <span key={summary}>{summary}</span>
            ))}
          </div>
          {onRelationshipReview && (
            <label className="relationship-notes-control">
              <span>Review notes</span>
              <textarea
                value={reviewNotes}
                onChange={(event) => setReviewNotes(event.target.value)}
                maxLength={500}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

function WorkbookContextPanel({
  dataset,
  variant = "results",
  onRelationshipReview,
  onWorksheetSelect,
  isSwitchingWorksheet,
}: WorkbookContextPanelProps) {
  const workbook = getWorkbookMetadata(dataset);
  const relationshipRegistry = useWorkbookRelationships(workbook);
  const [diagnostics, setDiagnostics] =
    useState<RelationshipContractDiagnosticsResponse | null>(null);
  const [selectedScopeWorksheetIds, setSelectedScopeWorksheetIds] = useState<string[]>([]);
  const [appliedScopeWorksheetIds, setAppliedScopeWorksheetIds] = useState<string[]>([]);
  const [isSqlSourceExpanded, setIsSqlSourceExpanded] = useState(false);

  useEffect(() => {
    if (!dataset || !workbook || workbook.acceptedRelationshipContracts.length === 0) {
      setDiagnostics(null);
      return;
    }

    let isCurrent = true;
    getWorkbookContractDiagnostics(dataset.dataset_id)
      .then((response) => {
        if (isCurrent) setDiagnostics(response);
      })
      .catch(() => {
        if (isCurrent) setDiagnostics(null);
      });

    return () => {
      isCurrent = false;
    };
  }, [dataset?.dataset_id, workbook?.updatedAt, workbook?.acceptedRelationshipContracts.length]);

  useEffect(() => {
    const availableWorksheetIds = new Set(
      (workbook?.worksheets || [])
        .filter((worksheet) => worksheet.status === "ready" || worksheet.status === "empty")
        .map((worksheet) => worksheet.worksheetId),
    );
    setSelectedScopeWorksheetIds((current) => {
      const next = current.filter((worksheetId) => availableWorksheetIds.has(worksheetId));
      return next.length === current.length ? current : next;
    });
    setAppliedScopeWorksheetIds((current) => {
      const next = current.filter((worksheetId) => availableWorksheetIds.has(worksheetId));
      return next.length === current.length ? current : next;
    });
  }, [workbook?.workbookId, workbook?.updatedAt]);

  if (!workbook) return null;

  const activeWorksheet = getActiveWorksheet(workbook);
  const scopeEligibleWorksheets = workbook.worksheets.filter(
    (worksheet) => worksheet.status === "ready" || worksheet.status === "empty",
  );
  const selectedScopeWorksheets = selectedScopeWorksheetIds
    .map((worksheetId) => scopeEligibleWorksheets.find((worksheet) => worksheet.worksheetId === worksheetId))
    .filter((worksheet): worksheet is WorksheetMetadata => Boolean(worksheet));
  const appliedScopeWorksheets = appliedScopeWorksheetIds
    .map((worksheetId) => scopeEligibleWorksheets.find((worksheet) => worksheet.worksheetId === worksheetId))
    .filter((worksheet): worksheet is WorksheetMetadata => Boolean(worksheet));
  const selectableScopeWorksheets = scopeEligibleWorksheets.filter(
    (worksheet) => !selectedScopeWorksheetIds.includes(worksheet.worksheetId),
  );
  const readyCount = countByStatus(workbook.worksheets, "ready");
  const skippedCount = countByStatus(workbook.worksheets, "skipped");
  const emptyCount = countByStatus(workbook.worksheets, "empty");
  const unsupportedCount = countByStatus(workbook.worksheets, "error");
  const activeIndex = activeWorksheet ? activeWorksheet.originalIndex + 1 : null;
  const activeSourceSummary = activeWorksheet
    ? `${activeWorksheet.displayName} - ${activeWorksheet.rowCount.toLocaleString()} rows - ${activeWorksheet.columnCount.toLocaleString()} columns`
    : "No active SQL source";

  const addScopeWorksheet = (worksheetId: string) => {
    setSelectedScopeWorksheetIds((current) =>
      current.includes(worksheetId) ? current : [...current, worksheetId],
    );
  };

  const removeScopeWorksheet = (worksheetId: string) => {
    setSelectedScopeWorksheetIds((current) => current.filter((id) => id !== worksheetId));
  };

  const applySelectedScope = () => {
    setAppliedScopeWorksheetIds(selectedScopeWorksheetIds);
  };

  return (
    <div className={`workbook-context-panel ${variant}`} aria-label="Workbook context">
      <div className="workbook-context-header">
        <div>
          <p className="section-label">Workbook</p>
          <h3 title={workbook.name}>{workbook.name}</h3>
        </div>
        <span className={`worksheet-status ${activeWorksheet?.status || "empty"}`}>
          {activeWorksheet ? statusLabel(activeWorksheet.status) : "empty"}
        </span>
      </div>

      <div className="workbook-summary-grid">
        <span>
          Active sheet
          <strong>{activeWorksheet?.displayName || "None"}</strong>
        </span>
        <span>
          Active table
          <strong>{dataset?.table_name || "data"}</strong>
        </span>
        <span>
          Source table
          <strong>{activeWorksheet?.tableName || "None"}</strong>
        </span>
        <span>
          Position
          <strong>
            {activeIndex ? `${activeIndex} of ${workbook.worksheets.length}` : "None"}
          </strong>
        </span>
        <span>
          Rows
          <strong>{(activeWorksheet?.rowCount || 0).toLocaleString()}</strong>
        </span>
        <span>
          Columns
          <strong>{(activeWorksheet?.columnCount || 0).toLocaleString()}</strong>
        </span>
      </div>

      <div className="workbook-status-grid" aria-label="Worksheet status summary">
        <span className="worksheet-status ready">ready {readyCount.toLocaleString()}</span>
        <span className="worksheet-status skipped">skipped {skippedCount.toLocaleString()}</span>
        <span className="worksheet-status empty">empty {emptyCount.toLocaleString()}</span>
        <span className="worksheet-status error">
          unsupported {unsupportedCount.toLocaleString()}
        </span>
      </div>

      {variant === "analyst" ? (
        <section className="workbook-analysis-scope" aria-label="Analysis workspace">
          <div className="builder-block-header">
            <span>Analysis workspace</span>
            <small>{selectedScopeWorksheets.length.toLocaleString()} selected</small>
          </div>
          <p className="workbook-analysis-scope-copy">
            Choose the tables or sheets that belong to this analysis. FiltraQueri will use this scope to prepare safer suggestions and reports.
          </p>
          <div className="workbook-analysis-scope-layout">
            <div className="workbook-analysis-scope-options" aria-label="Available analysis entities">
              {selectableScopeWorksheets.length > 0 ? (
                selectableScopeWorksheets.map((worksheet) => {
                  const columns = formatWorkbookColumnPreview(worksheet);
                  return (
                    <button
                      type="button"
                      key={worksheet.worksheetId}
                      className="workbook-analysis-scope-option"
                      onClick={() => addScopeWorksheet(worksheet.worksheetId)}
                    >
                      <strong>{worksheet.displayName}</strong>
                      <span>
                        {worksheet.rowCount.toLocaleString()} rows /{" "}
                        {worksheet.columnCount.toLocaleString()} columns
                      </span>
                      {columns.length > 0 && <small>{columns.join(", ")}</small>}
                    </button>
                  );
                })
              ) : (
                <p className="workbook-analysis-scope-empty">
                  All available tables and sheets are already selected for this analysis.
                </p>
              )}
            </div>
            <div className="workbook-analysis-scope-selected" aria-label="Selected analysis scope">
              {selectedScopeWorksheets.length === 0 ? (
                <p className="workbook-analysis-scope-empty">
                  No tables or sheets selected yet. Add multiple entities here for one analysis task.
                </p>
              ) : (
                selectedScopeWorksheets.map((worksheet) => {
                  const columns = formatWorkbookColumnPreview(worksheet);
                  return (
                    <article className="workbook-analysis-scope-chip" key={worksheet.worksheetId}>
                      <div>
                        <strong>{worksheet.displayName}</strong>
                        <span>
                          {worksheet.rowCount.toLocaleString()} rows /{" "}
                          {worksheet.columnCount.toLocaleString()} columns
                        </span>
                      </div>
                      {columns.length > 0 && <small>{columns.join(", ")}</small>}
                      <button
                        type="button"
                        onClick={() => removeScopeWorksheet(worksheet.worksheetId)}
                        aria-label={`Remove ${worksheet.displayName} from analysis scope`}
                      >
                        Remove
                      </button>
                    </article>
                  );
                })
              )}
            </div>
          </div>
          <div className="workbook-analysis-scope-actions">
            <button
              type="button"
              className="primary-button"
              onClick={applySelectedScope}
              disabled={selectedScopeWorksheets.length === 0}
            >
              Apply selected scope
            </button>
            <small>
              Metadata-only confirmation. This does not change the active SQL source or run a query.
            </small>
          </div>
          {appliedScopeWorksheets.length > 0 && (
            <p className="workbook-analysis-scope-confirmation">
              Analysis scope set:{" "}
              {appliedScopeWorksheets.map((worksheet) => worksheet.displayName).join(", ")}.
            </p>
          )}
        </section>
      ) : (
        <p className="workbook-analysis-scope-bridge">
          Need to analyze multiple tables? Use Analysis workspace in Analyst mode.
        </p>
      )}

      <div className={`workbook-mapping-section${variant === "analyst" ? " is-secondary-source" : ""}`}>
        <div className="builder-block-header">
          <span>{variant === "analyst" ? "Active SQL source" : "Worksheet tables"}</span>
          <small>{workbook.worksheets.length.toLocaleString()} sheets</small>
        </div>
        {variant === "analyst" && (
          <>
            <div className="workbook-active-source-summary">
              <span>{activeSourceSummary}</span>
              <button
                type="button"
                className="secondary-button workbook-mapping-make-active"
                onClick={() => setIsSqlSourceExpanded((expanded) => !expanded)}
                aria-expanded={isSqlSourceExpanded}
              >
                {isSqlSourceExpanded ? "Hide single-table source options" : "Change active SQL source"}
              </button>
            </div>
            <p className="workbook-mapping-helper">
              Use this only when you want one table to be the active SQL source for SQL editing and Run Query. This is separate from the multi-table Analysis workspace.
            </p>
          </>
        )}
        {(variant !== "analyst" || isSqlSourceExpanded) && (
        <div className="workbook-mapping-list" aria-label="Worksheet table mappings">
          {workbook.worksheets.map((worksheet) => {
            const isActive = worksheet.worksheetId === workbook.activeWorksheetId;
            const activeIsCleanedCopy =
              isActive &&
              workbook.activeAnalysisSource?.type === "cleaned_working_copy" &&
              workbook.activeAnalysisSource?.worksheetId === worksheet.worksheetId;
            const sourceStateLabel = activeIsCleanedCopy
              ? "cleaned working copy"
              : "original";
            const canMakeActive =
              Boolean(onWorksheetSelect) &&
              !isActive &&
              worksheet.status === "ready" &&
              !isSwitchingWorksheet;
            return (
              <div
                className={`workbook-mapping-row${isActive ? " active" : ""}`}
                key={worksheet.worksheetId}
              >
                <div className="workbook-mapping-row-meta">
                  <span title={worksheet.displayName}>{worksheet.displayName}</span>
                  <strong>
                    {isActive ? dataset?.table_name || "data" : worksheet.tableName}
                  </strong>
                  <small className="workbook-mapping-row-counts">
                    {worksheet.rowCount.toLocaleString()} rows
                    {" · "}
                    {worksheet.columnCount.toLocaleString()} cols
                  </small>
                </div>
                <div className="workbook-mapping-row-actions">
                  <small className={`worksheet-status ${worksheet.status}`}>
                    {statusLabel(worksheet.status)}
                  </small>
                  {isActive ? (
                    <span
                      className={`workbook-mapping-active-badge is-${
                        activeIsCleanedCopy ? "cleaned" : "original"
                      }`}
                      title={`Active analysis source · ${sourceStateLabel}. Report Recipes and generated SQL use this worksheet's schema.`}
                    >
                      Active · {sourceStateLabel}
                    </span>
                  ) : onWorksheetSelect ? (
                    <button
                      type="button"
                      className="secondary-button workbook-mapping-make-active"
                      onClick={() => onWorksheetSelect(worksheet.worksheetId)}
                      disabled={!canMakeActive}
                      title={
                        worksheet.status === "ready"
                          ? `Make ${worksheet.displayName} the active analysis source`
                          : `${worksheet.displayName} is not ready for analysis`
                      }
                    >
                      {isSwitchingWorksheet ? "Switching…" : "Make active"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {variant !== "analyst" && (
        <>
      <div className="workbook-mapping-section">
        <div className="builder-block-header">
          <span>Workbook profile</span>
          <small>{workbook.sourceFile.originalFilename}</small>
        </div>
        <WorkbookProfileList profile={workbook.ingestionProfile} />
      </div>

      <div className="workbook-mapping-section">
        <div className="builder-block-header">
          <span>Relationship candidates</span>
          <small>{workbook.relationshipCandidates.length.toLocaleString()} profiled</small>
        </div>
        <RelationshipCandidateList
          candidates={workbook.relationshipCandidates}
          worksheets={workbook.worksheets}
          onRelationshipReview={onRelationshipReview}
        />
      </div>

      <div className="workbook-mapping-section">
        <div className="builder-block-header">
          <span>Future join plan previews</span>
          <small>{relationshipRegistry?.joinPlanPreviews.length || 0} paths</small>
        </div>
        <JoinPlanPreviewList previews={relationshipRegistry?.joinPlanPreviews || []} />
      </div>

      <div className="workbook-mapping-section">
        <div className="builder-block-header">
          <span>Accepted relationships</span>
          <small>{workbook.acceptedRelationshipContracts.length.toLocaleString()} contracts</small>
        </div>
        <AcceptedRelationshipList
          contracts={workbook.acceptedRelationshipContracts}
        />
      </div>

      <div className="workbook-mapping-section">
        <div className="builder-block-header">
          <span>Contract diagnostics</span>
          <small>{diagnostics?.summary.total_contracts || 0} contracts</small>
        </div>
        <ContractDiagnosticsPanel
          diagnostics={diagnostics}
          worksheets={workbook.worksheets}
          contracts={workbook.acceptedRelationshipContracts}
        />
      </div>
        </>
      )}
    </div>
  );
}

export default WorkbookContextPanel;
