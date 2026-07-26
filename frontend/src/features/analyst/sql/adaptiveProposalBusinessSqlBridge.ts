import type { SqlDialectId } from "../../sqlIntelligence";
import type { AcceptedRelationshipContract } from "../../workbook";
import type {
  AdaptiveReportProposal,
  ProposedEntity,
  ProposedJoinNeed,
  ProposedMetric,
} from "./adaptiveReportProposal";
import {
  createBlockedBusinessSqlQueryPlan,
  createEmptyBusinessSqlQueryPlan,
  createBusinessSqlMeasureId,
  createBusinessSqlRowLimitId,
  createBusinessSqlSortId,
  createBusinessSqlMeasureAlias,
  measureToBusinessSqlMetric,
  type BusinessSqlEntityRef,
  type BusinessSqlFilter,
  type BusinessSqlGrouping,
  type BusinessSqlJoinEdge,
  type BusinessSqlJoinRequirement,
  type BusinessSqlMeasure,
  type BusinessSqlMeasureKind,
  type BusinessSqlMetric,
  type BusinessSqlRowLimit,
  type BusinessSqlSort,
  type BusinessSqlSortTarget,
  type BusinessSqlPlanWarning,
  type BusinessSqlQueryPlan,
} from "./businessSqlQueryPlan";
import { resolveBusinessSqlJoinPath } from "./businessSqlJoinPathResolver";
import {
  applyBusinessSqlRenderReadiness,
  evaluateBusinessSqlRenderReadiness,
  type BusinessSqlRenderReadinessResult,
} from "./businessSqlRenderReadiness";

export type AdaptiveProposalBusinessSqlBridgeState =
  | "no_plan"
  | "blocked_plan"
  | "draft_plan"
  | "review_required_plan"
  | "render_ready_plan";

export type AdaptiveProposalBusinessSqlBridgeIssue = {
  code:
    | "unsupported_proposal"
    | "invariant_violation"
    | "missing_prompt"
    | "missing_scope"
    | "missing_entity"
    | "missing_table"
    | "missing_metric"
    | "unsupported_metric"
    | "missing_relationship"
    | "needs_review_join"
    | "needs_review_filter"
    | "low_confidence"
    | "readiness_not_renderable";
  severity: "info" | "warning" | "blocking";
  message: string;
};

export type AdaptiveProposalBusinessSqlBridgeResult = {
  state: AdaptiveProposalBusinessSqlBridgeState;
  plan: BusinessSqlQueryPlan | null;
  issues: AdaptiveProposalBusinessSqlBridgeIssue[];
  readiness: BusinessSqlRenderReadinessResult | null;
  noSqlRendered: true;
  noInsertPerformed: true;
  noRunPerformed: true;
};

export type CreateBusinessSqlPlanFromAdaptiveProposalInput = {
  proposal: AdaptiveReportProposal;
  acceptedRelationshipContracts?: readonly AcceptedRelationshipContract[];
  readyRelationshipContracts?: readonly AcceptedRelationshipContract[];
  selectedGuidanceDialect?: SqlDialectId;
};

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const compactId = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const sameName = (left: string | null | undefined, right: string | null | undefined): boolean =>
  Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());

const issue = (
  code: AdaptiveProposalBusinessSqlBridgeIssue["code"],
  severity: AdaptiveProposalBusinessSqlBridgeIssue["severity"],
  message: string,
): AdaptiveProposalBusinessSqlBridgeIssue => ({ code, severity, message });

const result = (
  state: AdaptiveProposalBusinessSqlBridgeState,
  plan: BusinessSqlQueryPlan | null,
  issues: AdaptiveProposalBusinessSqlBridgeIssue[],
  readiness: BusinessSqlRenderReadinessResult | null = null,
): AdaptiveProposalBusinessSqlBridgeResult => ({
  state,
  plan,
  issues,
  readiness,
  noSqlRendered: true,
  noInsertPerformed: true,
  noRunPerformed: true,
});

const blockedResult = (
  reason: string,
  issues: AdaptiveProposalBusinessSqlBridgeIssue[],
): AdaptiveProposalBusinessSqlBridgeResult =>
  result("blocked_plan", createBlockedBusinessSqlQueryPlan(reason), issues);

const hasRendererInvariantViolation = (proposal: AdaptiveReportProposal): boolean =>
  proposal.sql !== null ||
  proposal.canInsertSql !== false ||
  proposal.canRunSql !== false ||
  proposal.renderer.canRender !== false;

const hasMissingScope = (proposal: AdaptiveReportProposal): boolean =>
  proposal.missingRequirements.some((requirement) => requirement.kind === "scope");

