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
