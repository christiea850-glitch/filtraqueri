import { useMemo, useState, type KeyboardEvent } from "react";
import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { SqlDialectId, SqlDialectProfile } from "../../sqlIntelligence";
import {
  createSqlAssistantGenerationContext,
  createSqlAssistantTemplates,
  type SqlAssistantTemplate,
  type SqlTemplateCategory,
} from "./sqlTemplateLibrary";
import {
  createSqlReportRecipes,
  type SqlReportRecipe,
} from "./sqlReportRecipes";
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

type SqlAssistantMode = "templates" | "assist" | "recipes";

const modeCopy: Record<SqlAssistantMode, { title: string; description: string }> = {
  templates: {
    title: "Choose a template",
    description: "Templates insert into Monaco for review. Run query remains manual.",
  },
  assist: {
    title: "Complex SQL Assist",
    description: "Describe the outcome, generate SQL into Monaco, then run manually.",
  },
  recipes: {
    title: "Report Recipes",
    description: "Choose a report pattern, insert the SQL draft into Monaco, then run manually.",
  },
};

const labelFromColumn = (columnName: string) =>
  columnName
    .replace(/[_%()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildAssistPlaceholder = (
  dataset: DatasetMetadata | null,
  selectedDialect: SqlDialectId,
) => {
  const context = createSqlAssistantGenerationContext({ dataset, selectedDialect });
  const category = context.categoricalColumns[0]?.name;
  const metric = context.numericColumns[0]?.name;
  const date = context.dateColumns[0]?.name;

  if (!category && !metric && !date) {
    return [
      "Top items by total value",
      "Items with more than 5 records and total value above 1000",
      "Find duplicates",
      "Show missing values",
      "Average value by date",
      "Rank items by value",
      "Records after 2020",
    ].join("\n");
  }

  const categoryLabel = labelFromColumn(category || "items");
  const metricLabel = labelFromColumn(metric || "value");
  const dateLabel = labelFromColumn(date || "date");

  return [
    `Top ${categoryLabel} by total ${metricLabel}`,
    `${categoryLabel} with more than 5 records and total ${metricLabel} above 1000`,
    `Find duplicate ${categoryLabel}`,
    "Show missing values",
    `Average ${metricLabel} by ${dateLabel}`,
    `Rank ${categoryLabel} by ${metricLabel}`,
    `Records after 2020 in ${dateLabel}`,
  ].join("\n");
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
  const isDifferentDialect =
    Boolean(template.dialects?.length) &&
    !template.dialects?.includes(selectedDialect);

  return (
    <article className="sql-assistant-card">
      <div className="sql-assistant-card-head">
        <div>
          <strong>{template.title}</strong>
          <span>{template.explanation}</span>
        </div>
        <div className="sql-assistant-card-badges">
          <em>{template.category}</em>
          <em className={isDifferentDialect ? "is-dialect-note" : ""}>
            {template.dialectLabel}
          </em>
        </div>
      </div>
      <div className="sql-assistant-card-foot">
        {isDifferentDialect && <small>Different dialect example. Review syntax before running.</small>}
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

function SqlReportRecipeCard({
  recipe,
  selectedDialectProfile,
  onInsertSql,
}: {
  recipe: SqlReportRecipe;
  selectedDialectProfile: SqlDialectProfile;
  onInsertSql: (sql: string) => void;
}) {
  return (
    <article className="sql-assistant-generated-card sql-assistant-recipe-card">
      <div className="sql-assistant-generated-head">
        <div>
          <strong>{recipe.title}</strong>
          <span>{recipe.businessPurpose}</span>
        </div>
        <em>{selectedDialectProfile.displayName}</em>
      </div>
      <dl>
        <div>
          <dt>Required roles</dt>
          <dd>{recipe.requiredFieldRoles.join(", ")}</dd>
        </div>
        <div>
          <dt>SQL patterns used</dt>
          <dd className="sql-assistant-logic-list">
            {recipe.sqlPatterns.map((pattern) => (
              <span key={pattern}>{pattern}</span>
            ))}
          </dd>
        </div>
        <div>
          <dt>Dialect note</dt>
          <dd>{recipe.dialectSupportNote}</dd>
        </div>
        <div>
          <dt>Current support</dt>
          <dd>{recipe.supportSummary}</dd>
        </div>
        <div>
          <dt>Insert readiness</dt>
          <dd>
            {recipe.sql
              ? "Safe to insert into Monaco for manual review."
              : `Blocked: ${recipe.missingRequirements.join(", ")}.`}
          </dd>
        </div>
      </dl>
      {recipe.warnings.length > 0 && (
        <p className="sql-assistant-recipe-warning">{recipe.warnings.join(" ")}</p>
      )}
      <button
        type="button"
        className="secondary-button"
        onClick={() => recipe.sql && onInsertSql(recipe.sql)}
        disabled={!recipe.sql}
      >
        {recipe.sql ? "Insert into Monaco" : "Needs more structure"}
      </button>
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
  const [generatedDrafts, setGeneratedDrafts] = useState<SqlTaskGenerationResult[]>([]);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const templates = useMemo(
    () => createSqlAssistantTemplates(dataset, selectedDialect),
    [dataset, selectedDialect],
  );
  const recipes = useMemo(
    () => createSqlReportRecipes(dataset, selectedDialect),
    [dataset, selectedDialect],
  );
  const assistPlaceholder = useMemo(
    () => buildAssistPlaceholder(dataset, selectedDialect),
    [dataset, selectedDialect],
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const normalizedRecipeQuery = recipeSearchQuery.trim().toLowerCase();
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
  const filteredRecipes = recipes.filter((recipe) => {
    if (!normalizedRecipeQuery) return true;

    return [
      recipe.title,
      recipe.businessPurpose,
      recipe.requiredFieldRoles.join(" "),
      recipe.sqlPatterns.join(" "),
      recipe.dialectSupportNote,
      recipe.supportSummary,
      recipe.warnings.join(" "),
      recipe.missingRequirements.join(" "),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedRecipeQuery);
  });

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.preventDefault();
  };

  const generateDraft = () => {
    const nextDraft = generateSqlTaskDraft({
      dataset,
      selectedDialect,
      requestText: taskRequest,
    });
    setGeneratedDrafts([nextDraft]);
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
          <h3>{modeCopy[assistantMode].title}</h3>
          <p>{modeCopy[assistantMode].description}</p>
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
        <button
          type="button"
          className={assistantMode === "recipes" ? "is-active" : ""}
          aria-pressed={assistantMode === "recipes"}
          onClick={() => setAssistantMode("recipes")}
        >
          Report Recipes
        </button>
      </div>

      {assistantMode === "templates" ? (
        <section className="sql-assistant-mode-panel" aria-label="Template Library">
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
      ) : assistantMode === "assist" ? (
        <section className="sql-assistant-mode-panel sql-assistant-complex" aria-label="Complex SQL Assist">
          <label className="sql-assistant-task-input">
            <span>Describe the task you want SQL to perform</span>
            <textarea
              value={taskRequest}
              onChange={(event) => {
                setTaskRequest(event.target.value);
                setGeneratedDrafts([]);
              }}
              onKeyDown={handleTaskKeyDown}
              rows={4}
              placeholder={assistPlaceholder}
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
            <small>Generated SQL inserts into Monaco for review. Run query remains manual.</small>
          </div>

          {generatedDrafts.length > 0 && (
            <div className="sql-assistant-generated-list" aria-label="Generated SQL drafts">
              <div className="sql-helper-section-label">
                <span>Matching generated SQL</span>
                <small>{generatedDrafts.length.toLocaleString()}</small>
              </div>
              {generatedDrafts.map((draft) => (
                <article className="sql-assistant-generated-card" key={draft.id}>
                  <div className="sql-assistant-generated-head">
                    <div>
                      <strong>{draft.title}</strong>
                      <span>{draft.explanation}</span>
                    </div>
                    <em>{selectedDialectProfile.displayName}</em>
                  </div>
                  <dl>
                    <div>
                      <dt>Detected task</dt>
                      <dd>{draft.taskLabel}</dd>
                    </div>
                    <div>
                      <dt>Fields used</dt>
                      <dd>
                        {draft.fieldsUsed.length > 0
                          ? draft.fieldsUsed.join(", ")
                          : "No fields selected"}
                      </dd>
                    </div>
                    <div>
                      <dt>SQL logic used</dt>
                      <dd className="sql-assistant-logic-list">
                        {draft.logicUsed.map((logicItem) => (
                          <span key={logicItem}>{logicItem}</span>
                        ))}
                      </dd>
                    </div>
                    <div>
                      <dt>Warnings / uncertainty</dt>
                      <dd>
                        {draft.warnings.length > 0
                          ? draft.warnings.join(" ")
                          : "No major uncertainty detected. Review in Monaco before choosing Run query."}
                      </dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => onInsertSql(draft.sql)}
                  >
                    Insert into Monaco
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="sql-assistant-mode-panel" aria-label="Report Recipes">
          <div className="sql-assistant-controls sql-assistant-recipe-controls">
            <label className="sql-assistant-search">
              <span>Search report recipes</span>
              <input
                type="search"
                value={recipeSearchQuery}
                onChange={(event) => setRecipeSearchQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Top performers, quality, ranking, HAVING, join..."
              />
            </label>
            <p className="sql-assistant-recipe-note">
              Recipes combine patterns like grouping, ranking, thresholds, CASE checks, and joins into report-style drafts. They insert into Monaco only; blocked recipes show exactly what the active dataset is missing.
            </p>
          </div>

          <div className="sql-assistant-generated-list" aria-label="Report recipe drafts">
            <div className="sql-helper-section-label">
              <span>Available report recipes</span>
              <small>{filteredRecipes.length.toLocaleString()}</small>
            </div>
            {filteredRecipes.length === 0 ? (
              <p className="sql-helper-empty">No report recipes match this search.</p>
            ) : (
              filteredRecipes.map((recipe) => (
                <SqlReportRecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  selectedDialectProfile={selectedDialectProfile}
                  onInsertSql={onInsertSql}
                />
              ))
            )}
          </div>
        </section>
      )}
    </section>
  );
}

export default SqlAssistantPanel;
