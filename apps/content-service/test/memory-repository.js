import { randomUUID } from 'node:crypto';

// In-memory stand-in for ContentRepository; rows are copied on the way in and
// out like a database would.
export function createMemoryRepository() {
  const tables = { units: [], lessons: [], versions: [], media: [], placement: [] };
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
  return {
    tables,
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
      return [...tables.versions, ...tables.placement].some((version) => JSON.stringify(version.content).includes(id));
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
