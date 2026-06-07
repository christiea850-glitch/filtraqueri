import type { DatasetMetadata } from "../../dataset/datasetTypes";
import {
  createAnalysisScopeSelection,
  type AnalysisScopeSelection,
} from "../../workbook";
import type { WorksheetMetadata } from "../../workbook/workbookTypes";

export type SqlScopeRecommendation = {
  worksheetId: string;
  worksheetName: string;
  tableName: string;
  rowCount: number;
  columnCount: number;
  confidence: "Strong" | "Good" | "Possible";
  score: number;
  matchedColumns: string[];
  reasons: string[];
  selection: AnalysisScopeSelection;
};

type RecommendSqlScopeInput = {
  taskPrompt: string;
  dataset: DatasetMetadata | null;
  appliedScopeLabels?: string[];
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "being",
  "but",
  "by",
  "count",
  "current",
  "each",
  "find",
  "for",
  "from",
  "in",
  "into",
  "is",
  "list",
  "no",
  "not",
  "number",
  "of",
  "on",
  "or",
  "out",
  "recent",
  "report",
  "show",
  "the",
  "to",
  "with",
]);

const businessConcepts: Array<{
  concept: string;
  terms: string[];
  targets: string[];
  blockedWorksheetTerms?: string[];
}> = [
  {
    concept: "tenants",
    terms: ["tenant", "tenants", "resident", "residents", "occupant"],
    targets: ["tenant", "tenants", "resident", "occupant", "customer"],
    blockedWorksheetTerms: ["vendor", "vendors", "contract", "contracts", "supplier"],
  },
  {
    concept: "leases",
    terms: ["lease", "leases", "leased", "leasing", "rental", "rentals"],
    targets: ["lease", "leases", "leased", "rental", "rent", "start date", "end date", "expiration"],
    blockedWorksheetTerms: ["vendor", "vendors", "contract", "contracts", "supplier"],
  },
  {
    concept: "payments",
    terms: ["payment", "payments", "pay", "paid", "amount", "rent"],
    targets: ["payment", "payments", "paid", "amount", "balance", "invoice", "rent"],
  },
  {
    concept: "properties",
    terms: ["property", "properties", "building", "address", "property_type"],
    targets: ["property", "properties", "building", "address", "property type"],
    blockedWorksheetTerms: ["vendor", "vendors", "contract", "contracts", "supplier"],
  },
  {
    concept: "units",
    terms: ["unit", "units", "unit_number", "bed", "beds", "bath", "baths", "sqft", "floor"],
    targets: ["unit", "units", "unit number", "bed", "beds", "bath", "baths", "sqft", "floor"],
    blockedWorksheetTerms: ["vendor", "vendors", "contract", "contracts", "supplier"],
  },
  {
    concept: "managers",
    terms: ["manager", "managers", "contact", "email", "phone"],
    targets: ["manager", "managers", "contact", "email", "phone"],
  },
  {
    concept: "vendors or contracts",
    terms: ["vendor", "vendors", "contract", "contracts", "supplier", "suppliers", "service", "agreement"],
    targets: ["vendor", "vendors", "contract", "contracts", "supplier", "service", "agreement"],
  },
  {
    concept: "realtors",
    terms: ["realtor", "realtors", "agent", "agents", "contact", "email", "phone"],
    targets: ["realtor", "realtors", "agent", "agents", "contact", "email", "phone"],
  },
  {
    concept: "access or security",
    terms: ["access", "code", "codes", "security", "entry", "key"],
    targets: ["access", "code", "codes", "security", "entry", "key"],
  },
  {
    concept: "maintenance",
    terms: ["maintenance", "request", "requests", "repair", "repairs", "work", "order"],
    targets: ["maintenance", "request", "repair", "work", "order", "issue"],
  },
];

const conceptByName = new Map(businessConcepts.map((concept) => [concept.concept, concept]));

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_%()]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (value: string) =>
  normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));

const includesToken = (text: string, token: string) =>
  text.split(" ").some(
    (word) =>
      word === token ||
      word.startsWith(token) ||
      token.startsWith(word),
  );

