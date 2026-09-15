import type { ReactNode } from "react";

/**
 * Minimal, dependency-free syntax highlighter for Sordi IQ's fenced code
 * blocks — covers exactly what the assistant's own system prompt says it
 * may produce (SQL/Prisma database queries), not a general-purpose
 * highlighter. No prismjs/highlight.js/shiki install for this pass; same
 * philosophy as sordiIqMarkdown.tsx's own hand-rolled renderer.
 */

const SQL_KEYWORDS = new Set([
  "select", "from", "where", "and", "or", "not", "in", "is", "null", "as",
  "join", "left", "right", "inner", "outer", "on", "group", "by", "order",
  "having", "limit", "offset", "insert", "into", "values", "update", "set",
  "delete", "create", "table", "index", "distinct", "count", "sum", "avg",
  "min", "max", "case", "when", "then", "else", "end", "like", "between",
  "asc", "desc", "union", "all", "exists",
]);

const PRISMA_KEYWORDS = new Set([
  "model", "enum", "datasource", "generator", "findmany", "findunique",
  "findfirst", "create", "update", "delete", "upsert", "where", "select",
  "include", "orderby", "data", "id", "string", "int", "float", "boolean",
  "datetime", "json", "relation",
]);

type TokenType = "keyword" | "string" | "number" | "comment" | "plain";

function tokenizeLine(line: string): { type: TokenType; text: string }[] {
  const tokens: { type: TokenType; text: string }[] = [];
  // Line comment (SQL "--" or JS/Prisma "//")
  const commentMatch = /(--.*$|\/\/.*$)/.exec(line);
  const codePart = commentMatch ? line.slice(0, commentMatch.index) : line;
  const commentPart = commentMatch ? line.slice(commentMatch.index) : "";

  const pattern = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|\b\d+(?:\.\d+)?\b|[A-Za-z_][A-Za-z0-9_]*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(codePart)) !== null) {
    if (match.index > lastIndex) tokens.push({ type: "plain", text: codePart.slice(lastIndex, match.index) });
    const token = match[0];
    if (token[0] === "'" || token[0] === '"') {
      tokens.push({ type: "string", text: token });
    } else if (/^\d/.test(token)) {
      tokens.push({ type: "number", text: token });
    } else if (SQL_KEYWORDS.has(token.toLowerCase()) || PRISMA_KEYWORDS.has(token.toLowerCase())) {
      tokens.push({ type: "keyword", text: token });
    } else {
      tokens.push({ type: "plain", text: token });
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < codePart.length) tokens.push({ type: "plain", text: codePart.slice(lastIndex) });
  if (commentPart) tokens.push({ type: "comment", text: commentPart });
  return tokens;
}

// Theme-aware syntax colors — a darker shade for light mode's contrast,
// a lighter one for dark mode, same hue family in both (this is ordinary
// code-editor token coloring, distinct from the page's own Scarlet brand
// accent). "plain"/"comment" use semantic tokens directly since they're
// meant to read as regular body/muted text, not a highlighted token.
const TOKEN_COLOR: Record<TokenType, string> = {
  keyword: "text-rose-700 dark:text-rose-400 font-semibold",
  string: "text-emerald-700 dark:text-emerald-400",
  number: "text-amber-700 dark:text-amber-400",
  comment: "text-muted-foreground italic",
  plain: "text-foreground",
};

export function highlightSordiIqCode(code: string): ReactNode {
  const lines = code.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <div key={i}>
          {tokenizeLine(line).map((tok, ti) => (
            <span key={ti} className={TOKEN_COLOR[tok.type]}>{tok.text}</span>
          ))}
          {line === "" ? " " : null}
        </div>
      ))}
    </>
  );
}
