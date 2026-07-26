/**
 * T-11C-1 — Deterministic Business Intent Detection (v1).
 *
 * Pure function. No React, no state, no side effects, no backend calls, no
 * LLM. Given a free-text task prompt, classifies it into a stable
 * `BusinessIntentCategory` with confidence-driven alternates, plus extracted
 * entities, metrics, grouping targets, relationship predicate, and a temporal
 * flag.
 *
 * This is the falsifier slice for T-11C — every later slice (candidate
 * normalization, grounding validator, recommender integration, UI surfacing)
 * reads `BusinessIntent` from this module. Acceptance prompts are listed in
 * the companion fixtures file at `__tests__/businessIntentGrounding.test.ts`
 * and must pass before merging T-11C-2 onwards.
 *
 * Detection model
 * ---------------
 * 1. Lowercase + collapse whitespace.
 * 2. Run a scorer per category — each returns a confidence in [0, 1]. Scorers
 *    rely on substring/regex matching against documented keyword families.
 * 3. Compute composite categories (count_grouping) when their constituents
 *    co-fire above a per-component threshold.
 * 4. Apply precedence rules: when a strong specific intent fires (expiration,
 *    missing_values, preview, duplicates), suppress overlapping generic
 *    intents (grouping, count_grouping) so a temporal "in the next 90 days"
 *    doesn't masquerade as a "group by" clause.
 * 5. Sort scores. If top score < 0.40, return primaryIntent = "unknown" with
 *    sub-threshold categories as alternates. Otherwise, primary = highest
 *    score, alternates = categories within 0.15 of the primary (and >= 0.40).
 *
 * No category is ever inferred from the prompt's surrounding workbook
 * metadata — this module is intentionally context-free so it can be reused
 * later by the grounding validator without circular dependencies.
 */

export type BusinessIntentCategory =
  | "count"
  | "count_grouping"
  | "grouping"
  | "trend"
  | "expiration"
  | "renewal"
  | "risk"
  | "missing_values"
  | "duplicates"
  | "join_lookup"
  | "ranking"
  | "top_bottom"
  | "filtering"
  | "preview"
  | "unknown";

export type BusinessIntent = {
  primaryIntent: BusinessIntentCategory;
  alternates: BusinessIntentCategory[];
  entities: string[];
  metrics: string[];
  grouping: string[];
  analysisPath?: BusinessIntentAnalysisPath | null;
  relationshipPredicate: string | null;
  explicitlyTemporal: boolean;
  detectorVersion: "v1";
};

export type BusinessIntentAggregation = "sum" | "average" | "minimum" | "maximum";

export type BusinessIntentAnalysisPath = {
  aggregation: BusinessIntentAggregation;
  measureField: string;
  groupingField: string;
  orderDirection: "ascending" | "descending";
  rowLimit: number | null;
};

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const PRIMARY_THRESHOLD = 0.4;
const ALTERNATE_DELTA = 0.15;
const ALTERNATE_FLOOR = 0.4;
const UNKNOWN_ALTERNATE_FLOOR = 0.3;

// Time-unit nouns. When preceded by a quantifier like "next", "last", "past",
// "previous", "coming", or a digit, an `in X` phrase is treated as a temporal
// expression rather than a grouping marker.
const TIME_UNITS = [
  "day",
  "days",
  "week",
  "weeks",
  "month",
  "months",
  "quarter",
  "quarters",
  "year",
  "years",
  "hour",
  "hours",
  "minute",
  "minutes",
];

