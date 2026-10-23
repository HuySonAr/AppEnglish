import { LESSON_TEST_PARTS, Skill } from '@appenglish/content-contracts';
import {
  LessonState,
  LessonStep,
  PracticeDirection,
  StepStatus,
  TestTrend,
  UnitReviewState,
  VOCABULARY_PRACTICE_SIZE,
} from '@appenglish/learning-contracts';

export function shuffled(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function lessonAccess(curriculum, startUnit, completed, passedReviews = new Set()) {
  const access = new Map();
  let previous = null;
  curriculum.units.forEach((unit, unitIndex) => {
    const unitNumber = unitIndex + 1;
    const before = unitIndex > 0 ? curriculum.units[unitIndex - 1] : null;
    const reviewBlocks = Boolean(before?.reviewVersionId && before.lessons.length && !passedReviews.has(before.id));
    unit.lessons.forEach((lesson, lessonIndex) => {
      const firstOfStartUnit = unitNumber === startUnit && lessonIndex === 0;
      const afterPrevious = Boolean(previous) && completed.has(previous) && !(lessonIndex === 0 && reviewBlocks);
      const state = completed.has(lesson.id)
        ? LessonState.COMPLETED
        : startUnit === null
          ? LessonState.LOCKED
          :
            unitNumber < startUnit || firstOfStartUnit || afterPrevious
            ? LessonState.OPEN
            : LessonState.LOCKED;
      access.set(lesson.id, {
        state,
        unitNumber,
        lessonNumber: lessonIndex + 1,
        unit,
        lesson,
        previousLessonId: previous,
        reviewRequired: Boolean(previous) && !firstOfStartUnit && completed.has(previous),
      });
      previous = lesson.id;
    });
  });
  return access;
}

export function unitReviewAccess(curriculum, startUnit, completed, passedReviews) {
  const access = new Map();
  curriculum.units.forEach((unit, unitIndex) => {
    const unitNumber = unitIndex + 1;
    const left = unit.lessons.filter((lesson) => !completed.has(lesson.id)).length;
    let state = UnitReviewState.NONE;
    if (unit.reviewVersionId)
      state = passedReviews.has(unit.id)
        ? UnitReviewState.PASSED
        : startUnit === null
          ? UnitReviewState.LOCKED
          : unitNumber < startUnit || (unit.lessons.length > 0 && left === 0)
            ? UnitReviewState.OPEN
            : UnitReviewState.LOCKED;
    access.set(unit.id, { state, unitNumber, unit, lessonsLeft: left });
  });
  return access;
}

export function lessonSteps(entry, progress) {
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

export function practiceWords(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.word.trim().toLowerCase()}|${item.partOfSpeech}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function vocabularyPractice(words, random = Math.random, size = VOCABULARY_PRACTICE_SIZE) {
  const chosen = shuffled(words, random).slice(0, size);
  const half = Math.ceil(chosen.length / 2);
  return shuffled(
    chosen.map((item, index) => {
      const direction = index < half ? PracticeDirection.MEANING : PracticeDirection.WORD;
      const field = direction === PracticeDirection.MEANING ? 'meaning' : 'word';
      const answer = item[field];
      const candidates = shuffled(words, random)
        .filter((other) => !sameText(other[field], answer) && !sameText(other.meaning, item.meaning))
        .sort((a, b) => Number(b.partOfSpeech === item.partOfSpeech) - Number(a.partOfSpeech === item.partOfSpeech));
      const others = [];
      for (const other of candidates)
        if (others.length < 3 && !others.some((text) => sameText(text, other[field]))) others.push(other[field]);
      return {
        id: item.id,
        direction,
        prompt: direction === PracticeDirection.MEANING ? item.word : item.meaning,
        partOfSpeech: item.partOfSpeech,
        options: shuffled([answer, ...others], random),
        answer,
        word: item,
      };
    }),
    random,
  );
}

export function wrongQuizAnswers(vocabulary, answers) {
  return vocabulary.filter((item) => answers[item.id] !== item.meaning).map((item) => item.id);
}

export function wrongBlanks(expected, answers) {
  const normal = (value) => (value || '').trim().toLowerCase();
  return expected
    .map((answer, index) => (normal(answers[index]) === normal(answer) ? null : index))
    .filter((index) => index !== null);
}

const partsOf = (partKeys) =>
  LESSON_TEST_PARTS.filter((spec) => !partKeys || partKeys.includes(spec.key));

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
  return [...listed, ...question.options.filter((option) => !order.includes(option.id))];
}

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

export const SKILL_TOTALS = Object.freeze({
  listening: LESSON_TEST_PARTS.filter((part) => part.skill === Skill.LISTENING).reduce((sum, part) => sum + part.questionCount, 0),
  reading: LESSON_TEST_PARTS.filter((part) => part.skill === Skill.READING).reduce((sum, part) => sum + part.questionCount, 0),
});

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

export function skillTotals(test, partKeys) {
  const totals = { listening: 0, reading: 0 };
  for (const spec of partsOf(partKeys))
    totals[spec.skill === Skill.LISTENING ? 'listening' : 'reading'] += test[spec.key]?.questions.length || 0;
  return totals;
}

