(function () {
  "use strict";

  const { markdown, sites, ui } = window.GPTCopier;
  const assistant = document.querySelector("[data-message-author-role='assistant']");
  const user = document.querySelector("[data-message-author-role='user']");
  const output = document.querySelector("#output");
  const status = document.querySelector("#test-status");

  function answer() {
    return markdown.convert(sites.chatgpt.getContent(assistant));
  }

  function qa() {
    return markdown.formatQuestionAndAnswer(markdown.convert(sites.chatgpt.getContent(user)), answer());
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  async function runFixtureChecks() {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const source = answer();
    assert(source.includes("## Kernel model"), "heading conversion failed");
    assert(source.includes("**similarity**") && source.includes("*non-linear*"), "inline emphasis conversion failed");
    assert(source.includes("$$\nz=\\sum_i \\alpha_i K(x,x_i)\n$$"), "KaTeX source extraction failed");
    assert((source.match(/\\sum_i/g) || []).length === 1, "formula was duplicated");
    assert(source.includes("Tensor shape: $X∈R^{C×H×W}$"), "inline text formula wrapping failed");
    assert(source.includes("$$\nx^{2} + y^{2} = z^{2}\n$$"), "block text formula wrapping failed");
    assert(source.includes("`rbf`") && source.includes("```python\nfrom sklearn.svm import SVC"), "code conversion failed");
    assert(source.includes("  - rbf"), "nested list indentation failed");
    assert(source.includes("| Model | Latency |\n| --- | ---: |"), "table conversion failed");
    assert(source.includes("> Validate on a held-out set."), "blockquote conversion failed");
    assert(source.includes("[scikit-learn](https://scikit-learn.org/)"), "link conversion failed");
    assert(ui.nearestQuestion(sites.chatgpt, assistant) === user, "Q&A message pairing failed");
    assert(document.querySelectorAll(".gptcopier-controls").length === 1, "button injection failed");
    const laterMessage = document.createElement("article");
    laterMessage.setAttribute("data-message-author-role", "assistant");
    laterMessage.innerHTML = "<div data-message-content><p>Streaming complete.</p></div>";
    document.querySelector(".conversation").appendChild(laterMessage);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    assert(laterMessage.querySelectorAll(".gptcopier-controls").length === 1, "dynamic button injection failed");
    laterMessage.remove();
    status.textContent = "12 fixture checks passed";
    status.dataset.status = "pass";
  }

  document.addEventListener("click", (event) => {
    if (!event.target.classList.contains("gptcopier-button")) return;
    output.textContent = event.target.textContent.startsWith("Copy Q") ? qa() : answer();
  }, true);

  runFixtureChecks().catch((error) => {
    status.textContent = `Fixture check failed: ${error.message}`;
    status.dataset.status = "fail";
    console.error(error);
  });
}());
