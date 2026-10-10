// Routes that create, end or rotate the session themselves; a 401 from them is
// a final answer and must not trigger another refresh.
const noRefreshPaths = [
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
  '/auth/logout'
];

// On a 401 the client rotates the refresh cookie once and replays the request.
// Concurrent 401s share one refresh call: refresh tokens are single-use, so a
// second parallel refresh would look like token reuse and revoke the family.
export function installSessionRefresh(client) {
  let refreshing = null;
  client.interceptors.response.use(undefined, async (error) => {
    const config = error.config;
    if (
      error.response?.status !== 401 ||
      !config ||
      config._sessionRetried ||
      noRefreshPaths.some((path) => config.url?.startsWith(path))
    ) {
      throw error;
    }
    config._sessionRetried = true;
    refreshing ??= client.post('/auth/refresh').finally(() => {
      refreshing = null;
    });
    try {
      await refreshing;
    } catch {
      throw error;
    }
    return client(config);
  });
  return client;
}
