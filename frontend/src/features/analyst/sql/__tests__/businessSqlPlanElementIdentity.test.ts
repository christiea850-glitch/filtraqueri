import { createBusinessSqlPlanFromAdaptiveProposal } from "../adaptiveProposalBusinessSqlBridge";
import {
  proposeAdaptiveReport,
  type AdaptiveReportProposal,
  type AdaptiveReportProposalRequest,
} from "../adaptiveReportProposal";
import {
  assessBusinessSqlPlanElementIdentityCapability,
  attachBusinessSqlPlanElementIdentityManifest,
  createBusinessSqlPlanElementIdentity,
  isBusinessSqlPlanElementKind,
  reconstructBusinessSqlPlanElementIdentity,
  resolveBusinessSqlPlanElementIdentity,
  serializeBusinessSqlPlanElementIdentity,
  validateBusinessSqlPlanElementIdentityManifest,
  type BusinessSqlPlanElementIdentity,
  type BusinessSqlPlanElementKind,
} from "../businessSqlPlanElementIdentity";
import {
  createBusinessSqlAggregateResultConditionId,
  createBusinessSqlFilterId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlRowLimitId,
  createBusinessSqlSortId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlAggregateResultCondition,
  type BusinessSqlFilter,
  type BusinessSqlGrouping,
  type BusinessSqlJoinRequirement,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
  type BusinessSqlRowLimit,
  type BusinessSqlSort,
} from "../businessSqlQueryPlan";
import {
  createBusinessSqlPreviewRenderRequest,
  renderBusinessSqlQueryPlanArtifact,
} from "../businessSqlRenderer";

type FixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  failureReasons: string[];
};

export type BusinessSqlPlanElementIdentityFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const expect = (condition: boolean, message: string): string[] =>
  condition ? [] : [message];

const scopeId = "business-sql-plan:cmg2";
const measureElementKey = "measure:primary";
const groupingElementKey = "grouping:primary";
const filterElementKey = "filter:explicit-row";
const statusFilterElementKey = "filter:status-semantics";
const comparisonElementKey = "comparison:primary-threshold";
const sortElementKey = "ranking:primary-sort";
const rowLimitElementKey = "ranking:row-limit";
const relationshipElementKey = "relationship:primary";

const supportedKinds: BusinessSqlPlanElementKind[] = [
  "measure",
  "filter",
  "grouping",
  "comparison",
  "ranking",
  "relationship",
  "visualization",
  "explanation",
  "extension:downstream-artifact",
];

const expectedEligibleClaims = [
  ["measure", measureElementKey],
  ["grouping", groupingElementKey],
  ["filter", filterElementKey],
  ["filter", statusFilterElementKey],
  ["comparison", comparisonElementKey],
  ["ranking", sortElementKey],
  ["ranking", rowLimitElementKey],
  ["relationship", relationshipElementKey],
] as const;

const withoutPlanElementKey = <T extends { planElementKey?: string }>(
  item: T,
): Omit<T, "planElementKey"> => {
  const copy = { ...item };
  delete copy.planElementKey;
  return copy;
};

const removeIdentityMetadata = (plan: BusinessSqlQueryPlan): BusinessSqlQueryPlan => ({
  ...plan,
  elementIdentities: undefined,
  measures: plan.measures.map(withoutPlanElementKey),
  groupings: plan.groupings.map(withoutPlanElementKey),
  filters: plan.filters.map(withoutPlanElementKey),
  orderBy: plan.orderBy.map(withoutPlanElementKey),
  rowLimit: plan.rowLimit ? withoutPlanElementKey(plan.rowLimit) : null,
  aggregateResultConditions: plan.aggregateResultConditions.map(withoutPlanElementKey),
  joinPath: {
    ...plan.joinPath,
    requirements: plan.joinPath.requirements.map(withoutPlanElementKey),
  },
});

const createMeasure = (
  overrides: Partial<BusinessSqlMeasure> = {},
): BusinessSqlMeasure => {
  const seed = {
    kind: overrides.kind || "sum" as const,
    entity: overrides.entity || "Orders",
    table: overrides.table || "orders",
    field: overrides.field || "revenue",
    distinct: overrides.distinct || false,
  };
  const label = overrides.label || "Total revenue";
  return {
    ...seed,
    planElementKey: measureElementKey,
    measureId: createBusinessSqlMeasureId(seed),
    fieldInferredType: "numeric",
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
    ...overrides,
  };
};

