import type {
  BusinessSqlQueryPlan,
  BusinessSqlRendererStatus,
} from "./businessSqlQueryPlan";
import { normalizeMetricAndMeasures } from "./businessSqlQueryPlan";
import { evaluateBusinessSqlMeasureCompatibility } from "./businessSqlMeasureCompatibility";
import { evaluateBusinessSqlRendererCapability } from "./businessSqlRendererCapability";
import { evaluateBusinessSqlAggregateResultConditionCompatibility } from "./businessSqlAggregateResultConditionCompatibility";
import { evaluateBusinessSqlDerivedMeasureCompatibility } from "./businessSqlDerivedMeasureCompatibility";
import { evaluateBusinessSqlFilterGroupContract } from "./businessSqlFilterGroupContract";

export type BusinessSqlRenderReadinessStatus =
  | "renderable"
  | "needs_review"
  | "blocked";

export type BusinessSqlRenderReadinessResult = {
  status: BusinessSqlRenderReadinessStatus;
  rendererStatus: Extract<
    BusinessSqlRendererStatus,
    "renderable" | "not_rendered" | "blocked"
  >;
  reasons: string[];
  warnings: string[];
  planId: string;
};

const groupingKinds = new Set<BusinessSqlQueryPlan["kind"]>([
  "single_table_count_grouping",
  "multi_table_count_grouping",
]);

const hasText = (value: string | undefined): boolean =>
  Boolean(value && value.trim().length > 0);

const uniqueStrings = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

const readySummary = (status: BusinessSqlRenderReadinessStatus): string => {
  if (status === "renderable") return "Plan is ready for SQL rendering.";
  if (status === "blocked") return "SQL rendering is blocked.";
  return "Plan needs review before SQL rendering.";
};

