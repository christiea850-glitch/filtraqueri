import type { ReportOpportunityDomain } from "../sql/reportIntelligencePlanner";
import type {
  AIColumnSummary,
  AIDeterministicReportOpportunitySummary,
  AIMetadataContextPayload,
  AIWorksheetTableSummary,
} from "./llmGovernanceTypes";
import type {
  AIGovernedSuggestionReadiness,
  AISuggestionConfidenceLevel,
} from "./llmSuggestionContract";

export type MockAIMetadataSuggestionCandidate = {
  id: string;
  title: string;
  businessQuestion: string;
  whyItMatters: string;
  domains: ReportOpportunityDomain[];
  category: string;
  requiredTables: string[];
  requiredWorksheets: string[];
  requiredColumns: string[];
  missingRequirements: string[];
  assumptions: string[];
  confidenceLevel: AISuggestionConfidenceLevel;
  readiness: AIGovernedSuggestionReadiness;
  provenance: {
    source: "mock_metadata_generator";
  };
  sqlDraftIncluded: false;
  sqlDraftStatus: "not_requested";
};

type ColumnMatch = {
  table: AIWorksheetTableSummary;
  column: AIColumnSummary;
};

const MAX_MOCK_SUGGESTIONS = 8;

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (value: string, terms: string[]) =>
  terms.some((term) => value.includes(term));

const unique = (values: string[]): string[] =>
  Array.from(new Set(values.filter(Boolean)));

const candidateId = (prefix: string, parts: string[]) =>
  `mock-${prefix}-${parts.map((part) => normalizeText(part).replace(/\s+/g, "-")).filter(Boolean).join("-") || "metadata"}`;

const confidenceFromSupport = (
  requiredColumns: string[],
  relationshipSupported: boolean,
): AISuggestionConfidenceLevel => {
  if (relationshipSupported || requiredColumns.length >= 3) return "High";
  if (requiredColumns.length >= 2) return "Medium";
  return "Low";
};

const findColumns = (
  payload: AIMetadataContextPayload,
  terms: string[],
): ColumnMatch[] =>
  payload.worksheets.flatMap((table) =>
    table.columns
      .filter((column) => includesAny(normalizeText(column.name), terms))
      .map((column) => ({ table, column })),
  );

const firstColumnName = (matches: ColumnMatch[]): string | null =>
  matches[0]?.column.name || null;

const firstTable = (matches: ColumnMatch[]): AIWorksheetTableSummary | null =>
  matches[0]?.table || null;

const buildBaseCandidate = ({
  id,
  title,
  businessQuestion,
  whyItMatters,
  domains,
  category,
  requiredTables,
  requiredWorksheets,
  requiredColumns,
  assumptions,
  confidenceLevel,
}: Omit<MockAIMetadataSuggestionCandidate, "missingRequirements" | "provenance" | "readiness" | "sqlDraftIncluded" | "sqlDraftStatus">): MockAIMetadataSuggestionCandidate => ({
  id,
  title,
  businessQuestion,
  whyItMatters,
  domains,
  category,
  requiredTables: unique(requiredTables),
  requiredWorksheets: unique(requiredWorksheets),
  requiredColumns: unique(requiredColumns),
  missingRequirements: [],
  assumptions,
  confidenceLevel,
  readiness: "can_generate_now",
  provenance: {
    source: "mock_metadata_generator",
  },
  sqlDraftIncluded: false,
  sqlDraftStatus: "not_requested",
});

const candidateFromDeterministicReport = (
  report: AIDeterministicReportOpportunitySummary,
): MockAIMetadataSuggestionCandidate =>
  buildBaseCandidate({
    id: candidateId("k10", [report.id]),
    title: report.title,
    businessQuestion: report.businessQuestion,
    whyItMatters: report.whyItMatters,
    domains: report.domains.length > 0 ? report.domains : ["generic"],
    category: report.method,
    requiredTables: report.requiredTables,
    requiredWorksheets: [],
    requiredColumns: report.requiredColumns,
    assumptions: [
      "Generated locally from deterministic report metadata; no raw rows or SQL drafts are included.",
      ...report.missingRequirements.slice(0, 3),
    ],
    confidenceLevel: report.confidenceLevel,
  });

