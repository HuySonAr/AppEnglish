import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
const app = await NestFactory.create(AppModule);
const port = Number(process.env.CONTENT_SERVICE_PORT || 3002);
await app.listen(port);
console.log(`content-service listening on http://localhost:${port}`);