const getWorksheetLabel = (worksheet: WorksheetMetadata) =>
  worksheet.displayName || worksheet.sheetName || worksheet.tableName;

const getWorksheetNameText = (worksheet: WorksheetMetadata) =>
  normalizeText([
    worksheet.displayName,
    worksheet.sheetName,
    worksheet.tableName,
  ].join(" "));

const getPromptConcepts = (tokens: string[]) =>
  businessConcepts.filter((concept) =>
    concept.terms.some((term) =>
      tokens.some((token) => token === term || term.startsWith(token) || token.startsWith(term)),
    ),
  );

const worksheetHasBlockedTermForConcept = (worksheetNameText: string, conceptName: string) => {
  const concept = conceptByName.get(conceptName);
  if (!concept?.blockedWorksheetTerms?.length) return false;
  return concept.blockedWorksheetTerms.some((term) => includesToken(worksheetNameText, term));
};

const worksheetHasExplicitPromptConcept = (worksheetNameText: string, promptConcepts: typeof businessConcepts) =>
  promptConcepts.some((concept) =>
    concept.targets.some((target) => includesToken(worksheetNameText, target)),
  );

const getSharedKeyBonus = (
  worksheet: WorksheetMetadata,
  allWorksheets: WorksheetMetadata[],
  promptTokens: string[],
) => {
  const keyColumns = worksheet.schema
    .map((column) => normalizeText(column.name))
    .filter((columnName) => columnName.endsWith(" id") || columnName.includes(" id "));
  if (keyColumns.length === 0) return 0;

  const promptMentionsRelatedWorksheet = allWorksheets.some((otherWorksheet) => {
    if (otherWorksheet.worksheetId === worksheet.worksheetId) return false;
    const otherLabel = normalizeText(getWorksheetLabel(otherWorksheet));
    return promptTokens.some((token) => includesToken(otherLabel, token));
  });

  return promptMentionsRelatedWorksheet ? Math.min(8, keyColumns.length * 2) : 0;
};

const confidenceFromScore = (score: number): SqlScopeRecommendation["confidence"] => {
  if (score >= 34) return "Strong";
  if (score >= 20) return "Good";
  return "Possible";
};

