import test from 'node:test';
import assert from 'node:assert/strict';
import { hasTable, passageBlocks, tableRowFromTabs } from './passage.js';

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
  // An empty first cell is kept; indentation and labels are not tables.
  assert.equal(tableRowFromTabs('\tMon\tTue  '), '|  | Mon | Tue |');
  assert.equal(tableRowFromTabs('\tDear Mr. Hughes, '), 'Dear Mr. Hughes,');
  assert.equal(tableRowFromTabs('Subject:\tCard expiration'), 'Subject: Card expiration');
  assert.equal(tableRowFromTabs('| Room | Time |'), '| Room | Time |');
});
