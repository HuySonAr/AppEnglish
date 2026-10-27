import { ContentReviewKind, ContentVersionKind, LESSON_TEST_PARTS } from '@appenglish/content-contracts';
import { etsTaskLabels } from '../../../lib/practice-prompts.js';
import { normalizeSwContent, sectionLabels, swBlocks } from './sw-test-draft.js';

const count = (list) => (Array.isArray(list) ? list.length : 0);
const plural = (number, noun) => `${number} ${noun}${number === 1 ? '' : 's'}`;
const excerpt = (text, max = 160) => {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};
const UNIT_REVIEW_PARTS = LESSON_TEST_PARTS.filter((spec) => ['part5', 'part6'].includes(spec.key));

function testOutline(test, { parts = LESSON_TEST_PARTS, prompts = true } = {}) {
  return parts.map((spec) => {
    const part = test?.[spec.key] || {};
    const questions = part.questions || [];
    const sets = count(part.groups);
    const lines = [];
    if (part.passage) lines.push(excerpt(part.passage));
    for (const group of part.groups || []) if (group.passage) lines.push(excerpt(group.passage));
    if (part.transcript) lines.push(`Transcript: ${excerpt(part.transcript, 120)}`);
    if (prompts) for (const question of questions) if (question.prompt) lines.push(excerpt(question.prompt, 120));
    return {
      title: `Part ${spec.number}: ${plural(questions.length, 'question')}${sets ? `, ${plural(sets, 'set')}` : ''}`,
      lines,
    };
  });
}

const testSources = (test, parts = LESSON_TEST_PARTS) => parts.map((spec) => test?.[spec.key] ?? null);

function sectionSources(kind, content) {
  switch (kind) {
    case ContentVersionKind.LESSON:
      return [content.vocabulary ?? null, content.fillIn ?? null, ...testSources(content.test)];
    case ContentVersionKind.MOCK_TEST:
    case ContentReviewKind.PLACEMENT:
      return testSources(content.test);
    case ContentVersionKind.UNIT_REVIEW:
      return testSources(content.test, UNIT_REVIEW_PARTS);
    case ContentVersionKind.LISTENING_EXERCISE:
      return [content.audioMediaId ?? null, { segments: content.segments ?? null, source: content.source ?? null }];
    case ContentVersionKind.SW_TEST: {
      const sw = normalizeSwContent(content);
      return swBlocks.map((block) => sw[block.section][block.key]);
    }
    default:
      return [];
  }
}

function swOutline(content) {
  const { speaking, writing } = normalizeSwContent(content);
  const asked = (set) => set.questions.map((item) => excerpt(item.text, 120)).filter(Boolean);
  const lines = {
    readAloud: speaking.readAloud.map((item) => excerpt(item.text, 120)).filter(Boolean),
    pictures: [],
    respondQuestions: [excerpt(speaking.respondQuestions.context), ...asked(speaking.respondQuestions)].filter(Boolean),
    respondInfo: [excerpt(speaking.respondInfo.info), ...asked(speaking.respondInfo)].filter(Boolean),
    opinion: [excerpt(speaking.opinion.text)].filter(Boolean),
    pictureSentences: writing.pictureSentences.map((item) => item.keywords.filter(Boolean).join(' / ')).filter(Boolean),
    emails: writing.emails.flatMap((item) => [excerpt(item.email, 120), excerpt(item.instructions, 120)]).filter(Boolean),
    essay: [excerpt(writing.essay.question)].filter(Boolean),
  };
  return swBlocks.map((block) => {
    const last = block.first + block.count - 1;
    return { title: `${sectionLabels[block.section]} ${block.first}${last > block.first ? `–${last}` : ''}: ${etsTaskLabels[block.task]}`, lines: lines[block.key] };
  });
}

export function versionOutline(kind, content) {
  if (!content) return [];
  switch (kind) {
    case ContentVersionKind.LESSON:
      return [
        {
          title: `Vocabulary: ${plural(count(content.vocabulary), 'word')}`,
          lines: (content.vocabulary || []).map((item) => `${item.word}${item.partOfSpeech ? ` (${item.partOfSpeech})` : ''}${item.meaning ? ` — ${item.meaning}` : ''}`),
        },
        {
          title: `Fill-in: ${plural(count(content.fillIn?.answers), 'blank')}`,
          lines: [excerpt(content.fillIn?.passage, 300), ...(count(content.fillIn?.answers) ? [`Answers: ${content.fillIn.answers.join(', ')}`] : [])].filter(Boolean),
        },
        ...testOutline(content.test),
      ];
    case ContentVersionKind.MOCK_TEST:
      return testOutline(content.test, { prompts: false });
    case ContentReviewKind.PLACEMENT:
      return testOutline(content.test);
    case ContentVersionKind.UNIT_REVIEW:
      return testOutline(content.test, { parts: UNIT_REVIEW_PARTS });
    case ContentVersionKind.LISTENING_EXERCISE:
      return [
        { title: content.audioMediaId ? 'Recording: yes' : 'Recording: none', lines: [] },
        { title: `Sentences: ${count(content.segments)}`, lines: (content.segments || []).map((segment) => excerpt(segment.text, 120)) },
      ];
    case ContentVersionKind.SW_TEST:
      return swOutline(content);
    default:
      return [];
  }
}

export const OTHER_DETAILS_CHANGED = 'Options, answers, times, audio or images changed.';

function without(lines, other) {
  const left = [...other];
  return lines.filter((line) => {
    const at = left.indexOf(line);
    if (at === -1) return true;
    left.splice(at, 1);
    return false;
  });
}

export function outlineChanges(kind, draftContent, publishedContent) {
  if (!draftContent || !publishedContent) return [];
  const after = versionOutline(kind, draftContent);
  const before = versionOutline(kind, publishedContent);
  const afterSources = sectionSources(kind, draftContent);
  const beforeSources = sectionSources(kind, publishedContent);
  const changes = [];
  after.forEach((section, index) => {
    const old = before[index] || { title: '', lines: [] };
    const added = without(section.lines, old.lines);
    const removed = without(old.lines, section.lines);
    const sourceChanged = JSON.stringify(afterSources[index] ?? null) !== JSON.stringify(beforeSources[index] ?? null);
    if (section.title === old.title && !added.length && !removed.length && !sourceChanged) return;
    changes.push({
      title: section.title,
      before: section.title === old.title ? null : old.title,
      added,
      removed,
      other: sourceChanged && !added.length && !removed.length && section.title === old.title ? OTHER_DETAILS_CHANGED : null,
    });
  });
  return changes;
}
