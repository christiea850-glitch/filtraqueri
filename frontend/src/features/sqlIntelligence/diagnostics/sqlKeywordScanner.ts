export type SqlKeywordMatch = {
  keyword: string;
  normalizedKeyword: string;
  start: number;
  end: number;
};

const keywordPatterns: Array<{ keyword: string; pattern: RegExp }> = [
  { keyword: "LEFT OUTER JOIN", pattern: /\bLEFT\s+(?:OUTER\s+)?JOIN\b/gi },
  { keyword: "RIGHT OUTER JOIN", pattern: /\bRIGHT\s+(?:OUTER\s+)?JOIN\b/gi },
  { keyword: "FULL OUTER JOIN", pattern: /\bFULL\s+(?:OUTER\s+)?JOIN\b/gi },
  { keyword: "INNER JOIN", pattern: /\b(?:INNER\s+)?JOIN\b/gi },
  { keyword: "GROUP BY", pattern: /\bGROUP\s+BY\b/gi },
  { keyword: "ORDER BY", pattern: /\bORDER\s+BY\b/gi },
  { keyword: "CASE WHEN", pattern: /\bCASE\s+WHEN\b/gi },
  { keyword: "HAVING", pattern: /\bHAVING\b/gi },
  { keyword: "WHERE", pattern: /\bWHERE\b/gi },
  { keyword: "AS", pattern: /\bAS\b/gi },
  { keyword: "COUNT", pattern: /\bCOUNT\s*\(/gi },
  { keyword: "SUM", pattern: /\bSUM\s*\(/gi },
  { keyword: "AVG", pattern: /\bAVG\s*\(/gi },
  { keyword: "MIN", pattern: /\bMIN\s*\(/gi },
  { keyword: "MAX", pattern: /\bMAX\s*\(/gi },
];

export const scanSqlKeywords = (sql: string): SqlKeywordMatch[] =>
  keywordPatterns
    .flatMap(({ keyword, pattern }) =>
      [...sql.matchAll(pattern)].map((match) => ({
        keyword,
        normalizedKeyword: keyword.toUpperCase(),
        start: match.index || 0,
        end: (match.index || 0) + match[0].length,
      })),
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);