const createPropertySuggestions = (
  payload: AIMetadataContextPayload,
): MockAIMetadataSuggestionCandidate[] => {
  const tenants = findColumns(payload, ["tenant", "resident", "renter"]);
  const payments = findColumns(payload, ["payment", "rent", "amount", "balance", "charge", "invoice"]);
  const leases = findColumns(payload, ["lease", "move in", "move out", "start date", "end date"]);
  const maintenance = findColumns(payload, ["maintenance", "work order", "repair", "request"]);
  const status = findColumns(payload, ["status", "state"]);
  const date = findColumns(payload, ["date", "month", "year"]);
  const suggestions: MockAIMetadataSuggestionCandidate[] = [];
  const paymentTable = firstTable(payments);
  const tenantTable = firstTable(tenants);
  const leaseTable = firstTable(leases);
  const maintenanceTable = firstTable(maintenance);
  const hasRelationship = payload.relationships.length > 0;

  if (paymentTable && (firstColumnName(payments) || firstColumnName(date))) {
    suggestions.push(buildBaseCandidate({
      id: candidateId("property-payments", [paymentTable.trustedTableName]),
      title: "Rent payment trend review",
      businessQuestion: "How are rent payments, balances, or charges trending across the workbook?",
      whyItMatters: "Payment trends can surface collection risk, operational follow-up needs, and revenue timing patterns.",
      domains: ["property", "payments", "finance"],
      category: "payment_trend",
      requiredTables: [paymentTable.trustedTableName],
      requiredWorksheets: [paymentTable.worksheetName],
      requiredColumns: [firstColumnName(payments), firstColumnName(date)].filter((value): value is string => Boolean(value)),
      assumptions: ["Uses only column metadata to infer payment-oriented reporting potential."],
      confidenceLevel: confidenceFromSupport([firstColumnName(payments), firstColumnName(date)].filter((value): value is string => Boolean(value)), hasRelationship),
    }));
  }

  if (tenantTable && leaseTable) {
    suggestions.push(buildBaseCandidate({
      id: candidateId("property-lease-tenant", [tenantTable.trustedTableName, leaseTable.trustedTableName]),
      title: "Tenant and lease status overview",
      businessQuestion: "Which tenant or lease records appear ready for occupancy, renewal, or status review?",
      whyItMatters: "Lease and tenant metadata can support a review workflow for occupancy and renewal planning.",
      domains: ["property", "operations"],
      category: "tenant_lease_status",
      requiredTables: unique([tenantTable.trustedTableName, leaseTable.trustedTableName]),
      requiredWorksheets: unique([tenantTable.worksheetName, leaseTable.worksheetName]),
      requiredColumns: [firstColumnName(tenants), firstColumnName(leases), firstColumnName(status)].filter((value): value is string => Boolean(value)),
      assumptions: ["Relationship candidates, if present, should be reviewed before any future SQL draft is accepted."],
      confidenceLevel: hasRelationship ? "High" : "Medium",
    }));
  }

  if (maintenanceTable) {
    suggestions.push(buildBaseCandidate({
      id: candidateId("property-maintenance", [maintenanceTable.trustedTableName]),
      title: "Maintenance workload summary",
      businessQuestion: "What maintenance or repair fields can support workload and status reporting?",
      whyItMatters: "Maintenance metadata can identify operational backlogs, status tracking opportunities, and service patterns.",
      domains: ["property", "operations", "support"],
      category: "maintenance_workload",
      requiredTables: [maintenanceTable.trustedTableName],
      requiredWorksheets: [maintenanceTable.worksheetName],
      requiredColumns: [firstColumnName(maintenance), firstColumnName(status), firstColumnName(date)].filter((value): value is string => Boolean(value)),
      assumptions: ["Generated from worksheet and column names only; no maintenance descriptions or raw records are inspected."],
      confidenceLevel: "Medium",
    }));
  }

  return suggestions;
};

const createRelationshipSuggestions = (
  payload: AIMetadataContextPayload,
): MockAIMetadataSuggestionCandidate[] =>
  payload.relationships.slice(0, 3).map((relationship) =>
    buildBaseCandidate({
      id: candidateId("relationship", [relationship.sourceTable, relationship.targetTable]),
      title: `${relationship.sourceWorksheetName} to ${relationship.targetWorksheetName} join readiness review`,
      businessQuestion: `Can ${relationship.sourceWorksheetName} and ${relationship.targetWorksheetName} support a joined report?`,
      whyItMatters: "Trusted relationship metadata can support future joined analysis once governance review is complete.",
      domains: ["operations", "generic"],
      category: "relationship_readiness",
      requiredTables: [relationship.sourceTable, relationship.targetTable],
      requiredWorksheets: [relationship.sourceWorksheetName, relationship.targetWorksheetName],
      requiredColumns: [relationship.sourceColumn, relationship.targetColumn],
      assumptions: [
        `Relationship confidence is ${relationship.confidenceLabel}; future SQL should still be validated before insertion.`,
      ],
      confidenceLevel: relationship.confidenceLabel === "high" ? "High" : relationship.confidenceLabel === "medium" ? "Medium" : "Low",
    }),
  );

