import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

function dataKey(attribute) {
  return attribute.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.listeners = new Map();
    this.textContent = "";
    this.type = "";
    this.title = "";
    this._className = "";
    this.dataset = new Proxy({}, {
      set: (target, key, value) => {
        target[key] = String(value);
        const attribute = `data-${String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
        this.attributes.set(attribute, String(value));
        return true;
      },
      deleteProperty: (target, key) => {
        delete target[key];
        const attribute = `data-${String(key).replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
        this.attributes.delete(attribute);
        return true;
      }
    });
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this._className.split(/\s+/).filter(Boolean), ...names])].join(" "); },
      contains: (name) => this._className.split(/\s+/).includes(name)
    };
  }

  set className(value) { this._className = value; }
  get className() { return this._className; }

  setAttribute(name, value) {
    const text = String(value);
    this.attributes.set(name, text);
    if (name.startsWith("data-")) this.dataset[dataKey(name)] = text;
  }

  getAttribute(name) { return this.attributes.get(name) ?? null; }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name.startsWith("data-")) delete this.dataset[dataKey(name)];
  }

  append(...children) { children.forEach((child) => this.appendChild(child)); }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  insertAdjacentElement(position, child) {
    assert.equal(position, "afterend");
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    child.parentElement = this.parentElement;
    siblings.splice(index + 1, 0, child);
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }

  addEventListener(type, listener) { this.listeners.set(type, listener); }

  click() {
    const listener = this.listeners.get("click");
    if (listener) listener({ currentTarget: this, preventDefault() {}, stopPropagation() {} });
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (element) => {
      element.children.forEach((child) => {
        const matchesClass = selector === ".gptcopier-controls" && child.classList.contains("gptcopier-controls");
        const attributeMatch = selector.match(/^\[([^\]]+)\]$/);
        if (matchesClass || (attributeMatch && child.getAttribute(attributeMatch[1]) !== null)) matches.push(child);
        visit(child);
      });
    };
    visit(this);
    return matches;
  }
}

globalThis.document = { createElement: (tagName) => new FakeElement(tagName) };
globalThis.chrome = { runtime: { getManifest: () => ({ version: "0.2.2" }) } };
globalThis.window = {
  GPTCopier: {
    markdown: {
      convert: (content) => content.markdown,
      formatQuestionAndAnswer: (question, answer) => `Q: ${question}\nA: ${answer}`
    },
    math: { createDebugReport: () => "math-debug-report" },
    clipboard: { copyText: async (text) => copied.push(text) }
  },
  setTimeout() {}
};

const copied = [];
vm.runInThisContext(readFileSync(new URL("../src/content/ui.js", import.meta.url), "utf8"));

function createMessage(role, markdown) {
  const message = new FakeElement("article");
  const content = new FakeElement("div");
  const toolbar = new FakeElement("div");
  content.markdown = markdown;
  message.role = role;
  message.content = content;
  message.toolbar = toolbar;
  message.append(content, toolbar);
  return message;
}

function oldButton(action) {
  const button = new FakeElement("button");
  if (action) button.setAttribute("data-gptcopier-action", action);
  return button;
}

const user = createMessage("user", "question");
const assistant = createMessage("assistant", "answer");
const messages = [user, assistant];
const adapter = {
  getMessages: () => messages,
  getRole: (message) => message.role,
  getContent: (message) => message.content,
  getActionContainer: (message) => message.toolbar
};
const { ui } = window.GPTCopier;

const legacyControls = new FakeElement("span");
legacyControls.className = "gptcopier-controls";
legacyControls.append(oldButton(), oldButton());
assistant.toolbar.appendChild(legacyControls);
assistant.setAttribute("data-gptcopier-initialized", "true");

const upgraded = ui.inject(adapter, assistant);
assert.equal(assistant.getAttribute("data-gptcopier-initialized"), null, "legacy initialized marker should be removed");
assert.equal(assistant.getAttribute("data-gptcopier-version"), "0.2.2", "message should record the current version");
assert.deepEqual(
  upgraded.querySelectorAll("[data-gptcopier-action]").map((button) => button.getAttribute("data-gptcopier-action")),
  ["copy-answer", "copy-qa", "debug-math"],
  "legacy controls should upgrade to all three stable actions"
);

upgraded.querySelectorAll("[data-gptcopier-action]")[2].remove();
const rebuilt = ui.inject(adapter, assistant);
assert.notEqual(rebuilt, upgraded, "current-version controls missing Math Debug should rebuild");
assert.equal(rebuilt.querySelectorAll("[data-gptcopier-action]").length, 3);

assert.equal(ui.inject(adapter, assistant), rebuilt, "a complete current control group should be reused");
assert.equal(assistant.querySelectorAll(".gptcopier-controls").length, 1, "repeated scans must remain idempotent");

const buttons = rebuilt.querySelectorAll("[data-gptcopier-action]");
buttons[0].click();
buttons[1].click();
buttons[2].click();
await Promise.resolve();
await Promise.resolve();
assert.deepEqual(copied, ["answer", "Q: question\nA: answer", "math-debug-report"], "all actions should call their latest handlers");

console.log("UI version upgrade: 4 checks passed");
