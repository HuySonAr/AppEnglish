import { createServer } from 'node:http';
import { metrics } from '@appenglish/backend-common/metrics';

export const gradingJobs = metrics.counter('grading_jobs_total', 'Gemini grading jobs answered, by task and status.');
export const gradingWork = metrics.histogram('grading_job_seconds', 'Time spent grading one job, retries inside the job included.');
export const keyChecks = metrics.counter('key_checks_total', 'Gemini key checks answered, by status.');

export function startStatusServer(port, { host = '127.0.0.1' } = {}) {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://local').pathname;
    if (request.method === 'GET' && path === '/metrics') {
      response.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' });
      return response.end(await metrics.render());
    }
    if (request.method === 'GET' && path === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      return response.end(JSON.stringify({ status: 'ok', service: 'writing-service' }));
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end('{"status":"not found"}');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
