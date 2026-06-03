import type { SchemaColumn } from "../../dataset/datasetTypes";
import type {
  AIColumnSensitivityCategory,
  AIColumnSensitivityClassification,
  AIColumnSensitivityLevel,
} from "./llmGovernanceTypes";
import { getRedactionPolicyForSensitivity } from "./llmRedactionPolicy";

export type SensitiveColumnClassificationInput = {
  column: Pick<
    SchemaColumn,
    "name" | "inferred_type" | "unique_count" | "numeric_stats" | "date_range" | "text_length_stats"
  >;
  worksheetName: string;
  trustedTableName: string;
};

type ClassificationRule = {
  category: AIColumnSensitivityCategory;
  level: AIColumnSensitivityLevel;
  reason: string;
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term));

const hasToken = (text: string, terms: string[]) => {
  const tokens = new Set(text.split(" ").filter(Boolean));
  return terms.some((term) => tokens.has(term));
};

const restrictedTerms = [
  "access code",
  "account number",
  "api key",
  "auth token",
  "bank account",
  "card number",
  "credential",
  "cvv",
  "iban",
  "mfa",
  "passcode",
  "password",
  "private key",
  "routing number",
  "secret",
  "security key",
  "ssn",
  "token",
];

const contactTerms = ["email", "e mail", "phone", "mobile", "cell", "fax"];
const nameTerms = [
  "first name",
  "last name",
  "full name",
  "employee name",
  "tenant name",
  "customer name",
  "client name",
  "patient name",
  "contact name",
  "person name",
];
const contextualPersonTerms = [
  "tenant",
  "employee",
  "customer",
  "client",
  "patient",
  "person",
  "contact",
];
const exactAddressTerms = ["address", "street", "apt", "apartment", "suite", "unit address"];
const locationTerms = [
  "zip",
  "zipcode",
  "postal",
  "city",
  "state",
  "location",
  "latitude",
  "longitude",
  "lat",
  "lon",
];
const financialTerms = [
  "payment",
  "rent",
  "salary",
  "payroll",
  "wage",
  "bank",
  "card",
  "invoice",
  "balance",
  "deposit",
  "fee",
  "charge",
  "amount due",
];
const healthTerms = [
  "diagnosis",
  "medical",
  "health",
  "hipaa",
  "patient",
  "treatment",
  "medication",
  "prescription",
  "insurance id",
  "date of birth",
  "dob",
];
const freeTextTerms = [
  "note",
  "notes",
  "comment",
  "comments",
  "description",
  "reason",
  "complaint",
  "message",
  "feedback",
];
const safeMetricTerms = [
  "count",
  "total",
  "category",
  "status",
  "date",
  "month",
  "year",
  "quantity",
  "qty",
  "score",
  "rate",
];

const classifyByMetadata = (
  columnText: string,
  contextText: string,
  inferredType: SchemaColumn["inferred_type"],
): ClassificationRule => {
  const combinedText = `${columnText} ${contextText}`;

  if (includesAny(columnText, restrictedTerms)) {
    return {
      category: "access_or_security",
      level: "restricted",
      reason: "Column name matches access credential, security, account, token, or secret metadata.",
    };
  }

  if (includesAny(columnText, healthTerms) || includesAny(contextText, ["health", "medical", "patient"])) {
    return {
      category: "health_or_sensitive",
      level: "sensitive",
      reason: "Column or worksheet context suggests health, patient, or similarly sensitive data.",
    };
  }

  if (includesAny(columnText, contactTerms)) {
    return {
      category: "contact_information",
      level: "sensitive",
      reason: "Column name suggests direct contact information.",
    };
  }

  if (
    includesAny(columnText, nameTerms) ||
    (hasToken(columnText, ["name"]) && includesAny(combinedText, contextualPersonTerms))
  ) {
    return {
      category: "direct_personal_identifier",
      level: "sensitive",
      reason: "Column name suggests a direct person identifier.",
    };
  }

  if (includesAny(columnText, exactAddressTerms)) {
    return {
      category: "address_or_location",
      level: "sensitive",
      reason: "Column name suggests a street address or precise location.",
    };
  }

  if (includesAny(columnText, locationTerms)) {
    return {
      category: "address_or_location",
      level: "caution",
      reason: "Column name suggests location metadata that may become sensitive in context.",
    };
  }

  if (includesAny(columnText, financialTerms)) {
    return {
      category: "financial_or_payment",
      level: "sensitive",
      reason: "Column name suggests payment, rent, payroll, banking, or financial information.",
    };
  }

  if (includesAny(columnText, freeTextTerms) || inferredType === "text") {
    return {
      category: "free_text_sensitive",
      level: "caution",
      reason: "Free-text columns may contain private or sensitive details even when values are not inspected.",
    };
  }

  if (hasToken(columnText, ["id", "identifier", "uuid", "key"])) {
    return {
      category: "identifier",
      level: "caution",
      reason: "Column name suggests an identifier that may link records across systems.",
    };
  }

  if (
    includesAny(columnText, safeMetricTerms) ||
    inferredType === "numeric" ||
    inferredType === "date" ||
    inferredType === "boolean"
  ) {
    return {
      category: "safe_business_metric",
      level: "safe",
      reason: "Column metadata suggests an aggregate-friendly business field.",
    };
  }

  return {
    category: "unknown_needs_review",
    level: "caution",
    reason: "Column metadata is not specific enough for a safe classification.",
  };
};

export const classifySensitiveColumn = ({
  column,
  worksheetName,
  trustedTableName,
}: SensitiveColumnClassificationInput): AIColumnSensitivityClassification => {
  const rule = classifyByMetadata(
    normalize(column.name),
    normalize(`${worksheetName} ${trustedTableName}`),
    column.inferred_type,
  );
  const policy = getRedactionPolicyForSensitivity(rule.category, rule.level);

  return {
    category: rule.category,
    level: rule.level,
    policyLabels: policy.labels,
    allowedForMetadataOnly: policy.allowedForMetadataOnly,
    allowedForSqlPlanning: policy.allowedForSqlPlanning,
    requiresUserConsentForSamples: policy.requiresUserConsentForSamples,
    neverSendRawValues: policy.neverSendRawValues,
    reasons: [rule.reason],
  };
};
