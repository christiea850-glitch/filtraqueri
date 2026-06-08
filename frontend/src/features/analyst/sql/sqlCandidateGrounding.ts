/**
 * T-11C-2 — SQL candidate normalization for future business-intent grounding.
 *
 * This module is intentionally pure and not wired into Task Assist yet. It
 * converts templates, compiled report recipes, and report opportunities into a
 * common shape that later T-11C slices can ground against applied workbook
 * scope, verified columns, and verified join keys.
 */

import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { AcceptedRelationshipContract } from "../../workbook";
import type { ReportOpportunity } from "./reportIntelligencePlanner";
import {
  EMPTY_BUSINESS_INTENT,
  describeBusinessIntentAmbiguity,
  detectBusinessIntent,
  fingerprintBusinessIntent,
  type BusinessIntent,
} from "./businessIntentGrounding";
import type { SqlReportRecipe } from "./sqlReportRecipes";
import type { SqlAssistantTemplate } from "./sqlTemplateLibrary";

export type RequiredJoinKey = {
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
};

export type VerifiedJoinKey = RequiredJoinKey & {
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
  requiredJoins?: RequiredJoinKey[];
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

export type GroundingContext = {
  detectedIntent: BusinessIntent;
  appliedScopeTables: string[];
  schemaByTable: Map<string, SchemaColumn[]>;
  acceptedRelationshipContracts: AcceptedRelationshipContract[];
};

export type NeedsReviewCopy = {
  eyebrow: "Needs review";
  title: string;
  body: string;
  reasons: string[];
};

export const EMPTY_GROUNDED_SQL_CANDIDATES: GroundedSqlCandidate[] = [];

export const EMPTY_GROUNDING_CONTEXT: GroundingContext = {
  detectedIntent: EMPTY_BUSINESS_INTENT,
  appliedScopeTables: [],
  schemaByTable: new Map<string, SchemaColumn[]>(),
  acceptedRelationshipContracts: [],
};

export const EMPTY_NEEDS_REVIEW_COPY: NeedsReviewCopy = {
  eyebrow: "Needs review",
  title: "Review this SQL suggestion before running it.",
  body: "This suggestion is not blocked, but it has assumptions that should be verified against your workbook.",
  reasons: [],
};

export const PLACEHOLDER_UNSUPPORTED_REASON =
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
      values.map((value) => value.trim()).filter((value) => value.length > 0),
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

const candidateIntentFrom = (
  title: string,
  description: string,
): BusinessIntent => detectBusinessIntent(`${title} ${description}`.trim());

const containsPlaceholderSqlToken = (sql: string | null): boolean => {
  if (!sql) return false;
  return placeholderSqlTokens.some((token) => {
    const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(
      `(^|[^A-Za-z0-9])${escapedToken}([^A-Za-z0-9]|$)`,
      "i",
    ).test(sql);
  });
};

const mergeUnsupportedReason = (
  unsupportedReasons: readonly string[],
  reason: string,
): string[] =>
  unsupportedReasons.includes(reason)
    ? [...unsupportedReasons]
    : [...unsupportedReasons, reason];

const canonicalName = (value: string): string => value.trim().toLowerCase();

const sameName = (left: string, right: string): boolean =>
  canonicalName(left) === canonicalName(right);

const formatJoin = (join: RequiredJoinKey): string =>
  `${join.leftTable}.${join.leftColumn} → ${join.rightTable}.${join.rightColumn}`;

const parseColumnReference = (
  columnReference: string,
): { table: string | null; column: string } => {
  const normalizedReference = columnReference.trim().replace(/^"|"$/g, "");
  const parts = normalizedReference
    .split(".")
    .map((part) => part.trim().replace(/^"|"$/g, ""))
    .filter((part) => part.length > 0);

  if (parts.length >= 2) {
    return {
      table: parts.slice(0, -1).join("."),
      column: parts[parts.length - 1],
    };
  }

  return { table: null, column: normalizedReference };
};

const columnExists = (
  schemaByTable: Map<string, SchemaColumn[]>,
  table: string,
  column: string,
): boolean => {
  const schema = Array.from(schemaByTable.entries()).find(([tableName]) =>
    sameName(tableName, table),
  )?.[1];
  return Boolean(
    schema?.some((schemaColumn) => sameName(schemaColumn.name, column)),
  );
};

const findUnqualifiedColumnMatches = (
  column: string,
  appliedScopeTables: readonly string[],
  schemaByTable: Map<string, SchemaColumn[]>,
): string[] =>
  appliedScopeTables.filter((table) =>
    columnExists(schemaByTable, table, column),
  );

const joinMatches = (
  left: RequiredJoinKey,
  right: RequiredJoinKey,
): boolean => {
  const sameDirection =
    sameName(left.leftTable, right.leftTable) &&
    sameName(left.leftColumn, right.leftColumn) &&
    sameName(left.rightTable, right.rightTable) &&
    sameName(left.rightColumn, right.rightColumn);
  const reverseDirection =
    sameName(left.leftTable, right.rightTable) &&
    sameName(left.leftColumn, right.rightColumn) &&
    sameName(left.rightTable, right.leftTable) &&
    sameName(left.rightColumn, right.leftColumn);

  return sameDirection || reverseDirection;
};

const contractToJoin = (
  contract: AcceptedRelationshipContract,
): RequiredJoinKey => ({
  leftTable: contract.sourceTableName,
  leftColumn: contract.sourceColumnName,
  rightTable: contract.targetTableName,
  rightColumn: contract.targetColumnName,
});

const hasAcceptedContractForJoin = (
  join: RequiredJoinKey,
  contracts: readonly AcceptedRelationshipContract[],
): boolean =>
  contracts.some(
    (contract) =>
      contract.status === "active" &&
      contract.validationState !== "broken" &&
      joinMatches(join, contractToJoin(contract)),
  );

const hasRecipeVerifiedJoin = (
  candidate: GroundedSqlCandidate,
  join: RequiredJoinKey,
): boolean =>
  candidate.verifiedJoinKeys.some(
    (verifiedJoin) =>
      verifiedJoin.source === "recipe_verified" &&
      joinMatches(join, verifiedJoin),
  );

const requiredJoinsForCandidate = (
  candidate: GroundedSqlCandidate,
): RequiredJoinKey[] => {
  if (candidate.requiredJoins && candidate.requiredJoins.length > 0)
    return candidate.requiredJoins;
  return candidate.verifiedJoinKeys
    .filter((join) => join.source !== "single_table" && join.source !== "none")
    .map(({ leftTable, leftColumn, rightTable, rightColumn }) => ({
      leftTable,
      leftColumn,
      rightTable,
      rightColumn,
    }));
};

const validateCandidateTables = (
  candidate: GroundedSqlCandidate,
  appliedScopeTables: readonly string[],
): string[] => {
  const tables = uniqueStrings([
    ...candidate.requiredTables,
    ...candidate.usedTables,
  ]);
  return tables
    .filter(
      (table) =>
        !appliedScopeTables.some((scopeTable) => sameName(scopeTable, table)),
    )
    .map(
      (table) =>
        `Required table \`${table}\` is not in this tab's applied scope.`,
    );
};

const validateCandidateColumns = (
  candidate: GroundedSqlCandidate,
  context: GroundingContext,
): { unsupportedReasons: string[]; warnings: string[] } => {
  const columnReferences = uniqueStrings([
    ...candidate.requiredColumns,
    ...candidate.usedColumns,
  ]);
  const unsupportedReasons: string[] = [];
  const warnings: string[] = [];

  for (const columnReference of columnReferences) {
    const { table, column } = parseColumnReference(columnReference);

    if (table) {
      if (!columnExists(context.schemaByTable, table, column)) {
        unsupportedReasons.push(
          `Required column \`${table}.${column}\` was not found in this tab's applied schema.`,
        );
      }
      continue;
    }

    const matches = findUnqualifiedColumnMatches(
      column,
      context.appliedScopeTables,
      context.schemaByTable,
    );
    if (matches.length === 0) {
      unsupportedReasons.push(
        `Required column \`${column}\` was not found in this tab's applied schema.`,
      );
    } else if (matches.length > 1) {
      warnings.push(
        `Required column \`${column}\` is ambiguous across ${matches
          .map((table) => `\`${table}\``)
          .join(", ")}; qualify it with a table before running.`,
      );
    }
  }

  return {
    unsupportedReasons: uniqueStrings(unsupportedReasons),
    warnings: uniqueStrings(warnings),
  };
};

const validateCandidateIntent = (
  candidate: GroundedSqlCandidate,
  detectedIntent: BusinessIntent,
): { unsupportedReasons: string[]; warnings: string[] } => {
  const candidateIntent = candidate.candidateIntent.primaryIntent;
  if (candidateIntent === detectedIntent.primaryIntent) {
    return { unsupportedReasons: [], warnings: [] };
  }

  if (detectedIntent.alternates.includes(candidateIntent)) {
    return {
      unsupportedReasons: [],
      warnings: [
        `This task has ambiguous intent; \`${candidateIntent}\` matched an alternate interpretation. Review before running.`,
      ],
    };
  }

  return {
    unsupportedReasons: [
      `Not recommended: this candidate is for \`${candidateIntent}\`, but your task asks for \`${detectedIntent.primaryIntent}\`.`,
    ],
    warnings: [],
  };
};

