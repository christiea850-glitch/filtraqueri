import type { DatasetMetadata, SchemaColumn } from "../dataset/datasetTypes";
import type { DataProfileReport } from "../dataIntelligence";
import type {
  WorkflowRecommendation,
  WorkflowRecommendationCategory,
  WorkflowRecommendationReport,
} from "../workflowRecommendations";
import { getWorkbookMetadata } from "../workbook";
import type {
  BusinessKpiSuggestion,
  BusinessKpiSuggestionId,
  BusinessSemanticConfidence,
  BusinessSemanticEntity,
  BusinessSemanticEntityCategory,
  BusinessSemanticReport,
  BusinessSemanticSignal,
} from "./businessSemanticTypes";
import { validateBusinessSemanticReport } from "./businessSemanticValidation";

type BusinessSemanticBuilderInput = {
  dataset: DatasetMetadata | null;
  dataProfile: DataProfileReport | null;
  workflowRecommendationReport?: WorkflowRecommendationReport | null;
};

type EntityRule = {
  category: BusinessSemanticEntityCategory;
  label: string;
  terms: string[];
};

const entityRules: EntityRule[] = [
  { category: "customer", label: "Customer", terms: ["customer", "client", "account", "buyer", "user"] },
  { category: "product", label: "Product", terms: ["product", "sku", "item", "category", "catalog"] },
  { category: "sales", label: "Sales", terms: ["sale", "sales", "order", "sold"] },
  { category: "revenue", label: "Revenue", terms: ["revenue", "income", "sales_amount", "net_sales"] },
  { category: "expense", label: "Expense", terms: ["expense", "cost", "spend", "fee"] },
  { category: "invoice", label: "Invoice", terms: ["invoice", "bill", "billing"] },
  { category: "transaction", label: "Transaction", terms: ["transaction", "txn", "order_id", "receipt"] },
  { category: "employee", label: "Employee", terms: ["employee", "staff", "worker", "rep"] },
  { category: "supplier", label: "Supplier", terms: ["supplier", "vendor", "provider"] },
  { category: "booking", label: "Booking", terms: ["booking", "reservation", "appointment"] },
  { category: "inventory", label: "Inventory", terms: ["inventory", "stock", "warehouse", "on_hand"] },
  { category: "payment", label: "Payment", terms: ["payment", "paid", "payable", "receivable"] },
  { category: "region", label: "Region", terms: ["region", "city", "state", "country", "territory", "location"] },
  { category: "department", label: "Department", terms: ["department", "team", "division", "unit"] },
  { category: "operational_event", label: "Operational event", terms: ["status", "event", "ticket", "incident", "workflow"] },
];

const normalizeName = (value: string) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");

const matchesRule = (value: string, rule: EntityRule) => {
  const normalized = normalizeName(value);
  return rule.terms.some((term) => normalized.includes(term));
};

const confidenceFromSignalCount = (count: number): BusinessSemanticConfidence => {
  if (count >= 3) return "high";
  if (count >= 2) return "moderate";
  return "low";
};

const createSignal = (
  id: string,
  label: string,
  description: string,
  source: BusinessSemanticSignal["source"],
): BusinessSemanticSignal => ({ id, label, description, source });

const uniqueSignals = (signals: BusinessSemanticSignal[]) => {
  const seen = new Set<string>();
  return signals.filter((signal) => {
    if (seen.has(signal.id)) return false;
    seen.add(signal.id);
    return true;
  });
};

const getRelatedWorksheets = (dataset: DatasetMetadata, rule: EntityRule) => {
  const workbookMetadata = getWorkbookMetadata(dataset);
  if (!workbookMetadata) return [];

  return (workbookMetadata.worksheets || [])
    .filter(
      (worksheet) =>
        matchesRule(worksheet.sheetName, rule) ||
        matchesRule(worksheet.displayName, rule) ||
        (worksheet.schema || []).some((column) => matchesRule(column.name, rule)),
    )
    .map((worksheet) => worksheet.displayName || worksheet.sheetName);
};

const buildRuleEntity = (
  dataset: DatasetMetadata,
  rule: EntityRule,
): BusinessSemanticEntity | null => {
  const workbookMetadata = getWorkbookMetadata(dataset);
  const schema = Array.isArray(dataset.schema) ? dataset.schema : [];
  const columnSignals = schema
    .filter((column) => matchesRule(column.name, rule))
    .slice(0, 5)
    .map((column) =>
      createSignal(
        `column:${rule.category}:${column.name}`,
        column.name,
        `${column.name} matches ${rule.label.toLowerCase()} terminology.`,
        "column_name",
      ),
    );
  const worksheetSignals =
    workbookMetadata?.worksheets
      .filter((worksheet) => matchesRule(worksheet.sheetName, rule) || matchesRule(worksheet.displayName, rule))
      .slice(0, 3)
      .map((worksheet) =>
        createSignal(
          `worksheet:${rule.category}:${worksheet.worksheetId}`,
          worksheet.displayName || worksheet.sheetName,
          `Worksheet name matches ${rule.label.toLowerCase()} terminology.`,
          "worksheet_name",
        ),
      ) || [];
  const signals = uniqueSignals([...columnSignals, ...worksheetSignals]);

  if (signals.length === 0) return null;

  return {
    id: `${dataset.dataset_id}:semantic:${rule.category}`,
    category: rule.category,
    label: rule.label,
    confidence: confidenceFromSignalCount(signals.length),
    supportingMetadataSignals: signals,
    relatedWorksheets: getRelatedWorksheets(dataset, rule),
  };
};

