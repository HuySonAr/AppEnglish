import { CourseLevelState } from '@appenglish/learning-contracts';
import { matchesSearch } from '../../../lib/list.js';

// The Listening course for learners (D143–D145). Pure helpers, with tests.

export const CourseTopicFilter = Object.freeze({ ALL: 'all', TODO: 'todo', DONE: 'done' });
export const courseTopicFilterOptions = [
  { value: CourseTopicFilter.ALL, label: 'All topics' },
  { value: CourseTopicFilter.TODO, label: 'Not done yet' },
  { value: CourseTopicFilter.DONE, label: 'Done' },
];

// The topics of a level that pass the search and the filter, in course order.
export function filterTopics(topics, { search = '', status = CourseTopicFilter.ALL } = {}) {
  return topics.filter(
    (topic) =>
      (status === CourseTopicFilter.ALL || (status === CourseTopicFilter.DONE ? topic.done : !topic.done)) &&
      matchesSearch(`${topic.title} ${topic.description || ''}`, search),
  );
}

// The level shown first: the learner's current (highest open) level.
export const startingLevel = (course) => course.currentLevel || course.levels[0]?.level || null;

// Topics done out of all topics of a level.
export const levelProgress = (level) => ({ done: level.topics.filter((topic) => topic.done).length, total: level.topics.length });

export const isOpen = (level) => level.state === CourseLevelState.OPEN;

// Where a topic and a level test are opened.
export const courseTopicPath = (topicId) => `/student/listening-course/topics/${topicId}`;
export const courseTestPath = (itemId) => `/student/listening-course/tests/${itemId}`;

// What to do next in the course: the first topic not done of the current
// level, else its level test not passed yet, else null.
export function nextStep(course) {
  const level = course?.levels?.find((entry) => entry.level === course.currentLevel);
  if (!level) return null;
  const topic = level.topics.find((entry) => !entry.done);
  if (topic) return { type: 'topic', level: level.level, id: topic.id, title: topic.title, path: courseTopicPath(topic.id) };
  if (level.levelTest && !level.levelTest.passed)
    return { type: 'level_test', level: level.level, id: level.levelTest.id, title: level.levelTest.title, path: courseTestPath(level.levelTest.id) };
  return null;
}
export const nextKind = { topic: 'Next topic', level_test: 'Level test' };

// Whether the ideas are in the order heard, and which positions are right.
export function orderingResult(currentIds, rightIds) {
  const right = currentIds.map((id, index) => id === rightIds[index]);
  return { correct: right.every(Boolean), right };
}

// The items moved one place up (by -1) or down (by 1).
export function moveItem(list, index, by) {
  const to = index + by;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

// The questions not answered yet (option id by question id).
export const unanswered = (questions, answers) => questions.filter((question) => !answers[question.id]);

// The pieces of a sentence in the blanks mode as text, with ___ for each
// blank (for the hint and for screen readers).
export const blankedText = (pieces) => pieces.map((piece) => ('blank' in piece ? '___' : piece.text)).join('');

const NUMBER_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  eleven: '11', twelve: '12', thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19',
  twenty: '20', thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90', hundred: '100',
};

const plainWord = (word) =>
  word
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .replace(/[^\p{L}\p{N}'.]/gu, '')
    .replace(/\.(?!\d)/g, '')
    .replace(/^'+|'+$/g, '');

const wordKey = (word) => {
  const plain = plainWord(word).replace(/'/g, '');
  return NUMBER_WORDS[plain] || plain;
};

export const splitWords = (text) =>
  String(text || '')
    .split(/[\s\-\u2013\u2014/]+/)
    .map((display) => ({ display, key: wordKey(display) }))
    .filter((word) => word.key);

export function typingMarks(expectedText, typedText) {
  const expected = splitWords(expectedText);
  const typed = splitWords(typedText);
  const open = typed.length > 0 && !/[\s\-\u2013\u2014/]$/.test(typedText);
  const marks = typed.map((word, index) => {
    const target = expected[index];
    if (!target) return { text: word.display, status: 'extra' };
    if (word.key === target.key) return { text: word.display, status: 'right' };
    if (open && index === typed.length - 1 && target.key.startsWith(word.key)) return { text: word.display, status: 'typing' };
    return { text: word.display, status: 'wrong' };
  });
  const right = marks.filter((mark) => mark.status === 'right').length;
  return { marks, right, total: expected.length, done: typed.length === expected.length && right === expected.length };
}

export function blankMark(answer, typedText) {
  const typed = splitWords(typedText).map((word) => word.key).join(' ');
  if (!typed) return 'empty';
  const expected = splitWords(answer).map((word) => word.key).join(' ');
  if (typed === expected) return 'right';
  if (/\S$/.test(typedText) && expected.startsWith(typed)) return 'typing';
  return 'wrong';
}

export function activeSentence(sentences, time) {
  let found = -1;
  sentences.forEach((sentence, index) => {
    if (sentence.start !== null && sentence.start <= time + 0.05) found = index;
  });
  return found;
}
