// K10 — Dataset-Adaptive Report Intelligence Planner.
//
// This module replaces K9's static-five-recipes model with a deterministic
// planner that inspects the uploaded workbook (or CSV) and produces a list of
// `ReportOpportunity` items. Each opportunity describes a business question
// the data could answer, with full metadata about supportability, required
// tables/columns, complexity, method, and an optional SQL draft when enough
// fields are present.
//
// K9's property-management recipes still ship — they are now "compiled
// recipes" the planner forwards when the upload looks like a property book.
// The planner additionally emits generic opportunities (status summary, top
// categories, trend, revenue, completeness, entity activity) that apply to
// any tabular dataset, and domain-specific opportunities (sales / payments /
// HR / support / inventory / marketing) when their signature columns appear.
//
// Safety rules (matches the K10 spec):
//   - No SQL auto-run.
//   - SQL is only attached when columns are clearly detected and quoted.
//   - The planner reads dataset.workbook_metadata.worksheets only; it never
//     mutates dataset state, never repoints the active VIEW, and never calls
//     a backend endpoint.

import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import {
  getDatasetActiveWorksheet,
  getWorkbookMetadata,
  type WorkbookMetadata,
  type WorksheetMetadata,
} from "../../workbook";
import { createMultiWorksheetRecipes } from "./multiWorksheetRecipes";
import { formatRowLimitClause } from "./sqlTemplateLibrary";
import type { SqlReportRecipe } from "./sqlReportRecipes";

// ---------- Public types ----------

export type ReportOpportunityDomain =
  | "property"
  | "sales"
  | "retail"
  | "inventory"
  | "payments"
  | "finance"
  | "hr"
  | "healthcare"
  | "logistics"
  | "education"
  | "support"
  | "marketing"
  | "generic";

export type ReportOpportunityMethod =
  | "sql"
  | "excel"
  | "python"
  | "future_optimization";

export type ReportOpportunityComplexity = "simple" | "intermediate" | "complex";

export type ReportOpportunitySupport = "can_generate_now" | "needs_missing_fields";

export type ReportOpportunity = {
  id: string;
  title: string;
  businessQuestion: string;
  whyItMatters: string;
  domains: ReportOpportunityDomain[];
  /** 0..1 — how confident the planner is that this opportunity fits the upload. */
  confidence: number;
  support: ReportOpportunitySupport;
  method: ReportOpportunityMethod;
  complexity: ReportOpportunityComplexity;
  needsJoins: boolean;
  needsAggregation: boolean;
  needsDateLogic: boolean;
  needsAnomalyDetection: boolean;
  requiredTables: string[];
  optionalTables: string[];
  requiredColumns: string[];
  optionalColumns: string[];
  /** Specific items the planner could not find when support is needs_missing_fields. */
  missingRequirements: string[];
  /** DuckDB SQL draft. Only populated when support === "can_generate_now" AND method === "sql". */
  sql: string | null;
  /** When this opportunity is backed by a K9 compiled recipe, its recipe ID. */
  compiledRecipeId?: string;
};

// ---------- Internal helpers ----------

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const quote = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

const displayName = (
  worksheet: { displayName: string; sheetName: string },
): string => worksheet.displayName || worksheet.sheetName;

// Column-shape detectors. Cheap, name-based, and conservative — these only
// fire when the column name strongly suggests the role. The inferred_type is
// used to validate where it helps (e.g., dates and numerics).

const includesAny = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle));

const isIdColumn = (column: SchemaColumn): boolean => {
  const text = normalize(column.name);
  return (
    /\bid\b/.test(text) ||
    /_id\b/.test(text) ||
    /\bcode\b/.test(text) ||
    /\bnumber\b/.test(text)
  );
};

const isDateColumn = (column: SchemaColumn): boolean => {
  if (column.inferred_type === "date") return true;
  const text = normalize(column.name);
  return includesAny(text, [
    "date",
    "time",
    "_at",
    "timestamp",
    "created",
    "updated",
    "modified",
    "opened",
    "closed",
    "resolved",
    "expires",
    "expiration",
    "due",
    "start",
    "end",
    "scheduled",
    "issued",
    "joined",
  ]);
};

const isAmountColumn = (column: SchemaColumn): boolean => {
  if (column.inferred_type !== "numeric") return false;
  const text = normalize(column.name);
  return includesAny(text, [
    "amount",
    "price",
    "cost",
    "revenue",
    "sales",
    "paid",
    "payment",
    "fee",
    "salary",
    "wage",
    "value",
    "balance",
    "total",
    "income",
    "expense",
    "spend",
    "charge",
    "rent",
    "invoice",
  ]);
};

const isStatusColumn = (column: SchemaColumn): boolean => {
  const text = normalize(column.name);
  return includesAny(text, [
    "status",
    "state",
    "condition",
    "stage",
    "phase",
    "outcome",
    "result",
    "resolution",
  ]);
};

