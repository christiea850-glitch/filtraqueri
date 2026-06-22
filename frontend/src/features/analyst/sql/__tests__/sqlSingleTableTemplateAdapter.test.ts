import type { SchemaColumn } from "../../../dataset/datasetTypes";
import type { SqlBusinessQuestionShape } from "../sqlBusinessQuestionShape";
import type { SqlTemplateAdaptiveMetadata } from "../sqlTemplateAdaptiveMetadata";
import {
  adaptSingleTableTemplate,
  type SqlSingleTableAdaptationRequest,
  type SqlSingleTableAdaptationResult,
} from "../sqlSingleTableTemplateAdapter";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlSingleTableTemplateAdapterFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

const column = (
  name: string,
  inferredType: SchemaColumn["inferred_type"] = "text",
): SchemaColumn => ({
  name,
  type: inferredType === "numeric" ? "DOUBLE" : "VARCHAR",
  inferred_type: inferredType,
  null_count: 0,
  unique_count: 3,
  sample_values: [],
});

const shape = (
  preferredOutputShape: SqlBusinessQuestionShape["preferredOutputShape"],
  options: Partial<SqlBusinessQuestionShape> = {},
): SqlBusinessQuestionShape => ({
  prompt: options.prompt || "How many orders by customer?",
  promptTokens: options.promptTokens || ["how", "many", "orders", "by", "customer"],
  mentionedEntities:
    options.mentionedEntities || [
      {
        worksheetId: "worksheet:orders",
        label: "orders",
        tableName: "orders",
        matchedColumns: ["order_id"],
        directNameMatches: ["orders"],
        score: 20,
        firstPromptIndex: 2,
      },
      {
        worksheetId: "worksheet:orders",
        label: "customer",
        tableName: "orders",
        matchedColumns: ["customer_id"],
        directNameMatches: ["customer"],
        score: 20,
        firstPromptIndex: 4,
      },
    ],
  metricIntent: options.metricIntent === undefined ? "count" : options.metricIntent,
  hasCountIntent: options.hasCountIntent === undefined ? true : options.hasCountIntent,
  hasGroupingIntent: options.hasGroupingIntent === undefined ? true : options.hasGroupingIntent,
  hasStatusBreakdownIntent: options.hasStatusBreakdownIntent || false,
  filterTerms: options.filterTerms || [],
  hasFilterIntent: options.hasFilterIntent || false,
  hasDetailIntent: options.hasDetailIntent || false,
  isCrossEntity: options.isCrossEntity === undefined ? false : options.isCrossEntity,
  relationshipDependent:
    options.relationshipDependent === undefined ? false : options.relationshipDependent,
  relationshipGaps: options.relationshipGaps || [],
  preferredOutputShape,
  countedEntity:
    options.countedEntity === undefined
      ? options.mentionedEntities?.[0] || null
      : options.countedEntity,
  groupingEntity:
    options.groupingEntity === undefined
      ? options.mentionedEntities?.[1] || null
      : options.groupingEntity,
});

const metadata = (
  override: Partial<SqlTemplateAdaptiveMetadata> = {},
): SqlTemplateAdaptiveMetadata => {
  const {
    safety: safetyOverride,
    ...metadataOverride
  } = override;

  return {
    templateKind: "business_answer",
    outputShape: "grouped_count",
    semanticRoles: [
      { role: "entity", fieldHint: "active table", required: true, source: "schema_detection" },
      { role: "grouping", fieldHint: "categorical column", required: true, source: "schema_detection" },
    ],
    relationshipMode: "single_table",
    adaptationSupport: "field_binding",
    ...metadataOverride,
    safety: {
      canInsertExistingSql: safetyOverride?.canInsertExistingSql ?? true,
      canAdaptSql: safetyOverride?.canAdaptSql ?? false,
      requiresGrounding: safetyOverride?.requiresGrounding ?? true,
      requiresAcceptedRelationships: safetyOverride?.requiresAcceptedRelationships ?? false,
      manualInsertOnly: true,
    },
  };
};

