import { LISTENING_MAX_SEGMENTS, LISTENING_SEGMENT_MAX_LENGTH, lyricText } from '@appenglish/content-contracts';
import { formatSeconds, segmentFromLine, segmentLabel } from './listening-draft.js';

// Timed files for listening exercises (D89-D91): subtitles (.srt, .vtt) and
// lyrics (.lrc) read in the browser into sentences with their times, and the
// sentences written back as .srt or .lrc.

const round = (seconds) => Math.round(seconds * 10) / 10;

// "00:01:02,500", "01:02.500" (WebVTT may leave out the hours) → seconds.
function cueTime(text) {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/.exec(text.trim());
  if (!match) return null;
  const [, hours = '0', minutes, seconds, fraction] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(fraction.padEnd(3, '0')) / 1000;
}

// Subtitle text as a sentence: lines joined, formatting tags ("<i>",
// "{\an8}"), music signs and sound notes ("[Music]", "(applause)") left out.
function subtitleText(lines) {
  return lines
    .join(' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[♪♫]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// The cues of an .srt or .vtt text: { start, end, text } in seconds. Cues
// left without words (only "[Music]" or "♪") are dropped.
export function parseSubtitles(text) {
  const cues = [];
  for (const block of text.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const at = lines.findIndex((line) => line.includes('-->'));
    if (at < 0) continue;
    const [from, to] = lines[at].split('-->');
    const start = cueTime(from);
    const end = cueTime(to.trim().split(/\s+/)[0]);
    const words = subtitleText(lines.slice(at + 1));
    if (start === null || end === null || !words) continue;
    cues.push({ start, end, text: words });
  }
  return cues;
}

const LRC_TIME = /^\[(\d+):(\d{1,2}(?:[.:]\d{1,3})?)\]/;
const LRC_TAG = /^\[([a-z]+):([^\]]*)\]\s*$/i;

// The lines of an .lrc text: { start, end, text }. A line keeps its words in
// [brackets] (the blanks of a song); only the times in front are read. A
// line with several times is sung at each of them. A line ends where the
// next one starts, or at a time on its own line; the last one at
// `duration` when it is known, else it has no end. [offset:ms] moves every
// time (a positive offset makes the lyrics come earlier).
export function parseLrc(text, { duration = null } = {}) {
  let offset = 0;
  const marks = [];
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    let line = raw.trim();
    const tag = LRC_TAG.exec(line);
    if (tag && !/^\d+$/.test(tag[1])) {
      if (tag[1].toLowerCase() === 'offset') offset = Number(tag[2]) / 1000 || 0;
      continue;
    }
    const times = [];
    for (let match = LRC_TIME.exec(line); match; match = LRC_TIME.exec(line)) {
      times.push(Number(match[1]) * 60 + Number(match[2].replace(':', '.')));
      line = line.slice(match[0].length).trimStart();
    }
    if (!times.length) continue;
    // Enhanced LRC times the words too: "<00:12.80>word".
    const words = line.replace(/<\d+:\d{1,2}(?:[.:]\d{1,3})?>/g, '').replace(/\s+/g, ' ').trim();
    for (const time of times) marks.push({ time: Math.max(0, time - offset), text: words });
  }
  marks.sort((a, b) => a.time - b.time);
  const lines = [];
  marks.forEach((mark, index) => {
    if (!mark.text) return;
    const next = marks[index + 1];
    lines.push({ start: mark.time, end: next ? next.time : duration, text: mark.text });
  });
  return lines;
}

