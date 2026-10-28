import {
  ETS_SET_QUESTIONS,
  ETS_SET_TASKS,
  ETS_TASK_TIMING,
  EtsSpeakingTask,
  EtsWritingTask,
  PRACTICE_LEVELS,
  PRACTICE_LEVEL_INFO,
  PRACTICE_LIMITS,
  PracticePromptKind,
  PracticePromptStatus,
  WritingTaskType,
  practiceLevelOf,
} from '@appenglish/content-contracts';

export const kindLabels = {
  [PracticePromptKind.READ_ALOUD]: 'Read aloud',
  [PracticePromptKind.OPEN_SPEAKING]: 'Open speaking',
  [PracticePromptKind.WRITING]: 'Writing',
};

export const kindSkill = {
  [PracticePromptKind.READ_ALOUD]: 'Speaking',
  [PracticePromptKind.OPEN_SPEAKING]: 'Speaking',
  [PracticePromptKind.WRITING]: 'Writing',
};

export const taskTypeLabels = {
  [WritingTaskType.SENTENCE]: 'Sentences',
  [WritingTaskType.EMAIL]: 'Email',
  [WritingTaskType.PARAGRAPH]: 'Paragraph',
  [WritingTaskType.ESSAY]: 'Short essay',
};

export const statusInfo = {
  [PracticePromptStatus.DRAFT]: { label: 'Draft', variant: 'outline' },
  [PracticePromptStatus.PENDING_REVIEW]: { label: 'In review', variant: 'info' },
  [PracticePromptStatus.RETURNED]: { label: 'Returned', variant: 'warning' },
  [PracticePromptStatus.PUBLISHED]: { label: 'Published', variant: 'success' },
  [PracticePromptStatus.ARCHIVED]: { label: 'Published', variant: 'success' },
  [PracticePromptStatus.UNPUBLISHED]: { label: 'Taken down', variant: 'destructive' },
};

const levelInfo = (level) => PRACTICE_LEVEL_INFO[practiceLevelOf(level)] || null;
export const levelLabel = (level) => levelInfo(level)?.label || '—';
export const levelShort = (level) => levelInfo(level)?.short || '—';
export const levelScores = (level) => (levelInfo(level) ? `TOEIC ${levelInfo(level).scores.replace('-', '–')}` : '');
export const levelOptions = [{ value: 'all', label: 'All levels' }, ...PRACTICE_LEVELS.map((level) => ({ value: level, label: levelLabel(level) }))];
export const kindOptions = [{ value: 'all', label: 'All kinds' }, ...Object.entries(kindLabels).map(([value, label]) => ({ value, label }))];

export function countWords(text) {
  const trimmed = String(text || '').trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

const FIELD_LABELS = {
  title: 'Title',
  level: 'Level',
  topic: 'Topic',
  text: 'Text to read',
  audioMediaId: 'Model audio',
  instructions: 'Instructions',
  imageMediaId: 'Image',
  maxSeconds: 'Speaking time',
  sampleAnswer: 'Sample answer',
  keyPoints: 'Key points',
  taskType: 'Task type',
  minWords: 'Fewest words',
  maxWords: 'Most words',
  etsTask: 'Task type',
  context: 'Context',
  info: 'Information',
  questions: 'Questions',
  keywords: 'Words to use',
  email: 'Email',
};

const QUESTION_FIELDS = { text: 'question', sampleAnswer: 'sample answer', audioMediaId: 'audio' };

export function fieldLabel(path) {
  const value = String(path);
  const question = value.match(/^questions\[(\d+)\]\.(\w+)$/);
  if (question) return `Question ${Number(question[1]) + 1} ${QUESTION_FIELDS[question[2]] || question[2]}`;
  return FIELD_LABELS[value.split(/[.[]/)[0]] || value;
}

export function changedFields(before, after) {
  if (!before || !after) return [];
  return Object.keys(FIELD_LABELS).filter((key) => key in after && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)).map((key) => FIELD_LABELS[key]);
}

export function filterPrompts(prompts, { search = '', kind = 'all', level = 'all', status = 'all', etsTask = 'all' }) {
  const query = search.trim().toLowerCase();
  return prompts.filter(
    (prompt) =>
      (kind === 'all' || prompt.kind === kind) &&
      (level === 'all' || practiceLevelOf(prompt.level) === level) &&
      (status === 'all' || prompt.status === status) &&
      matchesEtsTask(prompt, etsTask) &&
      (!query || `${prompt.title} ${prompt.topic}`.toLowerCase().includes(query)),
  );
}

export function statusCounts(prompts) {
  const counts = { DRAFT: 0, PENDING_REVIEW: 0, RETURNED: 0, PUBLISHED: 0 };
  for (const prompt of prompts) {
    if (prompt.status in counts) counts[prompt.status]++;
    else if (prompt.publishedVersionNumber) counts.PUBLISHED++;
  }
  return counts;
}

export const kindSlugs = {
  [PracticePromptKind.READ_ALOUD]: 'read-aloud',
  [PracticePromptKind.OPEN_SPEAKING]: 'open-speaking',
  [PracticePromptKind.WRITING]: 'writing',
};
export const kindFromSlug = (slug) => Object.keys(kindSlugs).find((kind) => kindSlugs[kind] === slug) || null;
export const teacherListPath = (kind) => (kind === PracticePromptKind.WRITING ? `/teacher/${kindSlugs[kind]}` : '/teacher/speaking');
export const teacherPromptPath = (kind, id) => `/teacher/${kindSlugs[kind]}/${id}`;

export const ReviewArea = Object.freeze({ SPEAKING: 'speaking', WRITING: 'writing' });
export const reviewAreaOf = (kind) => (kind === PracticePromptKind.WRITING ? ReviewArea.WRITING : ReviewArea.SPEAKING);
export const reviewAreaKinds = {
  [ReviewArea.SPEAKING]: [PracticePromptKind.READ_ALOUD, PracticePromptKind.OPEN_SPEAKING],
  [ReviewArea.WRITING]: [PracticePromptKind.WRITING],
};
export const reviewListPath = (area) => `/content-manager/${area}-prompts`;
export const reviewPromptPath = (kind, id) => `${reviewListPath(reviewAreaOf(kind))}/${id}`;

export function authorOptions(prompts) {
  const authors = new Map();
  for (const prompt of prompts) if (prompt.authorId && !authors.has(prompt.authorId)) authors.set(prompt.authorId, prompt.author?.displayName || 'Unknown teacher');
  return [{ value: 'all', label: 'All teachers' }, ...[...authors].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label }))];
}

