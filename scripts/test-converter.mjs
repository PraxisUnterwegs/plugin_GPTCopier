import assert from "node:assert/strict";

await import("../src/converter/convert.js");
const { convertNativeCopy } = globalThis.GPTCopierConverter;

function conversion(input) {
  return convertNativeCopy(input);
}

const explicit = conversion("Inline \\(h=g\\).\n\n\\[\nT_1\\to S_1\n\\]");
assert.equal(explicit.output, "Inline $h=g$.\n\n$$\nT_1\\to S_1\n$$");
assert.deepEqual(explicit.stats, { total: 2, block: 1, inline: 1 });

const nativeBlocks = conversion([
  "This is not:",
  "",
  "[",
  "T_1\\to S_1,\\quad T_2\\to S_2",
  "]",
  "",
  "And the loss:",
  "",
  "# [",
  "\\boxed{L_{\\text{hint}}=\\lVert T_2-r(S_6)\\rVert^2}",
  "]"
].join("\n"));
assert.ok(nativeBlocks.output.includes("$$\nT_1\\to S_1,\\quad T_2\\to S_2\n$$"));
assert.ok(nativeBlocks.output.includes("$$\n\\boxed{L_{\\text{hint}}=\\lVert T_2-r(S_6)\\rVert^2}\n$$"));
assert.deepEqual(nativeBlocks.stats, { total: 2, block: 2, inline: 0 });

const inline = conversion("Use (h=g), (S_{11}), (C), and (H,W), but keep (FitNets paper) unchanged.");
assert.equal(inline.output, "Use $h=g$, $S_{11}$, $C$, and $H,W$, but keep (FitNets paper) unchanged.");
assert.deepEqual(inline.stats, { total: 4, block: 0, inline: 4 });

const code = conversion([
  "Keep `(h=g)` and `\\[x\\]`.",
  "",
  "```python",
  "formula = '(S_6)'",
  "latex = r'\\[x^2\\]'",
  "```",
  "",
  "Convert (S_6)."
].join("\n"));
assert.ok(code.output.includes("Keep `(h=g)` and `\\[x\\]`."));
assert.ok(code.output.includes("formula = '(S_6)'"));
assert.ok(code.output.includes("latex = r'\\[x^2\\]'"));
assert.ok(code.output.endsWith("Convert $S_6$."));
assert.equal(code.stats.total, 1);

const existing = conversion("Already $x_1$ and\n\n$$\ny^2\n$$\n\nplus [link](C).");
assert.equal(existing.output, "Already $x_1$ and\n\n$$\ny^2\n$$\n\nplus [link](C).");
assert.equal(existing.stats.total, 0);

const ambiguous = conversion("A normal block:\n[\nordinary prose only\n]\nAnd unmatched:\n\\[x+y");
assert.equal(ambiguous.output, "A normal block:\n[\nordinary prose only\n]\nAnd unmatched:\n\\[x+y");
assert.equal(ambiguous.warnings.length, 2);

const commands = conversion("[\n\\text{Teacher: }T_1\\xrightarrow{L_{\\text{hint}}}S_6\n]");
assert.equal(commands.output, "$$\n\\text{Teacher: }T_1\\xrightarrow{L_{\\text{hint}}}S_6\n$$");

const empty = conversion("");
assert.deepEqual(empty, { output: "", stats: { total: 0, block: 0, inline: 0 }, warnings: [] });

console.log("Native-copy converter: 8 scenarios passed.");
