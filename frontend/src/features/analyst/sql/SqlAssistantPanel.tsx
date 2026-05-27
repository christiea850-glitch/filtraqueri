import { useMemo, useState, type KeyboardEvent } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlDialectId, SqlDialectProfile } from "../../sqlIntelligence";
import {
  createSqlAssistantTemplates,
  type SqlAssistantTemplate,
  type SqlTemplateCategory,
} from "./sqlTemplateLibrary";

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

const createSqlPreview = (sql: string) => {
  const lines = sql.trim().split("\n");
  return lines.length > 10 ? `${lines.slice(0, 10).join("\n")}\n...` : sql.trim();
};

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
        <em className={isFutureDialect || isDifferentDialect ? "is-dialect-note" : ""}>
          {template.dialectLabel}
        </em>
      </div>
      <pre>{createSqlPreview(template.sql)}</pre>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SqlTemplateCategory | "All">("All");
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

  return (
    <section className="sql-assistant-panel" aria-label="SQL Assistant template library">
      <div className="sql-assistant-intro">
        <div>
          <p className="section-label">SQL Assistant</p>
          <h3>Choose a template</h3>
          <p>Insert template, review in Monaco, then run manually.</p>
        </div>
        <span>{selectedDialectProfile.displayName}</span>
      </div>

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
    </section>
  );
}

export default SqlAssistantPanel;
