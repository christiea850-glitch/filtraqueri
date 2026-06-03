// K9 — Multi-worksheet, join-aware Report Recipes.
//
// These recipes inspect the uploaded workbook's worksheet metadata (display
// names + schemas) to detect property-management domain roles (tenants,
// properties, units, leases, security_log, access_codes, payments,
// maintenance_requests, vendors). When the required worksheets and join
// columns are all present, the recipe emits DuckDB SQL that joins via the
// detected keys; otherwise it returns a clearly-explained unsupported recipe
// listing exactly which worksheet or column is missing.
//
// SQL targets the trusted worksheet table names that the SQL Context panel
// already surfaces (ws_*). Identifiers are quoted defensively. SQL is
// inserted into Monaco only — these recipes never auto-run.

import type { DatasetMetadata, SchemaColumn } from "../../dataset/datasetTypes";
import type { SqlDialectId } from "../../sqlIntelligence";
import {
  getWorkbookMetadata,
  type WorksheetMetadata,
  type WorkbookMetadata,
} from "../../workbook";
import type { SqlReportRecipe } from "./sqlReportRecipes";
import { formatRowLimitClause } from "./sqlTemplateLibrary";

// ---------- Worksheet-role detection ----------

export type MultiWorksheetRole =
  | "tenants"
  | "properties"
  | "units"
  | "leases"
  | "security_log"
  | "access_codes"
  | "payments"
  | "maintenance_requests"
  | "vendors";

