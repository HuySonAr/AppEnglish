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
