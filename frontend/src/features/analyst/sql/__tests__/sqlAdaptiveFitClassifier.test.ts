import type { SqlAnalyticalStrategy } from "../sqlAnalyticalStrategies";
import type { SqlBusinessQuestionShape } from "../sqlBusinessQuestionShape";
import type { SqlRelationshipReviewPair } from "../sqlRelationshipReview";
import type { SqlTemplateRecommendation } from "../sqlTemplateRecommender";
import {
  classifySqlAdaptiveFits,
  type SqlAdaptiveCandidateFit,
} from "../sqlAdaptiveFitClassifier";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlAdaptiveFitClassifierFixtureReport = {
  results: FixtureResult[];
  passed: FixtureResult[];
  failed: FixtureResult[];
};

type Fixture = {
  name: string;
  assert: () => string[];
};

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
        matchedColumns: ["order_id", "customer_id"],
        directNameMatches: ["orders"],
        score: 20,
        firstPromptIndex: 2,
      },
      {
        worksheetId: "worksheet:customers",
        label: "customers",
        tableName: "customers",
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
  isCrossEntity: options.isCrossEntity === undefined ? true : options.isCrossEntity,
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

const recommendation = (
  override: Partial<SqlTemplateRecommendation>,
): SqlTemplateRecommendation => ({
  id: "ask:duckdb:grouped-count:orders:customers",
  kind: "template",
  title: "Count orders by customer",
  description: "Count orders for each customer.",
  sql: 'SELECT customer_id, COUNT(*) AS order_count FROM "orders" GROUP BY customer_id;',
  score: 100,
  reasons: ["Matches grouped count question shape."],
  support: "supported",
  ...override,
});

const strategy = (
  override: Partial<SqlAnalyticalStrategy>,
): SqlAnalyticalStrategy => ({
  id: "coverage-percent",
  title: "customer coverage percentage by account",
  description: "Calculate coverage percentage for customers matching the requested condition.",
  outputShape: ["account_name", "customer_count", "coverage_percent"],
  strategyKind: "coverage_percent",
  requiredEntities: ["customers", "accounts"],
  requiredRelationships: [],
  isInsertable: false,
  confidence: "medium",
  ...override,
});

const relationshipReviewPair = (
  override: Partial<SqlRelationshipReviewPair>,
): SqlRelationshipReviewPair => ({
  id: "tenants:units",
  fromWorksheet: "tenants",
  fromTable: "tenants",
  toWorksheet: "units",
  toTable: "units",
  status: "missing",
  statusLabel: "Missing relationship",
  suggestedColumns: null,
  ...override,
});

const expectSafetyFlags = (fits: readonly SqlAdaptiveCandidateFit[]): string[] =>
  fits.flatMap((fit) => [
    ...(fit.safety.noBackendCall ? [] : [`${fit.candidateId} can call backend/API.`]),
    ...(fit.safety.noRunQuery ? [] : [`${fit.candidateId} can run SQL.`]),
    ...(fit.safety.noEditorMutationUntilManualInsert
      ? []
      : [`${fit.candidateId} can mutate the editor without manual insert.`]),
    ...(fit.safety.noUnconfirmedRelationshipSql
      ? []
      : [`${fit.candidateId} can expose unconfirmed relationship SQL.`]),
  ]);

const fixtures: Fixture[] = [
  {
    name: "exact fit marks safe grouped-count recommendation insertable",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [recommendation({})],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.category === "exact_fit"
          ? []
          : [`Expected exact_fit, received ${fit?.category || "none"}.`]),
        ...(fit?.insertState === "insertable_existing_sql"
          ? []
          : [`Expected insertable_existing_sql, received ${fit?.insertState || "none"}.`]),
        ...(fit?.source === "generated" ? [] : [`Expected generated source, received ${fit?.source}.`]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "blocked fit marks missing tenant unit access-code relationships",
    assert: () => {
      const tenantsShape = shape("blocked_relationship_plan", {
        prompt: "How many tenants in every unit have access codes?",
        promptTokens: ["how", "many", "tenants", "in", "every", "unit", "have", "access", "codes"],
        relationshipDependent: true,
        relationshipGaps: [
          { fromTable: "tenants", toTable: "units" },
          { fromTable: "tenants", toTable: "access_codes" },
        ],
        mentionedEntities: [
          {
            worksheetId: "worksheet:tenants",
            label: "tenants",
            tableName: "tenants",
            matchedColumns: ["tenant_id"],
            directNameMatches: ["tenants"],
            score: 20,
            firstPromptIndex: 2,
          },
          {
            worksheetId: "worksheet:units",
            label: "units",
            tableName: "units",
            matchedColumns: ["unit_id"],
            directNameMatches: ["unit"],
            score: 20,
            firstPromptIndex: 5,
          },
        ],
      });
      const fits = classifySqlAdaptiveFits({
        prompt: tenantsShape.prompt,
        questionShape: tenantsShape,
        recommendations: [recommendation({ id: "tenant-access-count", title: "Count tenants with access codes by unit" })],
        strategies: [
          strategy({
            id: "gap-detection",
            strategyKind: "blocked_relationship_plan",
            requiredEntities: ["tenants", "units", "access_codes"],
            requiredRelationships: ["tenants to units", "tenants to access_codes"],
            disabledReason: "Confirm worksheet relationships before inserting SQL.",
          }),
        ],
        relationshipReviewItems: [
          relationshipReviewPair({ fromTable: "tenants", toTable: "units" }),
          relationshipReviewPair({
            id: "tenants:access_codes",
            fromTable: "tenants",
            toTable: "access_codes",
            fromWorksheet: "tenants",
            toWorksheet: "access_codes",
          }),
        ],
      });

      return [
        ...(fits.every((fit) => fit.category === "blocked_fit")
          ? []
          : [`Expected blocked_fit for all fits, received ${fits.map((fit) => fit.category).join(", ")}.`]),
        ...(fits.every((fit) => fit.insertState === "blocked_relationships")
          ? []
          : ["Expected blocked_relationships insert state."]),
        ...(fits.some((fit) => fit.requiredRelationships.includes("tenants to access_codes"))
          ? []
          : ["Expected tenants to access_codes relationship requirement."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "status-summary candidate for grouped-count question is not exact",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [
          recommendation({
            id: "status-summary",
            title: "Status summary - orders",
            description: "Count orders by status.",
            sql: 'SELECT status, COUNT(*) AS order_count FROM "orders" GROUP BY status;',
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.category === "partial_fit" || fit?.category === "poor_fit"
          ? []
          : [`Expected partial_fit or poor_fit, received ${fit?.category || "none"}.`]),
        ...(fit?.category === "exact_fit" ? ["Status summary must not be exact for grouped customer count."] : []),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "generic SQL syntax helper is poor low-confidence fit",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [
          recommendation({
            id: "filter-equals",
            title: "Filter equals",
            description: "Simple syntax example for a WHERE filter equals predicate.",
            sql: 'SELECT * FROM "orders" WHERE status = ?;',
            score: 8,
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.category === "poor_fit"
          ? []
          : [`Expected poor_fit, received ${fit?.category || "none"}.`]),
        ...(fit?.confidence === "low"
          ? []
          : [`Expected low confidence, received ${fit?.confidence || "none"}.`]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "needs-review pattern match is adapted read-only fit",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [
          recommendation({
            id: "orders-by-customer-needs-review",
            support: "needs_review",
            warnings: ["Needs review before insertion because the customer label must be verified."],
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.category === "adapted_fit"
          ? []
          : [`Expected adapted_fit, received ${fit?.category || "none"}.`]),
        ...(fit?.insertState === "read_only"
          ? []
          : [`Expected read_only, received ${fit?.insertState || "none"}.`]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "multiple coverage and gap strategies are composed read-only solutions",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "Which accounts have missing customer coverage?",
        questionShape: shape("detail_list", {
          prompt: "Which accounts have missing customer coverage?",
          promptTokens: ["which", "accounts", "have", "missing", "customer", "coverage"],
          hasDetailIntent: true,
          hasFilterIntent: true,
          filterTerms: ["missing"],
        }),
        recommendations: [],
        strategies: [
          strategy({ id: "coverage-percent", strategyKind: "coverage_percent" }),
          strategy({
            id: "gap-detection",
            title: "accounts missing customer coverage",
            description: "Find accounts with missing or no matching customers.",
            outputShape: ["account_name", "customers_without_coverage_count"],
            strategyKind: "gap_detection",
          }),
        ],
      });

      return [
        ...(fits.length === 2 ? [] : [`Expected two strategy fits, received ${fits.length}.`]),
        ...(fits.every((fit) => fit.category === "composed_solution")
          ? []
          : [`Expected composed_solution fits, received ${fits.map((fit) => fit.category).join(", ")}.`]),
        ...(fits.every((fit) => fit.insertState === "read_only")
          ? []
          : ["Composed non-insertable strategies must remain read-only."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "missing fields populate missingFields and block insertion",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [
          recommendation({
            id: "orders-by-customer-missing-field",
            unsupportedReasons: ["Missing fields: customer_name"],
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.insertState === "blocked_missing_fields"
          ? []
          : [`Expected blocked_missing_fields, received ${fit?.insertState || "none"}.`]),
        ...(fit?.missingFields.length ? [] : ["Expected missingFields to be populated."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "classifier does not generate SQL or mutate recommendation order",
    assert: () => {
      const recommendations = [
        recommendation({ id: "first", sql: "SELECT 1;" }),
        recommendation({ id: "second", sql: "SELECT 2;" }),
      ];
      const beforeIds = recommendations.map((item) => item.id).join(",");
      const beforeSql = recommendations.map((item) => item.sql).join("|");
      const beforeSnapshot = JSON.stringify(recommendations);
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations,
        strategies: [],
      });
      const afterIds = recommendations.map((item) => item.id).join(",");
      const afterSql = recommendations.map((item) => item.sql).join("|");

      return [
        ...(fits.some((fit) => "sql" in fit) ? ["Fit metadata must not include generated SQL."] : []),
        ...(beforeIds === afterIds ? [] : ["Classifier must not reorder recommendations."]),
        ...(beforeSql === afterSql ? [] : ["Classifier must not modify recommendation SQL."]),
        ...(beforeSnapshot === JSON.stringify(recommendations)
          ? []
          : ["Classifier must not mutate recommendation objects."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
];

export function runSqlAdaptiveFitClassifierFixtures(): SqlAdaptiveFitClassifierFixtureReport {
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

export const allSqlAdaptiveFitClassifierFixturesPass = (): boolean =>
  runSqlAdaptiveFitClassifierFixtures().failed.length === 0;
