/** PS-CMG3 - immutable canonical-plan revision and lineage fixtures. */

import { attachBusinessSqlPlanElementIdentityManifest } from "../businessSqlPlanElementIdentity";
import {
  applyAcceptedBusinessSqlPlanRevision,
  createBusinessSqlRootPlanRevision,
  getActiveBusinessSqlPlan,
  validateBusinessSqlPlanRevisionLedger,
  type BusinessSqlAcceptedPlanRevisionRequest,
  type BusinessSqlPlanRevisionChangeRecord,
  type BusinessSqlPlanRevisionProvenance,
  type BusinessSqlVersionedPlanLedger,
} from "../businessSqlPlanRevisionLineage";
import {
  createBusinessSqlFilterId,
  createBusinessSqlMeasureAlias,
  createBusinessSqlMeasureId,
  createBusinessSqlRowLimitId,
  createEmptyBusinessSqlQueryPlan,
  type BusinessSqlFilter,
  type BusinessSqlMeasure,
  type BusinessSqlQueryPlan,
} from "../businessSqlQueryPlan";
import type { BusinessSqlDefinitionAuthorityRecord } from "../businessSqlDefinitionAuthority";
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

export type BusinessSqlPlanRevisionLineageFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const expect = (condition: boolean, message: string): string[] =>
  condition ? [] : [message];

const planId = "business-sql-plan:cmg3";
const measureKey = "measure:primary";
const filterKey = "filter:explicit-row";
const statusFilterKey = "filter:status-semantics";
const rowLimitKey = "ranking:row-limit";

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonical = (value: unknown): string => JSON.stringify(value);

const createMeasure = (
  overrides: Partial<BusinessSqlMeasure> = {},
): BusinessSqlMeasure => {
  const seed = {
    kind: "sum" as const,
    entity: "Orders",
    table: "orders",
    field: "revenue",
    distinct: false,
  };
  const label = overrides.label || "Total revenue";
  return {
    ...seed,
    planElementKey: measureKey,
    measureId: createBusinessSqlMeasureId(seed),
    fieldInferredType: "numeric",
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
    ...overrides,
  };
};

const createFilter = (
  overrides: Partial<BusinessSqlFilter> = {},
): BusinessSqlFilter => {
  const filter: BusinessSqlFilter = {
    planElementKey: filterKey,
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
    evidence: "User accepted the active status filter.",
    ...overrides,
  };
  return { ...filter, filterId: createBusinessSqlFilterId(filter) };
};

const createStatusFilter = (): BusinessSqlFilter =>
  createFilter({
    planElementKey: statusFilterKey,
    operator: "contains",
    comparisonValue: { kind: "string", value: "trial" },
    label: "Status contains trial",
  });

const createPlan = (overrides: Partial<BusinessSqlQueryPlan> = {}): BusinessSqlQueryPlan => {
  const revenue = createMeasure();
  return attachBusinessSqlPlanElementIdentityManifest({
    ...createEmptyBusinessSqlQueryPlan(),
    id: planId,
    kind: "single_table_count_grouping",
    status: "resolved",
    support: "supported",
    entities: [
      { entity: "Orders", table: "orders", required: true, role: "metric_subject" },
    ],
    metric: null,
    measures: [revenue],
    groupings: [],
    filters: [createFilter(), createStatusFilter()],
    filterCombinator: "and",
    orderBy: [],
    rowLimit: {
      planElementKey: rowLimitKey,
      value: 10,
      rowLimitId: createBusinessSqlRowLimitId({ value: 10 }),
    },
    aggregateResultConditions: [],
    joinPath: {
      required: false,
      status: "not_required",
      entities: [],
      edges: [],
      requirements: [],
    },
    renderer: { targetDialect: "duckdb", status: "renderable", notes: [] },
    preview: {
      title: "CMG3 revision plan",
      metricSummary: "Total revenue",
      groupingSummary: "No grouping.",
      filterSummary: "Filtered by status.",
      joinSummary: "No join path required.",
      rendererSummary: "Renderable.",
    },
    ...overrides,
  });
};

