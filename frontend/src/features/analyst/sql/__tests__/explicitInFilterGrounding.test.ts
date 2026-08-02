/** PS-6g - explicit natural-language IN/NOT IN grounding fixtures. */

import type { AcceptedRelationshipContract, WorksheetMetadata } from "../../../workbook";
import type { SchemaColumn } from "../../../dataset/datasetTypes";
import { detectBusinessIntent } from "../businessIntentGrounding";
import {
  createProposedRowFilterId,
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
  type ProposedFilter,
} from "../adaptiveReportProposal";
import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import {
  createBusinessSqlFilterId,
  type BusinessSqlFilter,
} from "../businessSqlQueryPlan";
import { createBusinessSqlRenderPreview } from "../businessSqlRenderPreview";

type FixtureResult = { name: string; ok: boolean; failureReasons: string[] };
type Fixture = { name: string; assert: () => string[] };

export type ExplicitInFilterGroundingFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

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

const customers = worksheet("customers", [
  column("customer_id", "categorical"),
  column("status", "categorical"),
  column("city", "text"),
  column("last_name", "text"),
]);

const orders = worksheet("orders", [
  column("order_id", "categorical"),
  column("customer_id", "categorical"),
  column("warehouse_id", "numeric"),
  column("order_amount", "numeric"),
  column("created_at", "date"),
]);

const inventory = worksheet("inventory", [
  column("item_id", "categorical"),
  column("discontinued", "boolean"),
]);

const regions = worksheet("regions", [
  column("region_id", "categorical"),
  column("region_name", "text"),
]);

const sales = worksheet("sales", [
  column("region", "categorical"),
  column("revenue", "numeric"),
  column("cost", "numeric"),
  column("status", "categorical"),
]);

const acceptedContract = (
  sourceTableName: string,
  sourceColumnName: string,
  targetTableName: string,
  targetColumnName: string,
): AcceptedRelationshipContract => ({
  contractId: `contract:${sourceTableName}:${targetTableName}`,
  sourceWorksheetId: sourceTableName,
  sourceTableName,
  sourceColumnName,
  targetWorksheetId: targetTableName,
  targetTableName,
  targetColumnName,
  relationshipType: "many_to_one_candidate",
  confidence: 0.95,
  acceptedFromCandidateId: `candidate:${sourceTableName}:${targetTableName}`,
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
});

const proposalFor = (
  prompt: string,
  scopeWorksheet = customers,
  worksheets = [scopeWorksheet],
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
) =>
  createBusinessSqlPlanFromAdaptiveProposal({
    proposal,
    acceptedRelationshipContracts: contracts,
  });

const previewFor = (
  proposal: AdaptiveReportProposal,
  contracts: readonly AcceptedRelationshipContract[] = [],
) => {
  const bridge = bridgeFor(proposal, contracts);
  return bridge.plan ? createBusinessSqlRenderPreview(bridge.plan) : null;
};

const sqlFor = (
  proposal: AdaptiveReportProposal,
  contracts: readonly AcceptedRelationshipContract[] = [],
): string | null => previewFor(proposal, contracts)?.sql || null;

const canonicalFilter = (proposal: AdaptiveReportProposal): ProposedFilter | undefined =>
  proposal.filters.find((filter) => filter.semantics === "canonical");

const finalFilter = (
  proposal: AdaptiveReportProposal,
  contracts: readonly AcceptedRelationshipContract[] = [],
): BusinessSqlFilter | undefined => bridgeFor(proposal, contracts).plan?.filters[0];

const noSql = (
  prompt: string,
  scopeWorksheet = customers,
  worksheets = [scopeWorksheet],
): boolean => !sqlFor(proposalFor(prompt, scopeWorksheet, worksheets));

const expectedTextInSql = [
  "SELECT",
  '  "customers"."customer_id" AS "customer_id"',
  'FROM "customers"',
  'WHERE "customers"."status" IN (\'active\', \'cancelled\', \'pending\');',
].join("\n");

