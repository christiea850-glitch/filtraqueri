/**
 * T-11C-2 — SQL candidate normalization for future business-intent grounding.
 *
 * This module is intentionally pure and not wired into Task Assist yet. It
 * converts templates, compiled report recipes, and report opportunities into a
 * common shape that later T-11C slices can ground against applied workbook
 * scope, verified columns, and verified join keys.
 */

import type { ReportOpportunity } from "./reportIntelligencePlanner";
import {
  detectBusinessIntent,
  type BusinessIntent,
} from "./businessIntentGrounding";
import type { SqlReportRecipe } from "./sqlReportRecipes";
import type { SqlAssistantTemplate } from "./sqlTemplateLibrary";

export type VerifiedJoinKey = {
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  source: "accepted_contract" | "recipe_verified" | "single_table" | "none";
};

export type CandidateSupport = "supported" | "needs_review" | "unsupported";

export type GroundedSqlCandidate = {
  candidateId: string;
  source: "template" | "recipe" | "opportunity";
  title: string;
  description: string;
  sql: string | null;
  candidateIntent: BusinessIntent;
  requiredTables: string[];
  usedTables: string[];
  requiredColumns: string[];
  usedColumns: string[];
  verifiedJoinKeys: VerifiedJoinKey[];
  support: CandidateSupport;
  unsupportedReasons: string[];
  warnings: string[];
};

export type NormalizeSqlCandidatesInput = {
  templates?: readonly SqlAssistantTemplate[];
  recipes?: readonly SqlReportRecipe[];
  opportunities?: readonly ReportOpportunity[];
};

const PLACEHOLDER_UNSUPPORTED_REASON =
  "Template uses placeholder fields that are not bound to your workbook.";

const placeholderSqlTokens = [
  "other_table",
  "column_name",
  "table_name",
  "your_column",
  "your_table",
];

const sourcePriority: Record<GroundedSqlCandidate["source"], number> = {
  recipe: 0,
  opportunity: 1,
  template: 2,
};

const uniqueStrings = (values: readonly string[] = []): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );

const stableSlug = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "untitled";
};

const candidateIntentFrom = (title: string, description: string): BusinessIntent =>
  detectBusinessIntent(`${title} ${description}`.trim());

const containsPlaceholderSqlToken = (sql: string | null): boolean => {
  if (!sql) return false;
  return placeholderSqlTokens.some((token) => {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^A-Za-z0-9])${escapedToken}([^A-Za-z0-9]|$)`, "i").test(sql);
  });
};

const mergeUnsupportedReason = (
  unsupportedReasons: readonly string[],
  reason: string,
): string[] => (unsupportedReasons.includes(reason) ? [...unsupportedReasons] : [...unsupportedReasons, reason]);

const applyPlaceholderSupport = (candidate: GroundedSqlCandidate): GroundedSqlCandidate => {
  if (!containsPlaceholderSqlToken(candidate.sql)) return candidate;

  return {
    ...candidate,
    support: "unsupported",
    unsupportedReasons: mergeUnsupportedReason(
      candidate.unsupportedReasons,
      PLACEHOLDER_UNSUPPORTED_REASON,
    ),
  };
};

const normalizeTemplate = (template: SqlAssistantTemplate): GroundedSqlCandidate =>
  applyPlaceholderSupport({
    candidateId: `template:${stableSlug(template.id || template.title)}`,
    source: "template",
    title: template.title,
    description: template.explanation,
    sql: template.sql,
    candidateIntent: candidateIntentFrom(template.title, template.explanation),
    requiredTables: [],
    usedTables: [],
    requiredColumns: [],
    usedColumns: [],
    verifiedJoinKeys: [],
    support: "supported",
    unsupportedReasons: [],
    warnings: [],
  });

const normalizeRecipe = (recipe: SqlReportRecipe): GroundedSqlCandidate => {
  const missingRequirements = uniqueStrings(recipe.missingRequirements);
  const warnings = uniqueStrings(recipe.warnings);
  const unsupportedReasons = recipe.sql
    ? missingRequirements
    : uniqueStrings([
        ...missingRequirements,
        recipe.supportSummary || "Recipe cannot generate SQL with the available fields.",
      ]);

  return applyPlaceholderSupport({
    candidateId: `recipe:${stableSlug(recipe.id || recipe.title)}`,
    source: "recipe",
    title: recipe.title,
    description: recipe.businessPurpose,
    sql: recipe.sql,
    candidateIntent: candidateIntentFrom(recipe.title, recipe.businessPurpose),
    requiredTables: uniqueStrings(recipe.worksheetsUsed || []),
    usedTables: uniqueStrings(recipe.worksheetsUsed || []),
    requiredColumns: uniqueStrings(recipe.requiredFieldRoles),
    usedColumns: [],
    verifiedJoinKeys: [],
    support: recipe.sql && missingRequirements.length === 0 ? "supported" : "unsupported",
    unsupportedReasons,
    warnings,
  });
};

const normalizeOpportunity = (opportunity: ReportOpportunity): GroundedSqlCandidate => {
  const missingRequirements = uniqueStrings(opportunity.missingRequirements);
  const unsupportedReasons = opportunity.sql
    ? missingRequirements
    : uniqueStrings([
        ...missingRequirements,
        opportunity.support === "needs_missing_fields"
          ? "Report opportunity is missing required fields."
          : "Report opportunity cannot generate SQL yet.",
      ]);

  return applyPlaceholderSupport({
    candidateId: `opportunity:${stableSlug(opportunity.compiledRecipeId || opportunity.id || opportunity.title)}`,
    source: "opportunity",
    title: opportunity.title,
    description: opportunity.businessQuestion,
    sql: opportunity.sql,
    candidateIntent: candidateIntentFrom(opportunity.title, opportunity.businessQuestion),
    requiredTables: uniqueStrings(opportunity.requiredTables),
    usedTables: uniqueStrings(opportunity.requiredTables),
    requiredColumns: uniqueStrings(opportunity.requiredColumns),
    usedColumns: [],
    verifiedJoinKeys: [],
    support:
      opportunity.support === "can_generate_now" && opportunity.sql && missingRequirements.length === 0
        ? "supported"
        : "unsupported",
    unsupportedReasons,
    warnings: [],
  });
};

const candidateDedupSlug = (candidate: GroundedSqlCandidate): string => {
  const [, slug = candidate.candidateId] = candidate.candidateId.split(":");
  return slug;
};

/**
 * Normalize SQL templates, report recipes, and report opportunities into a
 * stable candidate shape. This is not a grounding validator: it does not check
 * applied scope, real workbook tables, verified columns, or join keys.
 */
export function normalizeCandidates({
  templates = [],
  recipes = [],
  opportunities = [],
}: NormalizeSqlCandidatesInput): GroundedSqlCandidate[] {
  const orderedCandidates = [
    ...recipes.map(normalizeRecipe),
    ...opportunities.map(normalizeOpportunity),
    ...templates.map(normalizeTemplate),
  ];
  const candidatesBySlug = new Map<string, GroundedSqlCandidate>();

  for (const candidate of orderedCandidates) {
    const slug = candidateDedupSlug(candidate);
    const existingCandidate = candidatesBySlug.get(slug);

    if (!existingCandidate || sourcePriority[candidate.source] < sourcePriority[existingCandidate.source]) {
      candidatesBySlug.set(slug, candidate);
    }
  }

  return Array.from(candidatesBySlug.values()).sort(
    (left, right) => sourcePriority[left.source] - sourcePriority[right.source],
  );
}
