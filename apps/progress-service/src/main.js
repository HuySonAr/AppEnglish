import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
const app = await NestFactory.create(AppModule);
const port = Number(process.env.PROGRESS_SERVICE_PORT || 3004);
await app.listen(port);
console.log(`progress-service listening on http://localhost:${port}`);
