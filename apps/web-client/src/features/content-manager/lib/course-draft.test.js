import test from 'node:test';
import assert from 'node:assert/strict';
import {
  courseIssueLabel,
  focusWordsFromText,
  newFocus,
  newLesson,
  newQuestion,
  newSection,
  placementLevelCounts,
  sectionQuestionCount,
  toggleClose,
  withBlankAnswers,
  withCorrect,
  withKind,
  withOption,
  workingCourse,
} from './course-draft.js';

test('a detail question completed with words heard keeps one answer per blank; so does Focus on (D109)', () => {
  const sentence = withKind({ ...newQuestion(), prompt: 'Where are you ___ ___?' }, 'complete');
  assert.deepEqual([sentence.kind, sentence.answers], ['complete', ['', '']]);
  const filled = withBlankAnswers({ ...sentence, prompt: 'Where are you ___?', answers: ['from', 'now'] });
  assert.deepEqual(filled.answers, ['from']);
  // Back to a choice: the options stay, the answers go.
  assert.deepEqual([withKind(filled, 'choice').answers, withKind(filled, 'choice').options.length], [[], 3]);
  const focus = withBlankAnswers({ ...newFocus(), passage: "A: How's it ___?\nB: Not too ___, thanks." });
  assert.deepEqual(focus.answers, ['', '']);
  assert.deepEqual(focusWordsFromText(' going, well,, bad\nwell '), ['going', 'well', 'bad']);
  assert.equal(courseIssueLabel('lessons[0].focus.answers'), 'Lesson 1 · Focus on · answers');
  assert.equal(courseIssueLabel('lessons[1].detail[0].kind'), 'Lesson 2 · detail question 1 · kind');
});

test('a new lesson has a gist question and two detail questions of three options', () => {
  const lesson = newLesson();
  assert.equal(lesson.gist.skill, 'gist');
  assert.deepEqual([lesson.detail.length, lesson.detail[0].options.length, lesson.closeSegmentIds], [2, 3, []]);
  const question = withCorrect(newQuestion(), lesson.gist.options[0].id);
  assert.deepEqual(
    question.options.map((option) => option.isCorrect),
    [false, false, false],
  );
  const chosen = withCorrect(question, question.options[1].id);
  assert.deepEqual(
    chosen.options.map((option) => option.isCorrect),
    [false, true, false],
  );
  // At most four options.
  assert.equal(withOption(withOption(withOption(chosen))).options.length, 4);
});

test('sentences to write down are chosen up to six', () => {
  let lesson = newLesson();
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) lesson = toggleClose(lesson, id);
  assert.deepEqual(lesson.closeSegmentIds, ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(toggleClose(lesson, 'b').closeSegmentIds, ['a', 'c', 'd', 'e', 'f']);
});

test('the editor starts from the draft and names publish issues', () => {
  assert.deepEqual(workingCourse({ item: { type: 'unit' }, draft: null, published: null }), { lessons: [], check: { sections: [] } });
  assert.deepEqual(workingCourse({ item: { type: 'level_test' }, draft: { content: { sections: [{ id: 's' }] } } }), { sections: [{ id: 's' }] });
  assert.equal(sectionQuestionCount([{ questions: [1, 2] }, { questions: [3] }]), 3);
  assert.equal(courseIssueLabel('lessons[1].detail[0].options'), 'Lesson 2 · detail question 1 · options');
  assert.equal(courseIssueLabel('lessons[0].gist.prompt'), 'Lesson 1 · gist question · question');
  assert.equal(courseIssueLabel('check.sections[1].questions[2].options'), 'Unit check · Recording 2 · question 3 · options');
  assert.equal(courseIssueLabel('lessons[2].closeSegmentIds'), 'Lesson 3 · sentences to write down');
  assert.equal(courseIssueLabel('check.sections'), 'Unit check');
  assert.equal(courseIssueLabel('sections'), 'Level test');
});

test('the placement: recordings with their level, questions counted by level', () => {
  assert.deepEqual(workingCourse({ item: { type: 'placement' }, draft: null, published: { content: { sections: [{ id: 's', level: 'B1' }] } } }), {
    sections: [{ id: 's', level: 'B1' }],
  });
  assert.equal(newSection(null).level, null);
  assert.equal('level' in newSection(), false);
  const counts = placementLevelCounts([
    { level: 'A1', questions: [1, 2] },
    { level: 'A1', questions: [3] },
    { level: null, questions: [4] },
    { level: 'C1', questions: [5] },
  ]);
  assert.deepEqual(
    counts.map((entry) => entry.count),
    [3, 0, 0, 0, 1],
  );
  assert.equal(courseIssueLabel('sections', 'placement'), 'Placement');
  assert.equal(courseIssueLabel('sections'), 'Level test');
  assert.equal(courseIssueLabel('sections[1].level', 'placement'), 'Recording 2 · level');
});
