import type { ReportOpportunity } from "../reportIntelligencePlanner";
import type { SqlAnalyticalStrategy } from "../sqlAnalyticalStrategies";
import type { SqlReportRecipe } from "../sqlReportRecipes";
import type {
  SqlTemplateAdaptiveMetadata,
} from "../sqlTemplateAdaptiveMetadata";
import type { SqlAssistantTemplate } from "../sqlTemplateLibrary";

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
