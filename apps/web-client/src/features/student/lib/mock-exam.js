import { MOCK_ANSWER_SECONDS, MockFormat, Skill, TOEIC_SECTION_SEM } from '@appenglish/content-contracts';

export const MockPhase = Object.freeze({ LISTENING: 'listening', READING: 'reading' });
export const SectionTrend = Object.freeze({ UP: 'up', DOWN: 'down', SAME: 'same' });

const DEFAULT_ANSWER_SECONDS = 5;
const trendLabels = { [SectionTrend.UP]: 'Up', [SectionTrend.DOWN]: 'Down', [SectionTrend.SAME]: 'About the same' };

export const isPracticeSet = (item) => item?.format === MockFormat.PRACTICE;

export function listeningItems(parts = []) {
  const items = [];
  for (const part of parts) {
    if (part.skill !== Skill.LISTENING) continue;
    const base = { partKey: part.key, partNumber: part.number, partTitle: part.title };
    if (part.groups?.length) {
      for (const group of part.groups) {
        const questions = part.questions.filter((question) => question.groupId === group.id);
        if (!questions.length) continue;
        items.push({ ...base, id: group.id, audioUrl: group.audioUrl || part.audioUrl || null, imageUrl: group.imageUrl || null, questions });
      }
      continue;
    }
    for (const question of part.questions)
      items.push({ ...base, id: question.id, audioUrl: question.audioUrl || part.audioUrl || null, imageUrl: null, questions: [question] });
  }
  return items.map((item, index) => ({ ...item, index }));
}

export function answerSeconds(item) {
  return (MOCK_ANSWER_SECONDS[item.partKey] ?? DEFAULT_ANSWER_SECONDS) * item.questions.length;
}

export function resumeIndex(position, count) {
  const value = Number.isInteger(position) ? position : 0;
  return Math.min(Math.max(value, 0), count);
}

export function readingParts(parts = []) {
  return parts.filter((part) => part.skill === Skill.READING);
}

export function listeningClosed(closesAt, offset = 0, now = Date.now()) {
  return Boolean(closesAt) && new Date(closesAt).getTime() <= now + offset;
}

export function withMargin(score, margin = TOEIC_SECTION_SEM) {
  return `${score} ±${margin}`;
}

export function sectionTrendLabel(trend) {
  return trendLabels[trend] || null;
}

export function overallSectionTrend(progression) {
  if (!progression?.listeningTrend || !progression?.readingTrend) return null;
  const trends = [progression.listeningTrend, progression.readingTrend];
  const up = trends.includes(SectionTrend.UP);
  const down = trends.includes(SectionTrend.DOWN);
  if (up && !down) return SectionTrend.UP;
  if (down && !up) return SectionTrend.DOWN;
  return SectionTrend.SAME;
}
