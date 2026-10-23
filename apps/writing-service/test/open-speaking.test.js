import test from 'node:test';
import assert from 'node:assert/strict';
import { seal } from '@appenglish/backend-common/secret-box';
import { WritingBroker } from '../src/broker.js';
import { GeminiError, GeminiFailure } from '../src/gemini.js';
import { OPEN_SCHEMA, buildOpenSpeakingPrompt, parseOpenSpeakingResult } from '../src/rubric.js';
import { gradeWriting } from '../src/worker.js';

const secret = 's'.repeat(40);
const transcript = 'I um like travel to Da Nang because the beach is very beautiful';
const prompt = { title: 'A trip', level: 'B1', instructions: 'Talk about a place you like to visit.', maxSeconds: 60, sampleAnswer: 'I love visiting Hoi An because of its old town.', keyPoints: ['the place', 'why'] };
const job = () => ({ id: 'e2', type: 'speaking.grading.requested', payload: { submissionId: 's2', prompt, answer: transcript, durationSeconds: 21.4, key: seal('AIzaGoodKey1234567890', secret) } });
const raw = {
  criteria: { task: 4, vocabulary: 3.2, grammar: 3, coherence: 4 },
  feedback: 'You named the place and gave a reason.',
  errors: [{ text: 'like travel', suggestion: 'like travelling', explanation: 'Use -ing after like.' }, { text: 'not said', suggestion: 'x', explanation: 'y' }],
  rewrite: 'I like travelling to Da Nang because the beach is beautiful.',
};

test('a spoken answer is graded from its transcript on four criteria', async () => {
  const text = buildOpenSpeakingPrompt(job().payload);
  for (const part of ['Task level (CEFR): B1', 'up to 60 seconds; the learner spoke for 21 seconds', '- why', 'Transcript (13 words)', transcript]) assert.ok(text.includes(part), part);
  assert.deepEqual(OPEN_SCHEMA.properties.criteria.required, ['task', 'vocabulary', 'grammar', 'coherence']);
  const parsed = parseOpenSpeakingResult(raw, transcript);
  assert.deepEqual(parsed.criteria, { task: 4, vocabulary: 3, grammar: 3, coherence: 4 });
  assert.deepEqual(parsed.errors.map((error) => error.text), ['like travel']);
  assert.equal('scores' in parsed, false);
  const requests = [];
  const answer = await gradeWriting(job(), { gemini: { generateJson: async (key, request) => (requests.push(request), raw) }, secret });
  assert.equal(answer.status, 'DONE');
  assert.match(requests[0].system, /transcript of a spoken answer/);
});

test('speaking results go to their own queue, also when Gemini gives up', async () => {
  const quiet = { log() {}, warn() {} };
  const sent = [];
  const channel = { sendToQueue: (queue, content) => sent.push({ queue, body: JSON.parse(content.toString()) }), ack() {} };
  const delivered = (attempt = 0) => ({ content: Buffer.from(JSON.stringify(job())), properties: { headers: attempt ? { 'x-attempt': attempt } : {} } });
  await new WritingBroker({ secret }, { gemini: { generateJson: async () => raw }, logger: quiet }).handleGrading(channel, delivered());
  assert.equal(sent[0].queue, 'writing.open-speaking.results');
  const busy = new WritingBroker({ secret }, { gemini: { generateJson: async () => { throw new GeminiError(GeminiFailure.UNAVAILABLE, 'down'); } }, logger: quiet });
  await busy.handleGrading(channel, delivered(3));
  assert.deepEqual(sent.slice(1).map((item) => item.queue), ['writing.open-speaking.results', 'writing.grading.requests.dead']);
  assert.equal(sent[1].body.status, 'FAILED');
});
