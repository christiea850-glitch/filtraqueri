import type { WorksheetMetadata } from "../../features/workbook";
import type { WorkbookRelationshipReadinessMatch } from "./workbookRelationshipReadiness";

export type WorkbookTaskAssistPath =
  | "template_library"
  | "report_recipes"
  | "complex_sql_assist"
  | "custom_proposal";

export type WorkbookTaskAssistAction = "templates" | "recipes" | "assist";

export type WorkbookTaskAssistRecommendation = {
  path: WorkbookTaskAssistPath;
  pathLabel: string;
  reason: string;
  selectedScopeLabel: string;
  relationshipReadiness: string;
  nextStep: string;
  closestMatch: string | null;
  action: WorkbookTaskAssistAction | null;
};

type TaskSignals = {
  missing: boolean;
  summary: boolean;
  dateCondition: boolean;
  report: boolean;
  payment: boolean;
  lease: boolean;
  tenant: boolean;
  property: boolean;
  manager: boolean;
  multiEntityIntent: boolean;
};

const normalizeText = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const hasAny = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

const getTaskSignals = (taskText: string, entitySearchText: string): TaskSignals => {
  const searchText = `${normalizeText(taskText)} ${entitySearchText}`;

  return {
    missing: hasAny(searchText, [
      "missing",
      "unmatched",
      "not matched",
      "without",
      "no recent",
      "no payment",
      "gap",
      "orphan",
    ]),
    summary: hasAny(searchText, [
      "summarize",
      "summary",
      "total",
      "count",
      "average",
      "avg",
      "by ",
      "compare",
      "breakdown",
      "group",
    ]),
    dateCondition: hasAny(searchText, [
      "recent",
      "overdue",
      "late",
      "expired",
      "expiring",
      "monthly",
      "weekly",
      "date",
      "after",
      "before",
    ]),
    report: hasAny(searchText, ["report", "dashboard", "status", "watchlist"]),
    payment: hasAny(searchText, ["payment", "payments", "paid", "unpaid", "overdue"]),
    lease: hasAny(searchText, ["lease", "leases", "rent", "active lease"]),
    tenant: hasAny(searchText, ["tenant", "tenants", "resident", "residents"]),
    property: hasAny(searchText, ["property", "properties", "unit", "units"]),
    manager: hasAny(searchText, ["manager", "managers", "realtor", "realtors"]),
    multiEntityIntent: hasAny(searchText, [
      "between",
      "across",
      "join",
      "match",
      "connect",
      "with",
      "and ",
      "related",
    ]),
  };
};

const describeSelectedScope = (worksheets: WorksheetMetadata[]) =>
  worksheets.length > 0
    ? worksheets.map((worksheet) => worksheet.displayName).join(", ")
    : "No analysis scope applied yet";

const describeRelationshipReadiness = (matches: WorkbookRelationshipReadinessMatch[]) => {
  const strongMatches = matches.filter((match) => match.confidence === "strong_match");
  const possibleMatches = matches.filter((match) => match.confidence === "possible_match");

  if (strongMatches.length > 0) {
    return strongMatches
      .slice(0, 2)
      .map((match) =>
        match.sourceColumnName && match.targetColumnName
          ? `${match.sourceColumnName} appears to connect ${match.sourceDisplayName} and ${match.targetDisplayName}`
          : `${match.sourceDisplayName} and ${match.targetDisplayName} appear related`,
      )
      .join("; ");
  }

  if (possibleMatches.length > 0) {
    return "Possible relationships were found, but they should be reviewed before using these tables together.";
  }

  if (matches.length > 0) {
    return "No obvious key-style relationship was found from metadata.";
  }

  return "Apply at least two tables to review relationship readiness.";
};

const chooseClosestReport = (signals: TaskSignals) => {
  if (signals.payment && signals.property) return "Payments by property";
  if (signals.tenant && signals.payment) return "Tenant payment status";
  if (signals.lease && signals.manager) return "Lease status by manager";
  if (signals.payment && signals.dateCondition) return "Overdue payments";
  if (signals.property && signals.tenant) return "Tenant and property report";
  return "Dataset report recipe";
};

export const recommendWorkbookTaskAssistPath = ({
  taskText,
  appliedWorksheets,
  relationshipMatches,
}: {
  taskText: string;
  appliedWorksheets: WorksheetMetadata[];
  relationshipMatches: WorkbookRelationshipReadinessMatch[];
}): WorkbookTaskAssistRecommendation => {
  const normalizedTask = normalizeText(taskText);
  const entitySearchText = appliedWorksheets
    .flatMap((worksheet) => [
      worksheet.displayName,
      worksheet.sheetName,
      worksheet.tableName,
      ...worksheet.schema.map((column) => column.name),
    ])
    .map(normalizeText)
    .join(" ");
  const signals = getTaskSignals(normalizedTask, entitySearchText);
  const selectedScopeLabel = describeSelectedScope(appliedWorksheets);
  const relationshipReadiness = describeRelationshipReadiness(relationshipMatches);
  const hasMultiEntityScope = appliedWorksheets.length > 1;
  const hasReportDomain =
    signals.payment || signals.lease || signals.tenant || signals.property || signals.manager;

  if (signals.missing) {
    const path = hasMultiEntityScope ? "complex_sql_assist" : "template_library";
    return {
      path,
      pathLabel: path === "complex_sql_assist" ? "Complex SQL Assist" : "Template Library",
      reason: hasMultiEntityScope
        ? "Your request involves missing or unmatched records across the applied analysis scope."
        : "Your request looks like a missing-record check that can start from a data-quality template.",
      selectedScopeLabel,
      relationshipReadiness,
      nextStep: path === "complex_sql_assist" ? "Open Complex SQL Assist." : "Open Template Library.",
      closestMatch: path === "template_library" ? "Missing or unmatched records" : null,
      action: path === "complex_sql_assist" ? "assist" : "templates",
    };
  }

  if ((signals.report || signals.dateCondition || hasReportDomain) && hasReportDomain) {
    const closestMatch = chooseClosestReport(signals);
    return {
      path: "report_recipes",
      pathLabel: "Report Recipes",
      reason: "Your request matches business-report language and the available entity names in the current context.",
      selectedScopeLabel,
      relationshipReadiness,
      nextStep: "Open Report Recipes.",
      closestMatch,
      action: "recipes",
    };
  }

  if (signals.summary) {
    return {
      path: "template_library",
      pathLabel: "Template Library",
      reason: "Your request looks like a grouped summary, total, comparison, or breakdown.",
      selectedScopeLabel,
      relationshipReadiness,
      nextStep: "Open Template Library.",
      closestMatch: "Group totals or summary template",
      action: "templates",
    };
  }

  if (hasMultiEntityScope || signals.multiEntityIntent) {
    return {
      path: "complex_sql_assist",
      pathLabel: "Complex SQL Assist",
      reason: "Your request appears to involve multiple tables or relationships.",
      selectedScopeLabel,
      relationshipReadiness,
      nextStep: "Open Complex SQL Assist.",
      closestMatch: null,
      action: "assist",
    };
  }

  return {
    path: "custom_proposal",
    pathLabel: "Custom report/template proposal",
    reason: "No confident template or recipe match was found from deterministic metadata matching.",
    selectedScopeLabel,
    relationshipReadiness,
    nextStep: "Edit the task or open Complex SQL Assist for a manual review path.",
    closestMatch: null,
    action: "assist",
  };
};
