(function (namespace) {
  "use strict";

  const LEGACY_INITIALISED = "data-gptcopier-initialized";
  const VERSION_ATTRIBUTE = "data-gptcopier-version";
  const ACTION_ATTRIBUTE = "data-gptcopier-action";
  const REQUIRED_ACTIONS = ["copy-answer", "copy-qa", "debug-math"];
  const CURRENT_VERSION = (() => {
    try {
      return chrome.runtime.getManifest().version;
    } catch (_error) {
      return "dev";
    }
  })();

  function makeButton(label, title, actionId, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gptcopier-button";
    button.textContent = label;
    button.title = title;
    button.setAttribute(ACTION_ATTRIBUTE, actionId);
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

  function controlsAreCurrent(message, controls) {
    if (message.getAttribute(LEGACY_INITIALISED) !== null) return false;
    if (!controls || message.getAttribute(VERSION_ATTRIBUTE) !== CURRENT_VERSION) return false;
    if (controls.getAttribute(VERSION_ATTRIBUTE) !== CURRENT_VERSION) return false;

    const buttons = Array.from(controls.querySelectorAll(`[${ACTION_ATTRIBUTE}]`));
    if (buttons.length !== REQUIRED_ACTIONS.length) return false;
    if (buttons.some((button) => button.tagName !== "BUTTON")) return false;
    const actions = buttons.map((button) => button.getAttribute(ACTION_ATTRIBUTE));
    return REQUIRED_ACTIONS.every((action) => actions.filter((candidate) => candidate === action).length === 1);
  }

  function removeStaleControls(message) {
    message.querySelectorAll(".gptcopier-controls").forEach((controls) => controls.remove());
    message.removeAttribute(LEGACY_INITIALISED);
    message.removeAttribute(VERSION_ATTRIBUTE);
  }

  function inject(adapter, message) {
    if (adapter.getRole(message) !== "assistant") return null;
    const content = adapter.getContent(message);
    if (!content) return null;

    const existingControls = Array.from(message.querySelectorAll(".gptcopier-controls"));
    if (existingControls.length === 1 && controlsAreCurrent(message, existingControls[0])) {
      return existingControls[0];
    }
    removeStaleControls(message);

    const controls = document.createElement("span");
    controls.className = "gptcopier-controls";
    controls.setAttribute("aria-label", "Markdown copy actions");
    controls.setAttribute(VERSION_ATTRIBUTE, CURRENT_VERSION);
    controls.append(
      makeButton("Copy MD", "Copy this answer as Markdown", "copy-answer", (event) => { event.preventDefault(); event.stopPropagation(); copy(event.currentTarget, adapter, message, false); }),
      makeButton("Copy Q&A MD", "Copy this Q&A round as Markdown", "copy-qa", (event) => { event.preventDefault(); event.stopPropagation(); copy(event.currentTarget, adapter, message, true); }),
      makeButton("Math Debug", "Copy formula DOM diagnostics; nothing is sent automatically", "debug-math", (event) => { event.preventDefault(); event.stopPropagation(); copyMathDebug(event.currentTarget, adapter, message); })
    );

    const actionContainer = adapter.getActionContainer(message);
    if (actionContainer) actionContainer.appendChild(controls);
    else {
      controls.classList.add("gptcopier-controls--standalone");
      content.insertAdjacentElement("afterend", controls);
    }
    message.setAttribute(VERSION_ATTRIBUTE, CURRENT_VERSION);
    return controls;
  }

  namespace.ui = { inject, nearestQuestion, controlsAreCurrent, currentVersion: CURRENT_VERSION };
}(window.GPTCopier));
