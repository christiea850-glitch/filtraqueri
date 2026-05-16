import { useMemo, useState } from "react";
import type { SchemaColumn, WorkspaceMode } from "../../features/dataset/datasetTypes";
import type { FilterState } from "../../features/filters/filterTypes";
import {
  createSchemaDisplayProfiles,
  getBusinessRoleLabel,
} from "../../features/dataIntelligence/structuralPresentation";
import type { InvestigationReport } from "../../features/investigationIntelligence";

type DynamicFiltersPanelProps = {
  schema: SchemaColumn[];
  filterValues: Record<string, FilterState>;
  applying: boolean;
  workspaceMode: WorkspaceMode;
  investigationReport?: InvestigationReport | null;
  errorMessage?: string;
  onFilterChange: (columnName: string, value: FilterState) => void;
  onApplyFilters: () => void;
  onResetFilters: () => void;
};

function DynamicFiltersPanel({
  schema,
  filterValues,
  applying,
  workspaceMode,
  investigationReport,
  errorMessage,
  onFilterChange,
  onApplyFilters,
  onResetFilters,
}: DynamicFiltersPanelProps) {
  const [columnSearch, setColumnSearch] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [isControlsCollapsed, setIsControlsCollapsed] = useState(false);
  const isAnalystMode = workspaceMode === "analyst";
  const displayColumnProfiles = useMemo(() => createSchemaDisplayProfiles(schema), [schema]);
  const investigationSuggestions = investigationReport?.suggestions.slice(0, 4) || [];
  const investigationNextSteps = investigationReport?.nextSteps.slice(0, 3) || [];

  const formatDateValue = (value: unknown) => {
    if (!value) return "";
    return String(value).slice(0, 10);
  };

  const hasActiveFilter = (value: FilterState = {}) =>
    Boolean(
      value.min ||
        value.max ||
        value.start ||
        value.end ||
        value.value ||
        (value.values && value.values.length > 0),
    );

  const activeFilterColumns = schema.filter((column) => hasActiveFilter(filterValues[column.name]));

  const normalizedSearch = columnSearch.trim().toLowerCase();
  const visibleSchema = useMemo(
    () =>
      normalizedSearch
        ? schema.filter(
            (column) =>
              column.name.toLowerCase().includes(normalizedSearch) ||
              (displayColumnProfiles
                .find((profile) => profile.sourceName === column.name)
                ?.displayName.toLowerCase()
                .includes(normalizedSearch) ??
                false) ||
              column.inferred_type.toLowerCase().includes(normalizedSearch),
          )
        : schema,
    [displayColumnProfiles, normalizedSearch, schema],
  );
  const suggestedQuestions = isAnalystMode
    ? [
        "Which columns define the safest filter scope?",
        "Which fields should be inspected before query construction?",
        "Which subset should be reviewed before building output?",
      ]
    : [
        "What would you like to understand?",
        "Which customers, products, or regions should we focus on?",
        "What changed after narrowing this view?",
      ];

  return (
    <section className="filters-panel" aria-label="Dynamic filters">
      <section className="explore-question-surface" aria-label="Guided exploration questions">
        <div>
          <p className="section-label">{isAnalystMode ? "Inspectable scope" : "Explore"}</p>
          <h2>{isAnalystMode ? "Choose a query scope" : "What would you like to understand?"}</h2>
          <p>
            {isAnalystMode
              ? "Use filters to prepare inspectable query context. Nothing runs from here."
              : "Start with a business question, then narrow the rows that matter."}
          </p>
        </div>
        <div className="explore-question-list" aria-label="Suggested questions">
          <span>Suggested questions</span>
          {(isAnalystMode || investigationSuggestions.length === 0
            ? suggestedQuestions.map((question) => ({ id: question, question }))
            : investigationSuggestions.map((suggestion) => ({
                id: suggestion.id,
                question: suggestion.question,
              }))
          ).map((question) => (
            <button
              type="button"
              key={question.id}
              onClick={() => setCustomQuestion(question.question)}
            >
              {question.question}
            </button>
          ))}
        </div>
        <label className="explore-custom-question">
          <span>Optional custom question</span>
          <input
            type="text"
            value={customQuestion}
            onChange={(event) => setCustomQuestion(event.target.value)}
            placeholder="Type a question to guide your filter choices"
          />
        </label>
      </section>

      {!isAnalystMode && investigationSuggestions.length > 0 && (
        <section className="investigation-guidance-panel" aria-label="Investigation guidance">
          <div>
            <p className="section-label">Investigation ideas</p>
            <h3>Good starting questions</h3>
            <p>{investigationReport?.humanSummary}</p>
          </div>
          <div className="investigation-card-row">
            {investigationSuggestions.slice(0, 3).map((suggestion) => (
              <article key={suggestion.id}>
                <span>{suggestion.title}</span>
                <strong>{suggestion.question}</strong>
                <small>{suggestion.confidence} confidence</small>
              </article>
            ))}
          </div>
          {investigationNextSteps.length > 0 && (
            <div className="investigation-prompt-row" aria-label="Possible next steps">
              <span>Possible next steps</span>
              {investigationNextSteps.map((suggestion) => (
                <small key={suggestion.id}>{suggestion.nextSteps[0]}</small>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="filters-header">
        <div>
          <p className="section-label">Filter scope</p>
          <h2>{isAnalystMode ? "Inspect filter context" : "Narrow the question"}</h2>
        </div>
        <div className="filter-actions">
          <button
            type="button"
            className="text-button"
            onClick={() => setIsControlsCollapsed((currentValue) => !currentValue)}
          >
            {isControlsCollapsed ? "Show controls" : "Hide controls"}
          </button>
          <button type="button" className="secondary-button" onClick={onResetFilters}>
            Reset
          </button>
          <button type="button" className="primary-button" onClick={onApplyFilters}>
            {applying ? "Applying..." : "Apply filters"}
          </button>
        </div>
      </div>

      {isControlsCollapsed ? (
        <button
          type="button"
          className="collapsed-panel-bar"
          onClick={() => setIsControlsCollapsed(false)}
        >
          Filters hidden | {activeFilterColumns.length} active | {visibleSchema.length} columns
        </button>
      ) : (
        <div className="filters-control-strip">
          <div className="active-filter-summary" aria-label="Active filter summary">
            <span>Filters</span>
            {activeFilterColumns.length > 0 ? (
              activeFilterColumns.map((column) => {
                const displayProfile =
                  displayColumnProfiles.find((profile) => profile.sourceName === column.name) || null;

                return (
                  <strong key={column.name} title={column.name}>
                    {displayProfile?.displayName || column.name}
                  </strong>
                );
              })
            ) : (
              <small>None yet</small>
            )}
          </div>

          <label className="filter-search">
            <span>Columns</span>
            <input
              type="search"
              value={columnSearch}
              onChange={(event) => setColumnSearch(event.target.value)}
              placeholder="Column name or type"
            />
          </label>
        </div>
      )}

      <div className="filters-grid-scroll">
        <div className="filters-grid">
          {visibleSchema.map((column) => {
            const currentFilter = filterValues[column.name] || {};
            const displayProfile =
              displayColumnProfiles.find((profile) => profile.sourceName === column.name) || null;
            const sampleValues = column.sample_values
              .filter((value) => value !== null && value !== undefined)
              .map((value) => String(value));

            return (
              <div className="filter-card" key={column.name}>
                <div className="filter-card-header">
                  <span title={column.name}>
                    {displayProfile?.displayName || column.name}
                    {displayProfile && displayProfile.displayName !== column.name && (
                      <em>{column.name}</em>
                    )}
                  </span>
                  <small>
                    {displayProfile?.role
                      ? getBusinessRoleLabel(displayProfile.role)
                      : column.inferred_type}
                  </small>
                </div>

                {column.inferred_type === "numeric" && (
                  <div className="range-inputs">
                    <input
                      type="number"
                      placeholder={column.min !== undefined ? String(column.min) : "Min"}
                      value={currentFilter.min || ""}
                      onChange={(event) =>
                        onFilterChange(column.name, { min: event.target.value })
                      }
                    />
                    <input
                      type="number"
                      placeholder={column.max !== undefined ? String(column.max) : "Max"}
                      value={currentFilter.max || ""}
                      onChange={(event) =>
                        onFilterChange(column.name, { max: event.target.value })
                      }
                    />
                  </div>
                )}

                {column.inferred_type === "date" && (
                  <div className="range-inputs">
                    <input
                      type="date"
                      min={formatDateValue(column.min)}
                      max={formatDateValue(column.max)}
                      value={currentFilter.start || ""}
                      onChange={(event) =>
                        onFilterChange(column.name, { start: event.target.value })
                      }
                    />
                    <input
                      type="date"
                      min={formatDateValue(column.min)}
                      max={formatDateValue(column.max)}
                      value={currentFilter.end || ""}
                      onChange={(event) =>
                        onFilterChange(column.name, { end: event.target.value })
                      }
                    />
                  </div>
                )}

                {column.inferred_type === "boolean" && (
                  <select
                    value={currentFilter.value || ""}
                    onChange={(event) =>
                      onFilterChange(column.name, { value: event.target.value })
                    }
                  >
                    <option value="">Any value</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                )}

                {(column.inferred_type === "categorical" || column.inferred_type === "text") && (
                  <select
                    multiple
                    value={currentFilter.values || []}
                    onChange={(event) =>
                      onFilterChange(column.name, {
                        values: Array.from(
                          event.target.selectedOptions,
                          (option) => option.value,
                        ),
                      })
                    }
                  >
                    {sampleValues.length === 0 && <option disabled>No sample values</option>}
                    {sampleValues.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                )}

                <p>
                  {column.unique_count.toLocaleString()} unique,{" "}
                  {column.null_count.toLocaleString()} empty
                </p>
              </div>
            );
          })}
        </div>

        {visibleSchema.length === 0 && (
          <div className="empty-state compact-empty">
            <p className="section-label">No columns</p>
            <h2>No matching columns</h2>
            <p>Try a name or type.</p>
          </div>
        )}
      </div>

      {applying && <p className="status-message">Applying filters...</p>}
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </section>
  );
}

export default DynamicFiltersPanel;
