(function (namespace) {
  "use strict";

  const INITIALISED = "data-gptcopier-initialized";

  function makeButton(label, title, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gptcopier-button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", action);
    return button;
  }

  function setFeedback(button, text, isError = false) {
    const previous = button.textContent;
    button.textContent = text;
    button.dataset.state = isError ? "error" : "success";
    window.setTimeout(() => {
      button.textContent = previous;
      delete button.dataset.state;
    }, 1200);
  }

  function nearestQuestion(adapter, message) {
    const messages = adapter.getMessages();
    const currentIndex = messages.indexOf(message);
    for (let index = currentIndex - 1; index >= 0; index -= 1) {
      if (adapter.getRole(messages[index]) === "user") return messages[index];
    }
    return null;
  }

  async function copy(button, adapter, message, withQuestion) {
    try {
      const answer = namespace.markdown.convert(adapter.getContent(message));
      const questionMessage = withQuestion ? nearestQuestion(adapter, message) : null;
      const output = questionMessage
        ? namespace.markdown.formatQuestionAndAnswer(namespace.markdown.convert(adapter.getContent(questionMessage)), answer)
        : answer;
      await namespace.clipboard.copyText(output);
      setFeedback(button, "Copied!");
    } catch (error) {
      console.warn("GPTCopier failed to copy Markdown", error);
      setFeedback(button, "Retry", true);
    }
  }

  async function copyMathDebug(button, adapter, message) {
    try {
      const report = namespace.math.createDebugReport(adapter.getContent(message));
      await namespace.clipboard.copyText(report);
      setFeedback(button, "Debug copied");
    } catch (error) {
      console.warn("GPTCopier failed to create math diagnostics", error);
      setFeedback(button, "Debug failed", true);
    }
  }

  function inject(adapter, message) {
    if (message.getAttribute(INITIALISED) === "true" || adapter.getRole(message) !== "assistant") return;
    const content = adapter.getContent(message);
    if (!content) return;

    const controls = document.createElement("span");
    controls.className = "gptcopier-controls";
    controls.setAttribute("aria-label", "Markdown copy actions");
    controls.append(
      makeButton("Copy MD", "Copy this answer as Markdown", (event) => { event.preventDefault(); event.stopPropagation(); copy(event.currentTarget, adapter, message, false); }),
      makeButton("Copy Q&A MD", "Copy this Q&A round as Markdown", (event) => { event.preventDefault(); event.stopPropagation(); copy(event.currentTarget, adapter, message, true); }),
      makeButton("Math Debug", "Copy formula DOM diagnostics; nothing is sent automatically", (event) => { event.preventDefault(); event.stopPropagation(); copyMathDebug(event.currentTarget, adapter, message); })
    );

    const actionContainer = adapter.getActionContainer(message);
    if (actionContainer) actionContainer.appendChild(controls);
    else {
      controls.classList.add("gptcopier-controls--standalone");
      content.insertAdjacentElement("afterend", controls);
    }
    message.setAttribute(INITIALISED, "true");
  }

  namespace.ui = { inject, nearestQuestion };
}(window.GPTCopier));