export const etsTaskLabels = {
  [EtsSpeakingTask.READ_ALOUD]: 'Read a text aloud',
  [EtsSpeakingTask.DESCRIBE_PICTURE]: 'Describe a picture',
  [EtsSpeakingTask.RESPOND_QUESTIONS]: 'Respond to questions',
  [EtsSpeakingTask.RESPOND_INFO]: 'Respond using information',
  [EtsSpeakingTask.EXPRESS_OPINION]: 'Express an opinion',
  [EtsWritingTask.PICTURE_SENTENCE]: 'Sentence from a picture',
  [EtsWritingTask.RESPOND_EMAIL]: 'Reply to an email',
  [EtsWritingTask.OPINION_ESSAY]: 'Opinion essay',
};

export const etsTasksOf = {
  [PracticePromptKind.READ_ALOUD]: [EtsSpeakingTask.READ_ALOUD],
  [PracticePromptKind.OPEN_SPEAKING]: [EtsSpeakingTask.DESCRIBE_PICTURE, EtsSpeakingTask.RESPOND_QUESTIONS, EtsSpeakingTask.RESPOND_INFO, EtsSpeakingTask.EXPRESS_OPINION],
  [PracticePromptKind.WRITING]: [EtsWritingTask.PICTURE_SENTENCE, EtsWritingTask.RESPOND_EMAIL, EtsWritingTask.OPINION_ESSAY],
};

export const isSetTask = (task) => ETS_SET_TASKS.includes(task);

export function etsTaskOf(kind, content) {
  if (kind === PracticePromptKind.READ_ALOUD) return EtsSpeakingTask.READ_ALOUD;
  return content?.etsTask || null;
}

export const etsTaskLabel = (task, fallback = '') => etsTaskLabels[task] || fallback;

