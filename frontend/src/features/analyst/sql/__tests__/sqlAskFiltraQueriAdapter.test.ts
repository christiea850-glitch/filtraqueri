/**
 * T-14C - Ask FiltraQueri interaction and preview visibility fixtures.
 *
 * Pure fixture runner only. No Run Query, Monaco/editor mutation, backend/API,
 * execution, source resolution, worksheet scope, Business SQL contract, adaptive
 * proposal, provider, or preview handoff behavior.
 */

import type { BusinessSqlRenderPreview } from "../businessSqlRenderPreview";
import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type {
  AcceptedRelationshipContract,
  WorkbookMetadata,
  WorksheetMetadata,
  WorksheetRelationshipCandidate,
} from "../../../workbook";
import {
  ASK_FILTRAQUERI_BUTTON_LABEL,
  ADVANCED_PLANNING_DETAILS_COPY,
  ADVANCED_PLANNING_DETAILS_LABEL,
  BUSINESS_SQL_PREVIEW_IDLE_COPY,
  BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_HELPER,
  BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_TITLE,
  ASK_RECOMMENDATION_ALREADY_INSERTED_COPY,
  ASK_RELATIONSHIP_BLOCK_COMPACT_COPY,
  ASK_RELATIONSHIP_BLOCK_COMPACT_TITLE,
  createBusinessSqlPreviewVisibilityModel,
  createSqlAskAdaptiveFitSummaries,
  createSqlAskRecommendedAnalysisModel,
  createSqlAskRecommendationInsertModel,
  createSqlAskFiltraQueriModel,
  createSqlAskFiltraQueriSuggestionModel,
  shouldSubmitSqlAskFiltraQueriKey,
} from "../sqlAskFiltraQueriAdapter";
import { classifySqlBusinessQuestion } from "../sqlBusinessQuestionShape";
import { recommendAnalyticalStrategies, sqlAnalyticalStrategyStatusLabel } from "../sqlAnalyticalStrategies";
import {
  RELATIONSHIP_REVIEW_ACTION_LABEL,
  RELATIONSHIP_REVIEW_PANEL_DESCRIPTION,
  RELATIONSHIP_REVIEW_PANEL_TITLE,
  createSqlRelationshipReviewModel,
} from "../sqlRelationshipReview";

type FixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type SqlAskFiltraQueriAdapterFixtureReport = {
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
  inferred_type: SchemaColumn["inferred_type"] = "text",
): SchemaColumn => ({
  name,
  type: inferred_type === "numeric" ? "number" : "string",
  inferred_type,
  null_count: 0,
  unique_count: inferred_type === "categorical" ? 3 : 10,
  sample_values: [],
});

const worksheet = (
  worksheetId: string,
  displayName: string,
  tableName: string,
  schema: SchemaColumn[],
): WorksheetMetadata => ({
  worksheetId,
  workbookId: "workbook:ask-fixture",
  sheetName: displayName,
  displayName,
  tableName,
  originalIndex: 0,
  status: "ready",
  schema,
  rowCount: 25,
  columnCount: schema.length,
  visibleColumns: schema.map((item) => item.name),
  hiddenColumns: [],
  normalization: {
    version: 1,
    normalizedAt: "2026-01-01T00:00:00.000Z",
    headerRowIndex: null,
    skippedLeadingRows: null,
    headerDetectionStrategy: null,
    headerDetectionConfidence: null,
    headerDetectionWarning: null,
    originalFirstRowPreview: null,
    selectedHeaderRowPreview: null,
    structuralColumnCandidates: [],
    structuralColumnDetectionWarning: null,
    structuralColumnDetectionConfidence: null,
    structuralColumnSampleSize: null,
    recommendedHiddenColumns: [],
    duplicateColumnCount: 0,
    emptyColumnCount: 0,
    warnings: [],
    templateStructureCandidate: false,
    templateStructureConfidence: "low",
    templateStructureEvidence: [],
  },
});

const leasesWorksheet = worksheet("worksheet:leases", "leases", "leases", [
  column("lease_id"),
  column("status", "categorical"),
  column("monthly_rent", "numeric"),
]);

const managersWorksheet = worksheet("worksheet:managers", "managers", "managers", [
  column("manager_id"),
  column("manager_name", "categorical"),
  column("email"),
  column("phone"),
]);
const ordersWorksheet = worksheet("worksheet:orders", "orders", "orders", [
  column("order_id"),
  column("customer_id"),
  column("status", "categorical"),
  column("revenue", "numeric"),
]);
const customersWorksheet = worksheet("worksheet:customers", "customers", "customers", [
  column("customer_id"),
  column("customer_name", "categorical"),
]);
const productsWorksheet = worksheet("worksheet:products", "products", "products", [
  column("product_id"),
  column("product_category", "categorical"),
  column("revenue", "numeric"),
]);
const tenantsWorksheet = worksheet("worksheet:tenants", "tenants", "tenants", [
  column("tenant_id"),
  column("unit_id"),
  column("access_code"),
]);
const unitsWorksheet = worksheet("worksheet:units", "units", "units", [
  column("unit_id"),
  column("unit_number", "categorical"),
]);



