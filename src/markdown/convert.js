(function (namespace) {
  "use strict";

  const BLOCK_TAGS = new Set(["P", "DIV", "SECTION", "ARTICLE", "MAIN", "LI", "UL", "OL", "BLOCKQUOTE", "PRE", "TABLE", "HR"]);

    function text(node) {
      if (!node.nodeValue.trim()) return "";
      return node.nodeValue.replace(/\s+/g, " ");
  }

    function fenceFor(code) {
      const max = Math.max(0, ...(code.match(/`+/g) || []).map((run) => run.length));
      return "`".repeat(Math.max(3, max + 1));
    }

    function inlineDelimiter(value) {
      const max = Math.max(0, ...(value.match(/`+/g) || []).map((run) => run.length));
      return "`".repeat(max + 1);
    }

  function languageFor(code) {
    const className = code.className || "";
    const match = String(className).match(/(?:language-|lang-)([\w+-]+)/i);
    return match ? match[1].toLowerCase() : "";
  }

  function converter(root) {
    function inline(node) {
      if (node.nodeType === Node.TEXT_NODE) return text(node);
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const math = namespace.math.mathInfo(node);
      if (math && namespace.math.isMathElement(node)) return namespace.math.renderMath(math);
      const tag = node.tagName;
      if (tag === "BR") return "  \n";
      if (tag === "CODE" && !node.closest("pre")) {
        const value = node.textContent.replace(/\n/g, " ").trim();
        const delimiter = inlineDelimiter(value);
        return `${delimiter}${value}${delimiter}`;
      }
      const content = Array.from(node.childNodes).map(inline).join("");
      if (tag === "STRONG" || tag === "B") return content.trim() ? `**${content.trim()}**` : "";
      if (tag === "EM" || tag === "I") return content.trim() ? `*${content.trim()}*` : "";
      if (tag === "A") {
        const href = node.getAttribute("href");
        return href && content.trim() ? `[${namespace.cleanup.escapeLinkText(content.trim())}](${href})` : content;
      }
      if (tag === "IMG") {
        const src = node.getAttribute("src");
        const alt = node.getAttribute("alt") || "";
        return src ? `![${alt}](${src})` : "";
      }
      return content;
    }

    function list(listElement, depth = 0) {
      const ordered = listElement.tagName === "OL";
      const items = Array.from(listElement.children).filter((child) => child.tagName === "LI");
      return items.map((item, index) => {
        const marker = ordered ? `${index + 1}. ` : "- ";
        const pieces = [];
        const nested = [];
        Array.from(item.childNodes).forEach((child) => {
          if (child.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes(child.tagName)) nested.push(child);
          else pieces.push(child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(child.tagName) ? block(child) : inline(child));
        });
        const body = namespace.cleanup.cleanMarkdown(pieces.join("")).replace(/\n/g, "\n" + " ".repeat(depth * 2 + 2));
        const nestedMarkdown = nested.map((child) => list(child, depth + 1)).join("\n");
        return `${" ".repeat(depth * 2)}${marker}${body}${nestedMarkdown ? `\n${nestedMarkdown}` : ""}`.trimEnd();
      }).join("\n");
    }

    function block(node) {
      if (node.nodeType === Node.TEXT_NODE) return text(node);
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      const math = namespace.math.mathInfo(node);
      if (math && namespace.math.isMathElement(node)) return namespace.math.renderMath(math);
      const tag = node.tagName;
      if (/^H[1-6]$/.test(tag)) return `${"#".repeat(Number(tag[1]))} ${inline(node).trim()}\n\n`;
      if (tag === "PRE") {
        const code = node.querySelector("code") || node;
        const value = code.textContent.replace(/\n$/, "");
        const fence = fenceFor(value);
        return `\n\n${fence}${languageFor(code)}\n${value}\n${fence}\n\n`;
      }
      if (tag === "UL" || tag === "OL") return `\n\n${list(node)}\n\n`;
      if (tag === "TABLE") return `\n\n${namespace.table.toMarkdown(node, inline)}\n\n`;
      if (tag === "BLOCKQUOTE") {
        const body = namespace.cleanup.cleanMarkdown(Array.from(node.childNodes).map(block).join(""));
        return `\n\n${body.split("\n").map((line) => `> ${line}`.trimEnd()).join("\n")}\n\n`;
      }
      if (tag === "HR") return "\n\n---\n\n";
      if (tag === "P") return `${inline(node).trim()}\n\n`;
      if (["DIV", "SECTION", "ARTICLE", "MAIN"].includes(tag)) {
        const children = Array.from(node.childNodes);
        const hasBlockChild = children.some((child) => child.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has(child.tagName));
        return hasBlockChild ? children.map(block).join("") : `${inline(node).trim()}\n\n`;
      }
      return inline(node);
    }

    return namespace.cleanup.cleanMarkdown(Array.from(root.childNodes).map(block).join(""));
  }

  function formatQuestionAndAnswer(question, answer) {
    return namespace.cleanup.cleanMarkdown(`## Question\n\n${question}\n\n## Answer\n\n${answer}`);
  }

  namespace.markdown = { convert: converter, formatQuestionAndAnswer };
}(window.GPTCopier));