const createLegacyPlan = (): BusinessSqlQueryPlan => {
  const plan = createPlan();
  return {
    ...plan,
    elementIdentities: undefined,
    measures: plan.measures.map((measure) => {
      const copy = { ...measure };
      delete copy.planElementKey;
      return copy;
    }),
    filters: plan.filters.map((filter) => {
      const copy = { ...filter };
      delete copy.planElementKey;
      return copy;
    }),
    rowLimit: plan.rowLimit ? { ...plan.rowLimit, planElementKey: undefined } : null,
  };
};

const identityId = (plan: BusinessSqlQueryPlan, elementKey: string): string =>
  plan.elementIdentities?.find((identity) => identity.elementKey === elementKey)?.elementId || "";

const provenance = (
  overrides: Partial<BusinessSqlPlanRevisionProvenance> = {},
): BusinessSqlPlanRevisionProvenance => ({
  actor: { actorId: "user:analyst-1", actorType: "user" },
  source: { sourceId: "clarification:cmg3:accepted", sourceType: "clarification" },
  reason: "Accepted clarification updates the canonical plan.",
  clarificationId: "clarification:cmg3:accepted",
  acceptanceId: "acceptance:cmg3:accepted",
  acceptedAt: "2026-08-10T00:00:00Z",
  ...overrides,
});

const authorityRecord: BusinessSqlDefinitionAuthorityRecord = {
  authority: "user_defined",
  source: { sourceType: "user", sourceId: "user:analyst-1", approved: false },
  scope: { scopeKind: "investigation", scopeId: "investigation:cmg3" },
  limitations: ["Scoped to this investigation."],
  acceptance: {
    accepted: true,
    actorId: "user:analyst-1",
    acceptanceId: "acceptance:definition:cmg3",
    acceptedAt: "2026-08-10T00:00:00Z",
    acceptedScope: { scopeKind: "investigation", scopeId: "investigation:cmg3" },
  },
  revision: { revisionId: "definition-authority:cmg3:user-revenue" },
  reuseEligibility: {
    eligible: true,
    allowedScopes: [{ scopeKind: "investigation", scopeId: "investigation:cmg3" }],
  },
};

const rootLedger = (plan = createPlan()): BusinessSqlVersionedPlanLedger => {
  const result = createBusinessSqlRootPlanRevision({
    plan,
    identity: { revisionId: "revision:root", revisionSequence: 1 },
  });
  if (result.status !== "created") throw new Error(result.validation.summary);
  return result.ledger;
};

const changeFilterValue = (
  plan: BusinessSqlQueryPlan,
  overrides: Partial<BusinessSqlPlanRevisionChangeRecord> = {},
): BusinessSqlPlanRevisionChangeRecord => {
  const targetFilter = plan.filters.find((filter) => filter.planElementKey === filterKey) || plan.filters[0];
  return {
    changeId: "change:filter-value",
    changeKind: "filter.comparison_value",
    targetElementId: identityId(plan, filterKey),
    targetElementKind: "filter",
    previousValue: cloneJson(targetFilter.comparisonValue || null),
    proposedValue: { kind: "string", value: "pending" },
    acceptedValue: { kind: "string", value: "pending" },
    actor: provenance().actor,
    source: provenance().source,
    reason: "Accepted status value.",
    clarificationId: "clarification:filter-value",
    acceptanceId: "acceptance:filter-value",
    ...overrides,
  };
};

const changeRowLimit = (
  plan: BusinessSqlQueryPlan,
  overrides: Partial<BusinessSqlPlanRevisionChangeRecord> = {},
): BusinessSqlPlanRevisionChangeRecord => ({
  changeId: "change:row-limit",
  changeKind: "row_limit.value",
  targetElementId: identityId(plan, rowLimitKey),
  targetElementKind: "ranking",
  previousValue: plan.rowLimit?.value || null,
  proposedValue: 25,
  acceptedValue: 25,
  actor: provenance().actor,
  source: provenance().source,
  reason: "Accepted row limit.",
  clarificationId: "clarification:row-limit",
  acceptanceId: "acceptance:row-limit",
  ...overrides,
});

