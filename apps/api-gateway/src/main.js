import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { JsonLogger, REQUEST_ID_HEADER, cleanRequestId, newRequestId, runWithRequestId } from '@appenglish/backend-common/observability';
import { httpMetrics } from './metrics/http-metrics.js';

const app = await NestFactory.create(AppModule, { logger: new JsonLogger('api-gateway') });
app.use((request, response, next) => {
  const requestId = cleanRequestId(request.headers[REQUEST_ID_HEADER]) || newRequestId();
  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  httpMetrics(request, response);
  runWithRequestId(requestId, next);
});
app.useBodyParser('json', { limit: '8mb' });
if (process.env.TRUST_PROXY === 'true') app.getHttpAdapter().getInstance().set('trust proxy', true);
const port = Number(process.env.GATEWAY_PORT || 3000);
await app.listen(port);
console.log(`api-gateway listening on http://localhost:${port}`);
