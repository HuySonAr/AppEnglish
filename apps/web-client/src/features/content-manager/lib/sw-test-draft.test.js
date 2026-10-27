import test from 'node:test';
import assert from 'node:assert/strict';
import { blockProgress, normalizeSwContent, swBlocks, swIssueBlock, swIssueLabel, workingSwTest } from './sw-test-draft.js';

test('an empty test is laid out like the real one', () => {
  const content = normalizeSwContent({});
  assert.equal(content.speaking.readAloud.length, 2);
  assert.equal(content.speaking.pictures.length, 2);
  assert.equal(content.speaking.respondQuestions.questions.length, 3);
  assert.equal(content.speaking.respondInfo.questions.length, 3);
  assert.deepEqual(content.speaking.opinion, { text: '', audioMediaId: null });
  assert.equal(content.writing.pictureSentences.length, 5);
  assert.deepEqual(content.writing.pictureSentences[0], { imageMediaId: null, keywords: ['', ''] });
  assert.equal(content.writing.emails.length, 2);
  assert.deepEqual(content.writing.essay, { question: '' });
});

test('saved values are kept and missing ones filled in', () => {
  const content = normalizeSwContent({
    speaking: { readAloud: [{ text: 'Hello.' }], respondInfo: { info: '| a | b |', questions: [{ text: 'When?', audioMediaId: 'x' }] } },
    writing: { pictureSentences: [{ imageMediaId: 'i', keywords: ['dog'] }] },
  });
  assert.deepEqual(content.speaking.readAloud, [{ text: 'Hello.' }, { text: '' }]);
  assert.equal(content.speaking.respondInfo.info, '| a | b |');
  assert.deepEqual(content.speaking.respondInfo.questions[0], { text: 'When?', audioMediaId: 'x' });
  assert.deepEqual(content.writing.pictureSentences[0], { imageMediaId: 'i', keywords: ['dog', ''] });
  assert.deepEqual(workingSwTest({ draft: null, published: { content: { writing: { essay: { question: 'Why?' } } } } }).writing.essay, { question: 'Why?' });
});

test('issue paths are named with the question numbers of the real test', () => {
  assert.equal(swIssueLabel('speaking.respondInfo.questions[1].audioMediaId'), 'Speaking 9 audio');
  assert.equal(swIssueLabel('speaking.readAloud[0].text'), 'Speaking 1 text');
  assert.equal(swIssueLabel('speaking.readAloud'), 'Speaking 1–2');
  assert.equal(swIssueLabel('speaking.respondQuestions.context'), 'Speaking 5–7 context');
  assert.equal(swIssueLabel('speaking.opinion.text'), 'Speaking 11 text');
  assert.equal(swIssueLabel('writing.pictureSentences[2].keywords'), 'Writing 3 words');
  assert.equal(swIssueLabel('writing.emails[1].instructions'), 'Writing 7 instructions');
  assert.equal(swIssueLabel('writing.essay.question'), 'Writing 8 question');
  assert.equal(swIssueBlock('writing.emails[1].email'), 'writing.emails');
  assert.equal(swIssueBlock('other'), null);
});

test('progress counts what each block still needs', () => {
  const content = normalizeSwContent({
    speaking: { respondQuestions: { context: 'A trip.', questions: [{ text: 'Where?', audioMediaId: 'a' }, { text: 'When?', audioMediaId: null }] } },
    writing: { pictureSentences: [{ imageMediaId: 'i', keywords: ['dog', 'park'] }, { imageMediaId: 'j', keywords: ['cat', ''] }] },
  });
  const block = (key) => swBlocks.find((item) => item.key === key);
  assert.deepEqual(blockProgress(content, block('respondQuestions')), { filled: 2, total: 4 });
  assert.deepEqual(blockProgress(content, block('pictureSentences')), { filled: 1, total: 5 });
  assert.deepEqual(blockProgress(content, block('essay')), { filled: 0, total: 1 });
});
