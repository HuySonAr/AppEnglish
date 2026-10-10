// An empty filter means "all" in the UI; the API represents that by omission.
export function adminAccountListParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) => !(['email', 'role', 'status'].includes(key) && value === ''),
    ),
  );
}
