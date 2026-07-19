// window.__tcfapi (the IAB TCF stub) gets defined by Google's CMP script for every
// visitor worldwide once AdSense messaging is enabled — its mere presence does NOT
// mean this visitor is getting a consent message. Only tcData.gdprApplies === true
// means Google decided this visitor is in a region (EEA/UK/Switzerland) where it
// handles consent itself; everyone else still needs our own CookieBanner.
//
// __tcfapi attaches asynchronously after the AdSense script loads, so this polls
// briefly for it to appear before asking it whether GDPR applies here. If it never
// appears, or never answers, we fail open (callback(false)) so a real visitor is
// never left with no consent notice at all.
export function pollGoogleCmp(callback, { attempts = 10, interval = 200, responseTimeout = 3000 } = {}) {
  let count = 0;
  const check = () => {
    if (typeof window.__tcfapi === 'function') {
      askGdprApplies(window.__tcfapi, callback, responseTimeout);
      return;
    }
    count += 1;
    if (count >= attempts) { callback(false); return; }
    setTimeout(check, interval);
  };
  check();
}

function askGdprApplies(tcfapi, callback, responseTimeout) {
  let done = false;
  const finish = (v) => { if (done) return; done = true; callback(v); };
  const timer = setTimeout(() => finish(false), responseTimeout);
  try {
    tcfapi('addEventListener', 2, (tcData, success) => {
      if (!success || !tcData || tcData.gdprApplies == null) return;
      clearTimeout(timer);
      finish(tcData.gdprApplies === true);
    });
  } catch (e) {
    clearTimeout(timer);
    finish(false);
  }
}
