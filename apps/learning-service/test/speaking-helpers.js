import { randomUUID } from 'node:crypto';
import { LearningEvents } from '../src/events/learning-events.js';
import { SpeakingService } from '../src/speaking/speaking.service.js';
import { createEventRepository, fakeTransport } from './helpers.js';

export const other = { id: randomUUID(), role: 'STUDENT' };

export function createSpeakingRepository(events) {
  const tables = { submissions: [] };
  const copy = (row) => (row ? structuredClone(row) : null);
  return {
    tables,
    async statsByPrompt(accountId) {
      const rows = new Map();
      for (const row of tables.submissions.filter((item) => item.accountId === accountId)) {
        const stat = rows.get(row.promptId) || { promptId: row.promptId, attempts: 0, bestTotal: null, lastSubmittedAt: null };
        stat.attempts++;
        const total = row.result?.scores?.total;
        if (typeof total === 'number') stat.bestTotal = Math.max(stat.bestTotal ?? 0, total);
        if (!stat.lastSubmittedAt || row.submittedAt > stat.lastSubmittedAt) stat.lastSubmittedAt = row.submittedAt;
        rows.set(row.promptId, stat);
      }
      return [...rows.values()];
    },
    async listSubmissions(accountId, promptId, limit) {
      return tables.submissions.filter((row) => row.accountId === accountId && row.promptId === promptId).sort((a, b) => b.submittedAt - a.submittedAt).slice(0, limit).map(copy);
    },
    async findSubmission(id) {
      return copy(tables.submissions.find((row) => row.id === id));
    },
    async saveWithEvent(submission, event) {
      const index = tables.submissions.findIndex((row) => row.id === submission.id);
      if (index >= 0) tables.submissions[index] = structuredClone(submission);
      else tables.submissions.push(structuredClone(submission));
      if (event) await events.addEvent(event);
      return copy(submission);
    },
    async listExpiredRecordings(before, limit) {
      return tables.submissions.filter((row) => row.recording && !row.recordingDeletedAt && row.submittedAt < before).slice(0, limit).map(copy);
    },
    async markRecordingsDeleted(ids, at) {
      for (const row of tables.submissions) if (ids.includes(row.id)) row.recordingDeletedAt = at;
    },
  };
}

const prompt = (fields = {}) => ({
  id: randomUUID(),
  kind: 'read_aloud',
  versionId: randomUUID(),
  versionNumber: 2,
  content: { title: 'Train times', level: 'A2', topic: 'Travel', text: 'The train leaves at nine.', audioMediaId: 'm1' },
  media: { m1: { kind: 'audio', url: 'https://media.test/model.mp3' } },
  ...fields,
});

export const scored = {
  words: [{ text: 'The', status: 'correct', confidence: 0.9 }, { text: 'train', status: 'mispronounced', confidence: 0.4 }],
  extra: [],
  scores: { accuracy: 6.5, completeness: 10, fluency: 9, total: 8.1 },
  wordsPerMinute: 120,
  pauses: 0,
  heard: 'The train',
};

export function speakingHarness() {
  let clock = new Date('2026-10-23T08:00:00Z');
  const eventRepository = createEventRepository();
  const transport = fakeTransport();
  const events = new LearningEvents(eventRepository, { transport, now: () => clock });
  const repository = createSpeakingRepository(eventRepository);
  const readAloud = prompt();
  const writing = prompt({ kind: 'writing' });
  const stored = [];
  const removed = [];
  const content = {
    async listPublishedPracticePrompts() {
      return { prompts: [readAloud, writing].map((item) => ({ id: item.id, kind: item.kind, title: item.content.title, level: 'A2', topic: 'Travel', versionNumber: 2 })) };
    },
    async getPracticePaper(id) {
      const found = [readAloud, writing].find((item) => item.id === id);
      return found ? { prompt: structuredClone(found) } : null;
    },
    async storeLearnerRecording(mimeType, data) {
      stored.push([mimeType, data.byteLength]);
      return { recording: { storage: 'r2', storageId: `rec-${stored.length}`, url: `https://media.test/rec-${stored.length}.webm`, mimeType, sizeBytes: data.byteLength } };
    },
    async deleteLearnerRecordings(recordings) {
      removed.push(...recordings.map((item) => item.storageId));
      return { deleted: recordings.map((item) => item.storageId).filter((id) => id !== 'rec-2'), failed: ['rec-2'] };
    },
  };
  const service = new SpeakingService(repository, content, { now: () => clock, events });
  return { service, repository, eventRepository, transport, events, readAloud, writing, stored, removed, setClock: (value) => (clock = value) };
}

