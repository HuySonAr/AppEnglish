import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
// Lesson drafts carry passages and many questions; the 100kb default is too small.
app.useBodyParser('json', { limit: '2mb' });
const port = Number(process.env.GATEWAY_PORT || 3000);
await app.listen(port);
console.log(`api-gateway listening on http://localhost:${port}`);
