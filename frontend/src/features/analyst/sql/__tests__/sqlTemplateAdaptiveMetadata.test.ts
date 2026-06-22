import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type { ReportOpportunity } from "../reportIntelligencePlanner";
import type { SqlAnalyticalStrategy } from "../sqlAnalyticalStrategies";
import { createSqlReportRecipes, type SqlReportRecipe } from "../sqlReportRecipes";
import type {
  SqlTemplateAdaptiveMetadata,
} from "../sqlTemplateAdaptiveMetadata";
import { createSqlAssistantTemplates, type SqlAssistantTemplate } from "../sqlTemplateLibrary";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlTemplateAdaptiveMetadataFixtureReport = {
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

const metadataDataset: DatasetMetadata = {
  dataset_id: "dataset:metadata",
  filename: "metadata.csv",
  original_filename: "metadata.csv",
  table_name: "orders",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 12,
  column_count: 4,
  schema: [
    column("order_id", "numeric"),
    column("status"),
    column("region"),
    column("revenue", "numeric"),
  ],
};

const enrichedTemplateIds = [
  "count-rows",
  "count-by-category",
  "sum-by-category",
  "average-by-category",
  "missing-values",
  "filter-equals",
  "distinct-values",
  "top-n",
  "bottom-n",
];

const enrichedRecipeIds = ["category-summary", "top-performers", "data-quality"];

const syntaxHelperMetadata: SqlTemplateAdaptiveMetadata = {
  templateKind: "syntax_helper",
  outputShape: "detail_list",
  semanticRoles: [
    {
      role: "filter",
      fieldHint: "categorical column",
      required: true,
      source: "schema_detection",
    },
  ],
  relationshipMode: "single_table",
  adaptationSupport: "field_binding",
  safety: {
    canInsertExistingSql: true,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: false,
    manualInsertOnly: true,
  },
};

const businessAnswerMetadata: SqlTemplateAdaptiveMetadata = {
  templateKind: "business_answer",
  outputShape: "grouped_count",
  semanticRoles: [
    { role: "entity", fieldHint: "active table", required: true },
    { role: "grouping", fieldHint: "categorical column", required: true },
  ],
  relationshipMode: "single_table",
  adaptationSupport: "single_table_sql",
  safety: {
    canInsertExistingSql: true,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: false,
    manualInsertOnly: true,
  },
};

const relationshipBlockedMetadata: SqlTemplateAdaptiveMetadata = {
  templateKind: "report_recipe",
  outputShape: "join_template",
  semanticRoles: [
    { role: "entity", fieldHint: "related worksheets", required: true },
    { role: "identifier", fieldHint: "join key", required: true },
  ],
  relationshipMode: "requires_relationships",
  adaptationSupport: "relationship_blocked",
  safety: {
    canInsertExistingSql: false,
    canAdaptSql: false,
    requiresGrounding: true,
    requiresAcceptedRelationships: true,
    manualInsertOnly: true,
  },
};

const templateWithoutMetadata: SqlAssistantTemplate = {
  id: "count-rows",
  title: "Count rows",
  category: "Preview and counts",
  explanation: "Count all rows in the active dataset.",
  dialectLabel: "Runs in DuckDB",
  sql: "SELECT COUNT(*) AS row_count FROM uploaded_dataset;",
};

const recipeWithoutMetadata: SqlReportRecipe = {
  id: "category-summary",
  title: "Category summary report",
  businessPurpose: "Summarizes record volume by a category or segment.",
  requiredFieldRoles: ["Category or segment"],
  sqlPatterns: ["GROUP BY", "COUNT"],
  dialectSupportNote: "Uses common aggregate SQL.",
  supportSummary: "Supported by this dataset using category.",
  sql: "SELECT category, COUNT(*) AS record_count FROM uploaded_dataset GROUP BY category;",
  warnings: [],
  missingRequirements: [],
};

const opportunityWithoutMetadata: ReportOpportunity = {
  id: "status-summary:fixture",
  title: "Status summary",
  businessQuestion: "How many records sit in each status value?",
  whyItMatters: "Status summaries surface process bottlenecks.",
  domains: ["generic"],
  confidence: 0.8,
  support: "can_generate_now",
  method: "sql",
  complexity: "simple",
  needsJoins: false,
  needsAggregation: true,
  needsDateLogic: false,
  needsAnomalyDetection: false,
  requiredTables: ["orders"],
  optionalTables: [],
  requiredColumns: ["status"],
  optionalColumns: [],
  missingRequirements: [],
  sql: "SELECT status, COUNT(*) AS record_count FROM orders GROUP BY status;",
};

const strategyWithoutMetadata: SqlAnalyticalStrategy = {
  id: "grouped-count",
  title: "Count orders by customer",
  description: "Count orders for each customer.",
  outputShape: ["customer_name", "order_count"],
  strategyKind: "grouped_count",
  requiredEntities: ["orders", "customers"],
  requiredRelationships: [],
  isInsertable: false,
  confidence: "high",
};

const fixtures: Fixture[] = [
  {
    name: "metadata type accepts syntax helper metadata",
    assert: () => [
      ...(syntaxHelperMetadata.templateKind === "syntax_helper" ? [] : ["Expected syntax helper kind."]),
      ...(syntaxHelperMetadata.relationshipMode === "single_table" ? [] : ["Expected single-table relationship mode."]),
      ...(syntaxHelperMetadata.safety.manualInsertOnly ? [] : ["Expected manual insert only safety flag."]),
    ],
  },
  {
    name: "metadata type accepts business answer metadata",
    assert: () => [
      ...(businessAnswerMetadata.templateKind === "business_answer" ? [] : ["Expected business answer kind."]),
      ...(businessAnswerMetadata.outputShape === "grouped_count" ? [] : ["Expected grouped count output shape."]),
      ...(businessAnswerMetadata.semanticRoles.some((role) => role.role === "grouping")
        ? []
        : ["Expected grouping semantic role."]),
    ],
  },
  {
    name: "metadata type accepts relationship-blocked metadata",
    assert: () => [
      ...(relationshipBlockedMetadata.relationshipMode === "requires_relationships"
        ? []
        : ["Expected required relationship mode."]),
      ...(relationshipBlockedMetadata.adaptationSupport === "relationship_blocked"
        ? []
        : ["Expected relationship-blocked adaptation support."]),
      ...(relationshipBlockedMetadata.safety.requiresAcceptedRelationships
        ? []
        : ["Expected accepted relationships safety requirement."]),
    ],
  },
  {
    name: "existing models still work without adaptiveMetadata",
    assert: () => [
      ...(templateWithoutMetadata.adaptiveMetadata === undefined
        ? []
        : ["Template metadata must remain optional."]),
      ...(recipeWithoutMetadata.adaptiveMetadata === undefined
        ? []
        : ["Recipe metadata must remain optional."]),
      ...(opportunityWithoutMetadata.adaptiveMetadata === undefined
        ? []
        : ["Opportunity metadata must remain optional."]),
      ...(strategyWithoutMetadata.adaptiveMetadata === undefined
        ? []
        : ["Strategy metadata must remain optional."]),
    ],
  },
  {
    name: "metadata can be attached without changing existing fields",
    assert: () => {
      const templateWithMetadata: SqlAssistantTemplate = {
        ...templateWithoutMetadata,
        adaptiveMetadata: syntaxHelperMetadata,
      };
      const recipeWithMetadata: SqlReportRecipe = {
        ...recipeWithoutMetadata,
        adaptiveMetadata: businessAnswerMetadata,
      };
      const opportunityWithMetadata: ReportOpportunity = {
        ...opportunityWithoutMetadata,
        adaptiveMetadata: businessAnswerMetadata,
      };
      const strategyWithMetadata: SqlAnalyticalStrategy = {
        ...strategyWithoutMetadata,
        adaptiveMetadata: relationshipBlockedMetadata,
      };

      return [
        ...(templateWithMetadata.id === templateWithoutMetadata.id ? [] : ["Template id changed."]),
        ...(recipeWithMetadata.sql === recipeWithoutMetadata.sql ? [] : ["Recipe SQL changed."]),
        ...(opportunityWithMetadata.support === opportunityWithoutMetadata.support ? [] : ["Opportunity support changed."]),
        ...(strategyWithMetadata.isInsertable === strategyWithoutMetadata.isInsertable ? [] : ["Strategy insertability changed."]),
      ];
    },
  },
  {
    name: "safe static templates expose narrow adaptive metadata",
    assert: () => {
      const templates = createSqlAssistantTemplates(metadataDataset, "duckdb");
      const byId = new Map(templates.map((template) => [template.id, template]));
      const enrichedTemplates = enrichedTemplateIds.map((id) => byId.get(id));
      const unenrichedJoin = byId.get("inner-join");

      return [
        ...enrichedTemplateIds.flatMap((id, index) => {
          const template = enrichedTemplates[index];
          return template?.adaptiveMetadata
            ? []
            : [`Expected ${id} to include adaptive metadata.`];
        }),
        ...(byId.get("count-rows")?.adaptiveMetadata?.templateKind === "business_answer"
          ? []
          : ["count-rows should be a business-answer template."]),
        ...(byId.get("count-by-category")?.adaptiveMetadata?.outputShape === "grouped_count"
          ? []
          : ["count-by-category should describe grouped-count output."]),
        ...(byId.get("sum-by-category")?.adaptiveMetadata?.outputShape === "metric_by_dimension" &&
          byId.get("average-by-category")?.adaptiveMetadata?.outputShape === "metric_by_dimension"
          ? []
          : ["sum/average by category should describe metric-by-dimension output."]),
        ...(byId.get("missing-values")?.adaptiveMetadata?.templateKind === "diagnostic" &&
          byId.get("missing-values")?.adaptiveMetadata?.outputShape === "data_quality_summary"
          ? []
          : ["missing-values should be diagnostic data-quality metadata."]),
        ...(byId.get("filter-equals")?.adaptiveMetadata?.templateKind === "syntax_helper" &&
          byId.get("filter-equals")?.adaptiveMetadata?.adaptationSupport === "field_binding"
          ? []
          : ["filter-equals should be a syntax helper with field-binding metadata."]),
        ...(unenrichedJoin?.adaptiveMetadata === undefined
          ? []
          : ["Join templates should remain unenriched in T-17F."]),
        ...(enrichedTemplates.every(
          (template) =>
            template?.adaptiveMetadata?.relationshipMode === "single_table" &&
            template.adaptiveMetadata.safety.manualInsertOnly &&
            template.adaptiveMetadata.safety.canAdaptSql === false &&
            template.adaptiveMetadata.safety.requiresAcceptedRelationships === false,
        )
          ? []
          : ["Enriched templates should stay single-table, manual-insert-only, and non-adaptive."]),
      ];
    },
  },
  {
    name: "safe report recipes expose narrow adaptive metadata",
    assert: () => {
      const recipes = createSqlReportRecipes(metadataDataset, "duckdb");
      const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));

      return [
        ...enrichedRecipeIds.flatMap((id) => {
          const recipe = byId.get(id as SqlReportRecipe["id"]);
          return recipe?.adaptiveMetadata
            ? []
            : [`Expected ${id} report recipe to include adaptive metadata.`];
        }),
        ...(byId.get("category-summary")?.adaptiveMetadata?.outputShape === "metric_by_dimension"
          ? []
          : ["category-summary should describe metric-by-dimension output."]),
        ...(byId.get("top-performers")?.adaptiveMetadata?.outputShape === "ranked_summary"
          ? []
          : ["top-performers should describe ranked-summary output."]),
        ...(byId.get("data-quality")?.adaptiveMetadata?.templateKind === "report_recipe" &&
          byId.get("data-quality")?.adaptiveMetadata?.outputShape === "data_quality_summary"
          ? []
          : ["data-quality should describe report recipe data-quality metadata."]),
        ...(enrichedRecipeIds.every((id) => {
          const metadata = byId.get(id as SqlReportRecipe["id"])?.adaptiveMetadata;
          return metadata?.relationshipMode === "single_table" &&
            metadata.safety.manualInsertOnly &&
            metadata.safety.canAdaptSql === false &&
            metadata.safety.requiresAcceptedRelationships === false;
        })
          ? []
          : ["Enriched recipes should stay single-table, manual-insert-only, and non-adaptive."]),
      ];
    },
  },
  {
    name: "metadata enrichment does not change generated template order, SQL, or insertability",
    assert: () => {
      const templates = createSqlAssistantTemplates(metadataDataset, "duckdb");
      const templateIds = templates.map((template) => template.id);
      const countRows = templates.find((template) => template.id === "count-rows");
      const filterEquals = templates.find((template) => template.id === "filter-equals");
      const templateSqlWithoutMetadata = countRows?.sql;
      const recipes = createSqlReportRecipes(metadataDataset, "duckdb");
      const recipeIds = recipes.map((recipe) => recipe.id);
      const dataQuality = recipes.find((recipe) => recipe.id === "data-quality");

      return [
        ...(templateIds.slice(0, 3).join("|") === "preview-select|count-rows|filter-equals"
          ? []
          : [`Expected leading template order to stay unchanged, received ${templateIds.slice(0, 3).join("|")}.`]),
        ...(recipeIds.includes("category-summary") &&
          recipeIds.includes("top-performers") &&
          recipeIds.includes("data-quality")
          ? []
          : [`Expected enriched recipe ids in generated recipes, received ${recipeIds.join(",")}.`]),
        ...(templateSqlWithoutMetadata === `SELECT
  COUNT(*) AS row_count
FROM "orders";`
          ? []
          : ["count-rows SQL string changed."]),
        ...(filterEquals?.sql.includes("WHERE") && filterEquals.sql.includes("LIMIT 100")
          ? []
          : ["filter-equals SQL shape changed."]),
        ...(dataQuality?.sql?.includes("COUNT(*) AS record_count")
          ? []
          : ["data-quality SQL shape changed."]),
        ...(countRows?.adaptiveMetadata?.safety.canInsertExistingSql === true &&
          dataQuality?.adaptiveMetadata?.safety.canInsertExistingSql === true
          ? []
          : ["Metadata should only mark existing SQL insertable when SQL exists today."]),
      ];
    },
  },
];

export function runSqlTemplateAdaptiveMetadataFixtures(): SqlTemplateAdaptiveMetadataFixtureReport {
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

export const allSqlTemplateAdaptiveMetadataFixturesPass = (): boolean =>
  runSqlTemplateAdaptiveMetadataFixtures().failed.length === 0;
