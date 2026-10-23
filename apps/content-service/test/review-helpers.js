import { randomUUID } from 'node:crypto';
import { UNIT_REVIEW_PART_COUNTS, UNIT_REVIEW_PASSAGE_COUNT, UNIT_REVIEW_PASSAGE_QUESTIONS } from '@appenglish/content-contracts';

const options = (correct) => Array.from({ length: 4 }, (_, index) => ({ id: randomUUID(), text: `Option ${index + 1}`, isCorrect: index === correct }));
const blanks = Array.from({ length: UNIT_REVIEW_PASSAGE_QUESTIONS }, (_, index) => `word ${index + 1} ___`).join(' ');
export function publishableReview() {
  const groups = Array.from({ length: UNIT_REVIEW_PASSAGE_COUNT }, (_, index) => ({ id: randomUUID(), passage: `Passage ${index + 1}: ${blanks}.` }));
  return {
    test: {
      part5: {
        questions: Array.from({ length: UNIT_REVIEW_PART_COUNTS.part5 }, (_, index) => ({ id: randomUUID(), prompt: `Sentence ${index + 1} with a _____.`, options: options(index % 4), explanation: 'Because.' })),
      },
      part6: {
        groups,
        questions: groups.flatMap((group) =>
          Array.from({ length: UNIT_REVIEW_PASSAGE_QUESTIONS }, (_, index) => ({ id: randomUUID(), groupId: group.id, options: options(index % 4), explanation: 'Because.' })),
        ),
      },
    },
  };
}
