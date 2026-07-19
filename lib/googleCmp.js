// Google's certified CMP (Funding Choices, wired through the AdSense script already
// on the page) defines window.__tcfapi once it decides a visitor needs a consent
// message — EEA/UK/Switzerland only. It attaches asynchronously after the AdSense
// script loads, so callers poll briefly rather than checking once on mount.
export function pollGoogleCmp(callback, { attempts = 10, interval = 200 } = {}) {
  let count = 0;
  const check = () => {
    if (typeof window.__tcfapi === 'function') { callback(true); return; }
    count += 1;
    if (count >= attempts) { callback(false); return; }
    setTimeout(check, interval);
  };
  check();
}
