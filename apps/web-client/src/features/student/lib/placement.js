import { FILL_IN_BLANK } from '@appenglish/content-contracts';

// "24:05" for the milliseconds left; never below 00:00.
export function formatRemaining(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

// Milliseconds left on the server's clock. offset is serverNow minus the
// browser's time when the attempt was loaded, so a wrong local clock does not
// change the time allowed.
export function remainingTime(expiresAt, offset, now = Date.now()) {
  return new Date(expiresAt).getTime() - (now + offset);
}

// Puts each blank's question number in front of it: "(16) ___".
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

// A test part as sections to show one after another. A lesson-test part is
// one section (its passage, if any, and all its questions); a mock-test part
// made of sets is one section per set: a recording (Parts 3-4) or a passage
// (Parts 6-7) with its questions. blanks is true when the
// passage has numbered blanks answered by questions without a prompt (Part 6).
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
          // The part's own recording and transcript are shown by the part.
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