const validateCandidateJoins = (
  candidate: GroundedSqlCandidate,
  context: GroundingContext,
): {
  verifiedJoinKeys: VerifiedJoinKey[];
  unsupportedReasons: string[];
  warnings: string[];
  support: CandidateSupport;
} => {
  const tables = uniqueStrings([
    ...candidate.requiredTables,
    ...candidate.usedTables,
  ]);
  const requiredJoins = requiredJoinsForCandidate(candidate);

  if (tables.length <= 1 && requiredJoins.length === 0) {
    return {
      verifiedJoinKeys:
        candidate.verifiedJoinKeys.length > 0
          ? [...candidate.verifiedJoinKeys]
          : [],
      unsupportedReasons: [],
      warnings: [],
      support: "supported",
    };
  }

  let support: CandidateSupport = "supported";
  let verifiedJoinKeys = [...candidate.verifiedJoinKeys];
  const unsupportedReasons: string[] = [];
  const warnings: string[] = [];

  for (const join of requiredJoins) {
    if (
      hasAcceptedContractForJoin(join, context.acceptedRelationshipContracts)
    ) {
      verifiedJoinKeys = [
        ...verifiedJoinKeys.filter(
          (verifiedJoin) => !joinMatches(verifiedJoin, join),
        ),
        { ...join, source: "accepted_contract" },
      ];
      continue;
    }

    if (hasRecipeVerifiedJoin(candidate, join)) {
      support = support === "unsupported" ? support : "needs_review";
      verifiedJoinKeys = [
        ...verifiedJoinKeys.filter(
          (verifiedJoin) => !joinMatches(verifiedJoin, join),
        ),
        { ...join, source: "recipe_verified" },
      ];
      warnings.push(
        `Join \`${formatJoin(join)}\` is not verified by relationship contracts. Review before running.`,
      );
      continue;
    }

    support = "unsupported";
    verifiedJoinKeys = [
      ...verifiedJoinKeys.filter(
        (verifiedJoin) => !joinMatches(verifiedJoin, join),
      ),
      { ...join, source: "none" },
    ];
    unsupportedReasons.push(
      `Join key \`${formatJoin(join)}\` could not be verified.`,
    );
  }

  return {
    verifiedJoinKeys,
    unsupportedReasons: uniqueStrings(unsupportedReasons),
    warnings: uniqueStrings(warnings),
    support,
  };
};

