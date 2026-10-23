import { BELOW_A1 } from '@appenglish/learning-contracts';

export const cefrLabel = (level) => (level === BELOW_A1 ? 'Below A1' : level || '—');

export function receptiveDetail(entry) {
  if (!entry?.level) return { text: 'Take a full mock test', to: '/student/mock-tests' };
  return { text: `From your full mock test: ${entry.score}/495`, to: null };
}

export function productiveDetail(entry, { noun, to }) {
  if (entry?.level) {
    const reached = entry.levels.find((item) => item.level === entry.level);
    return { text: `${reached.passed} of your last ${reached.considered} ${entry.level} ${noun} passed`, to: null };
  }
  const best = [...(entry?.levels || [])].sort((a, b) => b.passed - a.passed)[0];
  if (best) return { text: `${best.passed}/${entry.needed} ${best.level} ${noun} passed so far`, to };
  return { text: `Pass ${entry?.needed ?? 3} ${noun} at one level`, to };
}
