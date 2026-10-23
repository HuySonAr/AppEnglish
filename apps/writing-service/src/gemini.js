export const GeminiFailure = Object.freeze({ KEY: 'KEY', QUOTA: 'QUOTA', UNAVAILABLE: 'UNAVAILABLE', BAD_OUTPUT: 'BAD_OUTPUT', REJECTED: 'REJECTED' });

export class GeminiError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'GeminiError';
    this.kind = kind;
  }

  get retryable() {
    return this.kind === GeminiFailure.QUOTA || this.kind === GeminiFailure.UNAVAILABLE;
  }
}

export function classify(status, body) {
  const error = body?.error || {};
  const reasons = (error.details || []).map((detail) => detail?.reason).filter(Boolean);
  const text = `${error.status || ''} ${error.message || ''} ${reasons.join(' ')}`;
  if (status === 401 || status === 403 || reasons.includes('API_KEY_INVALID') || /api key/i.test(text)) return new GeminiError(GeminiFailure.KEY, 'The Gemini key was rejected');
  if (status === 429 || error.status === 'RESOURCE_EXHAUSTED') return new GeminiError(GeminiFailure.QUOTA, 'The Gemini quota of this key is used up for now');
  if (status >= 500) return new GeminiError(GeminiFailure.UNAVAILABLE, 'Gemini is not available right now');
  return new GeminiError(GeminiFailure.REJECTED, `Gemini refused the request (${status})`);
}

async function call(url, init, { fetchImpl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal: controller.signal });
  } catch {
    throw new GeminiError(GeminiFailure.UNAVAILABLE, 'Gemini did not answer in time');
  } finally {
    clearTimeout(timer);
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) throw classify(response.status, body);
  return body;
}

export class GeminiClient {
  constructor({ apiUrl, model, timeoutMs = 90_000, fetchImpl = globalThis.fetch }) {
    this.apiUrl = apiUrl;
    this.model = model;
    this.timeoutMs = timeoutMs;
    this.fetchImpl = fetchImpl;
  }

  headers(apiKey) {
    return { 'content-type': 'application/json', 'x-goog-api-key': apiKey };
  }

  async checkKey(apiKey) {
    await call(`${this.apiUrl}/models/${encodeURIComponent(this.model)}`, { method: 'GET', headers: this.headers(apiKey) }, { fetchImpl: this.fetchImpl, timeoutMs: 20_000 });
    return true;
  }

  async generateJson(apiKey, { system, prompt, schema }) {
    const body = await call(
      `${this.apiUrl}/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: 'POST',
        headers: this.headers(apiKey),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 1, responseMimeType: 'application/json', responseSchema: schema },
        }),
      },
      { fetchImpl: this.fetchImpl, timeoutMs: this.timeoutMs },
    );
    const text = (body?.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('');
    if (!text) throw new GeminiError(GeminiFailure.BAD_OUTPUT, `Gemini gave no answer (${body?.candidates?.[0]?.finishReason || body?.promptFeedback?.blockReason || 'empty'})`);
    try {
      return JSON.parse(text);
    } catch {
      throw new GeminiError(GeminiFailure.BAD_OUTPUT, 'Gemini did not answer in JSON');
    }
  }
}
