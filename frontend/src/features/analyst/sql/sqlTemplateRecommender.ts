import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { ReportOpportunity } from "./reportIntelligencePlanner";
import type { SqlReportRecipe } from "./sqlReportRecipes";
import type { SqlAssistantTemplate } from "./sqlTemplateLibrary";
import { detectBusinessIntent, type BusinessIntent } from "./businessIntentGrounding";
import {
  groundCandidate,
  normalizeCandidates,
  type CandidateSupport,
  type GroundingContext,
  type GroundedSqlCandidate,
  type VerifiedJoinKey,
} from "./sqlCandidateGrounding";

export type SqlTemplateRecommendationKind = "template" | "report";

export type SqlTemplateRecommendation = {
  id: string;
  kind: SqlTemplateRecommendationKind;
  title: string;
  description: string;
  sql: string;
  score: number;
  reasons: string[];
  support?: CandidateSupport;
  detectedIntent?: BusinessIntent;
  candidateIntent?: BusinessIntent;
  unsupportedReasons?: string[];
  warnings?: string[];
  verifiedJoinKeys?: VerifiedJoinKey[];
};

type RecommendSqlTemplatesInput = {
  taskPrompt: string;
  dataset: DatasetMetadata | null;
  appliedScopeLabels: string[];
  templates: SqlAssistantTemplate[];
  recipes: SqlReportRecipe[];
  opportunities: ReportOpportunity[];
};

type Candidate = {
  id: string;
  kind: SqlTemplateRecommendationKind;
  title: string;
  description: string;
  sql: string | null;
  categoryText: string;
  metadataText: string;
  tableText: string;
  reportLike: boolean;
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "me",
  "of",
  "on",
  "or",
  "show",
  "the",
  "to",
  "with",
]);

const reportIntentWords = new Set([
  "count",
  "counts",
  "dashboard",
  "rank",
  "ranking",
  "report",
  "summary",
  "summarize",
  "top",
  "total",
  "trend",
]);

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string) =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));

const includesToken = (text: string, token: string) =>
  text.split(" ").some(
    (word) =>
      word === token ||
      word.startsWith(token) ||
      token.startsWith(word),
  );

const createPromptTokens = (taskPrompt: string) => Array.from(new Set(tokenize(taskPrompt)));

const getDatasetColumnNames = (dataset: DatasetMetadata | null) =>
  (dataset?.schema || []).map((column) => column.name);

const getDatasetWorksheetLabels = (dataset: DatasetMetadata | null) =>
  dataset?.workbook_metadata?.worksheets.map(
    (worksheet) => worksheet.displayName || worksheet.sheetName || worksheet.tableName,
  ) || [];

const buildCandidateText = (candidate: Candidate) =>
  normalizeText([
    candidate.title,
    candidate.description,
    candidate.categoryText,
    candidate.metadataText,
    candidate.tableText,
  ].join(" "));

const scoreCandidate = ({
  candidate,
  promptTokens,
  scopeLabels,
  worksheetLabels,
  columnNames,
  promptSoundsLikeReport,
}: {
  candidate: Candidate;
  promptTokens: string[];
  scopeLabels: string[];
  worksheetLabels: string[];
  columnNames: string[];
  promptSoundsLikeReport: boolean;
}) => {
  const candidateText = buildCandidateText(candidate);
  const normalizedScopeLabels = scopeLabels.map(normalizeText).filter(Boolean);
  const normalizedWorksheetLabels = worksheetLabels.map(normalizeText).filter(Boolean);
  const normalizedColumnNames = columnNames.map(normalizeText).filter(Boolean);
  const reasons: string[] = [];
  let score = 0;

  const matchedPromptTokens = promptTokens.filter((token) => includesToken(candidateText, token));
  if (matchedPromptTokens.length > 0) {
    score += matchedPromptTokens.length * 8;
    reasons.push(`Matched task words: ${matchedPromptTokens.slice(0, 4).join(", ")}.`);
  }

  const matchedScopeLabels = normalizedScopeLabels.filter((label) =>
    promptTokens.some((token) => includesToken(label, token)) ||
    candidateText.includes(label),
  );
  if (matchedScopeLabels.length > 0) {
    score += matchedScopeLabels.length * 10;
    reasons.push(`Matches this tab's scope: ${scopeLabels.slice(0, 3).join(", ")}.`);
  }

  const matchedWorksheets = normalizedWorksheetLabels.filter((label) =>
    promptTokens.some((token) => includesToken(label, token)),
  );
  if (matchedWorksheets.length > 0) {
    score += matchedWorksheets.length * 5;
    reasons.push("Uses worksheet names mentioned in your prompt.");
  }

  const matchedColumns = normalizedColumnNames.filter((name) =>
    promptTokens.some((token) => includesToken(name, token)),
  );
  if (matchedColumns.length > 0) {
    score += Math.min(matchedColumns.length, 4) * 6;
    reasons.push(`Matches columns: ${matchedColumns.slice(0, 4).join(", ")}.`);
  }

  if (promptSoundsLikeReport && candidate.kind === "report") {
    score += 10;
    reasons.push("Your prompt sounds like a report or summary task.");
  }

  if (!promptSoundsLikeReport && candidate.kind === "template") {
    score += 3;
  }

  if (candidate.tableText && normalizedScopeLabels.some((label) => candidate.tableText.includes(label))) {
    score += 8;
  }

  if (candidate.reportLike && promptSoundsLikeReport) {
    score += 4;
  }

  return {
    score,
    reasons,
  };
};