const createSingleTableSuggestions = (
  payload: AIMetadataContextPayload,
): MockAIMetadataSuggestionCandidate[] => {
  if (payload.worksheets.length !== 1) return [];
  const table = payload.worksheets[0];
  const numericColumns = table.columns.filter((column) => column.inferredType === "numeric");
  const dateColumns = table.columns.filter((column) => column.inferredType === "date" || includesAny(normalizeText(column.name), ["date", "month", "year"]));
  const dimensionColumns = table.columns.filter((column) =>
    column.inferredType === "text" ||
    column.inferredType === "boolean" ||
    includesAny(normalizeText(column.name), ["category", "status", "type", "region", "segment"]),
  );
  const suggestions: MockAIMetadataSuggestionCandidate[] = [];

  if (numericColumns.length > 0 && (dimensionColumns.length > 0 || dateColumns.length > 0)) {
    suggestions.push(buildBaseCandidate({
      id: candidateId("single-table-summary", [table.trustedTableName]),
      title: `${table.displayName} metric summary`,
      businessQuestion: `Which ${table.displayName} fields can support metric summaries by available dimensions?`,
      whyItMatters: "A metadata-guided metric summary can identify useful business slices before any SQL draft is generated.",
      domains: ["generic"],
      category: "metric_summary",
      requiredTables: [table.trustedTableName],
      requiredWorksheets: [table.worksheetName],
      requiredColumns: [
        numericColumns[0]?.name,
        dimensionColumns[0]?.name,
        dateColumns[0]?.name,
      ].filter((value): value is string => Boolean(value)),
      assumptions: [`Table has ${table.rowCount} rows and ${table.columnCount} columns in metadata.`],
      confidenceLevel: numericColumns.length >= 2 ? "High" : "Medium",
    }));
  }

  if (dateColumns.length > 0) {
    suggestions.push(buildBaseCandidate({
      id: candidateId("single-table-date", [table.trustedTableName]),
      title: `${table.displayName} time-based review`,
      businessQuestion: `What time-based reporting can ${table.displayName} support?`,
      whyItMatters: "Date metadata can support trend, recency, and period comparison planning without exposing raw values.",
      domains: ["operations", "generic"],
      category: "time_review",
      requiredTables: [table.trustedTableName],
      requiredWorksheets: [table.worksheetName],
      requiredColumns: [dateColumns[0].name, numericColumns[0]?.name].filter((value): value is string => Boolean(value)),
      assumptions: ["Generated from date-like metadata only; no date values or samples are inspected."],
      confidenceLevel: numericColumns.length > 0 ? "Medium" : "Low",
    }));
  }

  return suggestions;
};

const createGenericWorkbookSuggestions = (
  payload: AIMetadataContextPayload,
): MockAIMetadataSuggestionCandidate[] => {
  const supportedTables = payload.worksheets.filter((worksheet) => worksheet.columns.length > 0);
  return supportedTables.slice(0, 2).map((table) => {
    const safeColumns = table.columns.filter((column) => column.sensitivity.level === "safe");
    const reviewColumns = table.columns.filter((column) => column.sensitivity.level !== "restricted");
    const columns = (safeColumns.length > 0 ? safeColumns : reviewColumns).slice(0, 3).map((column) => column.name);
    return buildBaseCandidate({
      id: candidateId("generic", [table.trustedTableName]),
      title: `${table.displayName} metadata readiness review`,
      businessQuestion: `Which governed reports could ${table.displayName} support based on available metadata?`,
      whyItMatters: "A conservative metadata review can identify feasible analysis paths before any AI SQL drafting is allowed.",
      domains: ["generic"],
      category: "metadata_readiness",
      requiredTables: [table.trustedTableName],
      requiredWorksheets: [table.worksheetName],
      requiredColumns: columns,
      assumptions: [
        "Generated locally from trusted metadata only.",
        "Restricted columns are expected to block downstream SQL draft eligibility.",
      ],
      confidenceLevel: columns.length >= 2 ? "Medium" : "Low",
    });
  });
};

export const createMockAISuggestionCandidatesFromMetadata = (
  payload: AIMetadataContextPayload,
): MockAIMetadataSuggestionCandidate[] => {
  const deterministic = payload.deterministicReports
    .filter((report) => !report.draftSqlIncluded)
    .slice(0, 4)
    .map(candidateFromDeterministicReport);
  const metadataText = normalizeText([
    payload.dataset?.datasetName,
    payload.dataset?.originalFilename,
    ...payload.worksheets.flatMap((worksheet) => [
      worksheet.worksheetName,
      worksheet.displayName,
      worksheet.trustedTableName,
      ...worksheet.columns.map((column) => column.name),
    ]),
  ].filter(Boolean).join(" "));
  const property = includesAny(metadataText, ["tenant", "lease", "rent", "property", "maintenance", "resident", "payment"])
    ? createPropertySuggestions(payload)
    : [];
  const relationships = createRelationshipSuggestions(payload);
  const singleTable = createSingleTableSuggestions(payload);
  const generic = createGenericWorkbookSuggestions(payload);
  const byId = new Map<string, MockAIMetadataSuggestionCandidate>();

  [...deterministic, ...property, ...relationships, ...singleTable, ...generic].forEach((candidate) => {
    if (byId.size < MAX_MOCK_SUGGESTIONS && !byId.has(candidate.id)) {
      byId.set(candidate.id, candidate);
    }
  });

  return Array.from(byId.values());
};