const applyPlaceholderSupport = (
  candidate: GroundedSqlCandidate,
): GroundedSqlCandidate => {
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

export function getNeedsReviewCopy(
  candidate: GroundedSqlCandidate | null | undefined,
): NeedsReviewCopy {
  if (!candidate || candidate.support !== "needs_review") {
    return EMPTY_NEEDS_REVIEW_COPY;
  }

  const reasons = uniqueStrings(candidate.warnings);
  return {
    eyebrow: "Needs review",
    title: `Review \`${candidate.title}\` before running it.`,
    body:
      reasons.length > 0
        ? "This suggestion is available, but one or more grounding checks require human review."
        : EMPTY_NEEDS_REVIEW_COPY.body,
    reasons,
  };
}

export function fingerprintGroundingContext(context: GroundingContext): string {
  return JSON.stringify({
    detectedIntent: fingerprintBusinessIntent(context.detectedIntent),
    appliedScopeTables: uniqueStrings(context.appliedScopeTables).sort(),
    schemaByTable: Array.from(context.schemaByTable.entries())
      .map(([tableName, columns]) => [
        canonicalName(tableName),
        uniqueStrings(columns.map((column) => column.name)).sort(),
      ])
      .sort(([left], [right]) => String(left).localeCompare(String(right))),
    acceptedRelationshipContracts: context.acceptedRelationshipContracts
      .filter(
        (contract) =>
          contract.status === "active" && contract.validationState !== "broken",
      )
      .map(contractToJoin)
      .map(formatJoin)
      .sort(),
  });
}

export function fingerprintSqlCandidate(candidate: GroundedSqlCandidate): string {
  return JSON.stringify({
    candidateId: candidate.candidateId,
    source: candidate.source,
    title: candidate.title.trim(),
    description: candidate.description.trim(),
    sql: candidate.sql?.trim() || null,
    candidateIntent: fingerprintBusinessIntent(candidate.candidateIntent),
    requiredTables: uniqueStrings(candidate.requiredTables).sort(),
    usedTables: uniqueStrings(candidate.usedTables).sort(),
    requiredColumns: uniqueStrings(candidate.requiredColumns).sort(),
    usedColumns: uniqueStrings(candidate.usedColumns).sort(),
    requiredJoins: (candidate.requiredJoins || []).map(formatJoin).sort(),
    verifiedJoinKeys: candidate.verifiedJoinKeys
      .map((join) => `${formatJoin(join)}:${join.source}`)
      .sort(),
    support: candidate.support,
    unsupportedReasons: uniqueStrings(candidate.unsupportedReasons).sort(),
    warnings: uniqueStrings(candidate.warnings).sort(),
  });
}

const normalizeTemplate = (
  template: SqlAssistantTemplate,
): GroundedSqlCandidate =>
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
        recipe.supportSummary ||
          "Recipe cannot generate SQL with the available fields.",
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
    support:
      recipe.sql && missingRequirements.length === 0
        ? "supported"
        : "unsupported",
    unsupportedReasons,
    warnings,
  });
};

