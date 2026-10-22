import { Accent, SpeechQueue } from '@appenglish/content-contracts';
import { PronunciationUnavailableError } from './dictionary-pronunciation.source.js';

// Pronunciation made by speech-service (D123): IPA and MP3 in British and
// American English from Piper, asked over RabbitMQ and answered at once. No
// outside service, and a phrase works like a word. The lookup returns the
// audio bytes themselves as the "download references".
export class SpeechPronunciationSource {
  constructor(broker, { timeoutMs = 30_000, ipaAccent = Accent.UK } = {}) {
    this.broker = broker;
    this.timeoutMs = timeoutMs;
    this.ipaAccent = ipaAccent;
  }

  // Returns { found, phonetic, audio: { uk, us } } with MP3 buffers or null.
  async lookup(word) {
    let reply;
    try {
      reply = await this.broker.request(SpeechQueue.PRONOUNCE_REQUESTS, { word, accents: Object.values(Accent) }, this.timeoutMs);
    } catch (error) {
      throw new PronunciationUnavailableError(`speech-service is not answering (${error.message})`);
    }
    if (reply?.status !== 'DONE') throw new PronunciationUnavailableError(reply?.error || 'speech-service could not pronounce the word');
    const phonetic = reply.phonetic || {};
    const audio = reply.audio || {};
    const toBuffer = (base64) => (base64 ? Buffer.from(base64, 'base64') : null);
    return {
      found: true,
      phonetic: phonetic[this.ipaAccent] || Object.values(phonetic).find(Boolean) || '',
      audio: { [Accent.UK]: toBuffer(audio.uk), [Accent.US]: toBuffer(audio.us) },
    };
  }

  // The lookup already carries the bytes.
  async download(reference) {
    if (!Buffer.isBuffer(reference) || !reference.byteLength) throw new Error('No audio was made');
    return reference;
  }
}
