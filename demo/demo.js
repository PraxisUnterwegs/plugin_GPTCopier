(function () {
  "use strict";

  const { markdown, sites, ui } = window.GPTCopier;
  const assistant = document.querySelector("[data-message-author-role='assistant']");
  const user = document.querySelector("[data-message-author-role='user']");
  const output = document.querySelector("#output");
  const status = document.querySelector("#test-status");
  let checks = 0;

  function answer() {
    return markdown.convert(sites.chatgpt.getContent(assistant));
  }

  function qa() {
    return markdown.formatQuestionAndAnswer(markdown.convert(sites.chatgpt.getContent(user)), answer());
  }

  function assert(condition, message) {
    if (!condition) throw new Error(message);
    checks += 1;
  }

  async function runFixtureChecks() {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const source = answer();
    assert(source.includes("## Kernel model"), "heading conversion failed");
    assert(source.includes("**similarity**") && source.includes("*non-linear*"), "inline emphasis conversion failed");
    assert(source.includes("$$\nz=\\sum_i \\alpha_i K(x,x_i)\n$$"), "KaTeX source extraction failed");
    assert((source.match(/\\sum_i/g) || []).length === 1, "formula was duplicated");
    assert(source.includes("Tensor shape: $X\\in R^{C\\times H\\times W}$"), "inline text formula wrapping failed");
    assert(source.includes("$$\nx^{2} + y^{2} = z^{2}\n$$"), "block text formula wrapping failed");
    assert(source.includes("$$\nF\\in R^{d}\n$$"), "div text formula wrapping failed");
    assert(source.includes("Inline result $a+b$ stays in this sentence."), "inline KaTeX classification failed");
    assert(source.includes("$$\n\\int_0^1 x\\,dx\n$$"), "block KaTeX classification failed");
    assert(source.includes("MathML shape $X\\in \\mathbb{R}^{C\\times H\\times W}$ remains inline."), "MathML inline recovery failed");
    assert(source.includes("$$\nX_{c}\\in \\mathbb{R}^{H\\times W}\n$$"), "MathML subscript/display recovery failed");
    assert(source.includes("$$\n\\boxed{\\text{feature map}\\approx \\text{intermediate activation}}\n$$"), "MathML text/box recovery failed");
    assert(source.includes("`rbf`") && source.includes("```python\nfrom sklearn.svm import SVC"), "code conversion failed");
    assert(source.includes("  - rbf"), "nested list indentation failed");
    assert(source.includes("| Model | Latency |\n| --- | ---: |"), "table conversion failed");
    assert(source.includes("> Validate on a held-out set."), "blockquote conversion failed");
    assert(source.includes("[scikit-learn](https://scikit-learn.org/)"), "link conversion failed");
    assert(ui.nearestQuestion(sites.chatgpt, assistant) === user, "Q&A message pairing failed");
    assert(document.querySelectorAll(".gptcopier-controls").length === 1, "button injection failed");

    const originalControls = assistant.querySelector(".gptcopier-controls");
    originalControls.setAttribute("data-gptcopier-version", "0.2.1");
    originalControls.querySelector("[data-gptcopier-action='debug-math']").remove();
    assistant.setAttribute("data-gptcopier-initialized", "true");
    window.GPTCopier.instance.scan();
    const upgradedControls = assistant.querySelector(".gptcopier-controls");
    assert(upgradedControls !== originalControls, "stale control group was not rebuilt");
    assert(assistant.getAttribute("data-gptcopier-initialized") === null, "legacy initialized marker was not removed");
    assert(assistant.getAttribute("data-gptcopier-version") === ui.currentVersion, "message version was not upgraded");
    assert(upgradedControls.querySelectorAll("[data-gptcopier-action]").length === 3, "upgraded controls do not contain three actions");

    upgradedControls.querySelector("[data-gptcopier-action='debug-math']").remove();
    window.GPTCopier.instance.scan();
    const repairedControls = assistant.querySelector(".gptcopier-controls");
    assert(repairedControls !== upgradedControls && repairedControls.querySelector("[data-gptcopier-action='debug-math']"), "incomplete current controls were not repaired");
    window.GPTCopier.instance.scan();
    assert(assistant.querySelectorAll(".gptcopier-controls").length === 1, "repeated scan duplicated controls");

    const laterMessage = document.createElement("article");
    laterMessage.setAttribute("data-message-author-role", "assistant");
    laterMessage.innerHTML = "<div data-message-content><p>Streaming complete.</p></div>";
    document.querySelector(".conversation").appendChild(laterMessage);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    assert(laterMessage.querySelectorAll(".gptcopier-controls").length === 1, "dynamic button injection failed");
    laterMessage.remove();
    status.textContent = `${checks} fixture checks passed`;
    status.dataset.status = "pass";
  }

  document.addEventListener("click", (event) => {
    if (!event.target.classList.contains("gptcopier-button")) return;
    const action = event.target.getAttribute("data-gptcopier-action");
    if (action === "copy-answer") output.textContent = answer();
    if (action === "copy-qa") output.textContent = qa();
  }, true);

  runFixtureChecks().catch((error) => {
    status.textContent = `Fixture check failed: ${error.message}`;
    status.dataset.status = "fail";
    console.error(error);
  });
}());
