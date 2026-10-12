import { LESSON_TEST_PARTS, Skill } from '@appenglish/content-contracts';
import { LessonState, LessonStep, StepStatus, TestTrend } from '@appenglish/learning-contracts';

// Pure rules of the lesson flow and of the seven-part test. No I/O here.

// Fisher–Yates with a replaceable random source.
export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

// Where each lesson stands for one learner. curriculum is the published units
// (in order) with their published lessons; startUnit is the unit number the
// placement gave, or null while the placement is neither taken nor skipped
// (then every lesson is locked); completed is the set of completed lesson ids.
// Returns a Map: lesson id -> { state, unitNumber, lessonNumber, unit,
// lesson, previousLessonId, reviewRequired }.
export function lessonAccess(curriculum, startUnit, completed) {
  const access = new Map();
  let previous = null;
  curriculum.units.forEach((unit, unitIndex) => {
    const unitNumber = unitIndex + 1;
    unit.lessons.forEach((lesson, lessonIndex) => {
      const firstOfStartUnit = unitNumber === startUnit && lessonIndex === 0;
      const state = completed.has(lesson.id)
        ? LessonState.COMPLETED
        : startUnit === null
          ? LessonState.LOCKED
          : // Units before the starting unit are open freely (D35).
            unitNumber < startUnit || firstOfStartUnit || (previous && completed.has(previous))
            ? LessonState.OPEN
            : LessonState.LOCKED;
      access.set(lesson.id, {
        state,
        unitNumber,
        lessonNumber: lessonIndex + 1,
        unit,
        lesson,
        previousLessonId: previous,
        // The previous lesson's vocabulary is reviewed only when the learner
        // has studied that lesson; the first lesson of the starting unit is
        // exempt (D35).
        reviewRequired: Boolean(previous) && !firstOfStartUnit && completed.has(previous),
      });
      previous = lesson.id;
    });
  });
  return access;
}

// The lesson's steps in order with their status. progress is the learner's
// row for the lesson (or an empty object).
export function lessonSteps(entry, progress) {
  // A review that became required after the learner started is not imposed.
  const reviewPending =
    entry.reviewRequired && !progress.reviewPassedAt && !progress.vocabularyStudiedAt;
  const done = {
    [LessonStep.REVIEW]: !reviewPending,
    [LessonStep.VOCABULARY]: Boolean(progress.vocabularyStudiedAt),
    [LessonStep.VOCABULARY_QUIZ]: Boolean(progress.vocabularyQuizPassedAt),
    [LessonStep.FILL_IN]: Boolean(progress.fillInPassedAt),
    [LessonStep.TEST]: Boolean(progress.completedAt),
  };
  const keys = [
    ...(reviewPending || progress.reviewPassedAt ? [LessonStep.REVIEW] : []),
    LessonStep.VOCABULARY,
    LessonStep.VOCABULARY_QUIZ,
    LessonStep.FILL_IN,
    LessonStep.TEST,
  ];
  let reachedCurrent = false;
  return keys.map((key) => {
    if (done[key]) return { key, status: StepStatus.DONE };
    if (reachedCurrent) return { key, status: StepStatus.LOCKED };
    reachedCurrent = true;
    return { key, status: StepStatus.CURRENT };
  });
}

// One question per vocabulary item, in random order: choose the meaning of
// the word among up to four distinct meanings of the same lesson.
export function vocabularyQuiz(vocabulary, random = Math.random) {
  return shuffled(vocabulary, random).map((item) => {
    const others = [
      ...new Set(vocabulary.map((other) => other.meaning).filter((meaning) => meaning !== item.meaning)),
    ];
    return {
      id: item.id,
      word: item.word,
      partOfSpeech: item.partOfSpeech,
      options: shuffled([item.meaning, ...shuffled(others, random).slice(0, 3)], random),
    };
  });
}

// Ids of the vocabulary items whose chosen meaning is wrong or missing.
export function wrongQuizAnswers(vocabulary, answers) {
  return vocabulary.filter((item) => answers[item.id] !== item.meaning).map((item) => item.id);
}

// Indexes of the blanks filled with the wrong word (case-insensitive).
export function wrongBlanks(expected, answers) {
  const normal = (value) => (value || '').trim().toLowerCase();
  return expected
    .map((answer, index) => (normal(answers[index]) === normal(answer) ? null : index))
    .filter((index) => index !== null);
}

// The parts a call is about: all seven, or only the given keys (a mini test).
const partsOf = (partKeys) =>
  LESSON_TEST_PARTS.filter((spec) => !partKeys || partKeys.includes(spec.key));

