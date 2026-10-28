import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEtsTask,
  authorOptions,
  changedFields,
  countWords,
  durationText,
  etsFields,
  etsTaskLabels,
  etsTaskOf,
  etsTaskOptions,
  etsTasksOf,
  etsTimingParts,
  fieldLabel,
  filterPrompts,
  isSetTask,
  kindFromSlug,
  matchesEtsTask,
  reviewAreaOf,
  reviewPromptPath,
  statusCounts,
  SPEAKING_PARTS,
  speakingPartOf,
  teacherListPath,
  teacherPromptPath,
} from './practice-prompts.js';

test('words are counted and changed fields are named for the reviewer', () => {
  assert.deepEqual([countWords(''), countWords('  one  two\nthree ')], [0, 3]);
  const before = { title: 'A', level: 'A2', topic: 'Work', keyPoints: ['a'] };
  assert.deepEqual(changedFields(before, { ...before, title: 'B', keyPoints: ['a', 'b'] }), ['Title', 'Key points']);
  assert.deepEqual(changedFields(null, before), []);
});

test('prompts are searched, filtered and counted by status', () => {
  const prompts = [
    { kind: 'writing', level: 'A2', status: 'PENDING_REVIEW', title: 'Email to a manager', topic: 'Work', publishedVersionNumber: null },
    { kind: 'read_aloud', level: 'B1', status: 'PUBLISHED', title: 'At the station', topic: 'Travel', publishedVersionNumber: 1 },
    { kind: 'writing', level: 'B1', status: 'DRAFT', title: 'My town', topic: 'Places', publishedVersionNumber: 2 },
  ];
  assert.equal(filterPrompts(prompts, { kind: 'writing' }).length, 2);
  assert.equal(filterPrompts(prompts, { level: 'intermediate', status: 'PUBLISHED' })[0].title, 'At the station');
  assert.equal(filterPrompts(prompts, { search: 'travel' })[0].title, 'At the station');
  assert.deepEqual(statusCounts(prompts), { DRAFT: 1, PENDING_REVIEW: 1, RETURNED: 0, PUBLISHED: 1 });
});

test('each prompt kind has its own teacher page', () => {
  assert.equal(teacherListPath('open_speaking'), '/teacher/speaking');
  assert.equal(teacherListPath('writing'), '/teacher/writing');
  assert.equal(teacherPromptPath('read_aloud', 'p1'), '/teacher/read-aloud/p1');
  assert.deepEqual(['writing', 'read-aloud', 'nope'].map(kindFromSlug), ['writing', 'read_aloud', null]);
});

test('the content manager reviews speaking and writing apart and can pick a teacher', () => {
  assert.deepEqual(['read_aloud', 'open_speaking', 'writing'].map(reviewAreaOf), ['speaking', 'speaking', 'writing']);
  assert.equal(reviewPromptPath('open_speaking', 'p1'), '/content-manager/speaking-prompts/p1');
  assert.equal(reviewPromptPath('writing', 'p2'), '/content-manager/writing-prompts/p2');
  const options = authorOptions([
    { authorId: 't2', author: { displayName: 'Mai' } },
    { authorId: 't1', author: { displayName: 'An' } },
    { authorId: 't2', author: { displayName: 'Mai' } },
    { authorId: 't3' },
  ]);
  assert.deepEqual(options.map((option) => option.label), ['All teachers', 'An', 'Mai', 'Unknown teacher']);
});

