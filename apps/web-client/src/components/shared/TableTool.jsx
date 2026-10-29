import { useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, FileUp, Italic, PencilLine, Plus, Table2, TableCellsMerge, TableCellsSplit, Trash2, X } from 'lucide-react';
import { MERGE_MARK, TABLE_LIMITS, alignLines, cellForEditing, parseDelimited, passageTables, tableRows, withTable, wrapSelection } from '../../lib/passage.js';
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
const toolButton = 'h-7 gap-1 px-2 text-xs';
const COLUMN_WIDTH = 160;
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 480;
const removeButton = 'mx-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30';

function TableDialog({ editing, onClose, onSave, onRemove }) {
  const [rows, setRows] = useState(() => forEditing(editing.rows));
  const [focus, setFocus] = useState(null);
  const fileRef = useRef(null);
  const cellRefs = useRef({});
  const columns = rows[0]?.length || 0;
  const [widths, setWidths] = useState([]);
  const widthOf = (column) => widths[column] ?? COLUMN_WIDTH;

  function startResize(event, column) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthOf(column);
    const move = (moved) => {
      const next = Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, startWidth + moved.clientX - startX));
      setWidths((current) => {
        const copy = [...current];
        copy[column] = next;
        return copy;
      });
    };
    const stop = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
  }

  function addColumn() {
    setRows((current) => current.map((cells) => [...cells, '']));
  }

  function removeColumn(column) {
    setRows((current) => current.map((cells) => cells.filter((_, at) => at !== column)));
    setWidths((current) => current.filter((_, at) => at !== column));
  }

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
    const start = element?.selectionStart ?? 0;
    const end = element?.selectionEnd ?? value.length;
    const wrapped = start === end ? wrapSelection(value, 0, value.length, mark) : wrapSelection(value, start, end, mark);
    if (!wrapped) return;
    setCell(row, column, wrapped.value);
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(wrapped.start, wrapped.end);
    });
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
          <DialogDescription>Paste cells from Excel or Google Sheets, or upload a CSV file.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
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
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => fileRef.current?.click()}>
            <FileUp className="h-3.5 w-3.5" />
            Upload CSV
          </Button>
          <div className="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="Rows and columns">
            <Button type="button" variant="ghost" size="sm" className={toolButton} disabled={rows.length >= TABLE_LIMITS.rows} onClick={() => setRows((current) => [...current, Array(columns).fill('')])}>
              <Plus className="h-3.5 w-3.5" />
              Row
            </Button>
            <Button type="button" variant="ghost" size="sm" className={toolButton} disabled={columns >= TABLE_LIMITS.columns} onClick={addColumn}>
              <Plus className="h-3.5 w-3.5" />
              Column
            </Button>
          </div>
          <div className="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="Format the selected cell">
            <Button type="button" variant="ghost" size="sm" className={toolButton} disabled={!focused} onMouseDown={keepFocus} onClick={() => wrap('**')}>
              <Bold className="h-3.5 w-3.5" />
              Bold
            </Button>
            <Button type="button" variant="ghost" size="sm" className={toolButton} disabled={!focused} onMouseDown={keepFocus} onClick={() => wrap('*')}>
              <Italic className="h-3.5 w-3.5" />
              Italic
            </Button>
          </div>
          <div className="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="Merge cells">
            <Button type="button" variant="ghost" size="sm" className={toolButton} disabled={nextFree === null} onMouseDown={keepFocus} onClick={mergeRight}>
              <TableCellsMerge className="h-3.5 w-3.5" />
              Merge →
            </Button>
            <Button type="button" variant="ghost" size="sm" className={toolButton} disabled={!canUnmerge} onMouseDown={keepFocus} onClick={unmerge}>
              <TableCellsSplit className="h-3.5 w-3.5" />
              Unmerge
            </Button>
          </div>
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {rows.length} × {columns}
          </span>
        </div>

        <div className="max-h-[55dvh] overflow-auto rounded-lg border">
          <table className="table-fixed border-collapse text-sm" style={{ width: 32 + Array.from({ length: columns }, (_, column) => widthOf(column)).reduce((sum, value) => sum + value, 0) }}>
            <colgroup>
              <col style={{ width: 32 }} />
              {Array.from({ length: columns }, (_, column) => (
                <col key={column} style={{ width: widthOf(column) }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="bg-muted/40" />
                {Array.from({ length: columns }, (_, column) => (
                  <th key={column} className="relative bg-muted/40 px-1 py-1">
                    <button
                      type="button"
                      className={removeButton}
                      aria-label={`Remove column ${column + 1}`}
                      disabled={columns <= 1}
                      onClick={() => removeColumn(column)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize column ${column + 1}`}
                      title="Drag to resize"
                      className="absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none rounded transition-colors hover:bg-primary/40"
                      onPointerDown={(event) => startResize(event, column)}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, row) => (
                <tr key={row} className="border-t">
                  <td className="px-1 pt-2 text-center align-top">
                    <button type="button" className={removeButton} aria-label={`Remove row ${row + 1}`} disabled={rows.length <= 1} onClick={() => setRows((current) => current.filter((_, at) => at !== row))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  {cells.map((cell, column) => (
                    <td key={column} className="p-1 align-top">
                      {isMerged(cell) ? (
                        <button
                          type="button"
                          className="flex h-8 w-full items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground transition-colors hover:bg-muted/50"
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
                            'min-h-8 w-full resize-none px-3 py-1.5 text-sm leading-5',
                            row === 0 && 'bg-muted/50',
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

export function TableTool({ value, onChange, maxLength, disabled = false, className, targetId }) {
  const [editing, setEditing] = useState(null);
  const tables = passageTables(value);

  function apply(rows) {
    const next = withTable(value, editing.index, rows);
    if (maxLength && next.length > maxLength) return notify({ title: 'The text is too long with this table', description: `Keep it under ${maxLength} characters.`, variant: 'destructive' });
    onChange(next);
    setEditing(null);
  }

  function align(side) {
    const element = targetId ? document.getElementById(targetId) : null;
    if (!element) return;
    const aligned = alignLines(value, element.selectionStart, element.selectionEnd, side);
    if (maxLength && aligned.value.length > maxLength) return notify({ title: 'The text is too long', description: `Keep it under ${maxLength} characters.`, variant: 'destructive' });
    onChange(aligned.value);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(aligned.start, aligned.end);
    });
  }

  function format(mark) {
    const element = targetId ? document.getElementById(targetId) : null;
    if (!element) return;
    const wrapped = wrapSelection(value, element.selectionStart, element.selectionEnd, mark);
    if (!wrapped) return notify({ title: 'Select the words first' });
    if (maxLength && wrapped.value.length > maxLength) return notify({ title: 'The text is too long', description: `Keep it under ${maxLength} characters.`, variant: 'destructive' });
    onChange(wrapped.value);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(wrapped.start, wrapped.end);
    });
  }

  const keepFocus = (event) => event.preventDefault();

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {targetId ? (
        <div className="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="Format the selected words">
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" title="Select words, then make them bold" disabled={disabled} onMouseDown={keepFocus} onClick={() => format('**')}>
            <Bold className="h-3.5 w-3.5" />
            Bold
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" title="Select words, then make them italic" disabled={disabled} onMouseDown={keepFocus} onClick={() => format('*')}>
            <Italic className="h-3.5 w-3.5" />
            Italic
          </Button>
        </div>
      ) : null}
      {targetId ? (
        <div className="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="Align the selected lines">
          {[
            ['left', AlignLeft, 'Left'],
            ['center', AlignCenter, 'Center'],
            ['right', AlignRight, 'Right'],
          ].map(([side, Icon, label]) => (
            <Button key={side} type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" title={`Align the selected lines ${side}`} disabled={disabled} onMouseDown={keepFocus} onClick={() => align(side)}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>
      ) : null}
      <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" disabled={disabled} onClick={() => setEditing({ index: null, rows: blankRows(3, 3) })}>
        <Table2 className="h-3.5 w-3.5" />
        Add table
      </Button>
      {tables.map((table, index) => (
        <Button key={`${index}-${table.start}`} type="button" variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" disabled={disabled} onClick={() => setEditing({ index, rows: table.rows })}>
          <PencilLine className="h-3.5 w-3.5" />
          Edit table {index + 1}
        </Button>
      ))}
      {editing ? <TableDialog editing={editing} onClose={() => setEditing(null)} onSave={apply} onRemove={() => apply(null)} /> : null}
    </div>
  );
}
