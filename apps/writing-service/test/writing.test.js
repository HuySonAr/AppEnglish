import test from 'node:test';
import assert from 'node:assert/strict';
import { seal } from '@appenglish/backend-common/secret-box';
import { WritingBroker, outcomeOf } from '../src/broker.js';
import { loadConfig } from '../src/config.js';
import { GeminiClient, GeminiError, GeminiFailure, classify } from '../src/gemini.js';
import { SCHEMA, buildWritingPrompt, parseWritingResult } from '../src/rubric.js';
import { checkKey, gradeWriting } from '../src/worker.js';

const secret = 's'.repeat(40);
const answer = 'Dear Ms Lee, I want take Friday off becaus my sister wedding. I will finish the report on Thursday. Thank you, Anna.';
const prompt = {
  title: 'Ask for a day off',
  level: 'A2',
  taskType: 'email',
  instructions: 'Write an email to your manager asking for a day off.',
  minWords: 20,
  maxWords: 80,
  sampleAnswer: 'Dear Ms Lee, could I take Friday off? I will finish my report on Thursday. Thank you, Anna.',
  keyPoints: ['the day', 'the reason', 'thanks'],
};
const job = (fields = {}) => ({ id: 'e1', type: 'writing.requested', payload: { submissionId: 's1', prompt, answer, key: seal('AIzaGoodKey1234567890', secret), ...fields } });
const raw = {
  criteria: { cohesion: 3.7, syntax: 3, vocabulary: 3.5, phraseology: 3, grammar: 2.5, conventions: 2.5, task: 5 },
  feedback: 'Clear email with every point.',
  errors: [
    { text: 'want take', suggestion: 'want to take', explanation: 'Use "want to" + verb.' },
    { text: 'not in the text', suggestion: 'x', explanation: 'y' },
    { text: 'becaus', suggestion: 'because', explanation: 'Spelling.' },
  ],
  rewrite: 'Dear Ms Lee, I would like to take Friday off for my sister’s wedding.',
};

test('the prompt carries the level, key points, sample answer and the learner text', () => {
  const text = buildWritingPrompt({ prompt, answer });
  for (const part of ['Task level (CEFR): A2', 'an email', '20-80 words', '- the reason', 'Sample answer (reference only)', 'Learner text (22 words)', answer]) assert.ok(text.includes(part), part);
  assert.deepEqual(SCHEMA.properties.criteria.required, ['cohesion', 'syntax', 'vocabulary', 'phraseology', 'grammar', 'conventions', 'task']);
  assert.ok(buildWritingPrompt({ prompt: { ...prompt, keyPoints: [] }, answer }).includes('Key points: none given'));
});

test('a Gemini answer is checked: scores snap to 0.5 within 1-5, errors must quote the text, groups and total follow D178', () => {
  const result = parseWritingResult(raw, answer);
  assert.equal(result.criteria.cohesion, 3.5);
  assert.deepEqual(result.errors.map((error) => error.text), ['want take', 'becaus']);
  assert.deepEqual(result.scores, { vocabulary: 3.3, grammar: 2.7, coherence: 3.5, task: 5, total: 3.6 });
  assert.deepEqual(parseWritingResult({ ...raw, criteria: { ...raw.criteria, task: 9, grammar: 0 } }, answer).criteria.task, 5);
  assert.throws(() => parseWritingResult({ ...raw, criteria: { ...raw.criteria, task: 'x' } }, answer), (error) => error.kind === GeminiFailure.BAD_OUTPUT);
});

test('grading opens the sealed key, retries one bad answer, and turns final failures into reasons', async () => {
  const keys = [];
  let calls = 0;
  const gemini = {
    async generateJson(apiKey) {
      keys.push(apiKey);
      calls++;
      if (calls === 1) throw new GeminiError(GeminiFailure.BAD_OUTPUT, 'not json');
      return raw;
    },
  };
  const done = await gradeWriting(job(), { gemini, secret });
  assert.deepEqual([done.submissionId, done.status, done.result.scores.total], ['s1', 'DONE', 3.6]);
  assert.deepEqual(keys, ['AIzaGoodKey1234567890', 'AIzaGoodKey1234567890']);

  const rejecting = { generateJson: async () => { throw new GeminiError(GeminiFailure.KEY, 'bad key'); } };
  assert.deepEqual(await gradeWriting(job(), { gemini: rejecting, secret }), { submissionId: 's1', status: 'FAILED', error: 'Your Gemini key was rejected. Check it in your profile.' });
  const garbage = { generateJson: async () => { throw new GeminiError(GeminiFailure.BAD_OUTPUT, 'x'); } };
  assert.equal((await gradeWriting(job(), { gemini: garbage, secret })).error, 'Gemini did not give a usable score.');
  const busy = { generateJson: async () => { throw new GeminiError(GeminiFailure.QUOTA, 'quota'); } };
  await assert.rejects(() => gradeWriting(job(), { gemini: busy, secret }), (error) => error.retryable);
  assert.match((await gradeWriting(job({ key: { v: 1, iv: 'AA==', data: 'AA==', tag: 'AA==' } }), { gemini, secret })).error, /could not be read/);
  assert.equal((await gradeWriting(job({ answer: undefined }), { gemini, secret })).status, 'FAILED');
});

