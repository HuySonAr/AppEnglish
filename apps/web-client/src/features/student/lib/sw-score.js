import { EtsSpeakingTask } from '@appenglish/content-contracts';
import { LearningResponseCode, SW_LEVEL_BANDS, SW_RAW_MAX, SwScoringStatus, swBandOf } from '@appenglish/learning-contracts';

export const SW_POLL_MS = 5000;
export const READ_ALOUD_MAX = 3;

export const swResultPath = (testId, section, attemptNumber) => `/student/sw-tests/${testId}/result?section=${section}${attemptNumber ? `&attempt=${attemptNumber}` : ''}`;

const bandDescriptions = {
  speaking: [
    'Can hardly answer in English yet.',
    'Uses single words; often hard to understand.',
    'Gives short answers with many pauses and errors.',
    'Handles simple questions; longer answers break down.',
    'Answers familiar questions; opinions stay limited.',
    'Gives relevant answers with some errors in grammar and flow.',
    'Speaks clearly with good control and minor lapses.',
    'Speaks fluently and precisely on most topics.',
  ],
  writing: [
    'Cannot write simple sentences yet.',
    'Writes a few words; sentences are rarely complete.',
    'Writes simple sentences with frequent errors.',
    'Writes basic sentences; replies miss key points.',
    'Writes clear sentences; longer texts lack detail.',
    'Handles emails; opinions are weakly supported.',
    'Writes relevant replies; essays have some gaps.',
    'Writes well-organized text with few errors.',
    'Writes clear, well-supported text with ease.',
  ],
};

export function rangeText([low, high]) {
  return low === high ? String(low) : `${low}–${high}`;
}

export function swBandInfo(section, scaled, band) {
  if (scaled === null || scaled === undefined) return null;
  const index = Number.isInteger(band) && band >= 0 ? band : swBandOf(section, scaled);
  const range = SW_LEVEL_BANDS[section]?.[index];
  if (!range) return null;
  return { level: index + 1, levels: SW_LEVEL_BANDS[section].length, range: rangeText(range), description: bandDescriptions[section]?.[index] || '' };
}

export function formatScore(value) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

export const rawText = (final, section) => `${formatScore(final?.raw)}/${final?.rawMax ?? SW_RAW_MAX[section]}`;

export function shownFinal(data) {
  if (data?.teacherReview?.final) return { final: data.teacherReview.final, reviewed: true };
  if (data?.scoring?.final) return { final: data.scoring.final, reviewed: false };
  return { final: null, reviewed: false };
}

export const isScoring = (data) => data?.scoring?.status === SwScoringStatus.SCORING;

export const canRetry = (data) => !data?.teacherReview && (data?.scoring?.status === SwScoringStatus.FAILED || data?.scoring?.status === SwScoringStatus.NO_KEY);

export function attemptStatus(attempt) {
  if (!attempt) return null;
  if (attempt.scaled !== null && attempt.scaled !== undefined)
    return { label: String(attempt.scaled), detail: attempt.reviewed ? 'Teacher' : 'Estimated', variant: attempt.reviewed ? 'success' : 'secondary' };
  if (attempt.scoringStatus === SwScoringStatus.SCORING) return { label: 'Scoring…', detail: null, variant: 'info' };
  if (attempt.scoringStatus === SwScoringStatus.FAILED) return { label: 'Not scored', detail: null, variant: 'destructive' };
  if (attempt.scoringStatus === SwScoringStatus.NO_KEY) return { label: 'No Gemini key', detail: null, variant: 'outline' };
  return { label: 'Not scored yet', detail: null, variant: 'outline' };
}

export const attemptBadgeText = (status) => (status.detail ? `${status.label} · ${status.detail}` : status.label);

const stageLabels = { listening: 'Listening…', grading: 'Scoring…' };

export function itemScore(item, { reviewed = false } = {}) {
  const readAloud = item.task === EtsSpeakingTask.READ_ALOUD;
  const parts = (source) => ({ score: source.score ?? null, pronunciation: readAloud ? source.pronunciation ?? null : null, intonation: readAloud ? source.intonation ?? null : null });
  if (reviewed && item.teacher) return { source: 'teacher', ...parts(item.teacher) };
  const ai = item.ai;
  if (!ai) return { source: 'none' };
  if (stageLabels[ai.stage]) return { source: 'pending', label: stageLabels[ai.stage] };
  if (ai.stage === 'failed') return { source: 'failed', error: ai.error || 'Could not score this answer.' };
  return { source: 'ai', ...parts(ai) };
}

const reviewReasons = {
  NOT_READY: 'Wait until the test is scored.',
  NO_RECORDING: 'The recordings are no longer kept.',
  ALREADY_SENT: 'This part was already sent to a teacher.',
};

export function reviewErrorText(error, fallback) {
  const code = error?.response?.data?.code;
  if (code === LearningResponseCode.REVIEW_NOT_ALLOWED) return reviewReasons[error?.response?.data?.data?.reason] || fallback;
  return fallback;
}

export function retryErrorText(error, fallback) {
  return error?.response?.data?.code === LearningResponseCode.SW_ANSWER_LOCKED ? 'This part is already scored or being scored.' : fallback;
}

export function canSendToTeacher(data, section) {
  if (!data?.reviewQuota || data.teacherReview || isScoring(data)) return false;
  if (data.review && data.review.status !== 'EXPIRED') return false;
  if (section === 'speaking' && !data.items.some((item) => item.recordingUrl)) return false;
  return true;
}
