import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
// Lesson drafts carry passages and many questions; the 100kb default is too small.
// A full mock test (200 questions with transcripts) is a large draft.
app.useBodyParser('json', { limit: '8mb' });
// Behind a reverse proxy the client address comes from X-Forwarded-For; the
// rate limits key on it (D117). Off by default so a local run cannot be spoofed.
if (process.env.TRUST_PROXY === 'true') app.getHttpAdapter().getInstance().set('trust proxy', true);
const port = Number(process.env.GATEWAY_PORT || 3000);
await app.listen(port);
console.log(`api-gateway listening on http://localhost:${port}`);
