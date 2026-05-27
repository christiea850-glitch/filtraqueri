import { useMemo, useState } from "react";
import type { DatasetMetadata, SchemaColumn } from "../../features/dataset/datasetTypes";
import { buildControlledLogicDraft } from "../../features/questionWorkspace/questionLogicDraftBuilder";
import { buildGovernedQueryBuilderRequestDraft } from "../../features/questionWorkspace/questionQueryBuilderRequestBuilder";
import { createSchemaAwareDraftPlan } from "../../features/questionWorkspace/schemaQuestionTranslator";
import type { FilterDefinition } from "../../features/filters/filterTypes";
import {
  formatDisplayLabel,
  formatMetricDisplayLabel,
} from "../../features/displayLabels/displayLabelFormatter";
import type { GovernedQueryBuilderRequestDraft } from "../../features/questionWorkspace/questionQueryBuilderRequestTypes";
import type {
  CandidateFieldMatch,
  SchemaAwareQuestionDraftPlan,
} from "../../features/questionWorkspace/questionTranslatorTypes";

type QuestionDraftStatus = "idle" | "drafted";

type WorkspaceQuestionDraft = {
  rawQuestion: string;
  draftStatus: QuestionDraftStatus;
  activeDatasetId: string | null;
  activeWorksheetName: string | null;
  createdAt: string | null;
};

type QuestionWorkspacePanelProps = {
  dataset: DatasetMetadata;
  sourceName: string;
  onApplyQueryBuilderRequestDraft?: (draft: GovernedQueryBuilderRequestDraft) => void;
};

type PlanningSelectionRole = "dimension" | "measure" | "date";

type QuestionReviewHints = {
  possibleFocus: string;
  possibleAnalysisType: string;
  possibleDimensions: string[];
  possibleMeasures: string[];
  detectedIntents: string[];
  confidence: "high" | "medium" | "low";
  detectedEntities: string[];
  potentialStrategies: string[];
  plannedOutputs: string[];
  starterSuggestions: string[];
};

const fallbackStarterPrompts = [
  "Which category appears most often?",
  "What are the highest values in this dataset?",
  "Compare records by a selected field.",
];

const domainSignalTerms = {
  music: [
    "track",
    "song",
    "artist",
    "streams",
    "playlist",
    "chart",
    "release",
    "year",
    "danceability",
    "energy",
    "valence",
    "tempo",
    "acousticness",
    "spotify",
    "apple",
    "deezer",
    "shazam",
  ],
  cattle: [
    "cattle",
    "cow",
    "livestock",
    "breed",
    "milk",
    "feed",
    "parity",
    "lactation",
    "vaccine",
    "climate",
    "body temperature",
  ],
  health: [
    "risk",
    "disease",
    "diagnosis",
    "health",
    "vaccine",
    "temperature",
    "symptom",
    "infection",
    "mortality",
  ],
  sales: ["revenue", "sales", "order", "product", "customer", "region", "segment", "performance"],
  operations: ["department", "equipment", "shift", "activity", "machine", "operator", "facility"],
  telco: ["churn", "tenure", "contract", "monthly charge", "service", "internet", "phone", "customer"],
};

const priorityCategoryTerms = [
  "artist",
  "product",
  "category",
  "region",
  "country",
  "breed",
  "contract",
  "department",
  "service",
  "segment",
  "management",
  "climate",
  "shift",
  "status",
];

const priorityMeasureTerms = [
  "streams",
  "revenue",
  "sales",
  "profit",
  "charge",
  "charges",
  "yield",
  "temperature",
  "risk",
  "score",
  "tenure",
  "quantity",
  "price",
  "cost",
  "usage",
  "activity",
];

const formatColumnLabel = (columnName: string) =>
  columnName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const formatQuestionDisplayLabel = (columnName: string) => {
  const displayLabel = formatDisplayLabel(columnName);
  return displayLabel === displayLabel.toUpperCase()
    ? displayLabel
    : displayLabel.charAt(0).toLowerCase() + displayLabel.slice(1);
};

const getSchemaSearchText = (dataset: DatasetMetadata) =>
  [
    dataset.original_filename,
    dataset.filename,
    dataset.table_name,
    ...dataset.schema.map((column) => column.name),
  ]
    .join(" ")
    .toLowerCase()
    .replace(/[_-]+/g, " ");

const hasSignal = (searchText: string, terms: string[]) =>
  terms.some((term) => searchText.includes(term));

const columnMatches = (column: SchemaColumn, terms: string[]) => {
  const label = formatColumnLabel(column.name);
  return terms.some((term) => label.includes(term));
};

const findColumnByTerms = (columns: SchemaColumn[], terms: string[]) =>
  columns.find((column) => columnMatches(column, terms)) || null;

const getColumnsByInferredType = (
  dataset: DatasetMetadata,
  types: SchemaColumn["inferred_type"][],
) => dataset.schema.filter((column) => types.includes(column.inferred_type));

const isLikelyIdentifier = (column: SchemaColumn, rowCount: number) => {
  const label = formatColumnLabel(column.name);
  const identifierName =
    /\bid\b/.test(label) ||
    label.endsWith(" code") ||
    label.endsWith(" number") ||
    label.includes("identifier");

  if (identifierName) return true;

  return (
    (column.inferred_type === "text" || column.inferred_type === "categorical") &&
    rowCount > 0 &&
    column.unique_count >= Math.max(rowCount * 0.9, rowCount - 1)
  );
};

