(function () {
  "use strict";

  const input = document.querySelector("#source-input");
  const copyButton = document.querySelector("#copy-output");
  const clearButton = document.querySelector("#clear-input");
  const status = document.querySelector("#conversion-status");
  const warnings = document.querySelector("#conversion-warnings");
  const version = document.querySelector("#version");
  let currentResult = { output: "", stats: { total: 0, block: 0, inline: 0 }, warnings: [] };
  let feedbackTimer = null;

  try {
    version.textContent = `v${chrome.runtime.getManifest().version}`;
  } catch (_error) {
    version.textContent = "offline demo";
  }

  function render() {
    currentResult = GPTCopierConverter.convertNativeCopy(input.value);
    const { total, block, inline } = currentResult.stats;
    status.textContent = `Converted ${total} formula${total === 1 ? "" : "s"} (${block} block / ${inline} inline)`;
    warnings.replaceChildren(...currentResult.warnings.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }));
    warnings.hidden = currentResult.warnings.length === 0;
    copyButton.disabled = input.value.length === 0;
    clearButton.disabled = input.value.length === 0;
  }

  function setCopyFeedback(label, state) {
    window.clearTimeout(feedbackTimer);
    copyButton.textContent = label;
    copyButton.dataset.state = state;
    feedbackTimer = window.setTimeout(() => {
      copyButton.textContent = "Copy converted Markdown";
      delete copyButton.dataset.state;
    }, 1400);
  }

  input.addEventListener("input", render);
  clearButton.addEventListener("click", () => {
    input.value = "";
    render();
    input.focus();
  });
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(currentResult.output);
      setCopyFeedback("Copied!", "success");
    } catch (error) {
      console.warn("GPTCopier could not write to the clipboard", error);
      setCopyFeedback("Copy failed", "error");
    }
  });

  render();
  input.focus();
}());
