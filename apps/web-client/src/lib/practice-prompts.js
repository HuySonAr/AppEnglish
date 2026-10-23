import { CEFR_LEVELS, PracticePromptKind, PracticePromptStatus, WritingTaskType } from '@appenglish/content-contracts';

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

export const levelOptions = [{ value: 'all', label: 'All levels' }, ...CEFR_LEVELS.map((level) => ({ value: level, label: level }))];
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
};

export const fieldLabel = (path) => FIELD_LABELS[String(path).split('.')[0]] || path;

export function changedFields(before, after) {
  if (!before || !after) return [];
  return Object.keys(FIELD_LABELS).filter((key) => key in after && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)).map((key) => FIELD_LABELS[key]);
}

export function filterPrompts(prompts, { search = '', kind = 'all', level = 'all', status = 'all' }) {
  const query = search.trim().toLowerCase();
  return prompts.filter(
    (prompt) =>
      (kind === 'all' || prompt.kind === kind) &&
      (level === 'all' || prompt.level === level) &&
      (status === 'all' || prompt.status === status) &&
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
