import { useMemo, useState } from "react";
import type { SchemaColumn, WorkspaceMode } from "../../features/dataset/datasetTypes";
import type { AggregationState } from "../../features/query-builder/queryBuilderTypes";
import type { SortDirection } from "../../features/results/resultTypes";
import {
  createSchemaDisplayProfiles,
  getDisplayColumnName,
} from "../../features/dataIntelligence/structuralPresentation";
import type { AnalysisPackagePlan } from "../../features/analysisPackages";
import type { InvestigationReport } from "../../features/investigationIntelligence";
import type { InvestigationWorkspacePlan } from "../../features/investigationWorkspace";

type VisualQueryBuilderPanelProps = {
  schema: SchemaColumn[];
  datasetName: string;
  worksheetName: string;
  activeFilterCount: number;
  workspaceMode: WorkspaceMode;
  investigationReport?: InvestigationReport | null;
  analysisPackagePlan?: AnalysisPackagePlan | null;
  investigationWorkspacePlan?: InvestigationWorkspacePlan | null;
  selectedColumns: string[];
  groupBy: string[];
  aggregations: AggregationState[];
  sortOptions: string[];
  sortColumn: string;
  sortDirection: SortDirection;
  rowLimit: string;
  running: boolean;
  errorMessage?: string;
  onToggleSelectedColumn: (column: string) => void;
  onSelectedColumnsChange: (columns: string[]) => void;
  onGroupByChange: (columns: string[]) => void;
  onAddAggregation: () => void;
  onUpdateAggregation: (id: number, value: Partial<AggregationState>) => void;
  onRemoveAggregation: (id: number) => void;
  onSortColumnChange: (column: string) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
  onRowLimitChange: (limit: string) => void;
  onRunQuery: () => void;
};

type BuilderStep = "data" | "question" | "filters" | "group" | "review" | "execute";

const builderSteps: Array<{
  id: BuilderStep;
  label: string;
  helper: string;
}> = [
  { id: "data", label: "Fields", helper: "Select output" },
  { id: "question", label: "Measure", helper: "Choose intent" },
  { id: "filters", label: "Filter", helper: "Review scope" },
  { id: "group", label: "Group by", helper: "Compare" },
  { id: "review", label: "Sort / limit", helper: "Shape output" },
  { id: "execute", label: "Review & run", helper: "Approve" },
];

