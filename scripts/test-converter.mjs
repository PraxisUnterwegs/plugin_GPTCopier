import assert from "node:assert/strict";

await import("../src/converter/convert.js");
const { convertNativeCopy } = globalThis.GPTCopierConverter;

function conversion(input) {
  return convertNativeCopy(input);
}

const explicit = conversion("Inline \\(h=g\\).\n\n\\[\nT_1\\to S_1\n\\]");
assert.equal(explicit.output, "Inline $h=g$.\n\n$$\nT_1\\to S_1\n$$");
assert.deepEqual(explicit.stats, { total: 2, block: 1, inline: 1, tables: 0 });

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
assert.deepEqual(nativeBlocks.stats, { total: 2, block: 2, inline: 0, tables: 0 });

const inline = conversion("Use (h=g), (S_{11}), (C), and (H,W), but keep (FitNets paper) unchanged.");
assert.equal(inline.output, "Use $h=g$, $S_{11}$, $C$, and $H,W$, but keep (FitNets paper) unchanged.");
assert.deepEqual(inline.stats, { total: 4, block: 0, inline: 4, tables: 0 });

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
assert.deepEqual(empty, { output: "", stats: { total: 0, block: 0, inline: 0, tables: 0 }, warnings: [] });

// Table scenario 1: ChatGPT TSV table with KaTeX/LaTeX formulas (inline, parenthesized, existing $, display)
const mathTable = conversion([
  "方法\t公式\t说明",
  "MSE\t\\(L = \\frac{1}{N}\\sum_{i=1}^N (y_i - \\hat{y}_i)^2\\)\t均方误差",
  "Hint\t(L_{\\text{hint}} = \\|T_2 - S_6\\|^2)\t特征蒸馏",
  "L2\t$x_1^2 + x_2^2$\t\\[\\alpha + \\beta\\]"
].join("\n"));
assert.equal(mathTable.output, [
  "| 方法 | 公式 | 说明 |",
  "| --- | --- | --- |",
  "| MSE | $L = \\frac{1}{N}\\sum_{i=1}^N (y_i - \\hat{y}_i)^2$ | 均方误差 |",
  "| Hint | $L_{\\text{hint}} = \\|T_2 - S_6\\|^2$ | 特征蒸馏 |",
  "| L2 | $x_1^2 + x_2^2$ | $\\alpha + \\beta$ |"
].join("\n"));
assert.deepEqual(mathTable.stats, { total: 3, block: 1, inline: 2, tables: 1 });

// Table scenario 2: Pipe escaping inside math, plain text, and inline code (plus literal tab in code span)
const pipeTable = conversion([
  "符号\t表达式\t备注",
  "绝对值\t\\(|y_i - \\hat{y}_i|\\)\t条件 \\(P(A|B)\\)",
  "按位或\ta | b\t`x | y` 与 `k\tv`",
  "双竖线\t\\(\\|x\\|_2\\)\t已转义 a \\| b"
].join("\n"));
assert.equal(pipeTable.output, [
  "| 符号 | 表达式 | 备注 |",
  "| --- | --- | --- |",
  "| 绝对值 | $\\|y_i - \\hat{y}_i\\|$ | 条件 $P(A\\|B)$ |",
  "| 按位或 | a \\| b | `x \\| y` 与 `k\tv` |",
  "| 双竖线 | $\\|x\\|_2$ | 已转义 a \\| b |"
].join("\n"));
assert.equal(pipeTable.stats.tables, 1);

// Table scenario 3: Uneven columns & empty cells
const unevenTable = conversion([
  "参数\t默认值\t说明",
  "(\\alpha)\t0.5",
  "(\\beta)\t\t可选参数",
  "\t1.0\t空首列"
].join("\n"));
assert.equal(unevenTable.output, [
  "| 参数 | 默认值 | 说明 |",
  "| --- | --- | --- |",
  "| $\\alpha$ | 0.5 |  |",
  "| $\\beta$ |  | 可选参数 |",
  "|  | 1.0 | 空首列 |"
].join("\n"));
assert.equal(unevenTable.stats.tables, 1);

