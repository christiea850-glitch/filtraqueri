/**
 * T-11C-2 — SQL candidate normalization acceptance fixtures.
 *
 * The project does not currently include a test runner, so this file exports
 * fixtures and a pure runner that can be imported by a future runner or dev
 * console. The runner performs no I/O and never exits the process.
 */

import type { ReportOpportunity } from "../reportIntelligencePlanner";
import { normalizeCandidates, type GroundedSqlCandidate } from "../sqlCandidateGrounding";
import type { SqlReportRecipe } from "../sqlReportRecipes";
import type { SqlAssistantTemplate } from "../sqlTemplateLibrary";

type CandidateGroundingFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type CandidateGroundingFixtureReport = {
  results: CandidateGroundingFixtureResult[];
  passed: CandidateGroundingFixtureResult[];
  failed: CandidateGroundingFixtureResult[];
};

const placeholderReason = "Template uses placeholder fields that are not bound to your workbook.";

const baseTemplate = (overrides: Partial<SqlAssistantTemplate>): SqlAssistantTemplate => ({
  id: "basic-filter",
  title: "Basic filter",
  category: "Filtering",
  explanation: "Filter rows by a selected column.",
  dialectLabel: "DuckDB",
  sql: 'SELECT * FROM "leases"',
  ...overrides,
});

const baseRecipe = (overrides: Partial<SqlReportRecipe>): SqlReportRecipe => ({
  id: "lease-expiration-watchlist",
  title: "Lease expiration / move-out watchlist",
  businessPurpose: "Find leases approaching expiration or move-out dates.",
  requiredFieldRoles: ["lease end date"],
  sqlPatterns: ["date window", "join"],
  dialectSupportNote: "DuckDB SQL",
  supportSummary: "Ready to generate SQL.",
  sql: 'SELECT "lease_id" FROM "leases"',
  warnings: [],
  missingRequirements: [],
  worksheetsUsed: ["leases"],
  ...overrides,
});

const baseOpportunity = (overrides: Partial<ReportOpportunity>): ReportOpportunity => ({
  id: "compiled:lease-expiration-watchlist",
  title: "Lease expiration / move-out watchlist",
  businessQuestion: "Which leases are approaching expiration or move-out dates?",
  whyItMatters: "Helps plan renewals and move-outs.",
  domains: ["property"],
  confidence: 0.9,
  support: "can_generate_now",
  method: "sql",
  complexity: "intermediate",
  needsJoins: true,
  needsAggregation: false,
  needsDateLogic: true,
  needsAnomalyDetection: false,
  requiredTables: ["leases"],
  optionalTables: [],
  requiredColumns: ["lease end date"],
  optionalColumns: [],
  missingRequirements: [],
  sql: 'SELECT "lease_id" FROM "leases"',
  compiledRecipeId: "lease-expiration-watchlist",
  ...overrides,
});

const getOnlyCandidate = (candidates: GroundedSqlCandidate[]): GroundedSqlCandidate | null =>
  candidates.length === 1 ? candidates[0] : null;

const expect = (name: string, condition: boolean, failureReason: string): CandidateGroundingFixtureResult => ({
  name,
  ok: condition,
  failureReasons: condition ? [] : [failureReason],
});

export function runSqlCandidateGroundingFixtures(): CandidateGroundingFixtureReport {
  const joinTemplateCandidate = getOnlyCandidate(
    normalizeCandidates({
      templates: [
        baseTemplate({
          id: "generic-join",
          title: "Generic join",
          category: "Joins",
          explanation: "Join another table.",
          sql: 'SELECT * FROM "leases" INNER JOIN other_table ON "leases"."id" = other_table."id"',
        }),
      ],
    }),
  );

  const columnTemplateCandidate = getOnlyCandidate(
    normalizeCandidates({
      templates: [
        baseTemplate({
          id: "generic-column-filter",
          sql: 'SELECT * FROM "leases" WHERE column_name IS NOT NULL',
        }),
      ],
    }),
  );

  const supportedRecipeCandidate = getOnlyCandidate(
    normalizeCandidates({ recipes: [baseRecipe({ id: "vacant-units-by-property" })] }),
  );

  const deduplicatedCandidates = normalizeCandidates({
    recipes: [baseRecipe({ id: "lease-expiration-watchlist" })],
    opportunities: [baseOpportunity({ compiledRecipeId: "lease-expiration-watchlist" })],
  });

  const firstStableRun = normalizeCandidates({
    recipes: [baseRecipe({ id: "rent-payment-summary" })],
    opportunities: [baseOpportunity({ id: "payments", compiledRecipeId: undefined })],
    templates: [baseTemplate({ id: "basic-filter" })],
  }).map((candidate) => candidate.candidateId);
  const secondStableRun = normalizeCandidates({
    recipes: [baseRecipe({ id: "rent-payment-summary" })],
    opportunities: [baseOpportunity({ id: "payments", compiledRecipeId: undefined })],
    templates: [baseTemplate({ id: "basic-filter" })],
  }).map((candidate) => candidate.candidateId);

  const results: CandidateGroundingFixtureResult[] = [
    expect(
      "generic JOIN template containing other_table is unsupported",
      joinTemplateCandidate?.support === "unsupported" &&
        joinTemplateCandidate.unsupportedReasons.includes(placeholderReason),
      "Expected generic JOIN template with other_table to be unsupported with the placeholder reason.",
    ),
    expect(
      "generic template containing column_name is unsupported",
      columnTemplateCandidate?.support === "unsupported" &&
        columnTemplateCandidate.unsupportedReasons.includes(placeholderReason),
      "Expected generic template with column_name to be unsupported with the placeholder reason.",
    ),
    expect(
      "SQL-bearing recipe is supported unless already unsupported",
      supportedRecipeCandidate?.support === "supported" && supportedRecipeCandidate.sql !== null,
      "Expected SQL-bearing recipe with no missing requirements to normalize as supported.",
    ),
    expect(
      "recipe/opportunity duplicate returns one candidate and recipe wins",
      deduplicatedCandidates.length === 1 && deduplicatedCandidates[0]?.source === "recipe",
      "Expected duplicate recipe/opportunity slug to keep only the recipe candidate.",
    ),
    expect(
      "candidateId is stable across repeated normalization calls",
      JSON.stringify(firstStableRun) === JSON.stringify(secondStableRun),
      "Expected repeated normalization calls to produce identical candidateId sequences.",
    ),
  ];

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export function allSqlCandidateGroundingFixturesPass(): boolean {
  return runSqlCandidateGroundingFixtures().failed.length === 0;
}
