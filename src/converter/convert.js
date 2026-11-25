(function (root) {
  "use strict";

  const TEX_COMMAND = /\\[A-Za-z]+/u;
  const MATH_OPERATOR = /(?:=|≠|≈|≤|≥|<|>|∈|∉|∋|×|÷|±|∑|∏|∫|√|∞|→|←|↔|⇒)/u;
  const SCRIPT = /[_^](?:\{[^{}\n]*\}|[A-Za-z0-9α-ωΑ-Ω])/u;
  const SINGLE_VARIABLE = /^[A-Za-zα-ωΑ-Ω]$/u;
  const VARIABLE_LIST = /^[A-Za-zα-ωΑ-Ω](?:\s*,\s*[A-Za-zα-ωΑ-Ω])+$/u;

  function createProtector(source) {
    let prefix = "\uE000GPTCOPIER";
    while (source.includes(prefix)) prefix += "_";
    const suffix = "\uE001";
    const values = [];
    return {
      protect(value) {
        const token = `${prefix}${values.length}${suffix}`;
        values.push(value);
        return token;
      },
      restore(value) {
        const pattern = new RegExp(`${prefix}(\\d+)${suffix}`, "g");
        return value.replace(pattern, (_match, index) => values[Number(index)]);
      }
    };
  }

  function protectPattern(value, pattern, protector) {
    return value.replace(pattern, (match) => protector.protect(match));
  }

  function protectLiteralSegments(source, protector) {
    let value = source;
    const fencedCode = /^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)[\s\S]*?^ {0,3}\1[ \t]*(?=\n|$)/gm;
    value = protectPattern(value, fencedCode, protector);
    value = protectPattern(value, /(`+)([\s\S]*?)\1/g, protector);
    value = protectPattern(value, /\$\$[\s\S]*?\$\$/g, protector);
    value = protectPattern(value, /\$(?!\$)(?:\\.|[^$\n])+\$/g, protector);
    return value;
  }

  function cleanFormulaBody(value) {
    return value.replace(/^\s*\r?\n/u, "").replace(/\r?\n\s*$/u, "").trim();
  }

  function looksLikeBlockMath(value) {
    const candidate = value.trim();
    if (!candidate) return false;
    return TEX_COMMAND.test(candidate)
      || SCRIPT.test(candidate)
      || MATH_OPERATOR.test(candidate)
      || SINGLE_VARIABLE.test(candidate);
  }

  function looksLikeInlineMath(value) {
    const candidate = value.trim();
    if (!candidate || candidate.length > 120 || /[\u4e00-\u9fff]/u.test(candidate)) return false;
    if (/\s{2,}|https?:|www\./iu.test(candidate)) return false;
    return TEX_COMMAND.test(candidate)
      || SCRIPT.test(candidate)
      || MATH_OPERATOR.test(candidate)
      || SINGLE_VARIABLE.test(candidate)
      || VARIABLE_LIST.test(candidate);
  }

  function convertExplicitDelimiters(value, stats, warnings, protector) {
    let output = value.replace(/\\\[([\s\S]*?)\\\]/g, (match, body) => {
      const formula = cleanFormulaBody(body);
      if (!formula) return match;
      stats.block += 1;
      return protector.protect(`$$\n${formula}\n$$`);
    });
    output = output.replace(/\\\(([^\n]*?)\\\)/g, (match, body) => {
      const formula = body.trim();
      if (!formula) return match;
      stats.inline += 1;
      return protector.protect(`$${formula}$`);
    });

    const unmatchedDisplay = (output.match(/\\\[|\\\]/g) || []).length;
    const unmatchedInline = (output.match(/\\\(|\\\)/g) || []).length;
    if (unmatchedDisplay) warnings.push(`Found ${unmatchedDisplay} unmatched \\[ or \\] delimiter(s); left unchanged.`);
    if (unmatchedInline) warnings.push(`Found ${unmatchedInline} unmatched \\( or \\) delimiter(s); left unchanged.`);
    return output;
  }

  function convertBareDisplayBlocks(value, stats, warnings, protector) {
    const newline = value.includes("\r\n") ? "\r\n" : "\n";
    const lines = value.split(/\r?\n/);
    const output = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!/^\s*(?:#{1,6}\s+)?\[\s*$/u.test(line)) {
        output.push(line);
        continue;
      }

      let closing = index + 1;
      while (closing < lines.length && !/^\s*\]\s*$/u.test(lines[closing])) closing += 1;
      if (closing >= lines.length) {
        warnings.push(`Unmatched display-math opener on line ${index + 1}; left unchanged.`);
        output.push(line);
        continue;
      }

      const bodyLines = lines.slice(index + 1, closing);
      while (bodyLines.length && !bodyLines[0].trim()) bodyLines.shift();
      while (bodyLines.length && !bodyLines[bodyLines.length - 1].trim()) bodyLines.pop();
      const body = bodyLines.join(newline);
      if (!looksLikeBlockMath(body)) {
        warnings.push(`Skipped ambiguous bracket block starting on line ${index + 1}.`);
        output.push(...lines.slice(index, closing + 1));
        index = closing;
        continue;
      }

      output.push(protector.protect(`$$${newline}${body}${newline}$$`));
      stats.block += 1;
      index = closing;
    }
    return output.join(newline);
  }

  function convertInlineParentheses(value, stats, protector) {
    return value.replace(/\(([^()\n]{1,120})\)/g, (match, body, offset, source) => {
      const previous = source[offset - 1] || "";
      if (previous === "\\" || previous === "]" || !looksLikeInlineMath(body)) return match;
      stats.inline += 1;
      return protector.protect(`$${body.trim()}$`);
    });
  }

  const SEPARATOR_CELL = /^:?-{3,}:?$/u;

  function escapeTablePipes(cell) {
    return cell.replace(/(\\*)\|/g, (match, slashes) => (
      slashes.length % 2 === 1 ? match : `${slashes}\\|`
    ));
  }

  function formatTableCell(rawCell, protector) {
    let cell = protector.restore(rawCell).trim();
    if (!cell) return "";
    cell = cell.replace(/\$\$\s*\r?\n([\s\S]*?)\r?\n\s*\$\$/g, (_match, body) => {
      const compact = body.replace(/\s*\r?\n\s*/g, " ").trim();
      return compact ? `$${compact}$` : "";
    });
    cell = cell.replace(/\r?\n+/g, "<br>");
    return escapeTablePipes(cell);
  }

  function isPipeTableLine(line) {
    return /^\s*\|.*\|\s*$/u.test(line);
  }

  function isTabTableHeader(line) {
    if (!line.includes("\t") || isPipeTableLine(line)) return false;
    const trimmed = line.trim();
    return trimmed.length > 0 && trimmed.includes("\t");
  }

  function isTabTableRow(line) {
    if (!line.includes("\t") || isPipeTableLine(line)) return false;
    const trimmed = line.trim();
    if (!trimmed) return false;
    const withoutLeadingTabs = line.replace(/^\t+/u, "");
    if (!withoutLeadingTabs.includes("\t") && /^(?:[-*+]|\d+[.)])\s+/u.test(withoutLeadingTabs)) {
      return false;
    }
    return true;
  }

  function isSeparatorRow(cells) {
    let hasSeparator = false;
    for (const cell of cells) {
      const trimmed = cell.trim();
      if (!trimmed) continue;
      if (!SEPARATOR_CELL.test(trimmed)) return false;
      hasSeparator = true;
    }
    return hasSeparator;
  }

  function buildMarkdownTable(rawRows, newline, protector) {
    const splitRows = rawRows.map((line) => line.split("\t"));
    const colCount = splitRows.reduce((max, row) => Math.max(max, row.length), 0);
    const padRow = (row) => {
      const padded = row.slice();
      while (padded.length < colCount) padded.push("");
      return padded;
    };

    const headerCells = padRow(splitRows[0]).map((cell) => formatTableCell(cell, protector));
    let separatorCells = Array(colCount).fill("---");
    let bodyStartIndex = 1;

    if (splitRows.length >= 2 && isSeparatorRow(splitRows[1])) {
      separatorCells = padRow(splitRows[1]).map((cell) => {
        const trimmed = cell.trim();
        return SEPARATOR_CELL.test(trimmed) ? trimmed : "---";
      });
      bodyStartIndex = 2;
    }

    const lines = [
      `| ${headerCells.join(" | ")} |`,
      `| ${separatorCells.join(" | ")} |`
    ];

    for (let index = bodyStartIndex; index < splitRows.length; index += 1) {
      const cells = padRow(splitRows[index]).map((cell) => formatTableCell(cell, protector));
      lines.push(`| ${cells.join(" | ")} |`);
    }

    return lines.join(newline);
  }

  function convertTabTables(value, stats, protector) {
    if (!value.includes("\t")) return value;
    const newline = value.includes("\r\n") ? "\r\n" : "\n";
    const lines = value.split(/\r?\n/);
    const output = [];

    for (let index = 0; index < lines.length; index += 1) {
      if (!isTabTableHeader(lines[index])) {
        output.push(lines[index]);
        continue;
      }

      let end = index + 1;
      while (end < lines.length && isTabTableRow(lines[end])) {
        end += 1;
      }

      if (end - index < 2) {
        output.push(lines[index]);
        continue;
      }

      const tableBlock = buildMarkdownTable(lines.slice(index, end), newline, protector);
      output.push(protector.protect(tableBlock));
      stats.tables += 1;
      index = end - 1;
    }

    return output.join(newline);
  }

  function convertNativeCopy(input) {
    const source = String(input ?? "");
    const stats = { total: 0, block: 0, inline: 0, tables: 0 };
    const warnings = [];
    if (!source) return { output: "", stats, warnings };

    const protector = createProtector(source);
    let output = protectLiteralSegments(source, protector);
    output = convertExplicitDelimiters(output, stats, warnings, protector);
    output = convertBareDisplayBlocks(output, stats, warnings, protector);
    output = convertInlineParentheses(output, stats, protector);
    output = convertTabTables(output, stats, protector);
    output = protector.restore(output);
    stats.total = stats.block + stats.inline;
    return { output, stats, warnings };
  }

  root.GPTCopierConverter = { convertNativeCopy, looksLikeBlockMath, looksLikeInlineMath };
}(globalThis));
