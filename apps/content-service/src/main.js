import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { contentGrpcOptions, contentGrpcUrl } from '@appenglish/content-contracts/grpc';
import { AppModule } from './app.module.js';
import { JsonLogger } from '@appenglish/backend-common/observability';

const app = await NestFactory.create(AppModule, { logger: new JsonLogger('content-service') });
app.connectMicroservice({
  transport: Transport.GRPC,
  options: contentGrpcOptions(),
});
await app.startAllMicroservices();
const port = Number(process.env.CONTENT_SERVICE_PORT || 3002);
await app.listen(port);
console.log(
  `content-service listening on http://localhost:${port} (health) and grpc://${contentGrpcUrl()}`,
);