const isCategoryColumn = (column: SchemaColumn): boolean => {
  const text = normalize(column.name);
  return (
    column.inferred_type === "categorical" ||
    includesAny(text, [
      "type",
      "category",
      "class",
      "kind",
      "tier",
      "channel",
      "segment",
      "department",
      "team",
      "region",
      "city",
      "country",
      "branch",
      "store",
      "location",
      "priority",
      "severity",
    ])
  );
};

const isPersonColumn = (column: SchemaColumn): boolean => {
  const text = normalize(column.name);
  return includesAny(text, [
    "customer",
    "client",
    "tenant",
    "user",
    "patient",
    "employee",
    "staff",
    "vendor",
    "contractor",
    "member",
    "student",
    "guest",
    "rider",
    "driver",
    "name",
    "first name",
    "last name",
    "full name",
    "subscriber",
  ]);
};

const isContactColumn = (column: SchemaColumn): boolean => {
  const text = normalize(column.name);
  return includesAny(text, ["email", "phone", "mobile", "contact"]);
};

// "Virtual worksheet" — the minimal slice the planner needs. Workbook uploads
// supply real WorksheetMetadata; CSV / single-table uploads supply a derived
// instance built from the dataset's top-level schema. The planner never
// touches the full WorksheetMetadata shape so we don't have to synthesize
// the entire normalization sub-object for CSV fallback.
type VirtualWorksheet = {
  worksheetId: string;
  sheetName: string;
  displayName: string;
  tableName: string;
  schema: SchemaColumn[];
  rowCount: number;
  columnCount: number;
};

const fromWorkbookWorksheet = (worksheet: WorksheetMetadata): VirtualWorksheet => ({
  worksheetId: worksheet.worksheetId,
  sheetName: worksheet.sheetName,
  displayName: worksheet.displayName || worksheet.sheetName,
  tableName: worksheet.tableName,
  schema: worksheet.schema,
  rowCount: worksheet.rowCount,
  columnCount: worksheet.columnCount,
});

// Per-worksheet column-kind summary.
type WorksheetColumnSummary = {
  worksheet: VirtualWorksheet;
  ids: SchemaColumn[];
  dates: SchemaColumn[];
  amounts: SchemaColumn[];
  statuses: SchemaColumn[];
  categories: SchemaColumn[];
  persons: SchemaColumn[];
  contacts: SchemaColumn[];
};

const summarizeWorksheet = (worksheet: VirtualWorksheet): WorksheetColumnSummary => {
  const columns = worksheet.schema;
  return {
    worksheet,
    ids: columns.filter(isIdColumn),
    dates: columns.filter(isDateColumn),
    amounts: columns.filter(isAmountColumn),
    statuses: columns.filter(isStatusColumn),
    categories: columns.filter(isCategoryColumn),
    persons: columns.filter(isPersonColumn),
    contacts: columns.filter(isContactColumn),
  };
};

// ---------- Domain classifier ----------

type WorkbookSurface = {
  workbook: WorkbookMetadata | null;
  worksheets: VirtualWorksheet[];
  summaries: WorksheetColumnSummary[];
  // For CSV uploads, treat the whole dataset as a single virtual worksheet.
  isWorkbook: boolean;
};

const buildSurface = (dataset: DatasetMetadata | null): WorkbookSurface => {
  const workbook = getWorkbookMetadata(dataset);
  if (workbook && workbook.worksheets.length > 0) {
    const readyWorksheets = workbook.worksheets
      .filter((w) => w.status === "ready")
      .map(fromWorkbookWorksheet);
    return {
      workbook,
      worksheets: readyWorksheets,
      summaries: readyWorksheets.map(summarizeWorksheet),
      isWorkbook: true,
    };
  }
  if (!dataset) {
    return { workbook: null, worksheets: [], summaries: [], isWorkbook: false };
  }
  // CSV / single-table fallback: virtual worksheet derived from the dataset.
  const virtual: VirtualWorksheet = {
    worksheetId: dataset.dataset_id,
    sheetName: dataset.original_filename,
    displayName: dataset.original_filename,
    tableName: dataset.table_name,
    schema: dataset.schema,
    rowCount: dataset.row_count,
    columnCount: dataset.column_count,
  };
  return {
    workbook: null,
    worksheets: [virtual],
    summaries: [summarizeWorksheet(virtual)],
    isWorkbook: false,
  };
};

const worksheetMatchesAny = (
  worksheet: VirtualWorksheet,
  patterns: string[],
): boolean => {
  const text = `${normalize(worksheet.displayName)} ${normalize(worksheet.sheetName)}`;
  return patterns.some((pattern) => text.includes(normalize(pattern)));
};

const findWorksheet = (
  surface: WorkbookSurface,
  patterns: string[],
): VirtualWorksheet | null =>
  surface.worksheets.find((w) => worksheetMatchesAny(w, patterns)) || null;