const getCategoricalColumns = (dataset: DatasetMetadata) =>
  dataset.schema.filter(
    (column) =>
      (column.inferred_type === "categorical" ||
        column.inferred_type === "text" ||
        column.inferred_type === "boolean") &&
      !isLikelyIdentifier(column, dataset.row_count),
  );

const getNumericColumns = (dataset: DatasetMetadata) =>
  dataset.schema.filter(
    (column) => column.inferred_type === "numeric" && !isLikelyIdentifier(column, dataset.row_count),
  );

const findAnyColumnByTerms = (dataset: DatasetMetadata, terms: string[]) =>
  findColumnByTerms(dataset.schema, terms);

const findBestCategoryColumn = (columns: SchemaColumn[]) =>
  findColumnByTerms(columns, priorityCategoryTerms) || columns[0] || null;

const findBestMeasureColumn = (columns: SchemaColumn[]) =>
  findColumnByTerms(columns, priorityMeasureTerms) || columns[0] || null;

const addSuggestion = (suggestions: string[], suggestion: string) => {
  if (!suggestions.includes(suggestion)) suggestions.push(suggestion);
};

const createDatasetAwareStarterPrompts = (dataset: DatasetMetadata) => {
  const suggestions: string[] = [];
  const searchText = getSchemaSearchText(dataset);
  const categoricalColumns = getCategoricalColumns(dataset);
  const allTextLikeColumns = getColumnsByInferredType(dataset, ["categorical", "text", "boolean"]);
  const numericColumns = getNumericColumns(dataset);
  const dateColumns = dataset.schema.filter((column) => column.inferred_type === "date");
  const firstCategory = findBestCategoryColumn(categoricalColumns);
  const firstNumeric = findBestMeasureColumn(numericColumns);
  const firstMeasureLabel = firstNumeric ? formatQuestionDisplayLabel(firstNumeric.name) : "record count";
  const hasMusicSignal = hasSignal(searchText, domainSignalTerms.music);
  const hasCattleSignal = hasSignal(searchText, domainSignalTerms.cattle);
  const hasHealthSignal = hasSignal(searchText, domainSignalTerms.health);
  const hasSalesSignal = hasSignal(searchText, domainSignalTerms.sales);
  const hasOperationsSignal = hasSignal(searchText, domainSignalTerms.operations);
  const hasTelcoSignal = hasSignal(searchText, domainSignalTerms.telco);

  if (hasMusicSignal) {
    const artistField = findColumnByTerms(categoricalColumns, ["artist"]);
    const trackField = findAnyColumnByTerms(dataset, ["track", "song"]);
    const streamsField = findColumnByTerms(numericColumns, ["streams", "stream"]);
    const releaseYearField = findAnyColumnByTerms(dataset, ["release year", "released year", "year"]);
    const playlistOrChartField = findColumnByTerms(categoricalColumns, [
      "playlist",
      "chart",
      "spotify",
      "apple",
      "deezer",
      "shazam",
    ]);
    const characteristicField = findColumnByTerms(numericColumns, [
      "danceability",
      "energy",
      "valence",
      "tempo",
      "acousticness",
      "instrumentalness",
      "liveness",
      "speechiness",
    ]);

    if (artistField && streamsField) {
      addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(artistField.name)} has the highest total ${formatQuestionDisplayLabel(streamsField.name)}?`);
    }
    if (trackField && streamsField) {
      addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(trackField.name)} has the highest ${formatQuestionDisplayLabel(streamsField.name)}?`);
    }
    if (releaseYearField && streamsField) {
      addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(releaseYearField.name)} has the strongest streaming performance?`);
    }
    if (streamsField) addSuggestion(suggestions, "Which songs appear unusually popular?");
    if (playlistOrChartField && streamsField) {
      addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(playlistOrChartField.name)} is linked to higher ${formatQuestionDisplayLabel(streamsField.name)}?`);
    }
    if (characteristicField && streamsField) {
      addSuggestion(suggestions, `Which track characteristics are linked to higher ${formatQuestionDisplayLabel(streamsField.name)}?`);
    }
  }

  if (hasCattleSignal) {
    const breedField = findColumnByTerms(categoricalColumns, ["breed"]);
    const countryField = findColumnByTerms(categoricalColumns, ["country", "region"]);
    const managementField = findColumnByTerms(categoricalColumns, ["management system", "management"]);
    const climateField = findColumnByTerms(categoricalColumns, ["climate zone", "climate"]);
    const milkYieldField = findColumnByTerms(numericColumns, ["milk yield", "milk", "yield"]);
    const bodyTemperatureField = findColumnByTerms(numericColumns, ["body temperature", "temperature", "temp"]);
    const diseaseRiskField = findColumnByTerms([...numericColumns, ...categoricalColumns], ["disease risk", "risk"]);

    if (breedField) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(breedField.name)} appears most often?`);
    if (countryField) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(countryField.name)} has the most cattle records?`);
    if (managementField && milkYieldField) {
      addSuggestion(
        suggestions,
        `Which ${formatQuestionDisplayLabel(managementField.name)} has the highest average ${formatQuestionDisplayLabel(milkYieldField.name)}?`,
      );
    }
    if (climateField && bodyTemperatureField) {
      addSuggestion(
        suggestions,
        `Which ${formatQuestionDisplayLabel(climateField.name)} has the highest average ${formatQuestionDisplayLabel(bodyTemperatureField.name)}?`,
      );
    }
    if (breedField && diseaseRiskField) {
      addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(breedField.name)} shows higher disease-risk indicators?`);
    }
  }

  if (hasHealthSignal) {
    const healthCategory = findColumnByTerms(categoricalColumns, [
      "risk",
      "disease",
      "diagnosis",
      "health",
      "symptom",
      "infection",
      "mortality",
    ]);
    const healthMeasure = findColumnByTerms(numericColumns, [
      "risk",
      "temperature",
      "mortality",
      "infection",
      "severity",
      "score",
    ]);
    const groupField =
      findColumnByTerms(categoricalColumns, ["breed", "country", "region", "contract", "service", "group"]) ||
      firstCategory;

    if (healthCategory) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(healthCategory.name)} is most common?`);
    if (groupField && healthMeasure) {
      addSuggestion(
        suggestions,
        `Which ${formatQuestionDisplayLabel(groupField.name)} has the highest average ${formatQuestionDisplayLabel(healthMeasure.name)}?`,
      );
    }
    if (groupField) addSuggestion(suggestions, `Which groups show unusual health patterns?`);
  }

  if (hasTelcoSignal) {
    const churnField = findColumnByTerms(categoricalColumns, ["churn"]);
    const contractField = findColumnByTerms(categoricalColumns, ["contract"]);
    const serviceField = findColumnByTerms(categoricalColumns, ["service", "internet", "phone"]);
    const tenureField = findColumnByTerms(numericColumns, ["tenure"]);
    const monthlyChargeField = findColumnByTerms(numericColumns, ["monthly charge", "monthly", "charge"]);
    const customerGroupField =
      findColumnByTerms(categoricalColumns, ["contract", "internet service", "payment method", "service", "gender"]) ||
      firstCategory;
    const paymentField = findColumnByTerms(categoricalColumns, ["payment method", "payment"]);

    if (churnField && customerGroupField) addSuggestion(suggestions, `Which customer groups have the highest ${formatQuestionDisplayLabel(churnField.name)}?`);
    if (tenureField && churnField) addSuggestion(suggestions, `How does ${formatQuestionDisplayLabel(tenureField.name)} relate to ${formatQuestionDisplayLabel(churnField.name)}?`);
    if (contractField && monthlyChargeField) {
      addSuggestion(
        suggestions,
        `Which ${formatQuestionDisplayLabel(contractField.name)} has the highest average ${formatQuestionDisplayLabel(monthlyChargeField.name)}?`,
      );
    }
    if (serviceField && churnField) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(serviceField.name)} is linked to higher ${formatQuestionDisplayLabel(churnField.name)}?`);
    if (paymentField && churnField) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(paymentField.name)} has the most churned customers?`);
    if (contractField && tenureField) {
      addSuggestion(
        suggestions,
        `Which ${formatQuestionDisplayLabel(contractField.name)} has the highest average ${formatQuestionDisplayLabel(tenureField.name)}?`,
      );
    }
  }

  if (hasSalesSignal) {
    const productField = findColumnByTerms(categoricalColumns, ["product"]);
    const customerField = findColumnByTerms(categoricalColumns, ["customer", "segment"]);
    const regionField = findColumnByTerms(categoricalColumns, ["region", "country", "market"]);
    const revenueField = findColumnByTerms(numericColumns, ["revenue", "sales", "amount", "profit"]);

    if (productField && revenueField) {
      addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(productField.name)} generates the most ${formatQuestionDisplayLabel(revenueField.name)}?`);
    }
    if (customerField) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(customerField.name)} performs best?`);
    if (regionField && revenueField) {
      addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(regionField.name)} has the highest ${formatQuestionDisplayLabel(revenueField.name)}?`);
    }
    if (productField) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(productField.name)} has declining performance?`);
  }

  if (hasOperationsSignal) {
    const departmentField = findColumnByTerms(categoricalColumns, ["department"]);
    const equipmentField = findColumnByTerms(categoricalColumns, ["equipment", "machine"]);
    const shiftField = findColumnByTerms(categoricalColumns, ["shift"]);

    if (departmentField) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(departmentField.name)} has the highest activity?`);
    if (equipmentField) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(equipmentField.name)} appears most often?`);
    if (shiftField) addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(shiftField.name)} has the most records?`);
  }

  if (firstCategory && suggestions.length < 3) {
    addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(firstCategory.name)} appears most often?`);
    addSuggestion(suggestions, `Compare records by ${formatQuestionDisplayLabel(firstCategory.name)}.`);
  }

  if (firstNumeric && suggestions.length < 4) addSuggestion(suggestions, `What is the average ${firstMeasureLabel}?`);

  if (firstCategory && firstNumeric) {
    addSuggestion(
      suggestions,
      `Which ${formatQuestionDisplayLabel(firstCategory.name)} has the highest average ${firstMeasureLabel}?`,
    );
  }

  if (dateColumns.length > 0) {
    addSuggestion(suggestions, `How does ${firstMeasureLabel} change over time?`);
    addSuggestion(suggestions, "What changed most recently?");
  }

  if (suggestions.length === 0 && allTextLikeColumns.length > 0) {
    const fallbackCategory = findBestCategoryColumn(allTextLikeColumns);
    if (fallbackCategory) {
      addSuggestion(suggestions, `Which ${formatQuestionDisplayLabel(fallbackCategory.name)} appears most often?`);
      addSuggestion(suggestions, `Compare records by ${formatQuestionDisplayLabel(fallbackCategory.name)}.`);
    }
  }

  return (suggestions.length > 0 ? suggestions : fallbackStarterPrompts).slice(0, 5);
};

