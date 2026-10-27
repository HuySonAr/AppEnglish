import { z } from 'zod';
import { PRACTICE_LIMITS, SW_SPEAKING_LAYOUT, SW_WRITING_LAYOUT } from '@appenglish/content-contracts';

const text = (max) => z.string().trim().max(max).default('');
const mediaId = z.string().uuid().nullable().default(null);
const asked = z.object({ text: text(PRACTICE_LIMITS.question), audioMediaId: mediaId }).strict();

export const swTestContentSchema = z
  .object({
    speaking: z
      .object({
        readAloud: z.array(z.object({ text: text(PRACTICE_LIMITS.readAloudText) }).strict()).max(SW_SPEAKING_LAYOUT.readAloud).default([]),
        pictures: z.array(z.object({ imageMediaId: mediaId }).strict()).max(SW_SPEAKING_LAYOUT.pictures).default([]),
        respondQuestions: z.object({ context: text(PRACTICE_LIMITS.context), questions: z.array(asked).max(SW_SPEAKING_LAYOUT.setQuestions).default([]) }).strict().default({}),
        respondInfo: z.object({ info: text(PRACTICE_LIMITS.info), questions: z.array(asked).max(SW_SPEAKING_LAYOUT.setQuestions).default([]) }).strict().default({}),
        opinion: z.object({ text: text(PRACTICE_LIMITS.instructions), audioMediaId: mediaId }).strict().default({}),
      })
      .strict()
      .default({}),
    writing: z
      .object({
        pictureSentences: z
          .array(z.object({ imageMediaId: mediaId, keywords: z.array(z.string().trim().max(PRACTICE_LIMITS.keyword)).max(PRACTICE_LIMITS.keywords).default([]) }).strict())
          .max(SW_WRITING_LAYOUT.pictureSentences)
          .default([]),
        emails: z.array(z.object({ email: text(PRACTICE_LIMITS.email), instructions: text(PRACTICE_LIMITS.instructions) }).strict()).max(SW_WRITING_LAYOUT.emails).default([]),
        essay: z.object({ question: text(PRACTICE_LIMITS.instructions) }).strict().default({}),
      })
      .strict()
      .default({}),
  })
  .strict();

export const swTestCreateSchema = z.object({ title: z.string().trim().min(1).max(200) }).strict();
export const swTestUpdateSchema = swTestCreateSchema;
export const swTestPaperSchema = z.object({ versionId: z.string().uuid().optional() }).strict();

export function swTestMediaIds(content) {
  const { speaking, writing } = content;
  return [
    ...speaking.pictures.map((item) => item.imageMediaId),
    ...speaking.respondQuestions.questions.map((item) => item.audioMediaId),
    ...speaking.respondInfo.questions.map((item) => item.audioMediaId),
    speaking.opinion.audioMediaId,
    ...writing.pictureSentences.map((item) => item.imageMediaId),
  ].filter(Boolean);
}

export function swTestIssues(content, mediaById) {
  const issues = [];
  const need = (path, ok, message = 'Required') => {
    if (!ok) issues.push({ path, message });
  };
  const media = (path, id, kind) => need(path, id && mediaById.get(id)?.kind === kind, kind === 'image' ? 'Add a picture' : 'Add the question audio');
  const { speaking, writing } = content;
  need('speaking.readAloud', speaking.readAloud.length === SW_SPEAKING_LAYOUT.readAloud, `Add ${SW_SPEAKING_LAYOUT.readAloud} texts to read aloud`);
  speaking.readAloud.forEach((item, index) => need(`speaking.readAloud[${index}].text`, item.text));
  need('speaking.pictures', speaking.pictures.length === SW_SPEAKING_LAYOUT.pictures, `Add ${SW_SPEAKING_LAYOUT.pictures} pictures to describe`);
  speaking.pictures.forEach((item, index) => media(`speaking.pictures[${index}].imageMediaId`, item.imageMediaId, 'image'));
  need('speaking.respondQuestions.context', speaking.respondQuestions.context);
  need('speaking.respondInfo.info', speaking.respondInfo.info);
  for (const key of ['respondQuestions', 'respondInfo']) {
    const { questions } = speaking[key];
    need(`speaking.${key}.questions`, questions.length === SW_SPEAKING_LAYOUT.setQuestions, `Add ${SW_SPEAKING_LAYOUT.setQuestions} questions`);
    questions.forEach((item, index) => {
      need(`speaking.${key}.questions[${index}].text`, item.text);
      media(`speaking.${key}.questions[${index}].audioMediaId`, item.audioMediaId, 'audio');
    });
  }
  need('speaking.opinion.text', speaking.opinion.text);
  need('writing.pictureSentences', writing.pictureSentences.length === SW_WRITING_LAYOUT.pictureSentences, `Add ${SW_WRITING_LAYOUT.pictureSentences} pictures`);
  writing.pictureSentences.forEach((item, index) => {
    media(`writing.pictureSentences[${index}].imageMediaId`, item.imageMediaId, 'image');
    need(`writing.pictureSentences[${index}].keywords`, item.keywords.length === PRACTICE_LIMITS.keywords && item.keywords.every(Boolean), `Add ${PRACTICE_LIMITS.keywords} words`);
  });
  need('writing.emails', writing.emails.length === SW_WRITING_LAYOUT.emails, `Add ${SW_WRITING_LAYOUT.emails} emails`);
  writing.emails.forEach((item, index) => {
    need(`writing.emails[${index}].email`, item.email);
    need(`writing.emails[${index}].instructions`, item.instructions);
  });
  need('writing.essay.question', writing.essay.question);
  return issues;
}
