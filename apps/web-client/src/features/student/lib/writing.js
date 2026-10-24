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

export function wordMeter(words, min, max) {
  const scale = Math.max(max * 1.2, 1);
  const percent = (value) => Math.min(100, Math.round((value / scale) * 1000) / 10);
  return { fill: percent(words), zoneStart: percent(min), zoneEnd: percent(max), state: wordRangeState(words, min, max) };
}

export function wordHint(words, min, max) {
  if (words === 0) return `Write ${min}–${max} words.`;
  if (words < min) return `${min - words} more word${min - words === 1 ? '' : 's'} to go.`;
  if (words > max) return `${words - max} word${words - max === 1 ? '' : 's'} over the limit.`;
  return 'Ready to submit.';
}