const requiredEntityTableMissing = (entities: readonly ProposedEntity[]): boolean =>
  entities.length === 0 || entities.some((entity) => !entity.tableName);

const entityForTable = (
  entities: readonly ProposedEntity[],
  tableName: string | null | undefined,
): ProposedEntity | null =>
  entities.find((entity) => sameName(entity.tableName, tableName)) || null;

const fallbackEntity = (
  entities: readonly ProposedEntity[],
  metric: ProposedMetric | null,
): ProposedEntity | null =>
  entityForTable(entities, metric?.tableName) ||
  entities.find((entity) => entity.tableName) ||
  null;

const roleForEntity = (
  entity: ProposedEntity,
  proposal: AdaptiveReportProposal,
): BusinessSqlEntityRef["role"] => {
  if (proposal.metrics.some((metric) => sameName(metric.tableName, entity.tableName))) {
    return "metric_subject";
  }
  if (proposal.groupings.some((grouping) => sameName(grouping.tableName, entity.tableName))) {
    return "grouping_subject";
  }
  if (proposal.filters.some((filter) => sameName(filter.tableName, entity.tableName))) {
    return "filter_subject";
  }
  if (
    proposal.joinNeeds.some(
      (join) => sameName(join.leftTable, entity.tableName) || sameName(join.rightTable, entity.tableName),
    )
  ) {
    return "join_subject";
  }
  return "source";
};

const mapEntities = (proposal: AdaptiveReportProposal): BusinessSqlEntityRef[] =>
  proposal.entities
    .filter((entity) => entity.tableName)
    .map((entity) => ({
      entity: entity.label,
      table: entity.tableName || undefined,
      required: entity.binding !== "scope_fallback",
      role: roleForEntity(entity, proposal),
    }));

const measureKindForMetric = (
  metric: ProposedMetric,
): BusinessSqlMeasureKind | null => {
  if (
    metric.kind === "count_rows" ||
    metric.kind === "count_entities" ||
    metric.kind === "sum" ||
    metric.kind === "average" ||
    metric.kind === "minimum" ||
    metric.kind === "maximum"
  ) {
    return metric.kind;
  }
  return null;
};

const measureLabelForMetric = (metric: ProposedMetric): string => {
  const column = metric.columnName?.trim().toLowerCase();
  const columnLabel = column?.replace(/_/g, " ");
  if (metric.kind === "sum" && column === "salary") return "Total salary expenditure";
  if (metric.kind === "average" && column === "salary") return "Average salary";
  if (metric.kind === "minimum" && column === "salary") return "Minimum salary";
  if (metric.kind === "maximum" && column === "salary") return "Maximum salary";
  if (metric.kind === "sum" && columnLabel) return `Total ${columnLabel}`;
  if (metric.kind === "average" && columnLabel) return `Average ${columnLabel}`;
  if (metric.kind === "minimum" && columnLabel) return `Minimum ${columnLabel}`;
  if (metric.kind === "maximum" && columnLabel) return `Maximum ${columnLabel}`;
  return metric.label;
};

const mapMeasures = (
  proposal: AdaptiveReportProposal,
): {
  measures: BusinessSqlMeasure[];
  byMetricId: Map<string, BusinessSqlMeasure>;
  issues: AdaptiveProposalBusinessSqlBridgeIssue[];
} => {
  const measures: BusinessSqlMeasure[] = [];
  const byMetricId = new Map<string, BusinessSqlMeasure>();
  const issues: AdaptiveProposalBusinessSqlBridgeIssue[] = [];

  for (const metric of proposal.metrics) {
    const kind = measureKindForMetric(metric);
    if (!kind) {
      issues.push(
        issue(
          "unsupported_metric",
          "blocking",
          `Metric ${metric.label} is not supported by the deterministic bridge yet.`,
        ),
      );
      continue;
    }

    const entity = fallbackEntity(proposal.entities, metric);
    const label = measureLabelForMetric(metric);
    const measureSeed = {
      kind,
      entity: entity?.label,
      table: metric.tableName || entity?.tableName || undefined,
      field: metric.columnName || undefined,
      distinct: false,
    };
    const measure: BusinessSqlMeasure = {
      ...measureSeed,
      measureId: createBusinessSqlMeasureId(measureSeed),
      fieldInferredType: metric.inferredType,
      label,
      sqlAlias: createBusinessSqlMeasureAlias(label),
    };
    measures.push(measure);
    byMetricId.set(metric.id, measure);

    if (metric.confidence !== "high") {
      issues.push(
        issue(
          "low_confidence",
          "warning",
          `Metric ${metric.label} requires review before rendering.`,
        ),
      );
    }
  }

  return { measures, byMetricId, issues };
};

