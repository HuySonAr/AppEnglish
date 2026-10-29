import { useRef, useState } from 'react';
import { Bold, FileUp, Italic, Plus, Table2, TableCellsMerge, TableCellsSplit, Trash2, X } from 'lucide-react';
import { MERGE_MARK, TABLE_LIMITS, cellForEditing, parseDelimited, passageTables, tableRows, withTable } from '../../lib/passage.js';
import { notify } from '../../lib/notify.js';
import { cn } from '../../lib/utils.js';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui';
import { Textarea } from '../ui/textarea.jsx';

const MAX_CSV_BYTES = 200 * 1024;
const blankRows = (rows, columns) => Array.from({ length: rows }, () => Array(columns).fill(''));
const forEditing = (rows) => {
  const width = Math.max(1, ...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, column) => cellForEditing(row[column] || '')));
};
const tooBig = (rows) => rows.length > TABLE_LIMITS.rows || rows.some((row) => row.length > TABLE_LIMITS.columns);
const clamp = (rows) => rows.slice(0, TABLE_LIMITS.rows).map((row) => row.slice(0, TABLE_LIMITS.columns));
const limitNote = () => notify({ title: `Only ${TABLE_LIMITS.rows} rows and ${TABLE_LIMITS.columns} columns are kept` });
const isMerged = (cell) => cell.trim() === MERGE_MARK;
const removeButton = 'mx-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30';