function VisualQueryBuilderPanel({
  schema,
  activeFilterCount,
  workspaceMode,
  investigationReport,
  analysisPackagePlan,
  investigationWorkspacePlan,
  selectedColumns,
  groupBy,
  aggregations,
  sortOptions,
  sortColumn,
  sortDirection,
  rowLimit,
  running,
  errorMessage,
  onToggleSelectedColumn,
  onSelectedColumnsChange,
  onGroupByChange,
  onAddAggregation,
  onUpdateAggregation,
  onRemoveAggregation,
  onSortColumnChange,
  onSortDirectionChange,
  onRowLimitChange,
  onRunQuery,
}: VisualQueryBuilderPanelProps) {
  const [activeStep, setActiveStep] = useState<BuilderStep>("data");
  const [columnSearch, setColumnSearch] = useState("");
  const normalizedSearch = columnSearch.trim().toLowerCase();
  const displayColumnProfiles = useMemo(() => createSchemaDisplayProfiles(schema), [schema]);
  const investigationSuggestions = investigationReport?.suggestions.slice(0, 4) || [];
  const primaryInvestigation = investigationSuggestions[0] || null;
  const packageRecommendations = analysisPackagePlan?.recommendations.slice(0, 3) || [];
  const workspaceRecommendations = investigationWorkspacePlan?.recommendations.slice(0, 2) || [];
  const visibleSchema = useMemo(
    () =>
      normalizedSearch
        ? schema.filter(
            (column) =>
              column.name.toLowerCase().includes(normalizedSearch) ||
              getDisplayColumnName(displayColumnProfiles, column.name)
                .toLowerCase()
                .includes(normalizedSearch) ||
              column.inferred_type.toLowerCase().includes(normalizedSearch),
          )
        : schema,
    [displayColumnProfiles, normalizedSearch, schema],
  );
  const numericColumns = schema
    .filter((column) => column.inferred_type === "numeric")
    .map((column) => column.name);
  const categoricalColumns = schema
    .filter((column) => column.inferred_type === "categorical" || column.inferred_type === "text")
    .map((column) => column.name);
  const recommendedColumns = useMemo(() => {
    const meaningfulMix = [
      ...schema.filter((column) => column.inferred_type === "date").slice(0, 2),
      ...schema.filter((column) => column.inferred_type === "categorical").slice(0, 3),
      ...schema.filter((column) => column.inferred_type === "numeric").slice(0, 3),
      ...schema.filter((column) => column.inferred_type === "text").slice(0, 2),
    ].map((column) => column.name);

    return Array.from(
      new Set(meaningfulMix.length > 0 ? meaningfulMix : schema.map((column) => column.name)),
    ).slice(0, 8);
  }, [schema]);
  const activeAggregations = aggregations.filter(
    (aggregation) => aggregation.function === "COUNT" || aggregation.column,
  );
  const isAnalystMode = workspaceMode === "analyst";
  const expectedResultType =
    groupBy.length > 0 || activeAggregations.length > 0
      ? "Grouped summary"
      : selectedColumns.length > 0
        ? "Selected-field result"
        : "Dataset preview";
  const progressItems = isAnalystMode
    ? [
        {
          label: "Data selected",
          complete: selectedColumns.length > 0,
          detail: `${selectedColumns.length} fields`,
        },
        {
          label: "Filters added",
          complete: activeFilterCount > 0,
          detail: `${activeFilterCount} filters`,
        },
        {
          label: "Grouping active",
          complete: groupBy.length > 0 || activeAggregations.length > 0,
          detail: `${groupBy.length} groups / ${activeAggregations.length} summaries`,
        },
        {
          label: "Preview ready",
          complete: selectedColumns.length > 0 || groupBy.length > 0 || activeAggregations.length > 0,
          detail: expectedResultType,
        },
        {
          label: "Ready to run",
          complete: Boolean(rowLimit) || selectedColumns.length > 0 || activeAggregations.length > 0,
          detail: rowLimit ? `${rowLimit} row limit` : "Review first",
        },
      ]
    : [
        {
          label: "Data selected",
          complete: selectedColumns.length > 0,
          detail: `${selectedColumns.length} fields`,
        },
        {
          label: "Filters added",
          complete: activeFilterCount > 0,
          detail: `${activeFilterCount} filters`,
        },
        {
          label: "Review ready",
          complete: selectedColumns.length > 0 || groupBy.length > 0 || activeAggregations.length > 0,
          detail: expectedResultType,
        },
      ];
  const approvalSummary = isAnalystMode
    ? [
        { label: "Data source", value: "Current workspace" },
        {
          label: "Fields selected",
          value: selectedColumns.length > 0 ? selectedColumns.length.toLocaleString() : "Grouped result",
        },
        { label: "Filters active", value: activeFilterCount.toLocaleString() },
        {
          label: "Grouping active",
          value:
            groupBy.length > 0 || activeAggregations.length > 0
              ? `${groupBy.length.toLocaleString()} groups / ${activeAggregations.length.toLocaleString()} measures`
              : "None",
        },
        { label: "Row limit", value: rowLimit || "No limit" },
      ]
    : [
        {
          label: "Fields selected",
          value: selectedColumns.length > 0 ? selectedColumns.length.toLocaleString() : "Grouped result",
        },
        { label: "Filters active", value: activeFilterCount.toLocaleString() },
        { label: "Row limit", value: rowLimit || "No limit" },
      ];

  return (
    <section className="query-builder-panel" aria-label="Visual query builder">
      <div className="query-builder-workflow-strip" aria-label="Query workflow status">
        <div>
          <span>{isAnalystMode ? "Prepared result" : "Expected result"}</span>
          <strong>{expectedResultType}</strong>
        </div>
        <div className="query-progress-rail" aria-label="Query workflow progress">
          {progressItems.map((item) => (
            <span key={item.label} className={item.complete ? "is-complete" : ""}>
              <strong>{item.label}</strong>
              <small>{item.detail}</small>
            </span>
          ))}
        </div>
      </div>

      <div className="query-builder-header">
        <div>
          <p className="section-label">Build</p>
          <h2>{builderSteps.find((step) => step.id === activeStep)?.label || "Build query"}</h2>
        </div>
      </div>

      {!isAnalystMode && primaryInvestigation && (
        <section className="investigation-guidance-panel compact" aria-label="Build investigation guidance">
          <div>
            <p className="section-label">Investigation goal</p>
            <h3>{primaryInvestigation.title}</h3>
            <p>{primaryInvestigation.question}</p>
          </div>
          <div className="investigation-prompt-row" aria-label="Recommended comparisons">
            <span>Compare by</span>
            {primaryInvestigation.compareBy.slice(0, 3).map((item) => (
              <small key={item}>{item}</small>
            ))}
          </div>
          <div className="investigation-prompt-row" aria-label="Possible next steps">
            <span>Next steps</span>
            {primaryInvestigation.nextSteps.slice(0, 3).map((item) => (
              <small key={item}>{item}</small>
            ))}
          </div>
        </section>
      )}

      {!isAnalystMode && analysisPackagePlan && (
        <section className="analysis-package-panel compact" aria-label="Analysis package planning">
          <div>
            <p className="section-label">Analysis package</p>
            <h3>{analysisPackagePlan.readinessSummary.label}</h3>
            <p>{analysisPackagePlan.humanSummary}</p>
          </div>
          <div className="analysis-package-artifacts" aria-label="Recommended package contents">
            {packageRecommendations.map((recommendation) => (
              <span key={recommendation.recommendationId}>
                {recommendation.label}
                <strong>{recommendation.readiness.replace(/_/g, " ")}</strong>
              </span>
            ))}
          </div>
        </section>
      )}

      {!isAnalystMode && investigationWorkspacePlan && (
        <section className="workspace-hub-panel compact" aria-label="Investigation workspace summary">
          <div>
            <p className="section-label">Investigation workspace</p>
            <h3>{investigationWorkspacePlan.readinessSummary.label}</h3>
            <p>{investigationWorkspacePlan.humanSummary}</p>
          </div>
          <div className="workspace-hub-metrics" aria-label="Workspace session readiness">
            <span>
              Packages
              <strong>{investigationWorkspacePlan.readinessSummary.packageCount.toLocaleString()}</strong>
            </span>
            <span>
              Stages
              <strong>{investigationWorkspacePlan.readinessSummary.stageCount.toLocaleString()}</strong>
            </span>
            <span>
              Deliverables
              <strong>{investigationWorkspacePlan.readinessSummary.deliverableCount.toLocaleString()}</strong>
            </span>
          </div>
          {workspaceRecommendations.length > 0 && (
            <div className="workspace-hub-prompts" aria-label="Workspace recommendations">
              {workspaceRecommendations.map((recommendation) => (
                <small key={recommendation.recommendationId}>{recommendation.label}</small>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="query-approval-strip" aria-label="Review before running query">
        <div>
          <span>Review before run</span>
          <strong>Nothing runs until you approve.</strong>
        </div>
        <div className="query-approval-facts">
          {approvalSummary.map((item) => (
            <span key={item.label}>
              {item.label}
              <strong>{item.value}</strong>
            </span>
          ))}
        </div>
        <button type="button" className="primary-button" onClick={onRunQuery}>
          {running ? "Running..." : "Run query"}
        </button>
      </section>

      <div className="query-workflow-tabs" aria-label="Query builder workflow">
        {builderSteps.map((step, index) => (
          <button
            type="button"
            key={step.id}
            className={activeStep === step.id ? "is-active" : ""}
            onClick={() => setActiveStep(step.id)}
          >
            <span>Step {index + 1}</span>
            <strong>{step.label}</strong>
            <small>{step.helper}</small>
          </button>
        ))}
      </div>

      {activeStep === "data" && (
        <div className="query-stage-panel">
          <div className="query-stage-heading">
            <div>
              <h3>{isAnalystMode ? "Prepare result projection" : "Select data"}</h3>
              <p>
                {isAnalystMode
                  ? "Choose the fields that should be present in the result context."
                  : "Choose the fields that belong in this question."}
              </p>
            </div>
            <small>
              {selectedColumns.length} selected, {schema.length} available
            </small>
          </div>

          <div className="query-column-controls">
            <label className="query-column-search">
              <span>Search columns</span>
              <input
                type="search"
                value={columnSearch}
                onChange={(event) => setColumnSearch(event.target.value)}
                placeholder="Column name or type"
              />
            </label>

            <details className="query-advanced-disclosure">
              <summary>
                <span>Selection shortcuts</span>
                <small>Optional helpers</small>
              </summary>
              <div className="query-bulk-actions" aria-label="Visible column suggestions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onSelectedColumnsChange(schema.map((column) => column.name))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onSelectedColumnsChange([])}
                >
                  Clear All
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onSelectedColumnsChange(numericColumns)}
                >
                  Numeric Only
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onSelectedColumnsChange(categoricalColumns)}
                >
                  Categorical Only
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => onSelectedColumnsChange(recommendedColumns)}
                >
                  Recommended
                </button>
              </div>
            </details>
          </div>

          <div className="field-chip-scroll">
            <div className="field-chip-grid">
              {visibleSchema.map((column) => (
                <label className="field-chip" key={column.name} title={column.name}>
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(column.name)}
                    onChange={() => onToggleSelectedColumn(column.name)}
                  />
                  <span>
                    {getDisplayColumnName(displayColumnProfiles, column.name)}
                    {getDisplayColumnName(displayColumnProfiles, column.name) !== column.name && (
                      <small>{column.name}</small>
                    )}
                  </span>
                </label>
              ))}
            </div>

            {visibleSchema.length === 0 && (
              <p className="query-column-empty">No columns match your search.</p>
            )}
          </div>
        </div>
      )}

      {activeStep === "question" && (
        <div className="query-stage-panel">
          <div className="query-stage-heading">
            <div>
              <h3>{isAnalystMode ? "Review query structure" : "Define question"}</h3>
              <p>
                {isAnalystMode
                  ? "Confirm the projection and summary shape before adding execution detail."
                  : "Frame what you want to learn before running a result."}
              </p>
            </div>
            <small>{expectedResultType}</small>
          </div>

          <div className="query-guidance-grid">
            {!isAnalystMode &&
              investigationSuggestions.slice(0, 2).map((suggestion) => (
                <article key={suggestion.id}>
                  <span>Good question</span>
                  <strong>{suggestion.title}</strong>
                  <p>{suggestion.question}</p>
                </article>
              ))}
            <article>
              <span>{isAnalystMode ? "Projection" : "Business question"}</span>
              <strong>{selectedColumns.length > 0 ? "Fields selected" : "Choose fields"}</strong>
              <p>
                {isAnalystMode
                  ? "The selected fields define the result projection."
                  : "Start with the columns that help answer the business question."}
              </p>
            </article>
            <article>
              <span>{isAnalystMode ? "Grouping logic" : "Compare categories"}</span>
              <strong>{groupBy.length > 0 ? "Comparison active" : "Optional"}</strong>
              <p>
                {isAnalystMode
                  ? "Grouping and aggregations define summary logic."
                  : "Use grouping when the question compares teams, categories, dates, or segments."}
              </p>
            </article>
          </div>
        </div>
      )}

      {activeStep === "filters" && (
        <div className="query-stage-panel">
          <div className="query-stage-heading">
            <div>
              <h3>{isAnalystMode ? "Inspect filter scope" : "Filter your business question"}</h3>
              <p>
                {activeFilterCount > 0
                  ? `${activeFilterCount.toLocaleString()} filters are already shaping this workspace.`
                  : "No filters are active. Use the Filters workspace when the question needs a narrower scope."}
              </p>
            </div>
            <small>Review only</small>
          </div>

          <div className="query-guidance-grid">
            <article>
              <span>Current scope</span>
              <strong>{activeFilterCount.toLocaleString()} filters</strong>
              <p>Filters are reviewed here only; this panel does not apply or mutate filters.</p>
            </article>
            <article>
              <span>{isAnalystMode ? "Execution context" : "Question scope"}</span>
              <strong>{activeFilterCount > 0 ? "Scoped" : "Full dataset"}</strong>
              <p>
                {isAnalystMode
                  ? "Existing filters remain part of the result context when present."
                  : "Add filters when you want to focus on a subset before comparing results."}
              </p>
            </article>
          </div>
        </div>
      )}

      {activeStep === "group" && (
        <div className="query-stage-panel">
          <div className="query-stage-heading">
            <div>
              <h3>{isAnalystMode ? "Inspect grouping logic" : "Group by"}</h3>
              <p>
                {isAnalystMode
                  ? "Configure summary logic for the result context."
                  : "Compare categories, segments, dates, or groups."}
              </p>
            </div>
            <button type="button" className="text-button" onClick={onAddAggregation}>
              Add aggregation
            </button>
          </div>

          <div className="query-stage-grid">
            <div className="builder-block flat-builder-block">
              <div className="builder-block-header">
                <span>Group by</span>
                <small>{groupBy.length} grouped</small>
              </div>
              <select
                multiple
                value={groupBy}
                onChange={(event) =>
                  onGroupByChange(
                    Array.from(event.target.selectedOptions, (option) => option.value),
                  )
                }
              >
                {schema.map((column) => (
                  <option key={column.name} value={column.name} title={column.name}>
                    {getDisplayColumnName(displayColumnProfiles, column.name)}
                  </option>
                ))}
              </select>
            </div>

            <div className="builder-block flat-builder-block">
              <div className="builder-block-header">
                <span>Aggregations</span>
                <small>{aggregations.length} configured</small>
              </div>
              <div className="aggregation-list">
                {aggregations.map((aggregation) => (
                  <div className="aggregation-row" key={aggregation.id}>
                    <select
                      value={aggregation.function}
                      onChange={(event) =>
                        onUpdateAggregation(aggregation.id, {
                          function: event.target.value as AggregationState["function"],
                          column:
                            event.target.value === "COUNT" && !aggregation.column
                              ? ""
                              : aggregation.column,
                        })
                      }
                    >
                      <option value="COUNT">COUNT</option>
                      <option value="SUM">SUM</option>
                      <option value="AVG">AVG</option>
                      <option value="MIN">MIN</option>
                      <option value="MAX">MAX</option>
                    </select>
                    <select
                      value={aggregation.column}
                      onChange={(event) =>
                        onUpdateAggregation(aggregation.id, { column: event.target.value })
                      }
                    >
                      {aggregation.function === "COUNT" && <option value="">All rows</option>}
                      {schema
                        .filter(
                          (column) =>
                            aggregation.function === "COUNT" || column.inferred_type === "numeric",
                        )
                        .map((column) => (
                          <option key={column.name} value={column.name} title={column.name}>
                            {getDisplayColumnName(displayColumnProfiles, column.name)}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => onRemoveAggregation(aggregation.id)}
                      aria-label="Remove aggregation"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeStep === "review" && (
        <div className="query-stage-panel compact-query-stage">
          <div className="query-stage-heading">
            <div>
              <h3>{isAnalystMode ? "Prepare result projection" : "Sort / limit"}</h3>
              <p>Review output order and size before running.</p>
            </div>
          </div>

          <div className="query-stage-grid">
            <div className="builder-block flat-builder-block">
              <div className="builder-block-header">
                <span>Sort</span>
                <small>{sortDirection}</small>
              </div>
              <div className="sort-controls">
                <select
                  value={sortColumn}
                  onChange={(event) => onSortColumnChange(event.target.value)}
                >
                  <option value="">No sorting</option>
                  {Array.from(new Set(sortOptions)).map((column) => (
                    <option key={column} value={column} title={column}>
                      {getDisplayColumnName(displayColumnProfiles, column)}
                    </option>
                  ))}
                </select>
                <select
                  value={sortDirection}
                  onChange={(event) => onSortDirectionChange(event.target.value as SortDirection)}
                >
                  <option value="ASC">ASC</option>
                  <option value="DESC">DESC</option>
                </select>
              </div>
            </div>

            <div className="builder-block flat-builder-block">
              <div className="builder-block-header">
                <span>Row limit</span>
                <small>Max 1000</small>
              </div>
              <input
                type="number"
                min="1"
                max="1000"
                value={rowLimit}
                onChange={(event) => onRowLimitChange(event.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {activeStep === "execute" && (
        <div className="query-stage-panel preview-query-stage">
          <div className="query-stage-heading">
            <div>
              <h3>{isAnalystMode ? "Execution review" : "Review output"}</h3>
              <p>
                {isAnalystMode
                  ? "Confirm structure, then run through the existing Query Builder path."
                  : "Review the shape, then run when the question feels ready."}
              </p>
            </div>
            <button type="button" className="primary-button" onClick={onRunQuery}>
              {running ? "Running..." : "Run query"}
            </button>
          </div>

          <div className="query-review-grid">
            <div>
              <span>Columns</span>
              <strong>{selectedColumns.length || "Grouped result"}</strong>
              <p title={selectedColumns.join(", ")}>
                {selectedColumns
                  .slice(0, 6)
                  .map((column) => getDisplayColumnName(displayColumnProfiles, column))
                  .join(", ") ||
                  "Uses grouped fields when summaries are active."}
              </p>
            </div>
            <div>
              <span>Grouping</span>
              <strong>{groupBy.length || "None"}</strong>
              <p title={groupBy.join(", ")}>
                {groupBy.map((column) => getDisplayColumnName(displayColumnProfiles, column)).join(", ") || "None"}
              </p>
            </div>
            <div>
              <span>Aggregations</span>
              <strong>{activeAggregations.length || "None"}</strong>
              <p>
                {activeAggregations
                  .map(
                    (aggregation) =>
                      `${aggregation.function} ${
                        aggregation.column
                          ? getDisplayColumnName(displayColumnProfiles, aggregation.column)
                          : "rows"
                      }`,
                  )
                  .join(", ") || "None"}
              </p>
            </div>
            <div>
              <span>Sort and limit</span>
              <strong>{rowLimit || "No limit"}</strong>
              <p title={sortColumn ? `${sortColumn} ${sortDirection}` : "No sorting selected."}>
                {sortColumn ? `${sortColumn} ${sortDirection}` : "No sorting selected."}
              </p>
            </div>
          </div>

          <details className="query-technical-disclosure">
            <summary>
              <span>{isAnalystMode ? "Technical query details" : "Query details"}</span>
              <small>Read-only review</small>
            </summary>
            <div>
              <span>
                Data source
                <strong>Current workspace</strong>
              </span>
              <span>
                Selected fields
                <strong>{selectedColumns.length.toLocaleString()}</strong>
              </span>
              <span>
                Filters
                <strong>{activeFilterCount.toLocaleString()}</strong>
              </span>
              <span>
                Result type
                <strong>{expectedResultType}</strong>
              </span>
            </div>
          </details>
        </div>
      )}

      {running && <p className="status-message">Running query...</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </section>
  );
}

export default VisualQueryBuilderPanel;