const changeRevisionMetadata = (
  plan: BusinessSqlQueryPlan,
): BusinessSqlPlanRevisionChangeRecord => ({
  changeId: "change:metadata-only",
  changeKind: "revision_metadata",
  targetElementId: identityId(plan, filterKey),
  targetElementKind: "filter",
  previousValue: "reviewed",
  proposedValue: "accepted without canonical mutation",
  acceptedValue: "accepted without canonical mutation",
  actor: provenance().actor,
  source: provenance().source,
  reason: "Accepted metadata-only clarification.",
  clarificationId: "clarification:metadata-only",
  acceptanceId: "acceptance:metadata-only",
});

const acceptedRequest = (
  ledger: BusinessSqlVersionedPlanLedger,
  changes: BusinessSqlPlanRevisionChangeRecord[],
  overrides: Partial<BusinessSqlAcceptedPlanRevisionRequest> = {},
): BusinessSqlAcceptedPlanRevisionRequest => ({
  status: "accepted",
  parentRevisionId: ledger.activeRevisionId,
  identity: {
    revisionId: `revision:${ledger.revisions.length + 1}`,
    revisionSequence: ledger.revisions.length + 1,
    parentRevisionId: ledger.activeRevisionId,
  },
  changes,
  provenance: provenance(),
  ...overrides,
});

const applyChild = (
  ledger = rootLedger(),
  changes = [changeFilterValue(getActiveBusinessSqlPlan(ledger) || createPlan())],
) => {
  const request = acceptedRequest(ledger, changes);
  const result = applyAcceptedBusinessSqlPlanRevision(ledger, request);
  if (result.status !== "created") throw new Error(result.validation.summary);
  return { request, result };
};

const renderSql = (
  plan: BusinessSqlQueryPlan,
  dialect: "duckdb" | "postgresql",
): string =>
  renderBusinessSqlQueryPlanArtifact(
    { ...plan, renderer: { ...plan.renderer, targetDialect: dialect } },
    createBusinessSqlPreviewRenderRequest(plan, dialect),
  ).sql || "";

const sqlHasRevisionLeak = (sql: string): boolean =>
  [
    "revisionId",
    "parentRevisionId",
    "revisionSequence",
    "clarification",
    "actor",
    "acceptance",
    "previousValue",
    "proposedValue",
    "acceptedValue",
    "activeRevision",
    "lineage",
  ].some((token) => sql.includes(token));

