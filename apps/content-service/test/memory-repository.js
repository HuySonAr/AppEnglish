import { randomUUID } from 'node:crypto';

// In-memory stand-in for ContentRepository; rows are copied on the way in and
// out like a database would.
export function createMemoryRepository() {
  const tables = {
    units: [], lessons: [], versions: [], media: [], placement: [], mockTests: [], mockVersions: [],
    listeningExercises: [], listeningVersions: [], timingJobs: [], courseItems: [], courseVersions: [],
    listeningTopics: [{ id: toeicTopicId, code: 'toeic', name: 'TOEIC', format: 'toeic' }],
    // The migration creates TOEIC.
    examTypes: [{ id: toeicExamTypeId, code: 'toeic', name: 'TOEIC', format: 'toeic' }],
  };
  const copy = (row) => (row ? structuredClone(row) : null);
  const byPosition = (a, b) => a.position - b.position;
  function save(table, row) {
    const stored = { id: randomUUID(), ...structuredClone(row) };
    const index = tables[table].findIndex((item) => item.id === stored.id);
    if (index >= 0) tables[table][index] = stored;
    else tables[table].push(stored);
    Object.assign(row, { id: stored.id });
    return copy(stored);
  }
  // In-memory stand-in for ListeningRepository, on the same tables.
  const listening = {
    async listTopics() { return tables.listeningTopics.map(copy); },
    async findTopic(id) { return copy(tables.listeningTopics.find((item) => item.id === id)); },
    async saveTopic(topic) { return save('listeningTopics', topic); },
    async listExercises() { return tables.listeningExercises.map(copy); },
    async findExercise(id) { return copy(tables.listeningExercises.find((item) => item.id === id)); },
    async saveExercise(exercise) { return save('listeningExercises', exercise); },
    async listVersionSummaries() {
      return tables.listeningVersions.map(({ id, exerciseId, versionNumber, status }) => ({ id, exerciseId, versionNumber, status }));
    },
    async findDraft(exerciseId) {
      return copy(tables.listeningVersions.find((version) => version.exerciseId === exerciseId && version.status === 'DRAFT'));
    },
    async findVersion(id) { return copy(tables.listeningVersions.find((version) => version.id === id)); },
    async maxVersionNumber(exerciseId) {
      return Math.max(0, ...tables.listeningVersions.filter((version) => version.exerciseId === exerciseId).map((version) => version.versionNumber));
    },
    async saveVersion(version) { return save('listeningVersions', version); },
    async publishVersion(exercise, version) {
      save('listeningVersions', version);
      save('listeningExercises', exercise);
    },
    async saveTimingJob(job) {
      return save('timingJobs', { createdAt: new Date(), ...job, updatedAt: new Date() });
    },
    async findTimingJob(id) { return copy(tables.timingJobs.find((job) => job.id === id)); },
    async findLatestTimingJob(exerciseId) {
      return copy(tables.timingJobs.filter((job) => job.exerciseId === exerciseId).at(-1));
    },
  };
  // In-memory stand-in for CourseRepository.
  const course = {
    async listItems() {
      return tables.courseItems.map(copy).sort((a, b) => (a.level || '').localeCompare(b.level || '') || a.position - b.position);
    },
    async findItem(id) { return copy(tables.courseItems.find((item) => item.id === id)); },
    async saveItem(item) { return save('courseItems', item); },
    async saveItems(items) { return items.map((item) => save('courseItems', item)); },
    async createItemWithDraft(item, draft) {
      if (item.type === 'level_test' && tables.courseItems.some((other) => other.type === 'level_test' && other.level === item.level)) return null;
      if (item.type === 'placement' && tables.courseItems.some((other) => other.type === 'placement')) return null;
      const saved = save('courseItems', item);
      return { item: saved, draft: save('courseVersions', { ...draft, itemId: saved.id }) };
    },
    async listVersionSummaries() {
      return tables.courseVersions.map(({ id, itemId, versionNumber, status }) => ({ id, itemId, versionNumber, status }));
    },
    async findDraft(itemId) { return copy(tables.courseVersions.find((version) => version.itemId === itemId && version.status === 'DRAFT')); },
    async findVersion(id) { return copy(tables.courseVersions.find((version) => version.id === id)); },
    async maxVersionNumber(itemId) {
      return Math.max(0, ...tables.courseVersions.filter((version) => version.itemId === itemId).map((version) => version.versionNumber));
    },
    async saveVersion(version) { return save('courseVersions', version); },
    async publishVersion(item, version) {
      save('courseVersions', version);
      save('courseItems', item);
    },
  };
  return {
    tables,
    listening,
    course,
    async listUnits() { return tables.units.map(copy).sort(byPosition); },
    async findUnit(id) { return copy(tables.units.find((unit) => unit.id === id)); },
    async saveUnit(unit) { return save('units', unit); },
    async saveUnits(units) { return units.map((unit) => save('units', unit)); },
    async listLessons() { return tables.lessons.map(copy).sort(byPosition); },
    async listLessonsByUnit(unitId) {
      return tables.lessons.filter((lesson) => lesson.unitId === unitId).map(copy).sort(byPosition);
    },
    async findLesson(id) { return copy(tables.lessons.find((lesson) => lesson.id === id)); },
    async saveLesson(lesson) { return save('lessons', lesson); },
    async saveLessons(lessons) { return lessons.map((lesson) => save('lessons', lesson)); },
    async createLessonWithDraft(lesson, draft) {
      const savedLesson = save('lessons', lesson);
      return { lesson: savedLesson, draft: save('versions', { ...draft, lessonId: savedLesson.id }) };
    },
    async listVersionSummaries() {
      return tables.versions.map(({ id, lessonId, versionNumber, status }) => ({ id, lessonId, versionNumber, status }));
    },
    async findDraft(lessonId) {
      return copy(tables.versions.find((version) => version.lessonId === lessonId && version.status === 'DRAFT'));
    },
    async findVersion(id) { return copy(tables.versions.find((version) => version.id === id)); },
    async maxVersionNumber(lessonId) {
      return Math.max(0, ...tables.versions.filter((version) => version.lessonId === lessonId).map((version) => version.versionNumber));
    },
    async saveVersion(version) { return save('versions', version); },
    async publishVersion(lesson, version) {
      save('versions', version);
      save('lessons', lesson);
    },
    async findMediaByIds(ids) { return tables.media.filter((asset) => ids.includes(asset.id)).map(copy); },
    async saveMedia(asset) { return save('media', asset); },
    async deleteMedia(id) { tables.media = tables.media.filter((asset) => asset.id !== id); },
    async isMediaReferenced(id) {
      return [...tables.versions, ...tables.placement, ...tables.mockVersions, ...tables.listeningVersions].some((version) => JSON.stringify(version.content).includes(id));
    },
    async listExamTypes() { return tables.examTypes.map(copy); },
    async findExamType(id) { return copy(tables.examTypes.find((item) => item.id === id)); },
    async saveExamType(examType) { return save('examTypes', examType); },
    async listMockTests() { return tables.mockTests.map(copy).sort((a, b) => a.level - b.level); },
    async findMockTest(id) { return copy(tables.mockTests.find((item) => item.id === id)); },
    async saveMockTest(mockTest) { return save('mockTests', mockTest); },
    async listMockVersionSummaries() {
      return tables.mockVersions.map(({ id, mockTestId, versionNumber, status }) => ({ id, mockTestId, versionNumber, status }));
    },
    async findMockDraft(mockTestId) {
      return copy(tables.mockVersions.find((version) => version.mockTestId === mockTestId && version.status === 'DRAFT'));
    },
    async findMockVersion(id) { return copy(tables.mockVersions.find((version) => version.id === id)); },
    async maxMockVersionNumber(mockTestId) {
      return Math.max(0, ...tables.mockVersions.filter((version) => version.mockTestId === mockTestId).map((version) => version.versionNumber));
    },
    async saveMockVersion(version) { return save('mockVersions', version); },
    async publishMockVersion(mockTest, version) {
      save('mockVersions', version);
      save('mockTests', mockTest);
    },
    async countPublishedUnits() { return tables.units.filter((unit) => unit.status === 'PUBLISHED').length; },
    async findPlacementDraft() { return copy(tables.placement.find((version) => version.status === 'DRAFT')); },
    async findPlacementVersion(id) { return copy(tables.placement.find((version) => version.id === id)); },
    async findPublishedPlacement() {
      return copy(tables.placement.filter((version) => version.status === 'PUBLISHED').sort((a, b) => b.versionNumber - a.versionNumber)[0]);
    },
    async maxPlacementVersionNumber() { return Math.max(0, ...tables.placement.map((version) => version.versionNumber)); },
    async savePlacementVersion(version) { return save('placement', version); },
  };
}

