import { LISTENING_MAX_SEGMENTS, LISTENING_SEGMENT_MAX_LENGTH, listeningKind } from '@appenglish/content-contracts';

export const listeningKindOf = listeningKind;

export function newSegment(fields = {}) {
  return { id: crypto.randomUUID(), speaker: '', text: '', start: null, end: null, ...fields };
}

export function workingListening(data, kindKey) {
  const content = data.draft?.content || data.published?.content || {};
  const segments = (content.segments || []).map((segment) => newSegment(segment));
  const { segmentCount } = listeningKindOf(kindKey);
  if (segmentCount) while (segments.length < segmentCount) segments.push(newSegment());
  return { audioMediaId: content.audioMediaId ?? null, segments, source: { name: '', url: '', ...(content.source || {}) } };
}

export function segmentLabel(kind, index) {
  return kind.labels?.[index] ?? `${kind.key === 'song' ? 'Line' : 'Sentence'} ${index + 1}`;
}

export function formatSeconds(value) {
  if (value === null || value === undefined) return '';
  const tenths = Math.round(value * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = (tenths % 600) / 10;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
}

export function parseSeconds(text) {
  const value = text.trim();
  if (!value) return null;
  const match = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(value);
  if (!match) return Number.NaN;
  const seconds = Number(match[2]);
  if (match[1] !== undefined && seconds >= 60) return Number.NaN;
  return Math.round(((match[1] ? Number(match[1]) * 60 : 0) + seconds) * 10) / 10;
}

const LETTER = /^\(?[A-D][).]\s*/;
const SPEAKER = /^([A-Za-z][A-Za-z .'-]{0,38}):\s+(.+)$/;
export function segmentFromLine(line, kind, fields = {}) {
  if (kind.labels) return newSegment({ ...fields, text: line.replace(LETTER, '').replace(/^Question\s*[:.]\s*/i, '') });
  if (kind.key === 'song') return newSegment({ ...fields, text: line });
  const spoken = SPEAKER.exec(line);
  return spoken ? newSegment({ ...fields, speaker: spoken[1].trim(), text: spoken[2] }) : newSegment({ ...fields, text: line });
}

export function segmentsFromText(text, kind) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => segmentFromLine(line, kind));
}

export function listeningPastePlan(segments, text, kind) {
  const pasted = segmentsFromText(text, kind);
  const max = kind.segmentCount || LISTENING_MAX_SEGMENTS;
  const lines = pasted.map((segment, index) => {
    const errors = [];
    if (index >= max) errors.push(kind.segmentCount ? `Part ${kind.number} has ${kind.segmentCount} sentences` : `at most ${max} sentences`);
    if (segment.text.length > LISTENING_SEGMENT_MAX_LENGTH) errors.push(`longer than ${LISTENING_SEGMENT_MAX_LENGTH} characters`);
    const kept = segments[index];
    const timed = kept && (kept.start !== null || kept.end !== null);
    return {
      title: segmentLabel(kind, index),
      note: `${segment.speaker ? ` · ${segment.speaker}` : ''}${timed ? ' · keeps its times' : ''}`,
      text: segment.text,
      errors,
      warnings: [],
    };
  });
  if (kind.segmentCount && pasted.length && pasted.length < kind.segmentCount)
    lines[0].warnings.push(`${pasted.length} of ${kind.segmentCount} sentences`);
  const usable = lines.every((line) => !line.errors.length);
  const next = pasted.map((segment, index) => ({ ...segment, start: segments[index]?.start ?? null, end: segments[index]?.end ?? null }));
  if (kind.segmentCount) while (next.length < kind.segmentCount) next.push(newSegment());
  return { segments: usable ? next : segments, count: pasted.length, lines };
}

export function withEnd(segments, index, seconds) {
  return segments.map((segment, at) => {
    if (at === index) return { ...segment, end: seconds };
    if (at === index + 1 && segment.start === null) return { ...segment, start: seconds };
    return segment;
  });
}

export function listeningIssueLabel(path, kind) {
  if (path === 'audioMediaId') return 'Recording';
  if (path === 'segments') return 'Sentences';
  const match = /^segments\[(\d+)\]\.(\w+)$/.exec(path);
  if (!match) return path;
  return `${segmentLabel(kind, Number(match[1]))} · ${match[2]}`;
}

export const AUTO_TIME_CHECK_BELOW = 0.8;
export const AUTO_TIME_CHECK_LONGER = 12;

export function applyAutoTime(segments, answer) {
  const byId = new Map(answer.map((line) => [line.id, line]));
  let timed = 0;
  const check = [];
  const next = segments.map((segment) => {
    const found = byId.get(segment.id);
    if (!found) return segment;
    if (found.start === null || found.end === null) {
      check.push(segment.id);
      return segment;
    }
    timed += 1;
    if (found.matched < AUTO_TIME_CHECK_BELOW || found.end - found.start > AUTO_TIME_CHECK_LONGER) check.push(segment.id);
    return { ...segment, start: found.start, end: found.end };
  });
  return { segments: next, timed, check };
}

export function transcribedSegments(lines, kind) {
  const segments = lines.map((line) => newSegment({ text: line.text, start: line.start, end: line.end }));
  if (kind.segmentCount) while (segments.length < kind.segmentCount) segments.push(newSegment());
  return segments;
}

export function translationPastePlan(segments, text) {
  const pasted = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines = pasted.map((line, index) => ({
    title: `Sentence ${index + 1}`,
    note: segments[index] ? ` · ${segments[index].text.slice(0, 60)}` : '',
    text: line,
    errors: index >= segments.length ? [`there are only ${segments.length} sentences`] : line.length > 1000 ? ['longer than 1000 characters'] : [],
    warnings: [],
  }));
  if (pasted.length && pasted.length < segments.length) lines[0].warnings.push(`${pasted.length} of ${segments.length} sentences; the rest keep theirs`);
  const usable = lines.every((line) => !line.errors.length);
  const next = segments.map((segment, index) => (index < pasted.length ? { ...segment, translation: pasted[index] } : segment));
  return { segments: usable ? next : segments, count: pasted.length, lines };
}


const sameText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export function keepSentenceExtras(previous, next, fields = ['translation']) {
  const byId = new Map(previous.map((segment) => [segment.id, segment]));
  return next.map((segment, index) => {
    if (fields.every((field) => field in segment)) return segment;
    const before = byId.get(segment.id) || (sameText(previous[index]?.text) === sameText(segment.text) ? previous[index] : null);
    return { ...segment, ...Object.fromEntries(fields.map((field) => [field, before?.[field] || ''])) };
  });
}