// Which kind of timed file the text is: 'srt' (also .vtt), 'lrc' or null.
export function timedFormat(text) {
  if (/-->/.test(text)) return 'srt';
  if (/^\s*\[\d+:\d{1,2}/m.test(text)) return 'lrc';
  return null;
}

// What importing a timed file does (PasteDialog): the sentences afterwards
// (the imported ones replace those there), their number and the lines to
// check. duration is the recording's length in seconds when known.
export function timedImportPlan(segments, text, kind, { duration = null } = {}) {
  const format = timedFormat(text);
  const timed = format === 'srt' ? parseSubtitles(text) : format === 'lrc' ? parseLrc(text, { duration }) : [];
  const imported = timed.map((item) =>
    segmentFromLine(item.text, kind, { start: round(item.start), end: item.end === null ? null : round(item.end) }),
  );
  const max = kind.segmentCount || LISTENING_MAX_SEGMENTS;
  const lines = imported.map((segment, index) => {
    const errors = [];
    const warnings = [];
    if (index >= max) errors.push(kind.segmentCount ? `Part ${kind.number} has ${kind.segmentCount} sentences` : `at most ${max} sentences`);
    if (!segment.text) errors.push('no words');
    if (segment.text.length > LISTENING_SEGMENT_MAX_LENGTH) errors.push(`longer than ${LISTENING_SEGMENT_MAX_LENGTH} characters`);
    if (segment.end === null) warnings.push('no end time: set it in the editor');
    else if (segment.end <= segment.start) warnings.push('ends before it starts');
    return {
      title: segmentLabel(kind, index),
      note: ` · ${formatSeconds(segment.start)}–${segment.end === null ? '?' : formatSeconds(segment.end)}${segment.speaker ? ` · ${segment.speaker}` : ''}`,
      text: segment.text,
      errors,
      warnings,
    };
  });
  if (kind.segmentCount && imported.length && imported.length < kind.segmentCount)
    lines[0].warnings.push(`${imported.length} of ${kind.segmentCount} sentences`);
  const usable = lines.every((line) => !line.errors.length);
  const next = [...imported];
  if (kind.segmentCount) while (next.length < kind.segmentCount) next.push(segmentFromLine('', kind));
  return { segments: usable ? next : segments, count: imported.length, lines };
}

// Every time moved by `seconds` (negative: earlier), never below 0.
export function shiftTimes(segments, seconds) {
  const move = (time) => (time === null ? null : Math.max(0, round(time + seconds)));
  return segments.map((segment) => ({ ...segment, start: move(segment.start), end: move(segment.end) }));
}

// 62.5 → "00:01:02,500".
function srtTime(seconds) {
  const millis = Math.round(seconds * 1000);
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return `${pad(Math.floor(millis / 3600000))}:${pad(Math.floor(millis / 60000) % 60)}:${pad(Math.floor(millis / 1000) % 60)},${pad(millis % 1000, 3)}`;
}

// The sentences with a start and an end after it, in the order of the
// recording, each with the text to write: Parts 1-2 with their label
// ("(A) …", "Question: …") and a speaker in front ("Man: …"), so the file
// reads well and comes back the same through "Import timed file". A song
// keeps its [blanks] only when `blanks` is set.
function timedLines(segments, kind, { blanks }) {
  return segments
    .map((segment, index) => ({ segment, index }))
    .filter(({ segment }) => segment.text.trim() && segment.start !== null && segment.end !== null && segment.end > segment.start)
    .sort((a, b) => a.segment.start - b.segment.start)
    .map(({ segment, index }) => {
      const words = kind.key === 'song' && !blanks ? lyricText(segment.text) : segment.text;
      const label = kind.labels?.[index];
      const prefix = label ? (label.startsWith('(') ? `${label} ` : `${label}: `) : segment.speaker ? `${segment.speaker}: ` : '';
      return { start: segment.start, end: segment.end, text: `${prefix}${words}`.trim() };
    });
}

// The sentences as an .srt file (D90). A song is written without its
// [brackets], which subtitles read as sound notes. `skipped` counts the
// sentences left out for want of a start and an end.
export function toSrt(segments, kind) {
  const lines = timedLines(segments, kind, { blanks: false });
  const cues = lines.map((line, at) => `${at + 1}\n${srtTime(line.start)} --> ${srtTime(line.end)}\n${line.text}\n`);
  return { text: cues.join('\n'), count: lines.length, skipped: segments.length - lines.length };
}

// 62.5 → "01:02.50".
function lrcTime(seconds) {
  const hundredths = Math.round(seconds * 100);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(hundredths / 6000))}:${pad(Math.floor(hundredths / 100) % 60)}.${pad(hundredths % 100)}`;
}

// The sentences as an .lrc file (D91), keeping a song's [blanks]. LRC has
// only start times, so an end is written as a time on its own line wherever
// the next line does not start right then; the file comes back with the same
// starts and ends.
export function toLrc(segments, kind, { title = '' } = {}) {
  const lines = timedLines(segments, kind, { blanks: true });
  const out = title ? [`[ti:${title.replace(/[[\]]/g, '')}]`] : [];
  lines.forEach((line, at) => {
    out.push(`[${lrcTime(line.start)}]${line.text}`);
    const next = lines[at + 1];
    if (!next || Math.abs(next.start - line.end) > 0.005) out.push(`[${lrcTime(line.end)}]`);
  });
  return { text: `${out.join('\n')}\n`, count: lines.length, skipped: segments.length - lines.length };
}

// The file of the format: 'srt' or 'lrc'.
export const ExportFormat = Object.freeze({ SRT: 'srt', LRC: 'lrc' });
export function exportFile(segments, kind, format, { title = '' } = {}) {
  return format === ExportFormat.LRC ? toLrc(segments, kind, { title }) : toSrt(segments, kind);
}

// "Proud of You!" → "proud-of-you".
export function exportBaseName(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'listening';
}

// The format a chosen file name asks for, by its extension; srt otherwise.
export const formatOfFileName = (name) => (/\.lrc$/i.test(name) ? ExportFormat.LRC : ExportFormat.SRT);