test('key checks answer VALID, INVALID or UNAVAILABLE', async () => {
  const box = seal('AIzaGoodKey1234567890', secret);
  const answer = (behaviour) => checkKey({ key: box }, { gemini: { checkKey: behaviour }, secret });
  assert.equal((await answer(async () => true)).status, 'VALID');
  assert.equal((await answer(async () => { throw new GeminiError(GeminiFailure.KEY, 'x'); })).status, 'INVALID');
  assert.equal((await answer(async () => { throw new GeminiError(GeminiFailure.QUOTA, 'x'); })).status, 'VALID');
  assert.equal((await answer(async () => { throw new GeminiError(GeminiFailure.UNAVAILABLE, 'x'); })).status, 'UNAVAILABLE');
});

test('the REST client sends the key in a header, asks for JSON and classifies errors', async () => {
  const requests = [];
  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
  const client = new GeminiClient({
    ...loadConfig({}),
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(raw) }] } }] });
    },
  });
  assert.equal(client.model, 'gemini-3.8-flash');
  assert.deepEqual(await client.generateJson('KEY', { system: 'sys', prompt: 'p', schema: SCHEMA }), raw);
  const [{ url, init }] = requests;
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(init.headers['x-goog-api-key'], 'KEY');
  assert.equal(url.includes('KEY'), false);
  const body = JSON.parse(init.body);
  assert.equal(body.generationConfig.temperature, 1);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.equal(body.systemInstruction.parts[0].text, 'sys');

  assert.equal(classify(400, { error: { status: 'INVALID_ARGUMENT', message: 'API key not valid.', details: [{ reason: 'API_KEY_INVALID' }] } }).kind, 'KEY');
  assert.equal(classify(403, {}).kind, 'KEY');
  assert.equal(classify(429, { error: { status: 'RESOURCE_EXHAUSTED' } }).kind, 'QUOTA');
  assert.equal(classify(503, {}).kind, 'UNAVAILABLE');
  assert.equal(classify(400, { error: { message: 'bad field' } }).kind, 'REJECTED');
  const empty = new GeminiClient({ ...loadConfig({}), fetchImpl: async () => reply(200, { candidates: [{ finishReason: 'SAFETY' }] }) });
  await assert.rejects(() => empty.generateJson('KEY', {}), (error) => error.kind === 'BAD_OUTPUT' && /SAFETY/.test(error.message));
  const offline = new GeminiClient({ ...loadConfig({}), fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  await assert.rejects(() => offline.checkKey('KEY'), (error) => error.kind === 'UNAVAILABLE');
});

function fakeChannel() {
  const channel = { sent: [], acked: 0 };
  channel.sendToQueue = (queue, content, options) => channel.sent.push({ queue, body: JSON.parse(content.toString()), options });
  channel.ack = () => channel.acked++;
  return channel;
}
const delivered = (body, attempt = 0) => ({ content: Buffer.from(JSON.stringify(body)), properties: { headers: attempt ? { 'x-attempt': attempt } : {} } });

test('the broker answers results, retries a busy Gemini and gives up after the last retry', async () => {
  const quiet = { log() {}, warn() {} };
  const ok = new WritingBroker({ secret }, { gemini: { generateJson: async () => raw }, logger: quiet });
  const channel = fakeChannel();
  assert.equal(await ok.handleGrading(channel, delivered({ ...job(), requestId: 'req-1' })), 'DONE');
  assert.equal(channel.sent[0].queue, 'writing.grading.results');
  assert.equal(channel.sent[0].body.requestId, 'req-1');
  assert.equal(JSON.stringify(channel.sent[0]).includes('AIza'), false);

  const busy = new WritingBroker({ secret }, { gemini: { generateJson: async () => { throw new GeminiError(GeminiFailure.QUOTA, 'quota'); } }, logger: quiet });
  const retrying = fakeChannel();
  assert.equal(await busy.handleGrading(retrying, delivered(job())), 'retry');
  assert.equal(retrying.sent[0].queue, 'writing.grading.requests.retry.1');
  const last = fakeChannel();
  assert.equal(await busy.handleGrading(last, delivered(job(), 3)), 'give-up');
  assert.deepEqual(last.sent.map((item) => item.queue), ['writing.grading.results', 'writing.grading.requests.dead']);
  assert.equal(last.sent[0].body.error, 'Your Gemini key has used up its quota for now. Try again later.');
  assert.equal(outcomeOf(new Error('boom'), delivered(job())), 'crash');
});