const detectDomains = (surface: WorkbookSurface): ReportOpportunityDomain[] => {
  const domains: ReportOpportunityDomain[] = [];
  const names = surface.worksheets.map((w) =>
    `${normalize(w.displayName)} ${normalize(w.sheetName)}`,
  );
  const allNames = names.join(" ");

  // Property
  if (
    (allNames.includes("tenant") && allNames.includes("propert")) ||
    (allNames.includes("unit") && allNames.includes("lease")) ||
    (allNames.includes("propert") && allNames.includes("unit"))
  ) {
    domains.push("property");
  }
  // Sales / Retail
  if (allNames.includes("order") && allNames.includes("product")) {
    domains.push("sales");
    domains.push("retail");
  } else if (allNames.includes("sale") || allNames.includes("revenue")) {
    domains.push("sales");
  } else if (allNames.includes("product") && allNames.includes("inventor")) {
    domains.push("retail");
    domains.push("inventory");
  } else if (allNames.includes("product") || allNames.includes("sku")) {
    domains.push("retail");
  }
  // Inventory
  if (allNames.includes("inventor") || allNames.includes("stock")) {
    if (!domains.includes("inventory")) domains.push("inventory");
  }
  // Payments / Finance
  if (
    allNames.includes("payment") ||
    allNames.includes("transaction") ||
    allNames.includes("invoice")
  ) {
    domains.push("payments");
    domains.push("finance");
  }
  // HR
  if (
    allNames.includes("employee") ||
    allNames.includes("staff") ||
    allNames.includes("hire") ||
    allNames.includes("payroll") ||
    allNames.includes("salar")
  ) {
    domains.push("hr");
  }
  // Healthcare
  if (
    allNames.includes("patient") ||
    allNames.includes("appointment") ||
    allNames.includes("diagnos") ||
    allNames.includes("clinic")
  ) {
    domains.push("healthcare");
  }
  // Logistics
  if (
    allNames.includes("shipment") ||
    allNames.includes("deliver") ||
    allNames.includes("route") ||
    allNames.includes("tracking")
  ) {
    domains.push("logistics");
  }
  // Education
  if (
    allNames.includes("student") ||
    allNames.includes("course") ||
    allNames.includes("enroll") ||
    allNames.includes("grade")
  ) {
    domains.push("education");
  }
  // Support
  if (
    allNames.includes("ticket") ||
    allNames.includes("case") ||
    allNames.includes("incident") ||
    allNames.includes("request")
  ) {
    domains.push("support");
  }
  // Marketing
  if (
    allNames.includes("campaign") ||
    allNames.includes("lead") ||
    allNames.includes("conversion")
  ) {
    domains.push("marketing");
  }
  if (domains.length === 0) domains.push("generic");
  return domains;
};

// ---------- Generic opportunity generators ----------

const buildStatusSummary = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  for (const summary of surface.summaries) {
    if (summary.statuses.length === 0) continue;
    const statusColumn = summary.statuses[0];
    const worksheet = summary.worksheet;
    opportunities.push({
      id: `status-summary:${worksheet.worksheetId}`,
      title: `Status summary — ${displayName(worksheet)}`,
      businessQuestion: `How many records sit in each ${statusColumn.name} value?`,
      whyItMatters:
        "A simple count-by-status is the first place leadership looks to find bottlenecks or process drift.",
      domains: ["generic"],
      confidence: 0.8,
      support: "can_generate_now",
      method: "sql",
      complexity: "simple",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: false,
      needsAnomalyDetection: false,
      requiredTables: [displayName(worksheet)],
      optionalTables: [],
      requiredColumns: [statusColumn.name],
      optionalColumns: [],
      missingRequirements: [],
      sql: `SELECT ${quote(statusColumn.name)} AS status,
  COUNT(*) AS record_count
FROM ${quote(worksheet.tableName)}
GROUP BY ${quote(statusColumn.name)}
ORDER BY record_count DESC
${rowLimit};`,
    });
  }
  return opportunities;
};

const buildTopCategories = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  for (const summary of surface.summaries) {
    if (summary.categories.length === 0) continue;
    const categoryColumn = summary.categories[0];
    const amountColumn = summary.amounts[0] || null;
    const worksheet = summary.worksheet;
    if (amountColumn) {
      opportunities.push({
        id: `top-categories-by-amount:${worksheet.worksheetId}`,
        title: `Top ${categoryColumn.name} by ${amountColumn.name} — ${displayName(worksheet)}`,
        businessQuestion: `Which ${categoryColumn.name} values contribute the most ${amountColumn.name}?`,
        whyItMatters:
          "Ranking categories by a measurable value surfaces the 20% driving 80% of the outcome.",
        domains: ["generic"],
        confidence: 0.78,
        support: "can_generate_now",
        method: "sql",
        complexity: "simple",
        needsJoins: false,
        needsAggregation: true,
        needsDateLogic: false,
        needsAnomalyDetection: false,
        requiredTables: [displayName(worksheet)],
        optionalTables: [],
        requiredColumns: [categoryColumn.name, amountColumn.name],
        optionalColumns: [],
        missingRequirements: [],
        sql: `SELECT ${quote(categoryColumn.name)} AS category,
  SUM(${quote(amountColumn.name)}) AS total_value,
  AVG(${quote(amountColumn.name)}) AS avg_value,
  COUNT(*) AS record_count
FROM ${quote(worksheet.tableName)}
GROUP BY ${quote(categoryColumn.name)}
ORDER BY total_value DESC
${rowLimit};`,
      });
    } else {
      opportunities.push({
        id: `top-categories-by-count:${worksheet.worksheetId}`,
        title: `Records by ${categoryColumn.name} — ${displayName(worksheet)}`,
        businessQuestion: `Which ${categoryColumn.name} values appear most frequently?`,
        whyItMatters: "Frequency-by-category is the cheapest signal of where activity concentrates.",
        domains: ["generic"],
        confidence: 0.7,
        support: "can_generate_now",
        method: "sql",
        complexity: "simple",
        needsJoins: false,
        needsAggregation: true,
        needsDateLogic: false,
        needsAnomalyDetection: false,
        requiredTables: [displayName(worksheet)],
        optionalTables: [],
        requiredColumns: [categoryColumn.name],
        optionalColumns: ["a numeric measure column"],
        missingRequirements: [],
        sql: `SELECT ${quote(categoryColumn.name)} AS category,
  COUNT(*) AS record_count
FROM ${quote(worksheet.tableName)}
GROUP BY ${quote(categoryColumn.name)}
ORDER BY record_count DESC
${rowLimit};`,
      });
    }
  }
  return opportunities;
};

