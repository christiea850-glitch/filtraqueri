import type { SchemaColumn } from "../../dataset/datasetTypes";
import type { AcceptedRelationshipContract } from "../../workbook";

export type SemanticColumnRole =
  | "identifier"
  | "foreign_key"
  | "date"
  | "status"
  | "amount"
  | "quantity"
  | "countable_entity"
  | "name"
  | "category"
  | "description"
  | "email"
  | "phone"
  | "address"
  | "location"
  | "boolean_flag"
  | "metric_candidate"
  | "grouping_candidate"
  | "filter_candidate"
  | "unknown";

export type SemanticHintConfidence = "high" | "medium" | "low";

export type SemanticColumnHint = {
  id: string;
  tableName: string;
  worksheetId: string | null;
  columnName: string;
  inferredType: SchemaColumn["inferred_type"];
  primaryRole: SemanticColumnRole;
  roles: SemanticColumnRole[];
  confidence: SemanticHintConfidence;
  reasons: string[];
};

export type SemanticTableHint = {
  id: string;
  tableName: string;
  worksheetId: string | null;
  displayName: string | null;
  columns: SemanticColumnHint[];
  roleCounts: Partial<Record<SemanticColumnRole, number>>;
};

export type SemanticHintRegistryInputTable = {
  worksheetId?: string | null;
  displayName?: string | null;
  sheetName?: string | null;
  tableName: string;
  schema: readonly Pick<SchemaColumn, "name" | "type" | "inferred_type" | "null_count" | "unique_count">[];
};

export type SemanticHintRegistryInput = {
  tables: readonly SemanticHintRegistryInputTable[];
  acceptedRelationshipContracts?: readonly AcceptedRelationshipContract[];
};

export type SemanticHintRegistryResult = {
  registryVersion: "semantic-hints:v1";
  tables: SemanticTableHint[];
  columns: SemanticColumnHint[];
  summary: string;
};

type RoleEvidence = {
  role: SemanticColumnRole;
  confidence: SemanticHintConfidence;
  reason: string;
};

const ROLE_PRIORITY: SemanticColumnRole[] = [
  "identifier",
  "foreign_key",
  "date",
  "status",
  "amount",
  "quantity",
  "name",
  "category",
  "description",
  "email",
  "phone",
  "address",
  "location",
  "boolean_flag",
  "metric_candidate",
  "grouping_candidate",
  "filter_candidate",
  "countable_entity",
  "unknown",
];

const CONFIDENCE_SCORE: Record<SemanticHintConfidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const compactId = (value: string): string =>
  normalize(value).replace(/\s+/g, "-") || "unknown";

const singularize = (value: string): string => {
  const normalized = normalize(value);
  if (normalized.endsWith("ies")) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith("ses")) return normalized.slice(0, -2);
  if (normalized.endsWith("s") && normalized.length > 3) return normalized.slice(0, -1);
  return normalized;
};

const hasAny = (text: string, terms: readonly string[]): boolean =>
  terms.some((term) => text.includes(term));

const addEvidence = (
  evidence: RoleEvidence[],
  role: SemanticColumnRole,
  confidence: SemanticHintConfidence,
  reason: string,
) => {
  evidence.push({ role, confidence, reason });
};

const relationshipColumnKeys = (
  contracts: readonly AcceptedRelationshipContract[],
): Set<string> => {
  const keys = new Set<string>();
  for (const contract of contracts) {
    keys.add(`${normalize(contract.sourceTableName)}:${normalize(contract.sourceColumnName)}`);
    keys.add(`${normalize(contract.targetTableName)}:${normalize(contract.targetColumnName)}`);
  }
  return keys;
};

