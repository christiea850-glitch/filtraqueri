import type { SchemaColumn } from "../dataset/datasetTypes";

export type BusinessFieldRole =
  | "invoice"
  | "customer"
  | "location"
  | "date"
  | "amount"
  | "status"
  | "identifier"
  | "quantity"
  | "description";

export type DisplayColumnProfile = {
  sourceName: string;
  displayName: string;
  normalizedName: string;
  role: BusinessFieldRole | null;
  isGenericSourceName: boolean;
  confidence: "high" | "medium" | "low";
};

export type StructuralRowType = "empty" | "title" | "section" | "report-label" | "header-like" | "data";

export type StructuralRowProfile = {
  type: StructuralRowType;
  isStructural: boolean;
  label: string;
};

const genericColumnPattern = /^(column|field|unnamed|col)[_\s-]*\d+$/i;
const currencyPattern = /^[$( -]*\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?$/;
const datePattern =
  /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$|^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)/i;
const invoicePattern = /\b(inv|invoice|bill|receipt|order|po)[\s#:_-]*[a-z0-9-]+/i;
const locationPattern =
  /\b(street|suite|ave|avenue|road|rd|blvd|city|state|zip|postal|usa|canada|london|new york|los angeles|chicago|houston|miami|dallas|atlanta|seattle|boston)\b/i;
const statusPattern = /\b(paid|unpaid|open|closed|pending|complete|completed|cancelled|canceled|approved|rejected)\b/i;
const reportTitlePattern =
  /\b(report|invoice|statement|summary|worksheet|ledger|aging|balance|profit|loss|sales|purchase|order|customer|vendor)\b/i;
const structuralSeparatorPattern = /^[-_=*#\s]+$/;

const titleCase = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

export const normalizeColumnName = (name: string) =>
  name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

const sampleStrings = (samples: unknown[] = []) =>
  samples
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .map((value) => String(value).trim())
    .slice(0, 12);

const scoreSamples = (samples: string[], matcher: (value: string) => boolean) =>
  samples.filter(matcher).length;

export const inferBusinessRole = (
  sourceName: string,
  samples: unknown[] = [],
  inferredType?: SchemaColumn["inferred_type"],
): BusinessFieldRole | null => {
  const normalized = normalizeColumnName(sourceName).toLowerCase();
  const values = sampleStrings(samples);

  if (/\b(invoice|inv no|invoice no|invoice number|receipt|order id|po number)\b/.test(normalized)) {
    return "invoice";
  }
  if (/\b(customer|client|account name|buyer|bill to|sold to)\b/.test(normalized)) {
    return "customer";
  }
  if (/\b(city|state|country|address|location|region|postal|zip)\b/.test(normalized)) {
    return "location";
  }
  if (/\b(date|posted|created|issued|due|paid on)\b/.test(normalized) || inferredType === "date") {
    return "date";
  }
  if (/\b(amount|total|subtotal|balance|price|cost|revenue|sales|tax|paid|due)\b/.test(normalized)) {
    return "amount";
  }
  if (/\b(status|state|stage)\b/.test(normalized)) {
    return "status";
  }
  if (/\b(id|number|no|code|ref|reference)\b/.test(normalized)) {
    return "identifier";
  }
  if (/\b(qty|quantity|units|count)\b/.test(normalized)) {
    return "quantity";
  }
  if (/\b(description|memo|notes|item|product|service)\b/.test(normalized)) {
    return "description";
  }

  if (scoreSamples(values, (value) => invoicePattern.test(value)) >= 2) return "invoice";
  if (scoreSamples(values, (value) => datePattern.test(value)) >= 3) return "date";
  if (scoreSamples(values, (value) => currencyPattern.test(value)) >= 3 || inferredType === "numeric") {
    return "amount";
  }
  if (scoreSamples(values, (value) => locationPattern.test(value)) >= 2) return "location";
  if (scoreSamples(values, (value) => statusPattern.test(value)) >= 2) return "status";

  return null;
};

const roleLabels: Record<BusinessFieldRole, string> = {
  invoice: "Invoice Number",
  customer: "Customer",
  location: "Location",
  date: "Date",
  amount: "Amount",
  status: "Status",
  identifier: "Identifier",
  quantity: "Quantity",
  description: "Description",
};

export const createDisplayColumnProfile = (
  sourceName: string,
  options: {
    index?: number;
    samples?: unknown[];
    inferredType?: SchemaColumn["inferred_type"];
  } = {},
): DisplayColumnProfile => {
  const normalizedName = normalizeColumnName(sourceName);
  const isGenericSourceName = genericColumnPattern.test(sourceName) || normalizedName === "";
  const role = inferBusinessRole(sourceName, options.samples, options.inferredType);
  const fallbackName = normalizedName ? titleCase(normalizedName) : `Field ${(options.index || 0) + 1}`;
  const displayName = isGenericSourceName && role ? roleLabels[role] : fallbackName;

  return {
    sourceName,
    displayName,
    normalizedName: fallbackName,
    role,
    isGenericSourceName,
    confidence: role ? (isGenericSourceName ? "medium" : "high") : isGenericSourceName ? "low" : "high",
  };
};

export const createDisplayColumnProfiles = (
  columns: string[],
  rows: Record<string, unknown>[] = [],
) => {
  const usedNames = new Map<string, number>();

  return columns.map((column, index) => {
    const profile = createDisplayColumnProfile(column, {
      index,
      samples: rows.map((row) => row[column]),
    });
    const seenCount = usedNames.get(profile.displayName) || 0;
    usedNames.set(profile.displayName, seenCount + 1);

    return seenCount > 0
      ? {
          ...profile,
          displayName: `${profile.displayName} ${seenCount + 1}`,
        }
      : profile;
  });
};

export const createSchemaDisplayProfiles = (schema: SchemaColumn[]) =>
  schema.map((column, index) =>
    createDisplayColumnProfile(column.name, {
      index,
      samples: column.sample_values,
      inferredType: column.inferred_type,
    }),
  );

export const getDisplayColumnName = (
  profiles: DisplayColumnProfile[],
  sourceName: string,
) => profiles.find((profile) => profile.sourceName === sourceName)?.displayName || sourceName;

export const getBusinessRoleLabel = (role: BusinessFieldRole | null) =>
  role ? roleLabels[role] : "Business field";

export const classifyStructuralRow = (
  row: Record<string, unknown>,
  columns: string[],
): StructuralRowProfile => {
  const values = columns.map((column) => row[column]);
  const nonEmptyValues = values
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .map((value) => String(value).trim());

  if (nonEmptyValues.length === 0) {
    return { type: "empty", isStructural: true, label: "Blank structural row" };
  }

  const joined = nonEmptyValues.join(" ");
  const uniqueLowerValues = new Set(nonEmptyValues.map((value) => value.toLowerCase()));

  if (nonEmptyValues.every((value) => structuralSeparatorPattern.test(value))) {
    return { type: "section", isStructural: true, label: "Section separator" };
  }

  if (nonEmptyValues.length === 1 && reportTitlePattern.test(nonEmptyValues[0])) {
    return { type: "title", isStructural: true, label: "Report title row" };
  }

  if (
    nonEmptyValues.length <= 2 &&
    /\b(invoice|report|statement|customer|vendor|period|date|page|prepared by)\b/i.test(joined)
  ) {
    return { type: "report-label", isStructural: true, label: "Report label row" };
  }

  if (uniqueLowerValues.size <= 2 && nonEmptyValues.length >= 3) {
    return { type: "section", isStructural: true, label: "Repeated section row" };
  }

  const headerLikeCount = nonEmptyValues.filter((value) =>
    /\b(invoice|customer|date|amount|total|description|qty|quantity|status|address|city|state)\b/i.test(value),
  ).length;
  if (headerLikeCount >= Math.max(2, Math.ceil(nonEmptyValues.length * 0.6))) {
    return { type: "header-like", isStructural: true, label: "Repeated header row" };
  }

  return { type: "data", isStructural: false, label: "Data row" };
};