const buildTrendOverTime = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  for (const summary of surface.summaries) {
    if (summary.dates.length === 0) continue;
    const dateColumn = summary.dates[0];
    const amountColumn = summary.amounts[0] || null;
    const worksheet = summary.worksheet;
    const measureSelect = amountColumn
      ? `SUM(${quote(amountColumn.name)}) AS total_value,
  AVG(${quote(amountColumn.name)}) AS avg_value,
  `
      : "";
    opportunities.push({
      id: `trend-over-time:${worksheet.worksheetId}`,
      title: `Monthly trend — ${displayName(worksheet)}`,
      businessQuestion: amountColumn
        ? `How does ${amountColumn.name} change month-over-month?`
        : `How does the record count change month-over-month?`,
      whyItMatters:
        "Trend lines reveal seasonality, growth, and step changes that flat tables hide.",
      domains: ["generic"],
      confidence: 0.7,
      support: "can_generate_now",
      method: "sql",
      complexity: "intermediate",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: true,
      needsAnomalyDetection: false,
      requiredTables: [displayName(worksheet)],
      optionalTables: [],
      requiredColumns: [dateColumn.name],
      optionalColumns: amountColumn ? [amountColumn.name] : ["a numeric measure column"],
      missingRequirements: [],
      sql: `SELECT DATE_TRUNC('month', CAST(${quote(dateColumn.name)} AS DATE)) AS month,
  ${measureSelect}COUNT(*) AS record_count
FROM ${quote(worksheet.tableName)}
WHERE ${quote(dateColumn.name)} IS NOT NULL
GROUP BY DATE_TRUNC('month', CAST(${quote(dateColumn.name)} AS DATE))
ORDER BY month
${rowLimit};`,
    });
  }
  return opportunities;
};

const buildCompletenessReport = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  for (const summary of surface.summaries) {
    const worksheet = summary.worksheet;
    if (worksheet.schema.length === 0) continue;
    // Pick up to 8 columns (mostly persons/contacts/ids) where completeness matters.
    const priorityColumns = [
      ...summary.persons,
      ...summary.contacts,
      ...summary.ids,
      ...summary.dates,
    ]
      .filter((col, i, arr) => arr.findIndex((c) => c.name === col.name) === i)
      .slice(0, 8);
    if (priorityColumns.length === 0) continue;
    const expressions = priorityColumns
      .map(
        (col) =>
          `SUM(CASE WHEN ${quote(col.name)} IS NULL OR CAST(${quote(col.name)} AS VARCHAR) = '' THEN 1 ELSE 0 END) AS ${quote(
            `missing_${normalize(col.name).replace(/\s/g, "_")}`,
          )}`,
      )
      .join(",\n  ");
    opportunities.push({
      id: `completeness:${worksheet.worksheetId}`,
      title: `Completeness check — ${displayName(worksheet)}`,
      businessQuestion: "Which key fields have missing or empty values?",
      whyItMatters:
        "Missing IDs, dates, and contact info cause downstream filters and joins to silently drop records.",
      domains: ["generic"],
      confidence: 0.75,
      support: "can_generate_now",
      method: "sql",
      complexity: "simple",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: false,
      needsAnomalyDetection: false,
      requiredTables: [displayName(worksheet)],
      optionalTables: [],
      requiredColumns: priorityColumns.map((c) => c.name),
      optionalColumns: [],
      missingRequirements: [],
      sql: `SELECT COUNT(*) AS total_records,
  ${expressions}
FROM ${quote(worksheet.tableName)}
${rowLimit};`,
    });
  }
  return opportunities;
};