const buildProfileEntities = (
  dataset: DatasetMetadata,
  dataProfile: DataProfileReport,
): BusinessSemanticEntity[] => {
  const metricSignals = dataProfile.possibleMetrics.slice(0, 5).map((field) =>
    createSignal(
      `metric:${field.name}`,
      field.name,
      `${field.name} is a possible business metric.`,
      "data_profile",
    ),
  );
  const dimensionSignals = dataProfile.possibleDimensions.slice(0, 5).map((field) =>
    createSignal(
      `dimension:${field.name}`,
      field.name,
      `${field.name} can segment future business analysis.`,
      "data_profile",
    ),
  );
  const dateSignals = dataProfile.dateTimeFields.slice(0, 5).map((field) =>
    createSignal(
      `date:${field.name}`,
      field.name,
      `${field.name} is a date/time field for business period analysis.`,
      "data_profile",
    ),
  );
  const entities: BusinessSemanticEntity[] = [];

  if (metricSignals.length > 0) {
    entities.push({
      id: `${dataset.dataset_id}:semantic:metric_field`,
      category: "metric_field",
      label: "Metric field",
      confidence: confidenceFromSignalCount(metricSignals.length),
      supportingMetadataSignals: metricSignals,
      relatedWorksheets: [],
    });
  }
  if (dimensionSignals.length > 0) {
    entities.push({
      id: `${dataset.dataset_id}:semantic:dimension_field`,
      category: "dimension_field",
      label: "Dimension field",
      confidence: confidenceFromSignalCount(dimensionSignals.length),
      supportingMetadataSignals: dimensionSignals,
      relatedWorksheets: [],
    });
  }
  if (dateSignals.length > 0) {
    entities.push({
      id: `${dataset.dataset_id}:semantic:date_dimension`,
      category: "date_dimension",
      label: "Date dimension",
      confidence: confidenceFromSignalCount(dateSignals.length),
      supportingMetadataSignals: dateSignals,
      relatedWorksheets: [],
    });
  }

  return entities;
};

const entityCategorySet = (entities: BusinessSemanticEntity[]) =>
  new Set(entities.map((entity) => entity.category));

const signalsForCategories = (
  entities: BusinessSemanticEntity[],
  categories: BusinessSemanticEntityCategory[],
) =>
  entities
    .filter((entity) => categories.includes(entity.category))
    .flatMap((entity) => entity.supportingMetadataSignals)
    .slice(0, 6);

const createKpi = (
  id: BusinessKpiSuggestionId,
  label: string,
  requiredSemanticEntities: BusinessSemanticEntityCategory[],
  entities: BusinessSemanticEntity[],
  possibleWorkflowConnections: WorkflowRecommendationCategory[],
): BusinessKpiSuggestion | null => {
  const categories = entityCategorySet(entities);
  const matchedCount = requiredSemanticEntities.filter((category) => categories.has(category)).length;
  if (matchedCount === 0) return null;

  return {
    id,
    label,
    confidence: confidenceFromSignalCount(matchedCount),
    requiredSemanticEntities,
    supportingMetadataSignals: signalsForCategories(entities, requiredSemanticEntities),
    possibleWorkflowConnections,
  };
};

const buildKpiSuggestions = (
  entities: BusinessSemanticEntity[],
): BusinessKpiSuggestion[] =>
  [
    createKpi("total_revenue", "Total revenue", ["revenue", "sales", "metric_field"], entities, [
      "dashboard_reporting",
      "executive_summary",
    ]),
    createKpi(
      "average_transaction_value",
      "Average transaction value",
      ["transaction", "revenue", "metric_field"],
      entities,
      ["dashboard_reporting", "statistical_testing"],
    ),
    createKpi("top_products", "Top products", ["product", "sales", "metric_field"], entities, [
      "product_analysis",
      "dashboard_reporting",
    ]),
    createKpi("customer_growth", "Customer growth", ["customer", "date_dimension"], entities, [
      "customer_segmentation",
      "trend_analysis",
    ]),
    createKpi("regional_performance", "Regional performance", ["region", "metric_field"], entities, [
      "location_analysis",
      "executive_summary",
    ]),
    createKpi(
      "operational_throughput",
      "Operational throughput",
      ["operational_event", "date_dimension", "metric_field"],
      entities,
      ["operational_monitoring", "trend_analysis"],
    ),
    createKpi("inventory_movement", "Inventory movement", ["inventory", "date_dimension"], entities, [
      "operational_monitoring",
      "trend_analysis",
    ]),
  ].filter((kpi): kpi is BusinessKpiSuggestion => Boolean(kpi));

