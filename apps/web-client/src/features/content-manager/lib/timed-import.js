import { LISTENING_MAX_SEGMENTS, LISTENING_SEGMENT_MAX_LENGTH, lyricText } from '@appenglish/content-contracts';
import { formatSeconds, segmentFromLine, segmentLabel } from './listening-draft.js';

const round = (seconds) => Math.round(seconds * 10) / 10;

function cueTime(text) {
  const match = /^(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/.exec(text.trim());
  if (!match) return null;
  const [, hours = '0', minutes, seconds, fraction] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(fraction.padEnd(3, '0')) / 1000;
}

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

export function timedFormat(text) {
  if (/-->/.test(text)) return 'srt';
  if (/^\s*\[\d+:\d{1,2}/m.test(text)) return 'lrc';
  return null;
}

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

export function shiftTimes(segments, seconds) {
  const move = (time) => (time === null ? null : Math.max(0, round(time + seconds)));
  return segments.map((segment) => ({ ...segment, start: move(segment.start), end: move(segment.end) }));
}

function srtTime(seconds) {
  const millis = Math.round(seconds * 1000);
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  return `${pad(Math.floor(millis / 3600000))}:${pad(Math.floor(millis / 60000) % 60)}:${pad(Math.floor(millis / 1000) % 60)},${pad(millis % 1000, 3)}`;
}

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

export function toSrt(segments, kind) {
  const lines = timedLines(segments, kind, { blanks: false });
  const cues = lines.map((line, at) => `${at + 1}\n${srtTime(line.start)} --> ${srtTime(line.end)}\n${line.text}\n`);
  return { text: cues.join('\n'), count: lines.length, skipped: segments.length - lines.length };
}

function lrcTime(seconds) {
  const hundredths = Math.round(seconds * 100);
  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(Math.floor(hundredths / 6000))}:${pad(Math.floor(hundredths / 100) % 60)}.${pad(hundredths % 100)}`;
}

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

export const ExportFormat = Object.freeze({ SRT: 'srt', LRC: 'lrc' });
export function exportFile(segments, kind, format, { title = '' } = {}) {
  return format === ExportFormat.LRC ? toLrc(segments, kind, { title }) : toSrt(segments, kind);
}

export function exportBaseName(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'listening';
}

export const formatOfFileName = (name) => (/\.lrc$/i.test(name) ? ExportFormat.LRC : ExportFormat.SRT);
