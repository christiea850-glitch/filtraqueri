import { useMemo, useState } from "react";
import type { DatasetMetadata, SchemaColumn } from "../../features/dataset/datasetTypes";
import {
  getActiveWorksheet,
  getWorkbookMetadata,
  type AcceptedRelationshipContract,
  type WorkbookIngestionProfile,
  type WorksheetRelationshipCandidate,
  type WorksheetMetadata,
  type WorksheetStatus,
} from "../../features/workbook";

type WorkbookContextPanelProps = {
  dataset: DatasetMetadata | null;
  variant?: "results" | "analyst";
  onRelationshipReview?: (
    candidateId: string,
    reviewStatus: "pending" | "accepted" | "dismissed",
    notes?: string,
  ) => void;
};

const statusLabel = (status: WorksheetStatus) => (status === "error" ? "unsupported" : status);

const countByStatus = (worksheets: WorksheetMetadata[], status: WorksheetStatus) =>
  worksheets.filter((worksheet) => worksheet.status === status).length;

const formatProfileValue = (value: number | string) =>
  typeof value === "number" ? value.toLocaleString() : value;

function SchemaColumnList({ columns }: { columns: SchemaColumn[] }) {
  if (columns.length === 0) {
    return <p className="workbook-empty-note">No schema available.</p>;
  }

  return (
    <div className="workbook-schema-list" aria-label="Active worksheet schema">
      {columns.map((column) => (
        <div className="workbook-schema-row" key={column.name} title={column.name}>
          <span className="workbook-column-name">{column.name}</span>
          <span className={`workbook-type-badge ${column.inferred_type}`}>
            {column.inferred_type}
          </span>
          <span className="workbook-null-note">
            {column.null_count > 0 ? `${column.null_count.toLocaleString()} nulls` : "no nulls"}
          </span>
        </div>
      ))}
    </div>
  );
}

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
}: WorkbookContextPanelProps) {
  const workbook = getWorkbookMetadata(dataset);
  if (!workbook) return null;

  const activeWorksheet = getActiveWorksheet(workbook);
  const readyCount = countByStatus(workbook.worksheets, "ready");
  const skippedCount = countByStatus(workbook.worksheets, "skipped");
  const emptyCount = countByStatus(workbook.worksheets, "empty");
  const unsupportedCount = countByStatus(workbook.worksheets, "error");
  const activeIndex = activeWorksheet ? activeWorksheet.originalIndex + 1 : null;

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

      <div className="workbook-mapping-section">
        <div className="builder-block-header">
          <span>Worksheet tables</span>
          <small>{workbook.worksheets.length.toLocaleString()} sheets</small>
        </div>
        <div className="workbook-mapping-list" aria-label="Worksheet table mappings">
          {workbook.worksheets.map((worksheet) => {
            const isActive = worksheet.worksheetId === workbook.activeWorksheetId;
            return (
              <div
                className={`workbook-mapping-row${isActive ? " active" : ""}`}
                key={worksheet.worksheetId}
              >
                <span title={worksheet.displayName}>{worksheet.displayName}</span>
                <strong>{isActive ? dataset?.table_name || "data" : worksheet.tableName}</strong>
                <small className={`worksheet-status ${worksheet.status}`}>
                  {statusLabel(worksheet.status)}
                </small>
              </div>
            );
          })}
        </div>
      </div>

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
          <span>Accepted relationships</span>
          <small>{workbook.acceptedRelationshipContracts.length.toLocaleString()} contracts</small>
        </div>
        <AcceptedRelationshipList contracts={workbook.acceptedRelationshipContracts} />
      </div>

      {variant === "analyst" && (
        <div className="workbook-mapping-section">
          <div className="builder-block-header">
            <span>Active schema</span>
            <small>{activeWorksheet?.schema.length || 0}</small>
          </div>
          <SchemaColumnList columns={activeWorksheet?.schema || dataset?.schema || []} />
        </div>
      )}
    </div>
  );
}

export default WorkbookContextPanel;
