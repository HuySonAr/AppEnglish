export const PRONUNCIATION_SOURCE = Symbol('PRONUNCIATION_SOURCE');

export class PronunciationUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PronunciationUnavailableError';
  }
}

const accentPatterns = { uk: /-uk\.mp3$/i, us: /-us\.mp3$/i };

// Looks up IPA and British/American audio in the free dictionary API
// (dictionaryapi.dev). The service intermittently answers with an HTML error
// page or a gateway timeout for words it does have, so lookups are retried.
// Many entries have only one accent; missing parts come back as null.
export class DictionaryPronunciationSource {
  constructor({
    baseUrl = 'https://api.dictionaryapi.dev/api/v2/entries/en',
    fetchImpl = fetch,
    attempts = 5,
    retryDelayMs = 400,
    lookupTimeoutMs = 6000,
    lookupBudgetMs = 20000,
    downloadTimeoutMs = 25000,
    maxAudioBytes = 2 * 1024 * 1024,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
    this.attempts = attempts;
    this.retryDelayMs = retryDelayMs;
    this.lookupTimeoutMs = lookupTimeoutMs;
    this.lookupBudgetMs = lookupBudgetMs;
    this.downloadTimeoutMs = downloadTimeoutMs;
    this.maxAudioBytes = maxAudioBytes;
  }

  // Returns { found, phonetic, audio: { uk, us } } with URLs or null.
  async lookup(word) {
    const url = `${this.baseUrl}/${encodeURIComponent(word)}`;
    const deadline = Date.now() + this.lookupBudgetMs;
    for (let attempt = 1; attempt <= this.attempts && Date.now() < deadline; attempt++) {
      if (attempt > 1) await new Promise((resolve) => setTimeout(resolve, this.retryDelayMs));
      let body;
      try {
        const response = await this.fetch(url, {
          signal: AbortSignal.timeout(this.lookupTimeoutMs),
        });
        body = JSON.parse(await response.text());
      } catch {
        continue; // timeout, network error or a non-JSON error page
      }
      // A real miss is a JSON object; entries come as an array.
      if (!Array.isArray(body)) return { found: false, phonetic: '', audio: { uk: null, us: null } };
      const phonetics = body.flatMap((entry) => entry.phonetics || []);
      const audioUrls = phonetics.map((item) => item.audio).filter(Boolean);
      return {
        found: true,
        phonetic:
          body.map((entry) => entry.phonetic).find(Boolean) ||
          phonetics.map((item) => item.text).find(Boolean) ||
          '',
        audio: {
          uk: audioUrls.find((item) => accentPatterns.uk.test(item)) || null,
          us: audioUrls.find((item) => accentPatterns.us.test(item)) || null,
        },
      };
    }
    throw new PronunciationUnavailableError('Dictionary service did not answer');
  }

  // Downloads one audio file the lookup returned. Only HTTPS URLs on the
  // dictionary's own host are fetched.
  async download(audioUrl) {
    const target = new URL(audioUrl);
    if (target.protocol !== 'https:' || target.host !== new URL(this.baseUrl).host)
      throw new Error('Audio URL is outside the dictionary host');
    const response = await this.fetch(target, {
      signal: AbortSignal.timeout(this.downloadTimeoutMs),
    });
    if (!response.ok) throw new Error(`Audio download failed with ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.byteLength || data.byteLength > this.maxAudioBytes)
      throw new Error('Audio file is empty or too large');
    return data;
  }
}

export function createPronunciationSource(source = process.env) {
  return new DictionaryPronunciationSource(
    source.DICTIONARY_API_URL ? { baseUrl: source.DICTIONARY_API_URL } : {},
  );
}