const createGrouping = (
  overrides: Partial<BusinessSqlGrouping> = {},
): BusinessSqlGrouping => ({
  planElementKey: groupingElementKey,
  entity: "Customers",
  table: "customers",
  field: "region",
  label: "Region",
  ...overrides,
});

const createFilter = (
  overrides: Partial<BusinessSqlFilter> = {},
): BusinessSqlFilter => {
  const seed: BusinessSqlFilter = {
    planElementKey: filterElementKey,
    kind: "custom",
    target: {
      kind: "field",
      entity: "Orders",
      table: "orders",
      field: "status",
      fieldInferredType: "categorical",
      resolved: true,
    },
    entity: "Orders",
    table: "orders",
    field: "status",
    fieldInferredType: "categorical",
    operator: "equals",
    comparisonValue: { kind: "string", value: "active" },
    label: "Status is active",
    evidence: "User asked for active orders.",
    ...overrides,
  };
  return {
    ...seed,
    filterId: createBusinessSqlFilterId(seed),
  };
};

const createStatusFilter = (
  overrides: Partial<BusinessSqlFilter> = {},
): BusinessSqlFilter =>
  createFilter({
    planElementKey: statusFilterElementKey,
    label: "Status semantics",
    evidence: "Status semantics are a production-owned role.",
    ...overrides,
  });

const createSort = (
  measure: BusinessSqlMeasure,
  overrides: Partial<BusinessSqlSort> = {},
): BusinessSqlSort => {
  const target = { kind: "measure" as const, measureId: measure.measureId, resolved: true };
  const direction = overrides.direction || "desc";
  return {
    planElementKey: sortElementKey,
    sortId: createBusinessSqlSortId({ target, direction }),
    target,
    direction,
    label: "Revenue ranking",
    ...overrides,
  };
};

const createRowLimit = (
  overrides: Partial<BusinessSqlRowLimit> = {},
): BusinessSqlRowLimit => {
  const rowLimit = { value: overrides.value || 10 };
  return {
    planElementKey: rowLimitElementKey,
    ...rowLimit,
    rowLimitId: createBusinessSqlRowLimitId(rowLimit),
    ...overrides,
  };
};

const createCondition = (
  measure: BusinessSqlMeasure,
  overrides: Partial<BusinessSqlAggregateResultCondition> = {},
): BusinessSqlAggregateResultCondition => {
  const seed = {
    measureId: measure.measureId,
    operator: overrides.operator || "greater_than" as const,
    comparisonValue: overrides.comparisonValue || { kind: "number" as const, value: 100 },
  };
  return {
    ...seed,
    planElementKey: comparisonElementKey,
    conditionId: createBusinessSqlAggregateResultConditionId(seed),
    label: "Revenue threshold",
    ...overrides,
  };
};

const createJoinRequirement = (
  overrides: Partial<BusinessSqlJoinRequirement> = {},
): BusinessSqlJoinRequirement => ({
  planElementKey: relationshipElementKey,
  fromEntity: "Orders",
  toEntity: "Customers",
  required: true,
  relationship: "orders.customer_id -> customers.customer_id",
  verified: true,
  ...overrides,
});

