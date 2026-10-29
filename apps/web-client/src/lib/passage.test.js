import test from 'node:test';
import assert from 'node:assert/strict';
import { alignLines, cellForEditing, hasTable, inlineParts, lineAlign, parseDelimited, passageBlocks, passageTables, tableLayout, tableRowFromTabs, tableText, needsPreview, withTable, wrapSelection } from './passage.js';

test('a passage is split into its text and its tables', () => {
  const passage = 'Conference Room Schedule\n\n| Room | Time | Event |\n| A101 | 9:00 A.M. | Sales meeting |\n|B204|1:30 P.M.||\n\nPlease contact Ms. Lee.\nThank you.';
  assert.deepEqual(passageBlocks(passage), [
    { text: 'Conference Room Schedule' },
    { rows: [['Room', 'Time', 'Event'], ['A101', '9:00 A.M.', 'Sales meeting'], ['B204', '1:30 P.M.', '']] },
    { text: 'Please contact Ms. Lee.\nThank you.' },
  ]);
  assert.equal(hasTable(passage), true);
});

test('text without table rows stays one block', () => {
  assert.deepEqual(passageBlocks('Dear Mr. Dombo,\n\nA | B is not a row.\n'), [{ text: 'Dear Mr. Dombo,\n\nA | B is not a row.' }]);
  assert.deepEqual(passageBlocks(''), []);
  assert.equal(hasTable(null), false);
});

test('lines copied from a table become table rows', () => {
  assert.equal(tableRowFromTabs('Room\tTime\tEvent'), '| Room | Time | Event |');
  assert.equal(tableRowFromTabs('\tMon\tTue  '), '|  | Mon | Tue |');
  assert.equal(tableRowFromTabs('\tDear Mr. Hughes, '), 'Dear Mr. Hughes,');
  assert.equal(tableRowFromTabs('Subject:\tCard expiration'), 'Subject: Card expiration');
  assert.equal(tableRowFromTabs('| Room | Time |'), '| Room | Time |');
});

test('rows copied from a spreadsheet or saved as CSV become table rows', () => {
  assert.deepEqual(parseDelimited('Time\tEvent\tRoom\r\n9:00\tOpening\tA\n\n'), [['Time', 'Event', 'Room'], ['9:00', 'Opening', 'A']]);
  assert.deepEqual(parseDelimited('﻿Name,Price\n"Lunch, buffet","$12 ""special"""\nTea,'), [['Name', 'Price'], ['Lunch, buffet', '$12 "special"'], ['Tea', '']]);
  assert.deepEqual(parseDelimited('A;B;C\n1;2;3'), [['A', 'B', 'C'], ['1', '2', '3']]);
  assert.equal(tableText([['Room', 'Note', ''], ['A | B', 'two\nlines ', ''], ['', '', '']]), '| Room | Note |\n| A / B | two<br>lines |');
  assert.deepEqual(parseDelimited('Name,Address\nAnna,"12 Main St\nBoston"'), [['Name', 'Address'], ['Anna', '12 Main St<br>Boston']]);
  assert.equal(cellForEditing('12 Main St<br>Boston'), '12 Main St\nBoston');
});

test('a table in a passage is added, replaced or removed in place', () => {
  const passage = 'Schedule\n\n| Time | Event |\n| 9:00 | Opening |\n\nCall Ms. Lee.';
  assert.deepEqual(passageTables(passage), [{ start: 2, end: 3, rows: [['Time', 'Event'], ['9:00', 'Opening']] }]);
  assert.equal(withTable(passage, 0, [['Time', 'Event'], ['9:30', 'Welcome']]), 'Schedule\n\n| Time | Event |\n| 9:30 | Welcome |\n\nCall Ms. Lee.');
  assert.equal(withTable(passage, 0, null), 'Schedule\n\nCall Ms. Lee.');
  assert.equal(withTable('Notice', null, [['A', 'B']]), 'Notice\n\n| A | B |');
  assert.equal(withTable('', null, [['A', 'B']]), '| A | B |');
});

test('a cell marked < joins the cell on its left and a row of one wide cell spans the table', () => {
  assert.deepEqual(tableLayout([['Day', 'Time', 'Room'], ['Monday', '<', '<'], ['Tue', '9:00', 'A']]), [
    { cells: [{ text: 'Day', span: 1 }, { text: 'Time', span: 1 }, { text: 'Room', span: 1 }], full: false },
    { cells: [{ text: 'Monday', span: 3 }], full: true },
    { cells: [{ text: 'Tue', span: 1 }, { text: '9:00', span: 1 }, { text: 'A', span: 1 }], full: false },
  ]);
  assert.deepEqual(tableLayout([['Morning', '<', 'Afternoon'], ['B204', '1:30']])[1].cells.map((cell) => cell.text), ['B204', '1:30', '']);
});

test('cells keep bold, italic and line breaks', () => {
  assert.deepEqual(inlineParts('**Fee:** $20<br>*members free*'), [{ text: 'Fee:', bold: true }, { text: ' $20' }, { br: true }, { text: 'members free', italic: true }]);
  assert.deepEqual(inlineParts('2 * 3 * 4'), [{ text: '2 * 3 * 4' }]);
});

test('bold and italic wrap the selected words and a second click removes them', () => {
  assert.deepEqual(wrapSelection('Lunch is free.', 9, 13, '**'), { value: 'Lunch is **free**.', start: 9, end: 17 });
  assert.deepEqual(wrapSelection('Lunch is **free**.', 9, 17, '**'), { value: 'Lunch is free.', start: 9, end: 13 });
  assert.deepEqual(wrapSelection('Lunch is **free**.', 11, 15, '**'), { value: 'Lunch is free.', start: 9, end: 13 });
  assert.deepEqual(wrapSelection('Note: closed ', 6, 13, '*'), { value: 'Note: *closed* ', start: 6, end: 14 });
  assert.equal(wrapSelection('Lunch', 2, 2, '**'), null);
  assert.equal(wrapSelection('a   b', 1, 4, '*'), null);
});

test('text outside tables keeps bold and italic', () => {
  assert.deepEqual(inlineParts('**Westbrook Conference**\n*May 5*'), [{ text: 'Westbrook Conference', bold: true }, { text: '\n' }, { text: 'May 5', italic: true }]);
});

test('a preview is shown for tables and for bold or italic words', () => {
  assert.equal(needsPreview('Plain text.'), false);
  assert.equal(needsPreview('**Bold** title'), true);
  assert.equal(needsPreview('| A | B |'), true);
});

test('lines are centred, right aligned or set back to the left, table rows stay as they are', () => {
  const NL = String.fromCharCode(10);
  const text = ['Westbrook Conference', 'May 5', '| A | B |', 'Call us'].join(NL);
  const centred = alignLines(text, 3, 3, 'center');
  assert.equal(centred.value, ['<center>Westbrook Conference</center>', 'May 5', '| A | B |', 'Call us'].join(NL));
  const both = alignLines(centred.value, 2, centred.value.indexOf('| A'), 'right');
  assert.equal(both.value, ['<right>Westbrook Conference</right>', '<right>May 5</right>', '| A | B |', 'Call us'].join(NL));
  assert.equal(alignLines(both.value, 0, both.value.length, 'left').value, text);
  assert.deepEqual(lineAlign('<center>**Title**</center>'), { align: 'center', text: '**Title**' });
  assert.deepEqual(lineAlign('Plain'), { align: 'left', text: 'Plain' });
  assert.equal(needsPreview('<right>Total</right>'), true);
});