const mapGroupings = (proposal: AdaptiveReportProposal): BusinessSqlGrouping[] =>
  proposal.groupings
    .filter((grouping) => grouping.tableName)
    .map((grouping) => {
      const entity = entityForTable(proposal.entities, grouping.tableName);
      return {
        entity: entity?.label || grouping.tableName || grouping.label,
        table: grouping.tableName || undefined,
        field: grouping.columnName || undefined,
        label: grouping.columnName || grouping.label,
      };
    });

const mapFilters = (
  proposal: AdaptiveReportProposal,
): {
  filters: BusinessSqlFilter[];
  issues: AdaptiveProposalBusinessSqlBridgeIssue[];
} => {
  const filters: BusinessSqlFilter[] = [];
  const issues: AdaptiveProposalBusinessSqlBridgeIssue[] = [];

  for (const filter of proposal.filters) {
    const label = filter.label;
    const text = `${label} ${filter.reason}`.toLowerCase();
    const entity = entityForTable(proposal.entities, filter.tableName);
    const kind: BusinessSqlFilter["kind"] =
      text.includes("status")
        ? "status"
        : text.includes("date") || text.includes("time")
          ? "date_relative"
          : "custom";
    filters.push({
      kind,
      entity: entity?.label,
      table: filter.tableName || undefined,
      field: filter.columnName || undefined,
      label,
    });

    if (filter.semantics === "needs_review") {
      issues.push(
        issue(
          "needs_review_filter",
          "warning",
          `Filter ${filter.label} needs review before rendering.`,
        ),
      );
    }
  }

  return { filters, issues };
};

const mapOrderBy = (
  proposal: AdaptiveReportProposal,
  measuresByMetricId: ReadonlyMap<string, BusinessSqlMeasure>,
): BusinessSqlSort[] =>
  (proposal.sorts || []).map((sort): BusinessSqlSort => {
    const targetMeasure = sort.target === "metric" ? measuresByMetricId.get(sort.targetId) : null;
    const grouping = proposal.groupings.find((candidate) => candidate.id === sort.targetId);
    const target: BusinessSqlSortTarget = targetMeasure
      ? { kind: "measure", measureId: targetMeasure.measureId, resolved: true }
      : {
          kind: "grouping",
          field: grouping?.columnName || undefined,
          table: grouping?.tableName || undefined,
          resolved: false,
        };
    return {
      sortId: createBusinessSqlSortId({ target, direction: sort.direction }),
      target,
      direction: sort.direction,
      label: sort.label,
    };
  });

const mapRowLimit = (proposal: AdaptiveReportProposal): BusinessSqlRowLimit | null => {
  if (!proposal.rowLimit) return null;
  const rowLimit = { value: proposal.rowLimit.value };
  return {
    ...rowLimit,
    rowLimitId: createBusinessSqlRowLimitId(rowLimit),
  };
};

const joinEntityLabel = (
  entities: readonly ProposedEntity[],
  tableName: string | null,
  fallback: string,
): string =>
  entityForTable(entities, tableName)?.label || fallback;

const mapJoinNeeds = (
  proposal: AdaptiveReportProposal,
): {
  joinPath: BusinessSqlQueryPlan["joinPath"];
  issues: AdaptiveProposalBusinessSqlBridgeIssue[];
} => {
  const relevant = proposal.joinNeeds.filter((join) => join.status !== "not_required");
  if (relevant.length === 0) {
    return {
      joinPath: {
        required: false,
        status: "not_required",
        entities: [],
        edges: [],
        requirements: [],
      },
      issues: [],
    };
  }

  const issues: AdaptiveProposalBusinessSqlBridgeIssue[] = [];
  const requirements: BusinessSqlJoinRequirement[] = [];
  const edges: BusinessSqlJoinEdge[] = [];

  for (const join of relevant) {
    const fromEntity = joinEntityLabel(proposal.entities, join.leftTable, join.leftEntity);
    const toEntity = joinEntityLabel(proposal.entities, join.rightTable, join.rightEntity);
    requirements.push({
      fromEntity,
      toEntity,
      required: true,
      relationship: join.contractId || join.reason,
      verified: false,
    });
    edges.push({
      fromEntity,
      fromTable: join.leftTable || undefined,
      toEntity,
      toTable: join.rightTable || undefined,
      relationship: join.contractId || join.reason,
      verified: false,
    });

    if (join.status === "missing") {
      issues.push(
        issue("missing_relationship", "blocking", `Missing required relationship: ${fromEntity} -> ${toEntity}.`),
      );
    } else if (join.status === "needs_review") {
      issues.push(
        issue("needs_review_join", "warning", `Join ${fromEntity} -> ${toEntity} needs review.`),
      );
    }
  }

  return {
    joinPath: {
      required: true,
      status: issues.some((item) => item.code === "missing_relationship") ? "missing" : "needs_review",
      entities: uniqueStrings(requirements.flatMap((item) => [item.fromEntity, item.toEntity])),
      edges,
      requirements,
    },
    issues,
  };
};