const ROLE_LABEL: Record<MultiWorksheetRole, string> = {
  tenants: "tenants",
  properties: "properties",
  units: "units",
  leases: "leases",
  security_log: "security_log",
  access_codes: "access_codes",
  payments: "payments",
  maintenance_requests: "maintenance requests",
  vendors: "vendors",
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const worksheetText = (worksheet: WorksheetMetadata) =>
  `${normalize(worksheet.displayName)} ${normalize(worksheet.sheetName)}`;

const nameContains = (worksheet: WorksheetMetadata, fragments: string[]) =>
  fragments.some((fragment) => worksheetText(worksheet).includes(normalize(fragment)));

const findColumnByExactName = (
  worksheet: WorksheetMetadata | undefined,
  candidates: string[],
): SchemaColumn | null => {
  if (!worksheet) return null;
  const lookup = new Set(candidates.map(normalize));
  return (
    worksheet.schema.find((column) => lookup.has(normalize(column.name))) || null
  );
};

const findColumnByContains = (
  worksheet: WorksheetMetadata | undefined,
  fragments: string[],
): SchemaColumn | null => {
  if (!worksheet) return null;
  return (
    worksheet.schema.find((column) => {
      const text = normalize(column.name);
      return fragments.some((fragment) => text.includes(normalize(fragment)));
    }) || null
  );
};

const findColumnPreferringExact = (
  worksheet: WorksheetMetadata | undefined,
  exact: string[],
  partial: string[],
): SchemaColumn | null =>
  findColumnByExactName(worksheet, exact) || findColumnByContains(worksheet, partial);

const detectRole = (worksheet: WorksheetMetadata): MultiWorksheetRole | null => {
  if (worksheet.status !== "ready") return null;
  // Order matters — more specific patterns first so a sheet named
  // "tenant_payments" does not get classified as tenants.
  if (nameContains(worksheet, ["maint", "service request", "ticket"])) {
    return "maintenance_requests";
  }
  if (nameContains(worksheet, ["security_log", "security log", "access log", "entry log"])) {
    return "security_log";
  }
  if (nameContains(worksheet, ["access_code", "access code", "key_code", "key code", "fob"])) {
    return "access_codes";
  }
  if (nameContains(worksheet, ["payment", "rent_paid", "rent paid", "invoice"])) {
    if (findColumnPreferringExact(worksheet, ["amount", "payment_amount"], ["amount", "paid"])) {
      return "payments";
    }
  }
  if (nameContains(worksheet, ["lease"])) {
    return "leases";
  }
  if (nameContains(worksheet, ["unit"])) {
    return "units";
  }
  if (nameContains(worksheet, ["propert"])) {
    return "properties";
  }
  if (nameContains(worksheet, ["tenant"])) {
    return "tenants";
  }
  if (nameContains(worksheet, ["vendor", "contractor", "supplier"])) {
    return "vendors";
  }
  return null;
};

const indexWorksheetsByRole = (
  workbook: WorkbookMetadata,
): Map<MultiWorksheetRole, WorksheetMetadata> => {
  const map = new Map<MultiWorksheetRole, WorksheetMetadata>();
  for (const worksheet of workbook.worksheets) {
    const role = detectRole(worksheet);
    if (role && !map.has(role)) {
      map.set(role, worksheet);
    }
  }
  return map;
};

const dialectWarning = (dialect: SqlDialectId): string[] =>
  dialect === "duckdb"
    ? []
    : [
        "These recipes are tuned for DuckDB syntax. Switching dialect may require manual rewrites of date functions and quoting.",
      ];

const quote = (identifier: string): string =>
  `"${identifier.replace(/"/g, '""')}"`;

const displayName = (worksheet: WorksheetMetadata) =>
  worksheet.displayName || worksheet.sheetName;

// ---------- Recipe shapes ----------

type UnsupportedReasonInput = {
  id: SqlReportRecipe["id"];
  title: string;
  businessPurpose: string;
  requiredFieldRoles: string[];
  sqlPatterns: string[];
  dialectSupportNote: string;
  worksheetRolesUsed: MultiWorksheetRole[];
};

const unsupportedRecipe = (
  input: UnsupportedReasonInput,
  missingRequirements: string[],
): SqlReportRecipe => ({
  id: input.id,
  title: input.title,
  businessPurpose: input.businessPurpose,
  requiredFieldRoles: input.requiredFieldRoles,
  sqlPatterns: input.sqlPatterns,
  dialectSupportNote: input.dialectSupportNote,
  supportSummary: `Not supported on this workbook. Needs: ${missingRequirements.join(", ")}.`,
  sql: null,
  warnings: [
    `Missing for ${input.title}: ${missingRequirements.join(", ")}.`,
  ],
  missingRequirements,
  domains: ["Operations"],
  dialects: ["duckdb"],
  worksheetsUsed: input.worksheetRolesUsed.map((role) => ROLE_LABEL[role]),
});

// ---------- Recipe builders ----------

const buildTenantAccessBehavior = (
  byRole: Map<MultiWorksheetRole, WorksheetMetadata>,
  rowLimit: string,
): SqlReportRecipe => {
  const id: SqlReportRecipe["id"] = "tenant-access-behavior";
  const meta = {
    id,
    title: "Tenant access behavior report",
    businessPurpose:
      "Counts access events per tenant by joining tenants, their access codes, and the entry log.",
    requiredFieldRoles: [
      "tenants worksheet with tenant_id + tenant name",
      "access_codes worksheet with code + tenant_id",
      "security_log worksheet with code + timestamp",
    ],
    sqlPatterns: ["JOIN", "GROUP BY", "COUNT", "MAX", "MIN", "ORDER BY", "ROW LIMIT"],
    dialectSupportNote:
      "DuckDB. Inner-joins tenants → access_codes → security_log via shared keys.",
    worksheetRolesUsed: ["tenants", "access_codes", "security_log"] as MultiWorksheetRole[],
  };

  const tenants = byRole.get("tenants");
  const accessCodes = byRole.get("access_codes");
  const securityLog = byRole.get("security_log");
  const missing: string[] = [];
  if (!tenants) missing.push("tenants worksheet");
  if (!accessCodes) missing.push("access_codes worksheet");
  if (!securityLog) missing.push("security_log worksheet");
  if (missing.length > 0) return unsupportedRecipe(meta, missing);

  const tenantId = findColumnPreferringExact(tenants, ["tenant_id"], ["tenant_id", "tenant"]);
  const tenantName = findColumnPreferringExact(
    tenants,
    ["name", "tenant_name", "full_name", "first_name"],
    ["name"],
  );
  const accessCodeCode = findColumnPreferringExact(
    accessCodes,
    ["code", "access_code", "key_code"],
    ["code"],
  );
  const accessCodeTenantId = findColumnPreferringExact(
    accessCodes,
    ["tenant_id"],
    ["tenant_id", "tenant"],
  );
  const logCode = findColumnPreferringExact(securityLog, ["code", "access_code"], ["code"]);
  const logTimestamp = findColumnPreferringExact(
    securityLog,
    ["timestamp", "event_time", "access_time", "date_time", "entry_time", "time"],
    ["time", "date"],
  );
  const columnIssues: string[] = [];
  if (!tenantId) columnIssues.push(`${displayName(tenants!)}.tenant_id column`);
  if (!tenantName) columnIssues.push(`${displayName(tenants!)} name column`);
  if (!accessCodeCode) columnIssues.push(`${displayName(accessCodes!)}.code column`);
  if (!accessCodeTenantId)
    columnIssues.push(`${displayName(accessCodes!)}.tenant_id column`);
  if (!logCode) columnIssues.push(`${displayName(securityLog!)} code column`);
  if (!logTimestamp)
    columnIssues.push(`${displayName(securityLog!)} timestamp/date column`);
  if (columnIssues.length > 0) return unsupportedRecipe(meta, columnIssues);

  const sql = `SELECT
  t.${quote(tenantName!.name)} AS tenant_name,
  COUNT(*) AS access_events,
  MIN(s.${quote(logTimestamp!.name)}) AS first_seen,
  MAX(s.${quote(logTimestamp!.name)}) AS last_seen
FROM ${quote(tenants!.tableName)} AS t
JOIN ${quote(accessCodes!.tableName)} AS a
  ON a.${quote(accessCodeTenantId!.name)} = t.${quote(tenantId!.name)}
JOIN ${quote(securityLog!.tableName)} AS s
  ON s.${quote(logCode!.name)} = a.${quote(accessCodeCode!.name)}
GROUP BY t.${quote(tenantName!.name)}
ORDER BY access_events DESC, last_seen DESC
${rowLimit};`;

  return {
    ...meta,
    supportSummary: `Supported. Joins ${[displayName(tenants!), displayName(accessCodes!), displayName(securityLog!)].join(" + ")}.`,
    sql,
    warnings: [],
    missingRequirements: [],
    domains: ["Operations"],
    dialects: ["duckdb"],
    worksheetsUsed: [
      displayName(tenants!),
      displayName(accessCodes!),
      displayName(securityLog!),
    ],
  };
};

const buildMaintenanceRequestsByProperty = (
  byRole: Map<MultiWorksheetRole, WorksheetMetadata>,
  rowLimit: string,
): SqlReportRecipe => {
  const id: SqlReportRecipe["id"] = "maintenance-requests-by-property";
  const meta = {
    id,
    title: "Maintenance requests by property / type",
    businessPurpose:
      "Counts maintenance requests grouped by property and request type by joining maintenance requests → units → properties.",
    requiredFieldRoles: [
      "maintenance_requests with unit_id and request type/status",
      "units worksheet with unit_id + property_id",
      "properties worksheet with property_id + name/address",
    ],
    sqlPatterns: ["JOIN", "GROUP BY", "COUNT", "ORDER BY", "ROW LIMIT"],
    dialectSupportNote:
      "DuckDB. Joins maintenance_requests → units → properties via shared keys.",
    worksheetRolesUsed: ["maintenance_requests", "units", "properties"] as MultiWorksheetRole[],
  };

  const requests = byRole.get("maintenance_requests");
  const units = byRole.get("units");
  const properties = byRole.get("properties");
  const missing: string[] = [];
  if (!requests) missing.push("maintenance_requests worksheet");
  if (!units) missing.push("units worksheet");
  if (!properties) missing.push("properties worksheet");
  if (missing.length > 0) return unsupportedRecipe(meta, missing);

  const requestUnitId = findColumnPreferringExact(requests, ["unit_id"], ["unit"]);
  const requestType = findColumnPreferringExact(
    requests,
    ["request_type", "type", "category", "issue_type"],
    ["type", "category"],
  );
  const requestStatus = findColumnPreferringExact(
    requests,
    ["status", "request_status"],
    ["status"],
  );
  const unitsUnitId = findColumnPreferringExact(units, ["unit_id"], ["unit_id"]);
  const unitsPropertyId = findColumnPreferringExact(units, ["property_id"], ["property"]);
  const propertyId = findColumnPreferringExact(properties, ["property_id"], ["property_id"]);
  const propertyName = findColumnPreferringExact(
    properties,
    ["property_name", "name", "address"],
    ["name", "address"],
  );
  const columnIssues: string[] = [];
  if (!requestUnitId) columnIssues.push(`${displayName(requests!)}.unit_id column`);
  if (!requestType && !requestStatus)
    columnIssues.push(`${displayName(requests!)} type or status column`);
  if (!unitsUnitId) columnIssues.push(`${displayName(units!)}.unit_id column`);
  if (!unitsPropertyId) columnIssues.push(`${displayName(units!)}.property_id column`);
  if (!propertyId) columnIssues.push(`${displayName(properties!)}.property_id column`);
  if (!propertyName)
    columnIssues.push(`${displayName(properties!)} name/address column`);
  if (columnIssues.length > 0) return unsupportedRecipe(meta, columnIssues);

  const groupingColumn = requestType || requestStatus!;
  const groupingLabel = groupingColumn === requestType ? "request_type" : "request_status";

  const sql = `SELECT
  p.${quote(propertyName!.name)} AS property,
  r.${quote(groupingColumn.name)} AS ${groupingLabel},
  COUNT(*) AS request_count
FROM ${quote(requests!.tableName)} AS r
JOIN ${quote(units!.tableName)} AS u
  ON u.${quote(unitsUnitId!.name)} = r.${quote(requestUnitId!.name)}
JOIN ${quote(properties!.tableName)} AS p
  ON p.${quote(propertyId!.name)} = u.${quote(unitsPropertyId!.name)}
GROUP BY p.${quote(propertyName!.name)}, r.${quote(groupingColumn.name)}
ORDER BY request_count DESC
${rowLimit};`;

  return {
    ...meta,
    supportSummary: `Supported. Joins ${[displayName(requests!), displayName(units!), displayName(properties!)].join(" + ")}.`,
    sql,
    warnings: [],
    missingRequirements: [],
    domains: ["Operations"],
    dialects: ["duckdb"],
    worksheetsUsed: [
      displayName(requests!),
      displayName(units!),
      displayName(properties!),
    ],
  };
};

const buildRentPaymentSummary = (
  byRole: Map<MultiWorksheetRole, WorksheetMetadata>,
  rowLimit: string,
): SqlReportRecipe => {
  const id: SqlReportRecipe["id"] = "rent-payment-summary";
  const meta = {
    id,
    title: "Rent payment summary by property",
    businessPurpose:
      "Sums payment totals and counts payments per property by joining payments → leases → units → properties.",
    requiredFieldRoles: [
      "payments worksheet with lease_id + amount",
      "leases worksheet with lease_id + unit_id",
      "units worksheet with unit_id + property_id",
      "properties worksheet with property_id + name",
    ],
    sqlPatterns: ["JOIN", "GROUP BY", "SUM", "COUNT", "ORDER BY", "ROW LIMIT"],
    dialectSupportNote:
      "DuckDB. Aggregates by property after joining payments → leases → units → properties.",
    worksheetRolesUsed: ["payments", "leases", "units", "properties"] as MultiWorksheetRole[],
  };

  const payments = byRole.get("payments");
  const leases = byRole.get("leases");
  const units = byRole.get("units");
  const properties = byRole.get("properties");
  const missing: string[] = [];
  if (!payments) missing.push("payments worksheet");
  if (!leases) missing.push("leases worksheet");
  if (!units) missing.push("units worksheet");
  if (!properties) missing.push("properties worksheet");
  if (missing.length > 0) return unsupportedRecipe(meta, missing);

  const paymentsLeaseId = findColumnPreferringExact(payments, ["lease_id"], ["lease"]);
  const paymentsAmount = findColumnPreferringExact(
    payments,
    ["amount", "payment_amount", "paid"],
    ["amount", "paid"],
  );
  const leasesLeaseId = findColumnPreferringExact(leases, ["lease_id"], ["lease_id"]);
  const leasesUnitId = findColumnPreferringExact(leases, ["unit_id"], ["unit"]);
  const unitsUnitId = findColumnPreferringExact(units, ["unit_id"], ["unit_id"]);
  const unitsPropertyId = findColumnPreferringExact(units, ["property_id"], ["property"]);
  const propertyId = findColumnPreferringExact(properties, ["property_id"], ["property_id"]);
  const propertyName = findColumnPreferringExact(
    properties,
    ["property_name", "name", "address"],
    ["name", "address"],
  );
  const columnIssues: string[] = [];
  if (!paymentsLeaseId) columnIssues.push(`${displayName(payments!)}.lease_id column`);
  if (!paymentsAmount) columnIssues.push(`${displayName(payments!)} amount column`);
  if (!leasesLeaseId) columnIssues.push(`${displayName(leases!)}.lease_id column`);
  if (!leasesUnitId) columnIssues.push(`${displayName(leases!)}.unit_id column`);
  if (!unitsUnitId) columnIssues.push(`${displayName(units!)}.unit_id column`);
  if (!unitsPropertyId) columnIssues.push(`${displayName(units!)}.property_id column`);
  if (!propertyId) columnIssues.push(`${displayName(properties!)}.property_id column`);
  if (!propertyName)
    columnIssues.push(`${displayName(properties!)} name/address column`);
  if (columnIssues.length > 0) return unsupportedRecipe(meta, columnIssues);

  const sql = `SELECT
  p.${quote(propertyName!.name)} AS property,
  SUM(pmt.${quote(paymentsAmount!.name)}) AS total_paid,
  COUNT(*) AS payment_count,
  AVG(pmt.${quote(paymentsAmount!.name)}) AS avg_payment
FROM ${quote(payments!.tableName)} AS pmt
JOIN ${quote(leases!.tableName)} AS l
  ON l.${quote(leasesLeaseId!.name)} = pmt.${quote(paymentsLeaseId!.name)}
JOIN ${quote(units!.tableName)} AS u
  ON u.${quote(unitsUnitId!.name)} = l.${quote(leasesUnitId!.name)}
JOIN ${quote(properties!.tableName)} AS p
  ON p.${quote(propertyId!.name)} = u.${quote(unitsPropertyId!.name)}
GROUP BY p.${quote(propertyName!.name)}
ORDER BY total_paid DESC
${rowLimit};`;

  return {
    ...meta,
    supportSummary: `Supported. Joins ${[
      displayName(payments!),
      displayName(leases!),
      displayName(units!),
      displayName(properties!),
    ].join(" + ")}.`,
    sql,
    warnings: [],
    missingRequirements: [],
    domains: ["Finance"],
    dialects: ["duckdb"],
    worksheetsUsed: [
      displayName(payments!),
      displayName(leases!),
      displayName(units!),
      displayName(properties!),
    ],
  };
};

const buildVacantUnitsByProperty = (
  byRole: Map<MultiWorksheetRole, WorksheetMetadata>,
  rowLimit: string,
): SqlReportRecipe => {
  const id: SqlReportRecipe["id"] = "vacant-units-by-property";
  const meta = {
    id,
    title: "Vacant units by property",
    businessPurpose:
      "Counts vacant units per property using a status column when available, otherwise units with no current lease.",
    requiredFieldRoles: [
      "units worksheet with unit_id + property_id (+ status, or a leases worksheet)",
      "properties worksheet with property_id + name",
    ],
    sqlPatterns: ["JOIN", "LEFT JOIN", "GROUP BY", "COUNT", "ORDER BY", "ROW LIMIT"],
    dialectSupportNote:
      "DuckDB. Prefers a vacancy/status column on units; otherwise LEFT-joins leases to find units with no current lease.",
    worksheetRolesUsed: ["units", "properties", "leases"] as MultiWorksheetRole[],
  };

  const units = byRole.get("units");
  const properties = byRole.get("properties");
  const leases = byRole.get("leases");
  const missing: string[] = [];
  if (!units) missing.push("units worksheet");
  if (!properties) missing.push("properties worksheet");
  if (missing.length > 0) return unsupportedRecipe(meta, missing);

  const unitsUnitId = findColumnPreferringExact(units, ["unit_id"], ["unit_id"]);
  const unitsPropertyId = findColumnPreferringExact(units, ["property_id"], ["property"]);
  const propertyId = findColumnPreferringExact(properties, ["property_id"], ["property_id"]);
  const propertyName = findColumnPreferringExact(
    properties,
    ["property_name", "name", "address"],
    ["name", "address"],
  );
  const unitsStatus = findColumnPreferringExact(
    units,
    ["status", "occupancy_status", "is_occupied", "vacant"],
    ["status", "vacant", "occup"],
  );
  const leasesUnitId = leases
    ? findColumnPreferringExact(leases, ["unit_id"], ["unit"])
    : null;

  const columnIssues: string[] = [];
  if (!unitsUnitId) columnIssues.push(`${displayName(units!)}.unit_id column`);
  if (!unitsPropertyId) columnIssues.push(`${displayName(units!)}.property_id column`);
  if (!propertyId) columnIssues.push(`${displayName(properties!)}.property_id column`);
  if (!propertyName)
    columnIssues.push(`${displayName(properties!)} name/address column`);
  if (!unitsStatus && !(leases && leasesUnitId))
    columnIssues.push(
      `${displayName(units!)} vacancy/status column or a leases worksheet to derive vacancy`,
    );
  if (columnIssues.length > 0) return unsupportedRecipe(meta, columnIssues);

  const usedWorksheets: string[] = [displayName(units!), displayName(properties!)];
  let sql: string;
  if (unitsStatus) {
    sql = `SELECT
  p.${quote(propertyName!.name)} AS property,
  COUNT(*) FILTER (
    WHERE LOWER(CAST(u.${quote(unitsStatus.name)} AS VARCHAR)) IN ('vacant', 'open', 'available', 'unoccupied', 'no', 'false', '0')
  ) AS vacant_units,
  COUNT(*) AS total_units,
  ROUND(100.0 * COUNT(*) FILTER (
    WHERE LOWER(CAST(u.${quote(unitsStatus.name)} AS VARCHAR)) IN ('vacant', 'open', 'available', 'unoccupied', 'no', 'false', '0')
  ) / NULLIF(COUNT(*), 0), 1) AS vacancy_rate_pct
FROM ${quote(units!.tableName)} AS u
JOIN ${quote(properties!.tableName)} AS p
  ON p.${quote(propertyId!.name)} = u.${quote(unitsPropertyId!.name)}
GROUP BY p.${quote(propertyName!.name)}
ORDER BY vacant_units DESC
${rowLimit};`;
  } else {
    usedWorksheets.push(displayName(leases!));
    sql = `SELECT
  p.${quote(propertyName!.name)} AS property,
  COUNT(*) FILTER (WHERE l.${quote(leasesUnitId!.name)} IS NULL) AS vacant_units,
  COUNT(*) AS total_units,
  ROUND(100.0 * COUNT(*) FILTER (WHERE l.${quote(leasesUnitId!.name)} IS NULL) / NULLIF(COUNT(*), 0), 1) AS vacancy_rate_pct
FROM ${quote(units!.tableName)} AS u
JOIN ${quote(properties!.tableName)} AS p
  ON p.${quote(propertyId!.name)} = u.${quote(unitsPropertyId!.name)}
LEFT JOIN ${quote(leases!.tableName)} AS l
  ON l.${quote(leasesUnitId!.name)} = u.${quote(unitsUnitId!.name)}
GROUP BY p.${quote(propertyName!.name)}
ORDER BY vacant_units DESC
${rowLimit};`;
  }

  return {
    ...meta,
    supportSummary: `Supported. ${unitsStatus ? "Uses status column" : "LEFT-joins leases to find empty units"}. Worksheets: ${usedWorksheets.join(" + ")}.`,
    sql,
    warnings: unitsStatus
      ? [
          "The status-column path uses a defensive list of vacant-looking values. Review the CASE matches before relying on the output.",
        ]
      : [
          "The leases-derived path treats a unit as vacant when no lease row references it. If your leases worksheet only stores active leases, this is sound; otherwise filter the LEFT JOIN by lease end date before running.",
        ],
    missingRequirements: [],
    domains: ["Operations"],
    dialects: ["duckdb"],
    worksheetsUsed: usedWorksheets,
  };
};

const buildLeaseExpirationWatchlist = (
  byRole: Map<MultiWorksheetRole, WorksheetMetadata>,
  rowLimit: string,
): SqlReportRecipe => {
  const id: SqlReportRecipe["id"] = "lease-expiration-watchlist";
  const meta = {
    id,
    title: "Lease expiration / move-out watchlist",
    businessPurpose:
      "Lists leases expiring soon along with the tenant — optionally enriched with unit and property — to drive renewal or move-out outreach.",
    requiredFieldRoles: [
      "leases worksheet with lease_id, tenant_id, and end date",
      "tenants worksheet with tenant_id + name",
    ],
    sqlPatterns: ["JOIN", "LEFT JOIN", "DATE_DIFF", "WHERE", "ORDER BY", "ROW LIMIT"],
    dialectSupportNote:
      "DuckDB. Computes days-to-expiry from CURRENT_DATE; tolerates leases/tenants without unit or property worksheets.",
    worksheetRolesUsed: ["leases", "tenants", "units", "properties"] as MultiWorksheetRole[],
  };

  const leases = byRole.get("leases");
  const tenants = byRole.get("tenants");
  const units = byRole.get("units");
  const properties = byRole.get("properties");
  const missing: string[] = [];
  if (!leases) missing.push("leases worksheet");
  if (!tenants) missing.push("tenants worksheet");
  if (missing.length > 0) return unsupportedRecipe(meta, missing);

  const leasesLeaseId = findColumnPreferringExact(leases, ["lease_id"], ["lease_id"]);
  const leasesTenantId = findColumnPreferringExact(leases, ["tenant_id"], ["tenant"]);
  const leasesEndDate = findColumnPreferringExact(
    leases,
    ["end_date", "lease_end", "expiry_date", "expiration_date", "move_out_date"],
    ["end", "expir"],
  );
  const leasesUnitId = findColumnPreferringExact(leases, ["unit_id"], ["unit"]);
  const tenantsTenantId = findColumnPreferringExact(tenants, ["tenant_id"], ["tenant_id"]);
  const tenantsName = findColumnPreferringExact(
    tenants,
    ["name", "tenant_name", "full_name"],
    ["name"],
  );
  const tenantsContact = findColumnPreferringExact(
    tenants,
    ["email", "phone", "contact"],
    ["email", "phone"],
  );

  const columnIssues: string[] = [];
  if (!leasesLeaseId) columnIssues.push(`${displayName(leases!)}.lease_id column`);
  if (!leasesTenantId) columnIssues.push(`${displayName(leases!)}.tenant_id column`);
  if (!leasesEndDate) columnIssues.push(`${displayName(leases!)} end-date column`);
  if (!tenantsTenantId) columnIssues.push(`${displayName(tenants!)}.tenant_id column`);
  if (!tenantsName) columnIssues.push(`${displayName(tenants!)} name column`);
  if (columnIssues.length > 0) return unsupportedRecipe(meta, columnIssues);

  const usedWorksheets: string[] = [displayName(leases!), displayName(tenants!)];
  const selectFields: string[] = [
    `l.${quote(leasesLeaseId!.name)} AS lease_id`,
    `t.${quote(tenantsName!.name)} AS tenant_name`,
  ];
  if (tenantsContact) {
    selectFields.push(`t.${quote(tenantsContact.name)} AS tenant_contact`);
  }
  selectFields.push(`CAST(l.${quote(leasesEndDate!.name)} AS DATE) AS lease_end_date`);
  selectFields.push(
    `DATE_DIFF('day', CURRENT_DATE, CAST(l.${quote(leasesEndDate!.name)} AS DATE)) AS days_to_expiry`,
  );

  let joinClause = `FROM ${quote(leases!.tableName)} AS l\nJOIN ${quote(tenants!.tableName)} AS t\n  ON t.${quote(tenantsTenantId!.name)} = l.${quote(leasesTenantId!.name)}`;

  // Optional enrichments
  const unitsUnitId = units ? findColumnPreferringExact(units, ["unit_id"], ["unit_id"]) : null;
  const unitsPropertyId = units
    ? findColumnPreferringExact(units, ["property_id"], ["property"])
    : null;
  const unitsName = units
    ? findColumnPreferringExact(
        units,
        ["unit_name", "name", "unit_number"],
        ["name", "number"],
      )
    : null;
  const propertyId = properties
    ? findColumnPreferringExact(properties, ["property_id"], ["property_id"])
    : null;
  const propertyName = properties
    ? findColumnPreferringExact(
        properties,
        ["property_name", "name", "address"],
        ["name", "address"],
      )
    : null;
  if (units && leasesUnitId && unitsUnitId && unitsName) {
    selectFields.splice(2, 0, `u.${quote(unitsName.name)} AS unit`);
    joinClause += `\nLEFT JOIN ${quote(units.tableName)} AS u\n  ON u.${quote(unitsUnitId.name)} = l.${quote(leasesUnitId!.name)}`;
    usedWorksheets.push(displayName(units));
    if (properties && unitsPropertyId && propertyId && propertyName) {
      selectFields.splice(2, 0, `p.${quote(propertyName.name)} AS property`);
      joinClause += `\nLEFT JOIN ${quote(properties.tableName)} AS p\n  ON p.${quote(propertyId.name)} = u.${quote(unitsPropertyId.name)}`;
      usedWorksheets.push(displayName(properties));
    }
  }

  const sql = `SELECT
  ${selectFields.join(",\n  ")}
${joinClause}
WHERE CAST(l.${quote(leasesEndDate!.name)} AS DATE) BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
ORDER BY days_to_expiry ASC
${rowLimit};`;

  return {
    ...meta,
    supportSummary: `Supported. Watchlist for the next 90 days. Worksheets: ${usedWorksheets.join(" + ")}.`,
    sql,
    warnings: [
      "Uses CURRENT_DATE and a 90-day window. Adjust the WHERE clause to match your renewal-outreach cadence.",
    ],
    missingRequirements: [],
    domains: ["Operations"],
    dialects: ["duckdb"],
    worksheetsUsed: usedWorksheets,
  };
};

// ---------- Factory ----------

export const createMultiWorksheetRecipes = (
  dataset: DatasetMetadata | null,
  selectedDialect: SqlDialectId,
): SqlReportRecipe[] => {
  const workbook = getWorkbookMetadata(dataset);
  if (!workbook || workbook.worksheets.length === 0) return [];

  const byRole = indexWorksheetsByRole(workbook);
  const rowLimit = formatRowLimitClause(selectedDialect, 50);

  const recipes: SqlReportRecipe[] = [
    buildTenantAccessBehavior(byRole, rowLimit),
    buildMaintenanceRequestsByProperty(byRole, rowLimit),
    buildRentPaymentSummary(byRole, rowLimit),
    buildVacantUnitsByProperty(byRole, rowLimit),
    buildLeaseExpirationWatchlist(byRole, rowLimit),
  ];

  // Append dialect-warning prefix if user picked a non-DuckDB dialect.
  const dialectWarnings = dialectWarning(selectedDialect);
  if (dialectWarnings.length === 0) return recipes;
  return recipes.map((recipe) => ({
    ...recipe,
    warnings: [...dialectWarnings, ...recipe.warnings],
  }));
};

// Exposed for tests / SQL Context surfaces that want to inspect the detection
// without rebuilding the recipes themselves.
export const detectMultiWorksheetRoles = (
  dataset: DatasetMetadata | null,
): Map<MultiWorksheetRole, WorksheetMetadata> => {
  const workbook = getWorkbookMetadata(dataset);
  if (!workbook) return new Map();
  return indexWorksheetsByRole(workbook);
};
