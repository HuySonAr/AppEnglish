import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
const port = Number(process.env.GATEWAY_PORT || 3000);
await app.listen(port);
console.log(`api-gateway listening on http://localhost:${port}`);
