import test from 'node:test';
import assert from 'node:assert/strict';
import { gradingJobs, startStatusServer } from '../src/status-server.js';

test('the status port serves metrics and health only', async () => {
  gradingJobs.inc({ task: 'writing', status: 'DONE' });
  const server = await startStatusServer(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const metrics = await (await fetch(`${base}/metrics`)).text();
    assert.match(metrics, /grading_jobs_total\{status="DONE",task="writing"\} 1/);
    assert.match(metrics, /process_uptime_seconds/);
    assert.deepEqual(await (await fetch(`${base}/health`)).json(), { status: 'ok', service: 'writing-service' });
    assert.equal((await fetch(`${base}/other`)).status, 404);
  } finally {
    server.close();
  }
});