const baseSchema = [
  column("order_id", "numeric"),
  column("customer_id", "categorical"),
  column("status", "categorical"),
  column("region", "categorical"),
  column("revenue", "numeric"),
  column("created_at", "date"),
];

const selectedTable = (
  schema: SchemaColumn[] = baseSchema,
): SqlSingleTableAdaptationRequest["selectedTable"] => ({
  worksheetId: "worksheet:orders",
  worksheetLabel: "Orders",
  tableName: "orders",
  schema,
});

const request = (
  overrides: Partial<SqlSingleTableAdaptationRequest>,
): SqlSingleTableAdaptationRequest => ({
  prompt: "How many orders by customer?",
  questionShape: shape("grouped_count"),
  selectedTable: selectedTable(),
  template: {
    id: "count-by-category",
    title: "Count by category",
    adaptiveMetadata: metadata({ outputShape: "grouped_count" }),
  },
  dialect: "duckdb",
  ...overrides,
});

const expectSafety = (result: SqlSingleTableAdaptationResult): string[] => [
  ...(result.safety.noBackendCall ? [] : ["Adapter can call backend/API."]),
  ...(result.safety.noRunQuery ? [] : ["Adapter can run SQL."]),
  ...(result.safety.manualInsertOnly ? [] : ["Adapter is not manual-insert-only."]),
  ...(result.safety.singleTableOnly ? [] : ["Adapter is not single-table-only."]),
  ...(result.safety.noJoins ? [] : ["Adapter allows joins."]),
  ...(result.safety.noEditorMutationUntilManualInsert
    ? []
    : ["Adapter can mutate the editor before manual insert."]),
];

const expectSingleTableSql = (
  result: SqlSingleTableAdaptationResult,
  tableName = "orders",
): string[] => {
  const sql = result.sql || "";
  return [
    ...(result.status === "ready" && sql ? [] : ["Expected ready SQL."]),
    ...(/\bjoin\b/i.test(sql) ? ["Adapted SQL must not contain JOIN."] : []),
    ...(sql.includes(`FROM "${tableName}"`) ? [] : [`Expected SQL to reference only table ${tableName}.`]),
  ];
};

const expectSchemaBackedBindings = (
  result: SqlSingleTableAdaptationResult,
  schema: readonly SchemaColumn[] = baseSchema,
): string[] => {
  const schemaNames = new Set(schema.map((item) => item.name));
  const columns = [
    result.bindings.groupingColumn,
    result.bindings.metricColumn,
    result.bindings.filterColumn,
    result.bindings.sortColumn,
  ].filter((value): value is string => Boolean(value));
  return columns.every((item) => schemaNames.has(item))
    ? []
    : [`Expected schema-backed bindings, received ${columns.join(", ")}.`];
};

