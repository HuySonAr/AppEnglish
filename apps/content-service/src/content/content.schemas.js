import { z } from 'zod';
import { AccountRole } from '@appenglish/auth-contracts';
import {
  ContentVersionKind,
  FILL_IN_BLANK,
  LESSON_TEST_PARTS,
  MOCK_GROUPED_PARTS,
  MOCK_GROUP_AUDIO_PARTS,
  MOCK_GRAPHIC_SET_INDEXES,
  MOCK_SET_QUESTION_COUNT,
  MOCK_TEST_PART_COUNTS,
  MOCK_FULL_GROUPS,
  MOCK_FULL_PART7,
  MockFormat,
  MOCK_QUESTION_AUDIO_PARTS,
  MOCK_TEST_LEVELS,
  UNIT_REVIEW_PARTS,
  UNIT_REVIEW_PART_COUNTS,
  UNIT_REVIEW_PASSAGE_COUNT,
  UNIT_REVIEW_PASSAGE_QUESTIONS,
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
    groupId: z.string().uuid().nullable().default(null),
    options: z.array(optionSchema).max(4).default([]),
    explanation: text(2000).default(''),
  })
  .strict();

const partSchema = z
  .object({
    audioMediaId: mediaId,
    transcript: text(10000).default(''),
    passage: text(10000).default(''),
    imageMediaId: mediaId,
    questions: z.array(questionSchema).max(10).default([]),
  })
  .strict();

const testSchema = z
  .object(
    Object.fromEntries(LESSON_TEST_PARTS.map((part) => [part.key, partSchema.default({})])),
  )
  .strict()
  .default({});

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
    test: testSchema,
  })
  .strict();

export const placementContentSchema = z.object({ test: testSchema }).strict();

const mockPartSchema = partSchema.extend({
  groups: z
    .array(
      z
        .object({
          id: optionalId,
          audioMediaId: mediaId,
          transcript: text(10000).default(''),
          passage: text(10000).default(''),
          imageMediaId: mediaId,
        })
        .strict(),
    )
    .max(40)
    .default([]),
  questions: z.array(questionSchema).max(100).default([]),
});

export const mockContentSchema = z
  .object({
    test: z
      .object(
        Object.fromEntries(LESSON_TEST_PARTS.map((part) => [part.key, mockPartSchema.default({})])),
      )
      .strict()
      .default({}),
  })
  .strict();

export const unitReviewContentSchema = z
  .object({
    test: z
      .object(Object.fromEntries(UNIT_REVIEW_PARTS.map((key) => [key, mockPartSchema.default({})])))
      .strict()
      .default({}),
  })
  .strict();

export const examTypeSchema = z.object({ name: requiredText(100) }).strict();

const mockMeta = {
  title: requiredText(200),
  level: z.number().int().refine((value) => MOCK_TEST_LEVELS.includes(value), { message: 'Level must be 1, 2 or 3' }),
  durationMinutes: z.number().int().min(1).max(300),
  format: z.enum(Object.values(MockFormat)),
};
export const mockCreateSchema = z
  .object({ title: mockMeta.title, level: mockMeta.level, durationMinutes: mockMeta.durationMinutes.optional(), format: mockMeta.format.default(MockFormat.FULL), examTypeId: z.string().uuid() })
  .strict()
  .refine((value) => value.format === MockFormat.FULL || value.durationMinutes !== undefined, { message: 'A practice set needs a duration', path: ['durationMinutes'] });
export const mockUpdateSchema = z
  .object({ title: mockMeta.title.optional(), level: mockMeta.level.optional(), durationMinutes: mockMeta.durationMinutes.optional(), format: mockMeta.format.optional() })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });

export const placementPaperSchema = z.object({ versionId: z.string().uuid().optional() }).strict();

export const versionRequestSchema = z
  .object({ kind: z.enum(Object.values(ContentVersionKind)), versionId: z.string().uuid().optional() })
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
  lessonId: z.preprocess((value) => value || undefined, z.string().uuid().optional()),
  section: z.preprocess((value) => value || undefined, z.enum(Object.values(MediaSection)).default(MediaSection.TEST)),
});

function duplicates(values) {
  const seen = new Set();
  return values.some((value) => seen.size === seen.add(value).size);
}

