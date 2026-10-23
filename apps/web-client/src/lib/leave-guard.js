let guard = null;

export function setLeaveGuard(onAttempt) {
  guard = onAttempt;
  return () => {
    if (guard === onAttempt) guard = null;
  };
}

export function canLeave() {
  if (!guard) return true;
  guard();
  return false;
}
