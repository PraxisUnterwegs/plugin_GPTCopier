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

  namespace.math = { mathInfo, isMathElement, renderMath };
}(window.GPTCopier));
