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
  type SqlReportRecipeDomain,
} from "./sqlReportRecipes";
// K10: dataset-adaptive report intelligence planner. Subsumes K9 — when the
// upload looks like a property workbook, the planner forwards the compiled
// K9 recipes; otherwise it emits dynamic generic + domain-specific
// opportunities. K9's createMultiWorksheetRecipes remains the source of the
// compiled property recipes the planner reuses internally.
import {
  createReportOpportunities,
  type ReportOpportunity,
  type ReportOpportunityDomain,
} from "./reportIntelligencePlanner";
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
type SqlReportRecipeFilter =
  | "All"
  | "Supported"
  | "Not supported"
  | "Property"
  | "Generic"
  | "Payments"
  | "Inventory"
  | "HR"
  | "Healthcare"
  | "Logistics"
  | "Education"
  | "Support"
  | SqlReportRecipeDomain;

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

const recipeFilters: SqlReportRecipeFilter[] = [
  "All",
  "Supported",
  "Not supported",
  "Property",
  "Generic",
  "Operations",
  "CRM",
  "Product",
  "Sales",
  "Finance",
  "Payments",
  "Marketing",
  "Retail",
  "Inventory",
  "HR",
  "Healthcare",
  "Logistics",
  "Education",
  "Support",
  "Web",
];

const normalizeFilterValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const opportunityDomainLabels: Record<ReportOpportunityDomain, string> = {
  property: "Property",
  sales: "Sales",
  retail: "Retail",
  inventory: "Inventory",
  payments: "Payments",
  finance: "Finance",
  operations: "Operations",
  hr: "HR",
  healthcare: "Healthcare",
  logistics: "Logistics",
  education: "Education",
  support: "Support",
  marketing: "Marketing",
  generic: "Generic",
};

const confidenceLabel = (confidence: number) => {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.6) return "Medium";
  return "Low";
};

const getOpportunityFamily = (opportunity: ReportOpportunity) => {
  if (opportunity.id.startsWith("status-summary:")) return "Status summaries";
  if (opportunity.id.startsWith("top-categories-by-")) return "Top categories";
  if (opportunity.id.startsWith("trend-over-time:")) return "Monthly trends";
  if (opportunity.id.startsWith("completeness:")) return "Completeness reports";
  if (opportunity.id.startsWith("entity-activity:")) return "Entity activity";
  return "Other suggestions";
};

const familyOrder = [
  "Status summaries",
  "Top categories",
  "Monthly trends",
  "Completeness reports",
  "Entity activity",
  "Other suggestions",
];

const matchesDomainFilter = (
  domains: string[] | undefined,
  activeFilter: SqlReportRecipeFilter,
) => {
  if (!domains || domains.length === 0) return false;
  const normalizedFilter = normalizeFilterValue(activeFilter);
  return domains.some((domain) => normalizeFilterValue(domain) === normalizedFilter);
};

const matchesOpportunityFilter = (
  opportunity: ReportOpportunity,
  activeFilter: SqlReportRecipeFilter,
) =>
  activeFilter === "All" ||
  (activeFilter === "Supported" && opportunity.support === "can_generate_now") ||
  (activeFilter === "Not supported" && opportunity.support === "needs_missing_fields") ||
  matchesDomainFilter(opportunity.domains, activeFilter);

const matchesRecipeFilter = (
  recipe: SqlReportRecipe,
  activeFilter: SqlReportRecipeFilter,
) =>
  activeFilter === "All" ||
  (activeFilter === "Supported" && Boolean(recipe.sql)) ||
  (activeFilter === "Not supported" && !recipe.sql) ||
  matchesDomainFilter(recipe.domains, activeFilter);

const sortOpportunitiesByRelevance = (opportunities: ReportOpportunity[]) =>
  [...opportunities].sort((a, b) => {
    const supportDelta =
      Number(b.support === "can_generate_now") - Number(a.support === "can_generate_now");
    if (supportDelta !== 0) return supportDelta;
    const confidenceDelta = b.confidence - a.confidence;
    if (confidenceDelta !== 0) return confidenceDelta;
    return a.title.localeCompare(b.title);
  });

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

