import { FILL_IN_BLANK } from '@appenglish/content-contracts';

export function formatRemaining(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function remainingTime(expiresAt, offset, now = Date.now()) {
  return new Date(expiresAt).getTime() - (now + offset);
}

export function numberBlanks(passage, firstNumber) {
  let index = 0;
  return passage.split(FILL_IN_BLANK).reduce(
    (text, piece) => `${text}(${firstNumber + index++}) ${FILL_IN_BLANK}${piece}`,
  );
}

export function answeredCount(parts, answers) {
  return parts
    .flatMap((part) => part.questions)
    .filter((question) => answers[question.id]).length;
}

export function partSections(part) {
  const sections = part.groups?.length
    ? part.groups.map((group) => ({
        id: group.id,
        audioUrl: group.audioUrl || null,
        transcript: group.transcript || '',
        passage: group.passage,
        imageUrl: group.imageUrl,
        questions: part.questions.filter((question) => question.groupId === group.id),
      }))
    : [
        {
          id: part.key,
          audioUrl: null,
          transcript: '',
          passage: part.passage,
          imageUrl: part.imageUrl,
          questions: part.questions,
        },
      ];
  return sections.map((section) => ({
    ...section,
    blanks:
      section.passage.includes(FILL_IN_BLANK) &&
      section.questions.length > 0 &&
      section.questions.every((question) => !question.prompt),
  }));
}

