/** PS-CMG4 - dependency-aware canonical-plan impact fixtures. */

import { attachBusinessSqlPlanElementIdentityManifest } from "../businessSqlPlanElementIdentity";
import {
  deriveBusinessSqlPlanDependencyImpact,
  type BusinessSqlPlanDependencyEdge,
  type BusinessSqlPlanDependencyGraph,
  type BusinessSqlPlanDependencyImpactResult,
} from "../businessSqlPlanDependencyImpact";
import {
  applyAcceptedBusinessSqlPlanRevision,
  createBusinessSqlRootPlanRevision,
  type BusinessSqlPlanRevisionChangeRecord,
  type BusinessSqlPlanRevisionProvenance,
  type BusinessSqlPlanRevisionRecord,
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

type FixtureResult = {
  name: string;
  ok: boolean;
  summary: string;
  failureReasons: string[];
};

export type BusinessSqlPlanDependencyImpactFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

const expect = (condition: boolean, message: string): string[] =>
  condition ? [] : [message];

const planId = "business-sql-plan:cmg4";
const measureKey = "measure:primary";
const rowLimitKey = "ranking:row-limit";
const filterKeys = [
  "filter:alpha",
  "filter:bravo",
  "filter:charlie",
  "filter:delta",
  "filter:echo",
  "filter:foxtrot",
  "filter:golf",
  "filter:hotel",
] as const;

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const canonical = (value: unknown): string => JSON.stringify(value);

const createMeasure = (): BusinessSqlMeasure => {
  const seed = {
    kind: "sum" as const,
    entity: "Orders",
    table: "orders",
    field: "revenue",
    distinct: false,
  };
  const label = "Total revenue";
  return {
    ...seed,
    planElementKey: measureKey,
    measureId: createBusinessSqlMeasureId(seed),
    fieldInferredType: "numeric",
    label,
    sqlAlias: createBusinessSqlMeasureAlias(label),
  };
};

const createFilter = (key: string, value: string): BusinessSqlFilter => {
  const filter: BusinessSqlFilter = {
    planElementKey: key,
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
    comparisonValue: { kind: "string", value },
    label: `Status ${key}`,
    evidence: "CMG4 fixture filter.",
  };
  return { ...filter, filterId: createBusinessSqlFilterId(filter) };
};

const createPlan = (): BusinessSqlQueryPlan => {
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
    filters: filterKeys.map((key, index) => createFilter(key, `value-${index}`)),
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
      title: "CMG4 dependency plan",
      metricSummary: "Total revenue",
      groupingSummary: "No grouping.",
      filterSummary: "Fixture filters.",
      joinSummary: "No joins.",
      rendererSummary: "Renderable.",
    },
  });
};

const provenance = (): BusinessSqlPlanRevisionProvenance => ({
  actor: { actorId: "user:analyst-1", actorType: "user" },
  source: { sourceId: "clarification:cmg4", sourceType: "clarification" },
  reason: "Accepted CMG4 fixture clarification.",
  clarificationId: "clarification:cmg4",
  acceptanceId: "acceptance:cmg4",
  acceptedAt: "2026-08-13T00:00:00Z",
});

const idFor = (revision: BusinessSqlPlanRevisionRecord, elementKey: string): string =>
  revision.plan.elementIdentities?.find((identity) => identity.elementKey === elementKey)?.elementId || "";

const allIds = (revision: BusinessSqlPlanRevisionRecord): string[] =>
  [...(revision.plan.elementIdentities || []).map((identity) => identity.elementId)].sort();

const changeFilter = (
  revision: BusinessSqlPlanRevisionRecord,
  elementKey: string,
  value: string,
  changeId = `change:${elementKey}`,
): BusinessSqlPlanRevisionChangeRecord => {
  const filter = revision.plan.filters.find((item) => item.planElementKey === elementKey);
  if (!filter) throw new Error(`Missing fixture filter ${elementKey}.`);
  return {
    changeId,
    changeKind: "filter.comparison_value",
    targetElementId: idFor(revision, elementKey),
    targetElementKind: "filter",
    previousValue: cloneJson(filter.comparisonValue || null),
    proposedValue: { kind: "string", value },
    acceptedValue: { kind: "string", value },
    actor: provenance().actor,
    source: provenance().source,
    reason: "Accepted filter value.",
    clarificationId: `${changeId}:clarification`,
    acceptanceId: `${changeId}:acceptance`,
  };
};

