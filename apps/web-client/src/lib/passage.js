const isRow = (line) => /^\|.*\|$/.test(line.trim());
const cellsOf = (line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim());

export function passageBlocks(passage) {
  const blocks = [];
  for (const line of (passage || '').split('\n')) {
    const last = blocks.at(-1);
    if (isRow(line)) {
      if (last?.rows) last.rows.push(cellsOf(line));
      else blocks.push({ rows: [cellsOf(line)] });
    } else if (last && !last.rows) last.text += `\n${line}`;
    else blocks.push({ text: line });
  }
  return blocks
    .map((block) => (block.rows ? block : { text: block.text.replace(/^\n+|\s+$/g, '') }))
    .filter((block) => block.rows || block.text);
}

export const hasTable = (passage) => passageBlocks(passage).some((block) => block.rows);

export function tableRowFromTabs(line) {
  if (!line.trim().includes('\t')) return line.trim();
  const cells = line.trimEnd().split('\t').map((cell) => cell.trim());
  if (cells.length === 2 && cells[0].endsWith(':')) return cells.join(' ');
  return `| ${cells.join(' | ')} |`;
}

export const TABLE_LIMITS = Object.freeze({ rows: 30, columns: 8 });
export const MERGE_MARK = '<';
export const LINE_BREAK = '<br>';
const BREAKS = /<br\s*\/?>/gi;

const cleanCell = (cell) =>
  String(cell ?? '')
    .replace(/\|/g, '/')
    .replace(/\r?\n/g, LINE_BREAK)
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*<br\s*\/?>\s*/gi, LINE_BREAK)
    .replace(/^(?:<br>)+|(?:<br>)+$/g, '')
    .trim();

export const cellForEditing = (cell) => String(cell ?? '').replace(BREAKS, '\n');

export function tableLayout(rows) {
  const width = Math.max(0, ...rows.map((row) => row.length));
  return rows.map((row) => {
    const cells = [];
    for (let column = 0; column < width; column += 1) {
      const cell = row[column] ?? '';
      const last = cells.at(-1);
      if (cell.trim() === MERGE_MARK && last) last.span += 1;
      else cells.push({ text: cell.trim() === MERGE_MARK ? '' : cell, span: 1 });
    }
    return { cells, full: width > 1 && cells.length === 1 };
  });
}

const INLINE = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|<br\s*\/?>)/gi;
export function inlineParts(text) {
  return String(text || '')
    .split(INLINE)
    .filter(Boolean)
    .map((part) => {
      if (/^<br\s*\/?>$/i.test(part)) return { br: true };
      if (/^\*\*[^*]+\*\*$/.test(part)) return { text: part.slice(2, -2), bold: true };
      if (/^\*[^*\s][^*]*\*$/.test(part)) return { text: part.slice(1, -1), italic: true };
      return { text: part };
    });
}

export function tableRows(rows) {
  const cleaned = rows.map((row) => row.map(cleanCell)).filter((row) => row.some(Boolean));
  const width = Math.max(0, ...cleaned.map((row) => row.length));
  const last = Array.from({ length: width }, (_, column) => cleaned.some((row) => row[column])).lastIndexOf(true);
  return cleaned.slice(0, TABLE_LIMITS.rows).map((row) => Array.from({ length: Math.min(last + 1, TABLE_LIMITS.columns) }, (_, column) => row[column] || ''));
}

export function tableText(rows) {
  return tableRows(rows)
    .map((row) => `| ${row.join(' | ')} |`)
    .join('\n');
}

function delimiterOf(text) {
  const first = text.split(/\r?\n/).find((line) => line.trim()) || '';
  if (first.includes('\t')) return '\t';
  return (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
}

export function parseDelimited(text) {
  const source = String(text || '').replace(/^﻿/, '');
  const delimiter = delimiterOf(source);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let at = 0; at < source.length; at += 1) {
    const char = source[at];
    if (quoted) {
      if (char === '"' && source[at + 1] === '"') {
        cell += '"';
        at += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && !cell.trim()) {
      quoted = true;
      cell = '';
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[at + 1] === '\n') at += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return tableRows(rows);
}

export function passageTables(passage) {
  const tables = [];
  (passage || '').split('\n').forEach((line, index) => {
    if (!isRow(line)) return;
    const last = tables.at(-1);
    if (last && last.end === index - 1) {
      last.end = index;
      last.rows.push(cellsOf(line));
    } else tables.push({ start: index, end: index, rows: [cellsOf(line)] });
  });
  return tables;
}

export function withTable(passage, index, rows) {
  const text = rows ? tableText(rows) : '';
  const current = passage || '';
  const table = index === null || index === undefined ? null : passageTables(current)[index];
  if (!table) {
    if (!text) return current;
    return current.trim() ? `${current.replace(/\s+$/, '')}\n\n${text}` : text;
  }
  const lines = current.split('\n');
  const next = [...lines.slice(0, table.start), ...(text ? text.split('\n') : []), ...lines.slice(table.end + 1)].join('\n');
  return text ? next : next.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
}

export function wrapSelection(value, start, end, mark) {
  const text = String(value || '');
  let from = start;
  let to = end;
  while (from < to && /\s/.test(text[from])) from += 1;
  while (to > from && /\s/.test(text[to - 1])) to -= 1;
  if (from === to) return null;
  const picked = text.slice(from, to);
  const size = mark.length;
  if (picked.length > size * 2 && picked.startsWith(mark) && picked.endsWith(mark)) {
    const inner = picked.slice(size, -size);
    return { value: text.slice(0, from) + inner + text.slice(to), start: from, end: from + inner.length };
  }
  if (text.slice(from - size, from) === mark && text.slice(to, to + size) === mark) {
    return { value: text.slice(0, from - size) + picked + text.slice(to + size), start: from - size, end: to - size };
  }
  return { value: `${text.slice(0, from)}${mark}${picked}${mark}${text.slice(to)}`, start: from, end: to + size * 2 };
}

const ALIGNED = /^<(center|right)>([\s\S]*)<\/\1>$/i;

export function lineAlign(line) {
  const match = ALIGNED.exec(String(line ?? '').trim());
  return match ? { align: match[1].toLowerCase(), text: match[2] } : { align: 'left', text: String(line ?? '') };
}

export function alignLines(value, start, end, align) {
  const text = String(value || '');
  const lineStart = start > 0 ? text.lastIndexOf('\n', start - 1) + 1 : 0;
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end;
  const found = text.indexOf('\n', last);
  const lineEnd = found === -1 ? text.length : found;
  const middle = text
    .slice(lineStart, lineEnd)
    .split('\n')
    .map((line) => {
      if (!line.trim() || isRow(line)) return line;
      const inner = lineAlign(line).text;
      return align === 'left' ? inner : `<${align}>${inner}</${align}>`;
    })
    .join('\n');
  return { value: text.slice(0, lineStart) + middle + text.slice(lineEnd), start: lineStart, end: lineStart + middle.length };
}

export const needsPreview = (passage) =>
  hasTable(passage) || inlineParts(passage).some((part) => part.bold || part.italic) || String(passage || '').split('\n').some((line) => lineAlign(line).align !== 'left');
