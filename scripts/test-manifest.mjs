import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, "0.3.0");
assert.equal(packageJson.version, manifest.version);
assert.deepEqual(manifest.permissions, ["clipboardWrite"]);
assert.equal("content_scripts" in manifest, false);
assert.equal("host_permissions" in manifest, false);
assert.equal("optional_host_permissions" in manifest, false);
assert.equal(manifest.background.service_worker, "src/background.js");
assert.equal(manifest.action.default_title, "Open GPTCopier Paste & Convert");

let actionListener = null;
let createdTab = null;
const background = await readFile("src/background.js", "utf8");
vm.runInNewContext(background, {
  chrome: {
    action: { onClicked: { addListener(listener) { actionListener = listener; } } },
    runtime: { getURL: (path) => `chrome-extension://fixture/${path}` },
    tabs: { create: (options) => { createdTab = options; } }
  }
});
assert.equal(typeof actionListener, "function");
actionListener();
assert.equal(createdTab.url, "chrome-extension://fixture/src/converter/index.html");
assert.deepEqual(Object.keys(createdTab), ["url"]);

const converterSource = await Promise.all([
  readFile("src/converter/app.js", "utf8"),
  readFile("src/converter/convert.js", "utf8")
]).then((files) => files.join("\n"));
assert.doesNotMatch(converterSource, /(?:localStorage|sessionStorage|indexedDB|XMLHttpRequest|\bfetch\s*\()/u);
assert.doesNotMatch(converterSource, /clipboard\.read/u);

console.log("Manifest privacy and version checks passed.");
