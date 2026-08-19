(function (namespace) {
  "use strict";

  function toMarkdown(table, inline) {
    const rows = Array.from(table.querySelectorAll("tr"));
    if (!rows.length) return "";

    const matrix = rows.map((row) => Array.from(row.querySelectorAll(":scope > th, :scope > td"))
      .map((cell) => namespace.cleanup.escapeTableCell(inline(cell))));
    const width = Math.max(...matrix.map((row) => row.length));
    if (!width) return "";

    const headerIndex = rows.findIndex((row) => row.parentElement && row.parentElement.tagName === "THEAD");
    const sourceHeader = matrix[headerIndex >= 0 ? headerIndex : 0];
    const header = Array.from({ length: width }, (_, index) => sourceHeader[index] || " ");
    const body = matrix.filter((_, index) => index !== (headerIndex >= 0 ? headerIndex : 0));
    const line = (cells) => `| ${cells.map((cell) => cell || " ").join(" | ")} |`;
    const separator = Array.from({ length: width }, (_, index) => {
      const cell = rows[headerIndex >= 0 ? headerIndex : 0].children[index];
      return cell && cell.getAttribute("align") === "right" ? "---:" : "---";
    });
    return [line(header), line(separator), ...body.map((row) => line(Array.from({ length: width }, (_, i) => row[i] || " ")))].join("\n");
  }

  namespace.table = { toMarkdown };
}(window.GPTCopier));
