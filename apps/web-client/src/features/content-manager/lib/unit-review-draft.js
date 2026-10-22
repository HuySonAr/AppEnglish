import {
  LESSON_TEST_PARTS,
  UNIT_REVIEW_PARTS,
  UNIT_REVIEW_PART_COUNTS,
  UNIT_REVIEW_PASSAGE_COUNT,
  UNIT_REVIEW_PASSAGE_QUESTIONS,
  UNIT_REVIEW_QUESTION_COUNT,
} from '@appenglish/content-contracts';
import { newMockGroup, newMockQuestion } from './mock-draft.js';

// The unit review (D121) in the editor: Parts 5 and 6 of the mock-test shape
// (Part 6 passages are sets), 20 + 2 × 5 questions numbered 1-30.
export const UNIT_REVIEW_SPECS = UNIT_REVIEW_PARTS.map((key) => LESSON_TEST_PARTS.find((part) => part.key === key));

// The number of each part's first question: Part 5 starts at 1, Part 6 at 21.
export const UNIT_REVIEW_FIRST_NUMBERS = Object.freeze({ part5: 1, part6: 1 + UNIT_REVIEW_PART_COUNTS.part5 });

// What each part of a review holds, for the editor's limits and badges.
export const UNIT_REVIEW_LIMITS = Object.freeze({
  part5: Object.freeze({ target: UNIT_REVIEW_PART_COUNTS.part5 }),
  part6: Object.freeze({ target: UNIT_REVIEW_PART_COUNTS.part6, maxSets: UNIT_REVIEW_PASSAGE_COUNT, setQuestionLimit: UNIT_REVIEW_PASSAGE_QUESTIONS }),
});

// The review as the editor works on it: the draft, else a copy of the
// published version, with both parts present and every question holding
// four options.
export function workingUnitReview(reviewData) {
  const source = structuredClone(reviewData?.draft?.content || reviewData?.published?.content || {});
  return {
    test: Object.fromEntries(
      UNIT_REVIEW_SPECS.map((spec) => {
        const part = source.test?.[spec.key] || {};
        return [
          spec.key,
          {
            audioMediaId: null,
            transcript: '',
            passage: '',
            imageMediaId: null,
            groups: (part.groups || []).map((group) => ({ ...newMockGroup(), ...group })),
            questions: (part.questions || []).map((question) => ({
              ...newMockQuestion(spec),
              ...question,
              options: Array.from({ length: spec.optionCount }, (_, index) => ({
                id: crypto.randomUUID(),
                text: '',
                audioMediaId: null,
                transcript: '',
                isCorrect: false,
                ...question.options?.[index],
              })),
            })),
          },
        ];
      }),
    ),
  };
}

export function unitReviewQuestionCount(content) {
  return UNIT_REVIEW_PARTS.reduce((sum, key) => sum + (content.test[key]?.questions.length || 0), 0);
}

// True when the review holds exactly what the publishing rules want in size:
// 20 Part 5 questions and 2 passages of 5.
export function unitReviewComplete(content) {
  const part6 = content.test.part6;
  return (
    content.test.part5.questions.length === UNIT_REVIEW_PART_COUNTS.part5 &&
    part6.groups.length === UNIT_REVIEW_PASSAGE_COUNT &&
    part6.groups.every((group) => part6.questions.filter((question) => question.groupId === group.id).length === UNIT_REVIEW_PASSAGE_QUESTIONS) &&
    unitReviewQuestionCount(content) === UNIT_REVIEW_QUESTION_COUNT
  );
}

// "Part 6 · passage 2 · question 27 · options" for a publish issue path such
// as "test.part6.groups[1].passage" or "test.part6.questions[6].options".
export function unitReviewIssueLabel(path) {
  const labels = { prompt: 'question text' };
  let partKey = null;
  return path
    .split('.')
    .map((token) => {
      const [, name, index] = /^(\w+?)(?:\[(\d+)\])?$/.exec(token) || [null, token];
      const number = index === undefined ? '' : ` ${Number(index) + 1}`;
      if (name === 'test') return null;
      if (/^part\d$/.test(name)) {
        partKey = name;
        return `Part ${name.slice(4)}`;
      }
      if (name === 'groups') return index === undefined ? 'passages' : `passage${number}`;
      if (name === 'questions')
        return index === undefined ? 'questions' : `question ${(UNIT_REVIEW_FIRST_NUMBERS[partKey] ?? 1) + Number(index)}`;
      return labels[name] || name;
    })
    .filter(Boolean)
    .join(' · ');
}
