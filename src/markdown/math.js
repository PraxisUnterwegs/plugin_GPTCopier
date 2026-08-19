(function (namespace) {
  "use strict";

  function childTex(element) {
    return Array.from(element.childNodes).map(mathMLToTex).join("");
  }

  function wrapCommand(command, value) {
    return value ? `\\${command}{${value}}` : "";
  }

  function mathMLToTex(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.trim() ? node.nodeValue.replace(/\s+/g, " ") : "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.localName.toLowerCase();
    const children = Array.from(node.children);
    const content = () => childTex(node);

    if (tag === "annotation" || tag === "annotation-xml") return "";
    if (tag === "semantics") {
      return mathMLToTex(children.find((child) => !["annotation", "annotation-xml"].includes(child.localName.toLowerCase())));
    }
    if (["math", "mrow", "mstyle", "mpadded", "merror", "mphantom"].includes(tag)) return content();
    if (tag === "mi") {
      const value = node.textContent.trim();
      const variant = node.getAttribute("mathvariant") || node.closest("mstyle[mathvariant]")?.getAttribute("mathvariant") || "";
      if (variant === "double-struck") return wrapCommand("mathbb", value);
      if (variant === "bold") return wrapCommand("mathbf", value);
      if (variant === "bold-italic") return wrapCommand("boldsymbol", value);
      if (variant === "normal") return wrapCommand("mathrm", value);
      if (variant === "monospace") return wrapCommand("mathtt", value);
      if (variant.includes("sans-serif")) return wrapCommand("mathsf", value);
      return value.length > 1 ? wrapCommand("operatorname", value) : value;
    }
    if (tag === "mn") return node.textContent.trim();
    if (tag === "mtext") {
      const value = node.textContent.replace(/([{}])/g, "\\$1").trim();
      return wrapCommand("text", value);
    }
    if (tag === "mo") {
      const value = node.textContent.trim();
      if (value === "\u2061") return "";
      if (value === "\u2062") return "\\,";
      if (value === "−") return "-";
      return Object.prototype.hasOwnProperty.call(UNICODE_TEX, value) ? UNICODE_TEX[value] : value;
    }
    if (tag === "msup") return `${mathMLToTex(children[0])}^{${mathMLToTex(children[1])}}`;
    if (tag === "msub") return `${mathMLToTex(children[0])}_{${mathMLToTex(children[1])}}`;
    if (tag === "msubsup") return `${mathMLToTex(children[0])}_{${mathMLToTex(children[1])}}^{${mathMLToTex(children[2])}}`;
    if (tag === "mfrac") return `\\frac{${mathMLToTex(children[0])}}{${mathMLToTex(children[1])}}`;
    if (tag === "msqrt") return wrapCommand("sqrt", content());
    if (tag === "mroot") return `\\sqrt[${mathMLToTex(children[1])}]{${mathMLToTex(children[0])}}`;
    if (tag === "mfenced") {
      const open = node.getAttribute("open") ?? "(";
      const close = node.getAttribute("close") ?? ")";
      return `\\left${open}${content()}\\right${close}`;
    }
    if (tag === "menclose") {
      const notation = node.getAttribute("notation") || "";
      return /box|roundedbox/.test(notation) ? wrapCommand("boxed", content()) : content();
    }
    if (tag === "mover") {
      const base = mathMLToTex(children[0]);
      const over = mathMLToTex(children[1]);
      if (["¯", "―", "_"].includes(children[1]?.textContent.trim())) return wrapCommand("bar", base);
      if (["→", "⃗"].includes(children[1]?.textContent.trim())) return wrapCommand("vec", base);
      if (["^", "ˆ"].includes(children[1]?.textContent.trim())) return wrapCommand("hat", base);
      return `\\overset{${over}}{${base}}`;
    }
    if (tag === "munder") return `\\underset{${mathMLToTex(children[1])}}{${mathMLToTex(children[0])}}`;
    if (tag === "munderover") {
      return `${mathMLToTex(children[0])}_{${mathMLToTex(children[1])}}^{${mathMLToTex(children[2])}}`;
    }
    if (tag === "mtable") {
      const rows = children.map(mathMLToTex).join(" \\\\ ");
      return `\\begin{matrix}${rows}\\end{matrix}`;
    }
    if (tag === "mtr") return children.map(mathMLToTex).join(" & ");
    if (tag === "mtd") return content();
    if (tag === "mspace") return "\\,";
    return content();
  }

  function texFrom(element) {
    const annotation = element.querySelector("annotation[encoding='application/x-tex'], annotation[encoding='text/x-tex']");
    if (annotation && annotation.textContent.trim()) return annotation.textContent.trim();

    for (const attribute of ["data-tex", "data-latex", "data-math"]) {
      const value = element.getAttribute && element.getAttribute(attribute);
      if (value && value.trim() && !/^\s*(math|formula)\s*$/i.test(value)) return value.trim();
    }

    const math = element.matches?.("math") ? element : element.querySelector?.("math");
    const mathMLTex = math ? mathMLToTex(math).replace(/\s{2,}/g, " ").trim() : "";
    if (mathMLTex) return mathMLTex;

    const ariaLabel = element.getAttribute && element.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim() && !/^\s*(math|formula)\s*$/i.test(ariaLabel)) return ariaLabel.trim();
    return null;
  }

  function formulaOnlyContent(container) {
    const clone = container.cloneNode(true);
    clone.querySelectorAll(".katex, .katex-display, math, .MathJax, .MathJax_Display").forEach((node) => node.remove());
    return !clone.textContent.trim();
  }

  function isDisplayMath(target) {
    if (target.closest("[data-display='inline'], .math-inline, .katex-inline")) return false;
    if (target.closest(".katex-display, .MathJax_Display, .math-display, [data-display='block'], math[display='block']")) return true;

    const container = target.closest("p, div, figure, section, article, li");
    return Boolean(container && !container.matches("li") && formulaOnlyContent(container));
  }

  function mathInfo(element) {
    const katex = element.matches && element.matches(".katex, .katex-display")
      ? element
      : element.closest && element.closest(".katex, .katex-display");
    const target = katex || element;
    const tex = texFrom(target);
    if (!tex) return null;
    const display = isDisplayMath(target);
    return { tex, display };
  }

  function isMathElement(element) {
    if (!element.matches) return false;
    if (element.matches(".katex, .katex-display")) return true;
    return element.matches("math") && Boolean(texFrom(element));
  }

  function renderMath(info) {
    return info.display ? `\n\n$$\n${info.tex}\n$$\n\n` : `$${info.tex}$`;
  }

  // Some answers expose formulae as ordinary text rather than a KaTeX/MathML
  // tree. We only wrap text with unambiguous mathematical signals; prose such
  // as "a = useful setting" is deliberately left alone.
  const STRONG_MATH_SIGNAL = /[∈∉∋×÷±∑∏∫√∞≤≥≠≈≃∂∇]|\\(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|sum|prod|int|frac|sqrt|cdot|times|in|mathbb)\b|[\^_][{(]/u;
  const FORMULA_CHARS = "A-Za-z0-9α-ωΑ-Ω∞∈∉∋×÷±∑∏∫√≤≥≠≈≃∂∇^_{}()[\\]\\\\.,:+*/=<>!\\s";
  const INLINE_FORMULA = new RegExp(
    `[A-Za-zα-ωΑ-Ω][A-Za-z0-9α-ωΑ-Ω]*\\s*(?:[∈∉∋×÷±∑∏∫√≤≥≠≈≃∂∇]|\\\\(?:alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|sum|prod|int|frac|sqrt|cdot|times|in|mathbb)\\b)[${FORMULA_CHARS}]*`,
    "gu"
  );
  const UNICODE_TEX = {
    "∈": "\\in ", "∉": "\\notin ", "∋": "\\ni ", "×": "\\times ", "÷": "\\div ",
    "±": "\\pm ", "∑": "\\sum ", "∏": "\\prod ", "∫": "\\int ", "√": "\\sqrt{}",
    "∞": "\\infty", "≤": "\\le ", "≥": "\\ge ", "≠": "\\ne ", "≈": "\\approx ",
    "→": "\\rightarrow ", "←": "\\leftarrow ", "↔": "\\leftrightarrow ", "⇒": "\\Rightarrow ",
    "α": "\\alpha ", "β": "\\beta ", "γ": "\\gamma ", "δ": "\\delta ", "θ": "\\theta ",
    "λ": "\\lambda ", "μ": "\\mu ", "π": "\\pi ", "σ": "\\sigma "
  };

  function normaliseFallbackTex(value) {
    return Object.entries(UNICODE_TEX).reduce((result, [symbol, tex]) => result.split(symbol).join(tex), value)
      .replace(/\\sqrt\{\}\s*([A-Za-z0-9])/g, "\\sqrt{$1}")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function isLikelyFormula(value) {
    const candidate = value.trim();
    if (!candidate || candidate.includes("$")) return false;
    if (/[。！？；]/u.test(candidate)) return false;
    return STRONG_MATH_SIGNAL.test(candidate);
  }

  function isStandaloneFormula(value) {
    const candidate = value.trim();
    if (!isLikelyFormula(candidate)) return false;
    const hasSentenceWords = /\b[A-Za-z]{3,}\s+[A-Za-z]{3,}\b/u.test(candidate);
    return !/[\u4e00-\u9fff]/u.test(candidate) && !hasSentenceWords && candidate.length <= 180;
  }

  function wrapInlineFallback(value) {
    // Keep code spans and already-delimited math intact.
    return value.split(/(`[^`]*`|\$[^$]*\$)/g).map((segment, index) => {
      if (index % 2 === 1) return segment;
      return segment.replace(INLINE_FORMULA, (candidate) => {
        const trimmed = candidate.trim();
        if (!isLikelyFormula(trimmed)) return candidate;
        const punctuation = trimmed.match(/[.,:;!?]+$/u)?.[0] || "";
        const formula = normaliseFallbackTex(punctuation ? trimmed.slice(0, -punctuation.length) : trimmed);
        return candidate.replace(trimmed, `$${formula}$${punctuation}`);
      });
    }).join("");
  }

  function formatTextMath(value) {
    const candidate = value.trim();
    if (isStandaloneFormula(candidate)) return `\n\n$$\n${normaliseFallbackTex(candidate)}\n$$\n\n`;
    return wrapInlineFallback(value);
  }

  namespace.math = {
    mathInfo,
    isMathElement,
    renderMath,
    formatTextMath,
    wrapInlineFallback,
    isStandaloneFormula,
    isDisplayMath,
    mathMLToTex,
    normaliseFallbackTex
  };
}(window.GPTCopier));
