import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import {
  DictionaryPronunciationSource,
  PronunciationUnavailableError,
} from '../src/pronunciation/dictionary-pronunciation.source.js';
import { createMemoryRepository, manager, student } from './memory-repository.js';

const base = 'https://dictionary.test/api/v2/entries/en';
const media = (name) => `https://dictionary.test/media/${name}`;
const json = (body, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(body) });
const html = (status) => ({ ok: false, status, text: async () => '<!DOCTYPE html><html>404 page</html>' });

function sourceWith(responses) {
  const calls = [];
  const source = new DictionaryPronunciationSource({
    baseUrl: base,
    retryDelayMs: 1,
    fetchImpl: async (url) => {
      calls.push(String(url));
      const next = responses.shift();
      if (next instanceof Error) throw next;
      return next;
    },
  });
  return { source, calls };
}

test('lookup returns IPA and the first British and American audio', async () => {
  const { source, calls } = sourceWith([
    json([
      { word: 'contract', phonetics: [{ text: '/ˈkɒntɹækt/', audio: media('contract-1-uk.mp3') }, { audio: media('contract-1-us.mp3') }] },
      { word: 'contract', phonetic: '/kənˈtɹækt/', phonetics: [{ audio: media('contract-2-uk.mp3') }, { audio: media('contract-au.mp3') }] },
    ]),
  ]);
  assert.deepEqual(await source.lookup('contract'), {
    found: true,
    phonetic: '/kənˈtɹækt/',
    audio: { uk: media('contract-1-uk.mp3'), us: media('contract-1-us.mp3') },
  });
  assert.deepEqual(calls, [`${base}/contract`]);
});

test('lookup reports missing accents and encodes phrases', async () => {
  const { source, calls } = sourceWith([json([{ phonetics: [{ text: '/ˈtɪkɪt/', audio: media('ticket-us.mp3') }, { audio: '' }] }])]);
  assert.deepEqual(await source.lookup('abide by'), { found: true, phonetic: '/ˈtɪkɪt/', audio: { uk: null, us: media('ticket-us.mp3') } });
  assert.equal(calls[0], `${base}/abide%20by`);
});

test('lookup retries error pages and timeouts, then tells a real miss apart', async () => {
  let { source, calls } = sourceWith([html(404), new Error('timeout'), json([{ phonetic: '/a/', phonetics: [] }])]);
  assert.equal((await source.lookup('agreement')).phonetic, '/a/');
  assert.equal(calls.length, 3);

  ({ source, calls } = sourceWith([json({ title: 'No Definitions Found' }, 404)]));
  assert.deepEqual(await source.lookup('zzzz'), { found: false, phonetic: '', audio: { uk: null, us: null } });
  assert.equal(calls.length, 1);

  ({ source, calls } = sourceWith([html(522), html(404), html(404), html(404), html(404), json([])]));
  await assert.rejects(() => source.lookup('ticket'), PronunciationUnavailableError);
  assert.equal(calls.length, 5);
});

test('download only fetches HTTPS files on the dictionary host and limits size', async () => {
  const audio = (bytes, ok = true) => ({ ok, status: ok ? 200 : 404, arrayBuffer: async () => new Uint8Array(bytes).buffer });
  let { source, calls } = sourceWith([audio(10)]);
  assert.equal((await source.download(media('a-uk.mp3'))).byteLength, 10);
  for (const url of ['https://elsewhere.test/a-uk.mp3', 'http://dictionary.test/media/a-uk.mp3', 'file:///etc/passwd'])
    await assert.rejects(() => source.download(url), /outside the dictionary host/);
  assert.equal(calls.length, 1);
  ({ source } = sourceWith([audio(0), audio(3 * 1024 * 1024), audio(10, false)]));
  for (let index = 0; index < 3; index++) await assert.rejects(() => source.download(media('a-uk.mp3')));
});

function serviceWith(pronunciationSource) {
  const repository = createMemoryRepository();
  const storage = {
    async upload(input) {
      return { id: `stored-${input.fileName}`, kind: input.kind, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, url: 'http://localhost:3002/media/x', storage: 'local' };
    },
  };
  return { service: new ContentService(repository, storage, pronunciationSource), repository };
}

test('auto-fill stores the audio it finds and reports what is missing', async () => {
  const downloads = [];
  const { service, repository } = serviceWith({
    async lookup(word) {
      return { found: true, phonetic: '/əˈbaɪd baɪ/', audio: { uk: media(`${word}-uk.mp3`), us: null } };
    },
    async download(url) {
      downloads.push(url);
      return Buffer.from([1, 2, 3]);
    },
  });
  await assert.rejects(() => service.autofillPronunciation(student, { word: 'abide by', accents: ['uk', 'us'] }), { code: 26 });
  const result = await service.autofillPronunciation(manager, { word: 'Abide By', accents: ['uk', 'us'] });
  assert.equal(result.found, true);
  assert.equal(result.phonetic, '/əˈbaɪd baɪ/');
  assert.equal(result.audio.us, null);
  assert.equal(result.audio.uk.fileName, 'abide-by-uk.mp3');
  assert.equal(result.audio.uk.kind, 'audio');
  assert.equal(repository.tables.media.length, 1);
  assert.equal(repository.tables.media[0].id, result.audio.uk.id);

  // Only the requested accents are downloaded.
  downloads.length = 0;
  const onlyUs = await service.autofillPronunciation(manager, { word: 'ticket', accents: ['us'] });
  assert.deepEqual(downloads, []);
  assert.deepEqual(onlyUs.audio, { us: null });
});

test('auto-fill survives a failed download and maps an unavailable dictionary to 503', async () => {
  let { service, repository } = serviceWith({
    async lookup() { return { found: true, phonetic: '/x/', audio: { uk: media('x-uk.mp3'), us: media('x-us.mp3') } }; },
    async download(url) {
      if (url.includes('-uk')) throw new Error('timeout');
      return Buffer.from([1]);
    },
  });
  const result = await service.autofillPronunciation(manager, { word: 'x', accents: ['uk', 'us'] });
  assert.equal(result.audio.uk, null);
  assert.equal(result.audio.us.fileName, 'x-us.mp3');
  assert.equal(repository.tables.media.length, 1);

  ({ service } = serviceWith({ async lookup() { throw new PronunciationUnavailableError('down'); } }));
  await assert.rejects(() => service.autofillPronunciation(manager, { word: 'x', accents: ['uk'] }), { code: 44, status: 503 });
  ({ service } = serviceWith({ async lookup() { return { found: false, phonetic: '', audio: { uk: null, us: null } }; } }));
  assert.deepEqual(await service.autofillPronunciation(manager, { word: 'zzzz', accents: ['uk', 'us'] }), { found: false, phonetic: '', audio: { uk: null, us: null } });
});
