import { useMemo, useState, type KeyboardEvent } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlDialectId, SqlDialectProfile } from "../../sqlIntelligence";
import {
  createSqlAssistantTemplates,
  type SqlAssistantTemplate,
  type SqlTemplateCategory,
} from "./sqlTemplateLibrary";
import { generateSqlTaskDraft, type SqlTaskGenerationResult } from "./sqlTaskGenerator";

type SqlAssistantPanelProps = {
  dataset: DatasetMetadata | null;
  selectedDialect: SqlDialectId;
  selectedDialectProfile: SqlDialectProfile;
  onInsertSql: (sql: string) => void;
};

const categoryOrder: SqlTemplateCategory[] = [
  "Preview and counts",
  "Filtering",
  "Aggregation",
  "Sorting and limits",
  "Date/time",
  "Data quality",
  "Joins",
  "Advanced SQL",
  "Dialect examples",
];

type SqlAssistantMode = "templates" | "assist";

function SqlTemplateCard({
  template,
  selectedDialect,
  onInsertSql,
}: {
  template: SqlAssistantTemplate;
  selectedDialect: SqlDialectId;
  onInsertSql: (sql: string) => void;
}) {
  const isFutureDialect = template.dialects?.includes("postgresql") || false;
  const isDifferentDialect =
    Boolean(template.dialects?.length) &&
    !template.dialects?.includes(selectedDialect) &&
    !isFutureDialect;

  return (
    <article className="sql-assistant-card">
      <div className="sql-assistant-card-head">
        <div>
          <strong>{template.title}</strong>
          <span>{template.explanation}</span>
        </div>
        <div className="sql-assistant-card-badges">
          <em>{template.category}</em>
          <em className={isFutureDialect || isDifferentDialect ? "is-dialect-note" : ""}>
            {template.dialectLabel}
          </em>
        </div>
      </div>
      <div className="sql-assistant-card-foot">
        {(isFutureDialect || isDifferentDialect) && (
          <small>
            {isFutureDialect
              ? "Future dialect example. Review syntax before running."
              : "Different dialect example. Review syntax before running."}
          </small>
        )}
        <button
          type="button"
          className="secondary-button"
          onClick={() => onInsertSql(template.sql)}
        >
          Insert into editor
        </button>
      </div>
    </article>
  );
}

