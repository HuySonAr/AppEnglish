import { metrics } from '@appenglish/backend-common/metrics';

const total = metrics.counter('http_requests_total', 'HTTP requests answered, by method, route and status class.');
const duration = metrics.histogram('http_request_duration_seconds', 'Time to answer an HTTP request.');

const routeOf = (request) => {
  const route = request.route?.path;
  if (route) return `${request.baseUrl || ''}${route}`;
  return 'unmatched';
};

export function httpMetrics(request, response) {
  const startedAt = process.hrtime.bigint();
  response.on('finish', () => {
    const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
    const route = routeOf(request);
    total.inc({ method: request.method, route, status: `${Math.floor(response.statusCode / 100)}xx` });
    duration.observe({ route }, seconds);
  });
}