const buildEntityActivity = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  for (const summary of surface.summaries) {
    if (summary.persons.length === 0 || summary.dates.length === 0) continue;
    const personColumn = summary.persons[0];
    const dateColumn = summary.dates[0];
    const worksheet = summary.worksheet;
    opportunities.push({
      id: `entity-activity:${worksheet.worksheetId}`,
      title: `Activity per ${personColumn.name} — ${displayName(worksheet)}`,
      businessQuestion: `How recent and frequent is activity per ${personColumn.name}?`,
      whyItMatters:
        "Identifies dormant or hyperactive entities before they churn or overload an account team.",
      domains: ["generic"],
      confidence: 0.65,
      support: "can_generate_now",
      method: "sql",
      complexity: "intermediate",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: true,
      needsAnomalyDetection: false,
      requiredTables: [displayName(worksheet)],
      optionalTables: [],
      requiredColumns: [personColumn.name, dateColumn.name],
      optionalColumns: [],
      missingRequirements: [],
      sql: `SELECT ${quote(personColumn.name)} AS entity,
  COUNT(*) AS activity_count,
  MIN(${quote(dateColumn.name)}) AS first_seen,
  MAX(${quote(dateColumn.name)}) AS last_seen
FROM ${quote(worksheet.tableName)}
WHERE ${quote(personColumn.name)} IS NOT NULL
GROUP BY ${quote(personColumn.name)}
ORDER BY last_seen DESC
${rowLimit};`,
    });
  }
  return opportunities;
};

const buildRevenueSummary = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  for (const summary of surface.summaries) {
    if (summary.amounts.length === 0) continue;
    const amountColumn = summary.amounts[0];
    const worksheet = summary.worksheet;
    opportunities.push({
      id: `revenue-summary:${worksheet.worksheetId}`,
      title: `${amountColumn.name} summary — ${displayName(worksheet)}`,
      businessQuestion: `What is the total, average, and spread of ${amountColumn.name}?`,
      whyItMatters:
        "A single-line revenue/amount summary is the leadership pulse-check before any deeper analysis.",
      domains: ["generic"],
      confidence: 0.8,
      support: "can_generate_now",
      method: "sql",
      complexity: "simple",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: false,
      needsAnomalyDetection: false,
      requiredTables: [displayName(worksheet)],
      optionalTables: [],
      requiredColumns: [amountColumn.name],
      optionalColumns: [],
      missingRequirements: [],
      sql: `SELECT COUNT(*) AS record_count,
  SUM(${quote(amountColumn.name)}) AS total_value,
  AVG(${quote(amountColumn.name)}) AS avg_value,
  MIN(${quote(amountColumn.name)}) AS min_value,
  MAX(${quote(amountColumn.name)}) AS max_value
FROM ${quote(worksheet.tableName)}
${rowLimit};`,
    });
  }
  return opportunities;
};

// ---------- Domain-specific opportunity generators ----------

const buildSalesOpportunities = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  const orders = findWorksheet(surface, ["order", "sale"]);
  const products = findWorksheet(surface, ["product", "sku", "item"]);
  if (orders && products) {
    const ordersSummary = summarizeWorksheet(orders);
    const productsSummary = summarizeWorksheet(products);
    const productId =
      ordersSummary.ids.find((c) => normalize(c.name).includes("product")) ||
      ordersSummary.ids.find((c) => normalize(c.name).includes("sku")) ||
      null;
    const productKey =
      productsSummary.ids.find((c) => normalize(c.name).includes("product")) ||
      productsSummary.ids.find((c) => normalize(c.name).includes("sku")) ||
      null;
    const productNameColumn =
      products.schema.find((c) => normalize(c.name).includes("name")) || null;
    const amount = ordersSummary.amounts[0] || null;
    const ready = Boolean(productId && productKey && productNameColumn && amount);
    const missing: string[] = [];
    if (!productId) missing.push(`${displayName(orders)}.product_id column`);
    if (!productKey) missing.push(`${displayName(products)}.product_id column`);
    if (!productNameColumn) missing.push(`${displayName(products)} name column`);
    if (!amount) missing.push(`${displayName(orders)} amount column`);
    opportunities.push({
      id: "sales-top-products",
      title: "Top products by revenue",
      businessQuestion: "Which products are driving the most revenue?",
      whyItMatters: "Reveals where to invest inventory, promotion, and pricing attention first.",
      domains: ["sales", "retail"],
      confidence: ready ? 0.85 : 0.5,
      support: ready ? "can_generate_now" : "needs_missing_fields",
      method: "sql",
      complexity: "intermediate",
      needsJoins: true,
      needsAggregation: true,
      needsDateLogic: false,
      needsAnomalyDetection: false,
      requiredTables: [displayName(orders), displayName(products)],
      optionalTables: [],
      requiredColumns: ready
        ? [productId!.name, productKey!.name, productNameColumn!.name, amount!.name]
        : [],
      optionalColumns: [],
      missingRequirements: ready ? [] : missing,
      sql: ready
        ? `SELECT p.${quote(productNameColumn!.name)} AS product,
  SUM(o.${quote(amount!.name)}) AS total_revenue,
  COUNT(*) AS order_count,
  AVG(o.${quote(amount!.name)}) AS avg_order_value
FROM ${quote(orders.tableName)} AS o
JOIN ${quote(products.tableName)} AS p
  ON p.${quote(productKey!.name)} = o.${quote(productId!.name)}
GROUP BY p.${quote(productNameColumn!.name)}
ORDER BY total_revenue DESC
${rowLimit};`
        : null,
    });
  }
  // Repeat customers
  const customers = findWorksheet(surface, ["customer", "client"]);
  const ordersForRepeat = orders || findWorksheet(surface, ["transaction", "invoice"]);
  if (ordersForRepeat) {
    const summary = summarizeWorksheet(ordersForRepeat);
    const customerId =
      summary.ids.find((c) => normalize(c.name).includes("customer")) ||
      summary.ids.find((c) => normalize(c.name).includes("client")) ||
      null;
    const ready = Boolean(customerId);
    const missing: string[] = [];
    if (!customerId) missing.push(`${displayName(ordersForRepeat)}.customer_id column`);
    opportunities.push({
      id: "sales-repeat-customers",
      title: "Repeat customers",
      businessQuestion: "Which customers have placed more than one order, and how many?",
      whyItMatters: "Repeat-rate is a leading indicator of customer satisfaction and LTV.",
      domains: ["sales", "retail"],
      confidence: ready ? 0.8 : 0.5,
      support: ready ? "can_generate_now" : "needs_missing_fields",
      method: "sql",
      complexity: "simple",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: false,
      needsAnomalyDetection: false,
      requiredTables: [displayName(ordersForRepeat)],
      optionalTables: customers ? [displayName(customers)] : [],
      requiredColumns: ready ? [customerId!.name] : [],
      optionalColumns: [],
      missingRequirements: ready ? [] : missing,
      sql: ready
        ? `SELECT ${quote(customerId!.name)} AS customer_id,
  COUNT(*) AS order_count
FROM ${quote(ordersForRepeat.tableName)}
GROUP BY ${quote(customerId!.name)}
HAVING COUNT(*) > 1
ORDER BY order_count DESC
${rowLimit};`
        : null,
    });
  }
  return opportunities;
};