// Known workbook-scope entity nouns. Singular forms; pluralization handled by
// suffix matching. Verb forms map to their canonical noun (`leased` → leases).
const ENTITY_NOUNS: Array<{ token: string; plural: string }> = [
  { token: "property", plural: "properties" },
  { token: "unit", plural: "units" },
  { token: "lease", plural: "leases" },
  { token: "tenant", plural: "tenants" },
  { token: "access", plural: "access" },
  { token: "code", plural: "codes" },
  { token: "manager", plural: "managers" },
  { token: "vendor", plural: "vendors" },
  { token: "customer", plural: "customers" },
  { token: "order", plural: "orders" },
  { token: "payment", plural: "payments" },
  { token: "charge", plural: "charges" },
  { token: "balance", plural: "balances" },
  { token: "contract", plural: "contracts" },
  { token: "product", plural: "products" },
  { token: "sku", plural: "skus" },
  { token: "stock", plural: "stock" },
  { token: "inventory", plural: "inventory" },
  { token: "item", plural: "items" },
  { token: "account", plural: "accounts" },
  { token: "ticket", plural: "tickets" },
  { token: "case", plural: "cases" },
  { token: "employee", plural: "employees" },
  { token: "department", plural: "departments" },
  { token: "headcount", plural: "headcount" },
  { token: "turnover", plural: "turnover" },
  { token: "patient", plural: "patients" },
  { token: "visit", plural: "visits" },
  { token: "provider", plural: "providers" },
  { token: "encounter", plural: "encounters" },
  { token: "maintenance", plural: "maintenance" },
  { token: "repair", plural: "repairs" },
  { token: "violation", plural: "violations" },
  { token: "deposit", plural: "deposits" },
  { token: "invoice", plural: "invoices" },
  { token: "complaint", plural: "complaints" },
  { token: "renewal", plural: "renewals" },
];

const VERB_TO_ENTITY: Record<string, string> = {
  leased: "leases",
  leasing: "leases",
  renting: "leases",
  rented: "leases",
};

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

const normalizePrompt = (prompt: string): string =>
  prompt.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

const includes = (text: string, needle: string): boolean => text.includes(needle);

const matches = (text: string, pattern: RegExp): boolean => pattern.test(text);

// `in <token>` is temporal when the token (or its quantifier) is a time unit
// preceded by a quantifier ("the next 90 days", "in 30 days").
const TEMPORAL_IN_PATTERN = new RegExp(
  `\\b(?:in|within) (?:the (?:next|last|past|previous|coming) )?(?:\\d+\\s+)?(?:${TIME_UNITS.join("|")})\\b`,
  "i",
);

// `in <noun>` grouping pattern — captures the noun after "in " when it's not
// part of a temporal expression.
const GROUPING_IN_PATTERN = /\bin\s+(?:the\s+)?([a-z_]+)/i;

const BY_GROUPING_PATTERN = /\bby\s+([a-z_]+)/i;
const PER_GROUPING_PATTERN = /\bper\s+([a-z_]+)/i;

// --------------------------------------------------------------------------
// Per-category scorers
// --------------------------------------------------------------------------

const scorePreview = (text: string): number => {
  if (matches(text, /^\s*preview\b/)) return 1.0;
  if (includes(text, "preview the ")) return 1.0;
  if (includes(text, "preview ")) return 0.85;
  if (matches(text, /\bshow (me )?the [a-z_]+ table\b/)) return 0.7;
  if (matches(text, /\bdescribe (the )?[a-z_]+ (table|columns)\b/)) return 0.65;
  if (includes(text, "first rows") || includes(text, "first few rows")) return 0.7;
  if (includes(text, "look at the data")) return 0.5;
  return 0;
};

const scoreCount = (text: string): number => {
  if (includes(text, "the number of") || includes(text, "number of")) return 0.75;
  if (includes(text, "count of") || includes(text, "count the")) return 0.75;
  if (includes(text, "how many")) return 0.85;
  if (includes(text, "total number") || includes(text, "total count")) return 0.8;
  if (matches(text, /\btally\b/)) return 0.6;
  return 0;
};

const scoreGrouping = (text: string): number => {
  // Strong grouping markers
  if (includes(text, "grouped by")) return 0.9;
  if (includes(text, "broken down by") || includes(text, "broken out by")) return 0.85;
  if (includes(text, "for each ")) return 0.75;
  // `by <noun>` — accept only when followed by a non-time token, or accept
  // generally since `by month/year/quarter` are legitimate grouping fields.
  if (BY_GROUPING_PATTERN.test(text)) return 0.55;
  // `per <noun>`
  if (PER_GROUPING_PATTERN.test(text)) return 0.55;
  // `in <noun>` — only when the phrase is NOT a temporal expression.
  if (!TEMPORAL_IN_PATTERN.test(text) && GROUPING_IN_PATTERN.test(text)) return 0.45;
  return 0;
};