test('ETS task types have labels, timing and the fields they use', () => {
  assert.equal(etsTaskOf('read_aloud', {}), 'read_aloud');
  assert.equal(etsTaskOf('open_speaking', { etsTask: null }), null);
  assert.equal(etsTaskLabels.respond_info, 'Respond using information');
  assert.deepEqual(etsTasksOf.writing, ['picture_sentence', 'respond_email', 'opinion_essay']);
  assert.deepEqual(etsTimingParts('respond_info'), [
    { label: 'Read', value: '45 s' },
    { label: 'Prepare', value: '3 s' },
    { label: 'Speak', value: '15 / 15 / 30 s' },
    { label: 'Played twice', value: 'Q3' },
  ]);
  assert.deepEqual(etsTimingParts('opinion_essay'), [
    { label: 'Write', value: '30 min' },
    { label: 'Aim for', value: '300+ words' },
  ]);
  assert.equal(durationText(96), '1 min 36 s');
  assert.deepEqual(etsTimingParts(null), []);
  const set = etsFields('open_speaking', 'respond_questions');
  assert.equal(set.questions && set.context && !set.info && !set.sampleAnswer && !set.keyPoints && !set.image, true);
  const picture = etsFields('writing', 'picture_sentence');
  assert.equal(picture.imageRequired && picture.keywords && picture.sampleAnswer && !picture.email, true);
  assert.equal(etsFields('writing', 'respond_email').image, false);
});

test('choosing a task type fills in what the type needs', () => {
  const speaking = applyEtsTask('open_speaking', { maxSeconds: 20, questions: [{ text: 'Q1', sampleAnswer: 'A1', audioMediaId: null }] }, 'respond_info');
  assert.equal(speaking.etsTask, 'respond_info');
  assert.equal(speaking.questions.length, 3);
  assert.equal(speaking.questions[0].text, 'Q1');
  assert.equal(speaking.maxSeconds, 30);
  assert.equal(applyEtsTask('open_speaking', { maxSeconds: 90 }, 'describe_picture').maxSeconds, 90);
  const sentence = applyEtsTask('writing', { minWords: 80, maxWords: 150, keywords: [] }, 'picture_sentence');
  assert.deepEqual([sentence.minWords, sentence.maxWords, sentence.keywords, sentence.taskType], [1, 40, ['', ''], 'sentence']);
  const essay = applyEtsTask('writing', { minWords: 80, maxWords: 150 }, 'opinion_essay');
  assert.deepEqual([essay.minWords, essay.maxWords, essay.taskType], [300, 400, 'essay']);
  assert.equal(applyEtsTask('writing', { minWords: 80, maxWords: 150 }, 'respond_email').taskType, 'email');
});

test('task types can be filtered and issue paths are named', () => {
  const prompts = [{ etsTask: 'express_opinion' }, { etsTask: null }, { etsTask: 'describe_picture' }];
  assert.deepEqual(etsTaskOptions(prompts).map((option) => option.value), ['all', 'describe_picture', 'express_opinion', 'none']);
  assert.equal(prompts.filter((prompt) => matchesEtsTask(prompt, 'none')).length, 1);
  assert.equal(filterPrompts(prompts.map((prompt) => ({ ...prompt, title: 't', topic: '' })), { etsTask: 'express_opinion' }).length, 1);
  assert.equal(isSetTask('respond_questions'), true);
  assert.equal(fieldLabel('questions[1].sampleAnswer'), 'Question 2 sample answer');
  assert.equal(fieldLabel('questions'), 'Questions');
  assert.equal(fieldLabel('keywords'), 'Words to use');
  assert.deepEqual(changedFields({ title: 'A', email: 'x' }, { title: 'A', email: 'y' }), ['Email']);
});

test('speaking prompts sort into Part 1 to Part 5 by their task type', () => {
  assert.deepEqual(SPEAKING_PARTS.map((part) => [part.number, part.etsTask]), [
    [1, 'read_aloud'],
    [2, 'describe_picture'],
    [3, 'respond_questions'],
    [4, 'respond_info'],
    [5, 'express_opinion'],
  ]);
  assert.equal(speakingPartOf({ kind: 'read_aloud' }).number, 1);
  assert.equal(speakingPartOf({ kind: 'open_speaking', etsTask: 'respond_info' }).number, 4);
  assert.equal(speakingPartOf({ kind: 'open_speaking', etsTask: null }), null);
  assert.equal(speakingPartOf({ kind: 'writing', etsTask: 'respond_email' }), null);
  assert.equal(teacherPromptPath('open_speaking', 'p1'), '/teacher/open-speaking/p1');
});
