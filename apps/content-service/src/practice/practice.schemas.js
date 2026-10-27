import { z } from 'zod';
import { DEFAULT_PRACTICE_LEVEL, ETS_SET_QUESTIONS, ETS_SET_TASKS, EtsSpeakingTask, EtsWritingTask, PRACTICE_LIMITS, PRACTICE_LEVELS, PracticePromptKind, VoiceSpeed, WritingTaskType, practiceLevelOf } from '@appenglish/content-contracts';

const text = (max) => z.string().trim().max(max).default('');
const mediaId = z.string().uuid().nullable().default(null);
const keyPoints = z.preprocess(
  (value) => (Array.isArray(value) ? value.filter((item) => typeof item !== 'string' || item.trim()) : value),
  z.array(z.string().trim().min(1).max(PRACTICE_LIMITS.keyPoint)).max(PRACTICE_LIMITS.keyPoints).default([]),
);

const setQuestion = z
  .object({ text: text(PRACTICE_LIMITS.question), sampleAnswer: text(PRACTICE_LIMITS.sampleAnswer), audioMediaId: mediaId })
  .strict();
const openTasks = Object.values(EtsSpeakingTask).filter((task) => task !== EtsSpeakingTask.READ_ALOUD);

const common = {
  title: text(PRACTICE_LIMITS.title),
  level: z.preprocess((value) => practiceLevelOf(value) ?? value, z.enum(PRACTICE_LEVELS)).default(DEFAULT_PRACTICE_LEVEL),
  topic: text(PRACTICE_LIMITS.topic),
};

export const practiceContentSchemas = Object.freeze({
  [PracticePromptKind.READ_ALOUD]: z
    .object({ ...common, etsTask: z.literal(EtsSpeakingTask.READ_ALOUD).default(EtsSpeakingTask.READ_ALOUD), text: text(PRACTICE_LIMITS.readAloudText), audioMediaId: mediaId })
    .strict(),
  [PracticePromptKind.OPEN_SPEAKING]: z
    .object({
      ...common,
      etsTask: z.enum(openTasks).nullable().default(null),
      instructions: text(PRACTICE_LIMITS.instructions),
      context: text(PRACTICE_LIMITS.context),
      info: text(PRACTICE_LIMITS.info),
      questions: z.array(setQuestion).max(ETS_SET_QUESTIONS).default([]),
      imageMediaId: mediaId,
      maxSeconds: z.number().int().min(PRACTICE_LIMITS.speakingSeconds.min).max(PRACTICE_LIMITS.speakingSeconds.max).default(60),
      sampleAnswer: text(PRACTICE_LIMITS.sampleAnswer),
      keyPoints,
    })
    .strict(),
  [PracticePromptKind.WRITING]: z
    .object({
      ...common,
      taskType: z.enum(Object.values(WritingTaskType)).default(WritingTaskType.PARAGRAPH),
      etsTask: z.enum(Object.values(EtsWritingTask)).nullable().default(null),
      keywords: z.array(z.string().trim().max(PRACTICE_LIMITS.keyword)).max(PRACTICE_LIMITS.keywords).default([]),
      email: text(PRACTICE_LIMITS.email),
      instructions: text(PRACTICE_LIMITS.instructions),
      imageMediaId: mediaId,
      minWords: z.number().int().min(PRACTICE_LIMITS.words.min).max(PRACTICE_LIMITS.words.max).default(80),
      maxWords: z.number().int().min(PRACTICE_LIMITS.words.min).max(PRACTICE_LIMITS.words.max).default(150),
      sampleAnswer: text(PRACTICE_LIMITS.sampleAnswer),
      keyPoints,
    })
    .strict(),
});

export const practiceCreateSchema = z.object({ kind: z.enum(Object.values(PracticePromptKind)) }).strict();
export const practiceDraftSchema = z.object({ content: z.record(z.any()) }).strict();
export const practiceReturnSchema = z.object({ note: z.string().trim().min(1).max(PRACTICE_LIMITS.reviewNote) }).strict();
export const practiceListSchema = z.object({ status: z.string().max(20).optional() }).strict();

const countWords = (value) => (value.trim() ? value.trim().split(/\s+/).length : 0);

export function practiceIssues(kind, content) {
  const issues = [];
  const need = (path, ok, message) => {
    if (!ok) issues.push({ path, message });
  };
  need('title', content.title, 'Required');
  need('topic', content.topic, 'Required');
  if (kind === PracticePromptKind.READ_ALOUD) need('text', content.text, 'Required');
  const set = ETS_SET_TASKS.includes(content.etsTask);
  if (kind !== PracticePromptKind.READ_ALOUD) {
    need('etsTask', content.etsTask, 'Choose a task type');
    if (!set) {
      need('instructions', content.instructions, 'Required');
      need('sampleAnswer', content.sampleAnswer, 'Required');
    }
  }
  if (content.etsTask === EtsSpeakingTask.DESCRIBE_PICTURE || content.etsTask === EtsWritingTask.PICTURE_SENTENCE) need('imageMediaId', content.imageMediaId, 'Add a picture');
  if (content.etsTask === EtsSpeakingTask.RESPOND_QUESTIONS) need('context', content.context, 'Required');
  if (content.etsTask === EtsSpeakingTask.RESPOND_INFO) need('info', content.info, 'Required');
  if (set) {
    need('questions', content.questions.length === ETS_SET_QUESTIONS, `Add exactly ${ETS_SET_QUESTIONS} questions`);
    content.questions.forEach((question, index) => {
      need(`questions[${index}].text`, question.text, 'Required');
      need(`questions[${index}].sampleAnswer`, question.sampleAnswer, 'Required');
    });
  }
  if (content.etsTask === EtsWritingTask.PICTURE_SENTENCE)
    need('keywords', content.keywords.length === PRACTICE_LIMITS.keywords && content.keywords.every(Boolean), `Add ${PRACTICE_LIMITS.keywords} words to use`);
  if (content.etsTask === EtsWritingTask.RESPOND_EMAIL) need('email', content.email, 'Required');
  if (kind === PracticePromptKind.WRITING) {
    need('maxWords', content.maxWords >= content.minWords, 'The most words must be at least the fewest');
    const words = countWords(content.sampleAnswer || '');
    need('sampleAnswer', !content.sampleAnswer || (words >= content.minWords && words <= content.maxWords), `The sample answer must have ${content.minWords} to ${content.maxWords} words`);
  }
  return issues;
}

export function practiceMediaIds(content) {
  return [content?.audioMediaId, content?.imageMediaId, ...(content?.questions || []).map((question) => question.audioMediaId)].filter(Boolean);
}

export const practiceMachineAudioSchema = z.object({ text: z.string().trim().min(1).max(PRACTICE_LIMITS.readAloudText), speed: z.enum(Object.values(VoiceSpeed)).default(VoiceSpeed.NORMAL) }).strict();

export const learnerRecordingsSchema = z
  .object({
    recordings: z
      .array(z.object({ storage: z.enum(['local', 'imagekit', 'r2']), storageId: z.string().min(1).max(500) }).strict())
      .max(100),
  })
  .strict();
