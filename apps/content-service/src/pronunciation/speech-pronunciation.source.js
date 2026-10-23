import { Accent, SpeechQueue } from '@appenglish/content-contracts';
import { PronunciationUnavailableError } from './dictionary-pronunciation.source.js';

export class SpeechPronunciationSource {
  constructor(broker, { timeoutMs = 30_000, ipaAccent = Accent.UK } = {}) {
    this.broker = broker;
    this.timeoutMs = timeoutMs;
    this.ipaAccent = ipaAccent;
  }

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

  async download(reference) {
    if (!Buffer.isBuffer(reference) || !reference.byteLength) throw new Error('No audio was made');
    return reference;
  }
}
