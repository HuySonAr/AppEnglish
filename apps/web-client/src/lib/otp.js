export const OTP_LENGTH = 6;

export const digitsOf = (text) => String(text || '').replace(/\D/g, '');

export function fillDigits(value, index, text, length = OTP_LENGTH) {
  const incoming = digitsOf(text);
  const cells = Array.from({ length }, (_, at) => (value[at] && value[at] !== ' ' ? value[at] : ' '));
  if (!incoming) return { value: cells.join('').trimEnd(), focus: index };
  let at = index;
  for (const digit of incoming) {
    if (at >= length) break;
    cells[at] = digit;
    at++;
  }
  return { value: cells.join('').trimEnd(), focus: Math.min(at, length - 1) };
}

export function clearDigit(value, index, length = OTP_LENGTH) {
  const cells = Array.from({ length }, (_, at) => (value[at] && value[at] !== ' ' ? value[at] : ' '));
  if (cells[index] !== ' ') {
    cells[index] = ' ';
    return { value: cells.join('').trimEnd(), focus: index };
  }
  const previous = Math.max(0, index - 1);
  cells[previous] = ' ';
  return { value: cells.join('').trimEnd(), focus: previous };
}

export const isComplete = (value, length = OTP_LENGTH) => /^\d+$/.test(value) && value.length === length;
export const cellAt = (value, index) => (value[index] && value[index] !== ' ' ? value[index] : '');
