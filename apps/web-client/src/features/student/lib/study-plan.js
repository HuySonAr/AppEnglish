import { GOAL_STALE_DAYS } from '@appenglish/learning-contracts';
import { EtsSpeakingTask, EtsWritingTask } from '@appenglish/content-contracts';
import { etsTaskLabels } from '../../../lib/practice-prompts.js';
import { nextLessonStep, suggestedMockTest } from './home.js';

const DAY_MS = 86400000;
const PLAN_SIZE = 3;
const BOTH_PLAN_SIZE = 4;
const STALE_MS = GOAL_STALE_DAYS * DAY_MS;
const partTitles = { part1: 'Photographs', part2: 'Question–response', part3: 'Conversations', part4: 'Talks', part5: 'Incomplete sentences', part6: 'Text completion', part7: 'Reading comprehension' };

export const GOAL_PRESETS = [450, 550, 650, 750, 850, 950];
export const SW_GOAL_PRESETS = [110, 130, 150, 170, 190];

export const SwPart = Object.freeze({ SPEAKING: 'speaking', WRITING: 'writing' });
const swParts = [
  { key: SwPart.SPEAKING, label: 'Speaking', target: 'speakingTarget', tasks: Object.values(EtsSpeakingTask) },
  { key: SwPart.WRITING, label: 'Writing', target: 'writingTarget', tasks: Object.values(EtsWritingTask) },
];

const dayStart = (iso) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

const daysUntil = (examDate, now) => (examDate ? Math.max(0, Math.round((dayStart(examDate) - dayStart(now.toISOString())) / DAY_MS)) : null);

function lrSummary(lr, estimate, now) {
  const { targetScore, examDate } = lr;
  const current = estimate?.total ?? null;
  const gap = current === null ? null : Math.max(0, targetScore - current);
  const daysLeft = daysUntil(examDate, now);
  const weeksLeft = daysLeft === null ? null : Math.max(1, Math.ceil(daysLeft / 7));
  return {
    targetScore,
    examDate,
    current,
    gap,
    reached: gap === 0,
    daysLeft,
    weeksLeft,
    perWeek: gap && weeksLeft ? Math.ceil(gap / weeksLeft) : null,
    percent: current === null ? 0 : Math.min(100, Math.round((current * 100) / targetScore)),
  };
}

export function goalSummary(data, now = new Date()) {
  const goal = data?.goal;
  if (!goal || (!goal.lr && !goal.sw)) return null;
  return {
    lr: goal.lr ? lrSummary(goal.lr, data.estimate, now) : null,
    sw: goal.sw
      ? {
          speakingTarget: goal.sw.speakingTarget ?? null,
          writingTarget: goal.sw.writingTarget ?? null,
          examDate: goal.sw.examDate || null,
          daysLeft: daysUntil(goal.sw.examDate, now),
          speakingNow: data.sw?.estimate?.speaking ?? null,
          writingNow: data.sw?.estimate?.writing ?? null,
        }
      : null,
  };
}

function lrPlan({ goal, curriculum, mocks }, now) {
  const tasks = [];
  const mock = suggestedMockTest(mocks);
  const estimate = goal?.estimate || null;
  const stale = estimate && now.getTime() - new Date(estimate.at).getTime() > STALE_MS;
  if (mock && (!estimate || stale))
    tasks.push({
      key: 'full',
      kind: 'mock',
      title: estimate ? 'Take a full test to update your score' : 'Take a full mock test',
      detail: estimate ? `Your last estimate is over ${GOAL_STALE_DAYS} days old.` : 'It gives your first estimated TOEIC score.',
      to: `/student/mock-tests/${mock.id}`,
    });
  const weak = goal?.weakestPart ? goal.parts.find((part) => part.key === goal.weakestPart) : null;
  if (mock && weak)
    tasks.push({
      key: 'mini',
      kind: 'mock',
      title: `Part ${weak.number} mini test`,
      detail: `${partTitles[weak.key]}: ${weak.rate}% right in your recent tests.`,
      to: `/student/mock-tests/${mock.id}`,
      state: { startMini: weak.key },
    });
  const lesson = nextLessonStep(curriculum);
  if (lesson?.kind === 'lesson')
    tasks.push({ key: 'lesson', kind: 'lesson', title: `Lesson ${lesson.lesson.number}: ${lesson.lesson.title}`, detail: `Unit ${lesson.unit.number}: ${lesson.unit.title}`, to: `/student/lessons/${lesson.lesson.id}` });
  else if (lesson?.kind === 'placement') tasks.push({ key: 'placement', kind: 'lesson', title: 'Take the placement test', detail: 'It opens the lessons at your level.', to: '/student/placement' });
  return tasks;
}

const staleSince = (iso, now) => !iso || now.getTime() - new Date(iso).getTime() > STALE_MS;

function swPlan(data, now) {
  const sw = data?.goal?.sw;
  if (!sw) return [];
  const activity = data.sw || {};
  const parts = swParts.filter((part) => sw[part.target] !== null && sw[part.target] !== undefined);
  const tasks = [];
  for (const part of parts) {
    const last = activity.lastTest?.[part.key] || null;
    if (staleSince(last, now))
      tasks.push({
        key: `sw-test-${part.key}`,
        kind: 'swTest',
        title: `Take a ${part.label} test`,
        detail: last ? `Your last ${part.label} test is over ${GOAL_STALE_DAYS} days old.` : `Try the full ${part.label} section.`,
        to: '/student/sw-tests',
      });
  }
  const practiced = activity.practiced || {};
  const candidates = parts.flatMap((part) => part.tasks.map((task) => ({ part, task, at: practiced[task] || null })));
  const next = candidates.find((item) => !item.at) || [...candidates].sort((a, b) => new Date(a.at) - new Date(b.at))[0];
  if (next)
    tasks.push({
      key: 'sw-practice',
      kind: 'swPractice',
      skill: next.part.key,
      etsTask: next.task,
      title: `Practise: ${etsTaskLabels[next.task]}`,
      detail: next.at ? `${next.part.label} task you practised longest ago.` : `${next.part.label} task you have not practised yet.`,
      to: `/student/practice/${next.part.key}?etsTask=${next.task}&level=all`,
    });
  return tasks;
}

function interleave(first, second, size) {
  const tasks = [];
  for (let index = 0; tasks.length < size && (index < first.length || index < second.length); index += 1) {
    if (index < first.length) tasks.push(first[index]);
    if (index < second.length) tasks.push(second[index]);
  }
  return tasks.slice(0, size);
}

export function dailyPlan({ goal, curriculum, mocks }, now = new Date()) {
  const groups = goal?.goal || null;
  const withLr = !groups || Boolean(groups.lr);
  const withSw = Boolean(groups?.sw);
  const lr = withLr ? lrPlan({ goal, curriculum, mocks }, now) : [];
  const sw = withSw ? swPlan(goal, now) : [];
  if (withLr && withSw) return interleave(lr, sw, BOTH_PLAN_SIZE);
  return (withSw ? sw : lr).slice(0, PLAN_SIZE);
}