const buildHrOpportunities = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  const employees = findWorksheet(surface, ["employee", "staff", "personnel"]);
  if (!employees) return opportunities;
  const summary = summarizeWorksheet(employees);
  const department =
    employees.schema.find((c) => normalize(c.name).includes("department")) ||
    employees.schema.find((c) => normalize(c.name).includes("team")) ||
    null;
  const salary =
    employees.schema.find((c) => normalize(c.name).includes("salary")) ||
    employees.schema.find((c) => normalize(c.name).includes("wage")) ||
    summary.amounts[0] ||
    null;
  const hireDate =
    employees.schema.find((c) => normalize(c.name).includes("hire")) ||
    summary.dates[0] ||
    null;
  if (department) {
    const ready = true;
    const sql = `SELECT ${quote(department.name)} AS department,
  COUNT(*) AS headcount${salary ? `,\n  AVG(${quote(salary.name)}) AS avg_salary` : ""}
FROM ${quote(employees.tableName)}
GROUP BY ${quote(department.name)}
ORDER BY headcount DESC
${rowLimit};`;
    opportunities.push({
      id: "hr-headcount-by-department",
      title: "Headcount by department",
      businessQuestion: salary
        ? "How is headcount and salary distributed across departments?"
        : "How is headcount distributed across departments?",
      whyItMatters: "Reveals concentration risk and gives finance a baseline for budget allocation.",
      domains: ["hr"],
      confidence: 0.8,
      support: "can_generate_now",
      method: "sql",
      complexity: "simple",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: false,
      needsAnomalyDetection: false,
      requiredTables: [displayName(employees)],
      optionalTables: [],
      requiredColumns: [department.name],
      optionalColumns: salary ? [salary.name] : [],
      missingRequirements: [],
      sql,
    });
    void ready;
  }
  if (hireDate) {
    opportunities.push({
      id: "hr-tenure-distribution",
      title: "Tenure distribution",
      businessQuestion: "How long have employees been at the company on average, and what is the spread?",
      whyItMatters: "Tenure distribution flags retention risk (heavy short-tenure tail) or stagnation (heavy long tail).",
      domains: ["hr"],
      confidence: 0.7,
      support: "can_generate_now",
      method: "sql",
      complexity: "intermediate",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: true,
      needsAnomalyDetection: false,
      requiredTables: [displayName(employees)],
      optionalTables: [],
      requiredColumns: [hireDate.name],
      optionalColumns: [],
      missingRequirements: [],
      sql: `SELECT
  COUNT(*) AS headcount,
  AVG(DATE_DIFF('day', CAST(${quote(hireDate.name)} AS DATE), CURRENT_DATE)) / 365.0 AS avg_tenure_years,
  MIN(DATE_DIFF('day', CAST(${quote(hireDate.name)} AS DATE), CURRENT_DATE)) / 365.0 AS shortest_tenure_years,
  MAX(DATE_DIFF('day', CAST(${quote(hireDate.name)} AS DATE), CURRENT_DATE)) / 365.0 AS longest_tenure_years
FROM ${quote(employees.tableName)}
WHERE ${quote(hireDate.name)} IS NOT NULL
${rowLimit};`,
    });
  }
  return opportunities;
};