const scoreTrend = (text: string): number => {
  if (matches(text, /\btrend(s|ed|ing)?\b/)) return 0.85;
  if (includes(text, "over time")) return 0.85;
  if (includes(text, "month by month") || includes(text, "year by year")) return 0.85;
  if (includes(text, "year over year") || matches(text, /\byoy\b/)) return 0.85;
  if (matches(text, /\bgrowth\b/)) return 0.7;
  if (matches(text, /\bdecline\b/)) return 0.7;
  return 0;
};

const scoreExpiration = (text: string): number => {
  if (includes(text, "days to expiry") || includes(text, "days to expiration")) return 0.95;
  if (matches(text, /\bexpir(e|es|ed|ing|ation|y)\b/)) return 0.85;
  if (includes(text, "end of lease") || includes(text, "lease end")) return 0.85;
  if (matches(text, /\bmove[- ]?out\b/)) return 0.85;
  if (includes(text, "watchlist")) return 0.8;
  if (includes(text, "ending soon") || includes(text, "ends soon")) return 0.75;
  if (includes(text, "due to end")) return 0.75;
  return 0;
};

const scoreRenewal = (text: string): number => {
  if (matches(text, /\brenewal(s)?\b/)) return 0.9;
  if (matches(text, /\brenew(s|ed|ing)?\b/)) return 0.85;
  return 0;
};

const scoreRisk = (text: string): number => {
  if (matches(text, /\brisk(s|y)?\b/)) return 0.85;
  if (includes(text, "security gap") || includes(text, "security gaps")) return 0.85;
  if (includes(text, "exposure")) return 0.7;
  if (matches(text, /\boverdue\b/)) return 0.75;
  if (includes(text, "low stock")) return 0.75;
  if (includes(text, "high turnover")) return 0.75;
  if (matches(text, /\bdefault(s|ed|ing)?\b/)) return 0.65;
  if (includes(text, "delinquent")) return 0.75;
  return 0;
};

const scoreMissingValues = (text: string): number => {
  if (matches(text, /\bmissing\b/)) return 0.85;
  if (matches(text, /\bblank(s)?\b/)) return 0.75;
  if (matches(text, /\bnull(s)?\b/)) return 0.75;
  if (matches(text, /\bempty\b/)) return 0.7;
  if (includes(text, "no value") || includes(text, "no values")) return 0.7;
  if (includes(text, "without an email") || includes(text, "without a name")) return 0.65;
  return 0;
};

const scoreDuplicates = (text: string): number => {
  if (matches(text, /\bduplicate(s|d)?\b/)) return 0.85;
  if (includes(text, "distinct count") || includes(text, "unique count")) return 0.8;
  if (matches(text, /\bdedup(licate)?(s|ed|ing)?\b/)) return 0.85;
  return 0;
};

const scoreJoinLookup = (text: string): number => {
  if (includes(text, "joined with")) return 0.8;
  if (includes(text, "linked to")) return 0.7;
  if (includes(text, "with their ")) return 0.6;
  if (includes(text, "and their ")) return 0.6;
  return 0;
};

const scoreRanking = (text: string): number => {
  if (matches(text, /\brank(s|ed|ing)?\b/)) return 0.85;
  if (includes(text, "leaderboard")) return 0.85;
  if (matches(text, /\bbest\b/) || matches(text, /\bworst\b/)) return 0.65;
  return 0;
};

const scoreTopBottom = (text: string): number => {
  if (matches(text, /\btop\s+\d+\b/)) return 0.95;
  if (matches(text, /\bbottom\s+\d+\b/)) return 0.95;
  if (matches(text, /\btop\s+[a-z]+\b/)) return 0.7;
  if (matches(text, /\bbottom\s+[a-z]+\b/)) return 0.7;
  if (matches(text, /\bhighest\b/)) return 0.7;
  if (matches(text, /\blowest\b/)) return 0.7;
  return 0;
};

