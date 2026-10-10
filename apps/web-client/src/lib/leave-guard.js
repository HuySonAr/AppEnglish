// Lets one page at a time refuse navigation away from it (e.g. a test in
// progress). The page registers a guard; anything about to leave the page
// asks canLeave() first.
let guard = null;

// Registers the guard and returns the function that removes it. The guard is
// called when something tries to leave; it should tell the user why not.
export function setLeaveGuard(onAttempt) {
  guard = onAttempt;
  return () => {
    if (guard === onAttempt) guard = null;
  };
}

// True when leaving is allowed. When a guard is set, it is notified and the
// caller must stay.
export function canLeave() {
  if (!guard) return true;
  guard();
  return false;
}
