/** PS-8c - explicit natural-language multi-filter AND grounding fixtures. */

import type { AcceptedRelationshipContract, WorksheetMetadata } from "../../../workbook";
import type { SchemaColumn } from "../../../dataset/datasetTypes";
import { detectBusinessIntent } from "../businessIntentGrounding";
import {
  createProposedRowFilterId,
  detectRowFilterShells,
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
  type ProposedFilter,
} from "../adaptiveReportProposal";
import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import {
  createBusinessSqlFilterGroupId,
  createBusinessSqlFilterId,
  resolveBusinessSqlFilterCombinator,
} from "../businessSqlQueryPlan";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import { renderBusinessSqlQueryPlan } from "../businessSqlRenderer";

type FixtureResult = { name: string; ok: boolean; failureReasons: string[] };
type Fixture = { name: string; assert: () => string[] };

const column = (name: string, inferred_type: SchemaColumn["inferred_type"]): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "DOUBLE" : inferred_type === "boolean" ? "BOOLEAN" : "VARCHAR",
  inferred_type,
  null_count: 0,
  unique_count: 0,
  sample_values: [],
});

const worksheet = (
  tableName: string,
  schema: readonly SchemaColumn[],
): Pick<WorksheetMetadata, "worksheetId" | "displayName" | "sheetName" | "tableName" | "schema"> => ({
  worksheetId: tableName,
  displayName: tableName,
  sheetName: tableName,
  tableName,
  schema: [...schema],
});

const orders = worksheet("orders", [
  column("order_id", "categorical"),
  column("customer_id", "categorical"),
  column("status", "categorical"),
  column("priority", "categorical"),
  column("region", "categorical"),
  column("amount", "numeric"),
  column("order_date", "date"),
  column("deleted_at", "date"),
  column("description", "text"),
  column("approved", "boolean"),
]);

const customers = worksheet("customers", [
  column("customer_id", "categorical"),
  column("signup_date", "date"),
  column("renewal_date", "date"),
  column("customer_name", "text"),
]);

const ambiguous = worksheet("orders_archive", [
  column("status", "categorical"),
  column("order_id", "categorical"),
]);

const ordersCustomersContract: AcceptedRelationshipContract = {
  contractId: "contract:orders:customers",
  sourceWorksheetId: "orders",
  sourceTableName: "orders",
  sourceColumnName: "customer_id",
  targetWorksheetId: "customers",
  targetTableName: "customers",
  targetColumnName: "customer_id",
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: "candidate:orders:customers",
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

const proposalFor = (
  prompt: string,
  worksheets = [orders],
  contracts: readonly AcceptedRelationshipContract[] = [],
): AdaptiveReportProposal =>
  proposeAdaptiveReport({
    prompt,
    detectedIntent: detectBusinessIntent(prompt),
    appliedScopeSelections: worksheets.map((sheet) => ({
      worksheetId: sheet.worksheetId,
      tableName: sheet.tableName,
      sourceType: "original" as const,
    })),
    worksheets,
    acceptedRelationshipContracts: contracts,
  });

const bridgeFor = (
  proposal: AdaptiveReportProposal,
  contracts: readonly AcceptedRelationshipContract[] = [],
) => createBusinessSqlPlanFromAdaptiveProposal({ proposal, acceptedRelationshipContracts: contracts });

const canonicalFilters = (proposal: AdaptiveReportProposal): ProposedFilter[] =>
  proposal.filters.filter((filter) => filter.semantics === "canonical");

const renderSqlFor = (
  prompt: string,
  worksheets = [orders],
  contracts: readonly AcceptedRelationshipContract[] = [],
): string | null => {
  const proposal = proposalFor(prompt, worksheets, contracts);
  const bridge = bridgeFor(proposal, contracts);
  return bridge.plan ? createBusinessSqlRenderPreview(bridge.plan).sql : null;
};

const noSqlFor = (
  prompt: string,
  worksheets = [orders],
  contracts: readonly AcceptedRelationshipContract[] = [],
): boolean => {
  const proposal = proposalFor(prompt, worksheets, contracts);
  const bridge = bridgeFor(proposal, contracts);
  const preview = bridge.plan ? createBusinessSqlRenderPreview(bridge.plan) : null;
  return !preview?.sql && !preview?.actions.canCopySql && !preview?.actions.canInsertSql && !preview?.actions.canRunSql;
};

const expect = (condition: boolean, message: string): string[] => condition ? [] : [message];
const shellCount = (prompt: string): number => {
  const shells = detectRowFilterShells(prompt);
  return shells.status === "detected" ? shells.shells.length : 0;
};
const shellOperators = (prompt: string): string[] => {
  const shells = detectRowFilterShells(prompt);
  return shells.status === "detected" ? shells.shells.map((shell) => shell.operator) : [];
};

const primaryPrompt = "Show order_id where status equals active and order_date is between 2026-01-01 and 2026-12-31.";
const primarySql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  `WHERE "orders"."status" = 'active'`,
  `  AND "orders"."order_date" BETWEEN DATE '2026-01-01' AND DATE '2026-12-31';`,
].join("\n");