const scoreFiltering = (text: string): number => {
  if (matches(text, /^which\b/)) return 0.65;
  if (
    matches(
      text,
      /\bwhich\s+(properties|units|leases|tenants|managers|vendors|customers|orders|payments|invoices|products|skus|items|accounts|tickets|cases|employees|departments|patients|visits|providers|encounters)\b/,
    )
  )
    return 0.65;
  if (includes(text, "that have")) return 0.5;
  if (includes(text, "that are")) return 0.45;
  if (matches(text, /\b(have|has|had)\s+/)) return 0.45;
  if (matches(text, /\bwhere\s+/) && !matches(text, /\bwhere\s+(is|are|do)\b/)) return 0.6;
  if (includes(text, "with status")) return 0.65;
  if (includes(text, "with type")) return 0.6;
  if (includes(text, "no recent") || includes(text, "missing recent") || includes(text, "without recent")) return 0.65;
  if (matches(text, /\bunresolved\b/)) return 0.65;
  if (includes(text, "low stock")) return 0.65;
  if (includes(text, "selling fast") || includes(text, "fast selling")) return 0.6;
  if (includes(text, "high turnover")) return 0.65;
  if (matches(text, /\boverdue\b/)) return 0.65;
  if (includes(text, "matching ")) return 0.5;
  if (matches(text, /\bvacant\b/)) return 0.55;
  if (matches(text, /\boccupied\b/)) return 0.55;
  return 0;
};

// --------------------------------------------------------------------------
// Entity / metric / grouping extraction
// --------------------------------------------------------------------------

const detectEntities = (text: string): string[] => {
  const found = new Set<string>();
  // Tokenize and match plurals/singulars.
  const tokens = text.split(/[^a-z_]+/g).filter(Boolean);
  for (const token of tokens) {
    for (const noun of ENTITY_NOUNS) {
      if (token === noun.token || token === noun.plural) {
        found.add(noun.plural);
      }
    }
    if (VERB_TO_ENTITY[token]) {
      found.add(VERB_TO_ENTITY[token]);
    }
  }
  if (matches(text, /\b(salary|salaries|payroll|compensation)\b/)) {
    found.add("employees");
  }
  return Array.from(found);
};

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const detectRowLimit = (text: string): number | null => {
  const digitMatch =
    text.match(/\b(?:top|bottom)\s+(\d{1,3})\b/) ||
    text.match(/\b(?:show|list|find|identify)\s+(?:the\s+)?(\d{1,3})\b/);
  if (digitMatch) return Number(digitMatch[1]);

  const wordAlternation = Object.keys(numberWords).join("|");
  const wordPattern = new RegExp(
    `\\b(?:top|bottom)\\s+(${wordAlternation})\\b|\\b(?:show|list|find|identify)\\s+(?:the\\s+)?(${wordAlternation})\\b`,
  );
  const wordMatch = text.match(wordPattern);
  const word = wordMatch?.[1] || wordMatch?.[2];
  return word ? numberWords[word] : null;
};

const singularizePhrase = (value: string): string =>
  value
    .split(/\s+/g)
    .map((part) => {
      if (part.endsWith("ies")) return `${part.slice(0, -3)}y`;
      if (part.endsWith("ses")) return part.slice(0, -2);
      if (part.endsWith("s") && part.length > 3) return part.slice(0, -1);
      return part;
    })
    .join(" ");

const trimFieldConcept = (value: string): string => {
  const stopWords = new Set([
    "by",
    "per",
    "in",
    "for",
    "from",
    "with",
    "where",
    "ordered",
    "sorted",
  ]);
  const trailingDescriptors = new Set([
    "expenditure",
    "expenditures",
    "expense",
    "expenses",
    "spend",
    "spending",
  ]);
  const words = value
    .replace(/[_-]+/g, " ")
    .split(/\s+/g)
    .map((word) => word.trim())
    .filter(Boolean);
  const stopped = words.slice(0, words.findIndex((word) => stopWords.has(word)) >= 0
    ? words.findIndex((word) => stopWords.has(word))
    : words.length);
  while (stopped.length > 1 && trailingDescriptors.has(stopped[stopped.length - 1])) {
    stopped.pop();
  }
  return singularizePhrase(stopped.join(" "));
};

const explicitAggregationFor = (text: string): BusinessIntentAggregation | null => {
  if (matches(text, /\b(average|avg|mean)\b/)) return "average";
  if (matches(text, /\b(total|sum)\b/)) return "sum";
  if (matches(text, /\b(minimum|min)\b/)) return "minimum";
  if (matches(text, /\b(maximum|max)\b/)) return "maximum";
  return null;
};

