import type { ReactNode } from "react";
import { highlightSordiIqCode } from "./sordiIqSyntaxHighlight";

/**
 * Minimal, dependency-free Markdown renderer for Sordi IQ's chat replies —
 * no react-markdown/remark install (avoids touching the lockfile for this
 * pass). Covers exactly what the assistant's own system prompt asks it to
 * use: headings, bold, inline code, fenced code blocks, bullet/numbered
 * lists, and pipe tables. Not a general-purpose Markdown engine — anything
 * outside this subset renders as a plain paragraph, which is a safe,
 * legible fallback rather than a crash or raw asterisks.
 */

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Split on **bold** and `code` spans in one pass, left to right.
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b-${i++}`} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(
        <code key={`${keyPrefix}-c-${i++}`} className="px-1.5 py-0.5 rounded bg-muted text-rose-600 dark:text-rose-400 text-[0.85em] font-mono">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function isTableSeparatorRow(line: string): boolean {
  return /^\|?[\s:|-]+\|?$/.test(line) && line.includes("-");
}

function renderTable(lines: string[], key: string): ReactNode {
  const rows = lines.map((line) =>
    line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim())
  );
  const [header, , ...body] = rows;
  return (
    <div key={key} className="my-2.5 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/50">
            {header.map((cell, i) => (
              <th key={i} className="text-left font-semibold text-foreground px-3 py-2 border-b border-border whitespace-nowrap">
                {renderInline(cell, `th-${key}-${i}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? "bg-muted/30" : undefined}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2 border-b border-border/50 text-foreground/80 whitespace-nowrap">
                  {renderInline(cell, `td-${key}-${ri}-${ci}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function renderSordiIqMarkdown(content: string): ReactNode {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let listBuffer: { ordered: boolean; items: string[] } | null = null;

  const flushList = (key: string) => {
    if (!listBuffer) return;
    const { ordered, items } = listBuffer;
    const Tag = ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={key} className={ordered ? "list-decimal pl-5 my-1.5 space-y-1 text-foreground" : "list-disc pl-5 my-1.5 space-y-1 text-foreground"}>
        {items.map((item, idx) => (
          <li key={idx}>{renderInline(item, `${key}-li-${idx}`)}</li>
        ))}
      </Tag>
    );
    listBuffer = null;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      flushList(`list-${i}`);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre key={`code-${i}`} className="my-2.5 rounded-lg border border-border bg-muted/60 p-3 overflow-x-auto text-xs font-mono text-foreground">
          <code>{highlightSordiIqCode(codeLines.join("\n"))}</code>
        </pre>
      );
      continue;
    }

    // Pipe table (header row + separator row)
    if (line.includes("|") && i + 1 < lines.length && isTableSeparatorRow(lines[i + 1])) {
      flushList(`list-${i}`);
      const tableLines = [line, lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push(renderTable(tableLines, `table-${i}`));
      continue;
    }

    // Headings
    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (headingMatch) {
      flushList(`list-${i}`);
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizeClass = level === 1 ? "text-lg font-bold" : level === 2 ? "text-base font-semibold" : "text-sm font-semibold";
      blocks.push(
        <div key={`h-${i}`} className={`${sizeClass} text-foreground mt-3 mb-1 first:mt-0`}>
          {renderInline(text, `h-${i}`)}
        </div>
      );
      i++;
      continue;
    }

    // List items
    const bulletMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    const numberedMatch = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bulletMatch || numberedMatch) {
      const ordered = !!numberedMatch;
      const text = (bulletMatch ?? numberedMatch)![1];
      if (!listBuffer || listBuffer.ordered !== ordered) {
        flushList(`list-${i}`);
        listBuffer = { ordered, items: [] };
      }
      listBuffer.items.push(text);
      i++;
      continue;
    }

    flushList(`list-${i}`);

    // Blank line — just spacing, no empty paragraph node
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Plain paragraph
    blocks.push(
      <p key={`p-${i}`} className="text-foreground leading-relaxed my-1">
        {renderInline(line, `p-${i}`)}
      </p>
    );
    i++;
  }
  flushList("list-end");

  return <>{blocks}</>;
}