const stableSlug = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "untitled";
};

const candidateMapKey = (
  source: GroundedSqlCandidate["source"],
  idOrTitle: string,
): string => `${source}:${stableSlug(idOrTitle)}`;

type OriginalCandidateMetadata = Candidate & {
  originalId: string;
};

const uniqueStrings = (values: readonly string[] = []): string[] =>
  Array.from(
    new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  );

const canonicalText = (value: string): string => normalizeText(value);

const getScopedWorksheetTableNames = (
  dataset: DatasetMetadata | null,
  appliedScopeLabels: readonly string[],
): string[] => {
  const worksheets = dataset?.workbook_metadata?.worksheets || [];
  const allWorkbookTables = worksheets.map((worksheet) => worksheet.tableName);
  const fallbackTables = dataset?.table_name ? [dataset.table_name] : [];

  if (appliedScopeLabels.length === 0) {
    return uniqueStrings(allWorkbookTables.length > 0 ? allWorkbookTables : fallbackTables);
  }

  const scopedTables = appliedScopeLabels.flatMap((label) => {
    const normalizedLabel = canonicalText(label);
    const worksheet = worksheets.find((candidate) =>
      [
        candidate.displayName,
        candidate.sheetName,
        candidate.tableName,
      ].some((candidateLabel) => canonicalText(candidateLabel) === normalizedLabel),
    );

    if (worksheet) return [worksheet.tableName, worksheet.displayName, worksheet.sheetName];
    if (dataset?.table_name && canonicalText(dataset.table_name) === normalizedLabel) {
      return [dataset.table_name];
    }
    return [label];
  });

  return uniqueStrings(scopedTables);
};

const addSchemaAlias = (
  schemaByTable: Map<string, SchemaColumn[]>,
  tableName: string,
  schema: SchemaColumn[],
) => {
  if (!tableName.trim()) return;
  schemaByTable.set(tableName, schema);
};

const buildSchemaByTable = (dataset: DatasetMetadata | null): Map<string, SchemaColumn[]> => {
  const schemaByTable = new Map<string, SchemaColumn[]>();
  const worksheets = dataset?.workbook_metadata?.worksheets || [];

  for (const worksheet of worksheets) {
    addSchemaAlias(schemaByTable, worksheet.tableName, worksheet.schema);
    addSchemaAlias(schemaByTable, worksheet.displayName, worksheet.schema);
    addSchemaAlias(schemaByTable, worksheet.sheetName, worksheet.schema);
  }

  if (dataset?.table_name && dataset.schema.length > 0) {
    addSchemaAlias(schemaByTable, dataset.table_name, dataset.schema);
  }

  return schemaByTable;
};

const buildGroundingContext = ({
  taskPrompt,
  dataset,
  appliedScopeLabels,
}: {
  taskPrompt: string;
  dataset: DatasetMetadata | null;
  appliedScopeLabels: string[];
}): GroundingContext => ({
  detectedIntent: detectBusinessIntent(taskPrompt),
  appliedScopeTables: getScopedWorksheetTableNames(dataset, appliedScopeLabels),
  schemaByTable: buildSchemaByTable(dataset),
  acceptedRelationshipContracts:
    dataset?.workbook_metadata?.acceptedRelationshipContracts || [],
});

const buildOriginalCandidateMetadata = ({
  templates,
  recipes,
  opportunities,
}: Pick<RecommendSqlTemplatesInput, "templates" | "recipes" | "opportunities">): Map<string, OriginalCandidateMetadata> => {
  const metadataByCandidateId = new Map<string, OriginalCandidateMetadata>();

  for (const template of templates) {
    metadataByCandidateId.set(candidateMapKey("template", template.id || template.title), {
      originalId: template.id,
      id: template.id,
      kind: "template",
      title: template.title,
      description: template.explanation,
      sql: template.sql,
      categoryText: template.category,
      metadataText: template.dialectLabel,
      tableText: template.sql,
      reportLike: false,
    });
  }

  for (const recipe of recipes) {
    metadataByCandidateId.set(candidateMapKey("recipe", recipe.id || recipe.title), {
      originalId: recipe.id,
      id: recipe.id,
      kind: "report",
      title: recipe.title,
      description: recipe.businessPurpose,
      sql: recipe.sql,
      categoryText: recipe.sqlPatterns.join(" "),
      metadataText: [
        recipe.requiredFieldRoles.join(" "),
        recipe.supportSummary,
        recipe.domains?.join(" ") || "",
      ].join(" "),
      tableText: recipe.worksheetsUsed?.join(" ") || "",
      reportLike: true,
    });
  }

  for (const opportunity of opportunities) {
    metadataByCandidateId.set(
      candidateMapKey("opportunity", opportunity.compiledRecipeId || opportunity.id || opportunity.title),
      {
        originalId: opportunity.id,
        id: opportunity.id,
        kind: "report",
        title: opportunity.title,
        description: opportunity.businessQuestion,
        sql: opportunity.sql,
        categoryText: [
          opportunity.domains.join(" "),
          opportunity.complexity,
          opportunity.method,
        ].join(" "),
        metadataText: [
          opportunity.whyItMatters,
          opportunity.requiredColumns.join(" "),
          opportunity.optionalColumns.join(" "),
        ].join(" "),
        tableText: [
          opportunity.requiredTables.join(" "),
          opportunity.optionalTables.join(" "),
        ].join(" "),
        reportLike:
          opportunity.needsAggregation ||
          opportunity.needsDateLogic ||
          opportunity.needsJoins ||
          opportunity.needsAnomalyDetection,
      },
    );
  }

  return metadataByCandidateId;
};

