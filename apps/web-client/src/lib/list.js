// Helpers for lists that are searched, sorted and paged in the browser.

// Lower case without accents, so "hop dong" finds "Hợp đồng".
export function normalizeText(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim();
}

// True when every word of the query appears in the text.
export function matchesSearch(text, query) {
  const haystack = normalizeText(text);
  return normalizeText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

// Natural order: "Lesson 2" before "Lesson 10".
export function compareText(a, b) {
  return normalizeText(a).localeCompare(normalizeText(b), undefined, { numeric: true });
}

// One page of items. A page beyond the end becomes the last page, so a list
// that shrinks (after a search) never shows an empty page.
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
