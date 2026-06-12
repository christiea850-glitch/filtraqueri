import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import {
  formatSqlColumn,
} from "./sqlSchemaHelpers";
import {
  createSqlAssistantGenerationContext,
  deriveSqlTemplateRuntimeBadge,
  formatRowLimitClause,
  type SqlAssistantFutureDialectId,
} from "./sqlTemplateLibrary";

export type SqlReportRecipeId =
  | "inactive-records"
  | "top-performers"
  | "data-quality"
  | "category-summary"
  | "date-trend"
  | "ranking"
  | "threshold-having"
  | "multi-table-join"
  | "vacancy-inventory"
  // K9: workbook-aware (multi-worksheet) report recipes
  | "tenant-access-behavior"
  | "maintenance-requests-by-property"
  | "rent-payment-summary"
  | "vacant-units-by-property"
  | "lease-expiration-watchlist";

export type SqlReportRecipeDomain =
  | "Marketing"
  | "Sales"
  | "Finance"
  | "Operations"
  | "Product"
  | "CRM"
  | "Retail"
  | "Web";

export type SqlReportRecipe = {
  id: SqlReportRecipeId;
  title: string;
  businessPurpose: string;
  requiredFieldRoles: string[];
  sqlPatterns: string[];
  dialectSupportNote: string;
  supportSummary: string;
  sql: string | null;
  warnings: string[];
  missingRequirements: string[];
  dialects?: Array<SqlDialectId | SqlAssistantFutureDialectId>;
  domains?: SqlReportRecipeDomain[];
  /**
   * K9: For workbook-aware multi-worksheet recipes, the display names of the
   * worksheets the generated SQL will join. Surfaced as chips on the card so
   * users see exactly which sheets are involved before inserting into Monaco.
   */
  worksheetsUsed?: string[];
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const columnText = (column: SchemaColumn) => normalizeText(column.name);

const includesAny = (value: string, terms: string[]) =>
  terms.some((term) => value.includes(term));

type InactiveEntityKind = "person" | "asset" | "workflow" | "generic";

type InactiveEntityDetection = {
  column: SchemaColumn;
  kind: InactiveEntityKind;
};

const inactiveEntityTerms: Record<InactiveEntityKind, string[]> = {
  person: ["customer", "user", "account", "member", "subscriber", "patient", "employee", "tenant"],
  asset: ["product", "item", "sku", "unit", "property", "asset", "track", "song", "device"],
  workflow: ["order", "ticket", "case", "contract", "lease", "claim"],
  generic: ["id", "name", "number", "code", "reference", "record"],
};

const activityDateTerms = [
  "date",
  "time",
  "created",
  "updated",
  "activity",
  "last",
  "recent",
  "login",
  "purchase",
  "order",
  "event",
  "transaction",
  "closed",
  "resolved",
  "renewed",
  "start",
  "end",
];

const inactiveBusinessPurpose: Record<InactiveEntityKind, string> = {
  person: "Identifies people or accounts with no recent activity.",
  asset: "Identifies assets or items with no recent activity.",
  workflow: "Identifies operational records with no recent activity.",
  generic: "Identifies records with no recent activity.",
};

const findInactiveEntityColumn = (columns: SchemaColumn[]): InactiveEntityDetection | null => {
  const nonDateColumns = columns.filter((column) => column.inferred_type !== "date");
  const searchableColumns = nonDateColumns.length > 0 ? nonDateColumns : columns;
  const prioritizedKinds: InactiveEntityKind[] = ["person", "asset", "workflow"];

  for (const kind of prioritizedKinds) {
    const column = searchableColumns.find((candidate) =>
      includesAny(columnText(candidate), inactiveEntityTerms[kind]),
    );
    if (column) return { column, kind };
  }

  const genericColumn =
    searchableColumns.find((candidate) =>
      includesAny(columnText(candidate), inactiveEntityTerms.generic),
    ) ||
    searchableColumns.find((candidate) => candidate.inferred_type === "categorical") ||
    searchableColumns.find((candidate) => candidate.unique_count > 0);

  return genericColumn ? { column: genericColumn, kind: "generic" } : null;
};

const pickInactiveActivityColumn = (columns: SchemaColumn[]) =>
  columns.find((column) => column.inferred_type === "date" && includesAny(columnText(column), activityDateTerms)) ||
  columns.find((column) => includesAny(columnText(column), activityDateTerms)) ||
  columns.find((column) => column.inferred_type === "date") ||
  columns.find((column) => includesAny(columnText(column), ["year"])) ||
  null;

const domainsForInactiveEntity = (kind: InactiveEntityKind): SqlReportRecipeDomain[] => {
  if (kind === "person") return ["Operations", "CRM"];
  if (kind === "asset") return ["Operations", "Product"];
  if (kind === "workflow") return ["Operations"];
  return ["Operations"];
};

const aliasFrom = (prefix: string, column: SchemaColumn | null) =>
  `${prefix}_${(column?.name || "value")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;

const metricAlias = (prefix: string, column: SchemaColumn | null) =>
  aliasFrom(prefix, column).replace(/_+/g, "_");

const pickPreferredColumn = (columns: SchemaColumn[], terms: string[]) =>
  columns.find((column) => includesAny(columnText(column), terms)) || columns[0] || null;

const pickCategoryColumn = (columns: SchemaColumn[]) =>
  pickPreferredColumn(columns, [
    "artist",
    "product",
    "region",
    "country",
    "breed",
    "contract",
    "service",
    "department",
    "category",
    "segment",
    "status",
  ]);

const pickMeasureColumn = (columns: SchemaColumn[]) =>
  pickPreferredColumn(columns, [
    "streams",
    "revenue",
    "sales",
    "profit",
    "charges",
    "yield",
    "temperature",
    "risk",
    "quantity",
    "amount",
    "price",
    "cost",
  ]);

const pickStatusColumn = (columns: SchemaColumn[]) =>
  columns.find((column) =>
    includesAny(columnText(column), [
      "status",
      "vacancy",
      "available",
      "availability",
      "inventory",
      "stock",
      "occupied",
      "active",
    ]),
  ) || null;

const pickDateColumn = (columns: SchemaColumn[]) =>
  columns.find((column) => column.inferred_type === "date") ||
  columns.find((column) =>
    includesAny(columnText(column), [
      "date",
      "year",
      "month",
      "time",
      "released",
      "release",
      "created",
      "updated",
    ]),
  ) ||
  null;

export const deriveSqlReportRuntimeBadge = ({
  sql,
  dialects,
  selectedDialect,
}: {
  sql: string | null;
  dialects?: Array<SqlDialectId | SqlAssistantFutureDialectId>;
  selectedDialect?: SqlDialectId;
}): string => {
  if (!sql) return "Review syntax for DuckDB before running";

  if (selectedDialect === "mariadb" && /\bLIMIT\s+\d+\b/i.test(sql)) {
    return "DuckDB/MariaDB style";
  }

  return deriveSqlTemplateRuntimeBadge({
    sql,
    dialects,
    dialectLabel: "Report SQL",
  });
};

const dialectWarning = (selectedDialect: SqlDialectId) =>
  selectedDialect === "duckdb"
    ? []
    : ["Review or convert for DuckDB execution before running."];

const requireFields = (
  requirements: Array<[string, SchemaColumn | null]>,
) => requirements.filter(([, column]) => !column).map(([label]) => label);

const createUnavailableRecipe = (
  baseRecipe: Omit<SqlReportRecipe, "sql" | "warnings" | "missingRequirements">,
  missingRequirements: string[],
  warnings: string[],
): SqlReportRecipe => ({
  ...baseRecipe,
  sql: null,
  warnings,
  missingRequirements,
});

const createMissingValueExpressions = (columns: SchemaColumn[]) =>
  columns
    .slice(0, 8)
    .map(
      (column) =>
        `SUM(CASE WHEN ${formatSqlColumn(column.name)} IS NULL THEN 1 ELSE 0 END) AS ${aliasFrom("missing", column)}`,
    )
    .join(",\n  ");

const supportedSummary = (fieldNames: string[]) =>
  `Supported by this dataset using ${fieldNames.join(", ")}.`;

const blockedSummary = (missingRequirements: string[]) =>
  `Needs more structure: ${missingRequirements.join(", ")}.`;

export const createSqlReportRecipes = (
  dataset: DatasetMetadata | null,
  selectedDialect: SqlDialectId,
): SqlReportRecipe[] => {
  const context = createSqlAssistantGenerationContext({ dataset, selectedDialect });
  const topTenLimit = formatRowLimitClause(selectedDialect, 10);
  const topTwentyFiveLimit = formatRowLimitClause(selectedDialect, 25);
  const topFiftyLimit = formatRowLimitClause(selectedDialect, 50);
  const categoryColumn = pickCategoryColumn(context.categoricalColumns);
  const measureColumn = pickMeasureColumn(context.numericColumns);
  const dateColumn = pickDateColumn(context.schema);
  const statusColumn = pickStatusColumn(context.schema);
  const segmentColumn = categoryColumn || context.schema[0] || null;
  const inactiveEntity = findInactiveEntityColumn(context.schema);
  const inactiveActivityColumn = pickInactiveActivityColumn(context.schema);
  const warnings = dialectWarning(selectedDialect);
  const recipes: SqlReportRecipe[] = [];

  const inactiveMissing = requireFields([
    ["entity-like field", inactiveEntity?.column || null],
    ["date or activity-like field", inactiveActivityColumn],
  ]);
  recipes.push(
    inactiveMissing.length > 0
      ? createUnavailableRecipe(
          {
            id: "inactive-records",
            title: "Inactive Records Report",
            businessPurpose: "Identifies records with no recent activity.",
            requiredFieldRoles: ["Entity-like field", "Date or activity-like field"],
            sqlPatterns: ["GROUP BY", "MAX", "COUNT", "CASE", "ORDER BY", "ROW LIMIT"],
            dialectSupportNote: "Uses common aggregate SQL with selected-dialect row-limit guidance; review or convert for DuckDB execution before running.",
            supportSummary: blockedSummary(inactiveMissing),
            domains: ["Operations"],
            dialects: ["duckdb"],
          },
          inactiveMissing,
          ["Needs more structure: an inactive records report needs both an entity-like field and a date or activity-like field."],
        )
      : {
          id: "inactive-records",
          title: "Inactive Records Report",
          businessPurpose: inactiveBusinessPurpose[inactiveEntity!.kind],
          requiredFieldRoles: ["Entity-like field", "Date or activity-like field"],
          sqlPatterns: ["GROUP BY", "MAX", "COUNT", "CASE", "ORDER BY", "ROW LIMIT"],
          dialectSupportNote: "Uses common aggregate SQL with selected-dialect row-limit guidance; review or convert for DuckDB execution before running.",
          supportSummary: supportedSummary([inactiveEntity!.column.name, inactiveActivityColumn!.name]),
          sql: `SELECT
  ${formatSqlColumn(inactiveEntity!.column.name)},
  MAX(${formatSqlColumn(inactiveActivityColumn!.name)}) AS latest_activity,
  COUNT(*) AS record_count,
  CASE
    WHEN MAX(${formatSqlColumn(inactiveActivityColumn!.name)}) IS NULL THEN 'Needs review'
    ELSE 'Recently active'
  END AS activity_status
FROM ${context.tableName}
GROUP BY ${formatSqlColumn(inactiveEntity!.column.name)}
ORDER BY
  CASE WHEN MAX(${formatSqlColumn(inactiveActivityColumn!.name)}) IS NULL THEN 0 ELSE 1 END ASC,
  latest_activity ASC
${topFiftyLimit};`,
          warnings,
          missingRequirements: [],
          domains: domainsForInactiveEntity(inactiveEntity!.kind),
          dialects: ["duckdb"],
        },
  );

  const topPerformerMissing = requireFields([
    ["category or segment field", categoryColumn],
    ["numeric measure field", measureColumn],
  ]);
  recipes.push(
    topPerformerMissing.length > 0
      ? createUnavailableRecipe(
          {
            id: "top-performers",
            title: "Top performers report",
            businessPurpose: "Ranks the strongest groups by a measurable value.",
            requiredFieldRoles: ["Category or segment", "Numeric measure"],
            sqlPatterns: ["GROUP BY", "SUM", "AVG", "COUNT", "ORDER BY", "ROW LIMIT"],
            dialectSupportNote: "Uses selected-dialect row-limit guidance; review or convert for DuckDB execution before running.",
            supportSummary: blockedSummary(topPerformerMissing),
            dialects: ["duckdb"],
          },
          topPerformerMissing,
          ["A top performers report needs both a grouping field and a numeric measure."],
        )
      : {
          id: "top-performers",
          title: "Top performers report",
          businessPurpose: `Ranks ${categoryColumn.name} by total ${measureColumn.name}.`,
          requiredFieldRoles: ["Category or segment", "Numeric measure"],
          sqlPatterns: ["GROUP BY", "SUM", "AVG", "COUNT", "ORDER BY", "ROW LIMIT"],
          dialectSupportNote: "Uses selected-dialect row-limit guidance; review or convert for DuckDB execution before running.",
          supportSummary: supportedSummary([categoryColumn.name, measureColumn.name]),
          sql: `SELECT
  ${formatSqlColumn(categoryColumn.name)},
  SUM(${formatSqlColumn(measureColumn.name)}) AS ${metricAlias("total", measureColumn)},
  AVG(${formatSqlColumn(measureColumn.name)}) AS ${metricAlias("average", measureColumn)},
  COUNT(*) AS record_count
FROM ${context.tableName}
GROUP BY ${formatSqlColumn(categoryColumn.name)}
ORDER BY ${metricAlias("total", measureColumn)} DESC
${topTenLimit};`,
          warnings,
          missingRequirements: [],
          dialects: ["duckdb"],
        },
  );

  recipes.push({
    id: "data-quality",
    title: "Data quality report",
    businessPurpose: "Counts rows and missing values for important columns.",
    requiredFieldRoles: ["Active table schema"],
    sqlPatterns: ["COUNT", "CASE WHEN", "SUM"],
    dialectSupportNote: "Uses portable aggregate logic; review identifier quoting before DuckDB execution.",
    supportSummary:
      context.schema.length > 0
        ? supportedSummary([`${context.schema.length.toLocaleString()} schema fields`])
        : blockedSummary(["active table schema"]),
    sql:
      context.schema.length > 0
        ? `SELECT
  COUNT(*) AS record_count,
  ${createMissingValueExpressions(context.schema)}
FROM ${context.tableName};`
        : null,
    warnings:
      context.schema.length > 0
        ? warnings
        : ["No active schema was available, so a data quality draft cannot be created yet."],
    missingRequirements: context.schema.length > 0 ? [] : ["active table schema"],
    dialects: ["duckdb"],
  });

  const summaryMissing = requireFields([["category or segment field", segmentColumn]]);
  recipes.push(
    summaryMissing.length > 0
      ? createUnavailableRecipe(
          {
            id: "category-summary",
            title: "Category summary report",
            businessPurpose: "Summarizes record volume by a category or segment.",
            requiredFieldRoles: ["Category or segment", "Optional numeric measure"],
            sqlPatterns: ["GROUP BY", "COUNT", "SUM", "AVG", "ORDER BY"],
            dialectSupportNote: "Uses the selected dialect row-limit style when a row limit is needed.",
            supportSummary: blockedSummary(summaryMissing),
            dialects: ["duckdb"],
          },
          summaryMissing,
          ["A category summary needs at least one grouping field."],
        )
      : {
          id: "category-summary",
          title: "Category summary report",
          businessPurpose: measureColumn
            ? `Summarizes records and ${measureColumn.name} by ${segmentColumn.name}.`
            : `Summarizes record counts by ${segmentColumn.name}.`,
          requiredFieldRoles: ["Category or segment", "Optional numeric measure"],
          sqlPatterns: measureColumn
            ? ["GROUP BY", "COUNT", "SUM", "AVG", "ORDER BY"]
            : ["GROUP BY", "COUNT", "ORDER BY"],
          dialectSupportNote: "Uses the selected dialect row-limit style when a row limit is needed.",
          supportSummary: supportedSummary(
            measureColumn ? [segmentColumn.name, measureColumn.name] : [segmentColumn.name],
          ),
          sql: `SELECT
  ${formatSqlColumn(segmentColumn.name)},
  COUNT(*) AS record_count${
            measureColumn
              ? `,
  SUM(${formatSqlColumn(measureColumn.name)}) AS ${metricAlias("total", measureColumn)},
  AVG(${formatSqlColumn(measureColumn.name)}) AS ${metricAlias("average", measureColumn)}`
              : ""
          }
FROM ${context.tableName}
GROUP BY ${formatSqlColumn(segmentColumn.name)}
ORDER BY ${measureColumn ? metricAlias("total", measureColumn) : "record_count"} DESC
${topTwentyFiveLimit};`,
          warnings,
          missingRequirements: [],
          dialects: ["duckdb"],
        },
  );

  const dateTrendMissing = requireFields([["date, year, month, or time field", dateColumn]]);
  recipes.push(
    dateTrendMissing.length > 0
      ? createUnavailableRecipe(
          {
            id: "date-trend",
            title: "Trend / date report",
            businessPurpose: "Summarizes records over a detected date, year, month, or time field.",
            requiredFieldRoles: ["Date, year, month, or time field", "Optional numeric measure"],
            sqlPatterns: ["GROUP BY", "COUNT", "SUM", "AVG", "ORDER BY"],
            dialectSupportNote: "Groups by the detected field directly to keep the draft portable.",
            supportSummary: blockedSummary(dateTrendMissing),
            dialects: ["duckdb"],
          },
          dateTrendMissing,
          ["A trend report needs a date, year, month, or time-like field."],
        )
      : {
          id: "date-trend",
          title: "Trend / date report",
          businessPurpose: measureColumn
            ? `Summarizes ${measureColumn.name} over ${dateColumn!.name}.`
            : `Counts records over ${dateColumn!.name}.`,
          requiredFieldRoles: ["Date, year, month, or time field", "Optional numeric measure"],
          sqlPatterns: measureColumn
            ? ["GROUP BY", "COUNT", "SUM", "AVG", "ORDER BY"]
            : ["GROUP BY", "COUNT", "ORDER BY"],
          dialectSupportNote: "Groups by the detected field directly to keep the draft portable.",
          supportSummary: supportedSummary(
            measureColumn ? [dateColumn!.name, measureColumn.name] : [dateColumn!.name],
          ),
          sql: `SELECT
  ${formatSqlColumn(dateColumn!.name)},
  COUNT(*) AS record_count${
            measureColumn
              ? `,
  SUM(${formatSqlColumn(measureColumn.name)}) AS ${metricAlias("total", measureColumn)},
  AVG(${formatSqlColumn(measureColumn.name)}) AS ${metricAlias("average", measureColumn)}`
              : ""
          }
FROM ${context.tableName}
GROUP BY ${formatSqlColumn(dateColumn!.name)}
ORDER BY ${formatSqlColumn(dateColumn!.name)};`,
          warnings,
          missingRequirements: [],
          dialects: ["duckdb"],
        },
  );

  const rankingMissing = requireFields([
    ["category or segment field", categoryColumn],
    ["numeric measure field", measureColumn],
  ]);
  recipes.push(
    rankingMissing.length > 0
      ? createUnavailableRecipe(
          {
            id: "ranking",
            title: "Ranking report",
            businessPurpose: "Creates a ranked summary from grouped results.",
            requiredFieldRoles: ["Category or segment", "Numeric measure"],
            sqlPatterns: ["CTE", "GROUP BY", "SUM", "RANK", "ORDER BY", "ROW LIMIT"],
            dialectSupportNote: "Uses a CTE, window function, and selected-dialect row-limit guidance; review or convert for DuckDB execution before running.",
            supportSummary: blockedSummary(rankingMissing),
            dialects: ["duckdb"],
          },
          rankingMissing,
          ["A ranking report needs a grouping field and numeric measure."],
        )
      : {
          id: "ranking",
          title: "Ranking report",
          businessPurpose: `Ranks ${categoryColumn.name} groups by total ${measureColumn.name}.`,
          requiredFieldRoles: ["Category or segment", "Numeric measure"],
          sqlPatterns: ["CTE", "GROUP BY", "SUM", "RANK", "ORDER BY", "ROW LIMIT"],
          dialectSupportNote: "Uses a CTE, window function, and selected-dialect row-limit guidance; review or convert for DuckDB execution before running.",
          supportSummary: supportedSummary([categoryColumn.name, measureColumn.name]),
          sql: `WITH grouped_report AS (
  SELECT
    ${formatSqlColumn(categoryColumn.name)},
    SUM(${formatSqlColumn(measureColumn.name)}) AS ${metricAlias("total", measureColumn)},
    COUNT(*) AS record_count
  FROM ${context.tableName}
  GROUP BY ${formatSqlColumn(categoryColumn.name)}
)
SELECT
  *,
  RANK() OVER (ORDER BY ${metricAlias("total", measureColumn)} DESC) AS report_rank
FROM grouped_report
ORDER BY report_rank
${topTwentyFiveLimit};`,
          warnings,
          missingRequirements: [],
          dialects: ["duckdb"],
        },
  );

  const thresholdMissing = requireFields([
    ["category or segment field", categoryColumn],
    ["numeric measure field", measureColumn],
  ]);
  recipes.push(
    thresholdMissing.length > 0
      ? createUnavailableRecipe(
          {
            id: "threshold-having",
            title: "Threshold / HAVING report",
            businessPurpose: "Keeps only groups that meet minimum volume or value thresholds.",
            requiredFieldRoles: ["Category or segment", "Numeric measure", "Thresholds to review"],
            sqlPatterns: ["GROUP BY", "COUNT", "SUM", "HAVING", "ORDER BY"],
            dialectSupportNote: "Common aggregate SQL; review threshold values and runtime syntax before running.",
            supportSummary: blockedSummary(thresholdMissing),
            dialects: ["duckdb"],
          },
          thresholdMissing,
          ["A threshold report needs a grouping field and numeric measure."],
        )
      : {
          id: "threshold-having",
          title: "Threshold / HAVING report",
          businessPurpose: `Filters ${categoryColumn.name} groups after calculating record count and total ${measureColumn.name}.`,
          requiredFieldRoles: ["Category or segment", "Numeric measure", "Thresholds to review"],
          sqlPatterns: ["GROUP BY", "COUNT", "SUM", "HAVING", "ORDER BY"],
          dialectSupportNote: "Common aggregate SQL; review threshold values and runtime syntax before running.",
          supportSummary: supportedSummary([categoryColumn.name, measureColumn.name]),
          sql: `SELECT
  ${formatSqlColumn(categoryColumn.name)},
  COUNT(*) AS record_count,
  SUM(${formatSqlColumn(measureColumn.name)}) AS ${metricAlias("total", measureColumn)}
FROM ${context.tableName}
GROUP BY ${formatSqlColumn(categoryColumn.name)}
HAVING COUNT(*) > 1
   AND SUM(${formatSqlColumn(measureColumn.name)}) > 0
ORDER BY ${metricAlias("total", measureColumn)} DESC;`,
          warnings: [
            ...warnings,
            "Review the HAVING thresholds before running; placeholder thresholds are intentionally conservative.",
          ],
          missingRequirements: [],
          dialects: ["duckdb"],
        },
  );

  recipes.push(
    createUnavailableRecipe(
      {
        id: "multi-table-join",
        title: "Multi-table join report",
        businessPurpose: "Combines related tables or workbook sheets when relationships are known.",
        requiredFieldRoles: ["Related tables or workbook sheets", "Known join keys"],
        sqlPatterns: ["JOIN", "COALESCE", "GROUP BY", "ORDER BY"],
        dialectSupportNote: "Placeholder only until related tables and join keys are available.",
        supportSummary: blockedSummary(["related tables or workbook sheets", "known join keys"]),
        dialects: ["duckdb", "mariadb", "oracle", "postgresql"],
      },
      ["related tables or workbook sheets", "known join keys"],
      ["This report needs related tables or workbook sheets with confirmed join keys before FiltraQueri can draft join SQL."],
    ),
  );

  const inventoryMissing = requireFields([
    ["status, vacancy, availability, or inventory field", statusColumn],
    ["category or segment field", segmentColumn],
  ]);
  recipes.push(
    inventoryMissing.length > 0
      ? createUnavailableRecipe(
          {
            id: "vacancy-inventory",
            title: "Vacancy / inventory report",
            businessPurpose: "Summarizes availability or inventory-like status when the schema supports it.",
            requiredFieldRoles: ["Status or availability field", "Category or segment"],
            sqlPatterns: ["CASE WHEN", "UPPER", "CAST", "GROUP BY", "ORDER BY"],
            dialectSupportNote: "Uses CASE, UPPER, and CAST; review text casting before DuckDB execution.",
            supportSummary: blockedSummary(inventoryMissing),
            dialects: ["duckdb"],
          },
          inventoryMissing,
          ["No inventory-style draft was created because the active schema does not show clear status or availability fields."],
        )
      : {
          id: "vacancy-inventory",
          title: "Vacancy / inventory report",
          businessPurpose: `Counts availability-style records by ${segmentColumn.name}.`,
          requiredFieldRoles: ["Status or availability field", "Category or segment"],
          sqlPatterns: ["CASE WHEN", "UPPER", "CAST", "GROUP BY", "ORDER BY"],
          dialectSupportNote: "Uses CASE, UPPER, and CAST; review text casting before DuckDB execution.",
          supportSummary: supportedSummary([segmentColumn.name, statusColumn!.name]),
          sql: `SELECT
  ${formatSqlColumn(segmentColumn.name)},
  COUNT(*) AS total_items,
  SUM(
    CASE
      WHEN UPPER(CAST(${formatSqlColumn(statusColumn!.name)} AS VARCHAR)) IN ('VACANT', 'AVAILABLE', 'EMPTY', 'IN STOCK')
        THEN 1
      ELSE 0
    END
  ) AS available_count
FROM ${context.tableName}
GROUP BY ${formatSqlColumn(segmentColumn.name)}
ORDER BY available_count DESC;`,
          warnings,
          missingRequirements: [],
          dialects: ["duckdb"],
        },
  );

  return recipes;
};
