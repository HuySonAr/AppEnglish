import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarFileIssue, normalizeDisplayName, squareCrop } from './avatar.js';

test('the crop is the largest centred square', () => {
  assert.deepEqual(squareCrop(400, 300), { x: 50, y: 0, size: 300 });
  assert.deepEqual(squareCrop(300, 400), { x: 0, y: 50, size: 300 });
  assert.deepEqual(squareCrop(256, 256), { x: 0, y: 0, size: 256 });
  assert.deepEqual(squareCrop(301, 200), { x: 50, y: 0, size: 200 });
});

test('only pictures of the allowed types are accepted', () => {
  assert.equal(avatarFileIssue(null), 'Choose a picture.');
  assert.equal(avatarFileIssue({ type: 'image/gif', size: 10 }), 'Use a JPEG, PNG or WebP picture.');
  assert.equal(avatarFileIssue({ type: 'image/PNG', size: 10 }), null);
  assert.match(avatarFileIssue({ type: 'image/jpeg', size: 30 * 1024 * 1024 }), /too large/);
});

test('display names are trimmed, single-spaced and capped', () => {
  assert.equal(normalizeDisplayName('  Minh   Anh  '), 'Minh Anh');
  assert.equal(normalizeDisplayName(null), '');
  assert.equal(normalizeDisplayName('a'.repeat(60)).length, 50);
});
