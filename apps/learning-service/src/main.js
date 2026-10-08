import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
const app = await NestFactory.create(AppModule);
const port = Number(process.env.LEARNING_SERVICE_PORT || 3003);
await app.listen(port);
console.log(`learning-service listening on http://localhost:${port}`);