function SqlAssistantPanel({
  dataset,
  selectedDialect,
  selectedDialectProfile,
  onInsertSql,
}: SqlAssistantPanelProps) {
  const [assistantMode, setAssistantMode] = useState<SqlAssistantMode>("templates");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SqlTemplateCategory | "All">("All");
  const [taskRequest, setTaskRequest] = useState("");
  const [generatedDraft, setGeneratedDraft] = useState<SqlTaskGenerationResult | null>(null);
  const templates = useMemo(
    () => createSqlAssistantTemplates(dataset, selectedDialect),
    [dataset, selectedDialect],
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredTemplates = templates.filter((template) => {
    const matchesCategory = activeCategory === "All" || template.category === activeCategory;
    const matchesSearch =
      !normalizedQuery ||
      [
        template.title,
        template.category,
        template.explanation,
        template.dialectLabel,
        template.sql,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);

    return matchesCategory && matchesSearch;
  });
  const groupedTemplates = categoryOrder
    .map((category) => ({
      category,
      templates: filteredTemplates.filter((template) => template.category === category),
    }))
    .filter((group) => group.templates.length > 0);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.preventDefault();
  };

  const generateDraft = () => {
    const nextDraft = generateSqlTaskDraft({
      dataset,
      selectedDialect,
      requestText: taskRequest,
    });
    setGeneratedDraft(nextDraft);
  };

  const handleTaskKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      generateDraft();
    }
  };

  return (
    <section className="sql-assistant-panel" aria-label="SQL Assistant">
      <div className="sql-assistant-intro">
        <div>
          <p className="section-label">SQL Assistant</p>
          <h3>{assistantMode === "templates" ? "Choose a template" : "Complex SQL Assist"}</h3>
          <p>
            {assistantMode === "templates"
              ? "Insert template, review in Monaco, then run manually."
              : "Describe the outcome, generate a SQL draft, review in Monaco, then run manually."}
          </p>
        </div>
        <span>{selectedDialectProfile.displayName}</span>
      </div>

      <div className="sql-assistant-mode-tabs" aria-label="SQL Assistant options">
        <button
          type="button"
          className={assistantMode === "templates" ? "is-active" : ""}
          aria-pressed={assistantMode === "templates"}
          onClick={() => setAssistantMode("templates")}
        >
          Template Library
        </button>
        <button
          type="button"
          className={assistantMode === "assist" ? "is-active" : ""}
          aria-pressed={assistantMode === "assist"}
          onClick={() => setAssistantMode("assist")}
        >
          Complex SQL Assist
        </button>
      </div>

      {assistantMode === "templates" ? (
        <>
          <div className="sql-assistant-controls">
            <label className="sql-assistant-search">
              <span>Search templates</span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Filter, join, CTE, window function..."
              />
            </label>
            <div className="sql-assistant-category-tabs" aria-label="Template categories">
              {(["All", ...categoryOrder] as Array<SqlTemplateCategory | "All">).map((category) => (
                <button
                  type="button"
                  key={category}
                  className={activeCategory === category ? "is-active" : ""}
                  aria-pressed={activeCategory === category}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="sql-assistant-results">
            {groupedTemplates.length === 0 ? (
              <p className="sql-helper-empty">No templates match this search.</p>
            ) : (
              groupedTemplates.map((group) => (
                <section className="sql-assistant-group" key={group.category}>
                  <div className="sql-helper-section-label">
                    <span>{group.category}</span>
                    <small>{group.templates.length.toLocaleString()}</small>
                  </div>
                  <div className="sql-assistant-grid">
                    {group.templates.map((template) => (
                      <SqlTemplateCard
                        key={template.id}
                        template={template}
                        selectedDialect={selectedDialect}
                        onInsertSql={onInsertSql}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </>
      ) : (
        <div className="sql-assistant-complex">
          <label className="sql-assistant-task-input">
            <span>Describe the task you want SQL to perform</span>
            <textarea
              value={taskRequest}
              onChange={(event) => {
                setTaskRequest(event.target.value);
                setGeneratedDraft(null);
              }}
              onKeyDown={handleTaskKeyDown}
              rows={4}
              placeholder={[
                "Top artists by total streams",
                "Artists with more than 5 songs and total streams above 1 billion",
                "Find duplicate tracks",
                "Show missing values",
                "Average streams by release year",
                "Rank tracks by streams",
                "Compare streams by artist",
                "Songs released after 2020",
              ].join("\n")}
            />
          </label>
          <div className="sql-assistant-complex-actions">
            <button
              type="button"
              className="primary-button"
              onClick={generateDraft}
              disabled={taskRequest.trim().length === 0}
            >
              Generate SQL
            </button>
            <small>Nothing runs here. Generated SQL inserts into Monaco for review.</small>
          </div>

          {generatedDraft && (
            <article className="sql-assistant-draft-summary" aria-label="Generated SQL summary">
              <div className="sql-helper-section-label">
                <span>Generated draft</span>
                <small>{selectedDialectProfile.displayName}</small>
              </div>
              <dl>
                <div>
                  <dt>Detected task</dt>
                  <dd>{generatedDraft.taskLabel}</dd>
                </div>
                <div>
                  <dt>Fields used</dt>
                  <dd>
                    {generatedDraft.fieldsUsed.length > 0
                      ? generatedDraft.fieldsUsed.join(", ")
                      : "No fields selected"}
                  </dd>
                </div>
                <div>
                  <dt>SQL logic used</dt>
                  <dd>{generatedDraft.logicUsed.join(", ")}</dd>
                </div>
                <div>
                  <dt>Uncertainty</dt>
                  <dd>
                    {generatedDraft.warnings.length > 0
                      ? generatedDraft.warnings.join(" ")
                      : "No major uncertainty detected. Review before running."}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="secondary-button"
                onClick={() => onInsertSql(generatedDraft.sql)}
              >
                Insert into Monaco
              </button>
            </article>
          )}
        </div>
      )}
    </section>
  );
}

export default SqlAssistantPanel;