const measureTerms = [
  "revenue",
  "sales",
  "amount",
  "payment",
  "cost",
  "profit",
  "margin",
  "properties",
  "customers",
  "orders",
  "count",
  "total",
];

const groupingTerms = [
  "realtor",
  "manager",
  "customer",
  "location",
  "region",
  "property",
  "product",
  "category",
  "team",
  "department",
  "source",
];

const timeTerms = ["recent", "recently", "change", "changed", "trend", "monthly", "weekly", "year", "date", "time"];
const comparisonTerms = ["compare", "versus", "vs", "by", "between", "best", "worst", "underperforming"];
const rankingTerms = ["most", "least", "top", "bottom", "best", "worst", "highest", "lowest"];
const trendTerms = ["trend", "changed", "change", "over time", "monthly", "weekly", "recently"];
const distributionTerms = ["distribution", "spread", "range", "mix", "share", "breakdown"];
const aggregationTerms = ["total", "sum", "average", "avg", "count", "how many", "how much"];
const anomalyTerms = ["unusual", "outlier", "anomaly", "unexpected", "spike", "drop", "underperforming"];
const segmentationTerms = ["segment", "cohort", "group", "type", "category", "department"];
const businessEntityTerms = [
  "realtor",
  "customer",
  "property",
  "department",
  "product",
  "supplier",
  "manager",
  "tenant",
  "employee",
  "location",
];

