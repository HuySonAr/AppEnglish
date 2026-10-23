import { GOAL_STALE_DAYS } from '@appenglish/learning-contracts';
import { nextLessonStep, suggestedMockTest } from './home.js';
import { nextStep } from './listening-course.js';

const DAY_MS = 86400000;
const PLAN_SIZE = 3;
const partTitles = { part1: 'Photographs', part2: 'Question–response', part3: 'Conversations', part4: 'Talks', part5: 'Incomplete sentences', part6: 'Text completion', part7: 'Reading comprehension' };

export const GOAL_PRESETS = [450, 550, 650, 750, 850, 950];

const dayStart = (iso) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

export function goalSummary(data, now = new Date()) {
  if (!data?.goal) return null;
  const { targetScore, examDate } = data.goal;
  const current = data.estimate?.total ?? null;
  const gap = current === null ? null : Math.max(0, targetScore - current);
  const daysLeft = examDate ? Math.max(0, Math.round((dayStart(examDate) - dayStart(now.toISOString())) / DAY_MS)) : null;
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

export function dailyPlan({ goal, curriculum, course, mocks }, now = new Date()) {
  const tasks = [];
  const mock = suggestedMockTest(mocks);
  const estimate = goal?.estimate || null;
  const stale = estimate && now.getTime() - new Date(estimate.at).getTime() > GOAL_STALE_DAYS * DAY_MS;
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
  const listening = nextStep(course);
  const listeningFirst = estimate && estimate.listening < estimate.reading;
  if (listening) {
    const task = { key: 'listening', kind: 'listening', title: listening.title, detail: `Listening course · ${listening.level}`, to: listening.path };
    if (listeningFirst) tasks.splice(Math.min(tasks.length, 1), 0, task);
    else tasks.push(task);
  }
  return tasks.slice(0, PLAN_SIZE);
}
