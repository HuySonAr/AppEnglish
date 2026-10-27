import { EtsSpeakingTask, SwSection } from '@appenglish/content-contracts';
import { SW_ITEM_MAX, SW_RAW_MAX, SwScoringStatus, swBandOf } from '@appenglish/learning-contracts';

export const OPEN_STAGES = new Set(['listening', 'grading']);

export function band3(score) {
  if (score >= 8) return 3;
  if (score >= 6) return 2;
  if (score >= 3) return 1;
  return 0;
}

export function readAloudItem(scores) {
  const pronunciation = band3(scores.accuracy);
  const intonation = band3(scores.fluency);
  return { pronunciation, intonation, score: (pronunciation + intonation) / 2 };
}

export function gradingPrompt(item) {
  return {
    task: item.task,
    text: item.text || '',
    context: item.context || '',
    info: item.info || '',
    keywords: item.keywords || [],
    email: item.email || '',
    instructions: item.instructions || '',
    respondSeconds: item.timing?.respondSeconds ? (item.setIndex === undefined ? item.timing.respondSeconds[0] : item.timing.respondSeconds[item.setIndex]) : null,
  };
}

export const maxOf = (item) => SW_ITEM_MAX[item.task] ?? 3;

export function rawOf(items) {
  return Object.values(items).reduce((sum, item) => sum + (Number(item.score) || 0), 0);
}

export function levelOf(values) {
  if (!values.length) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average >= 2.5) return 'High';
  if (average >= 1.5) return 'Medium';
  return 'Low';
}

export function finalScore(section, items, conversion) {
  const raw = Math.round(rawOf(items) * 10) / 10;
  const table = conversion[section];
  const scaled = table[Math.min(table.length - 1, Math.max(0, Math.round(raw)))];
  const readAloud = Object.values(items).filter((item) => item.task === EtsSpeakingTask.READ_ALOUD);
  return {
    raw,
    rawMax: SW_RAW_MAX[section],
    scaled,
    band: swBandOf(section, scaled),
    ...(section === SwSection.SPEAKING
      ? { pronunciationLevel: levelOf(readAloud.map((item) => item.pronunciation ?? 0)), intonationLevel: levelOf(readAloud.map((item) => item.intonation ?? 0)) }
      : {}),
  };
}

export function scoringState(items) {
  const values = Object.values(items);
  if (values.some((item) => OPEN_STAGES.has(item.stage))) return SwScoringStatus.SCORING;
  return values.some((item) => item.stage === 'failed') ? SwScoringStatus.FAILED : SwScoringStatus.DONE;
}
