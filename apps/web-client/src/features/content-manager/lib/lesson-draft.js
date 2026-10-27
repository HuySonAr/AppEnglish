import { LESSON_TEST_PARTS, countBlanks } from '@appenglish/content-contracts';

const newId = () => crypto.randomUUID();

export function newVocabulary() {
  return {
    id: newId(),
    word: '',
    partOfSpeech: '',
    phonetic: '',
    audioUkMediaId: null,
    audioUsMediaId: null,
    meaning: '',
    example: '',
    exampleMeaning: '',
  };
}

function newOption() {
  return { id: newId(), text: '', audioMediaId: null, transcript: '', isCorrect: false };
}

function newQuestion() {
  return {
    id: newId(),
    prompt: '',
    audioMediaId: null,
    transcript: '',
    imageMediaId: null,
    options: [],
    explanation: '',
  };
}

function sized(list, count, make) {
  return Array.from({ length: count }, (_, index) => list[index] ?? make());
}

function normalizePart(spec, part = {}) {
  return {
    audioMediaId: part.audioMediaId ?? null,
    transcript: part.transcript ?? '',
    passage: part.passage ?? '',
    imageMediaId: part.imageMediaId ?? null,
    questions: sized(part.questions || [], spec.questionCount, newQuestion).map((question) => ({
      ...newQuestion(),
      ...question,
      options: sized(question.options || [], spec.optionCount, newOption).map((option) => ({
        ...newOption(),
        ...option,
      })),
    })),
  };
}

export function withFillInPassage(fillIn, passage) {
  return { passage, answers: sized(fillIn.answers || [], countBlanks(passage), () => '') };
}

export function normalizeContent(content = {}) {
  return {
    vocabulary: (content.vocabulary || []).map((item) => ({ ...newVocabulary(), ...item })),
    fillIn: withFillInPassage(content.fillIn || {}, content.fillIn?.passage ?? ''),
    test: Object.fromEntries(
      LESSON_TEST_PARTS.map((spec) => [spec.key, normalizePart(spec, content.test?.[spec.key])]),
    ),
  };
}

export function emptyContent() {
  return normalizeContent();
}

export function workingContent(lessonData) {
  return normalizeContent(
    structuredClone(lessonData?.draft?.content || lessonData?.published?.content || {}),
  );
}

export function workingPlacement(placementData) {
  const source = placementData?.draft?.content || placementData?.published?.content || {};
  return { test: normalizeContent(structuredClone(source)).test };
}

export function lessonState(lessonData) {
  return {
    hasDraft: Boolean(lessonData?.draft),
    draftVersion: lessonData?.draft?.versionNumber ?? null,
    publishedVersion: lessonData?.published?.versionNumber ?? null,
    draftStatus: lessonData?.draft?.status ?? null,
    reviewNote: lessonData?.draft?.reviewNote ?? null,
  };
}

export function withCorrectOption(question, optionId) {
  return {
    ...question,
    options: question.options.map((option) => ({
      ...option,
      isCorrect: option.id === optionId,
    })),
  };
}

export function setIn(value, path, next) {
  if (!path.length) return next;
  const [key, ...rest] = path;
  const copy = Array.isArray(value) ? [...value] : { ...value };
  copy[key] = setIn(value[key], rest, next);
  return copy;
}

const fieldLabels = {
  audioMediaId: 'audio',
  audioUkMediaId: 'UK audio',
  audioUsMediaId: 'US audio',
  imageMediaId: 'image',
  exampleMeaning: 'example meaning',
  partOfSpeech: 'part of speech',
};
const optionLetters = ['A', 'B', 'C', 'D'];

export function issueLabel(path) {
  let firstQuestionNumber = 1;
  return path
    .split('.')
    .map((token) => {
      const [, name, index] = /^(\w+?)(?:\[(\d+)\])?$/.exec(token) || [null, token];
      const number = index === undefined ? '' : ` ${Number(index) + 1}`;
      if (name === 'test') return null;
      if (name === 'vocabulary') return index === undefined ? 'Vocabulary' : `Word${number}`;
      if (name === 'fillIn') return 'Fill-in';
      if (name === 'answers') return index === undefined ? 'answers' : `blank${number}`;
      if (/^part\d$/.test(name)) {
        firstQuestionNumber = LESSON_TEST_PARTS.find((part) => part.key === name)?.firstQuestionNumber ?? 1;
        return `Part ${name.slice(4)}`;
      }
      if (name === 'questions')
        return index === undefined ? 'questions' : `question ${firstQuestionNumber + Number(index)}`;
      if (name === 'options') return index === undefined ? 'options' : `option ${optionLetters[index]}`;
      return fieldLabels[name] || name;
    })
    .filter(Boolean)
    .join(' · ');
}

export function issueLocation(path) {
  if (path.startsWith('fillIn')) return { tab: 'fillIn' };
  const part = /^test\.(part\d)/.exec(path)?.[1];
  if (part) return { tab: 'test', part };
  return { tab: 'vocabulary' };
}

export async function uploadPending(content, pending, upload) {
  let text = JSON.stringify(content);
  const uploaded = {};
  let error = null;
  for (const [temporaryId, item] of Object.entries(pending)) {
    if (!text.includes(temporaryId)) continue;
    try {
      const media = await upload(item);
      text = text.replaceAll(temporaryId, media.id);
      uploaded[temporaryId] = media;
    } catch (failure) {
      error = failure;
      break;
    }
  }
  return { content: JSON.parse(text), uploaded, error };
}