const planKindFor = (
  metric: BusinessSqlMetric | null,
  groupings: readonly BusinessSqlGrouping[],
  joinPath: BusinessSqlQueryPlan["joinPath"],
): BusinessSqlQueryPlan["kind"] => {
  if (joinPath.required) return "multi_table_count_grouping";
  if (groupings.length > 0) return "single_table_count_grouping";
  if (!metric) return "empty";
  return "count_distinct_entity";
};

const previewFor = (
  proposal: AdaptiveReportProposal,
  metric: BusinessSqlMetric | null,
  groupings: readonly BusinessSqlGrouping[],
  filters: readonly BusinessSqlFilter[],
  joinPath: BusinessSqlQueryPlan["joinPath"],
): BusinessSqlQueryPlan["preview"] => ({
  title: proposal.title,
  metricSummary: metric?.label || "No deterministic metric was selected.",
  groupingSummary:
    groupings.length > 0
      ? `Grouped by ${groupings.map((grouping) => grouping.label).join(", ")}.`
      : "No grouping selected.",
  filterSummary:
    filters.length > 0
      ? `Filters need review: ${filters.map((filter) => filter.label).join(", ")}.`
      : "No filters selected.",
  joinSummary:
    joinPath.status === "not_required"
      ? "No join path required."
      : `Requires ${joinPath.entities.join(" -> ")}.`,
  rendererSummary: "SQL has not been rendered.",
});

const mapWarnings = (
  proposal: AdaptiveReportProposal,
  issues: readonly AdaptiveProposalBusinessSqlBridgeIssue[],
): BusinessSqlPlanWarning[] => [
  ...proposal.warnings.map((warning) => ({
    id: warning.id,
    severity: warning.severity,
    message: warning.message,
  })),
  ...issues.map((item): BusinessSqlPlanWarning => ({
    id: `adaptive-bridge:${item.code}:${compactId(item.message)}`,
    severity: item.severity,
    message: item.message,
  })),
];

const baseRenderer = (
  selectedGuidanceDialect: SqlDialectId | undefined,
): BusinessSqlQueryPlan["renderer"] => ({
  targetDialect: "duckdb",
  selectedGuidanceDialect,
  status: "not_rendered",
  notes: [
    "Created from an adaptive proposal bridge.",
    "No SQL has been rendered, inserted, or run by the bridge.",
  ],
});

const classifyState = (
  plan: BusinessSqlQueryPlan,
  issues: readonly AdaptiveProposalBusinessSqlBridgeIssue[],
  readiness: BusinessSqlRenderReadinessResult,
): AdaptiveProposalBusinessSqlBridgeState => {
  if (issues.some((item) => item.severity === "blocking") || readiness.status === "blocked") {
    return "blocked_plan";
  }
  if (readiness.status === "renderable") return "render_ready_plan";
  if (issues.some((item) => item.severity === "warning") || plan.support === "needs_review") {
    return "review_required_plan";
  }
  return "draft_plan";
};