const normalizeOpportunity = (
  opportunity: ReportOpportunity,
): GroundedSqlCandidate => {
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
    candidateIntent: candidateIntentFrom(
      opportunity.title,
      opportunity.businessQuestion,
    ),
    requiredTables: uniqueStrings(opportunity.requiredTables),
    usedTables: uniqueStrings(opportunity.requiredTables),
    requiredColumns: uniqueStrings(opportunity.requiredColumns),
    usedColumns: [],
    verifiedJoinKeys: [],
    support:
      opportunity.support === "can_generate_now" &&
      opportunity.sql &&
      missingRequirements.length === 0
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

    if (
      !existingCandidate ||
      sourcePriority[candidate.source] <
        sourcePriority[existingCandidate.source]
    ) {
      candidatesBySlug.set(slug, candidate);
    }
  }

  return Array.from(candidatesBySlug.values()).sort(
    (left, right) => sourcePriority[left.source] - sourcePriority[right.source],
  );
}

/**
 * Validate a normalized SQL candidate against a detected business intent and
 * the active SQL tab's applied workbook scope. This is frontend-only,
 * deterministic, side-effect free, and intentionally not wired into the
 * recommender or execution path yet.
 */
export function groundCandidate(
  candidate: GroundedSqlCandidate,
  context: GroundingContext,
): GroundedSqlCandidate {
  if (candidate.support === "unsupported") {
    return {
      ...candidate,
      unsupportedReasons: uniqueStrings(candidate.unsupportedReasons),
      warnings: uniqueStrings(candidate.warnings),
    };
  }

  const columnValidation = validateCandidateColumns(candidate, context);
  const intentValidation = validateCandidateIntent(
    candidate,
    context.detectedIntent,
  );
  const hardGateReasons = uniqueStrings([
    ...validateCandidateTables(candidate, context.appliedScopeTables),
    ...columnValidation.unsupportedReasons,
    ...intentValidation.unsupportedReasons,
  ]);
  const ambiguity = describeBusinessIntentAmbiguity(context.detectedIntent);
  const ambiguityWarnings =
    ambiguity.isAmbiguous && hardGateReasons.length === 0
      ? [
          `Task intent is ambiguous (${ambiguity.reviewIntents.join(", ")}); review the suggestion before running.`,
        ]
      : [];
  const reviewWarnings = uniqueStrings([
    ...columnValidation.warnings,
    ...intentValidation.warnings,
    ...ambiguityWarnings,
  ]);
  const unsupportedReasons = uniqueStrings([
    ...candidate.unsupportedReasons,
    ...hardGateReasons,
  ]);

  if (hardGateReasons.length > 0) {
    return {
      ...candidate,
      support: "unsupported",
      unsupportedReasons,
      warnings: uniqueStrings([...candidate.warnings, ...reviewWarnings]),
    };
  }

  const joinValidation = validateCandidateJoins(candidate, context);
  const groundedUnsupportedReasons = uniqueStrings([
    ...unsupportedReasons,
    ...joinValidation.unsupportedReasons,
  ]);
  const warnings = uniqueStrings([
    ...candidate.warnings,
    ...reviewWarnings,
    ...joinValidation.warnings,
  ]);
  const needsReview =
    warnings.length > 0 || joinValidation.support === "needs_review";

  return {
    ...candidate,
    support:
      groundedUnsupportedReasons.length > 0
        ? "unsupported"
        : needsReview
          ? "needs_review"
          : "supported",
    unsupportedReasons: groundedUnsupportedReasons,
    warnings,
    verifiedJoinKeys: joinValidation.verifiedJoinKeys,
  };
}
