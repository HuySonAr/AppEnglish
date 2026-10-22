import { HealthResponseDto } from './health.dto.js';

// The backend services the admin dashboard watches (D115): each one's HTTP
// health port comes from the environment, like the gateway's own.
const serviceSpecs = Object.freeze([
  { name: 'content-service', port: 'CONTENT_SERVICE_PORT', fallback: 3002 },
  { name: 'learning-service', port: 'LEARNING_SERVICE_PORT', fallback: 3003 },
  { name: 'progress-service', port: 'PROGRESS_SERVICE_PORT', fallback: 3004 },
]);

const PROBE_TIMEOUT_MS = 2000;

export class HealthService {
  check() {
    return new HealthResponseDto({
      service: 'api-gateway',
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  }

  // Asks every service whether it is up (D115). auth-service answers over
  // gRPC (`Ready`, with its database); the others over their HTTP /health.
  // A service that does not answer within the timeout is 'down'; the
  // dashboard shows the list, never fails because of one service.
  async probeServices({ authReady, env = process.env, fetchImpl = fetch } = {}) {
    const probes = [
      this.probe('auth-service', async () => {
        const { status, payload } = await authReady();
        if (status >= 400) return { status: 'down', detail: payload?.data?.message || 'not ready' };
        return { status: 'ok', database: payload.data?.database || 'ok' };
      }),
      ...serviceSpecs.map((spec) =>
        this.probe(spec.name, async () => {
          const port = env[spec.port] || spec.fallback;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
          try {
            const response = await fetchImpl(`http://localhost:${port}/health`, { signal: controller.signal });
            if (!response.ok) return { status: 'down', detail: `HTTP ${response.status}` };
            const body = await response.json().catch(() => ({}));
            return { status: body.status === 'ok' ? 'ok' : 'down', detail: body.status === 'ok' ? undefined : String(body.status || 'unknown') };
          } finally {
            clearTimeout(timer);
          }
        }),
      ),
      // The Python worker answers through content-service (D133).
      this.probe('speech-service', async () => {
        const port = env.CONTENT_SERVICE_PORT || 3002;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
        try {
          const response = await fetchImpl(`http://localhost:${port}/health/speech`, { signal: controller.signal });
          if (!response.ok) return { status: 'down', detail: `HTTP ${response.status}` };
          const body = await response.json().catch(() => ({}));
          return body.status === 'ok' ? { status: 'ok' } : { status: 'down', detail: body.detail || 'down' };
        } finally {
          clearTimeout(timer);
        }
      }),
    ];
    const services = await Promise.all(probes);
    return {
      checkedAt: new Date().toISOString(),
      status: services.every((service) => service.status === 'ok') ? 'ok' : 'degraded',
      services,
    };
  }

  async probe(name, run) {
    const started = Date.now();
    try {
      const result = await run();
      return { name, ...result, latencyMs: Date.now() - started };
    } catch (error) {
      return { name, status: 'down', detail: error?.name === 'AbortError' ? 'timeout' : 'unreachable', latencyMs: Date.now() - started };
    }
  }
}
