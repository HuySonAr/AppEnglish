import { ContentVersionKind, LESSON_TEST_PARTS } from '@appenglish/content-contracts';

// A read-only outline of one stored version (D122): sections of short lines
// that let a Content Manager tell versions apart without the editor. Pure.
const count = (list) => (Array.isArray(list) ? list.length : 0);
const plural = (number, noun) => `${number} ${noun}${number === 1 ? '' : 's'}`;
const excerpt = (text, max = 160) => {
  const flat = (text || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

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
    case ContentVersionKind.UNIT_REVIEW:
      return testOutline(content.test, { parts: LESSON_TEST_PARTS.filter((spec) => ['part5', 'part6'].includes(spec.key)) });
    case ContentVersionKind.LISTENING_EXERCISE:
      return [
        { title: content.audioMediaId ? 'Recording: yes' : 'Recording: none', lines: [] },
        { title: `Sentences: ${count(content.segments)}`, lines: (content.segments || []).map((segment) => excerpt(segment.text, 120)) },
      ];
    case ContentVersionKind.COURSE_ITEM: {
      const sections = (list) => (list || []).map((section, index) => `Recording ${index + 1}: ${plural(count(section.questions), 'question')}`);
      // A topic (D143): its recording, words, questions, ordering and sentences.
      if (content.vocabulary)
        return [
          { title: content.audioMediaId ? 'Recording: yes' : 'Recording: none', lines: [] },
          { title: `Sentences: ${count(content.segments)}`, lines: (content.segments || []).map((segment) => excerpt(segment.text, 120)) },
          { title: `Words: ${count(content.vocabulary)}`, lines: content.vocabulary.map((item) => item.word || '(empty)') },
          { title: `Questions: ${count(content.questions)}`, lines: (content.questions || []).map((question) => excerpt(question.prompt || '(empty)', 120)) },
          { title: content.ordering?.enabled ? `Ordering: ${plural(count(content.ordering.items), 'idea')}` : 'Ordering: off', lines: [] },
          { title: `Translated sentences: ${count((content.segments || []).filter((segment) => segment.translation))}`, lines: [] },
        ];
      return [{ title: `Recordings: ${count(content.sections)}`, lines: sections(content.sections) }];
    }
    default:
      return [];
  }
}