const createInitialDraft = (): WorkspaceQuestionDraft => ({
  rawQuestion: "",
  draftStatus: "idle",
  activeDatasetId: null,
  activeWorksheetName: null,
  createdAt: null,
});

const findMatchingTerms = (question: string, terms: string[]) => {
  const normalizedQuestion = question.toLowerCase();
  return terms.filter((term) => normalizedQuestion.includes(term));
};

const createQuestionReviewHints = (question: string): QuestionReviewHints => {
  const normalizedQuestion = question.toLowerCase();
  const measures = findMatchingTerms(normalizedQuestion, measureTerms);
  const dimensions = findMatchingTerms(normalizedQuestion, groupingTerms);
  const detectedEntities = findMatchingTerms(normalizedQuestion, businessEntityTerms);
  const hasTimeIntent = findMatchingTerms(normalizedQuestion, timeTerms).length > 0;
  const hasComparisonIntent = findMatchingTerms(normalizedQuestion, comparisonTerms).length > 0;
  const hasRankingIntent = findMatchingTerms(normalizedQuestion, rankingTerms).length > 0;
  const hasTrendIntent = findMatchingTerms(normalizedQuestion, trendTerms).length > 0;
  const hasDistributionIntent = findMatchingTerms(normalizedQuestion, distributionTerms).length > 0;
  const hasAggregationIntent = findMatchingTerms(normalizedQuestion, aggregationTerms).length > 0;
  const hasAnomalyIntent = findMatchingTerms(normalizedQuestion, anomalyTerms).length > 0;
  const hasSegmentationIntent = findMatchingTerms(normalizedQuestion, segmentationTerms).length > 0;
  const detectedIntents = [
    hasRankingIntent ? "ranking" : "",
    hasComparisonIntent ? "comparison" : "",
    hasTrendIntent || hasTimeIntent ? "time review" : "",
    hasTrendIntent ? "trend" : "",
    hasDistributionIntent ? "distribution" : "",
    hasAggregationIntent ? "aggregation" : "",
    hasAnomalyIntent ? "anomaly review" : "",
    hasSegmentationIntent ? "segmentation" : "",
  ].filter(Boolean);
  const possibleAnalysisType = hasTrendIntent || hasTimeIntent
    ? "Change over time"
    : hasRankingIntent
      ? "Ranked comparison"
      : hasComparisonIntent
        ? "Group comparison"
        : "Exploratory review";
  const possibleFocus = dimensions[0] || measures[0] || detectedIntents[0] || "business question";
  const starterSuggestions = [
    dimensions[0] ? `Compare by ${dimensions[0]}` : "",
    hasRankingIntent || normalizedQuestion.includes("perform") ? "Review top performers" : "",
    hasTrendIntent || hasTimeIntent ? "Analyze changes over time" : "",
    measures[0] ? `Review ${measures[0]} movement` : "",
  ].filter(Boolean);
  const confidenceScore = [
    detectedIntents.length > 0,
    detectedEntities.length > 0 || dimensions.length > 0,
    measures.length > 0,
    question.trim().split(/\s+/).length >= 4,
  ].filter(Boolean).length;
  const confidence = confidenceScore >= 3 ? "high" : confidenceScore === 2 ? "medium" : "low";
  const potentialStrategies = [
    dimensions.length > 0 || detectedEntities.length > 0 ? "Group entities" : "",
    measures.length > 0 || hasAggregationIntent ? "Compare totals" : "",
    hasTrendIntent || hasTimeIntent ? "Review changes over time" : "",
    hasRankingIntent ? "Rank highest performers" : "",
    hasAnomalyIntent ? "Detect unusual values" : "",
  ].filter(Boolean);
  const plannedOutputs = [
    "Table",
    hasAggregationIntent || measures.length > 0 ? "KPI card" : "",
    hasTrendIntent || hasTimeIntent ? "Trend chart" : "",
    hasRankingIntent ? "Ranking list" : "",
    hasDistributionIntent ? "Distribution view" : "",
  ].filter(Boolean);

  return {
    possibleFocus,
    possibleAnalysisType,
    possibleDimensions: dimensions.length > 0 ? Array.from(new Set(dimensions)) : ["Not identified yet"],
    possibleMeasures: measures.length > 0 ? Array.from(new Set(measures)) : ["Not identified yet"],
    detectedIntents: detectedIntents.length > 0 ? detectedIntents : ["question review"],
    confidence,
    detectedEntities: detectedEntities.length > 0
      ? Array.from(new Set(detectedEntities))
      : ["Not identified yet"],
    potentialStrategies: potentialStrategies.length > 0
      ? Array.from(new Set(potentialStrategies))
      : ["Clarify business focus"],
    plannedOutputs: plannedOutputs.length > 0 ? Array.from(new Set(plannedOutputs)) : ["Table"],
    starterSuggestions: Array.from(new Set(starterSuggestions)).slice(0, 4),
  };
};

