import { LISTENING_MAX_SEGMENTS, LISTENING_SEGMENT_MAX_LENGTH, listeningKind } from '@appenglish/content-contracts';

// The editor of a listening exercise (F05B-2, D85): one recording and the
// sentences of its transcript, each with its place in the recording.

export const listeningKindOf = listeningKind;

export function newSegment(fields = {}) {
  return { id: crypto.randomUUID(), speaker: '', text: '', start: null, end: null, ...fields };
}

// The content the editor starts from: the draft, else the published version,
// else nothing. Parts 1 and 2 always show their four sentences.
export function workingListening(data, kindKey) {
  const content = data.draft?.content || data.published?.content || {};
  const segments = (content.segments || []).map((segment) => newSegment(segment));
  const { segmentCount } = listeningKindOf(kindKey);
  if (segmentCount) while (segments.length < segmentCount) segments.push(newSegment());
  return { audioMediaId: content.audioMediaId ?? null, segments };
}

// What a sentence is called in the editor and in issues: its fixed label in
// Parts 1 and 2 ("(B)", "Question"), "Line 3" in a song, else "Sentence 3".
export function segmentLabel(kind, index) {
  return kind.labels?.[index] ?? `${kind.key === 'song' ? 'Line' : 'Sentence'} ${index + 1}`;
}

// "1:02.5" for 62.5 seconds; '' for none.
export function formatSeconds(value) {
  if (value === null || value === undefined) return '';
  const tenths = Math.round(value * 10);
  const minutes = Math.floor(tenths / 600);
  const rest = (tenths % 600) / 10;
  return `${minutes}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}`;
}

// Seconds from "62.5", "1:02.5" or "1:02"; null when empty; NaN when it is
// not a time.
export function parseSeconds(text) {
  const value = text.trim();
  if (!value) return null;
  const match = /^(?:(\d+):)?(\d+(?:\.\d+)?)$/.exec(value);
  if (!match) return Number.NaN;
  const seconds = Number(match[2]);
  if (match[1] !== undefined && seconds >= 60) return Number.NaN;
  return Math.round(((match[1] ? Number(match[1]) * 60 : 0) + seconds) * 10) / 10;
}

// Sentences from a pasted transcript, one per non-empty line. In Parts 1 and
// 2 a leading "(A)" or "A." is dropped, the label being fixed; elsewhere a
// leading "Man:" or "W:" becomes the speaker.
const LETTER = /^\(?[A-D][).]\s*/;
const SPEAKER = /^([A-Za-z][A-Za-z .'-]{0,38}):\s+(.+)$/;
export function segmentFromLine(line, kind, fields = {}) {
  if (kind.labels) return newSegment({ ...fields, text: line.replace(LETTER, '').replace(/^Question\s*[:.]\s*/i, '') });
  // Song lines are kept as they are: "Chorus:" is not a speaker.
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

// What pasting a transcript does (PasteDialog): the sentences afterwards,
// their number and the lines to check. The pasted sentences replace the ones
// there; a sentence keeps the times of the one it replaces, so a corrected
// text can be pasted again without cutting the recording anew.
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

// Sets the end of a sentence; the next sentence starts there if it has no
// start yet, so a recording is cut in one pass.
export function withEnd(segments, index, seconds) {
  return segments.map((segment, at) => {
    if (at === index) return { ...segment, end: seconds };
    if (at === index + 1 && segment.start === null) return { ...segment, start: seconds };
    return segment;
  });
}

// "Sentence 3 · start" for the publish issue path "segments[2].start".
export function listeningIssueLabel(path, kind) {
  if (path === 'audioMediaId') return 'Recording';
  if (path === 'segments') return 'Sentences';
  const match = /^segments\[(\d+)\]\.(\w+)$/.exec(path);
  if (!match) return path;
  return `${segmentLabel(kind, Number(match[1]))} · ${match[2]}`;
}
