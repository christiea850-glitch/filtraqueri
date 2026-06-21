import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { AcceptedRelationshipContract, WorksheetMetadata } from "../../workbook";
import type { SqlTemplateRecommendation } from "./sqlTemplateRecommender";
import { formatSqlColumn, formatSqlTable } from "./sqlSchemaHelpers";

export type SqlBusinessQuestionOutputShape =
  | "grouped_count"
  | "status_breakdown"
  | "filtered_count"
  | "metric_by_dimension"
  | "detail_list"
  | "blocked_relationship_plan";

export type SqlBusinessQuestionEntity = {
  worksheetId: string;
  label: string;
  tableName: string;
  matchedColumns: string[];
  directNameMatches: string[];
  score: number;
  firstPromptIndex: number;
};

export type SqlBusinessQuestionRelationshipGap = {
  fromTable: string;
  toTable: string;
};

export type SqlBusinessQuestionShape = {
  prompt: string;
  promptTokens: string[];
  mentionedEntities: SqlBusinessQuestionEntity[];
  metricIntent: "count" | "sum" | "average" | "min" | "max" | null;
  hasCountIntent: boolean;
  hasGroupingIntent: boolean;
  hasStatusBreakdownIntent: boolean;
  filterTerms: string[];
  hasFilterIntent: boolean;
  hasDetailIntent: boolean;
  isCrossEntity: boolean;
  relationshipDependent: boolean;
  relationshipGaps: SqlBusinessQuestionRelationshipGap[];
  preferredOutputShape: SqlBusinessQuestionOutputShape;
  countedEntity: SqlBusinessQuestionEntity | null;
  groupingEntity: SqlBusinessQuestionEntity | null;
};

export type SqlAskBlockedPlanRecommendation = {
  title: string;
  expectedOutput: string;
  statusLabel: "Needs relationship metadata";
  actionLabel: "Relationships needed";
  relevantEntities: string[];
  missingRelationships: string[];
  explanation: string;
  disabledReason: "Confirm worksheet relationships before inserting SQL.";
};