const threePrompt = "Show order_id where status equals active and priority equals high and order_date is after 2026-01-01.";
const threeSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  `WHERE "orders"."status" = 'active'`,
  `  AND "orders"."priority" = 'high'`,
  `  AND "orders"."order_date" > DATE '2026-01-01';`,
].join("\n");

const twoScalarSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  `WHERE "orders"."status" = 'active'`,
  `  AND "orders"."priority" = 'high';`,
].join("\n");

const fourPrompt = "Show order_id where status equals active and priority equals high and amount is between 100 and 500 and deleted_at is null.";
const fourSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  `WHERE "orders"."status" = 'active'`,
  `  AND "orders"."priority" = 'high'`,
  `  AND "orders"."amount" BETWEEN 100 AND 500`,
  `  AND "orders"."deleted_at" IS NULL;`,
].join("\n");

const sameFieldPrompt = "Show order_id where amount is greater than 100 and amount is less than 500.";
const sameFieldSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."amount" > 100',
  '  AND "orders"."amount" < 500;',
].join("\n");

const joinedPrompt = "Show order_id where status equals active and signup_date is after 2026-01-01.";
const joinedSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'JOIN "customers" ON "orders"."customer_id" = "customers"."customer_id"',
  `WHERE "orders"."status" = 'active'`,
  `  AND "customers"."signup_date" > DATE '2026-01-01';`,
].join("\n");

const exactSqlFixture = (name: string, prompt: string, expected: string, worksheets = [orders], contracts: readonly AcceptedRelationshipContract[] = []): Fixture => ({
  name,
  assert: () => expect(renderSqlFor(prompt, worksheets, contracts) === expected, `Expected exact SQL for ${name}.`),
});

