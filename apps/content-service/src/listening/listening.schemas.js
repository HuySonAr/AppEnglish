import { z } from 'zod';
import {
  LISTENING_LEVELS,
  LISTENING_MAX_SEGMENTS,
  LISTENING_KINDS,
  LISTENING_SEGMENT_MAX_LENGTH,
  ListeningFormat,
  MediaKind,
  lyricPieces,
} from '@appenglish/content-contracts';

const text = (max) => z.string().trim().max(max);
const requiredText = (max) => text(max).min(1);
// A time in the recording, in seconds (one decimal is enough to cut a sentence).
const seconds = z.number().min(0).max(3 * 60 * 60).nullable().default(null);

// format: how the topic's exercises are written (D88); null for not yet.
const topicFormat = z.enum(Object.values(ListeningFormat)).nullable();
export const markJobsSeenSchema = z.object({ ids: z.array(z.string().uuid()).max(100).optional() }).strict();

export const markNoticesReadSchema = z.object({ ids: z.array(z.string().min(1).max(160)).max(100).optional() }).strict();

export const mockTranscribeSchema = z.object({ audioMediaId: z.string().uuid() }).strict();

export const listeningTopicCreateSchema = z.object({ name: requiredText(100), format: topicFormat.default(null) }).strict();
export const listeningTopicUpdateSchema = z
  .object({ name: requiredText(100).optional(), format: topicFormat.optional() })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });

const level = z.enum(LISTENING_LEVELS);
const exerciseTitle = requiredText(200);
export const listeningExerciseCreateSchema = z
  .object({
    topicId: z.string().uuid(),
    title: exerciseTitle,
    level,
    kind: z.enum(Object.values(LISTENING_KINDS).flat().map((kind) => kind.key)),
  })
  .strict();
export const listeningExerciseUpdateSchema = z
  .object({ title: exerciseTitle.optional(), level: level.optional() })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: 'At least one field is required',
  });

// One piece of the transcript the learner writes down: a sentence of a
// conversation or talk, a statement of Part 1, the question or a response of
// Part 2. speaker is an optional label such as "Man" (Part 3).
const segmentSchema = z
  .object({
    id: z.string().uuid().optional(),
    speaker: text(40).default(''),
    text: text(LISTENING_SEGMENT_MAX_LENGTH).default(''),
    start: seconds,
    end: seconds,
    translation: text(1000).default(''),
  })
  .strict();

const sourceSchema = z
  .object({
    name: text(100).default(''),
    url: z.union([z.string().trim().url().max(500), z.literal('')]).default(''),
  })
  .strict();

export const listeningContentSchema = z
  .object({
    audioMediaId: z.string().uuid().nullable().default(null),
    segments: z.array(segmentSchema).max(LISTENING_MAX_SEGMENTS).default([]),
    source: sourceSchema.default({}),
  })
  .strict();

// An answer of speech-service (D97, D98), read from speech.autotime.results:
// lines are timed lines of the exercise (align: id and matched) or new lines
// heard in the recording (transcribe: text). Extra fields are ignored so
// speech-service can add some.
export const autoTimeResultSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['RUNNING', 'DONE', 'FAILED']),
  lines: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        text: z.string().optional(),
        start: z.number().min(0).nullable(),
        end: z.number().min(0).nullable(),
        matched: z.number().min(0).max(1).optional(),
      }),
    )
    .max(1000)
    .optional(),
  error: z.string().max(2000).optional(),
});

export function listeningMediaIds(content) {
  return [content.audioMediaId].filter(Boolean);
}

// Returns the reasons a listening-exercise draft cannot be published; empty
// when it can. kind is the exercise's entry of LISTENING_KINDS and
// mediaById maps existing media ids to their rows.
export function listeningIssues(content, kind, mediaById) {
  const issues = [];
  const issue = (path, message) => issues.push({ path, message });
  if (!content.audioMediaId) issue('audioMediaId', 'Audio is required');
  else if (mediaById.get(content.audioMediaId)?.kind !== MediaKind.AUDIO)
    issue('audioMediaId', 'Media asset is missing or is not audio');
  const { segments } = content;
  if (kind.segmentCount && segments.length !== kind.segmentCount)
    issue('segments', `Part ${kind.number} has exactly ${kind.segmentCount} sentences to write down`);
  if (!segments.length) issue('segments', 'At least one sentence is required');
  let previousStart = -1;
  segments.forEach((segment, index) => {
    const path = `segments[${index}]`;
    if (!segment.text) issue(`${path}.text`, 'Required');
    // Songs: blanks are words in square brackets (D88).
    if (kind.key === 'song' && segment.text) {
      const pieces = lyricPieces(segment.text);
      if (pieces.some((piece) => 'blank' in piece && !piece.blank)) issue(`${path}.text`, 'A blank [ ] needs the word inside');
      else if (pieces.some((piece) => 'text' in piece && /[[\]]/.test(piece.text)))
        issue(`${path}.text`, 'A bracket is not closed: write a blank as [word]');
    }
    const timed = segment.start !== null || segment.end !== null;
    // Parts 3 and 4 are written down sentence by sentence, each replayed alone.
    if (kind.timed && !timed) issue(`${path}.start`, 'Start and end in the recording are required');
    else if (timed) {
      if (segment.start === null || segment.end === null) issue(`${path}.start`, 'Give both the start and the end');
      else if (segment.end <= segment.start) issue(`${path}.end`, 'The end must come after the start');
      else if (segment.start < previousStart) issue(`${path}.start`, 'Sentences must follow the order of the recording');
      if (segment.start !== null) previousStart = segment.start;
    }
  });
  const ids = segments.map((segment) => segment.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) issue('segments', 'Sentence ids must be unique');
  return issues;
}