export const toeicExamTypeId = '66666666-6666-4666-8666-666666666666';
export const toeicTopicId = '77777777-7777-4777-8777-777777777777';
export const manager = { id: '11111111-1111-4111-8111-111111111111', role: 'CONTENT_MANAGER' };
export const student = { id: '22222222-2222-4222-8222-222222222222', role: 'STUDENT' };
export const admin = { id: '33333333-3333-4333-8333-333333333333', role: 'ADMIN' };

// A complete lesson draft (vocabulary, fill-in passage and the seven-part,
// 23-question test) that satisfies every publishing requirement. audioId and
// imageId must be existing media assets.
export function publishableContent({ audioId, imageId }) {
  const textOptions = (correct) =>
    Array.from({ length: 4 }, (_, index) => ({ text: `Option ${index + 1}`, isCorrect: index === correct }));
  const letterOptions = (count) =>
    Array.from({ length: count }, (_, index) => ({ isCorrect: index === 0 }));
  const questions = (count, make) =>
    Array.from({ length: count }, (_, index) => ({ explanation: `Because of reason ${index + 1}.`, ...make(index) }));
  const word = (fields) => ({ audioUkMediaId: audioId, audioUsMediaId: audioId, ...fields });
  return {
    vocabulary: [
      word({ word: 'ticket', partOfSpeech: 'noun', phonetic: '/ˈtɪkɪt/', meaning: 'vé', example: 'I bought a ticket.', exampleMeaning: 'Tôi đã mua một vé.' }),
      word({ word: 'platform', partOfSpeech: 'noun', phonetic: '/ˈplætfɔːm/', meaning: 'sân ga', example: 'The train leaves from platform 2.', exampleMeaning: 'Tàu khởi hành từ sân ga số 2.' }),
    ],
    fillIn: { passage: 'She showed her ___ and walked to the ___.', answers: ['Ticket', 'platform'] },
    test: {
      part1: { audioMediaId: audioId, transcript: 'A. A man is reading. B. A man is running. C. A man is cooking. D. A man is sleeping.', questions: questions(1, () => ({ imageMediaId: imageId, options: letterOptions(4) })) },
      part2: { audioMediaId: audioId, transcript: 'Number 1. Where is the station? A. Next to the bank. B. At noon. C. By train.', questions: questions(2, () => ({ options: letterOptions(3) })) },
      part3: { audioMediaId: audioId, transcript: 'A: One ticket, please. B: Here you are.', questions: questions(3, (index) => ({ prompt: `Conversation question ${index + 1}?`, options: textOptions(1) })) },
      part4: { audioMediaId: audioId, transcript: 'Attention passengers: the train is delayed.', questions: questions(3, (index) => ({ prompt: `Talk question ${index + 1}?`, options: textOptions(2) })) },
      part5: { questions: questions(6, (index) => ({ prompt: `The train ___ at ${index + 1} o'clock.`, options: textOptions(0) })) },
      part6: { passage: 'Dear ___, your ___ is ready at the ___.', questions: questions(3, () => ({ options: textOptions(3) })) },
      part7: { passage: 'NOTICE: The station closes at 10 p.m. on weekdays.', questions: questions(5, (index) => ({ prompt: `Reading question ${index + 1}?`, options: textOptions(1) })) },
    },
  };
}