const inferColumnEvidence = ({
  tableName,
  column,
  relationshipKeys,
}: {
  tableName: string;
  column: Pick<SchemaColumn, "name" | "inferred_type">;
  relationshipKeys: ReadonlySet<string>;
}): RoleEvidence[] => {
  const evidence: RoleEvidence[] = [];
  const columnText = normalize(column.name);
  const compactColumn = columnText.replace(/\s+/g, "_");
  const tableStem = singularize(tableName);
  const relationshipKey = `${normalize(tableName)}:${columnText}`;

  if (columnText === "id" || columnText === `${tableStem} id`) {
    addEvidence(evidence, "identifier", "high", "Column name identifies the table entity.");
    addEvidence(evidence, "countable_entity", "medium", "Identifiers are safe countable entity candidates.");
  } else if (columnText.endsWith(" id")) {
    addEvidence(evidence, "foreign_key", "high", "Column name follows a foreign-key id pattern.");
    addEvidence(evidence, "identifier", "medium", "ID-like column can identify related records.");
  }

  if (relationshipKeys.has(relationshipKey)) {
    addEvidence(evidence, "foreign_key", "high", "Accepted relationship metadata references this column.");
  }

  if (
    column.inferred_type === "date" ||
    hasAny(columnText, [
      "date",
      "created at",
      "updated at",
      "visit date",
      "invoice date",
      "payment date",
      "end date",
      "start date",
      "closed at",
      "resolved at",
      "expires",
      "expired",
    ])
  ) {
    addEvidence(evidence, "date", column.inferred_type === "date" ? "high" : "medium", "Column name or inferred type indicates date/time semantics.");
    addEvidence(evidence, "filter_candidate", "medium", "Date columns can support time-window filters.");
  }

  if (
    column.inferred_type === "categorical" &&
    hasAny(columnText, ["status", "state", "active", "inactive", "resolved", "closed", "overdue"])
  ) {
    addEvidence(evidence, "status", "high", "Categorical column name indicates status semantics.");
    addEvidence(evidence, "filter_candidate", "high", "Status columns are filter candidates.");
  } else if (hasAny(columnText, ["status", "state", "active", "inactive", "resolved", "closed", "overdue"])) {
    addEvidence(evidence, "status", "medium", "Column name indicates status semantics.");
    addEvidence(evidence, "filter_candidate", "medium", "Status-like columns can support filters.");
  }

  if (hasAny(columnText, ["amount", "revenue", "price", "cost", "payment", "balance", "total"])) {
    addEvidence(evidence, "amount", "high", "Column name indicates monetary or total amount semantics.");
    addEvidence(evidence, "metric_candidate", "high", "Amount columns are metric candidates.");
  }

  if (hasAny(columnText, ["quantity", "qty", "stock", "inventory", "units total", "unit total"])) {
    addEvidence(evidence, "quantity", "high", "Column name indicates quantity or inventory semantics.");
    addEvidence(evidence, "metric_candidate", "high", "Quantity columns are metric candidates.");
  }

  if (column.inferred_type === "numeric" && evidence.length === 0) {
    addEvidence(evidence, "metric_candidate", "low", "Numeric inferred type may be a metric candidate.");
  }

  if (columnText === "name" || columnText.endsWith(" name") || hasAny(columnText, ["full name"])) {
    addEvidence(evidence, "name", "high", "Column name indicates display-name semantics.");
    addEvidence(evidence, "grouping_candidate", "medium", "Name columns can support grouping or labeling.");
  }

  if (hasAny(columnText, ["category", "type", "department", "region", "provider", "account"])) {
    addEvidence(evidence, "category", "high", "Column name indicates category/grouping semantics.");
    addEvidence(evidence, "grouping_candidate", "high", "Categorical business columns are grouping candidates.");
  }

  if (hasAny(columnText, ["description", "notes", "comment", "summary"])) {
    addEvidence(evidence, "description", "high", "Column name indicates descriptive text.");
  }

  if (hasAny(columnText, ["email", "e mail"])) {
    addEvidence(evidence, "email", "high", "Column name indicates email/contact semantics.");
  }

  if (hasAny(columnText, ["phone", "mobile", "telephone"])) {
    addEvidence(evidence, "phone", "high", "Column name indicates phone/contact semantics.");
  }

  if (hasAny(columnText, ["address", "street", "city", "zip", "postal", "property address"])) {
    addEvidence(evidence, "address", "high", "Column name indicates address semantics.");
    addEvidence(evidence, "location", "medium", "Address columns are location candidates.");
  } else if (hasAny(columnText, ["region", "location", "country", "county"])) {
    addEvidence(evidence, "location", "high", "Column name indicates location semantics.");
    addEvidence(evidence, "grouping_candidate", "medium", "Location columns can support grouping.");
  }

  if (
    column.inferred_type === "boolean" ||
    compactColumn.startsWith("is_") ||
    compactColumn.startsWith("has_") ||
    compactColumn.endsWith("_flag") ||
    columnText === "flag"
  ) {
    addEvidence(evidence, "boolean_flag", column.inferred_type === "boolean" ? "high" : "medium", "Column name or inferred type indicates boolean flag semantics.");
    addEvidence(evidence, "filter_candidate", "medium", "Boolean flags are filter candidates.");
  }

  if (evidence.length === 0) {
    addEvidence(evidence, "unknown", "low", "No deterministic semantic pattern matched this column.");
  }

  return evidence;
};

