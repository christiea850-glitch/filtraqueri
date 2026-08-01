import type { SqlDialectId } from "../../sqlIntelligence";
import type { AcceptedRelationshipContract } from "../../workbook";
import type {
  AdaptiveReportProposal,
  ProposedEntity,
  ProposedAggregateResultCondition,
  ProposedDerivedMeasure,
  ProposedFilter,
  ProposedJoinNeed,
  ProposedMetric,
} from "./adaptiveReportProposal";
import {
  createBlockedBusinessSqlQueryPlan,
  createEmptyBusinessSqlQueryPlan,
  createBusinessSqlMeasureId,
  createBusinessSqlDerivedMeasureId,
  createBusinessSqlAggregateResultConditionId,
  createBusinessSqlRowLimitId,
  createBusinessSqlSortId,
  createBusinessSqlFilterId,
  createBusinessSqlMeasureAlias,
  measureToBusinessSqlMetric,
  type BusinessSqlEntityRef,
  type BusinessSqlAggregateResultCondition,
  type BusinessSqlDerivedMeasure,
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
import { evaluateBusinessSqlFilterCompatibility } from "./businessSqlFilterCompatibility";
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
    | "unresolved_metric_reference"
    | "unresolved_derived_measure_reference"
    | "missing_relationship"
    | "needs_review_join"
    | "needs_review_filter"
    | "invalid_canonical_filter"
    | "unresolved_filter_reference"
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

const requiredEntityTableMissing = (
  proposal: AdaptiveReportProposal,
): boolean => {
  const hasGroundedAggregateThreshold =
    (proposal.aggregateResultConditions || []).length === 1 &&
    proposal.metrics.length === 1 &&
    proposal.groupings.length === 1 &&
    Boolean(proposal.metrics[0]?.tableName && proposal.groupings[0]?.tableName);
  const hasGroundedDerivedMeasure =
    (proposal.derivedMeasures || []).length === 1 &&
    proposal.metrics.length === 2 &&
    proposal.groupings.length <= 1 &&
    proposal.metrics.every((metric) => metric.tableName);
  if (hasGroundedAggregateThreshold || hasGroundedDerivedMeasure) return false;
  return proposal.entities.length === 0 || proposal.entities.some((entity) => !entity.tableName);
};

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

const isCanonicalProposedFilter = (
  filter: ProposedFilter,
): boolean => filter.semantics === "canonical" && filter.executable === true;

const hasCanonicalFieldProjection = (proposal: AdaptiveReportProposal): boolean =>
  proposal.metrics.length === 0 &&
  proposal.groupings.length > 0 &&
  proposal.filters.length === 1 &&
  isCanonicalProposedFilter(proposal.filters[0]);

const hasCanonicalRowFilter = (proposal: AdaptiveReportProposal): boolean =>
  proposal.filters.some(isCanonicalProposedFilter);

const mapEntities = (proposal: AdaptiveReportProposal): BusinessSqlEntityRef[] =>
  {
    const mapped = proposal.entities
    .filter((entity) => entity.tableName)
    .map((entity) => ({
      entity: entity.label,
      table: entity.tableName || undefined,
      required:
        entity.binding !== "scope_fallback" ||
        (proposal.aggregateResultConditions || []).length > 0 ||
        (proposal.derivedMeasures || []).length > 0 ||
        hasCanonicalRowFilter(proposal),
      role: roleForEntity(entity, proposal),
    }));
    if (
      mapped.length > 0 ||
      ((proposal.aggregateResultConditions || []).length === 0 &&
        (proposal.derivedMeasures || []).length === 0)
    ) {
      return mapped;
    }
    const fallbackTable =
      proposal.metrics.find((metric) => metric.tableName)?.tableName ||
      proposal.groupings.find((grouping) => grouping.tableName)?.tableName ||
      null;
    if (!fallbackTable) return mapped;
    return [
      {
        entity: fallbackTable,
        table: fallbackTable,
        required: true,
        role: "source",
      },
    ];
  };

const measureKindForMetric = (
  metric: ProposedMetric,
): BusinessSqlMeasureKind | null => {
  if (
    metric.kind === "count_rows" ||
    metric.kind === "count_entities" ||
    metric.kind === "count_distinct" ||
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
    if (isCanonicalProposedFilter(filter)) {
      const target = filter.target;
      if (
        target?.kind !== "field" ||
        target.resolved !== true ||
        !target.table ||
        !target.field ||
        !filter.operator
      ) {
        issues.push(
          issue(
            "unresolved_filter_reference",
            "blocking",
            `Canonical filter ${filter.id} does not contain one resolved field target.`,
          ),
        );
        continue;
      }
      const entity = entityForTable(proposal.entities, target.table);
      const seed: BusinessSqlFilter = {
        kind: "custom",
        target: {
          kind: "field",
          entity: target.entity || entity?.label || target.table,
          table: target.table,
          field: target.field,
          fieldInferredType: target.fieldInferredType,
          resolved: true,
        },
        entity: target.entity || entity?.label || target.table,
        table: target.table,
        field: target.field,
        fieldInferredType: target.fieldInferredType,
        operator: filter.operator,
        ...(filter.comparisonValue ? { comparisonValue: filter.comparisonValue } : {}),
        label: filter.label,
        evidence: filter.evidence,
      };
      const compatibility = evaluateBusinessSqlFilterCompatibility({ filter: seed });
      if (!compatibility.compatible) {
        issues.push(
          issue(
            "invalid_canonical_filter",
            "blocking",
            `Canonical filter ${filter.id} is incompatible: ${compatibility.reasonCodes.join(", ")}.`,
          ),
        );
        continue;
      }
      filters.push({
        ...seed,
        filterId: createBusinessSqlFilterId(seed),
      });
      continue;
    }

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
  derivedMeasureIdsByProposedId: ReadonlyMap<string, string>,
): {
  orderBy: BusinessSqlSort[];
  issues: AdaptiveProposalBusinessSqlBridgeIssue[];
} => {
  const orderBy: BusinessSqlSort[] = [];
  const issues: AdaptiveProposalBusinessSqlBridgeIssue[] = [];

  for (const sort of proposal.sorts || []) {
    const targetMeasure = sort.target === "metric" ? measuresByMetricId.get(sort.targetId) : null;
    const grouping = sort.target === "grouping"
      ? proposal.groupings.find((candidate) => candidate.id === sort.targetId)
      : null;
    const derivedMeasureId = sort.target === "derived_measure"
      ? derivedMeasureIdsByProposedId.get(sort.targetId)
      : null;
    if (sort.target === "derived_measure" && !derivedMeasureId) {
      issues.push(
        issue(
          "unresolved_derived_measure_reference",
          "blocking",
          `Sort ${sort.id} references an unresolved proposed derived measure.`,
        ),
      );
      continue;
    }
    const target: BusinessSqlSortTarget = targetMeasure
      ? { kind: "measure", measureId: targetMeasure.measureId, resolved: true }
      : derivedMeasureId
      ? { kind: "derived_measure", derivedMeasureId, resolved: true }
      : {
          kind: "grouping",
          field: grouping?.columnName || undefined,
          table: grouping?.tableName || undefined,
          resolved: Boolean(grouping?.columnName && grouping?.tableName),
        };
    orderBy.push({
      sortId: createBusinessSqlSortId({ target, direction: sort.direction }),
      target,
      direction: sort.direction,
      label: sort.label,
    });
  }

  return { orderBy, issues };
};

const mapRowLimit = (proposal: AdaptiveReportProposal): BusinessSqlRowLimit | null => {
  if (!proposal.rowLimit) return null;
  const rowLimit = { value: proposal.rowLimit.value };
  return {
    ...rowLimit,
    rowLimitId: createBusinessSqlRowLimitId(rowLimit),
  };
};

const mapAggregateResultConditions = (
  conditions: readonly ProposedAggregateResultCondition[],
  measuresByMetricId: ReadonlyMap<string, BusinessSqlMeasure>,
  derivedMeasureIdsByProposedId: ReadonlyMap<string, string>,
): {
  aggregateResultConditions: BusinessSqlAggregateResultCondition[];
  issues: AdaptiveProposalBusinessSqlBridgeIssue[];
} => {
  const aggregateResultConditions: BusinessSqlAggregateResultCondition[] = [];
  const issues: AdaptiveProposalBusinessSqlBridgeIssue[] = [];

  for (const condition of conditions) {
    const target = condition.target;
    if (target?.kind === "derived_measure") {
      const derivedMeasureId = derivedMeasureIdsByProposedId.get(target.derivedMeasureId);
      if (!derivedMeasureId) {
        issues.push(
          issue(
            "unresolved_derived_measure_reference",
            "blocking",
            `Aggregate-result condition ${condition.id} references an unresolved proposed derived measure.`,
          ),
        );
        continue;
      }
      const seed = {
        target: { kind: "derived_measure" as const, derivedMeasureId },
        operator: condition.operator,
        comparisonValue: condition.comparisonValue,
      };
      aggregateResultConditions.push({
        ...seed,
        conditionId: createBusinessSqlAggregateResultConditionId(seed),
        label: condition.label,
      });
      continue;
    }

    const metricId = target?.kind === "metric" ? target.metricId : condition.metricId;
    const measure = metricId ? measuresByMetricId.get(metricId) : null;
    if (!measure) {
      issues.push(
        issue(
          "unresolved_metric_reference",
          "blocking",
          `Aggregate-result condition ${condition.id} references an unresolved proposed metric.`,
        ),
      );
      continue;
    }
    const seed = {
      measureId: measure.measureId,
      operator: condition.operator,
      comparisonValue: condition.comparisonValue,
    };
    aggregateResultConditions.push({
      ...seed,
      conditionId: createBusinessSqlAggregateResultConditionId(seed),
      label: condition.label,
    });
  }

  return { aggregateResultConditions, issues };
};

const mapDerivedMeasures = (
  proposedDerivedMeasures: readonly ProposedDerivedMeasure[],
  measuresByMetricId: ReadonlyMap<string, BusinessSqlMeasure>,
): {
  derivedMeasures: BusinessSqlDerivedMeasure[];
  byProposedDerivedMeasureId: Map<string, string>;
  issues: AdaptiveProposalBusinessSqlBridgeIssue[];
} => {
  const derivedMeasures: BusinessSqlDerivedMeasure[] = [];
  const byProposedDerivedMeasureId = new Map<string, string>();
  const issues: AdaptiveProposalBusinessSqlBridgeIssue[] = [];

  for (const proposed of proposedDerivedMeasures) {
    const leftMeasure = measuresByMetricId.get(proposed.leftMetricId);
    const rightMeasure = measuresByMetricId.get(proposed.rightMetricId);

    if (!leftMeasure || !rightMeasure) {
      issues.push(
        issue(
          "unresolved_metric_reference",
          "blocking",
          `Derived measure ${proposed.id} references an unresolved proposed metric.`,
        ),
      );
      continue;
    }

    const seed = {
      operator: proposed.operator,
      leftMeasureId: leftMeasure.measureId,
      rightMeasureId: rightMeasure.measureId,
      divisionPolicy: proposed.divisionPolicy,
    };
    const derivedMeasure = {
      ...seed,
      derivedMeasureId: createBusinessSqlDerivedMeasureId(seed),
      sqlAlias: proposed.sqlAlias,
      label: proposed.label,
    };
    derivedMeasures.push(derivedMeasure);
    byProposedDerivedMeasureId.set(proposed.id, derivedMeasure.derivedMeasureId);
  }

  return { derivedMeasures, byProposedDerivedMeasureId, issues };
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
  if (requiredEntityTableMissing(proposal)) {
    structuralIssues.push(issue("missing_table", "blocking", "One or more proposal entities are missing table bindings."));
  }
  const canonicalFieldProjection = hasCanonicalFieldProjection(proposal);
  if (proposal.metrics.length === 0 && !canonicalFieldProjection) {
    structuralIssues.push(issue("missing_metric", "blocking", "Adaptive proposal has no metric."));
  }

  if (structuralIssues.length > 0) {
    return blockedResult("Adaptive proposal is missing required planning metadata.", structuralIssues);
  }

  const entities = mapEntities(proposal);
  const measureResult = mapMeasures(proposal);
  if (
    (!canonicalFieldProjection && measureResult.measures.length === 0) ||
    measureResult.issues.some((item) => item.severity === "blocking")
  ) {
    return blockedResult("Adaptive proposal metric is not supported by the Business SQL bridge.", measureResult.issues);
  }
  const metricResult = {
    metric: measureResult.measures[0] ? measureToBusinessSqlMetric(measureResult.measures[0]) : null,
    issues: measureResult.issues,
  };

  const groupings = mapGroupings(proposal);
  const derivedMeasureResult = mapDerivedMeasures(
    proposal.derivedMeasures || [],
    measureResult.byMetricId,
  );
  const orderByResult = mapOrderBy(
    proposal,
    measureResult.byMetricId,
    derivedMeasureResult.byProposedDerivedMeasureId,
  );
  const rowLimit = mapRowLimit(proposal);
  const aggregateConditionResult = mapAggregateResultConditions(
    proposal.aggregateResultConditions || [],
    measureResult.byMetricId,
    derivedMeasureResult.byProposedDerivedMeasureId,
  );
  const filterResult = mapFilters(proposal);
  const joinResult = mapJoinNeeds(proposal);
  const hasGroundedAggregateThreshold =
    aggregateConditionResult.aggregateResultConditions.length === 1 &&
    aggregateConditionResult.issues.length === 0;
  const hasGroundedDerivedMeasure =
    derivedMeasureResult.derivedMeasures.length === 1 &&
    derivedMeasureResult.issues.length === 0;
  const confidenceIssues =
    proposal.support === "needs_review" ||
    (proposal.confidence !== "high" &&
      !hasGroundedAggregateThreshold &&
      !hasGroundedDerivedMeasure &&
      !hasCanonicalRowFilter(proposal))
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
    ...aggregateConditionResult.issues,
    ...derivedMeasureResult.issues,
    ...orderByResult.issues,
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
    derivedMeasures: derivedMeasureResult.derivedMeasures,
    groupings,
    filters: filterResult.filters,
    orderBy: orderByResult.orderBy,
    rowLimit,
    aggregateResultConditions: aggregateConditionResult.aggregateResultConditions,
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
