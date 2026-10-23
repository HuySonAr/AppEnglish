import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { progressGrpcOptions, progressGrpcUrl } from '@appenglish/progress-contracts/grpc';
import { AppModule } from './app.module.js';
import { JsonLogger } from '@appenglish/backend-common/observability';

const app = await NestFactory.create(AppModule, { logger: new JsonLogger('progress-service') });
app.connectMicroservice({
  transport: Transport.GRPC,
  options: progressGrpcOptions(),
});
await app.startAllMicroservices();
const port = Number(process.env.PROGRESS_SERVICE_PORT || 3004);
await app.listen(port);
console.log(
  `progress-service listening on http://localhost:${port} (health) and grpc://${progressGrpcUrl()}`,
);
