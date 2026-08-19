(function (namespace) {
  "use strict";

  // `demoAdapter` is only set by the offline demo page. Content scripts run in
  // Chrome's isolated world, so a website cannot set it for the extension.
  const adapter = namespace.sites.getAdapter() || namespace.demoAdapter;
  if (!adapter) return;
  namespace.instance = namespace.observer.createObserver(adapter);
}(window.GPTCopier));
