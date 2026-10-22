import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankCount,
  courseIssueLabel,
  gapProblem,
  keepSentenceExtras,
  newIdea,
  newQuestion,
  newSection,
  newTopicSegment,
  newWord,
  sectionQuestionCount,
  withCorrect,
  withOption,
  workingCourse,
} from './course-draft.js';

test('the editor starts from the draft, else the published version; a topic gets every part (D143, D147)', () => {
  const topic = workingCourse({ item: { type: 'topic' }, draft: null, published: { content: { audioMediaId: 'a', segments: [{ id: 's1', text: 'Hi.', start: 0, end: 1 }], vocabulary: [newWord()] } } });
  assert.equal(topic.audioMediaId, 'a');
  assert.deepEqual(topic.segments, [{ id: 's1', speaker: '', text: 'Hi.', start: 0, end: 1, translation: '', gap: '' }]);
  assert.equal(topic.vocabulary.length, 1);
  assert.deepEqual([topic.questions, topic.ordering], [[], { enabled: false, prompt: '', items: [] }]);
  const levelTest = workingCourse({ item: { type: 'level_test' }, draft: { content: { sections: [{ id: 'x', questions: [] }] } } });
  assert.deepEqual(levelTest.sections, [{ id: 'x', audioMediaId: null, transcript: '', questions: [] }]);
  assert.deepEqual(workingCourse({ item: { type: 'level_test' } }), { sections: [] });
  assert.deepEqual(Object.keys(newSection()).sort(), ['audioMediaId', 'id', 'questions', 'transcript']);
  assert.deepEqual(Object.keys(newWord()).sort(), ['audioMediaId', 'id', 'meaning', 'phonetic', 'word']);
  assert.equal(newIdea().text, '');
});

test('questions: one right option, at most four options', () => {
  const question = newQuestion();
  const right = withCorrect(question, question.options[1].id);
  assert.deepEqual(right.options.map((option) => option.isCorrect), [false, true, false]);
  const four = withOption(question);
  assert.equal(four.options.length, 4);
  assert.equal(withOption(four).options.length, 4);
  assert.equal(sectionQuestionCount([{ questions: [1, 2] }, { questions: [3] }]), 3);
});

test('replaced sentences keep their translation and blanks by id, or by place when the words are the same', () => {
  const previous = [
    newTopicSegment({ id: 's1', text: 'Hello there.', translation: 'Xin chào.', gap: 'Hello [there].' }),
    newTopicSegment({ id: 's2', text: 'Nice to meet you.', translation: 'Rất vui.', gap: '' }),
  ];
  // Pasted again: new ids, the first sentence unchanged, the second corrected.
  const pasted = [
    { id: 'p1', speaker: '', text: 'Hello  there.', start: null, end: null },
    { id: 'p2', speaker: '', text: 'Nice to see you.', start: null, end: null },
  ];
  const kept = keepSentenceExtras(previous, pasted);
  assert.deepEqual(kept.map((segment) => [segment.id, segment.translation, segment.gap]), [['p1', 'Xin chào.', 'Hello [there].'], ['p2', '', '']]);
  // Times found by Auto-time keep everything (same objects, same ids).
  const timed = keepSentenceExtras(previous, previous.map((segment) => ({ ...segment, start: 1 })));
  assert.equal(timed[0].translation, 'Xin chào.');
  assert.equal(blankCount([{ gap: 'a [b] c [d]' }, { gap: '' }, { gap: '[x]' }]), 3);
});

test('blanks must mark words and keep the sentence', () => {
  assert.equal(gapProblem('', 'Hello there.'), '');
  assert.equal(gapProblem('Hello [there].', 'Hello there.'), '');
  assert.equal(gapProblem('Hello  [there] .', 'Hello there .'), '');
  assert.match(gapProblem('Hello there.', 'Hello there.'), /brackets/);
  assert.match(gapProblem('Hello [here].', 'Hello there.'), /Keep the words/);
});

test('publish issues read as places in the editor', () => {
  assert.equal(courseIssueLabel('vocabulary[1].phonetic'), 'Word 2 · IPA');
  assert.equal(courseIssueLabel('vocabulary[0].audioMediaId'), 'Word 1 · pronunciation');
  assert.equal(courseIssueLabel('questions[2].options'), 'Question 3 · options');
  assert.equal(courseIssueLabel('segments[0].translation'), 'Sentence 1 · translation');
  assert.equal(courseIssueLabel('segments[3].gap'), 'Sentence 4 · blanks');
  assert.equal(courseIssueLabel('segments[1].start'), 'Sentence 2 · times');
  assert.equal(courseIssueLabel('sections[0].audioMediaId'), 'Recording 1 · audio file');
  assert.equal(courseIssueLabel('sections[0].transcript'), 'Recording 1 · transcript');
  assert.equal(courseIssueLabel('ordering.items'), 'Ordering · ideas');
  assert.equal(courseIssueLabel('sections[1].questions[0].prompt'), 'Recording 2 · question 1 · question');
  assert.equal(courseIssueLabel('audioMediaId'), 'Recording');
  assert.equal(courseIssueLabel('segments'), 'Sentences');
  assert.equal(courseIssueLabel('sections'), 'Level test');
});