const listWorkflowConnections = (
  workflowRecommendationReport: WorkflowRecommendationReport | null | undefined,
  entities: BusinessSemanticEntity[],
) => {
  const workflowCategories =
    workflowRecommendationReport?.recommendations
      .filter((recommendation: WorkflowRecommendation) => recommendation.confidence !== "low")
      .map((recommendation) => recommendation.category) || [];
  const categories = entityCategorySet(entities);
  const semanticConnections: WorkflowRecommendationCategory[] = [
    ...(categories.has("product") ? ["product_analysis" as const] : []),
    ...(categories.has("customer") ? ["customer_segmentation" as const] : []),
    ...(categories.has("region") ? ["location_analysis" as const] : []),
    ...(categories.has("date_dimension") ? ["trend_analysis" as const] : []),
    ...(categories.has("operational_event") ? ["operational_monitoring" as const] : []),
    ...(categories.has("metric_field") ? ["dashboard_reporting" as const] : []),
  ];

  return Array.from(new Set([...workflowCategories, ...semanticConnections]));
};

const buildHumanSummary = (entities: BusinessSemanticEntity[]) => {
  const categories = entityCategorySet(entities);
  if (categories.has("customer")) return "This appears to contain customer-related business data.";
  if (categories.has("sales") || categories.has("revenue")) {
    return "This workbook may contain sales and revenue information.";
  }
  if (categories.has("transaction") || categories.has("operational_event")) {
    return "Operational transaction patterns were detected.";
  }
  if (categories.has("product")) return "This appears to contain product-related business data.";
  if (categories.has("metric_field")) return "Business metrics are available for future analysis.";
  return "Recognizable business semantics still need review in this metadata.";
};

const buildAnalystSummary = (entities: BusinessSemanticEntity[], kpis: BusinessKpiSuggestion[]) =>
  `${entities.length} semantic entit${entities.length === 1 ? "y" : "ies"} and ${kpis.length} KPI suggestion${kpis.length === 1 ? "" : "s"} detected from metadata.`;

const schemaHasIdPattern = (schema: SchemaColumn[]) =>
  (Array.isArray(schema) ? schema : []).some((column) => normalizeName(column.name) === "id" || normalizeName(column.name).endsWith("_id"));

export const buildBusinessSemanticReport = ({
  dataset,
  dataProfile,
  workflowRecommendationReport,
}: BusinessSemanticBuilderInput): BusinessSemanticReport | null => {
  if (!dataset || !dataProfile) return null;

  const ruleEntities = entityRules
    .map((rule) => buildRuleEntity(dataset, rule))
    .filter((entity): entity is BusinessSemanticEntity => Boolean(entity));
  const profileEntities = buildProfileEntities(dataset, dataProfile);
  const entities = [...ruleEntities, ...profileEntities].sort((left, right) => {
    const confidenceRank = { high: 0, moderate: 1, low: 2 };
    if (confidenceRank[left.confidence] !== confidenceRank[right.confidence]) {
      return confidenceRank[left.confidence] - confidenceRank[right.confidence];
    }
    return left.label.localeCompare(right.label);
  });
  const kpis = buildKpiSuggestions(entities);
  const workflowConnections = listWorkflowConnections(workflowRecommendationReport, entities);
  const relatedWorksheets = Array.from(
    new Set(entities.flatMap((entity) => entity.relatedWorksheets)),
  );
  const initialReport: BusinessSemanticReport = {
    datasetId: dataset.dataset_id,
    humanSummary: buildHumanSummary(entities),
    analystSummary: buildAnalystSummary(entities, kpis),
    detectedSemanticEntities: entities,
    possibleBusinessKpis: kpis,
    possibleWorkflowConnections: workflowConnections,
    recommendedFutureAnalyticsPaths: workflowConnections.slice(0, 5),
    relatedWorksheets,
    safetyNotes: [
      "Business semantics are inferred from metadata only.",
      ...(schemaHasIdPattern(dataset.schema) ? ["ID-like fields may support relationship planning later."] : []),
    ],
  };
  const validation = validateBusinessSemanticReport(initialReport);

  if (validation.messages.length === 0) return initialReport;

  return {
    ...initialReport,
    safetyNotes: Array.from(
      new Set([
        ...initialReport.safetyNotes,
        ...validation.messages.map((message) => message.message),
      ]),
    ),
  };
};
