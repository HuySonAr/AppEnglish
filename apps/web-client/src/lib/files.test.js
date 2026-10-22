import test from 'node:test';
import assert from 'node:assert/strict';
import { fileIssue, fileKind, formatBytes } from './files.js';

test('sizes read as KB or MB', () => {
  assert.equal(formatBytes(512), '1 KB');
  assert.equal(formatBytes(20480), '20 KB');
  assert.equal(formatBytes(2.5 * 1024 * 1024), '2.5 MB');
  assert.equal(formatBytes(48 * 1024 * 1024), '48 MB');
  assert.equal(formatBytes(-1), '');
});

test('a drop zone refuses the wrong type or a file over the limit', () => {
  const rules = { accept: '.mp3,.m4a,audio/mpeg', maxBytes: 1024 };
  assert.equal(fileIssue({ name: 'talk.MP3', type: '', size: 10 }, rules), null);
  assert.equal(fileIssue({ name: 'blob', type: 'audio/mpeg', size: 10 }, rules), null);
  assert.match(fileIssue({ name: 'talk.wav', type: 'audio/wav', size: 10 }, rules), /not allowed/);
  assert.match(fileIssue({ name: 'talk.mp3', type: '', size: 2048 }, rules), /limit is 1 KB/);
  assert.equal(fileIssue({ name: 'a.png', type: 'image/png', size: 1 }, { accept: 'image/*' }), null);
  assert.equal(fileIssue(null), 'No file was chosen.');
  assert.equal(fileIssue({ name: 'x', size: 1 }, {}), null);
});

test('files get a kind for their icon', () => {
  assert.equal(fileKind('talk.mp3'), 'audio');
  assert.equal(fileKind('photo.PNG'), 'image');
  assert.equal(fileKind('lesson.json'), 'json');
  assert.equal(fileKind('clip.mp4', 'video/mp4'), 'video');
  assert.equal(fileKind('lines.srt'), 'text');
});