// Table scenario 4: Existing separator row with alignment markers preserved
const alignedTable = conversion([
  "指标\t左对齐\t居中\t右对齐",
  "---\t:---\t:---:\t---:",
  "Acc\t\\(92.5\\%\\)\t0.925\t92.5"
].join("\n"));
assert.equal(alignedTable.output, [
  "| 指标 | 左对齐 | 居中 | 右对齐 |",
  "| --- | :--- | :---: | ---: |",
  "| Acc | $92.5\\%$ | 0.925 | 92.5 |"
].join("\n"));
assert.equal(alignedTable.stats.tables, 1);

// Table scenario 5: CRLF line endings preserved
const crlfTable = conversion("ColA\tColB\r\n(x_1)\t(y_1)");
assert.equal(crlfTable.output, "| ColA | ColB |\r\n| --- | --- |\r\n| $x_1$ | $y_1$ |");
assert.equal(crlfTable.stats.tables, 1);

// Table scenario 6: False-positive protection (code fences with tabs, indented lists, single tabbed line, existing pipe table)
const noFalseTables = conversion([
  "```makefile",
  "build:\tmain.c",
  "\tgcc -O2 main.c",
  "```",
  "",
  "\t- indented item 1",
  "\t- indented item 2",
  "",
  "Single\ttabbed line only",
  "",
  "| A | B |",
  "| --- | --- |",
  "| 1 | 2 |"
].join("\n"));
assert.equal(noFalseTables.stats.tables, 0);
assert.ok(noFalseTables.output.includes("build:\tmain.c\n\tgcc -O2 main.c"));
assert.ok(noFalseTables.output.includes("\t- indented item 1\n\t- indented item 2"));
assert.ok(noFalseTables.output.includes("Single\ttabbed line only"));
assert.ok(noFalseTables.output.includes("| A | B |\n| --- | --- |\n| 1 | 2 |"));

// Table scenario 7: Mixed realistic ChatGPT response with 2 tables, block math, and code
const mixedDoc = conversion([
  "## 损失函数对比",
  "",
  "常见损失函数如下：",
  "",
  "名称\t公式\t梯度",
  "MSE\t\\(L = \\frac{1}{2}(y - \\hat{y})^2\\)\t(\\hat{y} - y)",
  "MAE\t\\(L = |y - \\hat{y}|\\)\t\\(\\text{sign}(\\hat{y} - y)\\)",
  "",
  "整体目标：",
  "",
  "[",
  "\\mathcal{L} = \\lambda_1 L_{\\text{MSE}} + \\lambda_2 L_{\\text{MAE}}",
  "]",
  "",
  "超参数设置：",
  "",
  "参数\t值",
  "(\\lambda_1)\t0.8",
  "(\\lambda_2)\t0.2"
].join("\n"));
assert.equal(mixedDoc.stats.tables, 2);
assert.equal(mixedDoc.stats.block, 1);
assert.equal(mixedDoc.stats.inline, 6);
assert.ok(mixedDoc.output.includes("| 名称 | 公式 | 梯度 |\n| --- | --- | --- |"));
assert.ok(mixedDoc.output.includes("| MAE | $L = \\|y - \\hat{y}\\|$ | $\\text{sign}(\\hat{y} - y)$ |"));
assert.ok(mixedDoc.output.includes("$$\n\\mathcal{L} = \\lambda_1 L_{\\text{MSE}} + \\lambda_2 L_{\\text{MAE}}\n$$"));
assert.ok(mixedDoc.output.includes("| 参数 | 值 |\n| --- | --- |\n| $\\lambda_1$ | 0.8 |\n| $\\lambda_2$ | 0.2 |"));

// Performance benchmark: 500-row table with formulas + code blocks
const perfRows = ["Index\tFormula\tNorm\tCode\tNotes"];
for (let i = 1; i <= 500; i += 1) {
  perfRows.push(`Row ${i}\t\\(f_${i}(x) = \\frac{x^2 + ${i}}{1 + |x|}\\)\t(L_${i} = \\|T_${i} - S_${i}\\|^2)\t\`a | b\`\t说明 ${i}`);
}
const perfInput = perfRows.join("\n");
const startMs = performance.now();
const perfResult = conversion(perfInput);
const elapsedMs = performance.now() - startMs;
assert.equal(perfResult.stats.tables, 1);
assert.equal(perfResult.stats.inline, 1000);
assert.ok(elapsedMs < 200, `Expected 500-row table conversion under 200ms, got ${elapsedMs.toFixed(2)}ms`);

console.log(`Native-copy converter: 15 scenarios + 500-row perf benchmark passed (${elapsedMs.toFixed(2)}ms).`);
