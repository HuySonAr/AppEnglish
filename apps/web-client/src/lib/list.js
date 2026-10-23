
export function normalizeText(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

export function matchesSearch(text, query) {
  const haystack = normalizeText(text);
  return normalizeText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

export function compareText(a, b) {
  return normalizeText(a).localeCompare(normalizeText(b), undefined, { numeric: true });
}

export function paginate(items, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    items: items.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageCount,
    total: items.length,
  };
}

export function listStateFromParams(params, defaults) {
  const filters = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const raw = params.get(key);
    filters[key] = raw === null ? fallback : typeof fallback === 'boolean' ? raw === 'true' : raw;
  }
  const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  return { filters, page };
}

export function paramsFromListState({ filters, page }, defaults, base) {
  const next = new URLSearchParams(base);
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = filters?.[key];
    if (value === undefined || value === null || value === fallback) next.delete(key);
    else next.set(key, String(value));
  }
  if (page > 1) next.set('page', String(page));
  else next.delete('page');
  return next;
}

export function pageRange(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const current = Math.min(Math.max(1, page), pageCount);
  const wanted = new Set([1, pageCount, current - 1, current, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((n) => wanted.add(n));
  if (current >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((n) => wanted.add(n));
  const pages = [...wanted].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  const range = [];
  for (const n of pages) {
    const previous = range[range.length - 1];
    if (typeof previous === 'number' && n - previous === 2) range.push(previous + 1);
    else if (typeof previous === 'number' && n - previous > 2) range.push('…');
    range.push(n);
  }
  return range;
}
