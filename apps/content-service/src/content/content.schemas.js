import { z } from 'zod';
import { AccountRole } from '@appenglish/auth-contracts';
import {
  FILL_IN_BLANK,
  LESSON_TEST_PARTS,
  MediaKind,
  MediaSection,
  PartOfSpeech,
  Accent,
  countBlanks,
} from '@appenglish/content-contracts';

const text = (max) => z.string().trim().max(max);
const requiredText = (max) => text(max).min(1);
const optionalId = z.string().uuid().optional();
const mediaId = z.string().uuid().nullable().default(null);
const position = z.number().int().min(1);

export const idSchema = z.string().uuid();

export const actorSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(Object.values(AccountRole)),
});

export const unitCreateSchema = z
  .object({ title: requiredText(200), description: text(2000).default('') })
  .strict();

export const unitUpdateSchema = z
  .object({
    title: requiredText(200).optional(),
    description: text(2000).optional(),
    position: position.optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one unit field is required',
  });

export const lessonCreateSchema = z.object({ title: requiredText(200) }).strict();

export const lessonUpdateSchema = z
  .object({ title: requiredText(200).optional(), position: position.optional() })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one lesson field is required',
  });

const optionSchema = z
  .object({
    id: optionalId,
    text: text(300).default(''),
    audioMediaId: mediaId,
    transcript: text(1000).default(''),
    isCorrect: z.boolean().default(false),
  })
  .strict();

const questionSchema = z
  .object({
    id: optionalId,
    prompt: text(1000).default(''),
    audioMediaId: mediaId,
    transcript: text(2000).default(''),
    imageMediaId: mediaId,
    options: z.array(optionSchema).max(4).default([]),
    explanation: text(2000).default(''),
  })
  .strict();

// One lesson-test part: shared audio/passage/image plus its questions. Which
// fields a part uses is defined by LESSON_TEST_PARTS. Question and option
// audio/transcript are unused since D48 but stay in the shape so drafts saved
// before it still parse.
const partSchema = z
  .object({
    audioMediaId: mediaId,
    transcript: text(10000).default(''),
    passage: text(10000).default(''),
    imageMediaId: mediaId,
    questions: z.array(questionSchema).max(10).default([]),
  })
  .strict();

// A draft may be incomplete: only shapes and sizes are enforced here. The
// publishing requirements are checked by publishIssues().
export const lessonContentSchema = z
  .object({
    vocabulary: z
      .array(
        z
          .object({
            id: optionalId,
            word: text(100).default(''),
            partOfSpeech: text(30).default(''),
            phonetic: text(100).default(''),
            audioUkMediaId: mediaId,
            audioUsMediaId: mediaId,
            meaning: text(300).default(''),
            example: text(500).default(''),
            exampleMeaning: text(500).default(''),
          })
          .strict(),
      )
      .max(200)
      .default([]),
    fillIn: z
      .object({
        passage: text(5000).default(''),
        answers: z.array(text(100)).max(50).default([]),
      })
      .strict()
      .default({}),
    test: z
      .object(
        Object.fromEntries(
          LESSON_TEST_PARTS.map((part) => [part.key, partSchema.default({})]),
        ),
      )
      .strict()
      .default({}),
  })
  .strict();

export const pronunciationSchema = z
  .object({
    word: requiredText(100),
    accents: z.array(z.enum(Object.values(Accent))).max(2).default(Object.values(Accent)),
    lessonId: z.string().uuid().optional(),
  })
  .strict();

export const mediaUploadSchema = z.object({
  kind: z.enum(Object.values(MediaKind)),
  fileName: requiredText(255),
  mimeType: requiredText(128),
  // Empty when the upload is not tied to a lesson (gRPC sends '' for unset).
  lessonId: z.preprocess((value) => value || undefined, z.string().uuid().optional()),
  section: z.preprocess((value) => value || undefined, z.enum(Object.values(MediaSection)).default(MediaSection.TEST)),
});

function duplicates(values) {
  const seen = new Set();
  return values.some((value) => seen.size === seen.add(value).size);
}

// Every media asset id a lesson content refers to.
export function contentMediaIds(content) {
  const parts = Object.values(content.test);
  return [
    ...content.vocabulary.flatMap((item) => [item.audioUkMediaId, item.audioUsMediaId]),
    ...parts.flatMap((part) => [
      part.audioMediaId,
      part.imageMediaId,
      ...part.questions.flatMap((question) => [
        question.audioMediaId,
        question.imageMediaId,
        ...question.options.map((option) => option.audioMediaId),
      ]),
    ]),
  ].filter(Boolean);
}

