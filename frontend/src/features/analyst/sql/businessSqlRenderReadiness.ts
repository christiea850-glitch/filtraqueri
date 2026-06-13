import type {
  BusinessSqlMetricKind,
  BusinessSqlQueryPlan,
  BusinessSqlRendererStatus,
} from "./businessSqlQueryPlan";

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

const validMetricKinds: BusinessSqlMetricKind[] = [
  "count_rows",
  "count_entities",
  "count_distinct",
];

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
  const reasons: string[] = [];
  const warnings: string[] = [];

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

  if (!plan.metric) {
    reasons.push("Plan must include a metric.");
  } else {
    if (!validMetricKinds.includes(plan.metric.kind)) {
      reasons.push("Plan metric kind is not supported for rendering.");
    }
    if (!hasText(plan.metric.label)) {
      reasons.push("Plan metric must include a label.");
    }
    if (plan.metric.entity && !hasText(plan.metric.table)) {
      reasons.push("Plan metric entity must have a table mapping.");
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

  if (plan.renderer.targetDialect !== "duckdb") {
    reasons.push("Renderer target dialect must remain DuckDB.");
  }

  if (plan.renderer.sql) {
    reasons.push("Plan must not contain rendered SQL text before readiness.");
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
