import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { installSessionRefresh } from './session-refresh.js';

// Fake gateway: protected routes answer 401 until /auth/refresh has succeeded.
function createClient({ refreshStatus = 200 } = {}) {
  const calls = [];
  let refreshed = false;
  const client = axios.create({
    adapter: async (config) => {
      calls.push(config.url);
      await new Promise((resolve) => setImmediate(resolve));
      let status = 200;
      if (config.url === '/auth/refresh') {
        status = refreshStatus;
        refreshed = refreshStatus === 200;
      } else if (config.url === '/auth/login' || !refreshed) {
        status = 401;
      }
      const response = { status, statusText: '', headers: {}, config, data: { code: status === 200 ? 0 : 21 } };
      if (status === 200) return response;
      throw new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response);
    }
  });
  return { client: installSessionRefresh(client), calls };
}

test('a 401 refreshes the session once and replays the request', async () => {
  const { client, calls } = createClient();
  const response = await client.get('/auth/admin/accounts');
  assert.equal(response.status, 200);
  assert.deepEqual(calls, ['/auth/admin/accounts', '/auth/refresh', '/auth/admin/accounts']);
});

test('concurrent 401s share a single refresh call', async () => {
  const { client, calls } = createClient();
  const responses = await Promise.all([client.get('/auth/me'), client.get('/auth/admin/accounts')]);
  assert.deepEqual(responses.map((response) => response.status), [200, 200]);
  assert.equal(calls.filter((url) => url === '/auth/refresh').length, 1);
});

test('a failed refresh surfaces the original 401 without looping', async () => {
  const { client, calls } = createClient({ refreshStatus: 401 });
  await assert.rejects(() => client.get('/auth/me'), (error) => {
    assert.equal(error.response.status, 401);
    assert.equal(error.config.url, '/auth/me');
    return true;
  });
  assert.deepEqual(calls, ['/auth/me', '/auth/refresh']);
});

test('session-creating routes never trigger a refresh', async () => {
  const { client, calls } = createClient();
  await assert.rejects(() => client.post('/auth/login', {}), (error) => error.response.status === 401);
  assert.deepEqual(calls, ['/auth/login']);
});
