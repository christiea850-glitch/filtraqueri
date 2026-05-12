import type { SqlConceptId, SqlDialectId } from "../types";
import { clausePresenceRules } from "./sqlValidationRules";
import type { SqlValidationDiagnostic, SqlValidationRule } from "./sqlValidationTypes";

const createRuleDiagnostics = (
  sql: string,
  dialect: SqlDialectId,
  rules: SqlValidationRule[],
): SqlValidationDiagnostic[] =>
  rules.flatMap((rule) =>
    [...sql.matchAll(rule.pattern)].map((match) => {
      const start = match.index || 0;

      return {
        ruleId: rule.ruleId,
        severity: rule.severity,
        category: rule.category,
        message: rule.message,
        location: {
          start,
          end: start + match[0].length,
        },
        dialect,
        concept: rule.concept || null,
        suggestedAction: rule.suggestedAction,
      };
    }),
  );

const findKeyword = (sql: string, pattern: RegExp) => {
  const match = pattern.exec(sql);
  return match ? { start: match.index, end: match.index + match[0].length } : null;
};

const createStructureDiagnostic = ({
  ruleId,
  message,
  suggestedAction,
  start,
  end,
  dialect,
  concept = null,
}: {
  ruleId: string;
  message: string;
  suggestedAction: string;
  start: number;
  end: number;
  dialect: SqlDialectId;
  concept?: SqlConceptId | null;
}): SqlValidationDiagnostic => ({
  ruleId,
  severity: "warning",
  category: "structure",
  message,
  location: { start, end },
  dialect,
  concept,
  suggestedAction,
});

export const validateSqlClauses = (
  sql: string,
  dialect: SqlDialectId,
): SqlValidationDiagnostic[] => {
  const trimmedSql = sql.trim();
  if (!trimmedSql) return [];

  const selectKeyword = findKeyword(sql, /\bSELECT\b/i);
  const fromKeyword = findKeyword(sql, /\bFROM\b/i);
  const whereKeyword = findKeyword(sql, /\bWHERE\b/i);
  const groupByKeyword = findKeyword(sql, /\bGROUP\s+BY\b/i);
  const havingKeyword = findKeyword(sql, /\bHAVING\b/i);
  const orderByKeyword = findKeyword(sql, /\bORDER\s+BY\b/i);
  const limitKeyword = findKeyword(sql, /\bLIMIT\s+\d+\b/i);
  const fetchKeyword = findKeyword(sql, /\bFETCH\s+FIRST\s+\d+\s+ROWS?\s+ONLY\b/i);
  const diagnostics = createRuleDiagnostics(sql, dialect, clausePresenceRules);

  if (!selectKeyword) {
    diagnostics.push(
      createStructureDiagnostic({
        ruleId: "structure-missing-select",
        message: "No SELECT clause was found.",
        suggestedAction: "Start analytical SQL with SELECT.",
        start: 0,
        end: Math.min(trimmedSql.length, 1),
        dialect,
      }),
    );
  }

  if (selectKeyword && !fromKeyword) {
    diagnostics.push(
      createStructureDiagnostic({
        ruleId: "structure-missing-from",
        message: "No FROM clause was found.",
        suggestedAction: "Choose the active dataset table in the FROM clause.",
        start: selectKeyword.start,
        end: selectKeyword.end,
        dialect,
      }),
    );
  }

  if (havingKeyword && !groupByKeyword) {
    diagnostics.push(
      createStructureDiagnostic({
        ruleId: "structure-having-without-group-by",
        message: "HAVING is usually paired with GROUP BY and aggregate functions.",
        suggestedAction: "Add GROUP BY or move row-level filters into WHERE.",
        start: havingKeyword.start,
        end: havingKeyword.end,
        dialect,
        concept: "having",
      }),
    );
  }

  if (whereKeyword && groupByKeyword && whereKeyword.start > groupByKeyword.start) {
    diagnostics.push(
      createStructureDiagnostic({
        ruleId: "structure-where-after-group-by",
        message: "WHERE normally appears before GROUP BY.",
        suggestedAction: "Move row-level filters before GROUP BY.",
        start: whereKeyword.start,
        end: whereKeyword.end,
        dialect,
        concept: "where",
      }),
    );
  }

  if (orderByKeyword && groupByKeyword && orderByKeyword.start < groupByKeyword.start) {
    diagnostics.push(
      createStructureDiagnostic({
        ruleId: "structure-order-before-group-by",
        message: "ORDER BY normally appears after GROUP BY and HAVING.",
        suggestedAction: "Move ORDER BY near the end of the query.",
        start: orderByKeyword.start,
        end: orderByKeyword.end,
        dialect,
        concept: "order-by",
      }),
    );
  }

  if (limitKeyword && fetchKeyword) {
    diagnostics.push(
      createStructureDiagnostic({
        ruleId: "structure-limit-and-fetch",
        message: "Both LIMIT and FETCH FIRST were found.",
        suggestedAction: "Use one row-limiting style before a future translator adapts the query.",
        start: fetchKeyword.start,
        end: fetchKeyword.end,
        dialect,
      }),
    );
  }

  [...sql.matchAll(/\b(?:INNER|LEFT|RIGHT|FULL)?\s*(?:OUTER\s+)?JOIN\b/gi)].forEach((match) => {
    const start = match.index || 0;
    const nextClause = sql.slice(start).search(/\b(?:WHERE|GROUP\s+BY|HAVING|ORDER\s+BY|LIMIT|FETCH)\b/i);
    const joinSegment = nextClause > -1 ? sql.slice(start, start + nextClause) : sql.slice(start);
    if (!/\b(?:ON|USING)\b/i.test(joinSegment)) {
      diagnostics.push(
        createStructureDiagnostic({
          ruleId: "structure-join-without-condition",
          message: "JOIN was detected without an obvious ON or USING condition.",
          suggestedAction: "Add an ON or USING condition so the join relationship is explicit.",
          start,
          end: start + match[0].length,
          dialect,
          concept: "inner-join",
        }),
      );
    }
  });

  [...sql.matchAll(/\bAS\s*(,|\bFROM\b|\bWHERE\b|\bGROUP\s+BY\b|\bHAVING\b|\bORDER\s+BY\b|$)/gi)].forEach(
    (match) => {
      const start = match.index || 0;
      diagnostics.push(
        createStructureDiagnostic({
          ruleId: "structure-alias-without-name",
          message: "AS was detected without an obvious alias name.",
          suggestedAction: "Add a readable alias after AS.",
          start,
          end: start + match[0].length,
          dialect,
          concept: "aliases",
        }),
      );
    },
  );

  return diagnostics;
};