const fixtures: Fixture[] = [
  { name: "A1 two scalar predicates segment", assert: () => expect(shellCount("Show order_id where status equals active and priority equals high.") === 2, "Expected two shells.") },
  { name: "A2 three predicates segment", assert: () => expect(shellCount(threePrompt) === 3, "Expected three shells.") },
  { name: "A3 four predicates segment", assert: () => expect(shellCount(fourPrompt) === 4, "Expected four shells.") },
  { name: "A4 BETWEEN first plus scalar segments", assert: () => expect(shellOperators("Show order_id where amount is between 100 and 500 and status equals active.").join("|") === "between|equals", "Expected BETWEEN first.") },
  { name: "A5 BETWEEN last plus scalar segments", assert: () => expect(shellOperators("Show order_id where status equals active and amount is between 100 and 500.").join("|") === "equals|between", "Expected BETWEEN last.") },
  { name: "A6 BETWEEN middle segments", assert: () => expect(shellOperators("Show order_id where status equals active and amount is between 100 and 500 and priority equals high.").join("|") === "equals|between|equals", "Expected BETWEEN middle.") },
  { name: "A7 numeric BETWEEN plus date BETWEEN segments", assert: () => expect(shellOperators("Show order_id where amount is between 100 and 500 and order_date is between 2026-01-01 and 2026-12-31.").join("|") === "between|between", "Expected two BETWEEN shells.") },
  { name: "A8 scalar plus numeric BETWEEN plus date BETWEEN segments", assert: () => expect(shellCount("Show order_id where status equals active and amount is between 100 and 500 and order_date is between 2026-01-01 and 2026-12-31.") === 3, "Expected three shells.") },
  { name: "A9 quoted AND is not logical separator", assert: () => expect(shellCount('Show order_id where description contains "Research and Development" and status equals active.') === 2, "Expected quoted AND masked.") },
  ...[
    "Show order_id where and status equals active.",
    "Show order_id where status equals active and.",
    "Show order_id where status equals active and and priority equals high.",
    "Show order_id where status equals active or priority equals high.",
    "Show order_id where status equals active and priority equals high or region equals east.",
    "Show order_id where status equals active and something unusual.",
    "Show order_id where status equals active where priority equals high.",
    "Show order_id where status = active.",
  ].map((prompt, index) => ({
    name: `A${10 + index} segmentation rejection ${index + 1}`,
    assert: () => expect(detectRowFilterShells(prompt).status === "unsupported", "Expected unsupported shell collection."),
  })),
  { name: "A18 one predicate remains one shell", assert: () => expect(shellCount("Show order_id where status equals active.") === 1, "Expected one shell.") },
  { name: "A19 BETWEEN internal AND remains one shell", assert: () => expect(shellCount("Show order_id where amount is between 100 and 500.") === 1, "Expected one range shell.") },
  { name: "A20 unique full partition required for complex BETWEEN", assert: () => expect(shellOperators("Show order_id where status equals active and amount is between 100 and 500 and order_date is between 2026-01-01 and 2026-12-31.").join("|") === "equals|between|between", "Expected unique partition.") },

  { name: "B23 two valid predicates create two canonical filters", assert: () => expect(canonicalFilters(proposalFor(primaryPrompt)).length === 2, "Expected two canonical filters.") },
  { name: "B24 three valid predicates create three filters", assert: () => expect(canonicalFilters(proposalFor(threePrompt)).length === 3, "Expected three canonical filters.") },
  { name: "B25 four valid predicates create four filters", assert: () => expect(canonicalFilters(proposalFor(fourPrompt)).length === 4, "Expected four canonical filters.") },
  { name: "B26 authored filter order preserved", assert: () => expect(canonicalFilters(proposalFor(primaryPrompt)).map((filter) => filter.target?.field).join("|") === "status|order_date", "Expected authored order.") },
  { name: "B27 every filter executable canonical", assert: () => expect(canonicalFilters(proposalFor(fourPrompt)).every((filter) => filter.executable && filter.semantics === "canonical"), "Expected executable canonical filters.") },
  { name: "B28 targets are field targets", assert: () => expect(canonicalFilters(proposalFor(primaryPrompt)).every((filter) => filter.target?.kind === "field" && filter.target.resolved === true), "Expected resolved field targets.") },
  { name: "B29 member IDs stable", assert: () => { const first = canonicalFilters(proposalFor(primaryPrompt)); const second = canonicalFilters(proposalFor(primaryPrompt)); return expect(first.map((f) => f.id).join("|") === second.map((f) => f.id).join("|"), "Expected stable IDs."); } },
  { name: "B30 lower member change changes only that ID", assert: () => { const a = canonicalFilters(proposalFor(primaryPrompt)); const b = canonicalFilters(proposalFor(primaryPrompt.replace("active", "inactive"))); return expect(a[0]?.id !== b[0]?.id && a[1]?.id === b[1]?.id, "Expected first ID only to change."); } },
  { name: "B31 duplicate predicates remain duplicated", assert: () => expect(canonicalFilters(proposalFor("Show order_id where status equals active and status equals active.")).length === 2, "Expected duplicate entries.") },
  { name: "B32 same-field predicates remain separate", assert: () => expect(canonicalFilters(proposalFor(sameFieldPrompt)).map((filter) => filter.operator).join("|") === "greater_than|less_than", "Expected same-field separate filters.") },
  { name: "B33 no wrapper synthetic filter", assert: () => expect(proposalFor(primaryPrompt).filters.length === 2, "Expected no wrapper filter.") },
  { name: "B34 filterCombinator resolves to AND", assert: () => { const plan = bridgeFor(proposalFor(primaryPrompt)).plan; return expect(Boolean(plan && resolveBusinessSqlFilterCombinator(plan) === "and"), "Expected AND combinator."); } },

  exactSqlFixture("H103 primary scalar + date-range exact SQL", primaryPrompt, primarySql),
  exactSqlFixture("H104 scalar + scalar exact SQL", "Show order_id where status equals active and priority equals high.", twoScalarSql),
  exactSqlFixture("H105 scalar + numeric-range exact SQL", "Show order_id where status equals active and amount is between 100 and 500.", [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', `WHERE "orders"."status" = 'active'`, '  AND "orders"."amount" BETWEEN 100 AND 500;',
  ].join("\n")),
  exactSqlFixture("H106 numeric-range + date-range exact SQL", "Show order_id where amount is between 100 and 500 and order_date is between 2026-01-01 and 2026-12-31.", [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', 'WHERE "orders"."amount" BETWEEN 100 AND 500', `  AND "orders"."order_date" BETWEEN DATE '2026-01-01' AND DATE '2026-12-31';`,
  ].join("\n")),
  exactSqlFixture("H107 BEFORE + AFTER exact SQL", "Show order_id where order_date is after 2026-01-01 and order_date is before 2026-12-31.", [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', `WHERE "orders"."order_date" > DATE '2026-01-01'`, `  AND "orders"."order_date" < DATE '2026-12-31';`,
  ].join("\n")),
  exactSqlFixture("H108 nullary + scalar exact SQL", "Show order_id where deleted_at is null and status equals active.", [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', 'WHERE "orders"."deleted_at" IS NULL', `  AND "orders"."status" = 'active';`,
  ].join("\n")),
  exactSqlFixture("H109 text + scalar exact SQL", "Show order_id where description contains urgent and status equals active.", [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', `WHERE contains("orders"."description", 'urgent')`, `  AND "orders"."status" = 'active';`,
  ].join("\n")),
  exactSqlFixture("H110 three-filter exact SQL", threePrompt, threeSql),
  exactSqlFixture("H111 four-filter exact SQL", fourPrompt, fourSql),
  exactSqlFixture("H112 same-field exact SQL", sameFieldPrompt, sameFieldSql),
  exactSqlFixture("H113 duplicate-filter exact SQL", "Show order_id where status equals active and status equals active.", [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', `WHERE "orders"."status" = 'active'`, `  AND "orders"."status" = 'active';`,
  ].join("\n")),
  exactSqlFixture("H114 base + joined exact SQL", joinedPrompt, joinedSql, [orders, customers], [ordersCustomersContract]),
  exactSqlFixture("H115 two joined filters exact SQL", "Show order_id where signup_date is after 2026-01-01 and renewal_date is after 2026-01-01.", [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', 'JOIN "customers" ON "orders"."customer_id" = "customers"."customer_id"', `WHERE "customers"."signup_date" > DATE '2026-01-01'`, `  AND "customers"."renewal_date" > DATE '2026-01-01';`,
  ].join("\n"), [orders, customers], [ordersCustomersContract]),
  { name: "H116 one WHERE exactly", assert: () => expect((renderSqlFor(primaryPrompt)?.match(/\bWHERE\b/g) || []).length === 1, "Expected one WHERE.") },
  { name: "H117 correct logical AND count", assert: () => expect((renderSqlFor(threePrompt)?.match(/\n  AND /g) || []).length === 2, "Expected two logical ANDs.") },
  { name: "H118 BETWEEN internal AND preserved", assert: () => expect(renderSqlFor(primaryPrompt) === primarySql, "Expected internal BETWEEN AND.") },
  { name: "H119 DATE keyword count correct", assert: () => expect((renderSqlFor(primaryPrompt)?.match(/\bDATE\b/g) || []).length === 2, "Expected two DATE keywords.") },
  { name: "H120 terminal semicolon", assert: () => expect(renderSqlFor(primaryPrompt)?.endsWith(";") === true, "Expected semicolon.") },
  { name: "H121 field projection no ORDER BY", assert: () => expect(!renderSqlFor(primaryPrompt)?.includes("ORDER BY"), "Expected no ORDER BY.") },
  { name: "H122 field projection no LIMIT", assert: () => expect(!renderSqlFor(primaryPrompt)?.includes("LIMIT"), "Expected no LIMIT.") },

  { name: "I123 bridge preserves every filter", assert: () => { const plan = bridgeFor(proposalFor(fourPrompt)).plan; return expect(plan?.filters.length === 4, "Expected four bridged filters."); } },
  { name: "I124 bridge preserves authored order", assert: () => { const plan = bridgeFor(proposalFor(primaryPrompt)).plan; return expect(plan?.filters.map((filter) => filter.field).join("|") === "status|order_date", "Expected bridge order."); } },
  { name: "I125 bridge preserves scalar comparison", assert: () => { const plan = bridgeFor(proposalFor(primaryPrompt)).plan; return expect(plan?.filters[0]?.comparisonValue?.kind === "string", "Expected scalar comparison."); } },
  { name: "I126 bridge preserves date range", assert: () => { const plan = bridgeFor(proposalFor(primaryPrompt)).plan; return expect(plan?.filters[1]?.comparisonValue?.kind === "range", "Expected range comparison."); } },
  { name: "I127 final filter IDs equal createBusinessSqlFilterId", assert: () => { const plan = bridgeFor(proposalFor(primaryPrompt)).plan; return expect(Boolean(plan?.filters.every((filter) => filter.filterId === createBusinessSqlFilterId(filter))), "Expected canonical final IDs."); } },
  { name: "I128 filter group ID equals helper", assert: () => { const plan = bridgeFor(proposalFor(primaryPrompt)).plan; return expect(Boolean(plan && createBusinessSqlFilterGroupId({ combinator: "and", filters: plan.filters }) === createBusinessSqlFilterGroupId({ combinator: "and", filters: [...plan.filters].reverse() })), "Expected group identity helper."); } },
  { name: "I129 duplicate multiplicity preserved", assert: () => { const plan = bridgeFor(proposalFor("Show order_id where status equals active and status equals active.")).plan; return expect(plan?.filters.length === 2, "Expected multiplicity."); } },

  ...[
    "Show order_id where amount is between 500 and 100 and status equals active.",
    "Show order_id where amount is between foo and 100 and status equals active.",
    "Show order_id where order_date is between 2026-12-31 and 2026-01-01 and status equals active.",
    "Show order_id where order_date is between 2026-02-30 and 2026-12-31 and status equals active.",
    "Show order_id where status equals active and priority.",
    "Show order_id where approximately status equals active and priority equals high.",
    "Show order_id where status equals active approximately and priority equals high.",
    "Show order_id where total_revenue is greater than 1000 and status equals active.",
  ].map((prompt, index) => ({
    name: `F/G malformed or unsupported request ${index + 1} blocks`,
    assert: () => expect(noSqlFor(prompt), "Expected no SQL for malformed request."),
  })),
  { name: "D53 base plus joined field grounds with relationship", assert: () => expect(canonicalFilters(proposalFor(joinedPrompt, [orders, customers], [ordersCustomersContract])).map((filter) => filter.target?.table).join("|") === "orders|customers", "Expected base and joined targets.") },
  { name: "D55 missing joined relationship blocks", assert: () => expect(noSqlFor(joinedPrompt, [orders, customers], []), "Expected missing join block.") },
  { name: "D57 ambiguous first field blocks", assert: () => expect(noSqlFor("Show order_id where status equals active and priority equals high.", [orders, ambiguous], []), "Expected ambiguous block.") },
  { name: "D60 unknown field blocks", assert: () => expect(noSqlFor("Show order_id where unknown_field equals active and status equals active."), "Expected unknown block.") },
  { name: "J138 valid preview equals renderer SQL", assert: () => { const proposal = proposalFor(primaryPrompt); const plan = bridgeFor(proposal).plan!; return expect(createBusinessSqlRenderPreview(plan).sql === renderBusinessSqlQueryPlan(plan).sql, "Expected preview/renderer equality."); } },
  { name: "J139 valid preview Copy true", assert: () => { const plan = bridgeFor(proposalFor(primaryPrompt)).plan!; return expect(createBusinessSqlRenderPreview(plan).actions.canCopySql, "Expected copy."); } },
  { name: "J140 valid preview Insert false", assert: () => { const plan = bridgeFor(proposalFor(primaryPrompt)).plan!; return expect(!createBusinessSqlRenderPreview(plan).actions.canInsertSql, "Expected insert false."); } },
  { name: "J141 valid preview Run false", assert: () => { const plan = bridgeFor(proposalFor(primaryPrompt)).plan!; return expect(!createBusinessSqlRenderPreview(plan).actions.canRunSql, "Expected run false."); } },
  { name: "J142 invalid preview SQL null", assert: () => expect(noSqlFor("Show order_id where status equals active and something unusual."), "Expected invalid no preview.") },
  { name: "J146 inserted false", assert: () => { const result = renderBusinessSqlQueryPlan(bridgeFor(proposalFor(primaryPrompt)).plan!); return expect(!result.inserted, "Expected inserted false."); } },
  { name: "J147 ranQuery false", assert: () => { const result = renderBusinessSqlQueryPlan(bridgeFor(proposalFor(primaryPrompt)).plan!); return expect(!result.ranQuery, "Expected ranQuery false."); } },
  { name: "K148 single scalar grounding byte-identical", assert: () => expect(renderSqlFor("Show order_id where status equals active.") === [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', `WHERE "orders"."status" = 'active';`,
  ].join("\n"), "Expected single scalar SQL.") },
  { name: "K153 single numeric BETWEEN grounding byte-identical", assert: () => expect(renderSqlFor("Show order_id where amount is between 100 and 500.") === [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', 'WHERE "orders"."amount" BETWEEN 100 AND 500;',
  ].join("\n"), "Expected single range SQL.") },
  { name: "K156 single date BETWEEN grounding byte-identical", assert: () => expect(renderSqlFor("Show order_id where order_date is between 2026-01-01 and 2026-12-31.") === [
    "SELECT", '  "orders"."order_id" AS "order_id"', 'FROM "orders"', `WHERE "orders"."order_date" BETWEEN DATE '2026-01-01' AND DATE '2026-12-31';`,
  ].join("\n"), "Expected single date range SQL.") },
  { name: "K158 OR rejection remains green", assert: () => expect(noSqlFor("Show order_id where status equals active or priority equals high."), "Expected OR no SQL.") },
  { name: "K159 raw SQL rejection remains green", assert: () => expect(noSqlFor("Show order_id where status = active."), "Expected raw SQL no SQL.") },
  { name: "K165 no automatic Insert", assert: () => { const result = renderBusinessSqlQueryPlan(bridgeFor(proposalFor(primaryPrompt)).plan!); return expect(!result.inserted, "Expected no insert.") } },
  { name: "K166 no automatic Run", assert: () => { const result = renderBusinessSqlQueryPlan(bridgeFor(proposalFor(primaryPrompt)).plan!); return expect(!result.ranQuery, "Expected no run.") } },
  { name: "member identity evidence neutrality", assert: () => {
    const filter = canonicalFilters(proposalFor(primaryPrompt))[0];
    return expect(filter.id === createProposedRowFilterId({ target: filter.target, operator: filter.operator, comparisonValue: filter.comparisonValue }), "Expected proposed ID helper.");
  } },
];

export function runExplicitMultiFilterAndGroundingFixtures() {
  const results: FixtureResult[] = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
    return { name: fixture.name, ok: failureReasons.length === 0, failureReasons };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const explicitMultiFilterAndGroundingFixturesPass =
  runExplicitMultiFilterAndGroundingFixtures().failed.length === 0;
