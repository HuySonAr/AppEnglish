import test from 'node:test';
import assert from 'node:assert/strict';
import { seal } from '@appenglish/backend-common/secret-box';
import { WritingBroker } from '../src/broker.js';
import { READ_ALOUD_SCHEMA, buildReadAloudPrompt, parseReadAloudResult } from '../src/read-aloud.js';
import { gradeWriting, jobTask } from '../src/worker.js';

const secret = 's'.repeat(40);
const text = 'Road crews are repairing the bridge near Exit Fourteen.';
const readAloud = {
  text,
  words: [
    { text: 'Road', status: 'missing', confidence: null },
    { text: 'crews', status: 'mispronounced', confidence: 0.41 },
    { text: 'are', status: 'correct', confidence: 0.97 },
    { text: 'repairing', status: 'correct', confidence: 0.9 },
    { text: 'the', status: 'correct', confidence: 0.99 },
    { text: 'bridge', status: 'missing', confidence: null },
  ],
  extra: ['trust', 'pioneer'],
  scores: { accuracy: 7.1, completeness: 6.7, fluency: 9, total: 7.4 },
  wordsPerMinute: 132,
  pauses: 1,
  ets: { task: 'read_aloud', pronunciation: 2, intonation: 2, score: 2, max: 3 },
};
const job = () => ({
  id: 'e3',
  type: 'speaking.grading.requested',
  payload: { submissionId: 's3', prompt: { title: 'Traffic', level: 'basic', maxSeconds: 45 }, readAloud, answer: 'trust crew are repairing the pioneer near exit fourteen', durationSeconds: 30.2, key: seal('AIzaGoodKey1234567890', secret) },
});
const raw = {
  feedback: 'You kept a steady pace.',
  strengths: ['Steady pace', 'Clear short words', 'Read to the end', 'Fourth point'],
  improvements: ['Say "road crews" slowly.'],
  practiceWords: ['bridge', 'Fourteen.', 'pioneer', 'crews', 'bridge'],
  vi: { feedback: 'Bạn đọc đều.', strengths: ['Tốc độ đều'], improvements: ['Đọc chậm "road crews".'] },
};

test('a read-aloud recording gets Gemini feedback from the matched words, not a new score', async () => {
  const prompt = buildReadAloudPrompt(job().payload);
  for (const part of ['Task level: Basic', text, 'trust crew are repairing', 'crews (41%)', 'not heard: Road, bridge', 'Extra words heard: trust, pioneer', '30 seconds of up to 45', '132 words per minute', 'TOEIC estimate 2 of 3']) assert.ok(prompt.includes(part), part);
  assert.deepEqual(READ_ALOUD_SCHEMA.required, ['feedback', 'strengths', 'improvements', 'practiceWords', 'vi']);
  const parsed = parseReadAloudResult(raw, text);
  assert.equal(parsed.strengths.length, 3);
  assert.deepEqual(parsed.practiceWords, ['bridge', 'Fourteen', 'crews']);
  assert.equal('score' in parsed, false);
  assert.deepEqual(parsed.vi, { feedback: 'Bạn đọc đều.', strengths: ['Tốc độ đều'], improvements: ['Đọc chậm "road crews".'] });
  assert.equal(parseReadAloudResult({ ...raw, vi: undefined }, text).vi, null);
  assert.ok(prompt.includes('natural Vietnamese'));
  assert.ok(READ_ALOUD_SCHEMA.required.includes('vi'));
  assert.throws(() => parseReadAloudResult({ ...raw, feedback: ' ' }, text), { kind: 'BAD_OUTPUT' });
  const requests = [];
  const answer = await gradeWriting(job(), { gemini: { generateJson: async (key, request) => (requests.push(request), raw) }, secret });
  assert.equal(answer.status, 'DONE');
  assert.equal(answer.result.feedback, 'You kept a steady pace.');
  assert.match(requests[0].system, /Never claim the learner said a specific wrong word/);
  assert.equal(jobTask(job()), 'read_aloud');
});

test('read-aloud feedback goes back on the speaking results queue', async () => {
  const sent = [];
  const channel = { sendToQueue: (queue, content) => sent.push({ queue, body: JSON.parse(content.toString()) }), ack() {} };
  const delivered = { content: Buffer.from(JSON.stringify(job())), properties: { headers: {} } };
  await new WritingBroker({ secret }, { gemini: { generateJson: async () => raw }, logger: { log() {}, warn() {} } }).handleGrading(channel, delivered);
  assert.equal(sent[0].queue, 'writing.open-speaking.results');
  assert.equal(sent[0].body.status, 'DONE');
});
