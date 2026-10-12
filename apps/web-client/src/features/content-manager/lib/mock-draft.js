import {
  LESSON_TEST_PARTS,
  MOCK_GROUP_AUDIO_PARTS,
  MOCK_SET_QUESTION_COUNT,
  MOCK_TEST_PART_COUNTS,
} from '@appenglish/content-contracts';

const newId = () => crypto.randomUUID();

function newOption() {
  return { id: newId(), text: '', audioMediaId: null, transcript: '', isCorrect: false };
}

// A blank question of the given part; groupId ties it to its set: a recording
// (Parts 3-4) or a passage (Parts 6-7).
export function newMockQuestion(spec, groupId = null) {
  return {
    id: newId(),
    prompt: '',
    audioMediaId: null,
    transcript: '',
    imageMediaId: null,
    groupId,
    options: Array.from({ length: spec.optionCount }, newOption),
    explanation: '',
  };
}

export function newMockGroup() {
  return { id: newId(), audioMediaId: null, transcript: '', passage: '', imageMediaId: null };
}

// The mock test as the editor works on it: the draft, else a copy of the
// published version, with every part present and every question holding its
// part's number of options.
export function workingMock(mockData) {
  const source = structuredClone(mockData?.draft?.content || mockData?.published?.content || {});
  return {
    test: Object.fromEntries(
      LESSON_TEST_PARTS.map((spec) => {
        const part = source.test?.[spec.key] || {};
        const working = {
          audioMediaId: part.audioMediaId ?? null,
          transcript: part.transcript ?? '',
          passage: part.passage ?? '',
          imageMediaId: part.imageMediaId ?? null,
          groups: (part.groups || []).map((group) => ({ ...newMockGroup(), ...group })),
          questions: (part.questions || []).map((question) => ({
            ...newMockQuestion(spec),
            ...question,
            options: Array.from({ length: spec.optionCount }, (_, index) => ({
              ...newOption(),
              ...question.options?.[index],
            })),
          })),
        };
        // Before D71 the graphic of a conversation or talk was kept on the
        // set; it now belongs to one of its questions.
        if (MOCK_GROUP_AUDIO_PARTS.includes(spec.key))
          for (const group of working.groups) {
            const question = graphicQuestion(working, group.id);
            if (!group.imageMediaId || !question) continue;
            question.imageMediaId ??= group.imageMediaId;
            group.imageMediaId = null;
          }
        return [spec.key, working];
      }),
    ),
  };
}

// The question that holds the graphic of a conversation or talk (Parts 3-4):
// the one that has it, else the middle one, where the "Look at the graphic"
// question usually is. null for a set without questions.
export function graphicQuestion(part, groupId) {
  const questions = part.questions.filter((question) => question.groupId === groupId);
  return (
    questions.find((question) => question.imageMediaId) ||
    questions[Math.floor((questions.length - 1) / 2)] ||
    null
  );
}

// Moves the graphic of a set to another of its questions.
export function withGraphicOn(part, groupId, questionId) {
  const imageMediaId = graphicQuestion(part, groupId)?.imageMediaId ?? null;
  return {
    ...part,
    questions: part.questions.map((question) =>
      question.groupId === groupId
        ? { ...question, imageMediaId: question.id === questionId ? imageMediaId : null }
        : question,
    ),
  };
}

// Adds a question to a part; with a group, right after that group's last
// question so the questions of a passage stay together.
export function withQuestion(part, spec, groupId = null) {
  const question = newMockQuestion(spec, groupId);
  if (!groupId) return { ...part, questions: [...part.questions, question] };
  const groupIds = part.groups.map((group) => group.id);
  const position = part.questions.findIndex(
    (item) => groupIds.indexOf(item.groupId) > groupIds.indexOf(groupId),
  );
  const questions = [...part.questions];
  questions.splice(position === -1 ? questions.length : position, 0, question);
  return { ...part, questions };
}

export function withoutQuestion(part, questionId) {
  return { ...part, questions: part.questions.filter((question) => question.id !== questionId) };
}

export function withGroup(part) {
  return { ...part, groups: [...part.groups, newMockGroup()] };
}

// Removing a set removes its questions too.
export function withoutGroup(part, groupId) {
  return {
    ...part,
    groups: part.groups.filter((group) => group.id !== groupId),
    questions: part.questions.filter((question) => question.groupId !== groupId),
  };
}

export function mockQuestionCount(content) {
  return Object.values(content.test).reduce((sum, part) => sum + part.questions.length, 0);
}

// The number of each part's first question in a full test, where questions
// run from 1 to 200 across the parts: Part 1 starts at 1, Part 2 at 7, Part 3
// at 32... The editor numbers by these places, so a number does not change
// while the parts before it are still being written.
export const MOCK_FIRST_QUESTION_NUMBERS = Object.freeze(
  Object.fromEntries(
    LESSON_TEST_PARTS.map((spec, index) => [
      spec.key,
      1 + LESSON_TEST_PARTS.slice(0, index).reduce((sum, earlier) => sum + MOCK_TEST_PART_COUNTS[earlier.key], 0),
    ]),
  ),
);

// The number in the whole test of the question at `index` of a part. In Parts
// 3 and 4 every conversation or talk keeps its three numbers (conversation 2
// is always 35-37), whatever the sets before it hold so far; elsewhere the
// questions of a part are numbered in order.
export function mockQuestionNumber(spec, part, index) {
  const first = MOCK_FIRST_QUESTION_NUMBERS[spec.key];
  const question = part.questions[index];
  const set = part.groups.findIndex((group) => group.id === question?.groupId);
  if (!MOCK_GROUP_AUDIO_PARTS.includes(spec.key) || set === -1) return first + index;
  const place = part.questions.filter((item) => item.groupId === question.groupId).indexOf(question);
  return first + set * MOCK_SET_QUESTION_COUNT + place;
}

// "Part 6 · set 2 · passage" or "Part 5 · question 103 · options" for a
// publish issue path such as "test.part6.groups[1].passage" or
// "test.part5.questions[2].options". content is the mock test the path is
// about: it gives questions the number they have in the editor.
export function mockIssueLabel(path, content) {
  const labels = { audioMediaId: 'audio', imageMediaId: 'image', prompt: 'question text' };
  let spec = null;
  return path
    .split('.')
    .map((token) => {
      const [, name, index] = /^(\w+?)(?:\[(\d+)\])?$/.exec(token) || [null, token];
      const number = index === undefined ? '' : ` ${Number(index) + 1}`;
      if (name === 'test') return null;
      if (/^part\d$/.test(name)) {
        spec = LESSON_TEST_PARTS.find((part) => part.key === name);
        return `Part ${name.slice(4)}`;
      }
      if (name === 'groups') return index === undefined ? 'sets' : `set${number}`;
      if (name === 'questions')
        return index === undefined
          ? 'questions'
          : `question ${mockQuestionNumber(spec, content.test[spec.key], Number(index))}`;
      return labels[name] || name;
    })
    .filter(Boolean)
    .join(' · ');
}