export function contentMediaIds(content) {
  const parts = Object.values(content.test);
  return [
    ...(content.vocabulary || []).flatMap((item) => [item.audioUkMediaId, item.audioUsMediaId]),
    ...parts.flatMap((part) => [
      part.audioMediaId,
      part.imageMediaId,
      ...(part.groups || []).flatMap((group) => [group.audioMediaId, group.imageMediaId]),
      ...part.questions.flatMap((question) => [
        question.audioMediaId,
        question.imageMediaId,
        ...question.options.map((option) => option.audioMediaId),
      ]),
    ]),
  ].filter(Boolean);
}

const lower = (value) => value.toLowerCase();

function issueChecks(issues, mediaById) {
  const issue = (path, message) => issues.push({ path, message });
  const required = (path, value) => {
    if (!value) issue(path, 'Required');
  };
  const requiredMedia = (path, id, kind) => {
    if (!id) issue(path, `${kind === MediaKind.AUDIO ? 'Audio' : 'Image'} is required`);
    else if (mediaById.get(id)?.kind !== kind) issue(path, `Media asset is missing or is not ${kind}`);
  };
  const requiredAudio = (path, item) => {
    requiredMedia(`${path}.audioMediaId`, item.audioMediaId, MediaKind.AUDIO);
    required(`${path}.transcript`, item.transcript);
  };
  return { issue, required, requiredMedia, requiredAudio };
}

export function publishIssues(content, mediaById) {
  const issues = [];
  const { issue, required, requiredMedia } = issueChecks(issues, mediaById);

  if (!content.vocabulary.length) issue('vocabulary', 'At least one vocabulary item is required');
  content.vocabulary.forEach((item, index) => {
    const path = `vocabulary[${index}]`;
    for (const field of ['word', 'meaning', 'example'])
      required(`${path}.${field}`, item[field]);
    if (!Object.values(PartOfSpeech).includes(item.partOfSpeech))
      issue(`${path}.partOfSpeech`, 'Choose a part of speech');
    for (const field of ['audioUkMediaId', 'audioUsMediaId'])
      if (item[field]) requiredMedia(`${path}.${field}`, item[field], MediaKind.AUDIO);
  });
  if (duplicates(content.vocabulary.filter((item) => item.word).map((item) => `${lower(item.word)}|${item.partOfSpeech}`)))
    issue('vocabulary', 'A word can appear only once per part of speech');
  const blanks = countBlanks(content.fillIn.passage);
  if (!content.fillIn.passage) issue('fillIn.passage', 'Required');
  else if (!blanks) issue('fillIn.passage', `The passage needs at least one blank (${FILL_IN_BLANK})`);
  if (blanks && content.fillIn.answers.length !== blanks)
    issue('fillIn.answers', `The passage has ${blanks} blanks but ${content.fillIn.answers.length} answers`);
  content.fillIn.answers.forEach((answer, index) => {
    if (!answer.trim()) issue(`fillIn.answers[${index}]`, 'Required');
  });

  testIssues(content.test, issues, mediaById);

  const questions = Object.values(content.test).flatMap((part) => part.questions);
  const ids = [
    ...content.vocabulary,
    ...questions,
    ...questions.flatMap((question) => question.options),
  ].map((item) => item.id);
  if (duplicates(ids)) issue('content', 'Item ids must be unique');
  return issues;
}

export function placementIssues(content, mediaById) {
  const issues = [];
  testIssues(content.test, issues, mediaById);
  const questions = Object.values(content.test).flatMap((part) => part.questions);
  const ids = [...questions, ...questions.flatMap((question) => question.options)].map((item) => item.id);
  if (duplicates(ids)) issues.push({ path: 'content', message: 'Item ids must be unique' });
  return issues;
}

