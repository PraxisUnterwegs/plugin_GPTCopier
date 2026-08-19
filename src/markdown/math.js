(function (namespace) {
  "use strict";

  function texFrom(element) {
    const annotation = element.querySelector("annotation[encoding='application/x-tex'], annotation[encoding='text/x-tex']");
    if (annotation && annotation.textContent.trim()) return annotation.textContent.trim();

    for (const attribute of ["data-tex", "data-latex", "data-math", "aria-label"]) {
      const value = element.getAttribute && element.getAttribute(attribute);
      if (value && value.trim() && !/^\s*(math|formula)\s*$/i.test(value)) return value.trim();
    }
    return null;
  }

  function mathInfo(element) {
    const katex = element.matches && element.matches(".katex, .katex-display")
      ? element
      : element.closest && element.closest(".katex, .katex-display");
    const target = katex || element;
    const tex = texFrom(target);
    if (!tex) return null;
    const display = Boolean(target.closest && target.closest(".katex-display, [data-display='block']")) || target.matches(".katex-display, math[display='block']");
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

  namespace.math = { mathInfo, isMathElement, renderMath, formatTextMath, wrapInlineFallback, isStandaloneFormula };
}(window.GPTCopier));