export function createBusinessSqlPlanFromAdaptiveProposal({
  proposal,
  acceptedRelationshipContracts = [],
  readyRelationshipContracts = [],
  selectedGuidanceDialect,
}: CreateBusinessSqlPlanFromAdaptiveProposalInput): AdaptiveProposalBusinessSqlBridgeResult {
  if (hasRendererInvariantViolation(proposal)) {
    return blockedResult("Adaptive proposal violates planning-only invariants.", [
      issue(
        "invariant_violation",
        "blocking",
        "Adaptive proposal must not contain SQL, render, insert, or run capability.",
      ),
    ]);
  }

  if (proposal.support === "unsupported") {
    return result("no_plan", null, [
      issue("unsupported_proposal", "blocking", "Unsupported adaptive proposal cannot become a Business SQL plan."),
    ]);
  }

  const structuralIssues: AdaptiveProposalBusinessSqlBridgeIssue[] = [];
  if (!proposal.question.trim()) {
    structuralIssues.push(issue("missing_prompt", "blocking", "Adaptive proposal is missing a prompt."));
  }
  if (hasMissingScope(proposal)) {
    structuralIssues.push(issue("missing_scope", "blocking", "Adaptive proposal is missing applied scope."));
  }
  if (proposal.entities.length === 0) {
    structuralIssues.push(issue("missing_entity", "blocking", "Adaptive proposal has no entities."));
  }
  if (requiredEntityTableMissing(proposal.entities)) {
    structuralIssues.push(issue("missing_table", "blocking", "One or more proposal entities are missing table bindings."));
  }
  if (proposal.metrics.length === 0) {
    structuralIssues.push(issue("missing_metric", "blocking", "Adaptive proposal has no metric."));
  }

  if (structuralIssues.length > 0) {
    return blockedResult("Adaptive proposal is missing required planning metadata.", structuralIssues);
  }

  const entities = mapEntities(proposal);
  const measureResult = mapMeasures(proposal);
  if (measureResult.measures.length === 0 || measureResult.issues.some((item) => item.severity === "blocking")) {
    return blockedResult("Adaptive proposal metric is not supported by the Business SQL bridge.", measureResult.issues);
  }
  const metricResult = {
    metric: measureToBusinessSqlMetric(measureResult.measures[0]),
    issues: measureResult.issues,
  };

  const groupings = mapGroupings(proposal);
  const orderBy = mapOrderBy(proposal, measureResult.byMetricId);
  const rowLimit = mapRowLimit(proposal);
  const filterResult = mapFilters(proposal);
  const joinResult = mapJoinNeeds(proposal);
  const confidenceIssues =
    proposal.support === "needs_review" || proposal.confidence !== "high"
      ? [
          issue(
            "low_confidence",
            "warning",
            "Adaptive proposal support or confidence requires review before rendering.",
          ),
        ]
      : [];
  const missingRelationshipPairs = proposal.joinNeeds
    .filter((join): join is ProposedJoinNeed & { status: "missing" } => join.status === "missing")
    .map((join) => ({
      fromEntity: joinEntityLabel(proposal.entities, join.leftTable, join.leftEntity),
      toEntity: joinEntityLabel(proposal.entities, join.rightTable, join.rightEntity),
      reason: join.reason,
    }));
  const bridgeIssues = [
    ...metricResult.issues,
    ...filterResult.issues,
    ...joinResult.issues,
    ...confidenceIssues,
  ];
  const initialPlan: BusinessSqlQueryPlan = {
    ...createEmptyBusinessSqlQueryPlan(),
    id: `business-sql-plan:adaptive:${compactId(proposal.id)}`,
    kind: planKindFor(metricResult.metric, groupings, joinResult.joinPath),
    status: bridgeIssues.some((item) => item.severity === "blocking") ? "blocked" : "resolved",
    support: bridgeIssues.some((item) => item.severity === "blocking")
      ? "blocked"
      : bridgeIssues.some((item) => item.severity === "warning")
        ? "needs_review"
        : "supported",
    prompt: proposal.question,
    entities,
    metric: metricResult.metric,
    measures: measureResult.measures,
    groupings,
    filters: filterResult.filters,
    orderBy,
    rowLimit,
    joinPath: joinResult.joinPath,
    assumptions: proposal.assumptions.map((assumption) => ({ ...assumption })),
    warnings: mapWarnings(proposal, bridgeIssues),
    renderer: baseRenderer(selectedGuidanceDialect || proposal.renderer.selectedGuidanceDialect),
    preview: previewFor(
      proposal,
      metricResult.metric,
      groupings,
      filterResult.filters,
      joinResult.joinPath,
    ),
  };

  const joinedPlan = resolveBusinessSqlJoinPath({
    plan: initialPlan,
    acceptedRelationshipContracts,
    readyRelationshipContracts,
    missingRelationships: missingRelationshipPairs,
  });
  const readyPlan = applyBusinessSqlRenderReadiness(joinedPlan);
  const readiness = evaluateBusinessSqlRenderReadiness(joinedPlan);
  const readinessIssues =
    readiness.status === "renderable"
      ? []
      : readiness.reasons.map((reasonText) =>
          issue(
            "readiness_not_renderable",
            readiness.status === "blocked" ? "blocking" : "warning",
            reasonText,
          ),
        );
  const allIssues = [...bridgeIssues, ...readinessIssues];

  return result(classifyState(readyPlan, allIssues, readiness), readyPlan, allIssues, readiness);
}
