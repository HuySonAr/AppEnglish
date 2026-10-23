import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { authGrpcOptions, authGrpcUrl } from '@appenglish/auth-contracts/grpc';
import { AppModule } from './app.module.js';
import { JsonLogger } from '@appenglish/backend-common/observability';

const app = await NestFactory.create(AppModule, { logger: new JsonLogger('auth-service') });
app.connectMicroservice({
  transport: Transport.GRPC,
  options: authGrpcOptions(),
});
await app.startAllMicroservices();
const port = Number(process.env.AUTH_SERVICE_PORT || 3001);
await app.listen(port);
console.log(
  `auth-service listening on http://localhost:${port} (health) and grpc://${authGrpcUrl()}`,
);
