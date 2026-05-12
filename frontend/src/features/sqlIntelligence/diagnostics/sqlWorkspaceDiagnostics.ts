import { getSqlConceptExplanation, getSqlFunctionExplanation } from "../explanations/sqlExplanationRegistry";
import type { SqlConceptId, SqlDialectId } from "../types";
import { matchSqlConcepts } from "./sqlConceptMatcher";
import { createSqlDialectDiagnostics, type SqlIntelligenceDiagnostic } from "./sqlDialectDiagnostics";
import { matchSqlFunctions } from "./sqlFunctionMatcher";

export type SqlWorkspaceAnalysis = {
  diagnostics: SqlIntelligenceDiagnostic[];
  explanationCards: Array<{
    id: string;
    title: string;
    summary: string;
    detail: string;
  }>;
};

const conceptDiagnosticIds: Partial<Record<string, SqlConceptId>> = {
  "INNER JOIN": "inner-join",
  "LEFT OUTER JOIN": "left-outer-join",
  "RIGHT OUTER JOIN": "right-outer-join",
  "FULL OUTER JOIN": "full-outer-join",
  "GROUP BY": "group-by",
  HAVING: "having",
  "CASE WHEN": "case-when",
  AS: "aliases",
  COUNT: "aggregate-functions",
  SUM: "aggregate-functions",
  AVG: "aggregate-functions",
  MIN: "aggregate-functions",
  MAX: "aggregate-functions",
};

export const analyzeSqlWorkspaceDraft = (
  sql: string,
  sourceDialect: SqlDialectId = "duckdb",
): SqlWorkspaceAnalysis => {
  const conceptMatches = matchSqlConcepts(sql);
  const conceptDiagnostics = conceptMatches.map(({ concept, match }) => ({
    id: `concept-${concept.id}-${match.start}`,
    severity: "info" as const,
    title: concept.title,
    message: concept.summary,
    start: match.start,
    end: match.end,
    source: "concept" as const,
  }));
  const dialectDiagnostics = createSqlDialectDiagnostics(sql, sourceDialect);
  const diagnostics = [...conceptDiagnostics, ...dialectDiagnostics].sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );

  const conceptCards = Array.from(
    new Set(
      conceptMatches
        .map(({ match }) => conceptDiagnosticIds[match.normalizedKeyword])
        .filter((conceptId): conceptId is SqlConceptId => Boolean(conceptId)),
    ),
  ).map((conceptId) => {
    const explanation = getSqlConceptExplanation(conceptId);
    return {
      id: `concept-card-${conceptId}`,
      title: explanation.title,
      summary: explanation.summary,
      detail: explanation.beginnerNote,
    };
  });
  const functionCards = Array.from(
    new Set(matchSqlFunctions(sql).map((match) => match.compatibility.canonicalName)),
  )
    .map((functionName) => {
      const explanation = getSqlFunctionExplanation(functionName);
      return explanation
        ? {
            id: `function-card-${functionName}`,
            title: explanation.title,
            summary: explanation.summary,
            detail: explanation.beginnerNote,
          }
        : null;
    })
    .filter((card): card is SqlWorkspaceAnalysis["explanationCards"][number] => Boolean(card));

  return {
    diagnostics,
    explanationCards: [...conceptCards, ...functionCards].slice(0, 6),
  };
};
