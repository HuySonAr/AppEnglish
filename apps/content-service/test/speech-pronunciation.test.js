import test from 'node:test';
import assert from 'node:assert/strict';
import { SpeechQueue } from '@appenglish/content-contracts';
import { ContentService } from '../src/content/content.service.js';
import { SpeechPronunciationSource } from '../src/pronunciation/speech-pronunciation.source.js';
import { createMemoryRepository, teacher } from './memory-repository.js';

const mp3 = (accent) => Buffer.from(`mp3-${accent}`);
function brokerAnswering(reply) {
  const calls = [];
  return {
    calls,
    async request(queue, message, timeoutMs) {
      calls.push({ queue, message, timeoutMs });
      if (reply instanceof Error) throw reply;
      return typeof reply === 'function' ? reply(message) : reply;
    },
  };
}

test('lookup asks speech-service for both accents and returns the audio bytes', async () => {
  const broker = brokerAnswering({
    status: 'DONE',
    word: 'abide by',
    phonetic: { uk: '/əˈbaɪd baɪ/', us: '/əˈbaɪd baɪ/' },
    audio: { uk: mp3('uk').toString('base64'), us: mp3('us').toString('base64') },
  });
  const source = new SpeechPronunciationSource(broker, { timeoutMs: 5000 });
  const entry = await source.lookup('abide by');
  assert.deepEqual(broker.calls, [{ queue: SpeechQueue.PRONOUNCE_REQUESTS, message: { word: 'abide by', accents: ['uk', 'us'] }, timeoutMs: 5000 }]);
  assert.equal(entry.found, true);
  assert.equal(entry.phonetic, '/əˈbaɪd baɪ/');
  assert.deepEqual(await source.download(entry.audio.uk), mp3('uk'));
  const uk = new SpeechPronunciationSource(brokerAnswering({ status: 'DONE', phonetic: { us: '/us/' }, audio: {} }), { ipaAccent: 'uk' });
  assert.equal((await uk.lookup('x')).phonetic, '/us/');
  assert.equal((await uk.lookup('x')).audio.uk, null);
  const both = { status: 'DONE', phonetic: { uk: '/uk/', us: '/us/' }, audio: {} };
  assert.equal((await new SpeechPronunciationSource(brokerAnswering(both)).lookup('x')).phonetic, '/uk/');
  assert.equal((await new SpeechPronunciationSource(brokerAnswering(both), { ipaAccent: 'us' }).lookup('x')).phonetic, '/us/');
});

test('a machine voice speed and a longer wait go with the request', async () => {
  const broker = brokerAnswering({ status: 'DONE', phonetic: {}, audio: { uk: mp3('uk').toString('base64') } });
  await new SpeechPronunciationSource(broker, { timeoutMs: 5000 }).lookup('Hello.', { accents: ['uk'], speed: { wordsPerMinute: 130, sentencePauseSeconds: 0.8 }, timeoutMs: 55000 });
  assert.deepEqual(broker.calls, [{ queue: SpeechQueue.PRONOUNCE_REQUESTS, message: { word: 'Hello.', accents: ['uk'], wordsPerMinute: 130, sentencePauseSeconds: 0.8 }, timeoutMs: 55000 }]);
});

test('a broker that is away or a failed answer is reported as unavailable', async () => {
  await assert.rejects(() => new SpeechPronunciationSource(brokerAnswering(new Error('RabbitMQ is not connected'))).lookup('x'), { name: 'PronunciationUnavailableError' });
  await assert.rejects(() => new SpeechPronunciationSource(brokerAnswering({ status: 'FAILED', error: 'voice missing' })).lookup('x'), { name: 'PronunciationUnavailableError', message: 'voice missing' });
  await assert.rejects(() => new SpeechPronunciationSource(brokerAnswering({})).download(null), { message: 'No audio was made' });
});

test('the editor call stores the generated audio as lesson media and reports it', async () => {
  const repository = createMemoryRepository();
  const storage = {
    async upload(input) {
      return { id: `stored-${input.fileName}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: `https://media.test/${input.fileName}`, storage: 'r2' };
    },
    async delete() {},
  };
  const source = new SpeechPronunciationSource(
    brokerAnswering((message) => ({
      status: 'DONE',
      word: message.word,
      phonetic: { uk: '/ˈskɛdjuːl/', us: '/ˈskɛdʒuːl/' },
      audio: { uk: mp3('uk').toString('base64'), us: mp3('us').toString('base64') },
    })),
  );
  const service = new ContentService(repository, storage, source);
  const { unit } = await service.createUnit(teacher, { title: 'Unit', description: '' });
  const { lesson } = await service.createLesson(teacher, unit.id, { title: 'Lesson' });
  const result = await service.autofillPronunciation(teacher, { word: 'schedule', accents: ['uk', 'us'], lessonId: lesson.id });
  assert.equal(result.found, true);
  assert.equal(result.phonetic, '/ˈskɛdjuːl/');
  assert.deepEqual([result.audio.uk.fileName, result.audio.us.fileName], ['schedule-uk.mp3', 'schedule-us.mp3']);
  assert.equal(repository.tables.media.length, 2);
  assert.equal(repository.tables.media[0].sizeBytes, 6);
  const one = await service.autofillPronunciation(teacher, { word: 'get in touch', accents: ['us'], lessonId: lesson.id });
  assert.deepEqual(Object.keys(one.audio), ['us']);
  assert.equal(one.audio.us.fileName, 'get-in-touch-us.mp3');
});