const metadataForGroundedCandidate = (
  candidate: GroundedSqlCandidate,
  metadataByCandidateId: Map<string, OriginalCandidateMetadata>,
): OriginalCandidateMetadata => {
  const metadata = metadataByCandidateId.get(candidate.candidateId);
  if (metadata) return metadata;

  return {
    originalId: candidate.candidateId,
    id: candidate.candidateId,
    kind: candidate.source === "template" ? "template" : "report",
    title: candidate.title,
    description: candidate.description,
    sql: candidate.sql,
    categoryText: candidate.candidateIntent.primaryIntent,
    metadataText: [
      candidate.requiredColumns.join(" "),
      candidate.warnings.join(" "),
    ].join(" "),
    tableText: [...candidate.requiredTables, ...candidate.usedTables].join(" "),
    reportLike: candidate.source !== "template",
  };
};

const createGroundingReasons = (candidate: GroundedSqlCandidate): string[] => {
  const reasons: string[] = [];

  if (candidate.support === "supported") {
    reasons.push("Grounding checks support this SQL suggestion for the detected task intent.");
  }

  if (candidate.support === "needs_review") {
    reasons.push("Needs review: grounding checks found assumptions to verify before running.");
  }

  if (candidate.warnings.length > 0) {
    reasons.push(...candidate.warnings);
  }

  if (candidate.verifiedJoinKeys.length > 0) {
    reasons.push("Uses join keys that grounding could verify or flag for review.");
  }

  return reasons;
};

export const recommendSqlTemplates = ({
  taskPrompt,
  dataset,
  appliedScopeLabels,
  templates,
  recipes,
  opportunities,
}: RecommendSqlTemplatesInput): SqlTemplateRecommendation[] => {
  const promptTokens = createPromptTokens(taskPrompt);
  if (promptTokens.length === 0) return [];

  const promptSoundsLikeReport = promptTokens.some((token) => reportIntentWords.has(token));
  const worksheetLabels = getDatasetWorksheetLabels(dataset);
  const columnNames = getDatasetColumnNames(dataset);
  const groundingContext = buildGroundingContext({
    taskPrompt,
    dataset,
    appliedScopeLabels,
  });
  const metadataByCandidateId = buildOriginalCandidateMetadata({
    templates,
    recipes,
    opportunities,
  });

  return normalizeCandidates({ templates, recipes, opportunities })
    .map((candidate) => groundCandidate(candidate, groundingContext))
    .filter(
      (candidate) =>
        Boolean(candidate.sql) &&
        (candidate.support === "supported" || candidate.support === "needs_review"),
    )
    .map((candidate) => {
      const metadata = metadataForGroundedCandidate(candidate, metadataByCandidateId);
      const result = scoreCandidate({
        candidate: metadata,
        promptTokens,
        scopeLabels: appliedScopeLabels,
        worksheetLabels,
        columnNames,
        promptSoundsLikeReport,
      });
      const groundingReasons = createGroundingReasons(candidate);
      const reasons = uniqueStrings([
        ...result.reasons,
        ...groundingReasons,
      ]);

      return {
        id: metadata.originalId,
        kind: metadata.kind,
        title: candidate.title,
        description: candidate.description,
        sql: candidate.sql || "",
        score: result.score,
        reasons:
          reasons.length > 0
            ? reasons
            : ["This is the closest available existing SQL pattern."],
        support: candidate.support,
        detectedIntent: groundingContext.detectedIntent,
        candidateIntent: candidate.candidateIntent,
        unsupportedReasons: candidate.unsupportedReasons,
        warnings: candidate.warnings,
        verifiedJoinKeys: candidate.verifiedJoinKeys,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.support === b.support ? 0 : a.support === "supported" ? -1 : 1) ||
        a.title.localeCompare(b.title),
    )
    .slice(0, 3);
};
