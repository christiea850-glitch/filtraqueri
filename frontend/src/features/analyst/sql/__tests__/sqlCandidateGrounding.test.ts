/**
 * T-11C-2 — SQL candidate normalization acceptance fixtures.
 *
 * The project does not currently include a test runner, so this file exports
 * fixtures and a pure runner that can be imported by a future runner or dev
 * console. The runner performs no I/O and never exits the process.
 */

import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type { AcceptedRelationshipContract } from "../../../workbook";
import type { ReportOpportunity } from "../reportIntelligencePlanner";
import { detectBusinessIntent } from "../businessIntentGrounding";
import {
  groundCandidate,
  normalizeCandidates,
  type GroundedSqlCandidate,
} from "../sqlCandidateGrounding";
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

const placeholderReason =
  "Template uses placeholder fields that are not bound to your workbook.";
const scopeReason =
  "Required table `payments` is not in this tab's applied scope.";
const missingColumnReason =
  "Required column `leases.move_out_date` was not found in this tab's applied schema.";
const intentMismatchReason =
  "Not recommended: this candidate is for `expiration`, but your task asks for `count_grouping`.";
const recipeJoinWarning =
  "Join `leases.tenant_id → tenants.tenant_id` is not verified by relationship contracts. Review before running.";

const schemaColumn = (name: string): SchemaColumn => ({
  name,
  type: "VARCHAR",
  inferred_type: "text",
  null_count: 0,
  unique_count: 1,
  sample_values: [],
});

const groundingSchema = new Map<string, SchemaColumn[]>([
  [
    "leases",
    [
      schemaColumn("lease_id"),
      schemaColumn("tenant_id"),
      schemaColumn("property_id"),
      schemaColumn("lease_end_date"),
    ],
  ],
  ["tenants", [schemaColumn("tenant_id"), schemaColumn("tenant_name")]],
  ["units", [schemaColumn("unit_id"), schemaColumn("property_id")]],
]);

const acceptedLeaseTenantContract: AcceptedRelationshipContract = {
  contractId: "contract:leases-tenants",
  sourceWorksheetId: "worksheet:leases",
  sourceTableName: "leases",
  sourceColumnName: "tenant_id",
  targetWorksheetId: "worksheet:tenants",
  targetTableName: "tenants",
  targetColumnName: "tenant_id",
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: "relationship:leases-tenants",
  acceptedAt: "2026-01-01T00:00:00.000Z",
  acceptedBy: null,
  status: "active",
  validationState: "valid",
  validationSummary: [],
  overlapRatio: 1,
  sourceUniqueRatio: 0.5,
  targetUniqueRatio: 1,
  inferredTypeCompatible: true,
  lastValidatedAt: "2026-01-01T00:00:00.000Z",
};

const baseGroundingContext = (
  overrides: {
    prompt?: string;
    appliedScopeTables?: string[];
    acceptedRelationshipContracts?: AcceptedRelationshipContract[];
    schemaByTable?: Map<string, SchemaColumn[]>;
  } = {},
) => ({
  detectedIntent: detectBusinessIntent(
    overrides.prompt || "Which leases are expiring in the next 90 days?",
  ),
  appliedScopeTables: overrides.appliedScopeTables || [
    "leases",
    "tenants",
    "units",
  ],
  schemaByTable: overrides.schemaByTable || groundingSchema,
  acceptedRelationshipContracts: overrides.acceptedRelationshipContracts || [],
});

const groundedCandidate = (
  overrides: Partial<GroundedSqlCandidate>,
): GroundedSqlCandidate => ({
  candidateId: "recipe:lease-expiration-watchlist",
  source: "recipe",
  title: "Lease expiration / move-out watchlist",
  description: "Find leases approaching expiration or move-out dates.",
  sql: 'SELECT "leases"."lease_id" FROM "leases"',
  candidateIntent: detectBusinessIntent(
    "Lease expiration / move-out watchlist Find leases approaching expiration or move-out dates.",
  ),
  requiredTables: ["leases"],
  usedTables: ["leases"],
  requiredColumns: ["leases.lease_end_date"],
  usedColumns: ["leases.lease_id"],
  verifiedJoinKeys: [],
  support: "supported",
  unsupportedReasons: [],
  warnings: [],
  ...overrides,
});

