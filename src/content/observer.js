(function (namespace) {
  "use strict";

  function createObserver(adapter) {
    let scheduled = false;
    const scan = () => {
      scheduled = false;
      adapter.getMessages().forEach((message) => namespace.ui.inject(adapter, message));
    };
    const schedule = () => {
      if (!scheduled) {
        scheduled = true;
        window.requestAnimationFrame(scan);
      }
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    schedule();
    return { disconnect: () => observer.disconnect(), scan };
  }

  namespace.observer = { createObserver };
}(window.GPTCopier));