const changeMetadata = (
  revision: BusinessSqlPlanRevisionRecord,
): BusinessSqlPlanRevisionChangeRecord => ({
  changeId: "change:metadata-only",
  changeKind: "revision_metadata",
  targetElementId: idFor(revision, filterKeys[0]),
  targetElementKind: "filter",
  previousValue: "reviewed",
  proposedValue: "accepted metadata",
  acceptedValue: "accepted metadata",
  actor: provenance().actor,
  source: provenance().source,
  reason: "Accepted metadata-only clarification.",
  clarificationId: "clarification:metadata-only",
  acceptanceId: "acceptance:metadata-only",
});

const rootRevision = (): BusinessSqlPlanRevisionRecord => {
  const result = createBusinessSqlRootPlanRevision({
    plan: createPlan(),
    identity: { revisionId: "revision:root", revisionSequence: 1 },
  });
  if (result.status !== "created") throw new Error(result.validation.summary);
  return result.revision;
};

const acceptedRevision = (
  changesForRoot: (root: BusinessSqlPlanRevisionRecord) => BusinessSqlPlanRevisionChangeRecord[],
): BusinessSqlPlanRevisionRecord => {
  const root = rootRevision();
  const ledger = {
    version: "business-sql-plan-revision-ledger:v1" as const,
    activeRevisionId: root.identity.revisionId,
    revisions: [root],
  };
  const result = applyAcceptedBusinessSqlPlanRevision(ledger, {
    status: "accepted",
    parentRevisionId: root.identity.revisionId,
    identity: {
      revisionId: "revision:cmg4:accepted",
      revisionSequence: 2,
      parentRevisionId: root.identity.revisionId,
    },
    changes: changesForRoot(root),
    provenance: provenance(),
  });
  if (result.status !== "created") throw new Error(result.validation.summary);
  return result.revision;
};

const revisionChanging = (...keys: string[]): BusinessSqlPlanRevisionRecord =>
  acceptedRevision((root) =>
    keys.map((key, index) => changeFilter(root, key, `accepted-${index}`, `change:${index}:${key}`)),
  );

const metadataOnlyRevision = (): BusinessSqlPlanRevisionRecord =>
  acceptedRevision((root) => [changeMetadata(root)]);

const edge = (
  revision: BusinessSqlPlanRevisionRecord,
  edgeId: string,
  upstreamKey: string,
  downstreamKey: string,
): BusinessSqlPlanDependencyEdge => ({
  edgeId,
  upstreamElementId: idFor(revision, upstreamKey),
  downstreamElementId: idFor(revision, downstreamKey),
});

const graphFor = (
  revision: BusinessSqlPlanRevisionRecord,
  edges: readonly BusinessSqlPlanDependencyEdge[],
  overrides: Partial<BusinessSqlPlanDependencyGraph> = {},
): BusinessSqlPlanDependencyGraph => ({
  version: "business-sql-plan-dependency-graph:v1",
  graphId: "graph:cmg4",
  planId: revision.plan.id,
  revisionId: revision.identity.revisionId,
  coverage: "complete",
  edges,
  ...overrides,
});

const expectReadyImpact = (
  result: BusinessSqlPlanDependencyImpactResult,
  expected: {
    status?: "ready" | "valid_empty";
    roots: string[];
    direct: string[];
    indirect: string[];
    all: string[];
    unaffected?: string[];
  },
): string[] => {
  if (!("impact" in result)) return ["Expected impact payload."];
  return [
    ...expect(result.status === (expected.status || "ready"), `Expected ${expected.status || "ready"} status.`),
    ...expect(result.impact.rootChangedElementIds.join("|") === expected.roots.sort().join("|"), "Unexpected root ids."),
    ...expect(result.impact.directlyImpactedElementIds.join("|") === expected.direct.sort().join("|"), "Unexpected direct impact ids."),
    ...expect(result.impact.indirectlyImpactedElementIds.join("|") === expected.indirect.sort().join("|"), "Unexpected indirect impact ids."),
    ...expect(result.impact.allImpactedElementIds.join("|") === expected.all.sort().join("|"), "Unexpected all impact ids."),
    ...(expected.unaffected
      ? expect(result.impact.unaffectedElementIds.join("|") === expected.unaffected.sort().join("|"), "Unexpected unaffected ids.")
      : []),
  ];
};