function TableDialog({ editing, onClose, onSave, onRemove }) {
  const [rows, setRows] = useState(() => forEditing(editing.rows));
  const [focus, setFocus] = useState(null);
  const fileRef = useRef(null);
  const cellRefs = useRef({});
  const columns = rows[0]?.length || 0;

  const setCell = (row, column, value) => setRows((current) => current.map((cells, at) => (at === row ? cells.map((cell, index) => (index === column ? value : cell)) : cells)));
  const ownerOf = (row, column) => {
    let at = column;
    while (at > 0 && isMerged(rows[row][at])) at -= 1;
    return at;
  };
  const focusCell = (row, column) => cellRefs.current[`${row}-${column}`]?.focus();

  const focused = focus && rows[focus.row] && !isMerged(rows[focus.row][focus.column] ?? '') ? focus : null;
  const nextFree = focused ? (() => {
    let at = focused.column + 1;
    while (at < columns && isMerged(rows[focused.row][at])) at += 1;
    return at < columns ? at : null;
  })() : null;
  const canUnmerge = focused && isMerged(rows[focused.row][focused.column + 1] ?? '');

  function wrap(mark) {
    if (!focused) return;
    const { row, column } = focused;
    const element = cellRefs.current[`${row}-${column}`];
    const value = rows[row][column];
    let start = element?.selectionStart ?? 0;
    let end = element?.selectionEnd ?? value.length;
    if (start === end) {
      start = 0;
      end = value.length;
    }
    const picked = value.slice(start, end);
    if (!picked.trim()) return;
    const marked = picked.length > mark.length * 2 && picked.startsWith(mark) && picked.endsWith(mark);
    setCell(row, column, value.slice(0, start) + (marked ? picked.slice(mark.length, -mark.length) : `${mark}${picked}${mark}`) + value.slice(end));
    requestAnimationFrame(() => element?.focus());
  }

  function mergeRight() {
    if (!focused || nextFree === null) return;
    const { row, column } = focused;
    const moved = rows[row][nextFree].trim();
    setRows((current) =>
      current.map((cells, at) => (at === row ? cells.map((cell, index) => (index === nextFree ? MERGE_MARK : index === column && moved ? `${cell}${cell ? ' ' : ''}${moved}` : cell)) : cells)),
    );
    requestAnimationFrame(() => focusCell(row, column));
  }

  function unmerge() {
    if (!canUnmerge) return;
    const { row, column } = focused;
    setRows((current) =>
      current.map((cells, at) => {
        if (at !== row) return cells;
        const next = [...cells];
        for (let index = column + 1; index < next.length && isMerged(next[index]); index += 1) next[index] = '';
        return next;
      }),
    );
    requestAnimationFrame(() => focusCell(row, column));
  }

  function paste(event, row, column) {
    const text = event.clipboardData.getData('text/plain');
    if (!/[\t\n]/.test(text)) return;
    event.preventDefault();
    const pasted = forEditing(parseDelimited(text));
    if (!pasted.length) return;
    setRows((current) => {
      const height = Math.max(current.length, row + pasted.length);
      const width = Math.max(current[0]?.length || 0, column + Math.max(...pasted.map((cells) => cells.length)));
      const grid = Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => current[r]?.[c] || ''));
      pasted.forEach((cells, r) => cells.forEach((cell, c) => (grid[row + r][column + c] = cell)));
      if (tooBig(grid)) limitNote();
      return clamp(grid);
    });
  }

  async function upload(file) {
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) return notify({ title: 'The file is too large', description: 'Use a CSV file under 200 KB.', variant: 'destructive' });
    const parsed = parseDelimited(await file.text());
    if (!parsed.length) return notify({ title: 'No rows found in the file', variant: 'destructive' });
    if (tooBig(parsed)) limitNote();
    setRows(forEditing(clamp(parsed)));
  }

  function save() {
    const cleaned = tableRows(rows);
    if (!cleaned.length) return notify({ title: 'Fill in at least one cell', variant: 'destructive' });
    onSave(cleaned);
  }

  const keepFocus = (event) => event.preventDefault();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{editing.index === null ? 'Add a table' : `Edit table ${editing.index + 1}`}</DialogTitle>
          <DialogDescription>Paste cells from Excel or Google Sheets, or upload a CSV file. The first row is the header.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              upload(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <FileUp className="h-4 w-4" />
            Upload CSV
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={rows.length >= TABLE_LIMITS.rows} onClick={() => setRows((current) => [...current, Array(columns).fill('')])}>
            <Plus className="h-4 w-4" />
            Row
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={columns >= TABLE_LIMITS.columns} onClick={() => setRows((current) => current.map((cells) => [...cells, '']))}>
            <Plus className="h-4 w-4" />
            Column
          </Button>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <div className="flex items-center gap-1" role="group" aria-label="Format the selected cell">
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Bold" title="Bold" disabled={!focused} onMouseDown={keepFocus} onClick={() => wrap('**')}>
              <Bold className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Italic" title="Italic" disabled={!focused} onMouseDown={keepFocus} onClick={() => wrap('*')}>
              <Italic className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" disabled={nextFree === null} onMouseDown={keepFocus} onClick={mergeRight}>
              <TableCellsMerge className="h-4 w-4" />
              Merge →
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5" disabled={!canUnmerge} onMouseDown={keepFocus} onClick={unmerge}>
              <TableCellsSplit className="h-4 w-4" />
              Unmerge
            </Button>
          </div>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {rows.length} × {columns}
          </span>
        </div>

        <div className="max-h-[55dvh] overflow-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-8 bg-muted/40" />
                {Array.from({ length: columns }, (_, column) => (
                  <th key={column} className="bg-muted/40 px-1 py-1">
                    <button
                      type="button"
                      className={removeButton}
                      aria-label={`Remove column ${column + 1}`}
                      disabled={columns <= 1}
                      onClick={() => setRows((current) => current.map((cells) => cells.filter((_, at) => at !== column)))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, row) => (
                <tr key={row} className="border-t">
                  <td className="w-8 px-1 text-center align-top pt-2">
                    <button type="button" className={removeButton} aria-label={`Remove row ${row + 1}`} disabled={rows.length <= 1} onClick={() => setRows((current) => current.filter((_, at) => at !== row))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  {cells.map((cell, column) => (
                    <td key={column} className="p-1 align-top">
                      {isMerged(cell) ? (
                        <button
                          type="button"
                          className="flex h-8 w-full min-w-[7rem] items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground transition-colors hover:bg-muted/50"
                          onClick={() => focusCell(row, ownerOf(row, column))}
                        >
                          ← merged
                        </button>
                      ) : (
                        <Textarea
                          ref={(element) => (cellRefs.current[`${row}-${column}`] = element)}
                          aria-label={`Row ${row + 1}, column ${column + 1}`}
                          value={cell}
                          maxLength={200}
                          rows={Math.max(1, cell.split('\n').length)}
                          placeholder={row === 0 ? 'Header' : ''}
                          className={cn(
                            'min-h-8 min-w-[7rem] resize-none px-3 py-1.5 text-sm leading-5',
                            row === 0 && 'bg-muted/50 font-semibold',
                            focus?.row === row && focus?.column === column && 'ring-2 ring-ring ring-offset-0',
                            isMerged(cells[column + 1] ?? '') && 'border-primary/50',
                          )}
                          onFocus={() => setFocus({ row, column })}
                          onPaste={(event) => paste(event, row, column)}
                          onChange={(event) => setCell(row, column, event.target.value)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">Enter starts a new line in a cell.</p>

        <DialogFooter className="gap-2 sm:justify-between">
          {editing.index === null ? (
            <span />
          ) : (
            <Button type="button" variant="ghost" className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
              Remove table
            </Button>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={save}>
              {editing.index === null ? 'Insert table' : 'Save table'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TableTool({ value, onChange, maxLength, disabled = false, className }) {
  const [editing, setEditing] = useState(null);
  const tables = passageTables(value);

  function apply(rows) {
    const next = withTable(value, editing.index, rows);
    if (maxLength && next.length > maxLength) return notify({ title: 'The text is too long with this table', description: `Keep it under ${maxLength} characters.`, variant: 'destructive' });
    onChange(next);
    setEditing(null);
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" disabled={disabled} onClick={() => setEditing({ index: null, rows: blankRows(3, 3) })}>
        <Table2 className="h-4 w-4" />
        Add table
      </Button>
      {tables.map((table, index) => (
        <Button key={`${index}-${table.start}`} type="button" variant="ghost" size="sm" className="h-8" disabled={disabled} onClick={() => setEditing({ index, rows: table.rows })}>
          Edit table {index + 1}
        </Button>
      ))}
      {editing ? <TableDialog editing={editing} onClose={() => setEditing(null)} onSave={apply} onRemove={() => apply(null)} /> : null}
    </div>
  );
}