const aggregateFieldConceptFor = (text: string): string | null => {
  const aggregateFieldMatch = text.match(
    /\b(?:total|sum|average|avg|mean|minimum|min|maximum|max)\s+(?:of\s+)?([a-z_]+(?:[\s_-]+[a-z_]+){0,3})\b/,
  );
  const orderedFieldMatch = text.match(
    /\b(?:highest|top|lowest|bottom)\s+(?:of\s+)?([a-z_]+(?:[\s_-]+[a-z_]+){0,3})\b/,
  );
  const field = trimFieldConcept(aggregateFieldMatch?.[1] || orderedFieldMatch?.[1] || "");
  return field || null;
};

const groupingFieldConceptFor = (text: string): string | null => {
  const byMatch = text.match(BY_GROUPING_PATTERN);
  if (byMatch) return singularizePhrase(byMatch[1]);
  const perMatch = text.match(PER_GROUPING_PATTERN);
  if (perMatch) return singularizePhrase(perMatch[1]);
  if (!TEMPORAL_IN_PATTERN.test(text)) {
    const inMatch = text.match(GROUPING_IN_PATTERN);
    if (inMatch && !TIME_UNITS.includes(inMatch[1])) return singularizePhrase(inMatch[1]);
  }
  for (const noun of ENTITY_NOUNS) {
    if (matches(text, new RegExp(`\\b${noun.plural}\\b`))) return noun.token;
  }
  return null;
};

const detectAnalysisPath = (text: string): BusinessIntentAnalysisPath | null => {
  const aggregation = explicitAggregationFor(text);
  const measureField = aggregateFieldConceptFor(text);
  const groupingField = groupingFieldConceptFor(text);
  if (!aggregation || !measureField || !groupingField) return null;

  const orderDirection =
    matches(text, /\b(bottom|lowest|minimum|min)\b/) && !matches(text, /\b(highest|maximum|max|top)\b/)
      ? "ascending"
      : "descending";

  return {
    aggregation,
    measureField,
    groupingField,
    orderDirection,
    rowLimit: detectRowLimit(text),
  };
};

const metricNameForAnalysisPath = (analysisPath: BusinessIntentAnalysisPath): string =>
  `${analysisPath.aggregation}_${analysisPath.measureField.replace(/\s+/g, "_")}`;

const detectMetrics = (text: string, entities: string[]): string[] => {
  const metrics: string[] = [];
  // Count metric — when `number of <entity>` / `count of <entity>` / `how many <entity>`
  const countOfMatch = text.match(/(?:number of|count of|how many)\s+([a-z_]+)/);
  if (countOfMatch) {
    const target = countOfMatch[1];
    // Match the captured noun against entities (plural or singular).
    const entityMatch =
      entities.find((entity) => entity === target) ||
      ENTITY_NOUNS.find((noun) => noun.token === target || noun.plural === target)?.plural;
    if (entityMatch) {
      metrics.push(`count_${entityMatch}`);
    } else {
      metrics.push(`count_${target}`);
    }
  }
  // Volume / total / sum — pattern like "by payment volume", "total payments"
  if (matches(text, /\bpayment volume\b/)) metrics.push("payment_volume");
  if (matches(text, /\btotal payments?\b/)) metrics.push("total_payments");
  if (matches(text, /\bheadcount\b/)) metrics.push("count_employees");
  if (matches(text, /\bturnover\b/)) metrics.push("turnover");
  if (matches(text, /\baverage [a-z_]+\b/)) {
    const avgMatch = text.match(/\baverage\s+([a-z_]+)\b/);
    if (avgMatch) metrics.push(`avg_${avgMatch[1]}`);
  }
  return metrics;
};

const detectGroupingTargets = (text: string, suppress: boolean): string[] => {
  if (suppress) return [];
  const targets = new Set<string>();
  const byMatch = text.match(BY_GROUPING_PATTERN);
  if (byMatch) targets.add(byMatch[1]);
  const perMatch = text.match(PER_GROUPING_PATTERN);
  if (perMatch) targets.add(perMatch[1]);
  if (!TEMPORAL_IN_PATTERN.test(text)) {
    const inMatch = text.match(GROUPING_IN_PATTERN);
    if (inMatch && !TIME_UNITS.includes(inMatch[1])) {
      targets.add(inMatch[1]);
    }
  }
  return Array.from(targets);
};