// Counts the right answers of a seven-part test, in total and per skill.
// answers maps question id to the chosen option id.
export function scoreTest(test, answers, partKeys) {
  const score = { totalCount: 0, correctCount: 0, listeningCorrect: 0, readingCorrect: 0 };
  for (const spec of partsOf(partKeys)) {
    for (const question of test[spec.key]?.questions || []) {
      score.totalCount++;
      const chosen = question.options.find((option) => option.id === answers[question.id]);
      if (!chosen?.isCorrect) continue;
      score.correctCount++;
      if (spec.skill === Skill.LISTENING) score.listeningCorrect++;
      else score.readingCorrect++;
    }
  }
  return score;
}

// A random option order for every question whose options are written out
// (Parts 3-7). Parts 1 and 2 keep their order: the recording reads the
// options in it (D31, D48). Returns { questionId: [optionId, ...] }.
export function shuffledOptionOrder(test, random = Math.random, partKeys) {
  const order = {};
  for (const spec of partsOf(partKeys)) {
    if (!spec.option.text) continue;
    for (const question of test[spec.key].questions)
      order[question.id] = shuffled(question.options.map((option) => option.id), random);
  }
  return order;
}

function orderedOptions(question, optionOrder) {
  const order = optionOrder?.[question.id];
  if (!order) return question.options;
  const byId = new Map(question.options.map((option) => [option.id, option]));
  const listed = order.map((id) => byId.get(id)).filter(Boolean);
  // Options the stored order does not know keep their place at the end.
  return [...listed, ...question.options.filter((option) => !order.includes(option.id))];
}

// The test as the learner sees it. Without `answers` it is the paper to work
// on: no correct answers, explanations or transcripts. With `answers` it is
// the review of a finished attempt and includes all of them. Questions are
// numbered from 1 across the parts shown. A mock-test part may have passage
// groups; its questions then carry their groupId.
export function testParts({ test, media }, { optionOrder, answers, partKeys } = {}) {
  const url = (mediaId) => (mediaId && media[mediaId]?.url) || null;
  const review = Boolean(answers);
  let number = 0;
  return partsOf(partKeys).map((spec) => {
    const part = test[spec.key];
    return {
      key: spec.key,
      number: spec.number,
      title: spec.title,
      skill: spec.skill,
      audioUrl: url(part.audioMediaId),
      imageUrl: url(part.imageMediaId),
      passage: part.passage,
      ...(review ? { transcript: part.transcript } : {}),
      // Sets of a mock-test part: a recording (Parts 3-4) or a passage.
      groups: (part.groups || []).map((group) => ({
        id: group.id,
        audioUrl: url(group.audioMediaId),
        passage: group.passage,
        imageUrl: url(group.imageMediaId),
        ...(review ? { transcript: group.transcript || '' } : {}),
      })),
      questions: part.questions.map((question) => ({
        id: question.id,
        number: ++number,
        groupId: question.groupId ?? null,
        prompt: question.prompt,
        imageUrl: url(question.imageMediaId),
        // Mock-test Parts 1-2: each question has its own recording.
        audioUrl: url(question.audioMediaId),
        ...(review
          ? {
              explanation: question.explanation,
              transcript: question.transcript || '',
              chosenOptionId: answers[question.id] || null,
            }
          : {}),
        options: orderedOptions(question, optionOrder).map((option) => ({
          id: option.id,
          text: option.text,
          ...(review ? { isCorrect: option.isCorrect } : {}),
        })),
      })),
    };
  });
}

// Number of questions per skill in the seven-part test.
export const SKILL_TOTALS = Object.freeze({
  listening: LESSON_TEST_PARTS.filter((part) => part.skill === Skill.LISTENING).reduce((sum, part) => sum + part.questionCount, 0),
  reading: LESSON_TEST_PARTS.filter((part) => part.skill === Skill.READING).reduce((sum, part) => sum + part.questionCount, 0),
});

// How a learner's results at one lesson test develop over the retakes (D62).
// attempts are the finished attempts, oldest first. Returns null with fewer
// than two; otherwise the latest attempt compared with the one before it and
// with the first, in right answers (total and per skill).
export function testProgression(attempts) {
  if (attempts.length < 2) return null;
  const [first, previous, latest] = [attempts[0], attempts.at(-2), attempts.at(-1)];
  const change = latest.correctCount - previous.correctCount;
  return {
    trend: change > 0 ? TestTrend.IMPROVED : change < 0 ? TestTrend.DECLINED : TestTrend.UNCHANGED,
    changeFromPrevious: change,
    changeFromFirst: latest.correctCount - first.correctCount,
    listeningChange: latest.listeningCorrect - previous.listeningCorrect,
    readingChange: latest.readingCorrect - previous.readingCorrect,
    bestCorrectCount: Math.max(...attempts.map((attempt) => attempt.correctCount)),
  };
}

// Number of questions per skill in a test (or in some of its parts).
export function skillTotals(test, partKeys) {
  const totals = { listening: 0, reading: 0 };
  for (const spec of partsOf(partKeys))
    totals[spec.skill === Skill.LISTENING ? 'listening' : 'reading'] += test[spec.key]?.questions.length || 0;
  return totals;
}