const buildSupportOpportunities = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  const tickets = findWorksheet(surface, ["ticket", "case", "incident", "request", "support"]);
  if (!tickets) return opportunities;
  const summary = summarizeWorksheet(tickets);
  const status = summary.statuses[0] || null;
  const priority =
    tickets.schema.find((c) => normalize(c.name).includes("priority")) ||
    tickets.schema.find((c) => normalize(c.name).includes("severity")) ||
    null;
  const openedDate =
    tickets.schema.find((c) => normalize(c.name).includes("opened")) ||
    tickets.schema.find((c) => normalize(c.name).includes("created")) ||
    summary.dates[0] ||
    null;
  const closedDate =
    tickets.schema.find((c) => normalize(c.name).includes("closed")) ||
    tickets.schema.find((c) => normalize(c.name).includes("resolved")) ||
    null;
  if (priority && status) {
    opportunities.push({
      id: "support-tickets-by-priority",
      title: "Tickets by priority and status",
      businessQuestion: "How many tickets are open at each priority level right now?",
      whyItMatters: "Identifies SLA risk and backlog hotspots before they breach.",
      domains: ["support"],
      confidence: 0.8,
      support: "can_generate_now",
      method: "sql",
      complexity: "simple",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: false,
      needsAnomalyDetection: false,
      requiredTables: [displayName(tickets)],
      optionalTables: [],
      requiredColumns: [priority.name, status.name],
      optionalColumns: [],
      missingRequirements: [],
      sql: `SELECT ${quote(priority.name)} AS priority,
  ${quote(status.name)} AS status,
  COUNT(*) AS ticket_count
FROM ${quote(tickets.tableName)}
GROUP BY ${quote(priority.name)}, ${quote(status.name)}
ORDER BY ticket_count DESC
${rowLimit};`,
    });
  }
  if (openedDate && closedDate) {
    opportunities.push({
      id: "support-resolution-time",
      title: "Average resolution time",
      businessQuestion: "On average, how long does it take to close a ticket?",
      whyItMatters: "Resolution-time trend signals whether the team is keeping pace with inflow.",
      domains: ["support"],
      confidence: 0.78,
      support: "can_generate_now",
      method: "sql",
      complexity: "intermediate",
      needsJoins: false,
      needsAggregation: true,
      needsDateLogic: true,
      needsAnomalyDetection: false,
      requiredTables: [displayName(tickets)],
      optionalTables: [],
      requiredColumns: [openedDate.name, closedDate.name],
      optionalColumns: priority ? [priority.name] : [],
      missingRequirements: [],
      sql: `SELECT
  ${priority ? `${quote(priority.name)} AS priority,\n  ` : ""}AVG(DATE_DIFF('hour', CAST(${quote(openedDate.name)} AS TIMESTAMP), CAST(${quote(closedDate.name)} AS TIMESTAMP))) AS avg_resolution_hours,
  COUNT(*) AS closed_tickets
FROM ${quote(tickets.tableName)}
WHERE ${quote(closedDate.name)} IS NOT NULL${priority ? `\nGROUP BY ${quote(priority.name)}` : ""}
ORDER BY avg_resolution_hours DESC
${rowLimit};`,
    });
  }
  return opportunities;
};

const buildPaymentsAnomaly = (
  surface: WorkbookSurface,
  rowLimit: string,
): ReportOpportunity[] => {
  const opportunities: ReportOpportunity[] = [];
  const payments =
    findWorksheet(surface, ["payment", "transaction"]) ||
    surface.summaries.find((s) => s.amounts.length > 0)?.worksheet ||
    null;
  if (!payments) return opportunities;
  const summary = summarizeWorksheet(payments);
  const amount = summary.amounts[0] || null;
  const date = summary.dates[0] || null;
  if (!amount) return opportunities;
  const ready = Boolean(amount && date);
  opportunities.push({
    id: "payments-anomaly-check",
    title: "Unusual payments — amount outliers",
    businessQuestion: "Are there payments that fall well above or below the typical range?",
    whyItMatters: "Outlier amounts are a first-pass flag for entry errors, fraud, or special cases that need review.",
    domains: ["payments", "finance"],
    confidence: ready ? 0.7 : 0.55,
    support: "can_generate_now",
    method: "sql",
    complexity: "complex",
    needsJoins: false,
    needsAggregation: true,
    needsDateLogic: ready,
    needsAnomalyDetection: true,
    requiredTables: [displayName(payments)],
    optionalTables: [],
    requiredColumns: [amount.name],
    optionalColumns: date ? [date.name] : [],
    missingRequirements: [],
    sql: `WITH bounds AS (
  SELECT
    AVG(${quote(amount.name)}) AS mean_value,
    STDDEV_SAMP(${quote(amount.name)}) AS stddev_value
  FROM ${quote(payments.tableName)}
)
SELECT ${date ? `CAST(${quote(date.name)} AS DATE) AS date_recorded,\n  ` : ""}${quote(amount.name)} AS amount,
  ROUND((${quote(amount.name)} - (SELECT mean_value FROM bounds)) / NULLIF((SELECT stddev_value FROM bounds), 0), 2) AS z_score
FROM ${quote(payments.tableName)}
WHERE ABS(${quote(amount.name)} - (SELECT mean_value FROM bounds)) > 2 * (SELECT stddev_value FROM bounds)
ORDER BY z_score DESC
${rowLimit};`,
  });
  return opportunities;
};