const expectedTextNotInSql = [
  "SELECT",
  '  "customers"."customer_id" AS "customer_id"',
  'FROM "customers"',
  'WHERE "customers"."status" NOT IN (\'closed\', \'suspended\');',
].join("\n");

const expectedNumericInSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."warehouse_id" IN (10, 20, 30);',
].join("\n");

const expectedNumericNotInSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'WHERE "orders"."warehouse_id" NOT IN (10, 20, 30);',
].join("\n");

const expectedBooleanInSql = [
  "SELECT",
  '  "inventory"."item_id" AS "item_id"',
  'FROM "inventory"',
  'WHERE "inventory"."discontinued" IN (FALSE, TRUE);',
].join("\n");

const expectedBooleanNotInSql = [
  "SELECT",
  '  "inventory"."item_id" AS "item_id"',
  'FROM "inventory"',
  'WHERE "inventory"."discontinued" NOT IN (FALSE, TRUE);',
].join("\n");

const expectedQuotedSql = [
  "SELECT",
  '  "customers"."customer_id" AS "customer_id"',
  'FROM "customers"',
  'WHERE "customers"."city" IN (\'Los Angeles\', \'New York\');',
].join("\n");

const expectedApostropheSql = [
  "SELECT",
  '  "customers"."customer_id" AS "customer_id"',
  'FROM "customers"',
  'WHERE "customers"."last_name" IN (\'D\'\'Angelo\', \'O\'\'Brien\');',
].join("\n");

const expectedQuotedCommaSql = [
  "SELECT",
  '  "regions"."region_id" AS "region_id"',
  'FROM "regions"',
  'WHERE "regions"."region_name" IN (\'North, East\', \'South\');',
].join("\n");

const expectedGroupedSql = [
  "SELECT",
  '  "sales"."region" AS "region",',
  '  SUM("sales"."revenue") AS "total_revenue"',
  'FROM "sales"',
  `WHERE "sales"."status" IN ('active', 'pending')`,
  'GROUP BY "sales"."region"',
  'ORDER BY "total_revenue" DESC;',
].join("\n");

const expectedJoinedSql = [
  "SELECT",
  '  "orders"."order_id" AS "order_id"',
  'FROM "orders"',
  'JOIN "customers" ON "orders"."customer_id" = "customers"."customer_id"',
  `WHERE "customers"."status" IN ('active', 'pending');`,
].join("\n");

const textInProposal = () =>
  proposalFor("Show customer_id where status is one of active, pending, cancelled.", customers);

const valueFor = (proposal: AdaptiveReportProposal = textInProposal()) =>
  canonicalFilter(proposal)?.comparisonValue;