const RELATIONSHIP_PATTERNS: Array<{ regex: RegExp; predicate: string }> = [
  { regex: /\bleased to\s+(tenant|tenants)\b/, predicate: "leased_to_tenants" },
  { regex: /\bowned by\s+(manager|managers|owner|owners)\b/, predicate: "owned_by_managers" },
  { regex: /\bmanaged by\s+(manager|managers|owner|owners)\b/, predicate: "managed_by_managers" },
  { regex: /\brented to\s+(tenant|tenants)\b/, predicate: "rented_to_tenants" },
  { regex: /\boccupied by\s+(tenant|tenants)\b/, predicate: "occupied_by_tenants" },
];

const detectRelationshipPredicate = (text: string): string | null => {
  for (const pattern of RELATIONSHIP_PATTERNS) {
    if (pattern.regex.test(text)) return pattern.predicate;
  }
  return null;
};

const detectExplicitlyTemporal = (text: string): boolean => {
  if (TEMPORAL_IN_PATTERN.test(text)) return true;
  if (matches(text, /\bexpir(e|es|ed|ing|ation|y)\b/)) return true;
  if (matches(text, /\brenewal(s)?\b/) || matches(text, /\brenew(s|ed|ing)?\b/)) return true;
  if (matches(text, /\btrend(s|ed|ing)?\b/) || includes(text, "over time")) return true;
  if (includes(text, "recent") || includes(text, "overdue")) return true;
  if (matches(text, /\b(today|yesterday|tomorrow)\b/)) return true;
  if (matches(text, /\b(year over year|month by month|yoy)\b/)) return true;
  return false;
};

// --------------------------------------------------------------------------
// Main entry — detectBusinessIntent
// --------------------------------------------------------------------------

export const EMPTY_BUSINESS_INTENT: BusinessIntent = {
  primaryIntent: "unknown",
  alternates: [],
  entities: [],
  metrics: [],
  grouping: [],
  analysisPath: null,
  relationshipPredicate: null,
  explicitlyTemporal: false,
  detectorVersion: "v1",
};

export type BusinessIntentAmbiguity = {
  isAmbiguous: boolean;
  reason: "none" | "unknown_with_alternates" | "close_alternates";
  reviewIntents: BusinessIntentCategory[];
};