const createEligiblePlanInput = (
  overrides: Partial<BusinessSqlQueryPlan> = {},
): BusinessSqlQueryPlan => {
  const revenue = createMeasure();
  const plan: BusinessSqlQueryPlan = {
    ...createEmptyBusinessSqlQueryPlan(),
    id: scopeId,
    kind: "multi_table_count_grouping",
    status: "resolved",
    support: "supported",
    entities: [
      { entity: "Orders", table: "orders", required: true, role: "metric_subject" },
      { entity: "Customers", table: "customers", required: true, role: "grouping_subject" },
    ],
    metric: null,
    measures: [revenue],
    groupings: [createGrouping()],
    filters: [createFilter(), createStatusFilter()],
    filterCombinator: "and",
    orderBy: [createSort(revenue)],
    rowLimit: createRowLimit(),
    aggregateResultConditions: [createCondition(revenue)],
    joinPath: {
      required: true,
      status: "resolved",
      entities: ["Orders", "Customers"],
      edges: [
        {
          fromEntity: "Orders",
          fromTable: "orders",
          fromField: "customer_id",
          toEntity: "Customers",
          toTable: "customers",
          toField: "customer_id",
          relationship: "orders.customer_id -> customers.customer_id",
          verified: true,
        },
      ],
      requirements: [createJoinRequirement()],
    },
    renderer: { targetDialect: "duckdb", status: "renderable", notes: [] },
    preview: {
      title: "CMG2 identity plan",
      metricSummary: "Total revenue",
      groupingSummary: "Grouped by region.",
      filterSummary: "Filtered to active orders.",
      joinSummary: "Requires Orders -> Customers.",
      rendererSummary: "Plan is ready for SQL rendering.",
    },
    ...overrides,
  };
  return plan;
};

const createEligiblePlan = (
  overrides: Partial<BusinessSqlQueryPlan> = {},
): BusinessSqlQueryPlan => attachBusinessSqlPlanElementIdentityManifest(createEligiblePlanInput(overrides));

const renderSql = (
  plan: BusinessSqlQueryPlan,
  dialect: "duckdb" | "postgresql",
): string =>
  renderBusinessSqlQueryPlanArtifact(
    plan,
    createBusinessSqlPreviewRenderRequest(plan, dialect),
  ).sql || "";

const identityFor = (
  plan: BusinessSqlQueryPlan,
  kind: BusinessSqlPlanElementKind,
  elementKey: string,
): BusinessSqlPlanElementIdentity | null =>
  resolveBusinessSqlPlanElementIdentity(plan, { kind, elementKey });

const column = (
  name: string,
  inferredType: "text" | "numeric" | "date" | "boolean" | "categorical",
) => ({
  name,
  type: inferredType,
  inferred_type: inferredType,
  null_count: 0,
  unique_count: 3,
  sample_values: [],
});

const worksheet = (
  worksheetId: string,
  tableName: string,
  columns: ReturnType<typeof column>[],
): NonNullable<AdaptiveReportProposalRequest["worksheets"]>[number] => ({
  worksheetId,
  displayName: tableName,
  sheetName: tableName,
  tableName,
  schema: columns,
});

const proposalWorksheets = [
  worksheet("worksheet:orders", "orders", [
    column("revenue", "numeric"),
    column("cost", "numeric"),
    column("region", "categorical"),
    column("category", "categorical"),
    column("status", "categorical"),
    column("customer_id", "text"),
    column("product_id", "text"),
  ]),
  worksheet("worksheet:customers", "customers", [
    column("customer_id", "text"),
    column("region", "categorical"),
  ]),
  worksheet("worksheet:products", "products", [
    column("product_id", "text"),
    column("category", "categorical"),
  ]),
];

const scopeFor = (worksheets: typeof proposalWorksheets) =>
  worksheets.map((item) => ({
    worksheetId: item.worksheetId,
    sourceType: "original" as const,
    tableName: item.tableName,
    originalTableName: item.tableName,
  }));

const proposalFromIntent = ({
  prompt,
  metrics,
  grouping = ["region"],
  entities = ["orders"],
}: {
  prompt: string;
  metrics: string[];
  grouping?: string[];
  entities?: string[];
}): AdaptiveReportProposal =>
  proposeAdaptiveReport({
    prompt,
    detectedIntent: {
      primaryIntent: "ranking",
      alternates: [],
      entities,
      metrics,
      grouping,
      relationshipPredicate: null,
      explicitlyTemporal: false,
      detectorVersion: "v1",
    },
    worksheets: proposalWorksheets,
    appliedScopeSelections: scopeFor(proposalWorksheets),
  });

const bridgePlanFor = (proposal: AdaptiveReportProposal): BusinessSqlQueryPlan | null =>
  createBusinessSqlPlanFromAdaptiveProposal({ proposal }).plan;

