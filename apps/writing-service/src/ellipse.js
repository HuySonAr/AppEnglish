export const ELLIPSE_FIELDS = Object.freeze(['cohesion', 'syntax', 'vocabulary', 'phraseology', 'grammar', 'conventions', 'overall']);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}

export function readEllipse(text) {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ''));
  const column = (name) => header.findIndex((cell) => cell.trim().toLowerCase() === name);
  const at = { id: column('text_id_kaggle') >= 0 ? column('text_id_kaggle') : column('text_id'), text: column('full_text'), prompt: column('prompt') };
  for (const field of ELLIPSE_FIELDS) at[field] = column(field);
  if (at.text < 0 || ELLIPSE_FIELDS.some((field) => at[field] < 0)) throw new Error('The CSV needs full_text and the ELLIPSE score columns');
  return body.map((cells, index) => ({
    id: at.id >= 0 ? cells[at.id] : String(index + 1),
    text: cells[at.text].trim(),
    prompt: at.prompt >= 0 ? cells[at.prompt].trim() : '',
    expert: Object.fromEntries(ELLIPSE_FIELDS.map((field) => [field, Number(cells[at[field]])])),
  }));
}

export function sampleItems(items, limit, seed) {
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, limit).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function evaluationJob(item, wordsOf) {
  const words = wordsOf(item.text);
  return {
    prompt: {
      title: item.prompt || 'Essay',
      level: 'B1',
      taskType: 'essay',
      instructions: item.prompt ? `Write an argumentative essay on this topic: ${item.prompt}` : 'Write an argumentative essay.',
      minWords: 1,
      maxWords: Math.max(words, 1),
      sampleAnswer: 'No sample answer is given; judge the task from the instructions only.',
      keyPoints: [],
    },
    answer: item.text,
  };
}

export function systemScores(result) {
  const values = ['cohesion', 'syntax', 'vocabulary', 'phraseology', 'grammar', 'conventions'].map((key) => result.criteria[key]);
  return { ...result.criteria, overall: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 2) / 2, total: result.scores.total };
}
