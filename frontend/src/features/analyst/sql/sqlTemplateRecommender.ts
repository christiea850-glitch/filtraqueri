import type { DatasetMetadata } from "../../dataset/datasetTypes";
import type { ReportOpportunity } from "./reportIntelligencePlanner";
import type { SqlReportRecipe } from "./sqlReportRecipes";
import type { SqlAssistantTemplate } from "./sqlTemplateLibrary";

export type SqlTemplateRecommendationKind = "template" | "report";

export type SqlTemplateRecommendation = {
  id: string;
  kind: SqlTemplateRecommendationKind;
  title: string;
  description: string;
  sql: string;
  score: number;
  reasons: string[];
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
  const candidates: Candidate[] = [
    ...templates.map((template) => ({
      id: template.id,
      kind: "template" as const,
      title: template.title,
      description: template.explanation,
      sql: template.sql,
      categoryText: template.category,
      metadataText: template.dialectLabel,
      tableText: template.sql,
      reportLike: false,
    })),
    ...recipes.map((recipe) => ({
      id: recipe.id,
      kind: "report" as const,
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
    })),
    ...opportunities.map((opportunity) => ({
      id: opportunity.id,
      kind: "report" as const,
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
    })),
  ];

  return candidates
    .filter((candidate) => Boolean(candidate.sql))
    .map((candidate) => {
      const result = scoreCandidate({
        candidate,
        promptTokens,
        scopeLabels: appliedScopeLabels,
        worksheetLabels,
        columnNames,
        promptSoundsLikeReport,
      });

      return {
        id: candidate.id,
        kind: candidate.kind,
        title: candidate.title,
        description: candidate.description,
        sql: candidate.sql || "",
        score: result.score,
        reasons:
          result.reasons.length > 0
            ? result.reasons
            : ["This is the closest available existing SQL pattern."],
      };
    })
    .filter((recommendation) => recommendation.score >= 12)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 3);
};
