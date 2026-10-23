export const writingGroups = [
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'grammar', label: 'Grammar' },
  { key: 'coherence', label: 'Coherence' },
  { key: 'task', label: 'Task' },
];

export function errorSegments(answer, errors = []) {
  const marks = [];
  for (const [index, error] of errors.entries()) {
    let from = 0;
    let at = answer.indexOf(error.text, from);
    while (at >= 0 && marks.some((mark) => at < mark.end && at + error.text.length > mark.start)) {
      from = at + 1;
      at = answer.indexOf(error.text, from);
    }
    if (at >= 0) marks.push({ start: at, end: at + error.text.length, index });
  }
  marks.sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) segments.push({ text: answer.slice(cursor, mark.start) });
    segments.push({ text: answer.slice(mark.start, mark.end), error: mark.index });
    cursor = mark.end;
  }
  if (cursor < answer.length) segments.push({ text: answer.slice(cursor) });
  return segments;
}

export function wordRangeState(words, min, max) {
  if (words === 0) return 'empty';
  if (words < min) return 'short';
  if (words > max) return 'long';
  return 'ok';
}
