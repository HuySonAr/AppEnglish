import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { learningGrpcOptions, learningGrpcUrl } from '@appenglish/learning-contracts/grpc';
import { AppModule } from './app.module.js';
import { JsonLogger } from '@appenglish/backend-common/observability';

const app = await NestFactory.create(AppModule, { logger: new JsonLogger('learning-service') });
app.connectMicroservice({
  transport: Transport.GRPC,
  options: learningGrpcOptions(),
});
await app.startAllMicroservices();
const port = Number(process.env.LEARNING_SERVICE_PORT || 3003);
await app.listen(port);
console.log(
  `learning-service listening on http://localhost:${port} (health) and grpc://${learningGrpcUrl()}`,
);