const fixtures: Array<{
  name: string;
  run: () => { summary: string; failureReasons: string[] };
}> = [
  {
    name: "supported identity kinds and collision-safe encoding are representable",
    run: () => {
      const keys = ["Key", "key", " key", "key ", "key.value", "key:value", "key/value", "caf\u00e9", "cafe\u0301"];
      const identities = keys.map((elementKey) =>
        createBusinessSqlPlanElementIdentity({ scopeId, kind: "measure", elementKey }),
      );
      return {
        summary: identities.map((identity) => identity.elementId).join(","),
        failureReasons: [
          ...expect(supportedKinds.every((kind) => isBusinessSqlPlanElementKind(kind)), "Expected every supported kind."),
          ...expect(!isBusinessSqlPlanElementKind("metric"), "Expected unguided alias kind to be rejected."),
          ...expect(new Set(identities.map((identity) => identity.elementId)).size === keys.length, "Expected no encoded collisions."),
          ...expect(
            Boolean(createBusinessSqlPlanElementIdentity({
              scopeId,
              kind: "visualization",
              elementKey: "visualization:primary",
            }).elementId),
            "Expected visualization identity kind.",
          ),
          ...expect(
            Boolean(createBusinessSqlPlanElementIdentity({
              scopeId,
              kind: "extension:downstream-artifact",
              elementKey: "extension:governed-export",
            }).elementId),
            "Expected governed extension identity kind.",
          ),
        ],
      };
    },
  },
  {
    name: "fully eligible plan receives a complete valid manifest",
    run: () => {
      const input = createEligiblePlanInput();
      const inputCapability = assessBusinessSqlPlanElementIdentityCapability(input);
      const plan = attachBusinessSqlPlanElementIdentityManifest(input);
      const validation = validateBusinessSqlPlanElementIdentityManifest(plan);
      const capability = assessBusinessSqlPlanElementIdentityCapability(plan);
      return {
        summary: capability.summary,
        failureReasons: [
          ...expect(inputCapability.status === "eligible", "Expected no-manifest unique plan to be eligible."),
          ...expect(validation.valid, "Expected valid identity manifest."),
          ...expect(capability.status === "identity_capable", "Expected identity-capable status."),
          ...expect(plan.elementIdentities?.length === expectedEligibleClaims.length, "Expected complete manifest."),
          ...expectedEligibleClaims.flatMap(([kind, key]) =>
            expect(Boolean(identityFor(plan, kind, key)), `Expected ${kind}:${key} identity.`),
          ),
        ],
      };
    },
  },
  {
    name: "existing valid identity metadata is preserved",
    run: () => {
      const plan = createEligiblePlan();
      const originalManifest = plan.elementIdentities;
      const reattached = attachBusinessSqlPlanElementIdentityManifest({
        ...plan,
        measures: [{ ...plan.measures[0], label: "Changed display label" }],
      });
      return {
        summary: `sameManifest=${reattached.elementIdentities === originalManifest}`,
        failureReasons: [
          ...expect(reattached.elementIdentities === originalManifest, "Expected existing manifest to be preserved."),
          ...expect(validateBusinessSqlPlanElementIdentityManifest(reattached).valid, "Expected preserved manifest to remain valid."),
        ],
      };
    },
  },
  {
    name: "role-owned mutable content changes preserve identity",
    run: () => {
      const before = createEligiblePlan();
      const changedMeasure = createMeasure({
        field: "net_revenue",
        label: "Net revenue after returns",
        sqlAlias: "net_revenue_after_returns",
        definitionAuthority: {
          authority: "provisional_proxy",
          source: { sourceType: "filtraqueri_proposal", sourceId: "proposal:v2", approved: false },
          scope: { scopeKind: "workspace", scopeId: "workspace:cmg2" },
          limitations: ["Pending steward approval."],
          acceptance: { accepted: true },
          revision: { revisionId: "definition:revenue:draft" },
          reuseEligibility: { eligible: false, allowedScopes: [] },
        },
      });
      const changed = attachBusinessSqlPlanElementIdentityManifest({
        ...before,
        measures: [changedMeasure],
        filters: [
          createFilter({
            operator: "contains",
            comparisonValue: { kind: "string", value: "trial" },
            label: "Status contains trial",
            evidence: "Diagnostic reason changed.",
          }),
          createStatusFilter({ label: "Status semantics label changed" }),
        ],
        aggregateResultConditions: [
          createCondition(changedMeasure, {
            operator: "less_than_or_equal",
            comparisonValue: { kind: "number", value: 250 },
          }),
        ],
        orderBy: [createSort(changedMeasure, { direction: "asc", label: "Ascending revenue" })],
        rowLimit: createRowLimit({ value: 25 }),
        joinPath: {
          ...before.joinPath,
          requirements: [
            createJoinRequirement({
              fromEntity: "Orders display label v2",
              toEntity: "Customer display label v2",
              relationship: "Relationship label changed.",
            }),
          ],
        },
        elementIdentities: undefined,
      });
      return {
        summary: expectedEligibleClaims.map(([kind, key]) => `${kind}:${key}`).join(","),
        failureReasons: expectedEligibleClaims.flatMap(([kind, key]) =>
          expect(
            identityFor(before, kind, key)?.elementId === identityFor(changed, kind, key)?.elementId,
            `Expected ${kind}:${key} to preserve identity across mutable content changes.`,
          ),
        ),
      };
    },
  },
  {
    name: "eligible element reordering preserves identity through JSON reconstruction",
    run: () => {
      const before = createEligiblePlan();
      const beforeIds = expectedEligibleClaims.map(([kind, key]) => [
        kind,
        key,
        identityFor(before, kind, key)?.elementId,
      ]);
      const reconstructedInput = JSON.parse(JSON.stringify({
        ...before,
        filters: [before.filters[1], before.filters[0]],
        elementIdentities: undefined,
      })) as BusinessSqlQueryPlan;
      const after = attachBusinessSqlPlanElementIdentityManifest(reconstructedInput);
      const validation = validateBusinessSqlPlanElementIdentityManifest(after);
      return {
        summary: validation.summary,
        failureReasons: [
          ...expect(validation.valid, "Expected reordered reconstructed plan to validate."),
          ...expect(after.filters[0]?.planElementKey === statusFilterElementKey, "Expected reordered status filter first."),
          ...beforeIds.flatMap(([kind, key, elementId]) =>
            expect(
              identityFor(after, kind as BusinessSqlPlanElementKind, key as string)?.elementId === elementId,
              `Expected ${kind}:${key} identity to survive reorder.`,
            ),
          ),
        ],
      };
    },
  },
  {
    name: "serialization and JSON reconstruction preserve identity bytes",
    run: () => {
      const identity = createBusinessSqlPlanElementIdentity({
        scopeId,
        kind: "measure",
        elementKey: measureElementKey,
      });
      const serialized = JSON.stringify({ identity: serializeBusinessSqlPlanElementIdentity(identity) });
      const parsed = JSON.parse(serialized) as { identity: string };
      const reconstructed = reconstructBusinessSqlPlanElementIdentity(parsed.identity);
      return {
        summary: parsed.identity,
        failureReasons: [
          ...expect(reconstructed.elementId === identity.elementId, "Expected reconstructed id to match."),
          ...expect(serializeBusinessSqlPlanElementIdentity(reconstructed) === parsed.identity, "Expected byte-identical serialization."),
        ],
      };
    },
  },
  {
    name: "stable-anchor collisions block attachment while invalid manifests still fail honestly",
    run: () => {
      const plan = createEligiblePlan();
      const collisionInput = createEligiblePlanInput({
        filters: [createFilter(), createFilter({ label: "Duplicate explicit row filter" })],
      });
      const beforeMutationSnapshot = JSON.stringify(collisionInput);
      const collisionCapability = assessBusinessSqlPlanElementIdentityCapability(collisionInput);
      const collisionAttached = attachBusinessSqlPlanElementIdentityManifest(collisionInput);
      const collisionSqlUnattached = renderSql(collisionInput, "duckdb");
      const collisionSqlAttached = renderSql(collisionAttached, "duckdb");
      const duplicateManifestPlan = {
        ...collisionInput,
        elementIdentities: [
          createBusinessSqlPlanElementIdentity({
            scopeId,
            kind: "filter",
            elementKey: filterElementKey,
          }),
        ],
      };
      const partial = { ...plan, elementIdentities: plan.elementIdentities?.slice(1) };
      const extra = {
        ...plan,
        elementIdentities: [
          ...(plan.elementIdentities || []),
          createBusinessSqlPlanElementIdentity({
            scopeId,
            kind: "explanation",
            elementKey: "explanation:extra",
          }),
        ],
      };
      const malformed = {
        ...plan,
        elementIdentities: [
          {
            version: "business-sql-plan-element-identity:v0",
            scopeId,
            kind: "measure",
            elementKey: measureElementKey,
            elementId: "business-sql-plan-element:bad",
          },
        ],
      } as unknown as BusinessSqlQueryPlan;
      const duplicateValidation = validateBusinessSqlPlanElementIdentityManifest(duplicateManifestPlan);
      const partialValidation = validateBusinessSqlPlanElementIdentityManifest(partial);
      const extraValidation = validateBusinessSqlPlanElementIdentityManifest(extra);
      const malformedValidation = validateBusinessSqlPlanElementIdentityManifest(malformed);
      return {
        summary: [
          collisionCapability.summary,
          duplicateValidation.summary,
          partialValidation.summary,
          extraValidation.summary,
          malformedValidation.summary,
        ].join(" | "),
        failureReasons: [
          ...expect(collisionCapability.status === "ineligible", "Expected collision to be ineligible."),
          ...expect(collisionCapability.reasonCodes.includes("stable_anchor_collision"), "Expected collision reason."),
          ...expect(collisionCapability.stableAnchorCollisionKinds.includes("filter"), "Expected affected filter kind."),
          ...expect(collisionAttached === collisionInput, "Expected ineligible attachment to return original plan."),
          ...expect(!collisionAttached.elementIdentities, "Expected no partial manifest for collision."),
          ...expect(JSON.stringify(collisionInput) === beforeMutationSnapshot, "Expected collision input to remain unmutated."),
          ...expect(collisionSqlUnattached === collisionSqlAttached, "Expected collision SQL invariance."),
          ...expect(duplicateValidation.reasonCodes.includes("duplicate_element_claim"), "Expected duplicate claim failure."),
          ...expect(partialValidation.reasonCodes.includes("element_claim_without_identity"), "Expected missing identity failure."),
          ...expect(extraValidation.reasonCodes.includes("identity_without_element_claim"), "Expected extra identity failure."),
          ...expect(malformedValidation.reasonCodes.includes("identity_version_unsupported"), "Expected unsupported version failure."),
          ...expect(malformedValidation.reasonCodes.includes("identity_element_id_malformed"), "Expected malformed id failure."),
        ],
      };
    },
  },
  {
    name: "legacy empty plans remain compatible without identity request",
    run: () => {
      const plan = createEmptyBusinessSqlQueryPlan();
      const validation = validateBusinessSqlPlanElementIdentityManifest(plan);
      const capability = assessBusinessSqlPlanElementIdentityCapability(plan);
      return {
        summary: capability.summary,
        failureReasons: [
          ...expect(validation.valid, "Expected legacy validation compatibility."),
          ...expect(validation.compatibleLegacyPlan, "Expected legacy validation marker."),
          ...expect(capability.status === "legacy_compatible", "Expected legacy capability status."),
        ],
      };
    },
  },
  {
    name: "multiple requested measures are identity-ineligible without partial manifest",
    run: () => {
      const proposal = proposalFromIntent({
        prompt: "Show total revenue and total cost by region",
        metrics: ["sum_revenue", "sum_cost"],
      });
      const plan = bridgePlanFor(proposal);
      const capability = plan ? assessBusinessSqlPlanElementIdentityCapability(plan) : null;
      return {
        summary: capability?.summary || "no plan",
        failureReasons: [
          ...expect(Boolean(plan), "Expected bridge plan."),
          ...expect(capability?.status === "ineligible", "Expected identity-ineligible capability."),
          ...expect(capability?.reasonCodes.includes("stable_anchor_unavailable") === true, "Expected stable-anchor reason."),
          ...expect(capability?.missingStableAnchorKinds.includes("measure") === true, "Expected missing measure anchor."),
          ...expect(!plan?.elementIdentities, "Expected no partial manifest."),
        ],
      };
    },
  },
  {
    name: "multiple requested groupings are identity-ineligible without partial manifest",
    run: () => {
      const proposal = proposalFromIntent({
        prompt: "Show total revenue by region and category",
        metrics: ["sum_revenue"],
        grouping: ["region", "category"],
      });
      const plan = bridgePlanFor(proposal);
      const capability = plan ? assessBusinessSqlPlanElementIdentityCapability(plan) : null;
      return {
        summary: capability?.summary || "no plan",
        failureReasons: [
          ...expect(Boolean(plan), "Expected bridge plan."),
          ...expect(capability?.status === "ineligible", "Expected identity-ineligible capability."),
          ...expect(capability?.missingStableAnchorKinds.includes("grouping") === true, "Expected missing grouping anchor."),
          ...expect(!plan?.elementIdentities, "Expected no partial manifest."),
        ],
      };
    },
  },
  {
    name: "multiple relationship requirements are identity-ineligible without partial manifest",
    run: () => {
      const proposal = proposalFromIntent({
        prompt: "Show total revenue by region for orders customers and products",
        metrics: ["sum_revenue"],
        grouping: ["region"],
        entities: ["orders", "customers", "products"],
      });
      const plan = bridgePlanFor(proposal);
      const capability = plan ? assessBusinessSqlPlanElementIdentityCapability(plan) : null;
      return {
        summary: capability?.summary || "no plan",
        failureReasons: [
          ...expect(Boolean(plan), "Expected bridge plan."),
          ...expect(capability?.status === "ineligible", "Expected identity-ineligible capability."),
          ...expect(capability?.missingStableAnchorKinds.includes("relationship") === true, "Expected missing relationship anchor."),
          ...expect(!plan?.elementIdentities, "Expected no partial manifest."),
        ],
      };
    },
  },
  {
    name: "identity metadata and ineligibility do not alter SQL bytes or introduce later milestones",
    run: () => {
      const eligible = createEligiblePlan();
      const legacyEquivalent = removeIdentityMetadata(eligible);
      const ineligibleInput = {
        ...eligible,
        filters: [createFilter({ planElementKey: undefined })],
        elementIdentities: undefined,
      };
      const ineligibleAttached = attachBusinessSqlPlanElementIdentityManifest(ineligibleInput);
      const leaked = [renderSql(eligible, "duckdb"), renderSql(eligible, "postgresql")].some((sql) =>
        sql.includes("business-sql-plan-element") ||
        sql.includes(measureElementKey) ||
        sql.includes("elementIdentities"),
      );
      return {
        summary: [
          `duckdb=${renderSql(eligible, "duckdb") === renderSql(legacyEquivalent, "duckdb")}`,
          `postgresql=${renderSql(eligible, "postgresql") === renderSql(legacyEquivalent, "postgresql")}`,
          `ineligible=${renderSql(ineligibleInput, "duckdb") === renderSql(ineligibleAttached, "duckdb")}`,
        ].join("; "),
        failureReasons: [
          ...expect(renderSql(eligible, "duckdb") === renderSql(legacyEquivalent, "duckdb"), "Expected DuckDB SQL invariance."),
          ...expect(renderSql(eligible, "postgresql") === renderSql(legacyEquivalent, "postgresql"), "Expected PostgreSQL SQL invariance."),
          ...expect(renderSql(ineligibleInput, "duckdb") === renderSql(ineligibleAttached, "duckdb"), "Expected ineligible SQL invariance."),
          ...expect(!ineligibleAttached.elementIdentities, "Expected ineligible attachment to remain manifest-free."),
          ...expect(!leaked, "Expected identity metadata not to appear in SQL."),
          ...expect(!("revisions" in eligible), "Expected no revision history."),
          ...expect(!("dependencyGraph" in eligible), "Expected no dependency graph."),
          ...expect(!("executedResult" in eligible), "Expected no execution result contract."),
        ],
      };
    },
  },
];

export function runBusinessSqlPlanElementIdentityFixtures(): BusinessSqlPlanElementIdentityFixtureReport {
  const results = fixtures.map((fixture) => {
    const { summary, failureReasons } = fixture.run();
    return {
      name: fixture.name,
      ok: failureReasons.length === 0,
      summary,
      failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