function testIssues(test, issues, mediaById) {
  const { issue, required, requiredMedia, requiredAudio } = issueChecks(issues, mediaById);
  for (const spec of LESSON_TEST_PARTS) {
    const part = test[spec.key];
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
}

export function mockIssues(content, mediaById) {
  const issues = [];
  const { issue, required, requiredMedia, requiredAudio } = issueChecks(issues, mediaById);
  for (const spec of LESSON_TEST_PARTS) {
    const part = content.test[spec.key];
    const partPath = `test.${spec.key}`;
    const grouped = MOCK_GROUPED_PARTS.includes(spec.key);
    const groupAudio = MOCK_GROUP_AUDIO_PARTS.includes(spec.key);
    const groupNoun = groupAudio ? 'recording' : 'passage';
    if (!part.questions.length) issue(`${partPath}.questions`, `Part ${spec.number} needs at least one question`);
    if (part.questions.length > MOCK_TEST_PART_COUNTS[spec.key])
      issue(`${partPath}.questions`, `Part ${spec.number} has at most ${MOCK_TEST_PART_COUNTS[spec.key]} questions`);
    if (grouped) {
      if (!part.groups.length) issue(`${partPath}.groups`, `Part ${spec.number} needs at least one ${groupNoun}`);
      part.groups.forEach((group, index) => {
        const path = `${partPath}.groups[${index}]`;
        const count = part.questions.filter((question) => question.groupId === group.id).length;
        if (groupAudio) requiredAudio(path, group);
        else required(`${path}.passage`, group.passage);
        if (!count) issue(path, `The ${groupNoun} needs at least one question`);
        if (groupAudio && count > MOCK_SET_QUESTION_COUNT)
          issue(path, `The ${groupNoun} has at most ${MOCK_SET_QUESTION_COUNT} questions`);
        if (spec.group.blanks && group.passage && countBlanks(group.passage) !== count)
          issue(`${path}.passage`, `The passage has ${countBlanks(group.passage)} blanks (${FILL_IN_BLANK}) but ${count} questions`);
        if (group.imageMediaId) requiredMedia(`${path}.imageMediaId`, group.imageMediaId, MediaKind.IMAGE);
        if (groupAudio) {
          const graphics = part.questions.filter((question) => question.groupId === group.id && question.imageMediaId).length;
          const graphicSets = MOCK_GRAPHIC_SET_INDEXES[spec.key];
          if (!graphicSets.includes(index)) {
            if (graphics)
              issue(`${path}.imageMediaId`, `Only ${groupNoun}s ${graphicSets[0] + 1}–${graphicSets.at(-1) + 1} of Part ${spec.number} have a graphic`);
          } else if (graphics !== 1)
            issue(`${path}.imageMediaId`, `Exactly one question of the ${groupNoun} needs a graphic`);
        }
      });
    }
    part.questions.forEach((question, index) => {
      const path = `${partPath}.questions[${index}]`;
      if (grouped && !part.groups.some((group) => group.id === question.groupId))
        issue(path, `The question does not belong to a ${groupNoun}`);
      if (MOCK_QUESTION_AUDIO_PARTS.includes(spec.key)) requiredAudio(path, question);
      if (spec.question.prompt) required(`${path}.prompt`, question.prompt);
      if (spec.question.image || (groupAudio && question.imageMediaId))
        requiredMedia(`${path}.imageMediaId`, question.imageMediaId, MediaKind.IMAGE);
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
  const parts = Object.values(content.test);
  const questions = parts.flatMap((part) => part.questions);
  const ids = [
    ...parts.flatMap((part) => part.groups),
    ...questions,
    ...questions.flatMap((question) => question.options),
  ].map((item) => item.id);
  if (duplicates(ids)) issue('content', 'Item ids must be unique');
  return issues;
}

export function unitReviewIssues(content) {
  const issues = [];
  const { issue, required } = issueChecks(issues, new Map());
  const checkQuestion = (spec, question, path) => {
    if (spec.question.prompt) required(`${path}.prompt`, question.prompt);
    required(`${path}.explanation`, question.explanation);
    if (question.options.length !== spec.optionCount)
      issue(`${path}.options`, `Exactly ${spec.optionCount} options are required`);
    if (question.options.filter((option) => option.isCorrect).length !== 1)
      issue(`${path}.options`, 'Exactly one option must be correct');
    const texts = question.options.map((option) => lower(option.text));
    if (texts.some((value) => !value)) issue(`${path}.options`, 'Every option needs text');
    else if (duplicates(texts)) issue(`${path}.options`, 'Options must be different');
  };
  const spec5 = LESSON_TEST_PARTS.find((part) => part.key === 'part5');
  const part5 = content.test.part5;
  if (part5.questions.length !== UNIT_REVIEW_PART_COUNTS.part5)
    issue('test.part5.questions', `Part 5 needs exactly ${UNIT_REVIEW_PART_COUNTS.part5} questions`);
  part5.questions.forEach((question, index) => checkQuestion(spec5, question, `test.part5.questions[${index}]`));

  const spec6 = LESSON_TEST_PARTS.find((part) => part.key === 'part6');
  const part6 = content.test.part6;
  if (part6.groups.length !== UNIT_REVIEW_PASSAGE_COUNT)
    issue('test.part6.groups', `Part 6 needs exactly ${UNIT_REVIEW_PASSAGE_COUNT} passages`);
  part6.groups.forEach((group, index) => {
    const path = `test.part6.groups[${index}]`;
    const count = part6.questions.filter((question) => question.groupId === group.id).length;
    required(`${path}.passage`, group.passage);
    if (count !== UNIT_REVIEW_PASSAGE_QUESTIONS) issue(path, `The passage needs exactly ${UNIT_REVIEW_PASSAGE_QUESTIONS} questions`);
    if (group.passage && countBlanks(group.passage) !== UNIT_REVIEW_PASSAGE_QUESTIONS)
      issue(`${path}.passage`, `The passage needs exactly ${UNIT_REVIEW_PASSAGE_QUESTIONS} blanks (${FILL_IN_BLANK})`);
  });
  part6.questions.forEach((question, index) => {
    const path = `test.part6.questions[${index}]`;
    if (!part6.groups.some((group) => group.id === question.groupId)) issue(path, 'The question does not belong to a passage');
    checkQuestion(spec6, question, path);
  });

  const parts = Object.values(content.test);
  const questions = parts.flatMap((part) => part.questions);
  const ids = [...parts.flatMap((part) => part.groups), ...questions, ...questions.flatMap((question) => question.options)].map((item) => item.id);
  if (duplicates(ids)) issue('content', 'Item ids must be unique');
  return issues;
}

export function mockFullStructureIssues(test) {
  const issues = [];
  const add = (path, message) => issues.push({ path, message });
  const numberOf = (key) => LESSON_TEST_PARTS.find((spec) => spec.key === key).number;
  for (const [key, count] of Object.entries(MOCK_TEST_PART_COUNTS)) {
    const found = test[key].questions.length;
    if (found !== count) add(`test.${key}.questions`, `A full test needs exactly ${count} questions in Part ${numberOf(key)}; it has ${found}`);
  }
  const sizes = (key) => test[key].groups.map((group) => test[key].questions.filter((question) => question.groupId === group.id).length);
  for (const [key, spec] of Object.entries(MOCK_FULL_GROUPS)) {
    const found = sizes(key);
    const noun = key === 'part6' ? 'passages' : key === 'part3' ? 'conversations' : 'talks';
    if (found.length !== spec.groups || found.some((size) => size !== spec.questions))
      add(`test.${key}.groups`, `A full test needs ${spec.groups} ${noun} of ${spec.questions} questions in Part ${numberOf(key)}`);
  }
  const part7 = sizes('part7');
  const singles = part7.slice(0, MOCK_FULL_PART7.singles);
  const sets = part7.slice(MOCK_FULL_PART7.singles);
  const singleTotal = singles.reduce((sum, size) => sum + size, 0);
  if (
    part7.length !== MOCK_FULL_PART7.singles + MOCK_FULL_PART7.sets ||
    singles.some((size) => size < MOCK_FULL_PART7.singleMin || size > MOCK_FULL_PART7.singleMax) ||
    singleTotal !== MOCK_FULL_PART7.singleQuestions ||
    sets.some((size) => size !== MOCK_FULL_PART7.setQuestions)
  )
    add(
      'test.part7.groups',
      `A full test needs ${MOCK_FULL_PART7.singles} single passages (${MOCK_FULL_PART7.singleMin}–${MOCK_FULL_PART7.singleMax} questions each, ${MOCK_FULL_PART7.singleQuestions} in all) followed by ${MOCK_FULL_PART7.sets} sets of ${MOCK_FULL_PART7.setQuestions} questions in Part 7`,
    );
  return issues;
}