const baseTemplate = (
  overrides: Partial<SqlAssistantTemplate>,
): SqlAssistantTemplate => ({
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

const baseOpportunity = (
  overrides: Partial<ReportOpportunity>,
): ReportOpportunity => ({
  id: "compiled:lease-expiration-watchlist",
  title: "Lease expiration / move-out watchlist",
  businessQuestion:
    "Which leases are approaching expiration or move-out dates?",
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

const getOnlyCandidate = (
  candidates: GroundedSqlCandidate[],
): GroundedSqlCandidate | null =>
  candidates.length === 1 ? candidates[0] : null;

const expect = (
  name: string,
  condition: boolean,
  failureReason: string,
): CandidateGroundingFixtureResult => ({
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
    normalizeCandidates({
      recipes: [baseRecipe({ id: "vacant-units-by-property" })],
    }),
  );

  const deduplicatedCandidates = normalizeCandidates({
    recipes: [baseRecipe({ id: "lease-expiration-watchlist" })],
    opportunities: [
      baseOpportunity({ compiledRecipeId: "lease-expiration-watchlist" }),
    ],
  });

  const firstStableRun = normalizeCandidates({
    recipes: [baseRecipe({ id: "rent-payment-summary" })],
    opportunities: [
      baseOpportunity({ id: "payments", compiledRecipeId: undefined }),
    ],
    templates: [baseTemplate({ id: "basic-filter" })],
  }).map((candidate) => candidate.candidateId);
  const secondStableRun = normalizeCandidates({
    recipes: [baseRecipe({ id: "rent-payment-summary" })],
    opportunities: [
      baseOpportunity({ id: "payments", compiledRecipeId: undefined }),
    ],
    templates: [baseTemplate({ id: "basic-filter" })],
  }).map((candidate) => candidate.candidateId);

  const alreadyUnsupportedCandidate = groundCandidate(
    groundedCandidate({
      support: "unsupported",
      unsupportedReasons: [
        "Existing unsupported reason.",
        "Existing unsupported reason.",
      ],
    }),
    baseGroundingContext(),
  );

  const intentMismatchCandidate = groundCandidate(
    groundedCandidate({}),
    baseGroundingContext({
      prompt:
        "find the number of units in properties that are leased to tenants",
    }),
  );

  const outOfScopeCandidate = groundCandidate(
    groundedCandidate({
      requiredTables: ["leases", "payments"],
      usedTables: ["leases", "payments"],
    }),
    baseGroundingContext({ appliedScopeTables: ["leases", "tenants"] }),
  );

  const missingColumnCandidate = groundCandidate(
    groundedCandidate({ requiredColumns: ["leases.move_out_date"] }),
    baseGroundingContext(),
  );

  const acceptedContractCandidate = groundCandidate(
    groundedCandidate({
      requiredTables: ["leases", "tenants"],
      usedTables: ["leases", "tenants"],
      requiredJoins: [
        {
          leftTable: "leases",
          leftColumn: "tenant_id",
          rightTable: "tenants",
          rightColumn: "tenant_id",
        },
      ],
    }),
    baseGroundingContext({
      acceptedRelationshipContracts: [acceptedLeaseTenantContract],
    }),
  );

  const recipeVerifiedCandidate = groundCandidate(
    groundedCandidate({
      requiredTables: ["leases", "tenants"],
      usedTables: ["leases", "tenants"],
      requiredJoins: [
        {
          leftTable: "leases",
          leftColumn: "tenant_id",
          rightTable: "tenants",
          rightColumn: "tenant_id",
        },
      ],
      verifiedJoinKeys: [
        {
          leftTable: "leases",
          leftColumn: "tenant_id",
          rightTable: "tenants",
          rightColumn: "tenant_id",
          source: "recipe_verified",
        },
      ],
    }),
    baseGroundingContext(),
  );

  const singleTableCandidate = groundCandidate(
    groundedCandidate({
      title: "Count units by property",
      description: "Find the number of units in each property.",
      candidateIntent: detectBusinessIntent(
        "Find the number of units in each property.",
      ),
      requiredTables: ["units"],
      usedTables: ["units"],
      requiredColumns: ["units.property_id"],
      usedColumns: ["units.unit_id"],
    }),
    baseGroundingContext({
      prompt:
        "find the number of units in properties that are leased to tenants",
    }),
  );

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
      supportedRecipeCandidate?.support === "supported" &&
        supportedRecipeCandidate.sql !== null,
      "Expected SQL-bearing recipe with no missing requirements to normalize as supported.",
    ),
    expect(
      "recipe/opportunity duplicate returns one candidate and recipe wins",
      deduplicatedCandidates.length === 1 &&
        deduplicatedCandidates[0]?.source === "recipe",
      "Expected duplicate recipe/opportunity slug to keep only the recipe candidate.",
    ),
    expect(
      "candidateId is stable across repeated normalization calls",
      JSON.stringify(firstStableRun) === JSON.stringify(secondStableRun),
      "Expected repeated normalization calls to produce identical candidateId sequences.",
    ),
    expect(
      "already unsupported candidate remains unsupported",
      alreadyUnsupportedCandidate.support === "unsupported" &&
        alreadyUnsupportedCandidate.unsupportedReasons.length === 1 &&
        alreadyUnsupportedCandidate.unsupportedReasons.includes(
          "Existing unsupported reason.",
        ),
      "Expected existing unsupported candidates to remain unsupported while preserving deduped reasons.",
    ),
    expect(
      "count-grouping prompt rejects lease expiration watchlist intent",
      intentMismatchCandidate.support === "unsupported" &&
        intentMismatchCandidate.unsupportedReasons.includes(
          intentMismatchReason,
        ),
      "Expected lease expiration candidate to be unsupported for a count_grouping task.",
    ),
    expect(
      "candidate requiring table outside applied scope is unsupported",
      outOfScopeCandidate.support === "unsupported" &&
        outOfScopeCandidate.unsupportedReasons.includes(scopeReason),
      "Expected out-of-scope required table to make the candidate unsupported.",
    ),
    expect(
      "candidate requiring missing column is unsupported",
      missingColumnCandidate.support === "unsupported" &&
        missingColumnCandidate.unsupportedReasons.includes(missingColumnReason),
      "Expected missing required column to make the candidate unsupported.",
    ),
    expect(
      "expiration candidate with accepted contract is supported",
      acceptedContractCandidate.support === "supported" &&
        acceptedContractCandidate.verifiedJoinKeys.some(
          (join) => join.source === "accepted_contract",
        ),
      "Expected accepted relationship contract to verify the required join and keep support supported.",
    ),
    expect(
      "expiration candidate with only recipe-verified join needs review",
      recipeVerifiedCandidate.support === "needs_review" &&
        recipeVerifiedCandidate.warnings.includes(recipeJoinWarning),
      "Expected recipe-verified join without an accepted contract to need review with a warning.",
    ),
    expect(
      "single-table grounded candidate stays supported without join validation",
      singleTableCandidate.support === "supported" &&
        singleTableCandidate.unsupportedReasons.length === 0,
      "Expected single-table candidate to remain supported without join verification.",
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