const fixtures: Fixture[] = [
  { name: "is one of maps to IN", assert: () => canonicalFilter(textInProposal())?.operator === "in" ? [] : ["Expected IN."] },
  { name: "is in maps to IN", assert: () => canonicalFilter(proposalFor("Show order_id where warehouse_id is in 10, 20, 30.", orders))?.operator === "in" ? [] : ["Expected is in."] },
  { name: "is not one of maps to NOT IN", assert: () => canonicalFilter(proposalFor("Show customer_id where status is not one of closed, suspended.", customers))?.operator === "not_in" ? [] : ["Expected NOT IN."] },
  { name: "is not in maps to NOT IN", assert: () => canonicalFilter(proposalFor("Show order_id where warehouse_id is not in 10, 20, 30.", orders))?.operator === "not_in" ? [] : ["Expected is not in."] },
  { name: "is in the range remains BETWEEN", assert: () => canonicalFilter(proposalFor("Show order_id where warehouse_id is in the range 10 and 20.", orders))?.operator === "between" ? [] : ["Expected BETWEEN precedence."] },
  { name: "longest phrase precedence", assert: () => [
    ...(canonicalFilter(proposalFor("Show customer_id where status is not one of closed, suspended.", customers))?.operator === "not_in" ? [] : ["Expected not one of precedence."]),
    ...(canonicalFilter(proposalFor("Show order_id where warehouse_id is not in 10, 20.", orders))?.operator === "not_in" ? [] : ["Expected not in precedence."]),
  ] },
  { name: "exactly one WHERE required", assert: () => canonicalFilter(textInProposal()) ? [] : ["Expected one WHERE."] },
  { name: "multiple WHERE rejected", assert: () => noSql("Show customer_id where status is one of active, pending where city is one of Boston.") ? [] : ["Expected multiple WHERE rejection."] },
  { name: "extra AND rejected", assert: () => noSql("Show customer_id where status is one of active, pending and city equals Boston.") ? [] : ["Expected AND rejection."] },
  { name: "OR rejected", assert: () => noSql("Show customer_id where status is in active, pending or status equals closed.") ? [] : ["Expected OR rejection."] },
  { name: "multiple membership predicates rejected", assert: () => noSql("Show customer_id where status is one of active, pending and city is one of Boston, Miami.") ? [] : ["Expected multiple membership rejection."] },
  { name: "text list parses", assert: () => {
    const value = valueFor();
    return value?.kind === "set" && value.valueKind === "string" ? [] : ["Expected text set."];
  } },
  { name: "quoted text list parses", assert: () => canonicalFilter(proposalFor('Show customer_id where city is one of "New York", "Los Angeles".', customers))?.comparisonValue?.kind === "set" ? [] : ["Expected quoted text set."] },
  { name: "quoted multi-word values parse", assert: () => sqlFor(proposalFor('Show customer_id where city is one of "New York", "Los Angeles".', customers)) === expectedQuotedSql ? [] : ["Expected multi-word SQL."] },
  { name: "quoted apostrophes parse", assert: () => sqlFor(proposalFor('Show customer_id where last_name is one of "O\'Brien", "D\'Angelo".', customers)) === expectedApostropheSql ? [] : ["Expected apostrophe SQL."] },
  { name: "quoted comma member parses", assert: () => sqlFor(proposalFor('Show region_id where region_name is one of "North, East", "South".', regions)) === expectedQuotedCommaSql ? [] : ["Expected quoted comma SQL."] },
  { name: "case is preserved", assert: () => sqlFor(proposalFor("Show customer_id where status is one of Active, active.", customers))?.includes("'Active', 'active'") ? [] : ["Expected case preservation."] },
  { name: "duplicate values are accepted canonically", assert: () => sqlFor(proposalFor("Show customer_id where status is one of active, active, pending.", customers))?.includes("('active', 'pending')") ? [] : ["Expected duplicate normalization."] },
  { name: "authored order does not change ID or SQL", assert: () => {
    const first = proposalFor("Show customer_id where status is one of pending, active.", customers);
    const second = proposalFor("Show customer_id where status is one of active, pending.", customers);
    return canonicalFilter(first)?.id === canonicalFilter(second)?.id && sqlFor(first) === sqlFor(second) ? [] : ["Expected order-insensitive identity and SQL."];
  } },
  { name: "numeric list parses", assert: () => canonicalFilter(proposalFor("Show order_id where warehouse_id is in 10, 20, 30.", orders))?.comparisonValue?.kind === "set" ? [] : ["Expected numeric set."] },
  { name: "negative numeric list parses", assert: () => sqlFor(proposalFor("Show order_id where warehouse_id is in -10, 0, 20.", orders))?.includes("IN (-10, 0, 20)") ? [] : ["Expected negative numeric SQL."] },
  { name: "decimal numeric list parses", assert: () => sqlFor(proposalFor("Show order_id where warehouse_id is in 10.5, 20.25.", orders))?.includes("IN (10.5, 20.25)") ? [] : ["Expected decimal numeric SQL."] },
  { name: "comma-grouped numeric list parses", assert: () => sqlFor(proposalFor("Show order_id where warehouse_id is in 1,000, 2,000, 5,000.", orders))?.includes("IN (1000, 2000, 5000)") ? [] : ["Expected grouped numeric SQL."] },
  { name: "boolean list parses", assert: () => sqlFor(proposalFor("Show item_id where discontinued is in true, false.", inventory)) === expectedBooleanInSql ? [] : ["Expected boolean set."] },
  { name: "one-member set parses", assert: () => sqlFor(proposalFor("Show customer_id where status is one of active.", customers))?.includes("IN ('active')") ? [] : ["Expected one member set."] },
  { name: "empty list rejects", assert: () => noSql("Show customer_id where status is one of .") ? [] : ["Expected empty rejection."] },
  { name: "leading comma rejects", assert: () => noSql("Show customer_id where status is one of ,active,pending.") ? [] : ["Expected leading comma rejection."] },
  { name: "trailing comma rejects", assert: () => noSql("Show customer_id where status is one of active,pending,.") ? [] : ["Expected trailing comma rejection."] },
  { name: "consecutive commas reject", assert: () => noSql("Show customer_id where status is one of active,,pending.") ? [] : ["Expected consecutive comma rejection."] },
  { name: "unclosed quote rejects", assert: () => noSql('Show customer_id where status is one of "active,pending.') ? [] : ["Expected quote rejection."] },
  { name: "unquoted multi-word string rejects", assert: () => noSql("Show customer_id where city is one of New York, Boston.") ? [] : ["Expected unquoted multi-word rejection."] },
  { name: "malformed comma grouping rejects", assert: () => noSql("Show order_id where warehouse_id is in 1,00, 5,000.", orders) ? [] : ["Expected bad comma rejection."] },
  { name: "malformed decimal rejects", assert: () => noSql("Show order_id where warehouse_id is in 1.2.3, 5.", orders) ? [] : ["Expected bad decimal rejection."] },
  { name: "currency rejects", assert: () => noSql("Show order_id where warehouse_id is in $100, $500.", orders) ? [] : ["Expected currency rejection."] },
  { name: "percentage rejects", assert: () => noSql("Show order_id where warehouse_id is in 10%, 20%.", orders) ? [] : ["Expected percent rejection."] },
  { name: "unit rejects", assert: () => noSql("Show order_id where warehouse_id is in 10 days, 20 days.", orders) ? [] : ["Expected unit rejection."] },
  { name: "magnitude suffix rejects", assert: () => noSql("Show order_id where warehouse_id is in 100k, 500k.", orders) ? [] : ["Expected suffix rejection."] },
  { name: "arithmetic rejects", assert: () => noSql("Show order_id where warehouse_id is in 100 + 20, 500.", orders) ? [] : ["Expected arithmetic rejection."] },
  { name: "word numbers reject", assert: () => noSql("Show order_id where warehouse_id is in one hundred, five hundred.", orders) ? [] : ["Expected word-number rejection."] },
  { name: "quoted numeric values reject", assert: () => noSql('Show order_id where warehouse_id is in "100", "500".', orders) ? [] : ["Expected quoted numeric rejection."] },
  { name: "mixed types reject", assert: () => noSql("Show item_id where discontinued is in true, active.", inventory) ? [] : ["Expected mixed type rejection."] },
  { name: "wrong field type rejects", assert: () => noSql("Show order_id where warehouse_id is in active, pending.", orders) ? [] : ["Expected wrong type rejection."] },
  { name: "date field rejects", assert: () => noSql("Show order_id where created_at is in 2026-01-01, 2026-02-01.", orders) ? [] : ["Expected date rejection."] },
  { name: "unknown field rejects", assert: () => noSql("Show customer_id where unknown_status is one of active, pending.") ? [] : ["Expected unknown field."] },
  { name: "missing field rejects", assert: () => noSql("Show customer_id where is one of active, pending.") ? [] : ["Expected missing field."] },
  { name: "ambiguous field rejects", assert: () => noSql("Show customer_id where status is one of active, pending.", customers, [customers, worksheet("accounts", [column("status", "categorical")])]) ? [] : ["Expected ambiguous field."] },
  { name: "stable proposed set ID", assert: () => canonicalFilter(textInProposal())?.id === canonicalFilter(textInProposal())?.id ? [] : ["Expected stable ID."] },
  { name: "proposed ID ignores authored order", assert: () => canonicalFilter(proposalFor("Show customer_id where status is one of pending, active.", customers))?.id === canonicalFilter(proposalFor("Show customer_id where status is one of active, pending.", customers))?.id ? [] : ["Expected order-neutral ID."] },
  { name: "proposed ID ignores duplicates", assert: () => canonicalFilter(proposalFor("Show customer_id where status is one of active, active, pending.", customers))?.id === canonicalFilter(proposalFor("Show customer_id where status is one of pending, active.", customers))?.id ? [] : ["Expected duplicate-neutral ID."] },
  { name: "proposed ID preserves case distinctions", assert: () => canonicalFilter(proposalFor("Show customer_id where status is one of Active, pending.", customers))?.id !== canonicalFilter(proposalFor("Show customer_id where status is one of active, pending.", customers))?.id ? [] : ["Expected case-sensitive ID."] },
  { name: "IN and NOT IN IDs differ", assert: () => canonicalFilter(proposalFor("Show customer_id where status is one of active, pending.", customers))?.id !== canonicalFilter(proposalFor("Show customer_id where status is not one of active, pending.", customers))?.id ? [] : ["Expected operator-sensitive ID."] },
  { name: "number string and boolean IDs differ", assert: () => {
    const numberId = canonicalFilter(proposalFor("Show order_id where warehouse_id is in 1.", orders))?.id;
    const stringId = canonicalFilter(proposalFor('Show customer_id where status is one of "1".', customers))?.id;
    const booleanId = canonicalFilter(proposalFor("Show item_id where discontinued is in true.", inventory))?.id;
    return numberId !== stringId && stringId !== booleanId && numberId !== booleanId ? [] : ["Expected type-aware IDs."];
  } },
  { name: "field change changes ID", assert: () => canonicalFilter(proposalFor("Show customer_id where status is one of active.", customers))?.id !== canonicalFilter(proposalFor("Show customer_id where city is one of active.", customers))?.id ? [] : ["Expected field-sensitive ID."] },
  { name: "label and evidence do not change ID", assert: () => {
    const filter = canonicalFilter(textInProposal());
    const changed = filter ? createProposedRowFilterId({ target: filter.target, operator: filter.operator, comparisonValue: filter.comparisonValue }) : null;
    return filter?.id === changed ? [] : ["Expected label/evidence immunity."];
  } },
  { name: "canonical proposed set shape", assert: () => {
    const filter = canonicalFilter(textInProposal());
    const value = filter?.comparisonValue;
    return filter?.semantics === "canonical" && filter.executable === true && filter.operator === "in" && value?.kind === "set" && value.valueKind === "string" && value.values.length === 3 ? [] : ["Expected canonical set proposal."];
  } },
  { name: "bridge preserves set shape", assert: () => finalFilter(textInProposal())?.comparisonValue?.kind === "set" ? [] : ["Expected bridge set."] },
  { name: "final BusinessSqlFilter gets canonical filterId", assert: () => {
    const filter = finalFilter(textInProposal());
    return filter && filter.filterId === createBusinessSqlFilterId(filter) ? [] : ["Expected final filterId."];
  } },
  { name: "invalid bridge set blocks", assert: () => {
    const proposal = textInProposal();
    const broken = {
      ...proposal,
      filters: proposal.filters.map((filter) => filter.semantics === "canonical"
        ? { ...filter, comparisonValue: { kind: "set" as const, valueKind: "number" as const, values: [1, "2"] } }
        : filter),
    };
    const result = bridgeFor(broken);
    return result.state === "blocked_plan" && result.issues.some((issue) => issue.code === "invalid_canonical_filter") ? [] : ["Expected invalid bridge set block."];
  } },
  { name: "exact text IN SQL", assert: () => sqlFor(textInProposal()) === expectedTextInSql ? [] : ["Expected text IN SQL."] },
  { name: "exact text NOT IN SQL", assert: () => sqlFor(proposalFor("Show customer_id where status is not one of closed, suspended.", customers)) === expectedTextNotInSql ? [] : ["Expected text NOT IN SQL."] },
  { name: "exact numeric IN SQL", assert: () => sqlFor(proposalFor("Show order_id where warehouse_id is in 10, 20, 30.", orders)) === expectedNumericInSql ? [] : ["Expected numeric IN SQL."] },
  { name: "exact numeric NOT IN SQL", assert: () => sqlFor(proposalFor("Show order_id where warehouse_id is not in 10, 20, 30.", orders)) === expectedNumericNotInSql ? [] : ["Expected numeric NOT IN SQL."] },
  { name: "exact boolean IN SQL", assert: () => sqlFor(proposalFor("Show item_id where discontinued is in true, false.", inventory)) === expectedBooleanInSql ? [] : ["Expected boolean IN SQL."] },
  { name: "exact boolean NOT IN SQL", assert: () => sqlFor(proposalFor("Show item_id where discontinued is not in true, false.", inventory)) === expectedBooleanNotInSql ? [] : ["Expected boolean NOT IN SQL."] },
  { name: "exact quoted multi-word SQL", assert: () => sqlFor(proposalFor('Show customer_id where city is one of "New York", "Los Angeles".', customers)) === expectedQuotedSql ? [] : ["Expected quoted SQL."] },
  { name: "exact apostrophe SQL", assert: () => sqlFor(proposalFor('Show customer_id where last_name is one of "O\'Brien", "D\'Angelo".', customers)) === expectedApostropheSql ? [] : ["Expected apostrophe SQL."] },
  { name: "exact quoted-comma SQL", assert: () => sqlFor(proposalFor('Show region_id where region_name is one of "North, East", "South".', regions)) === expectedQuotedCommaSql ? [] : ["Expected quoted comma SQL."] },
  { name: "equivalent lists render byte-identically", assert: () => sqlFor(proposalFor("Show customer_id where status is one of pending, active.", customers)) === sqlFor(proposalFor("Show customer_id where status is one of active, active, pending.", customers)) ? [] : ["Expected byte-identical SQL."] },
  { name: "case-distinct members both render", assert: () => sqlFor(proposalFor("Show customer_id where status is one of Active, active.", customers))?.includes("'Active', 'active'") ? [] : ["Expected case-distinct SQL."] },
  { name: "field projection remains unsorted", assert: () => !sqlFor(textInProposal())?.includes("ORDER BY") ? [] : ["Expected unsorted projection."] },
  { name: "grouped aggregation keeps explicit default sort", assert: () => {
    const proposal = proposalFor("Show total revenue by region where status is one of active, pending.", sales);
    const bridge = bridgeFor(proposal);
    return bridge.plan?.orderBy.length === 1 && sqlFor(proposal) === expectedGroupedSql ? [] : ["Expected grouped default sort."]; 
  } },
  { name: "WHERE precedes GROUP BY", assert: () => {
    const sql = sqlFor(proposalFor("Show total revenue by region where status is one of active, pending.", sales)) || "";
    return sql.indexOf("WHERE") > -1 && sql.indexOf("WHERE") < sql.indexOf("GROUP BY") ? [] : ["Expected WHERE before GROUP BY."];
  } },
  { name: "WHERE precedes HAVING", assert: () => {
    const sql = sqlFor(proposalFor("Show total revenue by region where status is one of active, pending.", sales)) || "";
    return !sql.includes("HAVING") || sql.indexOf("WHERE") < sql.indexOf("HAVING") ? [] : ["Expected WHERE before HAVING."];
  } },
  { name: "WHERE precedes ORDER BY", assert: () => {
    const sql = sqlFor(proposalFor("Show total revenue by region where status is one of active, pending.", sales)) || "";
    return sql.indexOf("WHERE") < sql.indexOf("ORDER BY") ? [] : ["Expected WHERE before ORDER BY."];
  } },
  { name: "LIMIT remains last", assert: () => {
    const sql = sqlFor(proposalFor("Show top 5 total revenue by region where status is one of active, pending.", sales)) || "";
    return !sql.includes("LIMIT") || /LIMIT \d+;$/.test(sql) ? [] : ["Expected LIMIT last."];
  } },
  { name: "resolved join renders", assert: () => {
    const contract = acceptedContract("orders", "customer_id", "customers", "customer_id");
    const proposal = proposalFor("Show order_id where status is one of active, pending.", orders, [orders, customers], [contract]);
    return sqlFor(proposal, [contract]) === expectedJoinedSql ? [] : ["Expected joined SQL."];
  } },
  { name: "unresolved join blocks", assert: () => {
    const proposal = proposalFor("Show order_id where status is one of active, pending.", orders, [orders, customers]);
    return !sqlFor(proposal) ? [] : ["Expected unresolved join block."];
  } },
  { name: "aggregate IN wording does not become WHERE", assert: () => {
    const proposal = proposalFor("Show regions where total revenue is one of 100000, 200000.", sales);
    return proposal.filters.length === 0 && !sqlFor(proposal) ? [] : ["Expected aggregate IN no WHERE."];
  } },
  { name: "derived aggregate IN wording does not become WHERE", assert: () => {
    const proposal = proposalFor("Show regions where total revenue minus total cost is one of 10000, 20000.", sales);
    return proposal.filters.length === 0 && !sqlFor(proposal) ? [] : ["Expected derived aggregate IN no WHERE."];
  } },
  { name: "no WHERE HAVING double claim", assert: () => {
    const proposal = proposalFor("Show regions where total revenue is one of 100000, 200000.", sales);
    return proposal.filters.length === 0 && proposal.aggregateResultConditions.length === 0 ? [] : ["Expected no double claim."];
  } },
  { name: "scalar grounding regression", assert: () => sqlFor(proposalFor("Show order_id where warehouse_id is above 10.", orders))?.includes('> 10;') ? [] : ["Expected scalar grounding."] },
  { name: "BETWEEN grounding regression", assert: () => sqlFor(proposalFor("Show order_id where warehouse_id is between 10 and 20.", orders))?.includes("BETWEEN 10 AND 20") ? [] : ["Expected BETWEEN grounding."] },
  { name: "canonical IN NOT IN renderer regression", assert: () => [
    ...(sqlFor(proposalFor("Show customer_id where status is one of active, pending.", customers))?.includes(" IN ('active', 'pending')") ? [] : ["Expected IN renderer."]),
    ...(sqlFor(proposalFor("Show customer_id where status is not one of closed, suspended.", customers))?.includes(" NOT IN ('closed', 'suspended')") ? [] : ["Expected NOT IN renderer."]),
  ] },
  { name: "preview Copy only", assert: () => {
    const preview = previewFor(textInProposal());
    return preview?.actions.canCopySql && !preview.actions.canInsertSql && !preview.actions.canRunSql ? [] : ["Expected copy-only preview."];
  } },
  { name: "unsupported preview no actions", assert: () => {
    const preview = previewFor(proposalFor("Show customer_id where status is one of active,,pending.", customers));
    return !preview?.sql && !preview?.actions.canCopySql && !preview?.actions.canInsertSql && !preview?.actions.canRunSql ? [] : ["Expected unsupported no actions."];
  } },
  { name: "no automatic Insert", assert: () => bridgeFor(textInProposal()).noInsertPerformed ? [] : ["Expected no insert."] },
  { name: "no automatic Run", assert: () => bridgeFor(textInProposal()).noRunPerformed ? [] : ["Expected no run."] },
  { name: "legacy array remains refused", assert: () => {
    const proposal = textInProposal();
    const legacy = {
      ...proposal,
      filters: [{ id: "legacy", label: "Legacy array", tableName: "customers", columnName: "status", semantics: "needs_review" as const, reason: "Legacy string array", evidence: "status list" }],
    };
    return !sqlFor(legacy) ? [] : ["Expected legacy refusal."];
  } },
  { name: "raw SQL-like predicate rejected", assert: () => noSql("Show customer_id where status is one of active, pending; drop table customers.") ? [] : ["Expected raw SQL rejection."] },
];

export function runExplicitInFilterGroundingFixtures(): ExplicitInFilterGroundingFixtureReport {
  const results = fixtures.map((fixture) => {
    const failureReasons = fixture.assert();
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      failureReasons,
    };
  });
  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export const explicitInFilterGroundingFixturesPass =
  runExplicitInFilterGroundingFixtures().failed.length === 0;
