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

export function publishableMock({ audioId, imageId }) {
  const question = (fields = {}) => ({
    explanation: 'Because.',
    options: Array.from({ length: 4 }, (_, index) => ({ text: `Option ${index + 1}`, isCorrect: index === 0 })),
    ...fields,
  });
  const letters = (count) => Array.from({ length: count }, (_, index) => ({ isCorrect: index === 0 }));
  const spoken = { audioMediaId: audioId, transcript: 'Spoken text.' };
  const [group3, group4, group6, group7a, group7b] = Array.from({ length: 5 }, () => randomUUID());
  return {
    test: {
      part1: { questions: [question({ ...spoken, imageMediaId: imageId, options: letters(4) }), question({ ...spoken, imageMediaId: imageId, options: letters(4) })] },
      part2: { questions: [question({ ...spoken, options: letters(3) })] },
      part3: { groups: [{ id: group3, ...spoken }], questions: [question({ groupId: group3, prompt: 'Q?' }), question({ groupId: group3, prompt: 'Q2?' })] },
      part4: { groups: [{ id: group4, ...spoken }], questions: [question({ groupId: group4, prompt: 'Q?' })] },
      part5: { questions: [question({ prompt: 'The ___ is late.' }), question({ prompt: 'A ___ day.' })] },
      part6: { groups: [{ id: group6, passage: 'Dear ___, the ___ is ready.' }], questions: [question({ groupId: group6 }), question({ groupId: group6 })] },
      part7: {
        groups: [{ id: group7a, passage: 'NOTICE A' }, { id: group7b, passage: 'NOTICE B', imageMediaId: imageId }],
        questions: [question({ groupId: group7a, prompt: 'Q?' }), question({ groupId: group7b, prompt: 'Q?' }), question({ groupId: group7b, prompt: 'Q2?' })],
      },
    },
  };
}

export function fullMock({ audioId, imageId }) {
  const question = (fields = {}) => ({
    explanation: 'Because.',
    options: Array.from({ length: 4 }, (_, index) => ({ text: `Option ${index + 1}`, isCorrect: index === 0 })),
    ...fields,
  });
  const letters = (count) => Array.from({ length: count }, (_, index) => ({ isCorrect: index === 0 }));
  const spoken = { audioMediaId: audioId, transcript: 'Spoken text.' };
  const grouped = (sizes, groupOf, questionOf) => {
    const groups = sizes.map((size, index) => ({ id: randomUUID(), ...groupOf(index), size }));
    return {
      groups: groups.map(({ size, ...group }) => group),
      questions: groups.flatMap((group, index) => Array.from({ length: group.size }, (_, at) => question({ groupId: group.id, prompt: `Q${at + 1}?`, ...questionOf(index, at) }))),
    };
  };
  const graphic = (sets) => (index, at) => (sets.includes(index) && at === 1 ? { imageMediaId: imageId } : {});
  return {
    test: {
      part1: { questions: Array.from({ length: 6 }, () => question({ ...spoken, imageMediaId: imageId, options: letters(4) })) },
      part2: { questions: Array.from({ length: 25 }, () => question({ ...spoken, options: letters(3) })) },
      part3: grouped(Array(13).fill(3), () => spoken, graphic([10, 11, 12])),
      part4: grouped(Array(10).fill(3), () => spoken, graphic([8, 9])),
      part5: { questions: Array.from({ length: 30 }, (_, index) => question({ prompt: `Sentence ${index + 1} ___ here.` })) },
      part6: grouped(Array(4).fill(4), () => ({ passage: 'A ___ B ___ C ___ D ___.' }), () => ({ prompt: '' })),
      part7: grouped([2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5], (index) => ({ passage: `TEXT ${index + 1}` }), () => ({})),
    },
  };
}

