import { getSqlConcept } from "../concepts";
import type { SqlConcept, SqlConceptId } from "../types";
import { scanSqlKeywords, type SqlKeywordMatch } from "./sqlKeywordScanner";

export type SqlConceptMatch = {
  concept: SqlConcept;
  match: SqlKeywordMatch;
};

const conceptByKeyword: Record<string, SqlConceptId> = {
  "INNER JOIN": "inner-join",
  "LEFT OUTER JOIN": "left-outer-join",
  "RIGHT OUTER JOIN": "right-outer-join",
  "FULL OUTER JOIN": "full-outer-join",
  WHERE: "where",
  "GROUP BY": "group-by",
  HAVING: "having",
  "ORDER BY": "order-by",
  "CASE WHEN": "case-when",
  AS: "aliases",
  COUNT: "aggregate-functions",
  SUM: "aggregate-functions",
  AVG: "aggregate-functions",
  MIN: "aggregate-functions",
  MAX: "aggregate-functions",
};

export const matchSqlConcepts = (sql: string): SqlConceptMatch[] =>
  scanSqlKeywords(sql)
    .map((match) => {
      const conceptId = conceptByKeyword[match.normalizedKeyword];
      return conceptId ? { concept: getSqlConcept(conceptId), match } : null;
    })
    .filter((match): match is SqlConceptMatch => Boolean(match));