const fixtures: Array<{
  name: string;
  run: () => { summary: string; failureReasons: string[] };
}> = [
  {
    name: "valid root revision creation",
    run: () => {
      const plan = createPlan();
      const result = createBusinessSqlRootPlanRevision({
        plan,
        identity: { revisionId: "revision:root", revisionSequence: 1 },
      });
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "created", "Expected root creation."),
          ...expect(result.status === "created" && result.ledger.revisions.length === 1, "Expected exactly one root."),
          ...expect(result.status === "created" && result.ledger.activeRevisionId === "revision:root", "Expected root active."),
          ...expect(canonical(plan) === canonical(createPlan()), "Expected supplied plan to remain unchanged."),
        ],
      };
    },
  },
  {
    name: "valid accepted child revision",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const result = applyAcceptedBusinessSqlPlanRevision(ledger, acceptedRequest(ledger, [changeFilterValue(active)]));
      const childPlan = result.status === "created" ? getActiveBusinessSqlPlan(result.ledger) : null;
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "created", "Expected accepted child."),
          ...expect(childPlan?.filters[0].comparisonValue?.kind === "string", "Expected typed accepted value."),
          ...expect(
            childPlan?.filters[0].comparisonValue?.kind === "string" &&
              childPlan.filters[0].comparisonValue.value === "pending",
            "Expected canonical filter value to change.",
          ),
        ],
      };
    },
  },
  {
    name: "previous proposed and accepted values are preserved independently",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const change = changeFilterValue(active, {
        proposedValue: { kind: "string", value: "pending or review" },
        acceptedValue: { kind: "string", value: "pending" },
      });
      const result = applyAcceptedBusinessSqlPlanRevision(ledger, acceptedRequest(ledger, [change]));
      const record = result.status === "created" ? result.revision.changes[0] : null;
      return {
        summary: record ? canonical(record) : result.validation.summary,
        failureReasons: [
          ...expect(result.status === "created", "Expected revision creation."),
          ...expect(canonical(record?.previousValue) === canonical({ kind: "string", value: "active" }), "Expected previous value."),
          ...expect(canonical(record?.proposedValue) !== canonical(record?.acceptedValue), "Expected proposed and accepted to differ."),
          ...expect(canonical(record?.acceptedValue) === canonical({ kind: "string", value: "pending" }), "Expected accepted value."),
        ],
      };
    },
  },
  {
    name: "parent and child lineage are explicit",
    run: () => {
      const ledger = rootLedger();
      const { result } = applyChild(ledger);
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.ledger.revisions[1].parentRevisionId === "revision:root", "Expected child parent."),
          ...expect(result.ledger.revisions[1].identity.parentRevisionId === "revision:root", "Expected identity parent."),
          ...expect(result.ledger.revisions[0].kind === "root", "Expected root kind."),
          ...expect(result.ledger.revisions[1].kind === "accepted_clarification", "Expected child kind."),
        ],
      };
    },
  },
  {
    name: "revision sequence gaps are rejected while contiguous child passes",
    run: () => {
      const ledger = rootLedger();
      const rootPlanBefore = canonical(ledger.revisions[0].plan);
      const ledgerBefore = canonical(ledger);
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const valid = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeFilterValue(active)], {
          identity: { revisionId: "revision:2", revisionSequence: 2, parentRevisionId: "revision:root" },
        }),
      );
      const request = acceptedRequest(ledger, [changeFilterValue(active)], {
        identity: { revisionId: "revision:3", revisionSequence: 3, parentRevisionId: "revision:root" },
      });
      const requestBefore = canonical(request);
      const gap = applyAcceptedBusinessSqlPlanRevision(ledger, request);
      return {
        summary: `${valid.validation.summary}; ${gap.validation.summary}`,
        failureReasons: [
          ...expect(valid.status === "created", "Expected contiguous 1 -> 2 revision to pass."),
          ...expect(gap.status === "invalid", "Expected 1 -> 3 sequence gap to fail."),
          ...expect(gap.validation.reasonCodes.includes("revision_sequence_gap"), "Expected explicit sequence-gap reason."),
          ...expect(gap.ledger?.revisions.length === 1, "Expected no child revision to be created."),
          ...expect(gap.ledger?.activeRevisionId === "revision:root", "Expected active revision to remain root."),
          ...expect(canonical(ledger) === ledgerBefore, "Expected input ledger unchanged."),
          ...expect(canonical(ledger.revisions[0].plan) === rootPlanBefore, "Expected root plan unchanged."),
          ...expect(canonical(request) === requestBefore, "Expected rejected request unchanged."),
        ],
      };
    },
  },
  {
    name: "active revision advances only in returned ledger",
    run: () => {
      const ledger = rootLedger();
      const { result } = applyChild(ledger);
      return {
        summary: `before=${ledger.activeRevisionId}; after=${result.ledger.activeRevisionId}`,
        failureReasons: [
          ...expect(ledger.activeRevisionId === "revision:root", "Expected input ledger active revision unchanged."),
          ...expect(result.ledger.activeRevisionId === "revision:2", "Expected returned ledger active revision advanced."),
        ],
      };
    },
  },
  {
    name: "parent plan history and request are immutable",
    run: () => {
      const ledger = rootLedger();
      const ledgerBefore = canonical(ledger);
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const request = acceptedRequest(ledger, [changeFilterValue(active)]);
      const requestBefore = canonical(request);
      const result = applyAcceptedBusinessSqlPlanRevision(ledger, request);
      if (result.status === "created") {
        const childFilter = result.ledger.revisions[1].plan.filters[0].comparisonValue;
        if (childFilter?.kind === "string") childFilter.value = "mutated-after-return";
      }
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(canonical(ledger) === ledgerBefore, "Expected input ledger byte-identical."),
          ...expect(canonical(request) === requestBefore, "Expected request byte-identical."),
          ...expect(
            ledger.revisions[0].plan.filters[0].comparisonValue?.kind === "string" &&
              ledger.revisions[0].plan.filters[0].comparisonValue.value === "active",
            "Expected parent nested value not aliased.",
          ),
        ],
      };
    },
  },
  {
    name: "atomic multi-change success",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const result = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeFilterValue(active), changeRowLimit(active)]),
      );
      const plan = result.status === "created" ? getActiveBusinessSqlPlan(result.ledger) : null;
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "created", "Expected atomic success."),
          ...expect(plan?.rowLimit?.value === 25, "Expected row limit change."),
          ...expect(result.status === "created" && result.revision.changes.length === 2, "Expected two change records."),
        ],
      };
    },
  },
  {
    name: "atomic rollback on one invalid change",
    run: () => {
      const ledger = rootLedger();
      const before = canonical(ledger);
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const invalid = changeRowLimit(active, { previousValue: 999 });
      const result = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeFilterValue(active), invalid]),
      );
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "invalid", "Expected invalid request."),
          ...expect(result.validation.reasonCodes.includes("previous_value_mismatch"), "Expected mismatch reason."),
          ...expect(canonical(ledger) === before, "Expected failed input ledger unchanged."),
        ],
      };
    },
  },
  {
    name: "unknown target identity is rejected",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const change = changeFilterValue(active, { targetElementId: "business-sql-plan-element:v1:unknown" });
      const result = applyAcceptedBusinessSqlPlanRevision(ledger, acceptedRequest(ledger, [change]));
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "invalid", "Expected invalid result."),
          ...expect(result.validation.reasonCodes.includes("target_unknown"), "Expected unknown target."),
        ],
      };
    },
  },
  {
    name: "duplicate target claims within one revision are rejected",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const first = changeFilterValue(active);
      const second = changeFilterValue(active, {
        changeId: "change:filter-value-duplicate",
        acceptedValue: { kind: "string", value: "review" },
        proposedValue: { kind: "string", value: "review" },
      });
      const result = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [first, second]),
      );
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "invalid", "Expected duplicate target failure."),
          ...expect(result.validation.reasonCodes.includes("target_duplicate"), "Expected duplicate target reason."),
        ],
      };
    },
  },
  {
    name: "duplicate revision identity is rejected",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const result = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeFilterValue(active)], {
          identity: { revisionId: "revision:root", revisionSequence: 2, parentRevisionId: "revision:root" },
        }),
      );
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "invalid", "Expected duplicate revision failure."),
          ...expect(result.validation.reasonCodes.includes("revision_id_duplicate"), "Expected duplicate id."),
        ],
      };
    },
  },
  {
    name: "parent mismatch is rejected",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const result = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeFilterValue(active)], {
          parentRevisionId: "revision:other",
          identity: { revisionId: "revision:2", revisionSequence: 2, parentRevisionId: "revision:other" },
        }),
      );
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "invalid", "Expected parent mismatch."),
          ...expect(result.validation.reasonCodes.includes("parent_missing"), "Expected parent mismatch reason."),
        ],
      };
    },
  },
  {
    name: "previous value mismatch is rejected",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const result = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeFilterValue(active, { previousValue: { kind: "string", value: "closed" } })]),
      );
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "invalid", "Expected mismatch failure."),
          ...expect(result.validation.reasonCodes.includes("previous_value_mismatch"), "Expected mismatch reason."),
        ],
      };
    },
  },
  {
    name: "invalid or partial acceptance provenance is rejected",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const result = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeFilterValue(active)], {
          provenance: provenance({ reason: "", acceptanceId: "" }),
        }),
      );
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "invalid", "Expected provenance failure."),
          ...expect(result.validation.reasonCodes.includes("provenance_reason_malformed"), "Expected reason failure."),
          ...expect(result.validation.reasonCodes.includes("provenance_acceptance_malformed"), "Expected acceptance failure."),
        ],
      };
    },
  },
  {
    name: "rejected or pending clarification does not create a revision",
    run: () => {
      const ledger = rootLedger();
      const active = getActiveBusinessSqlPlan(ledger) || createPlan();
      const rejected = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeFilterValue(active)], { status: "rejected" }),
      );
      const pending = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeFilterValue(active)], { status: "pending" }),
      );
      return {
        summary: `${rejected.validation.summary}; ${pending.validation.summary}`,
        failureReasons: [
          ...expect(rejected.status === "not_applicable", "Expected rejected not applicable."),
          ...expect(pending.status === "not_applicable", "Expected pending not applicable."),
          ...expect(ledger.revisions.length === 1, "Expected input history unchanged."),
        ],
      };
    },
  },
  {
    name: "serialization and reconstruction preserve lineage",
    run: () => {
      const { result } = applyChild();
      const reconstructed = JSON.parse(JSON.stringify(result.ledger)) as BusinessSqlVersionedPlanLedger;
      const validation = validateBusinessSqlPlanRevisionLedger(reconstructed);
      return {
        summary: validation.summary,
        failureReasons: [
          ...expect(validation.valid, "Expected reconstructed ledger valid."),
          ...expect(canonical(reconstructed) === canonical(result.ledger), "Expected byte-identical JSON reconstruction."),
        ],
      };
    },
  },
  {
    name: "direct validator rejects reconstructed sequence gaps",
    run: () => {
      const { result } = applyChild();
      const validReconstructed = JSON.parse(JSON.stringify(result.ledger)) as BusinessSqlVersionedPlanLedger;
      const validValidation = validateBusinessSqlPlanRevisionLedger(validReconstructed);
      const malformed = JSON.parse(JSON.stringify(result.ledger)) as BusinessSqlVersionedPlanLedger;
      malformed.revisions[1].identity.revisionSequence = 3;
      malformed.activeRevisionId = malformed.revisions[1].identity.revisionId;
      const malformedBefore = canonical(malformed);
      const rootPlanBefore = canonical(malformed.revisions[0].plan);
      const childPlanBefore = canonical(malformed.revisions[1].plan);
      const malformedValidation = validateBusinessSqlPlanRevisionLedger(malformed);
      return {
        summary: `${validValidation.summary}; ${malformedValidation.summary}`,
        failureReasons: [
          ...expect(validValidation.valid, "Expected reconstructed 1 -> 2 ledger to validate."),
          ...expect(!malformedValidation.valid, "Expected reconstructed 1 -> 3 ledger to fail validation."),
          ...expect(
            malformedValidation.reasonCodes.includes("revision_sequence_gap"),
            "Expected direct validator to report revision_sequence_gap.",
          ),
          ...expect(
            malformed.revisions[1].identity.revisionSequence === 3,
            "Expected validator not to repair or renumber child sequence.",
          ),
          ...expect(
            malformed.activeRevisionId === malformed.revisions[1].identity.revisionId,
            "Expected validator not to change active revision.",
          ),
          ...expect(canonical(malformed) === malformedBefore, "Expected malformed ledger to remain byte-identical."),
          ...expect(canonical(malformed.revisions[0].plan) === rootPlanBefore, "Expected root plan snapshot unchanged."),
          ...expect(canonical(malformed.revisions[1].plan) === childPlanBefore, "Expected child plan snapshot unchanged."),
          ...expect(
            !malformedValidation.reasonCodes.includes("revision_sequence_non_monotonic"),
            "Expected gap assertion not to rely on monotonicity failure.",
          ),
        ],
      };
    },
  },
  {
    name: "reorder-stable targeting changes intended element",
    run: () => {
      const plan = createPlan();
      const reordered = attachBusinessSqlPlanElementIdentityManifest({
        ...JSON.parse(JSON.stringify(plan)),
        filters: [plan.filters[1], plan.filters[0]],
      } as BusinessSqlQueryPlan);
      const ledger = rootLedger(reordered);
      const active = getActiveBusinessSqlPlan(ledger) || reordered;
      const result = applyAcceptedBusinessSqlPlanRevision(ledger, acceptedRequest(ledger, [changeFilterValue(active)]));
      const child = result.status === "created" ? getActiveBusinessSqlPlan(result.ledger) : null;
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "created", "Expected reorder child."),
          ...expect(child?.filters[0].planElementKey === statusFilterKey, "Expected first filter still status semantics."),
          ...expect(child?.filters[1].planElementKey === filterKey, "Expected targeted filter remains second."),
          ...expect(
            child?.filters[1].comparisonValue?.kind === "string" &&
              child.filters[1].comparisonValue.value === "pending",
            "Expected stable id to target the explicit-row filter after reorder.",
          ),
          ...expect(new Set(child?.elementIdentities?.map((identity) => identity.elementId)).size === child?.elementIdentities?.length, "Expected no omitted or duplicated identities."),
        ],
      };
    },
  },
  {
    name: "invalid lineage cycle fork and active pointer are rejected",
    run: () => {
      const { result } = applyChild();
      const fork = cloneJson(result.ledger);
      fork.revisions.push({
        ...cloneJson(fork.revisions[1]),
        identity: { revisionId: "revision:fork", revisionSequence: 3, parentRevisionId: "revision:root" },
        parentRevisionId: "revision:root",
      });
      fork.activeRevisionId = "revision:missing";
      const cycle = cloneJson(result.ledger);
      cycle.revisions[0].parentRevisionId = "revision:2";
      const forkValidation = validateBusinessSqlPlanRevisionLedger(fork);
      const cycleValidation = validateBusinessSqlPlanRevisionLedger(cycle);
      return {
        summary: `${forkValidation.summary}; ${cycleValidation.summary}`,
        failureReasons: [
          ...expect(forkValidation.reasonCodes.includes("lineage_fork"), "Expected fork rejection."),
          ...expect(forkValidation.reasonCodes.includes("active_revision_unknown"), "Expected active pointer rejection."),
          ...expect(cycleValidation.reasonCodes.includes("lineage_cycle"), "Expected cycle rejection."),
        ],
      };
    },
  },
  {
    name: "valid PS-CMG2 manifest is preserved byte for byte",
    run: () => {
      const plan = createPlan();
      const manifestBytes = canonical(plan.elementIdentities);
      const { result } = applyChild(rootLedger(plan));
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(canonical(result.ledger.revisions[0].plan.elementIdentities) === manifestBytes, "Expected root manifest bytes."),
          ...expect(canonical(result.ledger.revisions[1].plan.elementIdentities) === manifestBytes, "Expected child manifest bytes."),
        ],
      };
    },
  },
  {
    name: "invalid PS-CMG2 metadata is rejected",
    run: () => {
      const plan = createPlan({
        elementIdentities: [
          {
            version: "business-sql-plan-element-identity:v0",
            scopeId: planId,
            kind: "filter",
            elementKey: filterKey,
            elementId: "business-sql-plan-element:bad",
          },
        ],
      } as unknown as Partial<BusinessSqlQueryPlan>);
      const result = createBusinessSqlRootPlanRevision({
        plan,
        identity: { revisionId: "revision:root", revisionSequence: 1 },
      });
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "invalid", "Expected invalid identity metadata."),
          ...expect(result.validation.reasonCodes.includes("plan_identity_invalid"), "Expected identity invalid reason."),
        ],
      };
    },
  },
  {
    name: "definition authority remains independent from revision lineage",
    run: () => {
      const plan = createPlan();
      const ledger = rootLedger(plan);
      const active = getActiveBusinessSqlPlan(ledger) || plan;
      const change: BusinessSqlPlanRevisionChangeRecord = {
        changeId: "change:definition-authority",
        changeKind: "measure.definition_authority",
        targetElementId: identityId(active, measureKey),
        targetElementKind: "measure",
        previousValue: null,
        proposedValue: authorityRecord,
        acceptedValue: authorityRecord,
        actor: provenance().actor,
        source: provenance().source,
        reason: "Accepted user-defined revenue authority.",
        clarificationId: "clarification:definition-authority",
        acceptanceId: "acceptance:definition-authority",
        definitionAuthority: authorityRecord,
      };
      const result = applyAcceptedBusinessSqlPlanRevision(ledger, acceptedRequest(ledger, [change]));
      const child = result.status === "created" ? getActiveBusinessSqlPlan(result.ledger) : null;
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(result.status === "created", "Expected authority revision."),
          ...expect(child?.measures[0].definitionAuthority?.authority === "user_defined", "Expected accepted authority."),
          ...expect(!("revisionId" in (child?.measures[0].definitionAuthority || {})), "Expected revision lineage not to replace authority."),
          ...expect(!plan.measures[0].definitionAuthority, "Expected original plan authority unchanged."),
        ],
      };
    },
  },
  {
    name: "SQL output invariance for DuckDB",
    run: () => {
      const ledger = rootLedger();
      const rootPlan = getActiveBusinessSqlPlan(ledger) || createPlan();
      const rootSql = renderSql(rootPlan, "duckdb");
      const result = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeRevisionMetadata(rootPlan)]),
      );
      const childSql = result.status === "created" ? renderSql(getActiveBusinessSqlPlan(result.ledger) || rootPlan, "duckdb") : "";
      return {
        summary: `root=${rootSql.length}; child=${childSql.length}`,
        failureReasons: [
          ...expect(result.status === "created", "Expected metadata-only revision."),
          ...expect(rootSql === renderSql(ledger.revisions[0].plan, "duckdb"), "Expected direct/root SQL invariant."),
          ...expect(rootSql === childSql, "Expected metadata-only child SQL invariant."),
          ...expect(!sqlHasRevisionLeak(childSql), "Expected no revision metadata in DuckDB SQL."),
        ],
      };
    },
  },
  {
    name: "SQL output invariance for PostgreSQL",
    run: () => {
      const ledger = rootLedger();
      const rootPlan = getActiveBusinessSqlPlan(ledger) || createPlan();
      const rootSql = renderSql(rootPlan, "postgresql");
      const result = applyAcceptedBusinessSqlPlanRevision(
        ledger,
        acceptedRequest(ledger, [changeRevisionMetadata(rootPlan)]),
      );
      const childSql = result.status === "created" ? renderSql(getActiveBusinessSqlPlan(result.ledger) || rootPlan, "postgresql") : "";
      return {
        summary: `root=${rootSql.length}; child=${childSql.length}`,
        failureReasons: [
          ...expect(result.status === "created", "Expected metadata-only revision."),
          ...expect(rootSql === childSql, "Expected metadata-only child SQL invariant."),
          ...expect(!sqlHasRevisionLeak(childSql), "Expected no revision metadata in PostgreSQL SQL."),
        ],
      };
    },
  },
  {
    name: "identity-ineligible and legacy SQL compatibility",
    run: () => {
      const legacy = createLegacyPlan();
      const root = createBusinessSqlRootPlanRevision({
        plan: legacy,
        identity: { revisionId: "revision:root", revisionSequence: 1 },
      });
      const apply = root.status === "created"
        ? applyAcceptedBusinessSqlPlanRevision(
            root.ledger,
            acceptedRequest(root.ledger, [changeRevisionMetadata(legacy)]),
          )
        : null;
      return {
        summary: `${root.validation.summary}; ${apply?.validation.summary || "not-applied"}`,
        failureReasons: [
          ...expect(root.status === "created", "Expected legacy root compatibility."),
          ...expect(apply?.status === "ineligible", "Expected legacy accepted change ineligible."),
          ...expect(renderSql(legacy, "duckdb") === renderSql(createPlan(), "duckdb"), "Expected legacy SQL compatibility."),
        ],
      };
    },
  },
  {
    name: "absence of PS-CMG4 and later state",
    run: () => {
      const { result } = applyChild();
      const serialized = canonical(result.ledger);
      return {
        summary: result.validation.summary,
        failureReasons: [
          ...expect(!serialized.includes("dependencyGraph"), "Expected no dependency graph."),
          ...expect(!serialized.includes("stale"), "Expected no stale-state propagation."),
          ...expect(!serialized.includes("materiality"), "Expected no materiality gate."),
          ...expect(!serialized.includes("ExecutedResult"), "Expected no execution result."),
          ...expect(!serialized.includes("chat"), "Expected no clarification chat state."),
        ],
      };
    },
  },
];

export function runBusinessSqlPlanRevisionLineageFixtures(): BusinessSqlPlanRevisionLineageFixtureReport {
  const results = fixtures.map((fixture): FixtureResult => {
    const result = fixture.run();
    return {
      name: fixture.name,
      ok: result.failureReasons.length === 0,
      summary: result.summary,
      failureReasons: result.failureReasons,
    };
  });

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}
