import test from 'node:test';
import assert from 'node:assert/strict';
import { toast } from 'sonner';
import { notify } from './notify.js';

test('notify maps each variant to the matching Sonner call', (t) => {
  const calls = [];
  for (const kind of ['success', 'error', 'info', 'warning', 'loading'])
    t.mock.method(toast, kind, (title, options) => {
      calls.push([kind, title, options.description]);
      return `${kind}-id`;
    });
  const dismissed = [];
  t.mock.method(toast, 'dismiss', (id) => dismissed.push(id));

  notify({ title: 'Draft saved' });
  notify({ title: 'Could not save', description: 'Too large', variant: 'destructive' });
  notify({ title: 'Verify your email', variant: 'info' });
  notify({ title: 'Partly filled', variant: 'warning' });
  const loading = notify({ title: 'Updating…', variant: 'loading' });
  assert.deepEqual(calls, [
    ['success', 'Draft saved', undefined],
    ['error', 'Could not save', 'Too large'],
    ['info', 'Verify your email', undefined],
    ['warning', 'Partly filled', undefined],
    ['loading', 'Updating…', undefined],
  ]);
  loading.dismiss();
  assert.deepEqual(dismissed, ['loading-id']);
});
