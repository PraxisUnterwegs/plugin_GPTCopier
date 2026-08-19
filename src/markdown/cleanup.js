(function (namespace) {
  "use strict";

  function normaliseNewlines(value) {
    return value.replace(/\r\n?/g, "\n");
  }

  function cleanMarkdown(value) {
    return normaliseNewlines(value)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/^\s*\n/, "")
      .replace(/\n\s*$/, "");
  }

  function escapeTableCell(value) {
    return value.replace(/\|/g, "\\|").replace(/\n+/g, "<br>").trim();
  }

  function escapeLinkText(value) {
    return value.replace(/([\[\]])/g, "\\$1");
  }

  namespace.cleanup = { cleanMarkdown, normaliseNewlines, escapeTableCell, escapeLinkText };
}(window.GPTCopier));
