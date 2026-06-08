/**
 * T-11C-4 — SQL template recommender grounding integration fixtures.
 *
 * The project does not currently include a test runner, so this file exports
 * fixtures and a pure runner that can be imported by a future runner or dev
 * console. The runner performs no I/O and never exits the process.
 */

import type { DatasetMetadata, SchemaColumn } from "../../../dataset/datasetTypes";
import type { WorkbookMetadata, WorksheetMetadata } from "../../../workbook";
import type { ReportOpportunity } from "../reportIntelligencePlanner";
import type { SqlReportRecipe } from "../sqlReportRecipes";
import type { SqlAssistantTemplate } from "../sqlTemplateLibrary";
import { recommendSqlTemplates, type SqlTemplateRecommendation } from "../sqlTemplateRecommender";

type RecommenderFixtureResult = {
  name: string;
  ok: boolean;
  failureReasons: string[];
};

export type RecommenderFixtureReport = {
  results: RecommenderFixtureResult[];
  passed: RecommenderFixtureResult[];
  failed: RecommenderFixtureResult[];
};

const schemaColumn = (name: string): SchemaColumn => ({
  name,
  type: "VARCHAR",
  inferred_type: "text",
  null_count: 0,
  unique_count: 1,
  sample_values: [],
});

const worksheet = (
  worksheetId: string,
  displayName: string,
  tableName: string,
  columns: string[],
): WorksheetMetadata => ({
  worksheetId,
  workbookId: "workbook:property",
  sheetName: displayName,
  displayName,
  tableName,
  originalIndex: 0,
  status: "ready",
  schema: columns.map(schemaColumn),
  rowCount: 10,
  columnCount: columns.length,
  visibleColumns: columns,
  hiddenColumns: [],
  normalization: {
    version: 1,
    normalizedAt: "2026-01-01T00:00:00.000Z",
    headerRowIndex: 0,
    skippedLeadingRows: 0,
    headerDetectionStrategy: "fixture",
    headerDetectionConfidence: "high",
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

const worksheets = [
  worksheet("worksheet:properties", "properties", "properties", ["property_id", "property_name"]),
  worksheet("worksheet:units", "units", "units", ["unit_id", "property_id", "tenant_id"]),
  worksheet("worksheet:leases", "leases", "leases", ["lease_id", "tenant_id", "unit_id", "lease_end_date"]),
  worksheet("worksheet:tenants", "tenants", "tenants", ["tenant_id", "tenant_name"]),
];

const workbookMetadata: WorkbookMetadata = {
  workbookId: "workbook:property",
  workspaceId: null,
  name: "Property workbook",
  status: "ready",
  sourceFile: {
    originalFilename: "property.xlsx",
    storedPath: null,
    mimeType: null,
    byteSize: null,
    uploadedAt: "2026-01-01T00:00:00.000Z",
  },
  worksheetIds: worksheets.map((sheet) => sheet.worksheetId),
  activeWorksheetId: "worksheet:leases",
  activeAnalysisSource: null,
  cleanedWorkingCopies: [],
  worksheets,
  tableMappings: worksheets.map((sheet) => ({
    sheetName: sheet.sheetName,
    tableName: sheet.tableName,
    originalIndex: sheet.originalIndex,
  })),
  relationshipCandidates: [],
  acceptedRelationshipContracts: [],
  ingestionProfile: {
    maxWorksheets: 10,
    maxRowsPerWorksheetProfile: 1000,
    maxColumnsPerWorksheet: 100,
    maxRelationshipSampleRows: 100,
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
};

const dataset: DatasetMetadata = {
  dataset_id: "dataset:property",
  filename: "property.xlsx",
  original_filename: "property.xlsx",
  table_name: "leases",
  uploaded_at: "2026-01-01T00:00:00.000Z",
  row_count: 10,
  column_count: 4,
  schema: worksheets[2].schema,
  workbook_metadata: workbookMetadata,
};

const baseRecipe = (overrides: Partial<SqlReportRecipe>): SqlReportRecipe => ({
  id: "category-summary",
  title: "Count units by property",
  businessPurpose: "Find the number of units in each property.",
  requiredFieldRoles: ["units.unit_id", "units.property_id"],
  sqlPatterns: ["COUNT", "GROUP BY"],
  dialectSupportNote: "DuckDB SQL",
  supportSummary: "Ready to generate SQL.",
  sql: 'SELECT "property_id", COUNT(*) AS unit_count FROM "units" GROUP BY "property_id";',
  warnings: [],
  missingRequirements: [],
  worksheetsUsed: ["units"],
  ...overrides,
});

const expirationRecipe = baseRecipe({
  id: "lease-expiration-watchlist",
  title: "Lease expiration / move-out watchlist",
  businessPurpose: "Lists leases expiring soon along with move-out dates.",
  requiredFieldRoles: ["leases.lease_id", "leases.tenant_id", "leases.lease_end_date", "tenants.tenant_id"],
  sqlPatterns: ["DATE_DIFF", "WHERE", "ORDER BY"],
  sql: 'SELECT "lease_id", "lease_end_date" FROM "leases" WHERE "lease_end_date" >= CURRENT_DATE;',
  worksheetsUsed: ["leases", "tenants"],
});

const renewalRecipe = baseRecipe({
  id: "date-trend",
  title: "Lease renewal candidates",
  businessPurpose: "Find leases that may need renewal outreach.",
  requiredFieldRoles: ["leases.lease_id", "leases.lease_end_date"],
  sqlPatterns: ["WHERE", "DATE"],
  sql: 'SELECT "lease_id" FROM "leases";',
  worksheetsUsed: ["leases"],
});

const unsupportedRecipe = baseRecipe({
  id: "rent-payment-summary",
  title: "Payment risk summary",
  businessPurpose: "Find expiring leases with payment context.",
  requiredFieldRoles: ["payments.payment_id"],
  sqlPatterns: ["JOIN"],
  sql: 'SELECT "payment_id" FROM "payments";',
  worksheetsUsed: ["payments"],
});

const needsReviewOpportunity: ReportOpportunity = {
  id: "opportunity:tenant-lookup",
  title: "Tenant lease lookup",
  businessQuestion: "Show tenant records for leases.",
  whyItMatters: "Helps inspect lease-to-tenant assignments.",
  domains: ["property"],
  confidence: 0.9,
  support: "can_generate_now",
  method: "sql",
  complexity: "intermediate",
  needsJoins: true,
  needsAggregation: false,
  needsDateLogic: false,
  needsAnomalyDetection: false,
  requiredTables: ["leases", "tenants"],
  optionalTables: [],
  requiredColumns: ["tenant_id"],
  optionalColumns: [],
  missingRequirements: [],
  sql: 'SELECT "tenant_id" FROM "leases";',
};

const placeholderTemplate: SqlAssistantTemplate = {
  id: "generic-join",
  title: "Generic join",
  category: "Joins",
  explanation: "Join another table to inspect related rows.",
  dialectLabel: "DuckDB",
  sql: 'SELECT * FROM "leases" JOIN other_table ON "leases"."id" = other_table."id";',
};

const activeScopeLabels = ["properties", "units", "leases", "tenants"];

const expect = (
  name: string,
  condition: boolean,
  failureReason: string,
): RecommenderFixtureResult => ({
  name,
  ok: condition,
  failureReasons: condition ? [] : [failureReason],
});

const hasLegacyShape = (recommendation: SqlTemplateRecommendation): boolean =>
  typeof recommendation.id === "string" &&
  (recommendation.kind === "template" || recommendation.kind === "report") &&
  typeof recommendation.title === "string" &&
  typeof recommendation.description === "string" &&
  typeof recommendation.sql === "string" &&
  typeof recommendation.score === "number" &&
  Array.isArray(recommendation.reasons);

export function runSqlTemplateRecommenderFixtures(): RecommenderFixtureReport {
  const countPromptRecommendations = recommendSqlTemplates({
    taskPrompt: "find the number of units in properties that are leased to tenants",
    dataset,
    appliedScopeLabels: activeScopeLabels,
    templates: [],
    recipes: [baseRecipe({}), expirationRecipe, renewalRecipe],
    opportunities: [],
  });

  const expirationRecommendations = recommendSqlTemplates({
    taskPrompt: "show leases expiring in the next 90 days",
    dataset,
    appliedScopeLabels: activeScopeLabels,
    templates: [],
    recipes: [expirationRecipe],
    opportunities: [],
  });

  const unsupportedFilteredRecommendations = recommendSqlTemplates({
    taskPrompt: "show leases expiring in the next 90 days",
    dataset,
    appliedScopeLabels: ["leases"],
    templates: [placeholderTemplate],
    recipes: [expirationRecipe, unsupportedRecipe],
    opportunities: [],
  });

  const needsReviewRecommendations = recommendSqlTemplates({
    taskPrompt: "show tenant records for leases",
    dataset,
    appliedScopeLabels: ["leases", "tenants"],
    templates: [],
    recipes: [],
    opportunities: [needsReviewOpportunity],
  });

  const shapeRecommendation = countPromptRecommendations[0];

  const bannedCountTitles = countPromptRecommendations.filter((recommendation) =>
    /expiration|renewal|move[- ]?out|watchlist/i.test(recommendation.title),
  );

  const results: RecommenderFixtureResult[] = [
    expect(
      "count/grouping prompt does not return expiration, renewal, or move-out watchlist candidates",
      countPromptRecommendations.length > 0 && bannedCountTitles.length === 0,
      `Expected count/grouping recommendations to exclude expiration-family titles, got: ${countPromptRecommendations.map((recommendation) => recommendation.title).join(", ")}`,
    ),
    expect(
      "expiration prompt can return lease expiration candidate when fields and scope are compatible",
      expirationRecommendations.some(
        (recommendation) =>
          recommendation.id === "lease-expiration-watchlist" &&
          recommendation.support === "supported",
      ),
      `Expected compatible expiration prompt to return supported lease expiration candidate, got: ${expirationRecommendations.map((recommendation) => `${recommendation.id}:${recommendation.support}`).join(", ")}`,
    ),
    expect(
      "unsupported candidates are filtered out",
      unsupportedFilteredRecommendations.every(
        (recommendation) =>
          recommendation.id !== "generic-join" &&
          recommendation.id !== "rent-payment-summary" &&
          recommendation.support !== "unsupported",
      ),
      `Expected unsupported candidates to be filtered, got: ${unsupportedFilteredRecommendations.map((recommendation) => `${recommendation.id}:${recommendation.support}`).join(", ")}`,
    ),
    expect(
      "needs_review candidate can be returned with warning",
      needsReviewRecommendations.some(
        (recommendation) =>
          recommendation.id === "opportunity:tenant-lookup" &&
          recommendation.support === "needs_review" &&
          recommendation.warnings?.some((warning) => warning.includes("tenant_id")),
      ),
      `Expected needs_review tenant lookup with warning, got: ${needsReviewRecommendations.map((recommendation) => `${recommendation.id}:${recommendation.support}:${recommendation.warnings?.join("|") || ""}`).join(", ")}`,
    ),
    expect(
      "recommendSqlTemplates return shape still includes legacy required fields",
      Boolean(shapeRecommendation && hasLegacyShape(shapeRecommendation)),
      "Expected first recommendation to include id, kind, title, description, sql, score, and reasons.",
    ),
    expect(
      "returned support states are supported or needs_review only",
      [
        ...countPromptRecommendations,
        ...expirationRecommendations,
        ...unsupportedFilteredRecommendations,
        ...needsReviewRecommendations,
      ].every(
        (recommendation) =>
          recommendation.support === "supported" || recommendation.support === "needs_review",
      ),
      "Expected recommender results to exclude unsupported support states.",
    ),
  ];

  return {
    results,
    passed: results.filter((result) => result.ok),
    failed: results.filter((result) => !result.ok),
  };
}

export function allSqlTemplateRecommenderFixturesPass(): boolean {
  return runSqlTemplateRecommenderFixtures().failed.length === 0;
}