const formatPlanLabel = (value: string) => value.replace(/_/g, " ");

const formatNullablePlanValue = (value: string | number | null) =>
  value === null ? "null" : String(value);

const formatDisplayRequestList = (items: string[]) =>
  items.length > 0 ? items.map(formatDisplayLabel).join(", ") : "None";

const formatRequestAggregation = (aggregation: { function: string; column: string | null }) => {
  const normalizedFunction = aggregation.function.toLowerCase();
  if (!aggregation.column) return normalizedFunction === "count" ? "Records" : `${aggregation.function} records`;

  const columnLabel = formatDisplayLabel(aggregation.column).toLowerCase();
  if (normalizedFunction === "sum") return `Total ${columnLabel}`;
  if (normalizedFunction === "avg" || normalizedFunction === "average") return `Average ${columnLabel}`;
  if (normalizedFunction === "count") return `Count of ${columnLabel}`;

  return `${aggregation.function} ${formatMetricDisplayLabel(aggregation.column)}`;
};

const formatRequestFilter = (filter: FilterDefinition) => {
  const displayColumn = formatDisplayLabel(filter.column);
  if (filter.values && filter.values.length > 0) return `${displayColumn}: ${filter.values.join(", ")}`;
  if (filter.value !== undefined && filter.value !== null) return `${displayColumn}: ${String(filter.value)}`;
  if (filter.min !== undefined || filter.max !== undefined) {
    return `${displayColumn}: ${formatNullablePlanValue(filter.min ?? null)} to ${formatNullablePlanValue(filter.max ?? null)}`;
  }
  if (filter.start || filter.end) {
    return `${displayColumn}: ${filter.start || "start"} to ${filter.end || "end"}`;
  }
  return `${displayColumn}: reviewed filter`;
};

