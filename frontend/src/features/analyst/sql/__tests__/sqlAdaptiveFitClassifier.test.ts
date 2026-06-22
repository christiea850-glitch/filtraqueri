import type { SqlAnalyticalStrategy } from "../sqlAnalyticalStrategies";
import type { SqlBusinessQuestionShape } from "../sqlBusinessQuestionShape";
import type { SqlRelationshipReviewPair } from "../sqlRelationshipReview";
import type { SqlTemplateAdaptiveMetadata } from "../sqlTemplateAdaptiveMetadata";
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
  statusLabel: "Needs review",
  suggestedColumns: null,
  ...override,
});

const metadata = (
  override: Partial<SqlTemplateAdaptiveMetadata>,
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
    adaptationSupport: "none",
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
    name: "syntax helper metadata prevents exact fit for business questions",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [
          recommendation({
            id: "count-helper",
            title: "Count helper",
            description: "Count rows by a column.",
            adaptiveMetadata: metadata({
              templateKind: "syntax_helper",
              outputShape: "grouped_count",
              adaptationSupport: "field_binding",
            }),
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.category === "poor_fit"
          ? []
          : [`Expected syntax helper metadata to produce poor_fit, received ${fit?.category || "none"}.`]),
        ...(fit?.insertState === "read_only"
          ? []
          : [`Expected read_only, received ${fit?.insertState || "none"}.`]),
        ...(fit?.reasons.some((reason) => reason.includes("syntax helper"))
          ? []
          : ["Expected syntax helper metadata reason."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "business-answer grouped-count metadata supports exact fit when insertable and safe",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [
          recommendation({
            id: "metadata-grouped-count",
            title: "Orders summary",
            description: "Summarize orders.",
            reasons: ["Existing suggestion."],
            adaptiveMetadata: metadata({
              templateKind: "business_answer",
              outputShape: "grouped_count",
              relationshipMode: "single_table",
            }),
          }),
        ],
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
        ...(fit?.reasons.some((reason) => reason.includes("Adaptive metadata confirms"))
          ? []
          : ["Expected metadata confirmation reason."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "single-table metadata does not trigger relationship blocking",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count", {
          isCrossEntity: false,
          relationshipDependent: false,
          relationshipGaps: [],
        }),
        recommendations: [
          recommendation({
            id: "single-table-count",
            adaptiveMetadata: metadata({
              relationshipMode: "single_table",
              safety: {
                canInsertExistingSql: true,
                canAdaptSql: false,
                requiresGrounding: true,
                requiresAcceptedRelationships: false,
                manualInsertOnly: true,
              },
            }),
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.insertState !== "blocked_relationships"
          ? []
          : ["Single-table metadata must not trigger relationship blocking."]),
        ...(fit?.reasons.some((reason) => reason.includes("single-table"))
          ? []
          : ["Expected single-table metadata reason."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "requires-relationships metadata supports blocked fit when relationships are missing",
    assert: () => {
      const relationshipShape = shape("grouped_count", {
        relationshipDependent: true,
        relationshipGaps: [{ fromTable: "orders", toTable: "customers" }],
      });
      const fits = classifySqlAdaptiveFits({
        prompt: relationshipShape.prompt,
        questionShape: relationshipShape,
        recommendations: [
          recommendation({
            id: "relationship-template",
            adaptiveMetadata: metadata({
              relationshipMode: "requires_relationships",
              adaptationSupport: "relationship_blocked",
              safety: {
                canInsertExistingSql: false,
                canAdaptSql: false,
                requiresGrounding: true,
                requiresAcceptedRelationships: true,
                manualInsertOnly: true,
              },
            }),
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.category === "blocked_fit"
          ? []
          : [`Expected blocked_fit, received ${fit?.category || "none"}.`]),
        ...(fit?.insertState === "blocked_relationships"
          ? []
          : [`Expected blocked_relationships, received ${fit?.insertState || "none"}.`]),
        ...(fit?.requiredRelationships.includes("orders to customers")
          ? []
          : ["Expected missing relationship from question shape."]),
        ...(fit?.reasons.some((reason) => reason.includes("accepted worksheet relationships"))
          ? []
          : ["Expected relationship metadata reason."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "field-binding metadata supports adapted read-only fit without generating SQL",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [
          recommendation({
            id: "field-binding-template",
            support: "needs_review",
            adaptiveMetadata: metadata({
              templateKind: "business_answer",
              outputShape: "grouped_count",
              adaptationSupport: "field_binding",
            }),
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
        ...(fits.some((item) => "sql" in item) ? ["Classifier fit must not include generated SQL."] : []),
        ...(fit?.reasons.some((reason) => reason.includes("field binding"))
          ? []
          : ["Expected field binding metadata reason."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "canAdaptSql false is reflected in read-only classifier reasons",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [
          recommendation({
            id: "no-adapt-template",
            support: "needs_review",
            adaptiveMetadata: metadata({
              outputShape: "grouped_count",
              adaptationSupport: "field_binding",
              safety: {
                canInsertExistingSql: true,
                canAdaptSql: false,
                requiresGrounding: true,
                requiresAcceptedRelationships: false,
                manualInsertOnly: true,
              },
            }),
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.insertState === "read_only"
          ? []
          : [`Expected read_only, received ${fit?.insertState || "none"}.`]),
        ...(fit?.reasons.some((reason) => reason.includes("does not allow SQL adaptation"))
          ? []
          : ["Expected canAdaptSql false reason."]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "metadata does not override existing blocked relationship state",
    assert: () => {
      const blockedShape = shape("grouped_count", {
        relationshipDependent: true,
        relationshipGaps: [{ fromTable: "orders", toTable: "customers" }],
      });
      const fits = classifySqlAdaptiveFits({
        prompt: blockedShape.prompt,
        questionShape: blockedShape,
        recommendations: [
          recommendation({
            id: "single-table-but-question-blocked",
            adaptiveMetadata: metadata({
              relationshipMode: "single_table",
              outputShape: "grouped_count",
            }),
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.category === "blocked_fit"
          ? []
          : [`Expected blocked_fit, received ${fit?.category || "none"}.`]),
        ...(fit?.insertState === "blocked_relationships"
          ? []
          : [`Expected blocked_relationships, received ${fit?.insertState || "none"}.`]),
        ...expectSafetyFlags(fits),
      ];
    },
  },
  {
    name: "metadata does not override existing non-insertable state",
    assert: () => {
      const fits = classifySqlAdaptiveFits({
        prompt: "How many orders by customer?",
        questionShape: shape("grouped_count"),
        recommendations: [
          recommendation({
            id: "needs-review-with-insertable-metadata",
            support: "needs_review",
            adaptiveMetadata: metadata({
              outputShape: "grouped_count",
              safety: {
                canInsertExistingSql: true,
                canAdaptSql: false,
                requiresGrounding: true,
                requiresAcceptedRelationships: false,
                manualInsertOnly: true,
              },
            }),
          }),
        ],
        strategies: [],
      });
      const fit = fits[0];

      return [
        ...(fit?.insertState === "read_only"
          ? []
          : [`Expected read_only despite insertable metadata, received ${fit?.insertState || "none"}.`]),
        ...(fit?.category !== "exact_fit"
          ? []
          : ["Metadata must not turn an existing needs_review candidate into exact insertable fit."]),
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
