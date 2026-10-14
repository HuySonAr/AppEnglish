// A reading passage is plain text. Lines written "| cell | cell |" are the
// rows of a table, the first row holding its headings (D76).
const isRow = (line) => /^\|.*\|$/.test(line.trim());
const cellsOf = (line) => line.trim().slice(1, -1).split('|').map((cell) => cell.trim());

// The passage as blocks in reading order: { text } for lines of text (its
// line breaks kept) and { rows } for a table, each row a list of cells.
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

// A line copied from a table of a web page or a document, where tabs separate
// the cells, written as a table row; any other line as it is. "To:<tab>All
// staff" is a label with its value, not a row.
export function tableRowFromTabs(line) {
  if (!line.trim().includes('\t')) return line.trim();
  const cells = line.trimEnd().split('\t').map((cell) => cell.trim());
  if (cells.length === 2 && cells[0].endsWith(':')) return cells.join(' ');
  return `| ${cells.join(' | ')} |`;
}