function QuestionWorkspacePanel({
  dataset,
  sourceName,
  onApplyQueryBuilderRequestDraft,
}: QuestionWorkspacePanelProps) {
  const [rawQuestion, setRawQuestion] = useState("");
  const [draft, setDraft] = useState<WorkspaceQuestionDraft>(createInitialDraft);
  const [schemaDraftPlan, setSchemaDraftPlan] = useState<SchemaAwareQuestionDraftPlan | null>(null);
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);
  const [selectedMeasure, setSelectedMeasure] = useState<string | null>(null);
  const [selectedDateField, setSelectedDateField] = useState<string | null>(null);

  const datasetContext = useMemo(
    () => [
      { label: "Dataset", value: dataset.original_filename },
      { label: "Source", value: sourceName || dataset.table_name },
      { label: "Fields", value: dataset.column_count.toLocaleString() },
      { label: "Rows", value: dataset.row_count.toLocaleString() },
    ],
    [dataset.column_count, dataset.original_filename, dataset.row_count, dataset.table_name, sourceName],
  );
  const starterPrompts = useMemo(
    () => createDatasetAwareStarterPrompts(dataset),
    [dataset],
  );

  const activeReviewQuestion = draft.draftStatus === "drafted" ? draft.rawQuestion : rawQuestion;
  const reviewHints = useMemo(
    () => createQuestionReviewHints(activeReviewQuestion),
    [activeReviewQuestion],
  );
  const formatCandidateFields = (candidates: CandidateFieldMatch[]) =>
    candidates.length > 0
      ? candidates
          .slice(0, 4)
          .map((candidate) => `${formatDisplayLabel(candidate.columnName)} (${candidate.confidence})`)
          .join(", ")
      : "Not identified yet";

  const hasSchemaCandidates = Boolean(
    schemaDraftPlan &&
      (
        schemaDraftPlan.candidateDimensions.length > 0 ||
        schemaDraftPlan.candidateMeasures.length > 0 ||
        schemaDraftPlan.candidateDateFields.length > 0
      ),
  );
  const requiredPlanningSelections = schemaDraftPlan
    ? [
        schemaDraftPlan.candidateDimensions.length > 0 ? selectedDimension : "not-needed",
        schemaDraftPlan.candidateMeasures.length > 0 ? selectedMeasure : "not-needed",
        schemaDraftPlan.candidateDateFields.length > 0 &&
        ["trend", "timeline_review"].includes(schemaDraftPlan.detectedIntent)
          ? selectedDateField
          : "not-needed",
      ]
    : [];
  const needsClarification = Boolean(
    schemaDraftPlan &&
      (
        schemaDraftPlan.missingRequirements.length > 0 ||
        requiredPlanningSelections.some((selection) => selection === null)
      ),
  );
  const planningClarityStatus = needsClarification
    ? "Needs clarification"
    : "Ready for future logic generation";

  const updatePlanningSelection = (role: PlanningSelectionRole, columnName: string) => {
    if (role === "dimension") setSelectedDimension(columnName);
    if (role === "measure") setSelectedMeasure(columnName);
    if (role === "date") setSelectedDateField(columnName);
  };

  const renderCandidateChoice = (
    candidate: CandidateFieldMatch,
    role: PlanningSelectionRole,
    selectedColumn: string | null,
  ) => (
    <button
      type="button"
      key={`${role}-${candidate.columnName}`}
      className={selectedColumn === candidate.columnName ? "is-selected" : ""}
      onClick={() => updatePlanningSelection(role, candidate.columnName)}
      title={candidate.columnName}
    >
      <strong>{formatDisplayLabel(candidate.columnName)}</strong>
      <span>{candidate.confidence} confidence</span>
      <small>{candidate.matchReason.replace(/_/g, " ")}</small>
    </button>
  );

  const controlledLogicDraft = useMemo(() => {
    if (!schemaDraftPlan || draft.draftStatus !== "drafted") return null;

    return buildControlledLogicDraft({
      draftPlan: schemaDraftPlan,
      schema: dataset.schema,
      selectedFields: {
        dimension: selectedDimension,
        measure: selectedMeasure,
        dateField: selectedDateField,
      },
    });
  }, [
    dataset.schema,
    draft.draftStatus,
    schemaDraftPlan,
    selectedDateField,
    selectedDimension,
    selectedMeasure,
  ]);

  const governedQueryBuilderRequestDraft = useMemo(() => {
    if (!controlledLogicDraft) return null;

    return buildGovernedQueryBuilderRequestDraft(controlledLogicDraft, dataset.schema);
  }, [controlledLogicDraft, dataset.schema]);
  const governedRequestHasFilters =
    (governedQueryBuilderRequestDraft?.request?.filters.length || 0) > 0;
  const canApplyGovernedRequest =
    governedQueryBuilderRequestDraft?.status === "created_for_review" &&
    Boolean(governedQueryBuilderRequestDraft.request) &&
    !governedRequestHasFilters;

  const prepareDraft = () => {
    const nextQuestion = rawQuestion.trim();
    if (!nextQuestion) return;
    const nextSourceName = sourceName || dataset.table_name;

    setDraft({
      rawQuestion: nextQuestion,
      draftStatus: "drafted",
      activeDatasetId: dataset.dataset_id,
      activeWorksheetName: nextSourceName,
      createdAt: new Date().toISOString(),
    });
    setSchemaDraftPlan(
      createSchemaAwareDraftPlan({
        rawQuestion: nextQuestion,
        schema: dataset.schema,
        dataset,
        activeSourceName: nextSourceName,
      }),
    );
    setSelectedDimension(null);
    setSelectedMeasure(null);
    setSelectedDateField(null);
  };

  return (
    <section className="question-workspace-panel" aria-label="Workspace question preparation">
      <div className="question-workspace-copy">
        <p className="section-label">Workspace</p>
        <h2>Ask a business question</h2>
        <p>
          Start with what you want to learn. The workspace will prepare a reviewable analysis
          before anything runs.
        </p>
      </div>

      <div className="question-workspace-context" aria-label="Active dataset context">
        {datasetContext.map((item) => (
          <span key={item.label} title={item.value}>
            {item.label}
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>

      <label className="question-workspace-input">
        <span>Business question</span>
        <textarea
          value={rawQuestion}
          onChange={(event) => setRawQuestion(event.target.value)}
          placeholder="Ask about this dataset..."
          rows={3}
        />
      </label>

      <div className="question-workspace-starters" aria-label="Starter questions">
        {starterPrompts.map((prompt) => (
          <button type="button" key={prompt} onClick={() => setRawQuestion(prompt)}>
            {prompt}
          </button>
        ))}
      </div>

      <div className="question-workspace-actions">
        <button
          type="button"
          className="primary-button"
          onClick={prepareDraft}
          disabled={!rawQuestion.trim()}
        >
          Prepare answer
        </button>
      </div>

      {draft.draftStatus === "drafted" && (
        <section className="question-workspace-review" aria-label="Suggested question setup review">
          <div className="question-workspace-section-heading">
            <p className="section-label">Review suggested setup</p>
            <h3>Review suggested setup</h3>
          </div>

          <p className="question-workspace-safety-note">
            Nothing runs until you review the setup and click Run query.
          </p>

          <dl className="question-workspace-review-card">
            <div>
              <dt>Question</dt>
              <dd>{draft.rawQuestion}</dd>
            </div>
            <div>
              <dt>Suggested interpretation</dt>
              <dd>
                {schemaDraftPlan
                  ? `${formatPlanLabel(schemaDraftPlan.detectedIntent)} - ${formatPlanLabel(
                      schemaDraftPlan.plannedOutputType,
                    )}`
                  : reviewHints.possibleAnalysisType}
              </dd>
            </div>
          </dl>

          {schemaDraftPlan && !hasSchemaCandidates && (
            <p className="question-workspace-fallback">
              This question could not be confidently matched to fields yet.
            </p>
          )}

          <section className="question-workspace-schema-review" aria-label="Recommended fields">
            <div className="question-workspace-section-heading">
              <p className="section-label">Recommended fields</p>
              <h4>{planningClarityStatus}</h4>
            </div>
            <div className="question-workspace-schema-grid">
              <article>
                <span>Selected dimension</span>
                <strong>
                  {selectedDimension
                    ? formatDisplayLabel(selectedDimension)
                    : controlledLogicDraft?.selectedFields.dimension
                      ? formatDisplayLabel(controlledLogicDraft.selectedFields.dimension)
                      : schemaDraftPlan?.candidateDimensions[0]?.columnName
                        ? formatDisplayLabel(schemaDraftPlan.candidateDimensions[0].columnName)
                        : "Not selected"}
                </strong>
              </article>
              <article>
                <span>Selected measure</span>
                <strong>
                  {selectedMeasure
                    ? formatMetricDisplayLabel(selectedMeasure)
                    : controlledLogicDraft?.selectedFields.measure
                      ? formatMetricDisplayLabel(controlledLogicDraft.selectedFields.measure)
                      : schemaDraftPlan?.candidateMeasures[0]?.columnName
                        ? formatMetricDisplayLabel(schemaDraftPlan.candidateMeasures[0].columnName)
                        : "Record count or not selected"}
                </strong>
              </article>
              {(selectedDateField ||
                controlledLogicDraft?.selectedFields.dateField ||
                (schemaDraftPlan?.candidateDateFields.length || 0) > 0) && (
                <article>
                  <span>Selected date field</span>
                  <strong>
                    {selectedDateField
                      ? formatDisplayLabel(selectedDateField)
                      : controlledLogicDraft?.selectedFields.dateField
                        ? formatDisplayLabel(controlledLogicDraft.selectedFields.dateField)
                        : schemaDraftPlan?.candidateDateFields[0]?.columnName
                          ? formatDisplayLabel(schemaDraftPlan.candidateDateFields[0].columnName)
                          : "Not selected"}
                  </strong>
                </article>
              )}
              <article>
                <span>Calculation</span>
                <strong>
                  {controlledLogicDraft
                    ? formatPlanLabel(controlledLogicDraft.aggregation.idea)
                    : reviewHints.possibleAnalysisType}
                </strong>
                <small>{controlledLogicDraft?.aggregation.summary || "Suggested setup only."}</small>
              </article>
              <article>
                <span>Sort / limit</span>
                <strong>
                  {controlledLogicDraft?.sorting
                    ? `${controlledLogicDraft.sorting.direction || "review"} ${
                        controlledLogicDraft.sorting.field
                          ? formatDisplayLabel(controlledLogicDraft.sorting.field)
                          : "field"
                      }`
                    : "Review in Query Builder"}
                </strong>
                <small>
                  {controlledLogicDraft?.limit.value
                    ? `Top ${controlledLogicDraft.limit.value}`
                    : "No limit selected yet"}
                </small>
              </article>
              <article>
                <span>Ready to review</span>
                <strong>{canApplyGovernedRequest ? "Ready for Query Builder" : "Needs review"}</strong>
                <small>Setup only; execution happens in Query Builder.</small>
              </article>
            </div>
          </section>

          {schemaDraftPlan && needsClarification && (
            <section className="question-workspace-clarification" aria-label="Clarification needed">
              <div className="question-workspace-section-heading">
                <p className="section-label">Clarification needed</p>
                <h4>Choose the fields that best match the question.</h4>
              </div>

              {schemaDraftPlan.missingRequirements.length > 0 && (
                <div className="question-workspace-clarification-needs">
                  <span>Still needed</span>
                  <p>{schemaDraftPlan.missingRequirements.map(formatPlanLabel).join(", ")}</p>
                </div>
              )}

              {schemaDraftPlan.candidateDimensions.length > 0 && (
                <div className="question-workspace-choice-group">
                  <span>
                    Selected dimension:{" "}
                    {selectedDimension ? formatDisplayLabel(selectedDimension) : "None yet"}
                  </span>
                  <div>
                    {schemaDraftPlan.candidateDimensions
                      .slice(0, 5)
                      .map((candidate) =>
                        renderCandidateChoice(candidate, "dimension", selectedDimension),
                      )}
                  </div>
                </div>
              )}

              {schemaDraftPlan.candidateMeasures.length > 0 && (
                <div className="question-workspace-choice-group">
                  <span>
                    Selected measure:{" "}
                    {selectedMeasure ? formatMetricDisplayLabel(selectedMeasure) : "None yet"}
                  </span>
                  <div>
                    {schemaDraftPlan.candidateMeasures
                      .slice(0, 5)
                      .map((candidate) =>
                        renderCandidateChoice(candidate, "measure", selectedMeasure),
                      )}
                  </div>
                </div>
              )}

              {schemaDraftPlan.candidateDateFields.length > 0 && (
                <div className="question-workspace-choice-group">
                  <span>
                    Selected date field:{" "}
                    {selectedDateField ? formatDisplayLabel(selectedDateField) : "None yet"}
                  </span>
                  <div>
                    {schemaDraftPlan.candidateDateFields
                      .slice(0, 5)
                      .map((candidate) =>
                        renderCandidateChoice(candidate, "date", selectedDateField),
                      )}
                  </div>
                </div>
              )}

              {schemaDraftPlan.suggestedClarifyingQuestions.length > 0 && (
                <div className="question-workspace-schema-list">
                  <span>Suggested clarifying questions</span>
                  <div className="question-workspace-clarifying-chips">
                    {schemaDraftPlan.suggestedClarifyingQuestions.map((question) => (
                      <button
                        type="button"
                        key={question}
                        onClick={() => setRawQuestion(question)}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {governedRequestHasFilters && (
            <p className="question-workspace-fallback">
              This draft includes filters. Filter handoff needs a later review step before applying it to Query Builder.
            </p>
          )}

          {canApplyGovernedRequest && onApplyQueryBuilderRequestDraft && governedQueryBuilderRequestDraft && (
            <div className="question-workspace-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => onApplyQueryBuilderRequestDraft(governedQueryBuilderRequestDraft)}
              >
                Apply to Query Builder for Review
              </button>
            </div>
          )}

          <details className="question-workspace-review-details">
            <summary>
              <span>Review details</span>
              <small>Field matches, request preview, and validation notes</small>
            </summary>

            <div className="question-workspace-details-body">
              <div className="question-workspace-schema-grid">
                <article>
                  <span>Candidate dimensions</span>
                  <strong>{formatCandidateFields(schemaDraftPlan?.candidateDimensions || [])}</strong>
                  <small>{schemaDraftPlan?.confidence || reviewHints.confidence} confidence</small>
                </article>
                <article>
                  <span>Candidate measures</span>
                  <strong>{formatCandidateFields(schemaDraftPlan?.candidateMeasures || [])}</strong>
                  <small>{schemaDraftPlan?.confidence || reviewHints.confidence} confidence</small>
                </article>
                <article>
                  <span>Candidate date fields</span>
                  <strong>{formatCandidateFields(schemaDraftPlan?.candidateDateFields || [])}</strong>
                  <small>{schemaDraftPlan?.confidence || reviewHints.confidence} confidence</small>
                </article>
                <article>
                  <span>Planned output type</span>
                  <strong>
                    {schemaDraftPlan
                      ? formatPlanLabel(schemaDraftPlan.plannedOutputType)
                      : reviewHints.plannedOutputs.join(", ")}
                  </strong>
                  <small>Review expectation only</small>
                </article>
              </div>

              {schemaDraftPlan && schemaDraftPlan.ambiguousTerms.length > 0 && (
                <div className="question-workspace-schema-list">
                  <span>Ambiguous terms</span>
                  {schemaDraftPlan.ambiguousTerms.map((item) => (
                    <p key={item.term}>
                      <strong>{item.term}</strong>:{" "}
                      {item.candidates
                        .map((candidate) => formatDisplayLabel(candidate.columnName))
                        .join(", ")}
                    </p>
                  ))}
                </div>
              )}

              <div className="question-workspace-logic-columns">
                <div className="question-workspace-blueprint-note">
                  <span>Validation warnings</span>
                  {[
                    ...(controlledLogicDraft?.validationWarnings || []),
                    ...(governedQueryBuilderRequestDraft?.validationWarnings || []),
                  ].length > 0 ? (
                    <ul>
                      {[
                        ...(controlledLogicDraft?.validationWarnings || []),
                        ...(governedQueryBuilderRequestDraft?.validationWarnings || []),
                      ].map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No validation warnings are attached to this setup.</p>
                  )}
                </div>

                <div className="question-workspace-blueprint-note">
                  <span>Blocking requirements</span>
                  {[
                    ...(controlledLogicDraft?.blockingRequirements || []),
                    ...(governedQueryBuilderRequestDraft?.blockingRequirements || []),
                  ].length > 0 ? (
                    <ul>
                      {[
                        ...(controlledLogicDraft?.blockingRequirements || []),
                        ...(governedQueryBuilderRequestDraft?.blockingRequirements || []),
                      ].map((requirement) => (
                        <li key={requirement}>{formatPlanLabel(requirement)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>No blocking requirements are attached to this setup.</p>
                  )}
                </div>
              </div>

              {governedQueryBuilderRequestDraft?.request && (
                <div className="question-workspace-preview-grid">
                  <article>
                    <span>Selected columns</span>
                    <strong>
                      {formatDisplayRequestList(governedQueryBuilderRequestDraft.request.selected_columns)}
                    </strong>
                  </article>
                  <article>
                    <span>Group by</span>
                    <strong>{formatDisplayRequestList(governedQueryBuilderRequestDraft.request.group_by)}</strong>
                  </article>
                  <article>
                    <span>Aggregations</span>
                    <strong>
                      {governedQueryBuilderRequestDraft.request.aggregations.length > 0
                        ? governedQueryBuilderRequestDraft.request.aggregations
                            .map(formatRequestAggregation)
                            .join(", ")
                        : "None"}
                    </strong>
                  </article>
                  <article>
                    <span>Filters</span>
                    <strong>
                      {governedQueryBuilderRequestDraft.request.filters.length > 0
                        ? governedQueryBuilderRequestDraft.request.filters
                            .map(formatRequestFilter)
                            .join("; ")
                        : "None"}
                    </strong>
                  </article>
                  <article>
                    <span>Order by</span>
                    <strong>
                      {governedQueryBuilderRequestDraft.request.order_by
                        ? `${governedQueryBuilderRequestDraft.request.order_by.direction} ${formatDisplayLabel(
                            governedQueryBuilderRequestDraft.request.order_by.column,
                          )}`
                        : "None"}
                    </strong>
                  </article>
                  <article>
                    <span>Limit</span>
                    <strong>{governedQueryBuilderRequestDraft.request.limit}</strong>
                    <small>Page {governedQueryBuilderRequestDraft.request.page}</small>
                  </article>
                </div>
              )}
            </div>
          </details>
        </section>
      )}
    </section>
  );
}

export default QuestionWorkspacePanel;