// ---------- Compiled-recipe forwarders (K9) ----------

const fromCompiledRecipe = (recipe: SqlReportRecipe): ReportOpportunity => {
  const ready = Boolean(recipe.sql);
  return {
    id: `compiled:${recipe.id}`,
    title: recipe.title,
    businessQuestion: recipe.businessPurpose,
    whyItMatters:
      "Compiled multi-worksheet recipe — joins detected automatically and emitted as DuckDB SQL.",
    domains: ["property"],
    confidence: ready ? 0.9 : 0.55,
    support: ready ? "can_generate_now" : "needs_missing_fields",
    method: "sql",
    complexity: "intermediate",
    needsJoins: true,
    needsAggregation: true,
    needsDateLogic: recipe.id === "lease-expiration-watchlist",
    needsAnomalyDetection: false,
    requiredTables: recipe.worksheetsUsed || [],
    optionalTables: [],
    requiredColumns: recipe.requiredFieldRoles,
    optionalColumns: [],
    missingRequirements: recipe.missingRequirements,
    sql: recipe.sql,
    compiledRecipeId: recipe.id,
  };
};

// ---------- Factory ----------

export const createReportOpportunities = (
  dataset: DatasetMetadata | null,
  selectedDialect: SqlDialectId,
): ReportOpportunity[] => {
  if (!dataset) return [];
  const surface = buildSurface(dataset);
  if (surface.worksheets.length === 0) return [];

  const rowLimit = formatRowLimitClause(selectedDialect, 50);
  const domains = detectDomains(surface);

  const opportunities: ReportOpportunity[] = [];

  // Domain-specific opportunities first — they tend to be the most relevant.
  if (domains.includes("property")) {
    const compiled = createMultiWorksheetRecipes(dataset, selectedDialect);
    opportunities.push(...compiled.map(fromCompiledRecipe));
  }
  if (domains.includes("sales") || domains.includes("retail")) {
    opportunities.push(...buildSalesOpportunities(surface, rowLimit));
  }
  if (domains.includes("hr")) {
    opportunities.push(...buildHrOpportunities(surface, rowLimit));
  }
  if (domains.includes("support")) {
    opportunities.push(...buildSupportOpportunities(surface, rowLimit));
  }
  if (domains.includes("payments") || domains.includes("finance")) {
    opportunities.push(...buildPaymentsAnomaly(surface, rowLimit));
  }

  // Generic generators — always applied, give every dataset at least a
  // baseline of report ideas regardless of domain.
  opportunities.push(...buildStatusSummary(surface, rowLimit));
  opportunities.push(...buildTopCategories(surface, rowLimit));
  opportunities.push(...buildTrendOverTime(surface, rowLimit));
  opportunities.push(...buildRevenueSummary(surface, rowLimit));
  opportunities.push(...buildCompletenessReport(surface, rowLimit));
  opportunities.push(...buildEntityActivity(surface, rowLimit));

  // Dialect warning prefix when the user is targeting a non-DuckDB dialect.
  if (selectedDialect !== "duckdb") {
    return opportunities.map((opportunity) => ({
      ...opportunity,
      sql: opportunity.sql
        ? `-- Drafted for DuckDB. Review and adjust for ${selectedDialect} syntax.\n${opportunity.sql}`
        : opportunity.sql,
    }));
  }
  return opportunities;
};

// Exposed for diagnostics / SQL Context surfaces that want to inspect the
// detection without recomputing the full opportunity list.
export const detectReportDomains = (
  dataset: DatasetMetadata | null,
): ReportOpportunityDomain[] => {
  if (!dataset) return [];
  return detectDomains(buildSurface(dataset));
};

// Exposed so future LLM-fallback layers can read the same column-shape
// summary the deterministic planner is using.
export const summarizeReportInputs = (dataset: DatasetMetadata | null) => {
  const surface = buildSurface(dataset);
  return {
    isWorkbook: surface.isWorkbook,
    activeWorksheet: getDatasetActiveWorksheet(dataset),
    worksheetCount: surface.worksheets.length,
    columnSummaries: surface.summaries.map((summary) => ({
      worksheetName: displayName(summary.worksheet),
      ids: summary.ids.map((c) => c.name),
      dates: summary.dates.map((c) => c.name),
      amounts: summary.amounts.map((c) => c.name),
      statuses: summary.statuses.map((c) => c.name),
      categories: summary.categories.map((c) => c.name),
      persons: summary.persons.map((c) => c.name),
      contacts: summary.contacts.map((c) => c.name),
    })),
  };
};