const sortedUnique = (values: readonly string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();

export function describeBusinessIntentAmbiguity(
  intent: BusinessIntent,
): BusinessIntentAmbiguity {
  if (intent.primaryIntent === "unknown" && intent.alternates.length > 0) {
    return {
      isAmbiguous: true,
      reason: "unknown_with_alternates",
      reviewIntents: sortedUnique(intent.alternates) as BusinessIntentCategory[],
    };
  }

  if (intent.alternates.length > 0) {
    return {
      isAmbiguous: true,
      reason: "close_alternates",
      reviewIntents: sortedUnique([
        intent.primaryIntent,
        ...intent.alternates,
      ]) as BusinessIntentCategory[],
    };
  }

  return { isAmbiguous: false, reason: "none", reviewIntents: [] };
}

export function fingerprintBusinessIntent(intent: BusinessIntent): string {
  return JSON.stringify({
    primaryIntent: intent.primaryIntent,
    alternates: sortedUnique(intent.alternates),
    entities: sortedUnique(intent.entities),
    metrics: sortedUnique(intent.metrics),
    grouping: sortedUnique(intent.grouping),
    analysisPath: intent.analysisPath,
    relationshipPredicate: intent.relationshipPredicate,
    explicitlyTemporal: intent.explicitlyTemporal,
    detectorVersion: intent.detectorVersion,
  });
}

export const EMPTY_BUSINESS_INTENT_FINGERPRINT = fingerprintBusinessIntent(
  EMPTY_BUSINESS_INTENT,
);

export function detectBusinessIntent(taskPrompt: string): BusinessIntent {
  if (!taskPrompt || !taskPrompt.trim()) return EMPTY_BUSINESS_INTENT;
  const text = normalizePrompt(taskPrompt);
  if (!text) return EMPTY_BUSINESS_INTENT;

  // Compute raw per-category scores.
  const scores: Record<BusinessIntentCategory, number> = {
    count: scoreCount(text),
    count_grouping: 0,
    grouping: scoreGrouping(text),
    trend: scoreTrend(text),
    expiration: scoreExpiration(text),
    renewal: scoreRenewal(text),
    risk: scoreRisk(text),
    missing_values: scoreMissingValues(text),
    duplicates: scoreDuplicates(text),
    join_lookup: scoreJoinLookup(text),
    ranking: scoreRanking(text),
    top_bottom: scoreTopBottom(text),
    filtering: scoreFiltering(text),
    preview: scorePreview(text),
    unknown: 0,
  };

  // Composite: count_grouping fires when both count and grouping are above
  // their per-component thresholds. We boost above either constituent so the
  // composite wins over its parts.
  if (scores.count >= 0.4 && scores.grouping >= 0.3) {
    scores.count_grouping = Math.min(0.98, Math.max(scores.count, scores.grouping) + 0.2);
  }

  // Precedence — when a strong specific intent fires, suppress the generic
  // grouping/count_grouping/filtering signals it would have spuriously
  // produced from temporal or value-presence wording.
  if (scores.expiration >= 0.6) {
    scores.grouping = 0;
    scores.count_grouping = 0;
  }
  if (scores.missing_values >= 0.6) {
    scores.grouping = 0;
    scores.count_grouping = 0;
    scores.filtering = Math.min(scores.filtering, 0.3);
  }
  if (scores.preview >= 0.8) {
    scores.grouping = 0;
    scores.count_grouping = 0;
    scores.filtering = 0;
  }
  if (scores.duplicates >= 0.6) {
    scores.grouping = 0;
    scores.count_grouping = 0;
  }
  // top_bottom subsumes ranking when both fire; ranking can stay as alternate.
  if (scores.top_bottom >= 0.7 && scores.ranking < scores.top_bottom) {
    // Leave ranking score so it can become an alternate; do not zero it.
  }

  // Determine primary + alternates.
  const ranked = (Object.entries(scores) as Array<[BusinessIntentCategory, number]>)
    .filter(([category]) => category !== "unknown")
    .sort((a, b) => b[1] - a[1]);
  const topScore = ranked.length > 0 ? ranked[0][1] : 0;

  let primaryIntent: BusinessIntentCategory;
  let alternates: BusinessIntentCategory[];

  if (topScore < PRIMARY_THRESHOLD) {
    primaryIntent = "unknown";
    alternates = ranked
      .filter(([, score]) => score >= UNKNOWN_ALTERNATE_FLOOR)
      .map(([category]) => category);
  } else {
    primaryIntent = ranked[0][0];
    const alternateFloor = Math.max(ALTERNATE_FLOOR, topScore - ALTERNATE_DELTA);
    alternates = ranked
      .slice(1)
      .filter(([, score]) => score >= alternateFloor)
      .map(([category]) => category);
  }

  const entities = detectEntities(text);
  const analysisPath = detectAnalysisPath(text);
  const detectedMetrics = detectMetrics(text, entities);
  const analysisMetric = analysisPath ? metricNameForAnalysisPath(analysisPath) : null;
  const metrics = analysisMetric
    ? [analysisMetric]
    : detectedMetrics;
  const detectedGrouping = detectGroupingTargets(
    text,
    scores.expiration >= 0.6 ||
      scores.missing_values >= 0.6 ||
      scores.preview >= 0.8 ||
      scores.duplicates >= 0.6,
  );
  const grouping = analysisPath && !detectedGrouping.includes(analysisPath.groupingField)
    ? [...detectedGrouping, analysisPath.groupingField]
    : detectedGrouping;
  const relationshipPredicate = detectRelationshipPredicate(text);
  const explicitlyTemporal = detectExplicitlyTemporal(text);

  return {
    primaryIntent,
    alternates,
    entities,
    metrics,
    grouping,
    analysisPath,
    relationshipPredicate,
    explicitlyTemporal,
    detectorVersion: "v1",
  };
}
