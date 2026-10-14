import {
  LESSON_TEST_PARTS,
  MOCK_GROUP_AUDIO_PARTS,
  MOCK_SET_QUESTION_COUNT,
  MOCK_TEST_PART_COUNTS,
} from '@appenglish/content-contracts';
import { PASSAGE_MAX_LENGTH, pastedQuestionProblems, withPastedText } from './question-paste.js';

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

// Parts whose questions can be filled from pasted text (D73-D76).
export const MOCK_PASTE_PARTS = Object.freeze(['part3', 'part4', 'part5', 'part6', 'part7']);

// Where pasted questions (parsePastedQuestions) go in Part 3, 4 or 5, and
// what is wrong with them. A question goes to the place its number has in a
// full test: 38 is the first question of conversation 3, 103 the third
// question of Part 5. Each row is the question with `set` (0-based; null in a
// part without sets), `place` in the set or the part, `replaces` (that place
// already holds text), `errors` and `warnings`.
export function pastePreview(part, spec, pasted) {
  const first = MOCK_FIRST_QUESTION_NUMBERS[spec.key];
  const last = first + MOCK_TEST_PART_COUNTS[spec.key] - 1;
  const inSets = MOCK_GROUP_AUDIO_PARTS.includes(spec.key);
  return pasted.map((item, index) => {
    const offset = item.number - first;
    const set = inSets ? Math.floor(offset / MOCK_SET_QUESTION_COUNT) : null;
    const place = inSets ? offset % MOCK_SET_QUESTION_COUNT : offset;
    const existing = inSets
      ? part.questions.filter((question) => question.groupId === part.groups[set]?.id)[place]
      : part.questions[place];
    const { errors, warnings } = pastedQuestionProblems(item, spec);
    if (item.number < first || item.number > last) errors.unshift(`Part ${spec.number} holds questions ${first}–${last}`);
    if (pasted.findIndex((other) => other.number === item.number) !== index) errors.push('this number appears twice');
    return {
      ...item,
      set,
      place,
      replaces: Boolean(existing && (existing.prompt || existing.options.some((option) => option.text))),
      errors,
      warnings,
    };
  });
}

// Writes pasted questions into a part at the places pastePreview gives,
// adding what is missing before them: conversations or talks and their
// questions in Parts 3-4, blank questions in Part 5. A question already there
// keeps its explanation and graphic; its text, options and correct answer are
// replaced.
export function withPastedQuestions(part, spec, pasted) {
  let next = part;
  for (const item of pastePreview(part, spec, pasted)) {
    let groupId = null;
    if (item.set !== null) {
      while (next.groups.length <= item.set) next = withGroup(next);
      groupId = next.groups[item.set].id;
    }
    const siblings = () =>
      groupId ? next.questions.filter((question) => question.groupId === groupId) : next.questions;
    while (siblings().length <= item.place) next = withQuestion(next, spec, groupId);
    const target = siblings()[item.place];
    next = {
      ...next,
      questions: next.questions.map((question) => (question === target ? withPastedText(question, item) : question)),
    };
  }
  return next;
}

// The part with a pasted passage as its set number `set`, or as a new last
// set when set is -1. The set gets the passage and exactly the pasted
// questions; questions already there are reused in order.
function withPastedPassage(part, spec, set, item) {
  let next = set === -1 ? withGroup(part) : part;
  const groupId = next.groups.at(set).id;
  const ofSet = () => next.questions.filter((question) => question.groupId === groupId);
  for (const extra of ofSet().slice(item.questions.length)) next = withoutQuestion(next, extra.id);
  while (ofSet().length < item.questions.length) next = withQuestion(next, spec, groupId);
  const targets = ofSet();
  return {
    ...next,
    groups: next.groups.map((group) => (group.id === groupId ? { ...group, passage: item.passage } : group)),
    questions: next.questions.map((question) =>
      targets.includes(question) ? withPastedText(question, item.questions[targets.indexOf(question)]) : question,
    ),
  };
}

// What pasting passages (parsePastedPassages) into Part 6 or 7 does: `part`
// is the part with every passage that has no error written in, `rows` the
// passages with `set` (0-based), `replaces`, `errors` and `warnings`. These
// parts number their questions in order, so a passage replaces the one that
// starts at its first number, or is added when it starts right after the
// last question.
export function pastedPassagesPlan(part, spec, passages) {
  const first = MOCK_FIRST_QUESTION_NUMBERS[spec.key];
  const target = MOCK_TEST_PART_COUNTS[spec.key];
  let next = part;
  const rows = passages.map((item) => {
    const numbers = Array.from({ length: Math.max(item.to - item.from + 1, 0) }, (_, index) => item.from + index);
    const same = (list) => list.length === numbers.length && list.every((number, index) => number === numbers[index]);
    // The number each set starts at, to find the one this passage is.
    let number = first;
    let set = -1;
    next.groups.forEach((group, index) => {
      if (set === -1 && number === item.from) set = index;
      number += next.questions.filter((question) => question.groupId === group.id).length;
    });
    const errors = [];
    const warnings = [];
    if (!numbers.length || item.from < first || item.to >= first + target)
      errors.push(`Part ${spec.number} holds questions ${first}–${first + target - 1}`);
    else if (set === -1 && item.from !== number)
      errors.push(`questions ${item.from}–${item.to} do not follow what Part ${spec.number} holds: the next passage starts at question ${number}`);
    if (!item.passage) errors.push('no passage text');
    else if (item.passage.length > PASSAGE_MAX_LENGTH) errors.push(`passage longer than ${PASSAGE_MAX_LENGTH} characters`);
    else if (spec.group.blanks && !item.blanks.length) errors.push(`no blank such as [${item.from}] in the passage`);
    else if (spec.group.blanks && !same(item.blanks)) errors.push(`the blanks in the passage are ${item.blanks.join(', ')}, not ${item.from}–${item.to}`);
    if (!same(item.questions.map((question) => question.number)))
      errors.push(`the questions found are ${item.questions.map((question) => question.number).join(', ') || 'none'}, not ${item.from}–${item.to}`);
    for (const question of item.questions) {
      const problems = pastedQuestionProblems(question, spec);
      errors.push(...problems.errors.map((problem) => `question ${question.number}: ${problem}`));
      warnings.push(...problems.warnings.map((problem) => `question ${question.number}: ${problem}`));
    }
    const row = { ...item, set: set === -1 ? next.groups.length : set, replaces: set !== -1, errors, warnings };
    if (errors.length) return row;
    const written = withPastedPassage(next, spec, set, item);
    if (written.questions.length > target) errors.push(`Part ${spec.number} cannot hold more than ${target} questions`);
    else next = written;
    return row;
  });
  return { part: next, rows };
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