const fixtures: Fixture[] = [
  {
    name: "count-by-category adapts with clear table and grouping",
    assert: () => {
      const result = adaptSingleTableTemplate(request({}));
      return [
        ...(result.status === "ready" ? [] : [`Expected ready, received ${result.status}.`]),
        ...(result.bindings.groupingColumn === "customer_id"
          ? []
          : [`Expected customer_id grouping, received ${result.bindings.groupingColumn || "none"}.`]),
        ...(result.sql?.includes('COUNT(*) AS "row_count"') ? [] : ["Expected row_count aggregate."]),
        ...(result.sql?.includes('GROUP BY "customer_id"') ? [] : ["Expected grouped SQL."]),
        ...(result.expectedOutputColumns.join("|") === "customer_id|row_count"
          ? []
          : [`Unexpected output columns ${result.expectedOutputColumns.join("|")}.`]),
        ...expectSingleTableSql(result),
        ...expectSchemaBackedBindings(result),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "count-by-category blocks when grouping is ambiguous",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        prompt: "How many orders by category?",
        questionShape: shape("grouped_count", {
          prompt: "How many orders by category?",
          promptTokens: ["how", "many", "orders", "by", "category"],
          groupingEntity: null,
          mentionedEntities: [
            {
              worksheetId: "worksheet:orders",
              label: "orders",
              tableName: "orders",
              matchedColumns: ["order_id"],
              directNameMatches: ["orders"],
              score: 20,
              firstPromptIndex: 2,
            },
          ],
        }),
        selectedTable: selectedTable([
          column("status", "categorical"),
          column("region", "categorical"),
        ]),
      }));
      return [
        ...(result.status === "blocked_missing_grouping"
          ? []
          : [`Expected blocked_missing_grouping, received ${result.status}.`]),
        ...(result.sql === null ? [] : ["Blocked result must not include SQL."]),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "sum-by-category blocks without a clear numeric metric",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        prompt: "Sum orders by region",
        questionShape: shape("metric_by_dimension", {
          prompt: "Sum orders by region",
          promptTokens: ["sum", "orders", "by", "region"],
          metricIntent: "sum",
          groupingEntity: {
            worksheetId: "worksheet:orders",
            label: "region",
            tableName: "orders",
            matchedColumns: ["region"],
            directNameMatches: ["region"],
            score: 20,
            firstPromptIndex: 3,
          },
        }),
        selectedTable: selectedTable([
          column("region", "categorical"),
          column("status", "categorical"),
        ]),
        template: {
          id: "sum-by-category",
          title: "Sum by category",
          adaptiveMetadata: metadata({ outputShape: "metric_by_dimension" }),
        },
      }));
      return [
        ...(result.status === "blocked_missing_metric"
          ? []
          : [`Expected blocked_missing_metric, received ${result.status}.`]),
        ...(result.sql === null ? [] : ["Blocked result must not include SQL."]),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "sum-by-category adapts with clear grouping and numeric metric",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        prompt: "Sum revenue by region",
        questionShape: shape("metric_by_dimension", {
          prompt: "Sum revenue by region",
          promptTokens: ["sum", "revenue", "by", "region"],
          metricIntent: "sum",
          groupingEntity: {
            worksheetId: "worksheet:orders",
            label: "region",
            tableName: "orders",
            matchedColumns: ["region"],
            directNameMatches: ["region"],
            score: 20,
            firstPromptIndex: 3,
          },
          countedEntity: {
            worksheetId: "worksheet:orders",
            label: "revenue",
            tableName: "orders",
            matchedColumns: ["revenue"],
            directNameMatches: ["revenue"],
            score: 20,
            firstPromptIndex: 1,
          },
        }),
        template: {
          id: "sum-by-category",
          title: "Sum by category",
          adaptiveMetadata: metadata({ outputShape: "metric_by_dimension" }),
        },
      }));
      return [
        ...(result.status === "ready" ? [] : [`Expected ready, received ${result.status}.`]),
        ...(result.bindings.groupingColumn === "region" ? [] : ["Expected region grouping."]),
        ...(result.bindings.metricColumn === "revenue" ? [] : ["Expected revenue metric."]),
        ...(result.sql?.includes('SUM("revenue") AS "total_value"') ? [] : ["Expected SUM total_value SQL."]),
        ...expectSingleTableSql(result),
        ...expectSchemaBackedBindings(result),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "average-by-category only uses numeric metric columns",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        prompt: "Average revenue by region",
        questionShape: shape("metric_by_dimension", {
          prompt: "Average revenue by region",
          promptTokens: ["average", "revenue", "by", "region"],
          metricIntent: "average",
          groupingEntity: {
            worksheetId: "worksheet:orders",
            label: "region",
            tableName: "orders",
            matchedColumns: ["region"],
            directNameMatches: ["region"],
            score: 20,
            firstPromptIndex: 3,
          },
          countedEntity: {
            worksheetId: "worksheet:orders",
            label: "revenue",
            tableName: "orders",
            matchedColumns: ["revenue"],
            directNameMatches: ["revenue"],
            score: 20,
            firstPromptIndex: 1,
          },
        }),
        template: {
          id: "average-by-category",
          title: "Average by category",
          adaptiveMetadata: metadata({ outputShape: "metric_by_dimension" }),
        },
      }));
      const textMetricResult = adaptSingleTableTemplate(request({
        prompt: "Average status by region",
        questionShape: shape("metric_by_dimension", {
          prompt: "Average status by region",
          promptTokens: ["average", "status", "by", "region"],
          metricIntent: "average",
          groupingEntity: {
            worksheetId: "worksheet:orders",
            label: "region",
            tableName: "orders",
            matchedColumns: ["region"],
            directNameMatches: ["region"],
            score: 20,
            firstPromptIndex: 3,
          },
          countedEntity: {
            worksheetId: "worksheet:orders",
            label: "status",
            tableName: "orders",
            matchedColumns: ["status"],
            directNameMatches: ["status"],
            score: 20,
            firstPromptIndex: 1,
          },
        }),
        selectedTable: selectedTable([
          column("status", "categorical"),
          column("region", "categorical"),
        ]),
        template: {
          id: "average-by-category",
          title: "Average by category",
          adaptiveMetadata: metadata({ outputShape: "metric_by_dimension" }),
        },
      }));
      return [
        ...(result.status === "ready" ? [] : [`Expected ready, received ${result.status}.`]),
        ...(result.sql?.includes('AVG("revenue") AS "average_value"')
          ? []
          : ["Expected AVG average_value SQL."]),
        ...(textMetricResult.status === "blocked_missing_metric"
          ? []
          : [`Expected text metric to block, received ${textMetricResult.status}.`]),
        ...expectSingleTableSql(result),
        ...expectSchemaBackedBindings(result),
        ...expectSafety(result),
        ...expectSafety(textMetricResult),
      ];
    },
  },
  {
    name: "filter-equals blocks without deterministic filter value",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        prompt: "Show orders by status",
        questionShape: shape("detail_list", {
          prompt: "Show orders by status",
          promptTokens: ["show", "orders", "by", "status"],
          hasDetailIntent: true,
          hasFilterIntent: true,
          filterTerms: ["status"],
        }),
        template: {
          id: "filter-equals",
          title: "Filter equals",
          adaptiveMetadata: metadata({
            templateKind: "syntax_helper",
            outputShape: "detail_list",
          }),
        },
      }));
      return [
        ...(result.status === "blocked_missing_filter"
          ? []
          : [`Expected blocked_missing_filter, received ${result.status}.`]),
        ...(result.sql === null ? [] : ["Blocked filter result must not include placeholder SQL."]),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "filter-equals adapts with clear literal value",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        prompt: "Show orders where status is open",
        questionShape: shape("detail_list", {
          prompt: "Show orders where status is open",
          promptTokens: ["show", "orders", "where", "status", "is", "open"],
          hasDetailIntent: true,
          hasFilterIntent: true,
          filterTerms: ["status", "open"],
        }),
        template: {
          id: "filter-equals",
          title: "Filter equals",
          adaptiveMetadata: metadata({
            templateKind: "syntax_helper",
            outputShape: "detail_list",
          }),
        },
      }));
      return [
        ...(result.status === "ready" ? [] : [`Expected ready, received ${result.status}.`]),
        ...(result.bindings.filterColumn === "status" ? [] : ["Expected status filter column."]),
        ...(result.bindings.filterValue === "open" ? [] : ["Expected open filter value."]),
        ...(result.sql?.includes('WHERE "status" = \'open\'') ? [] : ["Expected literal filter SQL."]),
        ...expectSingleTableSql(result),
        ...expectSchemaBackedBindings(result),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "top-n adapts with one clear sortable column",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        prompt: "Top orders by revenue",
        questionShape: shape("detail_list", {
          prompt: "Top orders by revenue",
          promptTokens: ["top", "orders", "by", "revenue"],
          hasDetailIntent: true,
          countedEntity: {
            worksheetId: "worksheet:orders",
            label: "revenue",
            tableName: "orders",
            matchedColumns: ["revenue"],
            directNameMatches: ["revenue"],
            score: 20,
            firstPromptIndex: 3,
          },
        }),
        template: {
          id: "top-n",
          title: "Top N by metric",
          adaptiveMetadata: metadata({ outputShape: "ranked_summary" }),
        },
      }));
      return [
        ...(result.status === "ready" ? [] : [`Expected ready, received ${result.status}.`]),
        ...(result.bindings.sortColumn === "revenue" ? [] : ["Expected revenue sort column."]),
        ...(result.sql?.includes('ORDER BY "revenue" DESC') ? [] : ["Expected DESC order."]),
        ...(result.sql?.includes("LIMIT 10;") ? [] : ["Expected LIMIT 10."]),
        ...expectSingleTableSql(result),
        ...expectSchemaBackedBindings(result),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "bottom-n adapts with one clear sortable column",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        prompt: "Bottom orders by revenue",
        questionShape: shape("detail_list", {
          prompt: "Bottom orders by revenue",
          promptTokens: ["bottom", "orders", "by", "revenue"],
          hasDetailIntent: true,
          countedEntity: {
            worksheetId: "worksheet:orders",
            label: "revenue",
            tableName: "orders",
            matchedColumns: ["revenue"],
            directNameMatches: ["revenue"],
            score: 20,
            firstPromptIndex: 3,
          },
        }),
        template: {
          id: "bottom-n",
          title: "Bottom N by metric",
          adaptiveMetadata: metadata({ outputShape: "ranked_summary" }),
        },
      }));
      return [
        ...(result.status === "ready" ? [] : [`Expected ready, received ${result.status}.`]),
        ...(result.bindings.sortColumn === "revenue" ? [] : ["Expected revenue sort column."]),
        ...(result.sql?.includes('ORDER BY "revenue" ASC') ? [] : ["Expected ASC order."]),
        ...expectSingleTableSql(result),
        ...expectSchemaBackedBindings(result),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "missing selected table returns blocked_missing_table",
    assert: () => {
      const result = adaptSingleTableTemplate(request({ selectedTable: null }));
      return [
        ...(result.status === "blocked_missing_table"
          ? []
          : [`Expected blocked_missing_table, received ${result.status}.`]),
        ...(result.sql === null ? [] : ["Missing table result must not include SQL."]),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "relationship-dependent shape returns blocked_relationship_required",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        questionShape: shape("blocked_relationship_plan", {
          relationshipDependent: true,
          relationshipGaps: [{ fromTable: "orders", toTable: "customers" }],
        }),
      }));
      return [
        ...(result.status === "blocked_relationship_required"
          ? []
          : [`Expected blocked_relationship_required, received ${result.status}.`]),
        ...(result.sql === null ? [] : ["Relationship-blocked result must not include SQL."]),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "unknown template id returns unsupported_template",
    assert: () => {
      const result = adaptSingleTableTemplate(request({
        template: {
          id: "inner-join",
          title: "INNER JOIN",
          adaptiveMetadata: metadata({
            relationshipMode: "requires_relationships",
            safety: {
              canInsertExistingSql: false,
              canAdaptSql: false,
              requiresGrounding: true,
              requiresAcceptedRelationships: true,
              manualInsertOnly: true,
            },
          }),
        },
      }));
      return [
        ...(result.status === "unsupported_template"
          ? []
          : [`Expected unsupported_template, received ${result.status}.`]),
        ...(result.sql === null ? [] : ["Unsupported result must not include SQL."]),
        ...expectSafety(result),
      ];
    },
  },
  {
    name: "adapter exposes no editor backend or run-query behavior",
    assert: () => {
      const result = adaptSingleTableTemplate(request({}));
      const keys = Object.keys(result);
      return [
        ...(keys.some((key) => /^on[A-Z]/.test(key))
          ? [`Adapter result must not expose callbacks, received keys ${keys.join(",")}.`]
          : []),
        ...expectSafety(result),
      ];
    },
  },
];

export function runSqlSingleTableTemplateAdapterFixtures(): SqlSingleTableTemplateAdapterFixtureReport {
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

export const allSqlSingleTableTemplateAdapterFixturesPass = (): boolean =>
  runSqlSingleTableTemplateAdapterFixtures().failed.length === 0;