const mergeEvidence = (evidence: readonly RoleEvidence[]): {
  roles: SemanticColumnRole[];
  primaryRole: SemanticColumnRole;
  confidence: SemanticHintConfidence;
  reasons: string[];
} => {
  const confidenceByRole = new Map<SemanticColumnRole, SemanticHintConfidence>();
  const reasons = Array.from(new Set(evidence.map((item) => item.reason)));

  for (const item of evidence) {
    const current = confidenceByRole.get(item.role);
    if (!current || CONFIDENCE_SCORE[item.confidence] > CONFIDENCE_SCORE[current]) {
      confidenceByRole.set(item.role, item.confidence);
    }
  }

  const roles = Array.from(confidenceByRole.keys()).sort(
    (left, right) => ROLE_PRIORITY.indexOf(left) - ROLE_PRIORITY.indexOf(right),
  );
  const primaryRole = roles[0] || "unknown";
  const confidence = confidenceByRole.get(primaryRole) || "low";

  return {
    roles,
    primaryRole,
    confidence,
    reasons,
  };
};

export const inferSemanticColumnHints = (
  input: SemanticHintRegistryInput,
): SemanticColumnHint[] => {
  const relationshipKeys = relationshipColumnKeys(input.acceptedRelationshipContracts || []);

  return input.tables.flatMap((table) =>
    table.schema.map((column) => {
      const evidence = inferColumnEvidence({
        tableName: table.tableName,
        column,
        relationshipKeys,
      });
      const merged = mergeEvidence(evidence);

      return {
        id: `semantic-column:${compactId(table.tableName)}:${compactId(column.name)}`,
        tableName: table.tableName,
        worksheetId: table.worksheetId || null,
        columnName: column.name,
        inferredType: column.inferred_type,
        primaryRole: merged.primaryRole,
        roles: merged.roles,
        confidence: merged.confidence,
        reasons: merged.reasons,
      };
    }),
  );
};

const roleCounts = (
  columns: readonly SemanticColumnHint[],
): Partial<Record<SemanticColumnRole, number>> => {
  const counts: Partial<Record<SemanticColumnRole, number>> = {};
  for (const column of columns) {
    for (const role of column.roles) {
      counts[role] = (counts[role] || 0) + 1;
    }
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  ) as Partial<Record<SemanticColumnRole, number>>;
};

export const inferSemanticTableHints = (
  input: SemanticHintRegistryInput,
): SemanticHintRegistryResult => {
  const columns = inferSemanticColumnHints(input);
  const tables = input.tables.map((table) => {
    const tableColumns = columns.filter((column) => column.tableName === table.tableName);
    return {
      id: `semantic-table:${compactId(table.tableName)}`,
      tableName: table.tableName,
      worksheetId: table.worksheetId || null,
      displayName: table.displayName || table.sheetName || null,
      columns: tableColumns,
      roleCounts: roleCounts(tableColumns),
    };
  });
  const result = {
    registryVersion: "semantic-hints:v1" as const,
    tables,
    columns,
    summary: "",
  };

  return {
    ...result,
    summary: summarizeSemanticHints(result),
  };
};

export const summarizeSemanticHints = (
  result: Pick<SemanticHintRegistryResult, "tables" | "columns">,
): string => {
  const knownColumns = result.columns.filter((column) => column.primaryRole !== "unknown").length;
  const unknownColumns = result.columns.length - knownColumns;
  const tableText = `${result.tables.length} table${result.tables.length === 1 ? "" : "s"}`;
  const columnText = `${result.columns.length} column${result.columns.length === 1 ? "" : "s"}`;
  return `${tableText}, ${columnText}, ${knownColumns} classified, ${unknownColumns} unknown`;
};