const expectRejected = (
  result: BusinessSqlPlanDependencyImpactResult,
  status: BusinessSqlPlanDependencyImpactResult["status"],
  reason: string,
): string[] => [
  ...expect(result.status === status, `Expected ${status} status.`),
  ...expect(result.reasonCodes.includes(reason as never), `Expected ${reason} reason.`),
  ...expect(!("impact" in result), "Rejected result must not expose impact payload."),
];

const fixtures: Array<{
  name: string;
  run: () => { summary: string; failureReasons: string[] };
}> = [
  {
    name: "complete empty graph reports roots and empty downstream impact",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph: graphFor(revision, []) });
      const rootId = idFor(revision, filterKeys[0]);
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          status: "valid_empty",
          roots: [rootId],
          direct: [],
          indirect: [],
          all: [],
          unaffected: allIds(revision).filter((id) => id !== rootId),
        }),
      };
    },
  },
  {
    name: "missing graph is unavailable without impact payload",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph: null });
      return {
        summary: result.reasonCodes.join(","),
        failureReasons: expectRejected(result, "unavailable", "graph_missing"),
      };
    },
  },
  {
    name: "partial graph is incomplete without partial impact",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [edge(revision, "edge:a-b", filterKeys[0], filterKeys[1])], { coverage: "partial" }),
      });
      return {
        summary: result.reasonCodes.join(","),
        failureReasons: expectRejected(result, "incomplete", "graph_incomplete"),
      };
    },
  },
  {
    name: "one direct dependency",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [edge(revision, "edge:a-b", filterKeys[0], filterKeys[1])]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          roots: [idFor(revision, filterKeys[0])],
          direct: [idFor(revision, filterKeys[1])],
          indirect: [],
          all: [idFor(revision, filterKeys[1])],
        }),
      };
    },
  },
  {
    name: "one-to-many downstream impact",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const direct = [filterKeys[1], filterKeys[2]];
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-c", filterKeys[0], filterKeys[2]),
          edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
        ]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          roots: [idFor(revision, filterKeys[0])],
          direct: direct.map((key) => idFor(revision, key)),
          indirect: [],
          all: direct.map((key) => idFor(revision, key)),
        }),
      };
    },
  },
  {
    name: "many-to-one dependency deduplicates downstream output",
    run: () => {
      const revision = revisionChanging(filterKeys[0], filterKeys[1]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-c", filterKeys[0], filterKeys[2]),
          edge(revision, "edge:b-c", filterKeys[1], filterKeys[2]),
        ]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          roots: [idFor(revision, filterKeys[0]), idFor(revision, filterKeys[1])],
          direct: [idFor(revision, filterKeys[2])],
          indirect: [],
          all: [idFor(revision, filterKeys[2])],
        }),
      };
    },
  },
  {
    name: "multi-level chain separates direct and indirect impact",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
          edge(revision, "edge:b-c", filterKeys[1], filterKeys[2]),
          edge(revision, "edge:c-d", filterKeys[2], filterKeys[3]),
        ]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          roots: [idFor(revision, filterKeys[0])],
          direct: [idFor(revision, filterKeys[1])],
          indirect: [idFor(revision, filterKeys[2]), idFor(revision, filterKeys[3])],
          all: [idFor(revision, filterKeys[1]), idFor(revision, filterKeys[2]), idFor(revision, filterKeys[3])],
        }),
      };
    },
  },
  {
    name: "diamond graph deduplicates duplicate traversal paths",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
          edge(revision, "edge:a-c", filterKeys[0], filterKeys[2]),
          edge(revision, "edge:b-d", filterKeys[1], filterKeys[3]),
          edge(revision, "edge:c-d", filterKeys[2], filterKeys[3]),
        ]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          roots: [idFor(revision, filterKeys[0])],
          direct: [idFor(revision, filterKeys[1]), idFor(revision, filterKeys[2])],
          indirect: [idFor(revision, filterKeys[3])],
          all: [idFor(revision, filterKeys[1]), idFor(revision, filterKeys[2]), idFor(revision, filterKeys[3])],
        }),
      };
    },
  },
  {
    name: "direct reach wins over longer path classification",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
          edge(revision, "edge:b-c", filterKeys[1], filterKeys[2]),
          edge(revision, "edge:a-c", filterKeys[0], filterKeys[2]),
        ]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          roots: [idFor(revision, filterKeys[0])],
          direct: [idFor(revision, filterKeys[1]), idFor(revision, filterKeys[2])],
          indirect: [],
          all: [idFor(revision, filterKeys[1]), idFor(revision, filterKeys[2])],
        }),
      };
    },
  },
  {
    name: "disconnected components do not affect unrelated elements",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
          edge(revision, "edge:e-f", filterKeys[4], filterKeys[5]),
        ]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          roots: [idFor(revision, filterKeys[0])],
          direct: [idFor(revision, filterKeys[1])],
          indirect: [],
          all: [idFor(revision, filterKeys[1])],
        }),
      };
    },
  },
  {
    name: "changed element absent from every edge is valid empty",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [edge(revision, "edge:b-c", filterKeys[1], filterKeys[2])]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          status: "valid_empty",
          roots: [idFor(revision, filterKeys[0])],
          direct: [],
          indirect: [],
          all: [],
        }),
      };
    },
  },
  {
    name: "multiple accepted change roots are combined atomically",
    run: () => {
      const revision = revisionChanging(filterKeys[0], filterKeys[2]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
          edge(revision, "edge:c-d", filterKeys[2], filterKeys[3]),
          edge(revision, "edge:d-e", filterKeys[3], filterKeys[4]),
        ]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          roots: [idFor(revision, filterKeys[0]), idFor(revision, filterKeys[2])],
          direct: [idFor(revision, filterKeys[1]), idFor(revision, filterKeys[3])],
          indirect: [idFor(revision, filterKeys[4])],
          all: [idFor(revision, filterKeys[1]), idFor(revision, filterKeys[3]), idFor(revision, filterKeys[4])],
        }),
      };
    },
  },
  {
    name: "metadata-only accepted revision produces empty roots and impact",
    run: () => {
      const revision = metadataOnlyRevision();
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [edge(revision, "edge:a-b", filterKeys[0], filterKeys[1])]),
      });
      return {
        summary: result.status,
        failureReasons: expectReadyImpact(result, {
          status: "valid_empty",
          roots: [],
          direct: [],
          indirect: [],
          all: [],
          unaffected: allIds(revision),
        }),
      };
    },
  },
  {
    name: "missing upstream endpoint is invalid",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [{ edgeId: "edge:missing-upstream", upstreamElementId: "", downstreamElementId: idFor(revision, filterKeys[1]) }]),
      });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "upstream_missing") };
    },
  },
  {
    name: "missing downstream endpoint is invalid",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [{ edgeId: "edge:missing-downstream", upstreamElementId: idFor(revision, filterKeys[0]), downstreamElementId: "" }]),
      });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "downstream_missing") };
    },
  },
  {
    name: "unknown nonblank endpoints are identity-ineligible",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          {
            edgeId: "edge:unknown-endpoints",
            upstreamElementId: "business-sql-plan-element:v1:unknown-upstream",
            downstreamElementId: "business-sql-plan-element:v1:unknown-downstream",
          },
        ]),
      });
      return {
        summary: result.reasonCodes.join(","),
        failureReasons: [
          ...expectRejected(result, "invalid", "upstream_ineligible"),
          ...expect(
            (result.reasonCodes as readonly string[]).includes("downstream_ineligible"),
            "Expected downstream ineligible reason.",
          ),
        ],
      };
    },
  },
  {
    name: "nonblank unknown upstream endpoint is upstream-ineligible",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const graph = graphFor(revision, [
        {
          edgeId: "edge:unknown-upstream",
          upstreamElementId: "business-sql-plan-element:v1:unknown-upstream",
          downstreamElementId: idFor(revision, filterKeys[1]),
        },
      ]);
      const beforeRevision = canonical(revision);
      const beforeGraph = canonical(graph);
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph });
      const reasons = result.reasonCodes as readonly string[];
      return {
        summary: result.reasonCodes.join(","),
        failureReasons: [
          ...expect(result.status === "invalid", "Expected invalid status."),
          ...expect(result.reasonCodes.join(",") === "upstream_ineligible", "Expected only upstream_ineligible endpoint reason."),
          ...expect(!reasons.includes("upstream_missing"), "Expected nonblank upstream not to be treated as missing."),
          ...expect(!("impact" in result), "Invalid upstream endpoint must not expose impact payload."),
          ...expect(graph.edges[0].upstreamElementId === "business-sql-plan-element:v1:unknown-upstream", "Expected unknown upstream id to remain unrepaired."),
          ...expect(canonical(graph) === beforeGraph, "Expected graph to remain deeply unchanged."),
          ...expect(canonical(revision) === beforeRevision, "Expected accepted revision to remain deeply unchanged."),
        ],
      };
    },
  },
  {
    name: "nonblank unknown downstream endpoint is downstream-ineligible",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const graph = graphFor(revision, [
        {
          edgeId: "edge:unknown-downstream",
          upstreamElementId: idFor(revision, filterKeys[0]),
          downstreamElementId: "business-sql-plan-element:v1:unknown-downstream",
        },
      ]);
      const beforeRevision = canonical(revision);
      const beforeGraph = canonical(graph);
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph });
      const reasons = result.reasonCodes as readonly string[];
      return {
        summary: result.reasonCodes.join(","),
        failureReasons: [
          ...expect(result.status === "invalid", "Expected invalid status."),
          ...expect(result.reasonCodes.join(",") === "downstream_ineligible", "Expected only downstream_ineligible endpoint reason."),
          ...expect(!reasons.includes("downstream_missing"), "Expected nonblank downstream not to be treated as missing."),
          ...expect(!("impact" in result), "Invalid downstream endpoint must not expose impact payload."),
          ...expect(graph.edges[0].downstreamElementId === "business-sql-plan-element:v1:unknown-downstream", "Expected unknown downstream id to remain unrepaired."),
          ...expect(canonical(graph) === beforeGraph, "Expected graph to remain deeply unchanged."),
          ...expect(canonical(revision) === beforeRevision, "Expected accepted revision to remain deeply unchanged."),
        ],
      };
    },
  },
  {
    name: "duplicate canonical edge is rejected",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const first = edge(revision, "edge:a-b:1", filterKeys[0], filterKeys[1]);
      const second = { ...first, edgeId: "edge:a-b:2" };
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph: graphFor(revision, [first, second]) });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "edge_duplicate") };
    },
  },
  {
    name: "self-dependency is rejected",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [edge(revision, "edge:self", filterKeys[0], filterKeys[0])]),
      });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "self_dependency") };
    },
  },
  {
    name: "two-node cycle is rejected",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
          edge(revision, "edge:b-a", filterKeys[1], filterKeys[0]),
        ]),
      });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "cycle_detected") };
    },
  },
  {
    name: "longer cycle is rejected",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
          edge(revision, "edge:b-c", filterKeys[1], filterKeys[2]),
          edge(revision, "edge:c-a", filterKeys[2], filterKeys[0]),
        ]),
      });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "cycle_detected") };
    },
  },
  {
    name: "changed target missing from stable identities is invalid",
    run: () => {
      const revision = cloneJson(revisionChanging(filterKeys[0]));
      revision.changes[0].targetElementId = "business-sql-plan-element:v1:missing";
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph: graphFor(revision, []) });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "changed_target_missing") };
    },
  },
  {
    name: "invalid canonical identity manifest is rejected",
    run: () => {
      const revision = cloneJson(revisionChanging(filterKeys[0]));
      if (revision.plan.elementIdentities?.[0]) {
        revision.plan.elementIdentities[0].version = "business-sql-plan-element-identity:v0" as never;
      }
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph: graphFor(revision, []) });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "plan_identity_invalid") };
    },
  },
  {
    name: "identity-ineligible accepted revision is unsupported",
    run: () => {
      const revision = cloneJson(revisionChanging(filterKeys[0]));
      revision.plan.elementIdentities = undefined;
      revision.plan.measures = revision.plan.measures.map((measure) => {
        const copy = { ...measure };
        delete copy.planElementKey;
        return copy;
      });
      revision.plan.filters = revision.plan.filters.map((filter) => {
        const copy = { ...filter };
        delete copy.planElementKey;
        return copy;
      });
      if (revision.plan.rowLimit) {
        const rowLimit = { ...revision.plan.rowLimit };
        delete rowLimit.planElementKey;
        revision.plan.rowLimit = rowLimit;
      }
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph: graphFor(revision, []) });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "unsupported", "identity_ineligible") };
    },
  },
  {
    name: "revision mismatch is rejected",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [], { revisionId: "revision:other" }),
      });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "graph_revision_mismatch") };
    },
  },
  {
    name: "plan mismatch is rejected",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [], { planId: "business-sql-plan:other" }),
      });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "graph_plan_mismatch") };
    },
  },
  {
    name: "reordered edges produce identical output",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const edges = [
        edge(revision, "edge:a-c", filterKeys[0], filterKeys[2]),
        edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
        edge(revision, "edge:b-d", filterKeys[1], filterKeys[3]),
      ];
      const first = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph: graphFor(revision, edges) });
      const second = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph: graphFor(revision, [...edges].reverse()) });
      return {
        summary: `${first.status};${second.status}`,
        failureReasons: expect(canonical(first) === canonical(second), "Expected edge-order deterministic output."),
      };
    },
  },
  {
    name: "reordered change roots produce identical output",
    run: () => {
      const revision = revisionChanging(filterKeys[0], filterKeys[2]);
      const reordered = cloneJson(revision);
      reordered.changes = [...reordered.changes].reverse();
      const graph = graphFor(revision, [
        edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
        edge(revision, "edge:c-d", filterKeys[2], filterKeys[3]),
      ]);
      const first = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph });
      const second = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: reordered, graph });
      return {
        summary: `${first.status};${second.status}`,
        failureReasons: expect(canonical(first) === canonical(second), "Expected root-order deterministic output."),
      };
    },
  },
  {
    name: "deep immutability on success",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const graph = graphFor(revision, [edge(revision, "edge:a-b", filterKeys[0], filterKeys[1])]);
      const beforeRevision = canonical(revision);
      const beforeGraph = canonical(graph);
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph });
      return {
        summary: result.status,
        failureReasons: [
          ...expect(canonical(revision) === beforeRevision, "Expected accepted revision unchanged."),
          ...expect(canonical(graph) === beforeGraph, "Expected graph unchanged."),
        ],
      };
    },
  },
  {
    name: "deep immutability on rejection",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const graph = graphFor(revision, [edge(revision, "edge:self", filterKeys[0], filterKeys[0])]);
      const beforeRevision = canonical(revision);
      const beforeGraph = canonical(graph);
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph });
      return {
        summary: result.reasonCodes.join(","),
        failureReasons: [
          ...expectRejected(result, "invalid", "self_dependency"),
          ...expect(canonical(revision) === beforeRevision, "Expected rejected revision unchanged."),
          ...expect(canonical(graph) === beforeGraph, "Expected rejected graph unchanged."),
        ],
      };
    },
  },
  {
    name: "invalid input exposes no partial impact payload",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [
          edge(revision, "edge:a-b", filterKeys[0], filterKeys[1]),
          edge(revision, "edge:b-a", filterKeys[1], filterKeys[0]),
        ]),
      });
      return { summary: result.reasonCodes.join(","), failureReasons: expect(!("impact" in result), "Expected no impact payload.") };
    },
  },
  {
    name: "unsupported graph version is rejected",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [], { version: "business-sql-plan-dependency-graph:v0" as never }),
      });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "unsupported", "graph_version_unsupported") };
    },
  },
  {
    name: "blank graph and edge identities are invalid",
    run: () => {
      const revision = revisionChanging(filterKeys[0]);
      const result = deriveBusinessSqlPlanDependencyImpact({
        acceptedRevision: revision,
        graph: graphFor(revision, [edge(revision, "", filterKeys[0], filterKeys[1])], { graphId: "" }),
      });
      const reasons = result.reasonCodes as readonly string[];
      return {
        summary: result.reasonCodes.join(","),
        failureReasons: [
          ...expectRejected(result, "invalid", "edge_id_blank"),
          ...expect(reasons.includes("graph_id_blank"), "Expected graph id reason."),
        ],
      };
    },
  },
  {
    name: "root revision is not an accepted impact derivation",
    run: () => {
      const revision = rootRevision();
      const result = deriveBusinessSqlPlanDependencyImpact({ acceptedRevision: revision, graph: graphFor(revision, []) });
      return { summary: result.reasonCodes.join(","), failureReasons: expectRejected(result, "invalid", "not_accepted_revision") };
    },
  },
];

export function runBusinessSqlPlanDependencyImpactFixtures(): BusinessSqlPlanDependencyImpactFixtureReport {
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
