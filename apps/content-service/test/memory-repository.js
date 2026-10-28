import { randomUUID } from 'node:crypto';
import { WORKING_VERSION_STATUSES } from '@appenglish/content-contracts';
import { ContentReviewService } from '../src/review/review.service.js';

const working = (version) => WORKING_VERSION_STATUSES.includes(version.status);

export function createMemoryRepository() {
  const tables = {
    units: [], lessons: [], versions: [], reviewVersions: [], media: [], placement: [], mockTests: [], mockVersions: [],
    listeningExercises: [], listeningVersions: [], timingJobs: [], adminNotices: [], noticeReads: [], contentEvents: [], processed: [], practicePrompts: [], practiceVersions: [],
    listeningTopics: [{ id: toeicTopicId, code: 'toeic', name: 'TOEIC', format: 'toeic' }],
    listeningTests: [],
    examTypes: [{ id: toeicExamTypeId, code: 'toeic', name: 'TOEIC', format: 'toeic' }],
  };
  const copy = (row) => (row ? structuredClone(row) : null);
  const byPosition = (a, b) => a.position - b.position;
  const versionTables = {
    LessonVersion: 'versions',
    MockTestVersion: 'mockVersions',
    ListeningExerciseVersion: 'listeningVersions',
    UnitReviewVersion: 'reviewVersions',
  };
  function save(table, row) {
    const stored = { id: randomUUID(), ...structuredClone(row) };
    const index = tables[table].findIndex((item) => item.id === stored.id);
    if (index >= 0) tables[table][index] = stored;
    else tables[table].push(stored);
    Object.assign(row, { id: stored.id });
    return copy(stored);
  }
  const listening = {
    async listTopics() { return tables.listeningTopics.map(copy); },
    async findTopic(id) { return copy(tables.listeningTopics.find((item) => item.id === id)); },
    async saveTopic(topic) { return save('listeningTopics', topic); },
    async deleteTopic(id) { tables.listeningTopics = tables.listeningTopics.filter((item) => item.id !== id); },
    async listTests() { return tables.listeningTests.map(copy); },
    async findTest(id) { return copy(tables.listeningTests.find((item) => item.id === id)); },
    async saveTest(test) { return save('listeningTests', test); },
    async deleteTest(id) { tables.listeningTests = tables.listeningTests.filter((item) => item.id !== id); },
    async listExercises() { return tables.listeningExercises.map(copy); },
    async findExercise(id) { return copy(tables.listeningExercises.find((item) => item.id === id)); },
    async saveExercise(exercise) { return save('listeningExercises', exercise); },
    async listVersionSummaries() {
      return tables.listeningVersions.map(({ id, exerciseId, versionNumber, status }) => ({ id, exerciseId, versionNumber, status }));
    },
    async findDraft(exerciseId) {
      return copy(tables.listeningVersions.find((version) => version.exerciseId === exerciseId && working(version)));
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
    async deleteExerciseWithVersions(exerciseId) {
      tables.timingJobs = tables.timingJobs.filter((job) => job.exerciseId !== exerciseId);
      tables.listeningVersions = tables.listeningVersions.filter((version) => version.exerciseId !== exerciseId);
      tables.listeningExercises = tables.listeningExercises.filter((exercise) => exercise.id !== exerciseId);
    },
    async saveTimingJobWithEvent(job, eventOf) {
      const saved = await this.saveTimingJob(job);
      tables.contentEvents.push({ id: randomUUID(), createdAt: new Date(), publishedAt: null, ...structuredClone(eventOf(saved)) });
      return saved;
    },
    async listPendingEvents(limit) { return tables.contentEvents.filter((event) => !event.publishedAt).slice(0, limit).map(copy); },
    async markEventPublished(id, at) { tables.contentEvents.find((event) => event.id === id).publishedAt = at; },
    async isProcessed(messageId) { return tables.processed.includes(messageId); },
    async markProcessed(messageId) { if (!tables.processed.includes(messageId)) tables.processed.push(messageId); },
    async saveTimingJob(job) {
      return save('timingJobs', { createdAt: new Date(), ...job, updatedAt: new Date() });
    },
    async findTimingJob(id) { return copy(tables.timingJobs.find((job) => job.id === id)); },
    async findLatestTimingJob(owner) {
      return copy(tables.timingJobs.filter((job) => Object.entries(owner).every(([field, value]) => job[field] === value)).at(-1));
    },
    async listJobsUpdatedSince(since) {
      return tables.timingJobs.filter((job) => new Date(job.updatedAt) > since).map(copy);
    },
    async listJobsRequestedBy(requestedBy, since, limit) {
      return tables.timingJobs.filter((job) => job.requestedBy === requestedBy && new Date(job.updatedAt) > since).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, limit).map(copy);
    },
    async markJobsSeen(requestedBy, ids, at) {
      for (const job of tables.timingJobs) if (job.requestedBy === requestedBy && !job.seenAt && (!ids || ids.includes(job.id))) job.seenAt = at;
    },
    async titlesOf({ exerciseIds, mockTestIds }) {
      const rows = [...tables.listeningExercises.filter((row) => exerciseIds.includes(row.id)), ...tables.mockTests.filter((row) => mockTestIds.includes(row.id))];
      return new Map(rows.map((row) => [row.id, row.title]));
    },
    async listTimingJobs(owner) {
      return tables.timingJobs.filter((job) => Object.entries(owner).every(([field, value]) => job[field] === value)).map(copy);
    },
  };
  const practice = {
    async listReviewActivity(since) {
      const versions = tables.practiceVersions.filter((row) => row.status === 'PENDING_REVIEW' || (row.reviewedAt && new Date(row.reviewedAt) > since)).map(copy);
      return { versions, prompts: tables.practicePrompts.filter((row) => versions.some((version) => version.promptId === row.id)).map(copy) };
    },
    async listPrompts(where = {}) {
      return tables.practicePrompts.filter((row) => Object.entries(where).every(([key, value]) => row[key] === value)).map(copy).reverse();
    },
    async findPrompt(id) { return copy(tables.practicePrompts.find((row) => row.id === id)); },
    async savePrompt(prompt) { return save('practicePrompts', prompt); },
    async listVersions(promptIds) {
      return tables.practiceVersions.filter((row) => promptIds.includes(row.promptId)).sort((a, b) => a.versionNumber - b.versionNumber).map(copy);
    },
    async saveVersion(version) { return save('practiceVersions', { updatedAt: new Date(), ...version, updatedAt: new Date() }); },
    async createPromptWithVersion(prompt, versionOf) {
      const saved = save('practicePrompts', prompt);
      const version = save('practiceVersions', { updatedAt: new Date(), ...versionOf(saved) });
      return { prompt: saved, version };
    },
    async publishVersion(prompt, version, previous) {
      if (previous) save('practiceVersions', previous);
      save('practiceVersions', version);
      save('practicePrompts', prompt);
    },
    async deletePrompt(id) {
      tables.practicePrompts = tables.practicePrompts.filter((row) => row.id !== id);
      tables.practiceVersions = tables.practiceVersions.filter((row) => row.promptId !== id);
    },
  };
  return {
    tables,
    listening,
    practice,
    async addAdminNotice(notice) {
      if (!tables.adminNotices.some((row) => row.key === notice.key)) tables.adminNotices.push({ id: randomUUID(), ...structuredClone(notice) });
    },
    async listAdminNotices(since) {
      return tables.adminNotices.filter((row) => new Date(row.createdAt) > since).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(copy);
    },
    async readNoticeKeys(accountId, keys) {
      return new Set(tables.noticeReads.filter((row) => row.accountId === accountId && keys.includes(row.key)).map((row) => row.key));
    },
    async markNoticesRead(accountId, keys, at) {
      for (const key of keys) if (!tables.noticeReads.some((row) => row.accountId === accountId && row.key === key)) tables.noticeReads.push({ accountId, key, readAt: at });
    },
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
      return copy(tables.versions.find((version) => version.lessonId === lessonId && working(version)));
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
    async listMediaBefore(before) { return tables.media.filter((asset) => new Date(asset.createdAt || 0) < before).map(copy); },
    async deleteLessonWithVersions(lessonId) {
      tables.versions = tables.versions.filter((version) => version.lessonId !== lessonId);
      tables.lessons = tables.lessons.filter((lesson) => lesson.id !== lessonId);
    },
    async deleteUnitWithLessons(unitId, lessonIds) {
      tables.versions = tables.versions.filter((version) => !lessonIds.includes(version.lessonId));
      tables.lessons = tables.lessons.filter((lesson) => !lessonIds.includes(lesson.id));
      tables.reviewVersions = tables.reviewVersions.filter((version) => version.unitId !== unitId);
      tables.units = tables.units.filter((unit) => unit.id !== unitId);
    },
    async listVersionsOf(entity, ownerColumn, ownerId) {
      const table = versionTables[entity.options.name];
      return tables[table]
        .filter((version) => version[ownerColumn] === ownerId)
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .map(({ content, ...meta }) => copy(meta));
    },
    async findVersionOf(entity, id) {
      return copy(tables[versionTables[entity.options.name]].find((version) => version.id === id));
    },
    async deleteVersionOf(entity, id) {
      const table = versionTables[entity.options.name];
      tables[table] = tables[table].filter((version) => version.id !== id);
    },
    async listReviewVersionSummaries() {
      return tables.reviewVersions.map(({ id, unitId, versionNumber, status }) => ({ id, unitId, versionNumber, status }));
    },
    async findReviewDraft(unitId) {
      return copy(tables.reviewVersions.find((version) => version.unitId === unitId && working(version)));
    },
    async findReviewVersion(id) { return copy(tables.reviewVersions.find((version) => version.id === id)); },
    async maxReviewVersionNumber(unitId) {
      return Math.max(0, ...tables.reviewVersions.filter((version) => version.unitId === unitId).map((version) => version.versionNumber));
    },
    async saveReviewVersion(version) { return save('reviewVersions', version); },
    async publishReviewVersion(unit, version) {
      save('reviewVersions', version);
      save('units', unit);
    },
    async deleteMockTestWithVersions(mockTestId) {
      tables.mockVersions = tables.mockVersions.filter((version) => version.mockTestId !== mockTestId);
      tables.mockTests = tables.mockTests.filter((mockTest) => mockTest.id !== mockTestId);
    },
    async listReferencedMediaIds() {
      const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
      const referenced = new Set();
      for (const version of [...tables.versions, ...tables.placement, ...tables.mockVersions, ...tables.listeningVersions, ...tables.reviewVersions, ...tables.practiceVersions])
        for (const match of JSON.stringify(version.content).matchAll(uuid)) referenced.add(match[0].toLowerCase());
      return referenced;
    },
    async isMediaReferenced(id) {
      return [...tables.versions, ...tables.placement, ...tables.mockVersions, ...tables.listeningVersions, ...tables.practiceVersions].some((version) => JSON.stringify(version.content).includes(id));
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
      return copy(tables.mockVersions.find((version) => version.mockTestId === mockTestId && working(version)));
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
    async findPlacementDraft() { return copy(tables.placement.find(working)); },
    async findPlacementVersion(id) { return copy(tables.placement.find((version) => version.id === id)); },
    async findPublishedPlacement() {
      return copy(tables.placement.filter((version) => version.status === 'PUBLISHED').sort((a, b) => b.versionNumber - a.versionNumber)[0]);
    },
    async maxPlacementVersionNumber() { return Math.max(0, ...tables.placement.map((version) => version.versionNumber)); },
    async savePlacementVersion(version) { return save('placement', version); },
    async listWorkingVersions() {
      const sources = [['lesson', 'versions', 'lessonId'], ['unitReview', 'reviewVersions', 'unitId'], ['placement', 'placement', null], ['mockTest', 'mockVersions', 'mockTestId'], ['listeningExercise', 'listeningVersions', 'exerciseId']];
      return sources.flatMap(([kind, table, owner]) =>
        tables[table].filter(working).map(({ content, ...row }) => ({ ...copy(row), kind, ownerId: owner ? row[owner] : null })),
      );
    },
    async listReviewActivity(since) {
      const sources = [['lesson', 'versions', 'lessonId'], ['unitReview', 'reviewVersions', 'unitId'], ['placement', 'placement', null], ['mockTest', 'mockVersions', 'mockTestId'], ['listeningExercise', 'listeningVersions', 'exerciseId']];
      const active = (row) => row.status === 'PENDING_REVIEW' || (row.reviewedAt && new Date(row.reviewedAt) > since);
      return sources.flatMap(([kind, table, owner]) =>
        tables[table].filter(active).map(({ content, ...row }) => ({ ...copy(row), kind, ownerId: owner ? row[owner] : null })),
      );
    },
  };
}

export const toeicExamTypeId = '66666666-6666-4666-8666-666666666666';
export const toeicTopicId = '77777777-7777-4777-8777-777777777777';
export const manager = { id: '11111111-1111-4111-8111-111111111111', role: 'CONTENT_MANAGER' };
export const student = { id: '22222222-2222-4222-8222-222222222222', role: 'STUDENT' };
export const admin = { id: '33333333-3333-4333-8333-333333333333', role: 'ADMIN' };
export const teacher = { id: '55555555-5555-4555-8555-555555555555', role: 'TEACHER' };
export const otherTeacher = { id: '88888888-8888-4888-8888-888888888888', role: 'TEACHER' };

export function submitted(content, listening, kind, id, actor = teacher) {
  return new ContentReviewService(content, listening).submit(actor, { kind, id });
}

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
