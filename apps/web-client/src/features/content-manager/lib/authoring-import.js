import {
  authoringFromLesson,
  authoringFromReview,
  lessonAuthoringProblems,
  lessonFromAuthoring,
  reviewAuthoringProblems,
  reviewFromAuthoring,
} from '@appenglish/content-contracts/authoring';
import { workingContent } from './lesson-draft.js';
import { workingUnitReview } from './unit-review-draft.js';

// Import and export of a lesson or unit review as the authoring JSON (D124).
// Importing replaces the text of the draft but keeps what the file cannot
// carry: the pronunciation of a word still in the lesson (by word), and the
// recordings and images of the test (by part and question position).

const lower = (text) => (text || '').trim().toLowerCase();

export function mergeImportedLesson(current, imported) {
  const byWord = new Map((current?.vocabulary || []).map((item) => [lower(item.word), item]));
  const vocabulary = imported.vocabulary.map((item) => {
    const old = byWord.get(lower(item.word));
    return old
      ? { ...item, phonetic: item.phonetic || old.phonetic || '', audioUkMediaId: old.audioUkMediaId ?? null, audioUsMediaId: old.audioUsMediaId ?? null }
      : item;
  });
  const test = Object.fromEntries(
    Object.entries(imported.test).map(([key, part]) => {
      const old = current?.test?.[key];
      if (!old) return [key, part];
      return [
        key,
        {
          ...part,
          audioMediaId: old.audioMediaId ?? null,
          imageMediaId: old.imageMediaId ?? null,
          questions: part.questions.map((question, index) => ({ ...question, imageMediaId: old.questions?.[index]?.imageMediaId ?? null })),
        },
      ];
    }),
  );
  return { ...imported, vocabulary, test };
}

// The parsed file checked and turned into editor content, or the problems.
export function planLessonImport(text, current) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { errors: ['The file is not valid JSON'], warnings: [], summary: [], content: null };
  }
  const problems = lessonAuthoringProblems(data);
  const content = problems.errors.length ? null : workingContent({ draft: { content: mergeImportedLesson(current, lessonFromAuthoring(data)) } });
  return { ...problems, content };
}

export function planReviewImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { errors: ['The file is not valid JSON'], warnings: [], summary: [], content: null };
  }
  const problems = reviewAuthoringProblems(data);
  const content = problems.errors.length ? null : workingUnitReview({ draft: { content: reviewFromAuthoring(data) } });
  return { ...problems, content };
}

export const exportLesson = (content, { number, title } = {}) => ({ ...(number ? { number } : {}), ...(title ? { title } : {}), ...authoringFromLesson(content) });
export const exportReview = (content, { unit, title } = {}) => ({ ...(unit ? { unit } : {}), ...(title ? { title } : {}), ...authoringFromReview(content) });

// A safe file name for a download.
export const jsonFileName = (title) => `${(title || 'content').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'content'}.json`;