export const recommendSqlScope = ({
  taskPrompt,
  dataset,
  appliedScopeLabels = [],
}: RecommendSqlScopeInput): SqlScopeRecommendation[] => {
  const workbook = dataset?.workbook_metadata;
  const promptTokens = Array.from(new Set(tokenize(taskPrompt)));
  if (!workbook || promptTokens.length === 0) return [];

  const promptConcepts = getPromptConcepts(promptTokens);
  const normalizedAppliedScopeLabels = appliedScopeLabels.map(normalizeText).filter(Boolean);

  return workbook.worksheets
    .map((worksheet) => {
      const worksheetLabel = getWorksheetLabel(worksheet);
      const worksheetNameText = getWorksheetNameText(worksheet);
      const isVendorOrContractWorksheet =
        includesToken(worksheetNameText, "vendor") ||
        includesToken(worksheetNameText, "contract") ||
        includesToken(worksheetNameText, "supplier");
      const promptIncludesVendorOrContract = promptConcepts.some(
        (concept) => concept.concept === "vendors or contracts",
      );
      const normalizedColumns = worksheet.schema.map((column) => ({
        raw: column.name,
        normalized: normalizeText(column.name),
      }));
      const reasons: string[] = [];
      let score = 0;
      let directScore = 0;

      if (isVendorOrContractWorksheet && !promptIncludesVendorOrContract) {
        return {
          worksheetId: worksheet.worksheetId,
          worksheetName: worksheetLabel,
          tableName: worksheet.tableName,
          rowCount: worksheet.rowCount,
          columnCount: worksheet.columnCount,
          confidence: "Possible" as const,
          score: 0,
          directScore: 0,
          matchedColumns: [],
          reasons: ["Vendor or contract worksheet excluded because the task does not mention vendors or contracts."],
          selection: createAnalysisScopeSelection(workbook, worksheet),
        };
      }

      const matchedNameWords = promptTokens.filter((token) => includesToken(worksheetNameText, token));
      if (matchedNameWords.length > 0) {
        const nameScore = matchedNameWords.length * 9;
        score += nameScore;
        directScore += nameScore;
        reasons.push(`Direct worksheet/table name match: ${matchedNameWords.slice(0, 4).join(", ")}.`);
      }

      const matchedConcepts = promptConcepts.filter((concept) => {
        if (worksheetHasBlockedTermForConcept(worksheetNameText, concept.concept)) return false;
        const matchesWorksheetName = concept.targets.some((target) =>
          includesToken(worksheetNameText, target),
        );
        const conceptColumns = normalizedColumns.filter((column) =>
          concept.targets.some((target) => includesToken(column.normalized, target)),
        );
        const hasNonKeyConceptColumn = conceptColumns.some(
          (column) => !column.normalized.endsWith(" id") && !column.normalized.includes(" id "),
        );

        return matchesWorksheetName || conceptColumns.length >= 2 || hasNonKeyConceptColumn;
      });
      if (matchedConcepts.length > 0) {
        const conceptScore = matchedConcepts.length * 10;
        score += conceptScore;
        directScore += conceptScore;
        reasons.push(
          `Semantic concept match: ${matchedConcepts
            .map((concept) => concept.concept)
            .slice(0, 3)
            .join(", ")}.`,
        );
      }

      const matchedColumns = normalizedColumns
        .filter((column) => {
          const isKeyColumn =
            column.normalized.endsWith(" id") || column.normalized.includes(" id ");
          const directPromptColumnMatch = promptTokens.some((token) =>
            includesToken(column.normalized, token),
          );
          const conceptColumnMatch = promptConcepts.some((concept) =>
            !worksheetHasBlockedTermForConcept(worksheetNameText, concept.concept) &&
            concept.targets.some((target) => includesToken(column.normalized, target)),
          );

          return directPromptColumnMatch || (conceptColumnMatch && !isKeyColumn);
        })
        .map((column) => column.raw);
      if (matchedColumns.length > 0) {
        const columnScore = Math.min(matchedColumns.length, 5) * 6;
        score += columnScore;
        directScore += columnScore;
        reasons.push(`Direct column match: ${matchedColumns.slice(0, 4).join(", ")}.`);
      }

      const isAppliedScopeWorksheet = normalizedAppliedScopeLabels.some(
        (label) => includesToken(worksheetNameText, label) || worksheetNameText.includes(label),
      );
      if (isAppliedScopeWorksheet && directScore > 0) {
        score += 4;
        reasons.push("Already appears in this tab's applied scope.");
      }

      const sharedKeyBonus = getSharedKeyBonus(worksheet, workbook.worksheets, promptTokens);
      if (
        sharedKeyBonus > 0 &&
        directScore > 0 &&
        worksheetHasExplicitPromptConcept(worksheetNameText, promptConcepts)
      ) {
        score += sharedKeyBonus;
        reasons.push("Relationship support: has key-style columns that may connect to other mentioned worksheets.");
      }

      return {
        worksheetId: worksheet.worksheetId,
        worksheetName: worksheetLabel,
        tableName: worksheet.tableName,
        rowCount: worksheet.rowCount,
        columnCount: worksheet.columnCount,
        confidence: confidenceFromScore(score),
        score,
        directScore,
        matchedColumns: Array.from(new Set(matchedColumns)).slice(0, 5),
        reasons:
          reasons.length > 0
            ? reasons
            : ["Closest workbook worksheet based on available metadata."],
        selection: createAnalysisScopeSelection(workbook, worksheet),
      };
    })
    .filter((recommendation) => recommendation.directScore > 0 && recommendation.score >= 16)
    .sort((a, b) => b.score - a.score || a.worksheetName.localeCompare(b.worksheetName))
    .slice(0, 5);
};
