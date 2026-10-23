import { randomUUID } from 'node:crypto';
import { ListeningPracticeService } from '../src/listening/listening.service.js';

export function createListeningRepository() {
  const tables = { results: [] };
  const copy = (row) => (row ? structuredClone(row) : null);
  const repository = {
    tables,
    async listResults(accountId, exerciseId) {
      return tables.results.filter((row) => row.accountId === accountId && (!exerciseId || row.exerciseId === exerciseId)).map(copy);
    },
    async findResult(accountId, exerciseId, mode) {
      return copy(tables.results.find((row) => row.accountId === accountId && row.exerciseId === exerciseId && row.mode === mode));
    },
    async recordCheck(accountId, exerciseId, mode, accuracy, checkedAt) {
      const row = tables.results.find((item) => item.accountId === accountId && item.exerciseId === exerciseId && item.mode === mode);
      if (row) Object.assign(row, { bestAccuracy: Math.max(row.bestAccuracy, accuracy), lastAccuracy: accuracy, checkCount: row.checkCount + 1, lastCheckedAt: checkedAt });
      else tables.results.push({ id: randomUUID(), accountId, exerciseId, mode, bestAccuracy: accuracy, lastAccuracy: accuracy, checkCount: 1, lastCheckedAt: checkedAt });
      return repository.findResult(accountId, exerciseId, mode);
    },
  };
  return repository;
}

export function listeningHarness() {
  const toeic = { id: randomUUID(), code: 'toeic', name: 'TOEIC', format: 'toeic', hasEditor: true };
  const songs = { id: randomUUID(), code: 'songs', name: 'Songs', format: 'song', hasEditor: true };
  const news = { id: randomUUID(), code: 'news', name: 'News', format: null, hasEditor: false };
  const audio = randomUUID();
  const segment = (text, start = null, end = null, speaker = '') => ({ id: randomUUID(), text, start, end, speaker });
  const topic = { id: toeic.id, code: 'toeic', name: 'TOEIC' };
  const papers = [
    {
      exercise: { id: randomUUID(), title: 'Photo', level: 'A2', kind: 'part1', topic },
      content: { audioMediaId: audio, segments: ['A man is reading.', 'A man is running.', 'A man is cooking.', 'A man is sleeping.'].map((text) => segment(text)) },
    },
    {
      exercise: { id: randomUUID(), title: 'At the gate', level: 'B1', kind: 'part3', topic },
      content: { audioMediaId: audio, segments: [segment("Excuse me, where's gate 5?", 0, 2, 'Man'), segment("It's next to the café.", 2, 4, 'Woman')] },
    },
    {
      exercise: { id: randomUUID(), title: 'Home', level: 'A2', kind: 'song', topic: { id: songs.id, code: 'songs', name: 'Songs' } },
      content: { audioMediaId: audio, segments: [segment('I [walked] across an [empty] land', 0, 3), segment('I knew the pathway like the back of my [hand]', 3, 7)] },
    },
  ].map((paper) => ({ ...paper, versionId: randomUUID(), versionNumber: 1, media: { [audio]: { kind: 'audio', fileName: 'a.mp3', url: 'https://media.test/a.mp3' } } }));
  const content = {
    async listPublishedListeningExercises() {
      return structuredClone({
        topics: [toeic, songs, news],
        exercises: papers.map((paper) => ({ ...paper.exercise, segmentCount: paper.content.segments.length })),
      });
    },
    async getListeningPaper(id) {
      return structuredClone(papers.find((paper) => paper.exercise.id === id) || null);
    },
  };
  const repository = createListeningRepository();
  const service = new ListeningPracticeService(repository, content, { now: () => new Date('2026-10-14T08:00:00Z') });
  return { service, repository, content, papers };
}