const workbook = (): WorkbookMetadata => ({
  workbookId: "workbook:ask-fixture",
  workspaceId: null,
  name: "Property Management Company.xlsx",
  status: "ready",
  sourceFile: {
    originalFilename: "Property Management Company.xlsx",
    storedPath: null,
    mimeType: null,
    byteSize: null,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  },
  worksheetIds: [leasesWorksheet.worksheetId, managersWorksheet.worksheetId],
  activeWorksheetId: leasesWorksheet.worksheetId,
  activeAnalysisSource: {
    type: "original",
    worksheetId: leasesWorksheet.worksheetId,
    tableName: leasesWorksheet.tableName,
    originalTableName: leasesWorksheet.tableName,
    activatedAt: "2026-01-01T00:00:00.000Z",
  },
  cleanedWorkingCopies: [],
  worksheets: [leasesWorksheet, managersWorksheet],
  tableMappings: [],
  relationshipCandidates: [],
  acceptedRelationshipContracts: [],
  ingestionProfile: {
    maxWorksheets: 50,
    maxRowsPerWorksheetProfile: 1000,
    maxColumnsPerWorksheet: 200,
    maxRelationshipSampleRows: 1000,
    maxPreviewRows: 100,
    profilingStrategy: "metadata-only",
  },
  normalization: {
    version: 1,
    normalizedAt: "2026-01-01T00:00:00.000Z",
    status: "normalized",
    warnings: [],
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const dataset = (): DatasetMetadata => ({
  dataset_id: "dataset:ask-fixture",
  filename: "Property Management Company.xlsx",
  original_filename: "Property Management Company.xlsx",
  table_name: leasesWorksheet.tableName,
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: leasesWorksheet.rowCount,
  column_count: leasesWorksheet.columnCount,
  schema: leasesWorksheet.schema,
  workbook_metadata: workbook(),
});

const relationshipContract = (
  source: WorksheetMetadata,
  sourceColumnName: string,
  target: WorksheetMetadata,
  targetColumnName: string,
): AcceptedRelationshipContract => ({
  contractId: `contract:${source.tableName}:${target.tableName}`,
  sourceWorksheetId: source.worksheetId,
  sourceTableName: source.tableName,
  sourceColumnName,
  targetWorksheetId: target.worksheetId,
  targetTableName: target.tableName,
  targetColumnName,
  relationshipType: "one_to_many_candidate",
  confidence: 0.98,
  acceptedFromCandidateId: `candidate:${source.tableName}:${target.tableName}`,
  acceptedAt: "2026-01-01T00:00:00.000Z",
  acceptedBy: null,
  status: "active",
  validationState: "valid",
  validationSummary: ["Fixture relationship."],
  overlapRatio: 1,
  sourceUniqueRatio: 1,
  targetUniqueRatio: 0.2,
  inferredTypeCompatible: true,
  lastValidatedAt: "2026-01-01T00:00:00.000Z",
});

const relationshipCandidate = (
  source: WorksheetMetadata,
  sourceColumn: string,
  target: WorksheetMetadata,
  targetColumn: string,
): WorksheetRelationshipCandidate => ({
  relationshipId: `candidate:${source.tableName}:${target.tableName}`,
  workbookId: "workbook:ask-fixture",
  sourceWorksheetId: source.worksheetId,
  sourceWorksheetName: source.displayName,
  sourceTable: source.tableName,
  sourceColumn,
  targetWorksheetId: target.worksheetId,
  targetWorksheetName: target.displayName,
  targetTable: target.tableName,
  targetColumn,
  confidence: 0.92,
  confidenceLabel: "high",
  relationshipType: "one_to_many_candidate",
  direction: "source_to_target",
  evidence: {
    nameSimilarity: 1,
    typeCompatible: true,
    sourceUniqueRatio: 1,
    targetUniqueRatio: 0.5,
    sampledOverlapRatio: 0.9,
    sampledRowCount: 25,
    summaries: ["Fixture deterministic relationship candidate."],
  },
  status: "candidate",
  reviewStatus: "pending",
  reviewedAt: null,
  reviewedBy: null,
  reviewNotes: null,
});

const businessWorkbookDataset = ({
  sheets,
  activeSheet,
  acceptedRelationshipContracts = [],
  relationshipCandidates = [],
}: {
  sheets: WorksheetMetadata[];
  activeSheet: WorksheetMetadata;
  acceptedRelationshipContracts?: AcceptedRelationshipContract[];
  relationshipCandidates?: WorksheetRelationshipCandidate[];
}): DatasetMetadata => {
  const workbookMetadata: WorkbookMetadata = {
    ...workbook(),
    worksheetIds: sheets.map((sheet) => sheet.worksheetId),
    activeWorksheetId: activeSheet.worksheetId,
    activeAnalysisSource: {
      type: "original",
      worksheetId: activeSheet.worksheetId,
      tableName: activeSheet.tableName,
      originalTableName: activeSheet.tableName,
      activatedAt: "2026-01-01T00:00:00.000Z",
    },
    worksheets: sheets,
    acceptedRelationshipContracts,
    relationshipCandidates,
  };

  return {
    dataset_id: `dataset:${activeSheet.tableName}`,
    filename: "business-workbook.xlsx",
    original_filename: "business-workbook.xlsx",
    table_name: activeSheet.tableName,
    uploaded_at: "2026-01-01T00:00:00.000Z",
    row_count: activeSheet.rowCount,
    column_count: activeSheet.columnCount,
    schema: activeSheet.schema,
    workbook_metadata: workbookMetadata,
  };
};

const customersSheet = worksheet("worksheet:customers", "customers", "customers", [
  column("customer_id"),
  column("customer_name", "categorical"),
  column("status", "categorical"),
  column("segment", "categorical"),
]);

const ordersSheet = worksheet("worksheet:orders", "orders", "orders", [
  column("order_id"),
  column("customer_id"),
  column("status", "categorical"),
  column("order_value", "numeric"),
]);

const ordersStatusSheet = worksheet("worksheet:orders-status", "orders", "orders", [
  column("status", "categorical"),
  column("order_id"),
  column("customer_id"),
  column("order_value", "numeric"),
]);

const productsSheet = worksheet("worksheet:products", "products", "products", [
  column("product_id"),
  column("product_category", "categorical"),
  column("revenue", "numeric"),
]);

const unitsSheet = worksheet("worksheet:units", "units", "units", [
  column("unit_id"),
  column("unit_number", "categorical"),
]);

const tenantsSheet = worksheet("worksheet:tenants", "tenants", "tenants", [
  column("tenant_id"),
  column("unit_id"),
  column("tenant_name", "categorical"),
]);

const accessCodesSheet = worksheet("worksheet:access-codes", "access_codes", "access_codes", [
  column("access_code_id"),
  column("tenant_id"),
  column("code_status", "categorical"),
]);

const instructionsSheet = worksheet("worksheet:instructions", "Instructions", "instructions", [
  column("instruction_id"),
  column("tenant_id"),
  column("access_code_notes"),
]);

const catOwnersSheet = worksheet("worksheet:cat-owners", "cat_owners", "cat_owners", [
  column("owner_id"),
  column("tenant_id"),
  column("unit_id"),
]);

const ordersCustomersDataset = businessWorkbookDataset({
  sheets: [ordersSheet, customersSheet],
  activeSheet: ordersSheet,
  acceptedRelationshipContracts: [
    relationshipContract(customersSheet, "customer_id", ordersSheet, "customer_id"),
  ],
});

const ordersStatusDataset = businessWorkbookDataset({
  sheets: [ordersStatusSheet],
  activeSheet: ordersStatusSheet,
});

const productsDataset = businessWorkbookDataset({
  sheets: [productsSheet],
  activeSheet: productsSheet,
});

const missingTenantAccessDataset = businessWorkbookDataset({
  sheets: [tenantsSheet, unitsSheet, accessCodesSheet],
  activeSheet: tenantsSheet,
});

const noisyMissingTenantAccessDataset = businessWorkbookDataset({
  sheets: [tenantsSheet, unitsSheet, accessCodesSheet, instructionsSheet, catOwnersSheet],
  activeSheet: tenantsSheet,
});

const reviewCandidateTenantAccessDataset = businessWorkbookDataset({
  sheets: [tenantsSheet, unitsSheet, accessCodesSheet],
  activeSheet: tenantsSheet,
  relationshipCandidates: [
    relationshipCandidate(unitsSheet, "unit_id", tenantsSheet, "unit_id"),
    relationshipCandidate(tenantsSheet, "tenant_id", accessCodesSheet, "tenant_id"),
  ],
});

const safeTenantAccessDataset = businessWorkbookDataset({
  sheets: [tenantsSheet, unitsSheet, accessCodesSheet],
  activeSheet: tenantsSheet,
  acceptedRelationshipContracts: [
    relationshipContract(unitsSheet, "unit_id", tenantsSheet, "unit_id"),
    relationshipContract(tenantsSheet, "tenant_id", accessCodesSheet, "tenant_id"),
  ],
});

const failedPreview: BusinessSqlRenderPreview = {
  planId: "plan:needs-details",
  title: "Business SQL preview not ready",
  status: "needs_review",
  body: "Plan support must be supported before rendering.",
  sql: null,
  reasons: [
    "Plan support must be supported before rendering.",
    "Plan must include a metric.",
  ],
  warnings: ["Plan status must be resolved before rendering."],
  rendererTarget: "duckdb",
  guidanceDialect: "duckdb",
  actions: {
    canCopySql: false,
    canInsertSql: false,
    canRunSql: false,
  },
};

const readyPreview: BusinessSqlRenderPreview = {
  planId: "plan:ready",
  title: "Business SQL preview ready",
  status: "ready",
  body: "Preview SQL is ready.",
  sql: 'SELECT status, COUNT(*) AS lease_count FROM "leases" GROUP BY status;',
  reasons: [],
  warnings: [],
  rendererTarget: "duckdb",
  guidanceDialect: "duckdb",
  actions: {
    canCopySql: true,
    canInsertSql: false,
    canRunSql: false,
  },
};

const expectNoBehaviorChange = (model: {
  noRunQuery: true;
  noBackendCall: true;
  noEditorMutation: true;
}): string[] => [
  ...(model.noRunQuery === true ? [] : ["Ask must not call Run Query."]),
  ...(model.noBackendCall === true ? [] : ["Ask must not call backend/API."]),
  ...(model.noEditorMutation === true ? [] : ["Ask must not mutate the editor draft."]),
];

const expectNoInsertSideEffects = (model: {
  noRunQuery: true;
  noBackendCall: true;
}): string[] => [
  ...(model.noRunQuery === true ? [] : ["Insert must not call Run Query."]),
  ...(model.noBackendCall === true ? [] : ["Insert must not call backend/API."]),
];

const fixtures: Fixture[] = [
  {
    name: "T-17C Ask suggestion model includes compact adaptive fit summaries",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "How many orders by customer?",
        dataset: ordersCustomersDataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const recommendationIds = model.recommendations.map((recommendation) => recommendation.id);
      const insertState = model.recommendations[0]
        ? createSqlAskRecommendationInsertModel(model.recommendations[0])
        : null;

      return [
        ...(model.adaptiveFitSummaries.length > 0
          ? []
          : ["Expected adaptive fit summaries after Ask submission."]),
        ...(model.adaptiveFitSummaries.length <= 2
          ? []
          : [`Expected at most two adaptive fit summaries, received ${model.adaptiveFitSummaries.length}.`]),
        ...(model.adaptiveFitSummaries.some(
          (summary) => summary.label === "Exact match" && summary.statusLabel === "Ready to insert",
        )
          ? []
          : ["Expected Exact match / Ready to insert summary for safe grouped-count SQL."]),
        ...(insertState?.canInsert ? [] : ["Expected existing insert behavior to remain insertable."]),
        ...(recommendationIds.join("|") === model.recommendations.map((recommendation) => recommendation.id).join("|")
          ? []
          : ["Adaptive summaries must not reorder recommendations."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "T-17C blocked relationship fit summary opens existing review path",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "How many tenants in every unit have access codes?",
        dataset: missingTenantAccessDataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const blockedSummary = model.adaptiveFitSummaries.find(
        (summary) => summary.category === "blocked_fit",
      );
      const review = createSqlRelationshipReviewModel({
        dataset: missingTenantAccessDataset,
        requiredRelationships: model.blockedPlan?.missingRelationships || [],
      });

      return [
        ...(blockedSummary ? [] : ["Expected blocked adaptive fit summary."]),
        ...(blockedSummary?.label === "Needs worksheet relationships"
          ? []
          : [`Expected Needs worksheet relationships label, received ${blockedSummary?.label || "none"}.`]),
        ...(blockedSummary?.statusLabel === "Relationships needed"
          ? []
          : [`Expected Relationships needed status, received ${blockedSummary?.statusLabel || "none"}.`]),
        ...(blockedSummary?.description === ASK_RELATIONSHIP_BLOCK_COMPACT_COPY
          ? []
          : [`Expected compact blocked summary copy, received ${blockedSummary?.description || "none"}.`]),
        ...(ASK_RELATIONSHIP_BLOCK_COMPACT_TITLE === "Review worksheet connections before inserting SQL."
          ? []
          : ["Expected compact relationship block title copy."]),
        ...(blockedSummary?.description.includes("tenants to units") ||
          blockedSummary?.description.includes("tenants to access_codes")
          ? ["Main Ask relationship summary must not repeat detailed relationship pairs."]
          : []),
        ...(blockedSummary?.requiredRelationships.includes("tenants to units") &&
          blockedSummary.requiredRelationships.includes("tenants to access_codes")
          ? []
          : [`Expected required relationship pairs, received ${blockedSummary?.requiredRelationships.join(", ") || "none"}.`]),
        ...(model.blockedPlan?.missingRelationships.join("|") === blockedSummary?.requiredRelationships.join("|")
          ? []
          : ["Blocked fit summary should reuse the same relationship review inputs as the blocked Ask card."]),
        ...(review.pairs.some((pair) => pair.fromTable === "tenants" && pair.toTable === "units") &&
          review.pairs.some((pair) => pair.fromTable === "tenants" && pair.toTable === "access_codes")
          ? []
          : ["Detailed relationship pairs must remain available in the read-only review panel."]),
        ...(model.blockedPlan ? [] : ["Expected existing blocked relationship card to remain available."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "T-17C-Fix-2 Recommended analysis merges fit metadata and analysis options",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "How many tenants in every unit have access codes?",
        dataset: missingTenantAccessDataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const recommended = model.recommendedAnalysis;
      const visibleCards = [
        ...(recommended.primary ? [recommended.primary] : []),
        ...recommended.alternatives,
      ];
      const review = createSqlRelationshipReviewModel({
        dataset: missingTenantAccessDataset,
        requiredRelationships: recommended.relationshipAction?.requiredRelationships || [],
      });
      const overflow = createSqlAskRecommendedAnalysisModel({
        adaptiveFitSummaries: [],
        analyticalStrategies: [
          {
            id: "one",
            title: "Count orders by customer",
            description: "Count orders for each customer.",
            outputShape: ["customer_name", "order_count"],
            strategyKind: "grouped_count",
            requiredEntities: ["orders", "customers"],
            requiredRelationships: [],
            isInsertable: false,
            confidence: "high",
          },
          {
            id: "two",
            title: "Rank customers by order count",
            description: "Sort customers by order count.",
            outputShape: ["customer_name", "order_count", "rank"],
            strategyKind: "ranked_summary",
            requiredEntities: ["orders", "customers"],
            requiredRelationships: [],
            isInsertable: false,
            confidence: "high",
          },
          {
            id: "three",
            title: "Customer coverage percentage",
            description: "Calculate coverage percentage.",
            outputShape: ["customer_name", "coverage_percent"],
            strategyKind: "coverage_percent",
            requiredEntities: ["orders", "customers"],
            requiredRelationships: [],
            isInsertable: false,
            confidence: "medium",
          },
          {
            id: "four",
            title: "Customers missing orders",
            description: "Find customers with no orders.",
            outputShape: ["customer_name", "missing_order_count"],
            strategyKind: "gap_detection",
            requiredEntities: ["orders", "customers"],
            requiredRelationships: [],
            isInsertable: false,
            confidence: "medium",
          },
        ],
        recommendations: [],
      });

      return [
        ...(recommended.title === "Recommended analysis"
          ? []
          : [`Expected Recommended analysis title, received ${recommended.title}.`]),
        ...(recommended.primary ? [] : ["Expected primary Recommended analysis card."]),
        ...(recommended.primary?.fitLabel
          ? []
          : ["Expected fit metadata badge inside the primary card."]),
        ...(recommended.primary?.statusLabel === "Relationships needed"
          ? []
          : [`Expected Relationships needed status, received ${recommended.primary?.statusLabel || "none"}.`]),
        ...(recommended.relationshipAction?.actionLabel === "Review worksheet connections"
          ? []
          : ["Expected one shared relationship review action for blocked top options."]),
        ...(visibleCards.every((card) => card.requiredRelationships.length > 0)
          ? []
          : ["Expected visible blocked cards to preserve relationship requirements behind the scenes."]),
        ...(visibleCards.every((card) => card.description.includes("tenants to units") === false)
          ? []
          : ["Visible Recommended analysis cards must not repeat detailed relationship pairs in descriptions."]),
        ...(recommended.alternatives.length <= 2
          ? []
          : [`Expected at most two visible alternatives, received ${recommended.alternatives.length}.`]),
        ...(overflow.hiddenAlternatives.length > 0
          ? []
          : ["Expected extra analysis options to be collapsed under More analysis options."]),
        ...(review.pairs.some((pair) => pair.fromTable === "tenants" && pair.toTable === "units") &&
          review.pairs.some((pair) => pair.fromTable === "tenants" && pair.toTable === "access_codes")
          ? []
          : ["Detailed missing relationship pairs must remain available in the review panel."]),
        ...(recommended.noBackendCall && recommended.noRunQuery && recommended.noEditorMutation
          ? []
          : ["Recommended analysis must not add backend, Run Query, or editor mutation behavior."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "T-17C-Fix-2 Recommended analysis dedupes overlapping fit and option cards",
    assert: () => {
      const merged = createSqlAskRecommendedAnalysisModel({
        adaptiveFitSummaries: [
          {
            id: "strategy:grouped-count",
            candidateId: "grouped-count",
            source: "strategy",
            label: "Exact match",
            title: "Count orders by customer",
            description: "This existing SQL suggestion directly matches the detected question shape.",
            statusLabel: "Ready to insert",
            category: "exact_fit",
            insertState: "insertable_existing_sql",
            reasons: ["This existing SQL suggestion directly matches the detected question shape."],
            requiredRelationships: [],
            missingFields: [],
          },
        ],
        analyticalStrategies: [
          {
            id: "grouped-count",
            title: "Count orders by customer",
            description: "Count orders for each customer.",
            outputShape: ["customer_name", "order_count"],
            strategyKind: "grouped_count",
            requiredEntities: ["orders", "customers"],
            requiredRelationships: [],
            isInsertable: true,
            confidence: "high",
            sql: "select customer_id, count(*) from orders group by customer_id",
            sourceRecommendationId: "orders-by-customer",
          },
          {
            id: "ranked-count",
            title: "Rank customers by order count",
            description: "Show the highest customers by order count.",
            outputShape: ["customer_name", "order_count", "rank"],
            strategyKind: "ranked_summary",
            requiredEntities: ["orders", "customers"],
            requiredRelationships: [],
            isInsertable: false,
            confidence: "high",
          },
        ],
        recommendations: [],
      });

      return [
        ...(merged.primary?.title === "Count orders by customer"
          ? []
          : [`Expected primary card from merged fit, received ${merged.primary?.title || "none"}.`]),
        ...(merged.primary?.fitLabel === "Best fit"
          ? []
          : [`Expected Best fit badge, received ${merged.primary?.fitLabel || "none"}.`]),
        ...(merged.primary?.expectedOutput.join(", ") === "customer_name, order_count"
          ? []
          : [`Expected strategy output on primary card, received ${merged.primary?.expectedOutput.join(", ") || "none"}.`]),
        ...(merged.alternatives.some((card) => card.title === "Count orders by customer")
          ? ["Duplicate fit/strategy card should not appear as an alternative."]
          : []),
        ...(merged.alternatives.some((card) => card.title === "Rank customers by order count")
          ? []
          : ["Expected non-duplicate strategy to remain as a compact alternative."]),
      ];
    },
  },
  {
    name: "T-17C summary labels partial adapted composed and weak fits without enabling insert",
    assert: () => {
      const groupedShape = classifySqlBusinessQuestion({
        prompt: "How many orders by customer?",
        dataset: ordersCustomersDataset,
      });
      const partial = createSqlAskAdaptiveFitSummaries({
        prompt: groupedShape.prompt,
        questionShape: groupedShape,
        recommendations: [
          {
            id: "status-summary",
            kind: "template",
            title: "Status summary - orders",
            description: "Count orders by status.",
            sql: 'SELECT status, COUNT(*) AS order_count FROM "orders" GROUP BY status;',
            score: 90,
            reasons: ["Matches status breakdown question shape."],
            support: "supported",
          },
        ],
        analyticalStrategies: [],
        blockedPlan: null,
        dataset: ordersCustomersDataset,
      });
      const adapted = createSqlAskAdaptiveFitSummaries({
        prompt: groupedShape.prompt,
        questionShape: groupedShape,
        recommendations: [
          {
            id: "orders-by-customer-needs-review",
            kind: "template",
            title: "Count orders by customer",
            description: "Count orders for each customer.",
            sql: 'SELECT customer_id, COUNT(*) AS order_count FROM "orders" GROUP BY customer_id;',
            score: 90,
            reasons: ["Matches grouped count question shape."],
            support: "needs_review",
            warnings: ["Needs review before insertion because the label must be verified."],
          },
        ],
        analyticalStrategies: [],
        blockedPlan: null,
        dataset: ordersCustomersDataset,
      });
      const composed = createSqlAskAdaptiveFitSummaries({
        prompt: "Which accounts have missing customer coverage?",
        questionShape: {
          ...groupedShape,
          prompt: "Which accounts have missing customer coverage?",
          preferredOutputShape: "detail_list",
          hasDetailIntent: true,
          hasFilterIntent: true,
          filterTerms: ["missing"],
          relationshipDependent: false,
          relationshipGaps: [],
        },
        recommendations: [],
        analyticalStrategies: [
          {
            id: "coverage-percent",
            title: "customer coverage percentage by account",
            description: "Calculate coverage percentage for customers matching the requested condition.",
            outputShape: ["account_name", "customer_count", "coverage_percent"],
            strategyKind: "coverage_percent",
            requiredEntities: ["customers", "accounts"],
            requiredRelationships: [],
            isInsertable: false,
            confidence: "medium",
          },
          {
            id: "gap-detection",
            title: "accounts missing customer coverage",
            description: "Find accounts with missing or no matching customers.",
            outputShape: ["account_name", "customers_without_coverage_count"],
            strategyKind: "gap_detection",
            requiredEntities: ["customers", "accounts"],
            requiredRelationships: [],
            isInsertable: false,
            confidence: "medium",
          },
        ],
        blockedPlan: null,
        dataset: ordersCustomersDataset,
      });
      const weak = createSqlAskAdaptiveFitSummaries({
        prompt: groupedShape.prompt,
        questionShape: groupedShape,
        recommendations: [
          {
            id: "filter-equals",
            kind: "template",
            title: "Filter equals",
            description: "Simple syntax example for a WHERE filter equals predicate.",
            sql: 'SELECT * FROM "orders" WHERE status = ?;',
            score: 10,
            reasons: ["Generic syntax helper."],
            support: "supported",
          },
        ],
        analyticalStrategies: [],
        blockedPlan: null,
        dataset: ordersCustomersDataset,
      });

      return [
        ...(partial[0]?.label === "Partial match" && partial[0].statusLabel !== "Ready to insert"
          ? []
          : [`Expected Partial match without Ready to insert, received ${partial[0]?.label || "none"} / ${partial[0]?.statusLabel || "none"}.`]),
        ...(adapted[0]?.label === "Can be adapted" && adapted[0].statusLabel === "Read-only for now"
          ? []
          : [`Expected Can be adapted / Read-only for now, received ${adapted[0]?.label || "none"} / ${adapted[0]?.statusLabel || "none"}.`]),
        ...(composed.some(
          (summary) => summary.label === "Composed analysis" && summary.statusLabel === "Read-only for now",
        )
          ? []
          : ["Expected Composed analysis / Read-only for now summary."]),
        ...(weak[0]?.label === "Weak match"
          ? []
          : [`Expected Weak match label, received ${weak[0]?.label || "none"}.`]),
      ];
    },
  },
  {
    name: "T-17C fit summaries are capped and do not mutate SQL or recommendations",
    assert: () => {
      const groupedShape = classifySqlBusinessQuestion({
        prompt: "How many orders by customer?",
        dataset: ordersCustomersDataset,
      });
      const recommendations = [
        {
          id: "exact-one",
          kind: "template" as const,
          title: "Count orders by customer",
          description: "Count orders for each customer.",
          sql: 'SELECT customer_id, COUNT(*) AS order_count FROM "orders" GROUP BY customer_id;',
          score: 100,
          reasons: ["Matches grouped count question shape."],
          support: "supported" as const,
        },
        {
          id: "filter-equals",
          kind: "template" as const,
          title: "Filter equals",
          description: "Simple syntax example for a WHERE filter equals predicate.",
          sql: 'SELECT * FROM "orders" WHERE status = ?;',
          score: 10,
          reasons: ["Generic syntax helper."],
          support: "supported" as const,
        },
        {
          id: "status-summary",
          kind: "template" as const,
          title: "Status summary - orders",
          description: "Count orders by status.",
          sql: 'SELECT status, COUNT(*) AS order_count FROM "orders" GROUP BY status;',
          score: 90,
          reasons: ["Matches status breakdown question shape."],
          support: "supported" as const,
        },
      ];
      const beforeIds = recommendations.map((recommendation) => recommendation.id).join("|");
      const beforeSql = recommendations.map((recommendation) => recommendation.sql).join("|");
      const beforeSnapshot = JSON.stringify(recommendations);
      const summaries = createSqlAskAdaptiveFitSummaries({
        prompt: groupedShape.prompt,
        questionShape: groupedShape,
        recommendations,
        analyticalStrategies: [],
        blockedPlan: null,
        dataset: ordersCustomersDataset,
      });

      return [
        ...(summaries.length <= 2 ? [] : [`Expected at most two summaries, received ${summaries.length}.`]),
        ...(summaries.some((summary) => summary.label === "Weak match")
          ? ["Weak match should be deprioritized when stronger summaries are available."]
          : []),
        ...(beforeIds === recommendations.map((recommendation) => recommendation.id).join("|")
          ? []
          : ["Summary creation must not reorder recommendations."]),
        ...(beforeSql === recommendations.map((recommendation) => recommendation.sql).join("|")
          ? []
          : ["Summary creation must not modify recommendation SQL."]),
        ...(beforeSnapshot === JSON.stringify(recommendations)
          ? []
          : ["Summary creation must not mutate recommendation objects."]),
      ];
    },
  },
  {
    name: "T-15-5 grouped-count question generates multiple analytical strategies",
    assert: () => {
      const data = businessWorkbookDataset({ sheets: [ordersWorksheet, customersWorksheet], activeSheet: ordersWorksheet });
      const shape = classifySqlBusinessQuestion({ prompt: "How many orders by customer?", dataset: data });
      const strategies = recommendAnalyticalStrategies({ prompt: shape.prompt, questionShape: shape, relevantWorksheets: [], existingRecommendations: [{ id: "orders-by-customer", title: "Count orders by customer", description: "Count orders by customer", sql: "select customer_id, count(*) from orders group by customer_id" }] });
      const titles = strategies.map((strategy) => strategy.title);
      return [
        ...(titles.includes("Count orders by customers") || titles.includes("Count orders by customer") ? [] : [`Expected count strategy, received ${titles.join(" | ")}.`]),
        ...(strategies.some((strategy) => strategy.strategyKind === "ranked_summary") ? [] : ["Expected ranked summary strategy."]),
        ...(strategies.length >= 2 && strategies.length <= 3 ? [] : [`Expected 2-3 strategies, received ${strategies.length}.`]),
      ];
    },
  },
  {
    name: "T-15-5 missing cross-entity relationships block all tenant/unit strategies",
    assert: () => {
      const data = businessWorkbookDataset({ sheets: [tenantsWorksheet, unitsWorksheet], activeSheet: tenantsWorksheet });
      const shape = classifySqlBusinessQuestion({ prompt: "How many tenants in every unit have access codes?", dataset: data });
      const strategies = recommendAnalyticalStrategies({ prompt: shape.prompt, questionShape: shape, relevantWorksheets: [] });
      return [
        ...(strategies.length === 3 ? [] : [`Expected three blocked strategies, received ${strategies.length}.`]),
        ...(strategies.every((strategy) => !strategy.isInsertable) ? [] : ["Expected no insertable relationship-dependent strategies."]),
        ...(strategies.every((strategy) => sqlAnalyticalStrategyStatusLabel(strategy) === "Relationships needed") ? [] : ["Expected relationships-needed status for blocked strategies."]),
        ...(strategies.some((strategy) => strategy.strategyKind === "blocked_relationship_plan") ? [] : ["Expected blocked relationship gap strategy."]),
      ];
    },
  },
  {
    name: "T-15-5 metric-by-dimension question generates metric and ranking strategies",
    assert: () => {
      const data = businessWorkbookDataset({ sheets: [ordersWorksheet, productsWorksheet], activeSheet: ordersWorksheet, acceptedRelationshipContracts: [relationshipContract(productsWorksheet, "product_id", ordersWorksheet, "product_id")] });
      const shape = classifySqlBusinessQuestion({ prompt: "Total revenue by product category", dataset: data });
      const strategies = recommendAnalyticalStrategies({ prompt: shape.prompt, questionShape: shape, relevantWorksheets: [], existingRecommendations: [{ id: "revenue-category", title: "Total revenue by product category", description: "Total revenue by product category", sql: "select product_category, sum(revenue) from orders group by product_category" }] });
      return [
        ...(strategies.some((strategy) => strategy.strategyKind === "metric_by_dimension") ? [] : ["Expected metric-by-dimension strategy."]),
        ...(strategies.some((strategy) => strategy.strategyKind === "ranked_summary") ? [] : ["Expected ranked metric strategy."]),
      ];
    },
  },
  {
    name: "T-15-5 status-breakdown and detail-list strategies remain deterministic",
    assert: () => {
      const data = businessWorkbookDataset({ sheets: [ordersWorksheet, unitsWorksheet], activeSheet: ordersWorksheet });
      const statusShape = classifySqlBusinessQuestion({ prompt: "How many orders are pending vs completed?", dataset: data });
      const statusStrategies = recommendAnalyticalStrategies({ prompt: statusShape.prompt, questionShape: statusShape, relevantWorksheets: [] });
      const listShape = classifySqlBusinessQuestion({ prompt: "List units without access codes", dataset: data });
      const listStrategies = recommendAnalyticalStrategies({ prompt: listShape.prompt, questionShape: listShape, relevantWorksheets: [] });
      return [
        ...(statusStrategies.some((strategy) => strategy.strategyKind === "status_breakdown" && strategy.title === "orders by status") ? [] : ["Expected orders by status strategy."]),
        ...(listStrategies.some((strategy) => strategy.strategyKind === "detail_list") ? [] : ["Expected detail list strategy."]),
        ...(listStrategies.every((strategy) => !strategy.isInsertable) ? [] : ["Expected detail strategies to require review without safe SQL."]),
      ];
    },
  },
  {
    name: "T-15-5 Ask suggestion model exposes analysis options without backend or execution",
    assert: () => {
      const data = businessWorkbookDataset({ sheets: [ordersWorksheet, customersWorksheet], activeSheet: ordersWorksheet });
      const model = createSqlAskFiltraQueriSuggestionModel({ hasSubmittedAsk: true, prompt: "How many orders by customer?", dataset: data, selectedDialect: "duckdb", appliedScopeSelections: [] });
      return [
        ...(model.analyticalStrategies.length >= 2 ? [] : ["Expected multiple analysis options in Ask model."]),
        ...(model.noBackendCall && model.noRunQuery && model.noEditorMutation ? [] : ["Ask analysis options must not call backend, run SQL, or mutate editor."]),
      ];
    },
  },
  {
    name: "Ask FiltraQueri input model exposes visible button label",
    assert: () => {
      const model = createSqlAskFiltraQueriModel("Count leases by status");
      return [
        ...(model.buttonLabel === ASK_FILTRAQUERI_BUTTON_LABEL
          ? []
          : ["Expected visible Ask FiltraQueri button label."]),
        ...(model.buttonLabel === "Ask FiltraQueri"
          ? []
          : [`Expected Ask FiltraQueri label, received ${model.buttonLabel}.`]),
        ...(model.canSubmit ? [] : ["Expected non-empty prompt to enable Ask."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask button stays disabled for empty prompt",
    assert: () => {
      const model = createSqlAskFiltraQueriModel("   ");
      return [
        ...(model.canSubmit ? ["Expected empty prompt to disable Ask."] : []),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Enter submits Ask when prompt has text",
    assert: () => [
      ...(shouldSubmitSqlAskFiltraQueriKey({
        key: "Enter",
        prompt: "Count leases by status",
      })
        ? []
        : ["Expected Enter to submit Ask for a non-empty prompt."]),
    ],
  },
  {
    name: "Shift Enter does not submit Ask",
    assert: () => [
      ...(shouldSubmitSqlAskFiltraQueriKey({
        key: "Enter",
        shiftKey: true,
        prompt: "Count leases by status",
      })
        ? ["Expected Shift+Enter to avoid submitting Ask."]
        : []),
    ],
  },
  {
    name: "Ask and Enter do not imply Run Query",
    assert: () => {
      const model = createSqlAskFiltraQueriModel("Count leases by status");
      const enterSubmits = shouldSubmitSqlAskFiltraQueriKey({
        key: "Enter",
        prompt: model.prompt,
      });
      return [
        ...(enterSubmits ? [] : ["Expected Enter to submit the Ask action."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask reuses deterministic template recommendation flow",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });

      return [
        ...(model.recommendations.length > 0
          ? []
          : ["Expected deterministic template recommendations after Ask."]),
        ...(model.recommendations.some((recommendation) => /count|summary|status/i.test(recommendation.title))
          ? []
          : [`Expected count/status recommendation, received ${model.recommendations.map((item) => item.title).join(", ")}.`]),
        ...(model.guidanceTitle === "Suggested template"
          ? []
          : [`Expected suggested-template guidance, received ${model.guidanceTitle}.`]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "grouped-count questions rank grouped-count recommendations above status summaries",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "How many orders by customer?",
        dataset: ordersCustomersDataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const top = model.recommendations[0];

      return [
        ...(model.questionShape?.preferredOutputShape === "grouped_count"
          ? []
          : [`Expected grouped_count shape, received ${model.questionShape?.preferredOutputShape}.`]),
        ...(top?.title.toLowerCase().includes("count orders") && top.title.toLowerCase().includes("customer")
          ? []
          : [`Expected grouped-count top recommendation, received ${top?.title || "none"}.`]),
        ...(top?.sql.includes("order_count") || top?.sql.includes("customer_label")
          ? []
          : ["Expected grouped-count SQL shape with customer/order output columns."]),
        ...(top?.title.toLowerCase().includes("status summary")
          ? ["Generic status summary must not be top for grouped-count prompt."]
          : []),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "cross-entity grouped-count questions block generic insertable status summaries when relationships are missing",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "How many tenants in every unit have access codes?",
        dataset: noisyMissingTenantAccessDataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });

      return [
        ...(model.questionShape?.hasCountIntent ? [] : ["Expected count intent."]),
        ...(model.questionShape?.isCrossEntity ? [] : ["Expected multi-entity intent."]),
        ...(model.questionShape?.hasGroupingIntent ? [] : ["Expected by/every grouping intent."]),
        ...(model.questionShape?.relationshipDependent ? [] : ["Expected relationship-dependent classification."]),
        ...(model.questionShape?.preferredOutputShape === "blocked_relationship_plan"
          ? []
          : [`Expected blocked relationship plan, received ${model.questionShape?.preferredOutputShape}.`]),
        ...(model.recommendations.length === 0
          ? []
          : [`Expected no insertable recommendations without relationships, received ${model.recommendations.map((item) => item.title).join(", ")}.`]),
        ...(model.blockedPlan
          ? []
          : ["Expected visible blocked plan recommendation card model."]),
        ...(model.blockedPlan?.title === "Count tenants with access codes by unit"
          ? []
          : [`Expected inferred blocked plan title, received ${model.blockedPlan?.title || "none"}.`]),
        ...(model.blockedPlan?.title.includes("Instructions") || model.blockedPlan?.title.includes("cat owners")
          ? ["Blocked plan title must not include unrelated weak worksheet matches."]
          : []),
        ...(model.blockedPlan?.expectedOutput === "Expected output: unit_number, tenants_with_access_codes_count"
          ? []
          : [`Expected blocked plan output shape, received ${model.blockedPlan?.expectedOutput || "none"}.`]),
        ...(model.blockedPlan?.expectedOutput.includes("instructions") ||
          model.blockedPlan?.expectedOutput.includes("cat_owners")
          ? ["Blocked plan output must not include unrelated weak worksheet matches."]
          : []),
        ...(model.blockedPlan?.statusLabel === "Needs relationship metadata"
          ? []
          : ["Expected blocked plan relationship status label."]),
        ...(model.blockedPlan?.actionLabel === "Relationships needed"
          ? []
          : [`Expected blocked action label, received ${model.blockedPlan?.actionLabel || "none"}.`]),
        ...(model.blockedPlan?.relevantEntities.join(",") === "tenants,units,access_codes"
          ? []
          : [`Expected relevant worksheet list, received ${model.blockedPlan?.relevantEntities.join(",") || "none"}.`]),
        ...(model.blockedPlan?.relevantEntities.includes("Instructions") ||
          model.blockedPlan?.relevantEntities.includes("cat_owners")
          ? ["Relevant worksheets must exclude unrelated weak matches."]
          : []),
        ...(model.blockedPlan?.missingRelationships.includes("tenants to units") &&
          model.blockedPlan.missingRelationships.includes("tenants to access_codes") &&
          model.blockedPlan.missingRelationships.length === 2
          ? []
          : [`Expected missing relationship list, received ${model.blockedPlan?.missingRelationships.join(", ") || "none"}.`]),
        ...(model.blockedPlan?.disabledReason === "Confirm worksheet relationships before inserting SQL."
          ? []
          : ["Expected user-facing blocked insert reason."]),
        ...(model.blockedPlan ? [] : ["Expected blocked relationship card to remain visible."]),
        ...(model.guidanceTitle === "Review worksheet connections before inserting SQL"
          ? []
          : [`Expected relationship guidance, received ${model.guidanceTitle}.`]),
        ...(model.guidanceCopy.includes("tenants") && model.guidanceCopy.includes("access_codes")
          ? []
          : [`Expected relevant entity guidance, received ${model.guidanceCopy}.`]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "T-16A blocked Ask recommendation exposes relationship review entry point",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "How many tenants in every unit have access codes?",
        dataset: noisyMissingTenantAccessDataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const review = createSqlRelationshipReviewModel({
        dataset: noisyMissingTenantAccessDataset,
        requiredRelationships: model.blockedPlan?.missingRelationships || [],
      });

      return [
        ...(RELATIONSHIP_REVIEW_ACTION_LABEL === "Review worksheet connections"
          ? []
          : ["Expected blocked Ask card action copy to be Review worksheet connections."]),
        ...(review.actionLabel === "Review worksheet connections"
          ? []
          : [`Expected review action label, received ${review.actionLabel}.`]),
        ...(review.title === RELATIONSHIP_REVIEW_PANEL_TITLE &&
          review.title === "Review worksheet connections"
          ? []
          : [`Expected relationship review panel title, received ${review.title}.`]),
        ...(review.description === RELATIONSHIP_REVIEW_PANEL_DESCRIPTION &&
          review.description.includes("Review how they connect before preparing SQL")
          ? []
          : ["Expected relationship review panel description copy."]),
        ...(review.description.includes("cross-table SQL") ||
          review.safetyCopy.includes("No SQL generated") ||
          review.safetyCopy.includes("accepted relationship metadata")
          ? ["Relationship review panel copy must not expose internal relationship or SQL labels."]
          : []),
        ...(review.pairs.length === 2 ? [] : [`Expected two missing relationship pairs, received ${review.pairs.length}.`]),
        ...(review.pairs.some((pair) => pair.fromTable === "tenants" && pair.toTable === "units")
          ? []
          : ["Expected tenants to units relationship pair."]),
        ...(review.pairs.some((pair) => pair.fromTable === "tenants" && pair.toTable === "access_codes")
          ? []
          : ["Expected tenants to access_codes relationship pair."]),
        ...(review.relevantWorksheets.includes("tenants") &&
          review.relevantWorksheets.includes("units") &&
          review.relevantWorksheets.includes("access_codes") &&
          review.relevantWorksheets.length === 3
          ? []
          : [`Expected relevant worksheets tenants, units, access_codes; received ${review.relevantWorksheets.join(",")}.`]),
        ...(review.pairs.every((pair) => pair.status === "missing" && pair.statusLabel === "Needs review")
          ? []
          : ["Expected missing relationship status for all blocked Ask pairs."]),
        ...(review.pairs.every((pair) => pair.suggestedColumns === null)
          ? []
          : ["Expected no suggested columns without deterministic relationship candidates."]),
        ...(review.noPersistence && review.noAcceptance && review.noSqlGeneration && review.noBackendCall && review.noRunQuery
          ? []
          : ["Relationship review must be read-only with no persistence, acceptance, SQL, backend, or Run Query side effects."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "T-16A blocked analytical strategy can open read-only relationship review",
    assert: () => {
      const data = businessWorkbookDataset({ sheets: [tenantsWorksheet, unitsWorksheet], activeSheet: tenantsWorksheet });
      const shape = classifySqlBusinessQuestion({
        prompt: "How many tenants in every unit have access codes?",
        dataset: data,
      });
      const strategies = recommendAnalyticalStrategies({
        prompt: shape.prompt,
        questionShape: shape,
        relevantWorksheets: [],
      });
      const blockedStrategy = strategies.find(
        (strategy) => sqlAnalyticalStrategyStatusLabel(strategy) === "Relationships needed",
      );
      const review = createSqlRelationshipReviewModel({
        dataset: data,
        requiredRelationships: blockedStrategy?.requiredRelationships || [],
      });

      return [
        ...(blockedStrategy ? [] : ["Expected blocked analytical strategy."]),
        ...(RELATIONSHIP_REVIEW_ACTION_LABEL === "Review worksheet connections"
          ? []
          : ["Expected blocked analytical strategy review action copy."]),
        ...(review.pairs.length > 0 ? [] : ["Expected strategy relationship review pairs."]),
        ...(review.pairs.every((pair) => pair.statusLabel === "Needs review")
          ? []
          : ["Expected strategy review status to show needs review."]),
        ...(blockedStrategy?.sql ? ["Blocked analytical strategy must not expose SQL."] : []),
        ...(review.noPersistence && review.noAcceptance && review.noSqlGeneration && review.noBackendCall && review.noRunQuery
          ? []
          : ["Strategy relationship review must not persist, accept, generate SQL, call backend, or run queries."]),
      ];
    },
  },
  {
    name: "T-16A relationship review shows deterministic candidate columns as suggestions only",
    assert: () => {
      const requiredRelationships = ["tenants to units", "tenants to access_codes"];
      const review = createSqlRelationshipReviewModel({
        dataset: reviewCandidateTenantAccessDataset,
        requiredRelationships,
      });

      return [
        ...(review.pairs.length === 2 ? [] : [`Expected two candidate review pairs, received ${review.pairs.length}.`]),
        ...(review.pairs.every((pair) => pair.status === "needs_confirmation" && pair.statusLabel === "Suggested match")
          ? []
          : ["Expected candidate relationships to require confirmation, not be accepted."]),
        ...(review.pairs.some(
          (pair) =>
            pair.fromTable === "tenants" &&
            pair.toTable === "units" &&
            pair.suggestedColumns?.fromColumn === "unit_id" &&
            pair.suggestedColumns.toColumn === "unit_id",
        )
          ? []
          : ["Expected possible match unit_id ↔ unit_id from deterministic candidate metadata."]),
        ...(review.pairs.some(
          (pair) =>
            pair.fromTable === "tenants" &&
            pair.toTable === "access_codes" &&
            pair.suggestedColumns?.fromColumn === "tenant_id" &&
            pair.suggestedColumns.toColumn === "tenant_id",
        )
          ? []
          : ["Expected possible match tenant_id ↔ tenant_id from deterministic candidate metadata."]),
        ...(review.pairs.some((pair) => pair.status === "accepted")
          ? ["Candidate-only review must not mark relationships accepted."]
          : []),
        ...(review.noPersistence && review.noAcceptance && review.noSqlGeneration && review.noBackendCall && review.noRunQuery
          ? []
          : ["Candidate relationship review must remain read-only."]),
      ];
    },
  },
  {
    name: "T-16A accepted relationship status is display-only and does not persist review changes",
    assert: () => {
      const review = createSqlRelationshipReviewModel({
        dataset: safeTenantAccessDataset,
        requiredRelationships: ["tenants to units", "tenants to access_codes"],
      });

      return [
        ...(review.pairs.every((pair) => pair.status === "accepted" && pair.statusLabel === "Confirmed")
          ? []
          : ["Expected already accepted relationships to display as confirmed."]),
        ...(review.noPersistence && review.noAcceptance && review.noSqlGeneration && review.noBackendCall && review.noRunQuery
          ? []
          : ["Accepted display state must not add persistence, acceptance, SQL, backend, or Run Query behavior."]),
      ];
    },
  },
  {
    name: "status-summary questions still rank status summaries high",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "How many orders are pending vs completed?",
        dataset: ordersStatusDataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const top = model.recommendations[0];

      return [
        ...(model.questionShape?.preferredOutputShape === "status_breakdown"
          ? []
          : [`Expected status_breakdown shape, received ${model.questionShape?.preferredOutputShape}.`]),
        ...(top && /status|category|count/i.test(`${top.title} ${top.description} ${top.sql}`)
          ? []
          : [`Expected status/category summary recommendation, received ${top?.title || "none"}.`]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "metric-by-dimension questions prefer aggregation-by-dimension",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Total revenue by product category.",
        dataset: productsDataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const top = model.recommendations[0];

      return [
        ...(model.questionShape?.preferredOutputShape === "metric_by_dimension"
          ? []
          : [`Expected metric_by_dimension shape, received ${model.questionShape?.preferredOutputShape}.`]),
        ...(top && /sum|total/i.test(`${top.title} ${top.description} ${top.sql}`)
          ? []
          : [`Expected sum/total aggregation top recommendation, received ${top?.title || "none"}.`]),
        ...(top?.title.toLowerCase().includes("status summary")
          ? ["Generic status summary must not be top for metric-by-dimension prompt."]
          : []),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "filtered-count questions identify filter terms",
    assert: () => {
      const shape = classifySqlBusinessQuestion({
        prompt: "How many customers are active?",
        dataset: ordersCustomersDataset,
      });

      return [
        ...(shape.preferredOutputShape === "filtered_count"
          ? []
          : [`Expected filtered_count shape, received ${shape.preferredOutputShape}.`]),
        ...(shape.filterTerms.includes("active") ? [] : ["Expected active filter term."]),
        ...(shape.hasCountIntent ? [] : ["Expected count intent."]),
      ];
    },
  },
  {
    name: "detail/list requests are not treated as status summaries",
    assert: () => {
      const shape = classifySqlBusinessQuestion({
        prompt: "List units without access codes.",
        dataset: missingTenantAccessDataset,
      });

      return [
        ...(shape.preferredOutputShape === "blocked_relationship_plan" || shape.preferredOutputShape === "detail_list"
          ? []
          : [`Expected detail/list or blocked relationship shape, received ${shape.preferredOutputShape}.`]),
        ...(shape.hasDetailIntent ? [] : ["Expected detail/list intent."]),
        ...(shape.preferredOutputShape === "status_breakdown"
          ? ["Detail/list request must not be classified as status breakdown."]
          : []),
      ];
    },
  },
  {
    name: "safe deterministic relationships can produce grouped-count output",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "How many tenants in every units have access codes",
        dataset: safeTenantAccessDataset,
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const top = model.recommendations[0];

      return [
        ...(model.questionShape?.preferredOutputShape === "grouped_count"
          ? []
          : [`Expected grouped_count shape, received ${model.questionShape?.preferredOutputShape}.`]),
        ...(model.questionShape?.relationshipDependent ? [] : ["Expected relationship-dependent classification."]),
        ...(top?.title === "Count tenants with access codes by unit"
          ? []
          : [`Expected safe grouped-count top suggestion, received ${top?.title || "none"}.`]),
        ...(model.blockedPlan === null ? [] : ["Safe relationships should not show blocked plan card."]),
        ...(top?.sql.includes("JOIN") && top.sql.includes("COUNT(DISTINCT")
          ? []
          : ["Expected safe grouped-count SQL to use accepted relationship joins."]),
        ...(top?.title.toLowerCase().includes("status summary")
          ? ["Generic status summary must not be top for the specific cross-entity question."]
          : []),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask recommendation exposes Insert into editor for deterministic SQL",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const insertState = model.recommendations[0]
        ? createSqlAskRecommendationInsertModel(model.recommendations[0])
        : null;

      return [
        ...(insertState ? [] : ["Expected an insertable recommendation fixture."]),
        ...(insertState?.buttonLabel === "Insert into editor"
          ? []
          : ["Expected Insert into editor button label."]),
        ...(insertState?.canInsert ? [] : ["Expected deterministic SQL recommendation to be insertable."]),
        ...(insertState?.sql ? [] : ["Expected insert state to expose SQL for insertion."]),
        ...(insertState ? expectNoInsertSideEffects(insertState) : []),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask insert uses existing append-safe metadata shape",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const recommendation = model.recommendations[0];
      if (!recommendation) return ["Expected recommendation fixture."];
      const insertState = createSqlAskRecommendationInsertModel(recommendation);
      const metadata = {
        id: recommendation.id,
        label: recommendation.title,
        createdFrom: recommendation.kind,
      };

      return [
        ...(insertState.canInsert ? [] : ["Expected insert state to allow existing insert path."]),
        ...(metadata.createdFrom === "template" || metadata.createdFrom === "report"
          ? []
          : ["Expected existing template/report insert metadata shape."]),
        ...(metadata.label === recommendation.title ? [] : ["Expected insert label to preserve recommendation title."]),
        ...(insertState.sql === recommendation.sql ? [] : ["Expected inserted SQL to come from recommendation SQL."]),
        ...expectNoInsertSideEffects(insertState),
      ];
    },
  },
  {
    name: "Ask keeps multiple recommendations visible for comparison",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });

      return [
        ...(model.recommendations.length > 1
          ? []
          : [`Expected multiple visible recommendations, received ${model.recommendations.length}.`]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask disables other recommendation inserts after one is inserted",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const selected = model.recommendations[0];
      const other = model.recommendations[1];
      if (!selected || !other) return ["Expected at least two recommendations."];
      const activeSqlDraft = selected.sql;
      const selectedState = createSqlAskRecommendationInsertModel(selected, {
        activeSqlDraft,
        insertedAskRecommendationId: selected.id,
      });
      const otherState = createSqlAskRecommendationInsertModel(other, {
        activeSqlDraft,
        insertedAskRecommendationId: selected.id,
      });

      return [
        ...(selectedState.isInsertedRecommendation
          ? []
          : ["Expected selected recommendation to be marked inserted."]),
        ...(selectedState.canInsert ? ["Inserted recommendation button should be disabled."] : []),
        ...(otherState.canInsert ? ["Other Ask recommendation insert should be disabled."] : []),
        ...(otherState.disabledReason === ASK_RECOMMENDATION_ALREADY_INSERTED_COPY
          ? []
          : ["Expected one-suggestion-already-inserted helper copy."]),
        ...expectNoInsertSideEffects(selectedState),
        ...expectNoInsertSideEffects(otherState),
      ];
    },
  },
  {
    name: "Ask does not append into pre-existing editor draft by default",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Count leases by status",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });
      const recommendation = model.recommendations[0];
      if (!recommendation) return ["Expected recommendation fixture."];
      const insertState = createSqlAskRecommendationInsertModel(recommendation, {
        activeSqlDraft: 'SELECT * FROM "leases";',
        insertedAskRecommendationId: null,
      });

      return [
        ...(insertState.canInsert ? ["Ask insert must be guarded when editor already has SQL."] : []),
        ...(insertState.disabledReason === ASK_RECOMMENDATION_ALREADY_INSERTED_COPY
          ? []
          : ["Expected clear/new-tab helper for pre-existing draft."]),
        ...expectNoInsertSideEffects(insertState),
      ];
    },
  },
  {
    name: "non-insertable Ask recommendation stays disabled with user-facing reason",
    assert: () => {
      const insertState = createSqlAskRecommendationInsertModel({ id: "empty", sql: "   " });

      return [
        ...(insertState.canInsert ? ["Expected empty SQL suggestion to be disabled."] : []),
        ...(insertState.sql === null ? [] : ["Disabled insert must not expose SQL."]),
        ...(insertState.disabledReason === "No safe SQL is available for this suggestion yet."
          ? []
          : ["Expected user-facing disabled insert reason."]),
        ...expectNoInsertSideEffects(insertState),
      ];
    },
  },
  {
    name: "Ask surfaces relevant worksheet guidance",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "Show manager email and phone contacts",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });

      return [
        ...(model.scopeRecommendations.some((recommendation) => recommendation.tableName === "managers")
          ? []
          : [`Expected managers worksheet guidance, received ${model.scopeRecommendations.map((item) => item.tableName).join(", ")}.`]),
        ...(model.guidanceCopy.includes("managers") || model.scopeRecommendations.length > 0
          ? []
          : ["Expected needed/relevant table guidance."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Ask with no safe suggestion uses friendly needs-details guidance",
    assert: () => {
      const model = createSqlAskFiltraQueriSuggestionModel({
        hasSubmittedAsk: true,
        prompt: "florbnicate the unknowable",
        dataset: dataset(),
        selectedDialect: "duckdb",
        appliedScopeSelections: [],
      });

      return [
        ...(model.recommendations.length === 0 ? [] : ["Expected no template suggestion."]),
        ...(model.scopeRecommendations.length === 0 ? [] : ["Expected no worksheet suggestion."]),
        ...(model.guidanceTitle === BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_TITLE
          ? []
          : ["Expected friendly needs-details guidance."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "Business SQL preview panel is hidden before Ask attempt",
    assert: () => {
      const model = createBusinessSqlPreviewVisibilityModel({
        hasPreviewAttempt: false,
        prompt: "Count leases by status",
        preview: failedPreview,
      });

      return [
        ...(model.shouldShowPanel ? ["Preview panel must stay hidden before Ask."] : []),
        ...(model.shouldShowDefaultPreviewPanel ? ["Default preview panel must stay hidden before Ask."] : []),
        ...(model.shouldShowAdvancedPlanningDetails ? ["Advanced details must stay hidden before Ask."] : []),
        ...(model.shouldShowIdleCopy ? [] : ["Expected quiet no-preview copy before Ask."]),
        ...(BUSINESS_SQL_PREVIEW_IDLE_COPY.includes("Ask FiltraQueri")
          ? []
          : ["Idle copy should direct the user to Ask FiltraQueri."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "non-ready Business SQL diagnostics are collapsed by default after Ask",
    assert: () => {
      const model = createBusinessSqlPreviewVisibilityModel({
        hasPreviewAttempt: true,
        prompt: "tickets per account",
        preview: failedPreview,
      });

      return [
        ...(model.shouldShowPanel ? [] : ["Expected preview content to remain available."]),
        ...(model.shouldShowDefaultPreviewPanel
          ? ["Non-ready Business SQL Preview must not show in default flow."]
          : []),
        ...(model.shouldShowAdvancedPlanningDetails
          ? []
          : ["Expected non-ready preview diagnostics behind advanced details."]),
        ...(model.advancedDetailsLabel === ADVANCED_PLANNING_DETAILS_LABEL
          ? []
          : ["Expected Advanced planning details disclosure label."]),
        ...(model.advancedDetailsCopy === ADVANCED_PLANNING_DETAILS_COPY
          ? []
          : ["Expected quiet advanced planning note."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "failed preview attempt shows user-facing guidance without technical reasons",
    assert: () => {
      const model = createBusinessSqlPreviewVisibilityModel({
        hasPreviewAttempt: true,
        prompt: "tickets per account",
        preview: failedPreview,
      });

      return [
        ...(model.shouldShowPanel ? [] : ["Expected preview panel after Ask attempt."]),
        ...(model.shouldShowDefaultPreviewPanel
          ? ["Failed preview must not show as default Business SQL Preview panel."]
          : []),
        ...(model.shouldShowAdvancedPlanningDetails
          ? []
          : ["Failed preview diagnostics should be available in collapsed details."]),
        ...(model.failureTitle === BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_TITLE
          ? []
          : ["Expected user-facing failure title."]),
        ...(model.failureHelper === BUSINESS_SQL_PREVIEW_NEEDS_DETAILS_HELPER
          ? []
          : ["Expected user-facing failure helper."]),
        ...(model.shouldShowTechnicalReasons
          ? ["Technical planner reasons must not be shown prominently."]
          : []),
        ...(model.failureTitle?.includes("Plan support must be supported")
          ? ["Failure title must not expose raw planner wording."]
          : []),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
  {
    name: "ready preview attempt shows panel without failure copy",
    assert: () => {
      const model = createBusinessSqlPreviewVisibilityModel({
        hasPreviewAttempt: true,
        prompt: "Count leases by status",
        preview: readyPreview,
      });

      return [
        ...(model.shouldShowPanel ? [] : ["Expected ready preview panel after Ask."]),
        ...(model.shouldShowDefaultPreviewPanel ? [] : ["Ready preview should stay visible by default."]),
        ...(model.shouldShowAdvancedPlanningDetails ? ["Ready preview must not require advanced details."] : []),
        ...(model.failureTitle === null ? [] : ["Ready preview must not show failure title."]),
        ...(model.failureHelper === null ? [] : ["Ready preview must not show failure helper."]),
        ...expectNoBehaviorChange(model),
      ];
    },
  },
];

export function runSqlAskFiltraQueriAdapterFixtures(): SqlAskFiltraQueriAdapterFixtureReport {
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

export const allSqlAskFiltraQueriAdapterFixturesPass = (): boolean =>
  runSqlAskFiltraQueriAdapterFixtures().failed.length === 0;
