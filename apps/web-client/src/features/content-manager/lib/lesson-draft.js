import { LESSON_TEST_PARTS, countBlanks } from '@appenglish/content-contracts';

// New items get a client id: the API keeps ids it is sent, so the same id
// serves as the React key before and after saving.
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

// Resizes a list to exactly count items, keeping the existing ones.
function sized(list, count, make) {
  return Array.from({ length: count }, (_, index) => list[index] ?? make());
}

// A part always shows its fixed number of questions and options (D45), so the
// editor only ever fills them in.
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

// Keeps one answer per blank of the passage.
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

// The editor starts from the draft, or from the published version when there
// is no draft yet (saving then creates the next version).
export function workingContent(lessonData) {
  return normalizeContent(
    structuredClone(lessonData?.draft?.content || lessonData?.published?.content || {}),
  );
}

// The placement test is edited like a lesson test: the draft, else a copy of
// the published version, with every part and question slot present.
export function workingPlacement(placementData) {
  const source = placementData?.draft?.content || placementData?.published?.content || {};
  return { test: normalizeContent(structuredClone(source)).test };
}

export function lessonState(lessonData) {
  return {
    hasDraft: Boolean(lessonData?.draft),
    draftVersion: lessonData?.draft?.versionNumber ?? null,
    publishedVersion: lessonData?.published?.versionNumber ?? null,
  };
}

// Marks one option as the single correct answer of its question.
export function withCorrectOption(question, optionId) {
  return {
    ...question,
    options: question.options.map((option) => ({
      ...option,
      isCorrect: option.id === optionId,
    })),
  };
}

// Returns a copy of value with the item at path replaced, e.g.
// setIn(content, ['test', 'part1', 'questions', 0, 'prompt'], 'Hi').
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

// Turns a publish issue path such as "test.part1.questions[0].options[1].audioMediaId"
// into "Part 1 · question 1 · option B · audio". Questions carry their number
// in the whole test (1-23).
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

// Where a publish issue is edited: the editor tab and, for the test, the part.
export function issueLocation(path) {
  if (path.startsWith('fillIn')) return { tab: 'fillIn' };
  const part = /^test\.(part\d)/.exec(path)?.[1];
  if (part) return { tab: 'test', part };
  return { tab: 'vocabulary' };
}

// Files chosen in the editor stay in the browser until the lesson is saved:
// the content refers to them by a temporary id (the key of `pending`, whose
// values are { kind, file, section }). This uploads the ones the content still uses and
// swaps in the real media ids. On a failed upload it stops and returns the
// error together with the content and the uploads done so far, so a retry does
// not upload those again.
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
