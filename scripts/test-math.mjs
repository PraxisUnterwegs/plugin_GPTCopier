globalThis.window = { GPTCopier: {} };
globalThis.Node = { ELEMENT_NODE: 1, TEXT_NODE: 3 };

await import("../src/markdown/math.js");

class FakeText {
  constructor(value) {
    this.nodeType = Node.TEXT_NODE;
    this.nodeValue = value;
  }

  get textContent() { return this.nodeValue; }
}

class FakeElement {
  constructor(name, attributes = {}, children = []) {
    this.nodeType = Node.ELEMENT_NODE;
    this.localName = name;
    this.attributes = attributes;
    this.childNodes = children.map((child) => typeof child === "string" ? new FakeText(child) : child);
    this.children = this.childNodes.filter((child) => child.nodeType === Node.ELEMENT_NODE);
    this.children.forEach((child) => { child.parentElement = this; });
  }

  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  closest(selector) {
    let current = this;
    while (current) {
      if (selector === "mstyle[mathvariant]" && current.localName === "mstyle" && current.getAttribute("mathvariant")) return current;
      current = current.parentElement;
    }
    return null;
  }
}

const el = (name, attributes, ...children) => new FakeElement(name, attributes, children);
const plain = (name, ...children) => el(name, {}, ...children);
const { isDisplayMath, mathMLToTex, texFrom } = window.GPTCopier.math;

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}\nExpected: ${expected}\nActual:   ${actual}`);
  }
}

const shape = plain("math",
  plain("mi", "X"),
  plain("mo", "∈"),
  plain("msup",
    el("mi", { mathvariant: "double-struck" }, "R"),
    plain("mrow", plain("mi", "C"), plain("mo", "×"), plain("mi", "H"), plain("mo", "×"), plain("mi", "W"))
  )
);
assertEqual(mathMLToTex(shape), "X\\in \\mathbb{R}^{C\\times H\\times W}", "double-struck superscript shape");

const channel = plain("math",
  plain("msub", plain("mi", "X"), plain("mi", "c")),
  plain("mo", "∈"),
  plain("msup",
    el("mi", { mathvariant: "double-struck" }, "R"),
    plain("mrow", plain("mi", "H"), plain("mo", "×"), plain("mi", "W"))
  )
);
assertEqual(mathMLToTex(channel), "X_{c}\\in \\mathbb{R}^{H\\times W}", "subscript channel shape");

const boxed = plain("math",
  el("menclose", { notation: "box" },
    plain("mrow", plain("mtext", "feature map"), plain("mo", "≈"), plain("mtext", "intermediate activation"))
  )
);
assertEqual(
  mathMLToTex(boxed),
  "\\boxed{\\text{feature map}\\approx \\text{intermediate activation}}",
  "boxed text expression"
);

const flow = plain("math",
  plain("mtext", "Image"), plain("mo", "→"),
  plain("mtext", "Conv"), plain("mo", "→"),
  plain("mtext", "ReLU"), plain("mo", "→"),
  el("menclose", { notation: "box" }, plain("mtext", "Feature Map"))
);
assertEqual(
  mathMLToTex(flow),
  "\\text{Image}\\rightarrow \\text{Conv}\\rightarrow \\text{ReLU}\\rightarrow \\boxed{\\text{Feature Map}}",
  "visual feature flow"
);

function displayTarget({ inline = false, explicit = false, remainingText = null } = {}) {
  const container = remainingText === null ? null : {
    matches: () => false,
    cloneNode: () => ({
      querySelectorAll: () => [],
      textContent: remainingText
    })
  };
  return {
    closest(selector) {
      if (selector.includes("data-display='inline'")) return inline ? {} : null;
      if (selector.includes("katex-display")) return explicit ? {} : null;
      return container;
    }
  };
}

assertEqual(isDisplayMath(displayTarget({ inline: true })), false, "explicit inline classification");
assertEqual(isDisplayMath(displayTarget({ explicit: true })), true, "explicit display classification");
assertEqual(isDisplayMath(displayTarget({ remainingText: "" })), true, "formula-only container classification");
assertEqual(isDisplayMath(displayTarget({ remainingText: "prefix formula suffix" })), false, "mixed prose classification");

const attributeSource = {
  querySelector: () => null,
  matches: () => false,
  getAttribute: (name) => name === "data-latex" ? "\\[X \\in \\mathbb{R}^{d}\\]" : null
};
assertEqual(texFrom(attributeSource), "X \\in \\mathbb{R}^{d}", "data-latex delimiter cleanup");

const hiddenSource = { textContent: "\\(X_c \\in \\mathbb{R}^{H \\times W}\\)" };
const hiddenSourceRoot = {
  querySelector: (selector) => selector.includes(".sr-only") ? hiddenSource : null,
  matches: () => false,
  getAttribute: () => null
};
assertEqual(texFrom(hiddenSourceRoot), "X_c \\in \\mathbb{R}^{H \\times W}", "hidden TeX source recovery");

console.log("Math recovery passed for 4 formulas, 4 display modes, and 2 hidden/source attribute cases.");