// Returns the reasons a lesson draft cannot be published; empty when it can.
// mediaById maps the ids of existing media assets to their rows.
export function publishIssues(content, mediaById) {
  const issues = [];
  const issue = (path, message) => issues.push({ path, message });
  const lower = (value) => value.toLowerCase();
  const required = (path, value) => {
    if (!value) issue(path, 'Required');
  };
  const requiredMedia = (path, id, kind) => {
    if (!id) issue(path, `${kind === MediaKind.AUDIO ? 'Audio' : 'Image'} is required`);
    else if (mediaById.get(id)?.kind !== kind) issue(path, `Media asset is missing or is not ${kind}`);
  };
  // Audio is always published together with its transcript.
  const requiredAudio = (path, item) => {
    requiredMedia(`${path}.audioMediaId`, item.audioMediaId, MediaKind.AUDIO);
    required(`${path}.transcript`, item.transcript);
  };

  if (!content.vocabulary.length) issue('vocabulary', 'At least one vocabulary item is required');
  content.vocabulary.forEach((item, index) => {
    const path = `vocabulary[${index}]`;
    // Phonetic, audio and the example translation are optional for now (D51).
    for (const field of ['word', 'meaning', 'example'])
      required(`${path}.${field}`, item[field]);
    if (!Object.values(PartOfSpeech).includes(item.partOfSpeech))
      issue(`${path}.partOfSpeech`, 'Choose a part of speech');
    for (const field of ['audioUkMediaId', 'audioUsMediaId'])
      if (item[field]) requiredMedia(`${path}.${field}`, item[field], MediaKind.AUDIO);
  });
  // The same word may appear once per part of speech.
  if (duplicates(content.vocabulary.filter((item) => item.word).map((item) => `${lower(item.word)}|${item.partOfSpeech}`)))
    issue('vocabulary', 'A word can appear only once per part of speech');
  const words = content.vocabulary.map((item) => lower(item.word)).filter(Boolean);

  const blanks = countBlanks(content.fillIn.passage);
  if (!content.fillIn.passage) issue('fillIn.passage', 'Required');
  else if (!blanks) issue('fillIn.passage', `The passage needs at least one blank (${FILL_IN_BLANK})`);
  if (blanks && content.fillIn.answers.length !== blanks)
    issue('fillIn.answers', `The passage has ${blanks} blanks but ${content.fillIn.answers.length} answers`);
  content.fillIn.answers.forEach((answer, index) => {
    if (!words.includes(lower(answer)))
      issue(`fillIn.answers[${index}]`, 'Answer must be one of the lesson vocabulary words');
  });

  for (const spec of LESSON_TEST_PARTS) {
    const part = content.test[spec.key];
    const partPath = `test.${spec.key}`;
    if (spec.group.audio) requiredAudio(partPath, part);
    if (spec.group.passage) required(`${partPath}.passage`, part.passage);
    if (spec.group.blanks && part.passage && countBlanks(part.passage) !== spec.questionCount)
      issue(`${partPath}.passage`, `The passage needs exactly ${spec.questionCount} blanks (${FILL_IN_BLANK})`);
    if (spec.group.optionalImage && part.imageMediaId)
      requiredMedia(`${partPath}.imageMediaId`, part.imageMediaId, MediaKind.IMAGE);
    if (part.questions.length !== spec.questionCount)
      issue(`${partPath}.questions`, `Part ${spec.number} needs exactly ${spec.questionCount} question${spec.questionCount === 1 ? '' : 's'}`);
    part.questions.forEach((question, index) => {
      const path = `${partPath}.questions[${index}]`;
      if (spec.question.prompt) required(`${path}.prompt`, question.prompt);
      if (spec.question.image) requiredMedia(`${path}.imageMediaId`, question.imageMediaId, MediaKind.IMAGE);
      required(`${path}.explanation`, question.explanation);
      if (question.options.length !== spec.optionCount)
        issue(`${path}.options`, `Exactly ${spec.optionCount} options are required`);
      if (question.options.filter((option) => option.isCorrect).length !== 1)
        issue(`${path}.options`, 'Exactly one option must be correct');
      if (spec.option.text) {
        const texts = question.options.map((option) => lower(option.text));
        if (texts.some((value) => !value)) issue(`${path}.options`, 'Every option needs text');
        else if (duplicates(texts)) issue(`${path}.options`, 'Options must be different');
      }
    });
  }

  const questions = Object.values(content.test).flatMap((part) => part.questions);
  const ids = [
    ...content.vocabulary,
    ...questions,
    ...questions.flatMap((question) => question.options),
  ].map((item) => item.id);
  if (duplicates(ids)) issue('content', 'Item ids must be unique');
  return issues;
}
