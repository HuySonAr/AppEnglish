export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta';

export function loadConfig(source = process.env) {
  return {
    rabbitmqUrl: source.RABBITMQ_URL || 'amqp://localhost:5672',
    model: source.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    apiUrl: (source.GEMINI_API_URL || GEMINI_API_URL).replace(/\/$/, ''),
    timeoutMs: Number(source.GEMINI_TIMEOUT_MS || 90_000),
    secret: source.GEMINI_KEY_SECRET || '',
    concurrency: Math.max(1, Number(source.WRITING_CONCURRENCY || 2)),
    port: Number(source.WRITING_SERVICE_PORT || 3005),
  };
}
