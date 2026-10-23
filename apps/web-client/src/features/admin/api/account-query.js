export function adminAccountListParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([key, value]) => !(['email', 'search', 'role', 'status', 'stale', 'sort'].includes(key) && value === ''),
    ),
  );
}
