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

export function graphicQuestion(part, groupId) {
  const questions = part.questions.filter((question) => question.groupId === groupId);
  return (
    questions.find((question) => question.imageMediaId) ||
    questions[Math.floor((questions.length - 1) / 2)] ||
    null
  );
}

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

export const MOCK_FIRST_QUESTION_NUMBERS = Object.freeze(
  Object.fromEntries(
    LESSON_TEST_PARTS.map((spec, index) => [
      spec.key,
      1 + LESSON_TEST_PARTS.slice(0, index).reduce((sum, earlier) => sum + MOCK_TEST_PART_COUNTS[earlier.key], 0),
    ]),
  ),
);

export function mockQuestionNumber(spec, part, index) {
  const first = MOCK_FIRST_QUESTION_NUMBERS[spec.key];
  const question = part.questions[index];
  const set = part.groups.findIndex((group) => group.id === question?.groupId);
  if (!MOCK_GROUP_AUDIO_PARTS.includes(spec.key) || set === -1) return first + index;
  const place = part.questions.filter((item) => item.groupId === question.groupId).indexOf(question);
  return first + set * MOCK_SET_QUESTION_COUNT + place;
}

export const MOCK_PASTE_PARTS = Object.freeze(['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7']);

const spokenLetters = 'ABCD';

export function spokenTranscript(item) {
  return [item.prompt, ...item.options.map((option, index) => (option ? `(${spokenLetters[index]}) ${option}` : ''))].filter(Boolean).join('\n');
}

function withSpokenText(question, item) {
  return {
    ...question,
    transcript: spokenTranscript(item),
    options: question.options.map((option, index) => ({ ...option, isCorrect: index === item.correct })),
  };
}

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
    const spoken = !spec.option.text;
    const { errors, warnings } = pastedQuestionProblems(item, spec);
    if (spoken && !spec.question.image && !item.prompt) warnings.push('no question line');
    if (item.options.length > spec.optionCount) errors.push(`Part ${spec.number} has options A–${spokenLetters[spec.optionCount - 1]} only`);
    if (item.number < first || item.number > last) errors.unshift(`Part ${spec.number} holds questions ${first}–${last}`);
    if (pasted.findIndex((other) => other.number === item.number) !== index) errors.push('this number appears twice');
    return {
      ...item,
      set,
      place,
      replaces: Boolean(existing && (spoken ? existing.transcript : existing.prompt || existing.options.some((option) => option.text))),
      errors,
      warnings,
    };
  });
}

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
      questions: next.questions.map((question) => (question !== target ? question : spec.option.text ? withPastedText(question, item) : withSpokenText(question, item))),
    };
  }
  return next;
}

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

export function pastedPassagesPlan(part, spec, passages) {
  const first = MOCK_FIRST_QUESTION_NUMBERS[spec.key];
  const target = MOCK_TEST_PART_COUNTS[spec.key];
  let next = part;
  const rows = passages.map((item) => {
    const numbers = Array.from({ length: Math.max(item.to - item.from + 1, 0) }, (_, index) => item.from + index);
    const same = (list) => list.length === numbers.length && list.every((number, index) => number === numbers[index]);
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