export function durationText(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  if (value < 60) return `${value} s`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

export function etsTimingParts(task) {
  const timing = ETS_TASK_TIMING[task];
  if (!timing) return [];
  const parts = [];
  if (timing.readSeconds) parts.push({ label: 'Read', value: durationText(timing.readSeconds) });
  if (timing.prepareSeconds) parts.push({ label: 'Prepare', value: durationText(timing.prepareSeconds) });
  if (timing.respondSeconds) {
    const values = timing.respondSeconds;
    parts.push({ label: 'Speak', value: values.length > 1 ? `${values.join(' / ')} s` : durationText(values[0]) });
  }
  if (timing.writeSeconds) parts.push({ label: 'Write', value: durationText(timing.writeSeconds) });
  if (timing.recommendedWords) parts.push({ label: 'Aim for', value: `${timing.recommendedWords}+ words` });
  if (timing.playTwice?.length) parts.push({ label: 'Played twice', value: timing.playTwice.map((index) => `Q${index + 1}`).join(', ') });
  return parts;
}

export function etsFields(kind, task) {
  const set = isSetTask(task);
  const writing = kind === PracticePromptKind.WRITING;
  return {
    image: !set && task !== EtsWritingTask.RESPOND_EMAIL,
    imageRequired: task === EtsSpeakingTask.DESCRIBE_PICTURE || task === EtsWritingTask.PICTURE_SENTENCE,
    instructionsRequired: !set,
    context: task === EtsSpeakingTask.RESPOND_QUESTIONS,
    info: task === EtsSpeakingTask.RESPOND_INFO,
    questions: set,
    keywords: task === EtsWritingTask.PICTURE_SENTENCE,
    email: task === EtsWritingTask.RESPOND_EMAIL,
    sampleAnswer: !set,
    keyPoints: !set,
    maxSeconds: !writing,
    words: writing,
  };
}

const writingTaskTypes = {
  [EtsWritingTask.PICTURE_SENTENCE]: WritingTaskType.SENTENCE,
  [EtsWritingTask.RESPOND_EMAIL]: WritingTaskType.EMAIL,
  [EtsWritingTask.OPINION_ESSAY]: WritingTaskType.ESSAY,
};

export const PICTURE_SENTENCE_WORDS = Object.freeze({ min: 1, max: 40 });

const blankQuestion = () => ({ text: '', sampleAnswer: '', audioMediaId: null });
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function applyEtsTask(kind, content, task) {
  const next = { ...content, etsTask: task };
  if (isSetTask(task)) {
    const questions = [...(content.questions || [])].slice(0, ETS_SET_QUESTIONS);
    while (questions.length < ETS_SET_QUESTIONS) questions.push(blankQuestion());
    next.questions = questions;
  }
  if (task === EtsWritingTask.PICTURE_SENTENCE) {
    const keywords = [...(content.keywords || [])].slice(0, PRACTICE_LIMITS.keywords);
    while (keywords.length < PRACTICE_LIMITS.keywords) keywords.push('');
    next.keywords = keywords;
    next.minWords = PICTURE_SENTENCE_WORDS.min;
    next.maxWords = PICTURE_SENTENCE_WORDS.max;
  }
  if (task === EtsWritingTask.OPINION_ESSAY) {
    const recommended = ETS_TASK_TIMING[task].recommendedWords;
    next.minWords = recommended;
    next.maxWords = clamp(Math.max(content.maxWords || 0, recommended + 100), recommended, PRACTICE_LIMITS.words.max);
  }
  if (kind === PracticePromptKind.WRITING && writingTaskTypes[task]) next.taskType = writingTaskTypes[task];
  if (kind === PracticePromptKind.OPEN_SPEAKING) {
    const longest = Math.max(...(ETS_TASK_TIMING[task]?.respondSeconds || [0]));
    next.maxSeconds = clamp(Math.max(content.maxSeconds || 0, longest), PRACTICE_LIMITS.speakingSeconds.min, PRACTICE_LIMITS.speakingSeconds.max);
  }
  return next;
}

export const NO_ETS_TASK = 'none';

export function etsTaskOptions(prompts, allLabel = 'All task types') {
  const present = new Set(prompts.map((prompt) => prompt.etsTask || NO_ETS_TASK));
  const ordered = Object.keys(etsTaskLabels).filter((task) => present.has(task));
  const options = [{ value: 'all', label: allLabel }, ...ordered.map((task) => ({ value: task, label: etsTaskLabels[task] }))];
  if (present.has(NO_ETS_TASK)) options.push({ value: NO_ETS_TASK, label: 'Other' });
  return options;
}

export const matchesEtsTask = (prompt, task = 'all') => task === 'all' || (prompt.etsTask || NO_ETS_TASK) === task;

export const SPEAKING_PARTS = Object.freeze(
  [
    { number: 1, kind: PracticePromptKind.READ_ALOUD, etsTask: EtsSpeakingTask.READ_ALOUD, questions: 'Questions 1–2', firstQuestion: 1 },
    { number: 2, kind: PracticePromptKind.OPEN_SPEAKING, etsTask: EtsSpeakingTask.DESCRIBE_PICTURE, questions: 'Questions 3–4', firstQuestion: 3 },
    { number: 3, kind: PracticePromptKind.OPEN_SPEAKING, etsTask: EtsSpeakingTask.RESPOND_QUESTIONS, questions: 'Questions 5–7', firstQuestion: 5 },
    { number: 4, kind: PracticePromptKind.OPEN_SPEAKING, etsTask: EtsSpeakingTask.RESPOND_INFO, questions: 'Questions 8–10', firstQuestion: 8 },
    { number: 5, kind: PracticePromptKind.OPEN_SPEAKING, etsTask: EtsSpeakingTask.EXPRESS_OPINION, questions: 'Question 11', firstQuestion: 11 },
  ].map((part) => Object.freeze({ ...part, title: etsTaskLabels[part.etsTask] })),
);
export const speakingPartOf = (prompt) => (prompt?.kind === PracticePromptKind.WRITING ? null : SPEAKING_PARTS.find((part) => part.etsTask === etsTaskOf(prompt.kind, prompt)) || null);