export function evaluateBusinessSqlRenderReadiness(
  plan: BusinessSqlQueryPlan,
): BusinessSqlRenderReadinessResult {
  const normalizedPlan = normalizeMetricAndMeasures(plan);
  const rendererCapability = evaluateBusinessSqlRendererCapability(plan);
  const reasons: string[] = [];
  const warnings: string[] = [];
  const fieldProjectionOnly =
    (normalizedPlan.filters || []).length >= 1 &&
    normalizedPlan.measures.length === 0 &&
    normalizedPlan.derivedMeasures.length === 0 &&
    normalizedPlan.aggregateResultConditions.length === 0 &&
    normalizedPlan.orderBy.length === 0 &&
    normalizedPlan.groupings.length > 0;

  if (plan.support === "blocked") {
    reasons.push("Plan support is blocked.");
  } else if (plan.support !== "supported") {
    reasons.push("Plan support must be supported before rendering.");
  }

  if (plan.status === "blocked") {
    reasons.push("Plan status is blocked.");
  } else if (plan.status !== "resolved") {
    reasons.push("Plan status must be resolved before rendering.");
  }

  if (plan.kind === "blocked") reasons.push("Blocked plan kind cannot be rendered.");
  if (plan.joinPath.status === "missing") {
    reasons.push("Required relationship metadata is missing.");
  }
  if (plan.warnings.some((warning) => warning.severity === "blocking")) {
    reasons.push("Plan has blocking warnings.");
  }

  if (!fieldProjectionOnly && normalizedPlan.measures.length === 0) {
    reasons.push("Plan must include a metric.");
  } else {
    for (const measure of normalizedPlan.measures) {
      const compatibility = evaluateBusinessSqlMeasureCompatibility({ measure });
      if (!compatibility.compatible) {
        reasons.push(`Measure ${measure.label || measure.kind} is incompatible with its field type.`);
      }
      if (!hasText(measure.label)) {
        reasons.push("Plan measure must include a label.");
      }
      if (!hasText(measure.sqlAlias)) {
        reasons.push("Plan measure must include a SQL alias.");
      }
      if (measure.entity && !hasText(measure.table)) {
        reasons.push("Plan measure entity must have a table mapping.");
      }
      if (
        measure.kind !== "count_rows" &&
        measure.kind !== "count_entities" &&
        !hasText(measure.field)
      ) {
        reasons.push(`Measure ${measure.label || measure.kind} must include a field.`);
      }
    }
  }

  const requiredEntities = plan.entities.filter((entity) => entity.required);
  if (requiredEntities.length === 0) {
    reasons.push("Plan must include required entities.");
  }

  for (const entity of requiredEntities) {
    if (!hasText(entity.entity)) {
      reasons.push("Required entity references must include an entity name.");
    }
    if (!hasText(entity.table)) {
      reasons.push(`Required entity ${entity.entity || "(unknown)"} must have a table mapping.`);
    }
  }

  if (groupingKinds.has(plan.kind)) {
    if (plan.groupings.length === 0) {
      reasons.push("Grouped plan must include at least one grouping.");
    }
    for (const grouping of plan.groupings) {
      if (!hasText(grouping.entity)) {
        reasons.push("Grouping must include an entity.");
      }
      if (!hasText(grouping.label)) {
        reasons.push("Grouping must include a label.");
      }
      if (!hasText(grouping.table)) {
        reasons.push(`Grouping ${grouping.label || "(unknown)"} must have a table mapping.`);
      }
    }
  }

  if (plan.joinPath.required) {
    if (plan.joinPath.status !== "resolved") {
      reasons.push("Required join path must be resolved before rendering.");
    }
    if (plan.joinPath.requirements.length === 0) {
      reasons.push("Required join path must include join requirements.");
    }
    for (const requirement of plan.joinPath.requirements) {
      if (requirement.required && !requirement.verified) {
        reasons.push(
          `Required join ${requirement.fromEntity} -> ${requirement.toEntity} must be verified.`,
        );
      }
    }
    for (const edge of plan.joinPath.edges) {
      if (!edge.verified) {
        reasons.push(`Join edge ${edge.fromEntity} -> ${edge.toEntity} must be verified.`);
      }
      if (!hasText(edge.fromTable) || !hasText(edge.toTable)) {
        reasons.push(`Join edge ${edge.fromEntity} -> ${edge.toEntity} must include table mappings.`);
      }
      if (!hasText(edge.fromField) || !hasText(edge.toField)) {
        reasons.push(`Join edge ${edge.fromEntity} -> ${edge.toEntity} must include join fields.`);
      }
    }
  }

  for (const sort of plan.orderBy || []) {
    if (sort.target.resolved === false) {
      reasons.push(`Sort ${sort.label || sort.sortId} target must be resolved before rendering.`);
    }
    if (sort.target.kind === "measure") {
      const measureId = sort.target.measureId;
      if (!normalizedPlan.measures.some((measure) => measure.measureId === measureId)) {
        reasons.push(`Sort ${sort.label || sort.sortId} must reference a planned measure.`);
      }
    } else if (sort.target.kind === "derived_measure") {
      const derivedMeasureId = sort.target.derivedMeasureId;
      const matchingDerivedMeasures = normalizedPlan.derivedMeasures.filter(
        (derivedMeasure) => derivedMeasure.derivedMeasureId === derivedMeasureId,
      );
      if (!derivedMeasureId || matchingDerivedMeasures.length === 0) {
        reasons.push(`Sort ${sort.label || sort.sortId} must reference a planned derived measure.`);
      } else if (matchingDerivedMeasures.length > 1) {
        reasons.push(`Sort ${sort.label || sort.sortId} references an ambiguous derived measure.`);
      }
    } else if (!hasText(sort.target.field)) {
      reasons.push(`Sort ${sort.label || sort.sortId} must include a field.`);
    }
  }

  if (plan.rowLimit) {
    if (!Number.isInteger(plan.rowLimit.value) || plan.rowLimit.value < 1 || plan.rowLimit.value > 10000) {
      reasons.push("Row limit must be a positive integer no greater than 10000.");
    }
  }

  const filterReasonCodes = evaluateBusinessSqlFilterGroupContract(normalizedPlan).reasonCodes;

  if (filterReasonCodes.length > 0) {
    reasons.push(
      ...filterReasonCodes.map((reason) => `Row-level filter is invalid: ${reason}.`),
    );
  }

  const aggregateConditionReasonCodes = (normalizedPlan.aggregateResultConditions || []).flatMap(
    (condition) =>
      evaluateBusinessSqlAggregateResultConditionCompatibility({
        condition,
        measures: normalizedPlan.measures,
        derivedMeasures: normalizedPlan.derivedMeasures,
      }).reasonCodes,
  );

  if (aggregateConditionReasonCodes.length > 0) {
    reasons.push(
      ...aggregateConditionReasonCodes.map(
        (reason) => `Aggregate-result condition is invalid: ${reason}.`,
      ),
    );
  }

  const derivedMeasureReasonCodes = (normalizedPlan.derivedMeasures || []).flatMap(
    (derivedMeasure) =>
      evaluateBusinessSqlDerivedMeasureCompatibility({
        derivedMeasure,
        measures: normalizedPlan.measures,
        derivedMeasures: normalizedPlan.derivedMeasures,
      }).reasonCodes,
  );

  if (derivedMeasureReasonCodes.length > 0) {
    reasons.push(
      ...derivedMeasureReasonCodes.map(
        (reason) => `Derived measure is invalid: ${reason}.`,
      ),
    );
  }

  if (plan.renderer.targetDialect !== "duckdb") {
    reasons.push("Renderer target dialect must remain DuckDB.");
  }

  if (plan.renderer.sql) {
    reasons.push("Plan must not contain rendered SQL text before readiness.");
  }

  if (!rendererCapability.capable) {
    reasons.push(
      ...rendererCapability.reasonCodes.map((reason) => `Renderer capability is incapable: ${reason}.`),
    );
  }

  if (plan.renderer.status === "rendered") {
    warnings.push("Plan was already marked rendered before readiness evaluation.");
  }

  const uniqueReasons = uniqueStrings(reasons);
  const uniqueWarnings = uniqueStrings(warnings);
  const blocked =
    plan.support === "blocked" ||
    plan.status === "blocked" ||
    plan.kind === "blocked" ||
    derivedMeasureReasonCodes.length > 0 ||
    filterReasonCodes.length > 0 ||
    plan.joinPath.status === "missing" ||
    plan.renderer.status === "blocked" ||
    plan.warnings.some((warning) => warning.severity === "blocking");
  const status: BusinessSqlRenderReadinessStatus =
    uniqueReasons.length === 0 ? "renderable" : blocked ? "blocked" : "needs_review";

  return {
    status,
    rendererStatus:
      status === "renderable"
        ? "renderable"
        : status === "blocked"
          ? "blocked"
          : "not_rendered",
    reasons: uniqueReasons,
    warnings: uniqueWarnings,
    planId: plan.id,
  };
}

export function applyBusinessSqlRenderReadiness(
  plan: BusinessSqlQueryPlan,
): BusinessSqlQueryPlan {
  const readiness = evaluateBusinessSqlRenderReadiness(plan);

  return {
    ...plan,
    renderer: {
      ...plan.renderer,
      status: readiness.rendererStatus,
    },
    preview: {
      ...plan.preview,
      rendererSummary: readySummary(readiness.status),
    },
  };
}
