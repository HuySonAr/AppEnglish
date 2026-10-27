import test from 'node:test';
import assert from 'node:assert/strict';
import { seal } from '@appenglish/backend-common/secret-box';
import { WritingBroker } from '../src/broker.js';
import { buildEtsPrompt, parseEtsResult } from '../src/ets-rubric.js';
import { gradeWriting } from '../src/worker.js';

const secret = 's'.repeat(40);
const job = (payload = {}) => ({
  id: 'e3',
  type: 'sw.grading.requested',
  payload: {
    submissionId: 'j1',
    section: 'writing',
    number: 6,
    task: 'respond_email',
    maxScore: 4,
    prompt: { task: 'respond_email', email: 'Welcome to Dale City.', instructions: 'Make at least TWO requests for information.', keywords: [], text: '' },
    answer: 'Dear committee, where is the library? When does the bus run? Thank you.',
    key: seal('AIzaGoodKey1234567890', secret),
    ...payload,
  },
});

test('an S&W test answer is graded with the ETS guide of its task (D198)', async () => {
  const text = buildEtsPrompt(job().payload);
  for (const part of ['score 0-4', 'Email the learner answers:\nWelcome to Dale City.', 'Make at least TWO requests', '4 = effectively addresses all the tasks', 'Response (13 words)']) assert.ok(text.includes(part), part);
  const spoken = buildEtsPrompt({ task: 'respond_info', maxScore: 3, prompt: { info: '| 9:00 | Welcome |', text: 'When does it start?', respondSeconds: 15 }, answer: 'It starts at nine', durationSeconds: 12.2 });
  for (const part of ['Information the speaker reads', 'Answer time: 15 seconds; the learner spoke for 12 seconds', 'Transcript (4 words)', 'information taken from the document is accurate']) assert.ok(spoken.includes(part), part);
  assert.deepEqual(parseEtsResult({ score: 7, feedback: ' Good. ' }, 4), { score: 4, feedback: 'Good.' });
  const requests = [];
  const answer = await gradeWriting(job(), { gemini: { model: 'm', generateJson: async (key, request) => (requests.push(request), { score: 3.4, feedback: 'Two clear requests.' }) }, secret });
  assert.deepEqual([answer.submissionId, answer.status, answer.result.score, answer.result.feedback], ['j1', 'DONE', 3, 'Two clear requests.']);
  assert.match(requests[0].system, /TOEIC Speaking and Writing/);
  assert.equal((await gradeWriting(job({ task: 'unknown_task' }), { gemini: { generateJson: async () => ({}) }, secret })).status, 'FAILED');
});

test('S&W results go to their own queue (D198)', async () => {
  const sent = [];
  const channel = { sendToQueue: (queue, content) => sent.push({ queue, body: JSON.parse(content.toString()) }), ack() {} };
  const message = { content: Buffer.from(JSON.stringify(job())), properties: { headers: {} } };
  await new WritingBroker({ secret }, { gemini: { generateJson: async () => ({ score: 2, feedback: 'Fine.' }) }, logger: { log() {}, warn() {} } }).handleGrading(channel, message);
  assert.deepEqual([sent[0].queue, sent[0].body.submissionId, sent[0].body.result.score], ['writing.sw.results', 'j1', 2]);
});