// K10: Opportunity card. Richer than SqlReportRecipeCard because opportunities
// carry business-question / why-it-matters copy, confidence, method, joins/
// aggregation/date-logic/anomaly tags, and a worksheet-usage chip strip.
function ReportOpportunityCard({
  opportunity,
  selectedDialectProfile,
  onInsertSql,
}: {
  opportunity: ReportOpportunity;
  selectedDialectProfile: SqlDialectProfile;
  onInsertSql: (sql: string) => void;
}) {
  const ready = opportunity.support === "can_generate_now" && Boolean(opportunity.sql);
  const confidencePct = Math.round(opportunity.confidence * 100);
  const displayDomains =
    opportunity.domains.length === 1 && opportunity.domains[0] === "generic"
      ? []
      : opportunity.domains;
  const visibleDomains = displayDomains.slice(0, 3);
  const hiddenDomainCount = Math.max(0, displayDomains.length - visibleDomains.length);
  const visibleRequiredTables =
    opportunity.requiredTables.length === 1 &&
    normalizeFilterValue(opportunity.title).includes(normalizeFilterValue(opportunity.requiredTables[0]))
      ? []
      : opportunity.requiredTables;
  const showTableChips = visibleRequiredTables.length > 0 || opportunity.optionalTables.length > 0;
  const tags: string[] = [];
  if (opportunity.needsJoins) tags.push("joins");
  if (opportunity.needsAggregation) tags.push("aggregation");
  if (opportunity.needsDateLogic) tags.push("date logic");
  if (opportunity.needsAnomalyDetection) tags.push("anomaly check");
  const methodLabel: Record<ReportOpportunity["method"], string> = {
    sql: "SQL",
    excel: "Excel",
    python: "Python",
    future_optimization: "Future optimization",
  };
  return (
    <article
      className={`sql-assistant-generated-card sql-assistant-opportunity-card is-${
        ready ? "ready" : "blocked"
      }`}
    >
      <div className="sql-assistant-generated-head">
        <div>
          <strong>{opportunity.title}</strong>
          <span>{opportunity.businessQuestion}</span>
        </div>
        <em>{selectedDialectProfile.displayName}</em>
      </div>
      <div className="sql-assistant-opportunity-meta" aria-label="Opportunity metadata">
        {visibleDomains.map((domain: ReportOpportunityDomain) => (
          <span key={domain} className="sql-assistant-opportunity-domain">
            {opportunityDomainLabels[domain]}
          </span>
        ))}
        {hiddenDomainCount > 0 && (
          <span className="sql-assistant-opportunity-domain">+{hiddenDomainCount}</span>
        )}
        <span
          className="sql-assistant-opportunity-confidence"
          title={`Planner confidence: ${confidencePct}%`}
        >
          {confidenceLabel(opportunity.confidence)} confidence
        </span>
        <span className="sql-assistant-opportunity-complexity">
          {opportunity.complexity}
        </span>
        {opportunity.method !== "sql" && (
          <span className="sql-assistant-opportunity-method">
            {methodLabel[opportunity.method]}
          </span>
        )}
        {opportunity.compiledRecipeId && (
          <span className="sql-assistant-opportunity-compiled" title="Compiled recipe">
            compiled
          </span>
        )}
      </div>
      <p className="sql-assistant-opportunity-why">{opportunity.whyItMatters}</p>
      {showTableChips && (
        <div className="sql-assistant-worksheets-used">
          <span className="sql-assistant-worksheets-used-label">
            {visibleRequiredTables.length > 0
              ? `Required ${visibleRequiredTables.length === 1 ? "table" : "tables"}`
              : "Related tables"}
          </span>
          <div className="sql-assistant-worksheets-used-chips">
            {visibleRequiredTables.map((table) => (
              <span key={table} className="sql-assistant-worksheet-chip">
                {table}
              </span>
            ))}
            {opportunity.optionalTables.map((table) => (
              <span
                key={`opt:${table}`}
                className="sql-assistant-worksheet-chip is-optional"
                title="Optional — enriches the report when present"
              >
                {table} (optional)
              </span>
            ))}
          </div>
        </div>
      )}
      {tags.length > 0 && (
        <div className="sql-assistant-opportunity-tags" aria-label="Report shape">
          {tags.map((tag) => (
            <span key={tag} className="sql-assistant-opportunity-tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      {ready ? (
        <p className="sql-assistant-recipe-ready">
          Can generate now. Safe draft below — insert into Monaco to review before running.
        </p>
      ) : (
        <p className="sql-assistant-recipe-blocked">
          Needs missing fields. {opportunity.missingRequirements.length > 0
            ? `Add: ${opportunity.missingRequirements.join(", ")}.`
            : "Required columns were not detected on this upload."}
        </p>
      )}
      <button
        type="button"
        className="secondary-button"
        onClick={() => opportunity.sql && onInsertSql(opportunity.sql)}
        disabled={!ready}
      >
        {ready ? "Insert SQL into Monaco" : "Needs missing fields"}
      </button>
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
  const importantWarnings = recipe.warnings.filter((warning) => {
    const normalizedWarning = warning.toLowerCase();
    return !recipe.missingRequirements.some((requirement) =>
      normalizedWarning.includes(requirement.toLowerCase()),
    );
  });
  const readinessLine = recipe.sql
    ? "Safe draft available. Insert into Monaco to review before running."
    : recipe.supportSummary;
  const visibleDomains = recipe.domains?.slice(0, 2) || [];
  const hiddenDomainCount = Math.max(0, (recipe.domains?.length || 0) - visibleDomains.length);

  return (
    <article className="sql-assistant-generated-card sql-assistant-recipe-card">
      <div className="sql-assistant-generated-head">
        <div>
          <strong>{recipe.title}</strong>
          <span>{recipe.businessPurpose}</span>
        </div>
        <em>{selectedDialectProfile.displayName}</em>
      </div>
      {visibleDomains.length > 0 && (
        <div className="sql-assistant-logic-list" aria-label="Recipe domains">
          {visibleDomains.map((domain) => (
            <span key={domain}>{domain}</span>
          ))}
          {hiddenDomainCount > 0 && <span>+{hiddenDomainCount}</span>}
        </div>
      )}
      {recipe.worksheetsUsed && recipe.worksheetsUsed.length > 0 && (
        <div className="sql-assistant-worksheets-used" aria-label="Worksheets this recipe joins">
          <span className="sql-assistant-worksheets-used-label">Worksheets used</span>
          <div className="sql-assistant-worksheets-used-chips">
            {recipe.worksheetsUsed.map((worksheet) => (
              <span key={worksheet} className="sql-assistant-worksheet-chip">
                {worksheet}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className={recipe.sql ? "sql-assistant-recipe-ready" : "sql-assistant-recipe-blocked"}>
        {readinessLine}
      </p>
      {importantWarnings.length > 0 && (
        <p className="sql-assistant-recipe-warning">{importantWarnings.join(" ")}</p>
      )}
      <details className="sql-assistant-recipe-details">
        <summary>Recipe details</summary>
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
        </dl>
      </details>
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

function ReportOpportunityList({
  opportunities,
  selectedDialectProfile,
  onInsertSql,
}: {
  opportunities: ReportOpportunity[];
  selectedDialectProfile: SqlDialectProfile;
  onInsertSql: (sql: string) => void;
}) {
  const grouped = familyOrder
    .map((family) => ({
      family,
      opportunities: opportunities.filter((opportunity) => getOpportunityFamily(opportunity) === family),
    }))
    .filter((group) => group.opportunities.length > 0);

  return (
    <>
      {grouped.map((group) =>
        group.opportunities.length > 1 && group.family !== "Other suggestions" ? (
          <details
            className="sql-assistant-opportunity-family"
            key={group.family}
            open={false}
          >
            <summary>
              <span>{group.family}</span>
              <small>{group.opportunities.length.toLocaleString()}</small>
            </summary>
            <div className="sql-assistant-opportunity-family-list">
              {group.opportunities.map((opportunity) => (
                <ReportOpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  selectedDialectProfile={selectedDialectProfile}
                  onInsertSql={onInsertSql}
                />
              ))}
            </div>
          </details>
        ) : (
          group.opportunities.map((opportunity) => (
            <ReportOpportunityCard
              key={opportunity.id}
              opportunity={opportunity}
              selectedDialectProfile={selectedDialectProfile}
              onInsertSql={onInsertSql}
            />
          ))
        ),
      )}
    </>
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
  const [activeRecipeFilter, setActiveRecipeFilter] = useState<SqlReportRecipeFilter>("All");
  const templates = useMemo(
    () => createSqlAssistantTemplates(dataset, selectedDialect),
    [dataset, selectedDialect],
  );
  const recipes = useMemo(
    () => createSqlReportRecipes(dataset, selectedDialect),
    [dataset, selectedDialect],
  );
  // K10: dataset-adaptive report opportunities. The planner re-runs whenever
  // the active dataset changes — so when the user switches the active
  // worksheet in SQL Context, the opportunity list regenerates against the
  // freshly-detected column shape across the workbook.
  const reportOpportunities = useMemo(
    () => createReportOpportunities(dataset, selectedDialect),
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
    if (!matchesRecipeFilter(recipe, activeRecipeFilter)) return false;
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
      recipe.domains?.join(" ") || "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedRecipeQuery);
  });
  const supportedRecipes = filteredRecipes.filter((recipe) => recipe.sql);
  const blockedRecipes = filteredRecipes.filter((recipe) => !recipe.sql);

  // K10: filter dataset-adaptive opportunities through the same search + filter
  // pipeline as single-table recipes. Opportunities expose richer metadata
  // (domains, complexity, methods, joins/aggregation/date logic flags), so the
  // search also matches against business question and "why it matters" copy.
  const filteredOpportunities = reportOpportunities.filter((opportunity) => {
    if (!matchesOpportunityFilter(opportunity, activeRecipeFilter)) return false;
    if (!normalizedRecipeQuery) return true;
    return [
      opportunity.title,
      opportunity.businessQuestion,
      opportunity.whyItMatters,
      opportunity.domains.join(" "),
      opportunity.requiredTables.join(" "),
      opportunity.requiredColumns.join(" "),
      opportunity.missingRequirements.join(" "),
      opportunity.method,
      opportunity.complexity,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedRecipeQuery);
  });
  const relevantOpportunities = sortOpportunitiesByRelevance(filteredOpportunities).slice(0, 5);
  const relevantOpportunityIds = new Set(relevantOpportunities.map((opportunity) => opportunity.id));
  const remainingOpportunities = filteredOpportunities.filter(
    (opportunity) => !relevantOpportunityIds.has(opportunity.id),
  );
  const emptyRecipeMessage = normalizedRecipeQuery
    ? "No recipes match this search. Try clearing the search or switching to All."
    : activeRecipeFilter === "Supported"
      ? "No supported recipes for this dataset yet. Try All to see recipes that need more structure."
      : activeRecipeFilter === "Not supported"
        ? "No blocked recipes for this dataset."
        : activeRecipeFilter === "All"
          ? "No report recipes match this dataset yet."
          : `No ${activeRecipeFilter} recipes match this dataset. Try All or Supported.`;

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
            <div className="sql-assistant-category-tabs" aria-label="Report recipe filters">
              {recipeFilters.map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={activeRecipeFilter === filter ? "is-active" : ""}
                  aria-pressed={activeRecipeFilter === filter}
                  onClick={() => setActiveRecipeFilter(filter)}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="sql-assistant-generated-list" aria-label="Report recipe drafts">
            {/* K10: Suggested business reports — dataset-adaptive opportunities
                from the planner. Subsumes K9 — when the upload is a property
                workbook the planner forwards K9's compiled recipes alongside
                generic + other domain-specific opportunities. Empty only when
                no dataset is open. */}
            {filteredOpportunities.length > 0 && (
              <section
                className="sql-assistant-workbook-reports"
                aria-label="Suggested business reports"
              >
                <div className="sql-helper-section-label">
                  <span>Suggested business reports</span>
                  <small>
                    {filteredOpportunities.length.toLocaleString()} for this dataset
                  </small>
                </div>
                <p className="sql-assistant-recipe-note">
                  Dynamic business-report opportunities detected from the upload's
                  worksheets, column kinds, and likely keys. Inserts into Monaco only.
                </p>
                {relevantOpportunities.length > 0 && (
                  <section
                    className="sql-assistant-most-relevant"
                    aria-label="Most relevant suggested reports"
                  >
                    <div className="sql-helper-section-label">
                      <span>Most relevant</span>
                      <small>{relevantOpportunities.length.toLocaleString()}</small>
                    </div>
                    {relevantOpportunities.map((opportunity) => (
                      <ReportOpportunityCard
                        key={opportunity.id}
                        opportunity={opportunity}
                        selectedDialectProfile={selectedDialectProfile}
                        onInsertSql={onInsertSql}
                      />
                    ))}
                  </section>
                )}
                {remainingOpportunities.length > 0 && (
                  <section
                    className="sql-assistant-more-opportunities"
                    aria-label="More suggested business reports"
                  >
                    <div className="sql-helper-section-label">
                      <span>More suggestions</span>
                      <small>{remainingOpportunities.length.toLocaleString()}</small>
                    </div>
                    <ReportOpportunityList
                      opportunities={remainingOpportunities}
                      selectedDialectProfile={selectedDialectProfile}
                      onInsertSql={onInsertSql}
                    />
                  </section>
                )}
              </section>
            )}
            <div className="sql-helper-section-label">
              <span>Available report recipes</span>
              <small>{filteredRecipes.length.toLocaleString()}</small>
            </div>
            {filteredRecipes.length === 0 ? (
              <p className="sql-helper-empty">{emptyRecipeMessage}</p>
            ) : (
              <>
                {supportedRecipes.map((recipe) => (
                  <SqlReportRecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    selectedDialectProfile={selectedDialectProfile}
                    onInsertSql={onInsertSql}
                  />
                ))}
                {blockedRecipes.length > 0 && (
                  <section className="sql-assistant-blocked-recipes" aria-label="Unsupported report recipes">
                    <div className="sql-helper-section-label">
                      <span>Not supported on this dataset</span>
                      <small>{blockedRecipes.length.toLocaleString()}</small>
                    </div>
                    {blockedRecipes.map((recipe) => (
                      <SqlReportRecipeCard
                        key={recipe.id}
                        recipe={recipe}
                        selectedDialectProfile={selectedDialectProfile}
                        onInsertSql={onInsertSql}
                      />
                    ))}
                  </section>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

export default SqlAssistantPanel;