const countTerms = new Set(["count", "counts", "many", "number"]);
const sumTerms = new Set(["sum", "total", "revenue", "amount"]);
const averageTerms = new Set(["average", "avg", "mean"]);
const minTerms = new Set(["min", "minimum", "lowest"]);
const maxTerms = new Set(["max", "maximum", "highest"]);
const groupingTerms = new Set(["by", "per", "each", "every"]);
const statusTerms = new Set([
  "status",
  "state",
  "type",
  "category",
]);
const statusValueTerms = new Set([
  "pending",
  "completed",
  "complete",
  "active",
  "inactive",
  "vacant",
  "occupied",
]);
const filterTerms = new Set([
  "with",
  "without",
  "has",
  "have",
  "having",
  "missing",
  "active",
  "inactive",
  "over",
  "under",
  "before",
  "after",
]);
const detailTerms = new Set(["list", "show", "details", "detail", "which", "who"]);
const statusSummaryTerms = /\b(status|state|type|category)\b/i;
const groupedSqlTerms = /\bgroup\s+by\b|\bcount\s*\(/i;

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularize = (value: string): string => {
  if (value.endsWith("ies") && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s") && value.length > 3) return value.slice(0, -1);
  return value;
};

const humanizeLabel = (value: string): string =>
  value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

const identifierLabel = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const tokenize = (value: string): string[] =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 0)
    .map(singularize);

const includesToken = (text: string, token: string): boolean =>
  token.length >= 3 &&
  tokenize(text).some(
    (word) => word === token || word.startsWith(token) || token.startsWith(word),
  );

const worksheetLabel = (worksheet: WorksheetMetadata): string =>
  worksheet.displayName || worksheet.sheetName || worksheet.tableName;

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const promptIndexForEntity = (
  promptTokens: readonly string[],
  entityTokens: readonly string[],
): number => {
  const index = promptTokens.findIndex((token) =>
    entityTokens.some((entityToken) => token === entityToken || entityToken.startsWith(token) || token.startsWith(entityToken)),
  );
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

const collectMentionedEntities = (
  promptTokens: readonly string[],
  dataset: DatasetMetadata | null,
): SqlBusinessQuestionEntity[] => {
  const worksheets = dataset?.workbook_metadata?.worksheets || [];

  return worksheets
    .map((worksheet) => {
      const nameText = [worksheetLabel(worksheet), worksheet.sheetName, worksheet.tableName].join(" ");
      const nameTokens = tokenize(nameText);
      const matchedNameTokens = promptTokens.filter((token) => includesToken(nameText, token));
      const matchedColumns = worksheet.schema
        .filter((column) => promptTokens.some((token) => includesToken(column.name, token)))
        .map((column) => column.name);
      const score = matchedNameTokens.length * 12 + Math.min(matchedColumns.length, 4) * 5;
      return {
        worksheetId: worksheet.worksheetId,
        label: worksheetLabel(worksheet),
        tableName: worksheet.tableName,
        matchedColumns,
        directNameMatches: matchedNameTokens,
        score,
        firstPromptIndex: promptIndexForEntity(promptTokens, nameTokens),
      };
    })
    .filter((entity) => entity.score > 0)
    .sort((a, b) => b.score - a.score || a.firstPromptIndex - b.firstPromptIndex || a.label.localeCompare(b.label))
    .slice(0, 5);
};

const directlyMentionedEntities = (
  entities: readonly SqlBusinessQuestionEntity[],
): SqlBusinessQuestionEntity[] => {
  const directEntities = entities.filter((entity) => entity.directNameMatches.length > 0);
  return directEntities.length > 0 ? directEntities : [...entities];
};

const nearestEntityAfterTerm = (
  promptTokens: readonly string[],
  entities: readonly SqlBusinessQuestionEntity[],
  terms: ReadonlySet<string>,
): SqlBusinessQuestionEntity | null => {
  const termIndex = promptTokens.findIndex((token) => terms.has(token));
  if (termIndex === -1) return null;
  return (
    entities
      .filter((entity) => entity.firstPromptIndex > termIndex)
      .sort((a, b) => a.firstPromptIndex - b.firstPromptIndex)[0] || null
  );
};

const findActiveContracts = (
  contracts: readonly AcceptedRelationshipContract[],
): AcceptedRelationshipContract[] =>
  contracts.filter(
    (contract) => contract.status === "active" && contract.validationState !== "broken",
  );

const findContractBetween = (
  contracts: readonly AcceptedRelationshipContract[],
  leftTable: string,
  rightTable: string,
): AcceptedRelationshipContract | null =>
  contracts.find(
    (contract) =>
      (contract.sourceTableName === leftTable && contract.targetTableName === rightTable) ||
      (contract.sourceTableName === rightTable && contract.targetTableName === leftTable),
  ) || null;

const createRelationshipGaps = (
  primary: SqlBusinessQuestionEntity | null,
  entities: readonly SqlBusinessQuestionEntity[],
  contracts: readonly AcceptedRelationshipContract[],
): SqlBusinessQuestionRelationshipGap[] => {
  if (!primary || entities.length < 2) return [];
  const activeContracts = findActiveContracts(contracts);
  return entities.filter((entity) => entity.worksheetId !== primary.worksheetId).flatMap((entity) =>
    findContractBetween(activeContracts, primary.tableName, entity.tableName)
      ? []
      : [{ fromTable: primary.tableName, toTable: entity.tableName }],
  );
};

const detectMetricIntent = (
  promptTokens: readonly string[],
): SqlBusinessQuestionShape["metricIntent"] => {
  if (promptTokens.some((token) => averageTerms.has(token))) return "average";
  if (promptTokens.some((token) => sumTerms.has(token))) return "sum";
  if (promptTokens.some((token) => minTerms.has(token))) return "min";
  if (promptTokens.some((token) => maxTerms.has(token))) return "max";
  if (promptTokens.some((token) => countTerms.has(token))) return "count";
  return null;
};

const choosePreferredOutputShape = ({
  metricIntent,
  hasGroupingIntent,
  hasStatusBreakdownIntent,
  hasFilterIntent,
  hasDetailIntent,
  relationshipDependent,
  relationshipGaps,
}: Pick<
  SqlBusinessQuestionShape,
  | "metricIntent"
  | "hasGroupingIntent"
  | "hasStatusBreakdownIntent"
  | "hasFilterIntent"
  | "hasDetailIntent"
  | "relationshipDependent"
  | "relationshipGaps"
>): SqlBusinessQuestionOutputShape => {
  if (relationshipDependent && relationshipGaps.length > 0) return "blocked_relationship_plan";
  if (hasDetailIntent) return "detail_list";
  if (metricIntent === "count" && hasGroupingIntent) return "grouped_count";
  if (metricIntent && metricIntent !== "count" && hasGroupingIntent) return "metric_by_dimension";
  if (hasStatusBreakdownIntent && (hasGroupingIntent || metricIntent === "count")) return "status_breakdown";
  if (metricIntent === "count" && hasFilterIntent) return "filtered_count";
  if (metricIntent === "count") return "filtered_count";
  return hasStatusBreakdownIntent ? "status_breakdown" : "detail_list";
};

export const classifySqlBusinessQuestion = ({
  prompt,
  dataset,
}: {
  prompt: string;
  dataset: DatasetMetadata | null;
}): SqlBusinessQuestionShape => {
  const promptTokens = tokenize(prompt);
  const allMentionedEntities = collectMentionedEntities(promptTokens, dataset);
  const mentionedEntities = directlyMentionedEntities(allMentionedEntities);
  const metricIntent = detectMetricIntent(promptTokens);
  const hasGroupingIntent = promptTokens.some((token) => groupingTerms.has(token));
  const matchedStatusValueTerms = promptTokens.filter((token) => statusValueTerms.has(token));
  const hasStatusBreakdownIntent =
    promptTokens.some((token) => statusTerms.has(token) || token === "vs" || token === "versus") ||
    matchedStatusValueTerms.length > 1;
  const matchedFilterTerms = uniqueStrings(promptTokens.filter((token) => filterTerms.has(token)));
  const hasFilterIntent = matchedFilterTerms.length > 0;
  const hasDetailIntent =
    promptTokens.some((token) => detailTerms.has(token)) && metricIntent !== "count";
  const countedEntity =
    nearestEntityAfterTerm(promptTokens, mentionedEntities, countTerms) ||
    mentionedEntities[0] ||
    null;
  const groupingEntity =
    nearestEntityAfterTerm(promptTokens, mentionedEntities, groupingTerms) ||
    (mentionedEntities.length > 1 ? mentionedEntities[1] : null);
  const isCrossEntity = mentionedEntities.length > 1;
  const relationshipDependent = isCrossEntity && (hasGroupingIntent || hasFilterIntent || metricIntent !== null);
  const relationshipGaps = relationshipDependent
    ? createRelationshipGaps(
        countedEntity,
        mentionedEntities,
        dataset?.workbook_metadata?.acceptedRelationshipContracts || [],
      )
    : [];
  const preferredOutputShape = choosePreferredOutputShape({
    metricIntent,
    hasGroupingIntent,
    hasStatusBreakdownIntent,
    hasFilterIntent,
    hasDetailIntent,
    relationshipDependent,
    relationshipGaps,
  });

  return {
    prompt,
    promptTokens,
    mentionedEntities,
    metricIntent,
    hasCountIntent: metricIntent === "count",
    hasGroupingIntent,
    hasStatusBreakdownIntent,
    filterTerms: matchedFilterTerms,
    hasFilterIntent,
    hasDetailIntent,
    isCrossEntity,
    relationshipDependent,
    relationshipGaps,
    preferredOutputShape,
    countedEntity,
    groupingEntity,
  };
};

const recommendationText = (recommendation: SqlTemplateRecommendation): string =>
  normalizeText([
    recommendation.title,
    recommendation.description,
    recommendation.sql,
    recommendation.candidateIntent?.primaryIntent || "",
  ].join(" "));

const shapeRankBonus = (
  recommendation: SqlTemplateRecommendation,
  shape: SqlBusinessQuestionShape,
): number => {
  const text = recommendationText(recommendation);
  const isStatusSummary = statusSummaryTerms.test(text) && /summary|count|breakdown/.test(text);
  const isGrouped = groupedSqlTerms.test(recommendation.sql) || /\bby\b|\bgroup/.test(text);
  const isMetricAggregation = /\bsum\b|\baverage\b|\bavg\b|\btotal\b/.test(text);
  const isDetail = /\blist\b|\bdetail\b|\bpreview\b|\bselect\b/.test(text);
  let bonus = 0;

  if (shape.preferredOutputShape === "status_breakdown") {
    if (isStatusSummary) bonus += 35;
    if (isGrouped) bonus += 8;
    return bonus;
  }

  if (isStatusSummary) bonus -= 45;

  if (shape.preferredOutputShape === "grouped_count") {
    if (isGrouped && /\bcount\b/.test(text)) bonus += 40;
    if (isDetail) bonus -= 10;
  }

  if (shape.preferredOutputShape === "metric_by_dimension") {
    if (isMetricAggregation && isGrouped) bonus += 45;
    if (/\bcount\b/.test(text)) bonus -= 12;
  }

  if (shape.preferredOutputShape === "filtered_count") {
    if (/\bfilter|where|count\b/.test(text)) bonus += 18;
    if (isGrouped && !shape.hasGroupingIntent) bonus -= 8;
  }

  if (shape.preferredOutputShape === "detail_list") {
    if (isDetail || /\bwhere\b/.test(text)) bonus += 24;
    if (/\bcount\b|\bsummary\b/.test(text)) bonus -= 20;
  }

  return bonus;
};

export const rankSqlAskRecommendationsForQuestionShape = (
  recommendations: readonly SqlTemplateRecommendation[],
  shape: SqlBusinessQuestionShape,
): SqlTemplateRecommendation[] => {
  if (shape.preferredOutputShape === "blocked_relationship_plan") return [];

  return recommendations
    .map((recommendation) => ({
      recommendation,
      adjustedScore: recommendation.score + shapeRankBonus(recommendation, shape),
    }))
    .filter(({ adjustedScore }) => adjustedScore > 3)
    .sort(
      (a, b) =>
        b.adjustedScore - a.adjustedScore ||
        (a.recommendation.support === b.recommendation.support
          ? 0
          : a.recommendation.support === "supported"
            ? -1
            : 1) ||
        a.recommendation.title.localeCompare(b.recommendation.title),
    )
    .map(({ recommendation, adjustedScore }) => ({
      ...recommendation,
      score: adjustedScore,
      reasons: uniqueStrings([
        `Matches ${shape.preferredOutputShape.replace(/_/g, " ")} question shape.`,
        ...recommendation.reasons,
      ]),
    }))
    .slice(0, 3);
};

const chooseDisplayColumn = (worksheet: WorksheetMetadata): SchemaColumn | null =>
  worksheet.schema.find((column) => /name|number|title|label|category|segment|status/i.test(column.name)) ||
  worksheet.schema.find((column) => !/_?id$/i.test(column.name)) ||
  worksheet.schema[0] ||
  null;

export const createBlockedRelationshipAskPlan = ({
  dataset,
  shape,
}: {
  dataset: DatasetMetadata | null;
  shape: SqlBusinessQuestionShape;
}): SqlAskBlockedPlanRecommendation | null => {
  if (shape.preferredOutputShape !== "blocked_relationship_plan") return null;
  if (!shape.countedEntity) return null;

  const groupingEntity = shape.groupingEntity || shape.mentionedEntities.find(
    (entity) => entity.worksheetId !== shape.countedEntity?.worksheetId,
  );
  const workbook = dataset?.workbook_metadata;
  const groupingWorksheet = workbook?.worksheets.find(
    (worksheet) => worksheet.worksheetId === groupingEntity?.worksheetId,
  );
  const groupColumn = groupingWorksheet ? chooseDisplayColumn(groupingWorksheet)?.name : null;
  const filterEntities = shape.mentionedEntities.filter(
    (entity) =>
      entity.worksheetId !== shape.countedEntity?.worksheetId &&
      entity.worksheetId !== groupingEntity?.worksheetId,
  );
  const relevantEntities = uniqueStrings([
    shape.countedEntity.label,
    ...(groupingEntity ? [groupingEntity.label] : []),
    ...filterEntities.map((entity) => entity.label),
  ]);
  const countedLabel = humanizeLabel(shape.countedEntity.label);
  const groupingLabel = groupingEntity ? humanizeLabel(groupingEntity.label) : "worksheet";
  const filterLabel =
    filterEntities.length > 0
      ? ` with ${filterEntities.map((entity) => humanizeLabel(entity.label)).join(" and ")}`
      : "";
  const title = shape.hasCountIntent
    ? `Count ${countedLabel}${filterLabel} by ${singularize(groupingLabel)}`
    : `${countedLabel}${filterLabel} by ${singularize(groupingLabel)}`;
  const countAlias = identifierLabel([
    countedLabel,
    ...(filterEntities.length > 0 ? ["with"] : []),
    ...filterEntities.map((entity) => humanizeLabel(entity.label)),
    "count",
  ].join(" "));
  const expectedOutput = `${groupColumn || `${identifierLabel(singularize(groupingLabel))}_label`}, ${countAlias}`;

  return {
    title,
    expectedOutput: `Expected output: ${expectedOutput}`,
    statusLabel: "Needs relationship metadata",
    actionLabel: "Relationships needed",
    relevantEntities,
    missingRelationships: shape.relationshipGaps.map(
      (gap) => `${gap.fromTable} to ${gap.toTable}`,
    ),
    explanation:
      "FiltraQueri understands the question, but SQL cannot be safely inserted until the relationships between these worksheets are confirmed.",
    disabledReason: "Confirm worksheet relationships before inserting SQL.",
  };
};

const chooseCountColumn = (
  worksheet: WorksheetMetadata,
  contract: AcceptedRelationshipContract,
): string => {
  if (contract.sourceTableName === worksheet.tableName) return contract.sourceColumnName;
  if (contract.targetTableName === worksheet.tableName) return contract.targetColumnName;
  return worksheet.schema.find((column) => /(^id$|_id$)/i.test(column.name))?.name || worksheet.schema[0]?.name || "*";
};

const joinClauseForContract = (
  contract: AcceptedRelationshipContract,
  aliasesByTable: ReadonlyMap<string, string>,
  baseTableName: string,
): string | null => {
  const sourceAlias = aliasesByTable.get(contract.sourceTableName);
  const targetAlias = aliasesByTable.get(contract.targetTableName);
  if (!sourceAlias || !targetAlias) return null;

  if (contract.sourceTableName === baseTableName) {
    return `JOIN ${formatSqlTable(contract.targetTableName)} AS ${targetAlias}
  ON ${sourceAlias}.${formatSqlColumn(contract.sourceColumnName)} = ${targetAlias}.${formatSqlColumn(contract.targetColumnName)}`;
  }

  if (contract.targetTableName === baseTableName) {
    return `JOIN ${formatSqlTable(contract.sourceTableName)} AS ${sourceAlias}
  ON ${sourceAlias}.${formatSqlColumn(contract.sourceColumnName)} = ${targetAlias}.${formatSqlColumn(contract.targetColumnName)}`;
  }

  return null;
};

export const createSafeGroupedCountAskRecommendation = ({
  dataset,
  selectedDialect,
  shape,
}: {
  dataset: DatasetMetadata | null;
  selectedDialect: string;
  shape: SqlBusinessQuestionShape;
}): SqlTemplateRecommendation | null => {
  if (shape.preferredOutputShape !== "grouped_count") return null;
  if (!shape.countedEntity || !shape.groupingEntity) return null;
  if (shape.promptTokens.includes("without")) return null;

  const workbook = dataset?.workbook_metadata;
  if (!workbook) return null;

  const countedWorksheet = workbook.worksheets.find(
    (worksheet) => worksheet.worksheetId === shape.countedEntity?.worksheetId,
  );
  const groupingWorksheet = workbook.worksheets.find(
    (worksheet) => worksheet.worksheetId === shape.groupingEntity?.worksheetId,
  );
  if (!countedWorksheet || !groupingWorksheet) return null;

  const filterEntities = shape.mentionedEntities.filter(
    (entity) =>
      entity.worksheetId !== countedWorksheet.worksheetId &&
      entity.worksheetId !== groupingWorksheet.worksheetId,
  );
  const contracts = findActiveContracts(workbook.acceptedRelationshipContracts);
  const requiredContracts = [
    findContractBetween(contracts, countedWorksheet.tableName, groupingWorksheet.tableName),
    ...filterEntities.map((entity) =>
      findContractBetween(contracts, countedWorksheet.tableName, entity.tableName),
    ),
  ];
  if (requiredContracts.some((contract) => !contract)) return null;

  const aliasesByTable = new Map<string, string>();
  aliasesByTable.set(countedWorksheet.tableName, "c");
  aliasesByTable.set(groupingWorksheet.tableName, "g");
  filterEntities.forEach((entity, index) => aliasesByTable.set(entity.tableName, `f${index + 1}`));

  const joinClauses = requiredContracts
    .filter((contract): contract is AcceptedRelationshipContract => Boolean(contract))
    .map((contract) => joinClauseForContract(contract, aliasesByTable, countedWorksheet.tableName))
    .filter((clause): clause is string => Boolean(clause));
  if (joinClauses.length !== requiredContracts.length) return null;

  const groupColumn = chooseDisplayColumn(groupingWorksheet);
  if (!groupColumn) return null;
  const countColumn = chooseCountColumn(countedWorksheet, requiredContracts[0] as AcceptedRelationshipContract);
  const groupAlias = `${singularize(normalizeText(shape.groupingEntity.label).replace(/\s+/g, "_"))}_label`;
  const countAlias = `${singularize(normalizeText(shape.countedEntity.label).replace(/\s+/g, "_"))}_count`;
  const filterLabel =
    filterEntities.length > 0
      ? ` with ${filterEntities.map((entity) => humanizeLabel(entity.label)).join(" and ")}`
      : "";
  const title = `Count ${humanizeLabel(shape.countedEntity.label)}${filterLabel} by ${singularize(humanizeLabel(shape.groupingEntity.label))}`;
  const sql = `SELECT
  g.${formatSqlColumn(groupColumn.name)} AS ${formatSqlColumn(groupAlias)},
  COUNT(DISTINCT c.${formatSqlColumn(countColumn)}) AS ${formatSqlColumn(countAlias)}
FROM ${formatSqlTable(countedWorksheet.tableName)} AS c
${joinClauses.join("\n")}
GROUP BY g.${formatSqlColumn(groupColumn.name)}
ORDER BY ${formatSqlColumn(countAlias)} DESC
LIMIT 100;`;

  return {
    id: `ask:${selectedDialect}:grouped-count:${countedWorksheet.tableName}:${groupingWorksheet.tableName}:${filterEntities.map((entity) => entity.tableName).join(":")}`,
    kind: "template",
    title,
    description: "Deterministic grouped count built from accepted workbook relationship metadata.",
    sql,
    score: 100,
    reasons: [
      "Matches grouped count question shape.",
      "Uses accepted workbook relationship metadata before exposing SQL.",
    ],
    support: "supported",
  };
};

export const createSafeStatusBreakdownAskRecommendation = ({
  dataset,
  selectedDialect,
  shape,
}: {
  dataset: DatasetMetadata | null;
  selectedDialect: string;
  shape: SqlBusinessQuestionShape;
}): SqlTemplateRecommendation | null => {
  if (shape.preferredOutputShape !== "status_breakdown") return null;

  const workbook = dataset?.workbook_metadata;
  const worksheet =
    workbook?.worksheets.find(
      (candidate) => candidate.worksheetId === shape.countedEntity?.worksheetId,
    ) ||
    workbook?.worksheets.find((candidate) => candidate.tableName === dataset?.table_name) ||
    null;
  if (!worksheet) return null;

  const statusColumn = worksheet.schema.find((column) =>
    /status|state|type|category/i.test(column.name),
  );
  if (!statusColumn) return null;

  const label = worksheetLabel(worksheet);
  const columnExpression = formatSqlColumn(statusColumn.name);
  const countAlias = `${singularize(normalizeText(label).replace(/\s+/g, "_"))}_count`;
  const sql = `SELECT
  ${columnExpression},
  COUNT(*) AS ${formatSqlColumn(countAlias)}
FROM ${formatSqlTable(worksheet.tableName)}
GROUP BY ${columnExpression}
ORDER BY ${formatSqlColumn(countAlias)} DESC
LIMIT 100;`;

  return {
    id: `ask:${selectedDialect}:status-breakdown:${worksheet.tableName}:${statusColumn.name}`,
    kind: "template",
    title: `Status summary — ${label}`,
    description: `Count ${label} records by ${statusColumn.name}.`,
    sql,
    score: 95,
    reasons: [
      "Matches status breakdown question shape.",
      "Uses a status/category column found in workbook metadata.",
    ],
    support: "supported",
  };
};
