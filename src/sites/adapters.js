(function (namespace) {
  "use strict";

  const ROLE_ATTRIBUTES = ["data-message-author-role", "data-role", "data-author-role"];

  function normaliseRole(value) {
    const role = (value || "").trim().toLowerCase();
    if (["assistant", "model", "bot", "ai"].includes(role)) return "assistant";
    if (["user", "human", "prompt"].includes(role)) return "user";
    return null;
  }

  function roleFromAttributes(element) {
    for (const attribute of ROLE_ATTRIBUTES) {
      const role = normaliseRole(element.getAttribute(attribute));
      if (role) return role;
    }
    return null;
  }

  function closestMessage(element) {
    return element.closest("[data-message-author-role], [data-role], [data-author-role], article, model-response, user-query");
  }

  function firstVisible(elements) {
    return Array.from(elements).find((element) => element.getClientRects().length > 0) || elements[0] || null;
  }

  class SiteAdapter {
    constructor(config) {
      this.id = config.id;
      this.hosts = config.hosts;
      this.messageSelector = config.messageSelector;
      this.contentSelectors = config.contentSelectors;
      this.roleFor = config.roleFor;
      this.actionSelectors = config.actionSelectors || [];
    }

    matches(hostname) {
      return this.hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
    }

    getMessages(root = document) {
      const candidates = Array.from(root.querySelectorAll(this.messageSelector));
      const messages = candidates.map(closestMessage).filter(Boolean);
      return [...new Set(messages)].filter((message) => this.getRole(message));
    }

    getRole(message) {
      return this.roleFor(message);
    }

    getContent(message) {
      for (const selector of this.contentSelectors) {
        const candidate = firstVisible(message.querySelectorAll(selector));
        if (candidate) return candidate;
      }
      return message;
    }

    getActionContainer(message) {
      for (const selector of this.actionSelectors) {
        const candidate = firstVisible(message.querySelectorAll(selector));
        if (candidate && !candidate.closest("pre, code")) return candidate;
      }
      return null;
    }
  }

  const chatgpt = new SiteAdapter({
    id: "chatgpt",
    hosts: ["chatgpt.com"],
    messageSelector: "[data-message-author-role], article[data-testid*='conversation-turn'] [data-message-author-role]",
    contentSelectors: [
      "[data-message-content]",
      ".markdown",
      ".prose",
      "[data-testid*='conversation-turn'] > div:last-child"
    ],
    roleFor: roleFromAttributes,
    actionSelectors: ["[data-testid*='message-actions']", "[role='toolbar']"]
  });

  const deepseek = new SiteAdapter({
    id: "deepseek",
    hosts: ["chat.deepseek.com"],
    messageSelector: "[data-message-author-role], [data-role], [data-author-role]",
    contentSelectors: ["[data-message-content]", ".markdown", ".prose", ".ds-markdown"],
    roleFor: roleFromAttributes,
    actionSelectors: ["[data-testid*='message-actions']", "[role='toolbar']"]
  });

  const gemini = new SiteAdapter({
    id: "gemini",
    hosts: ["gemini.google.com"],
    messageSelector: "model-response, user-query, [data-message-author-role], [data-role]",
    contentSelectors: [".markdown", ".prose", "[data-message-content]", ".model-response-text", ".query-text"],
    roleFor(message) {
      if (message.matches("model-response")) return "assistant";
      if (message.matches("user-query")) return "user";
      return roleFromAttributes(message);
    },
    actionSelectors: ["[role='toolbar']", "[data-testid*='message-actions']"]
  });

  function getAdapter(location = window.location) {
    return [chatgpt, deepseek, gemini].find((adapter) => adapter.matches(location.hostname)) || null;
  }

  namespace.sites = { SiteAdapter, getAdapter, chatgpt, deepseek, gemini };
}(window.GPTCopier));
