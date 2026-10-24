import amqp from 'amqplib';
import { Logger } from '@nestjs/common';
import { LearningQueue } from '@appenglish/learning-contracts';

const logger = new Logger('AiKeyChecker');
const RETRY_MS = 10_000;

export class AiKeyChecker {
  constructor(url) {
    this.url = url;
    this.channel = null;
    this.pending = new Map();
    this.next = 0;
    this.stopped = false;
  }

  start() {
    this.connect();
  }

  async connect() {
    if (this.stopped) return;
    try {
      const connection = await amqp.connect(this.url);
      connection.on('error', (error) => logger.warn(`RabbitMQ connection error: ${error.message}`));
      connection.on('close', () => {
        this.channel = null;
        if (!this.stopped) setTimeout(() => this.connect(), RETRY_MS);
      });
      const channel = await connection.createChannel();
      await channel.assertQueue(LearningQueue.AI_KEY_CHECKS, { durable: true });
      await channel.assertQueue(LearningQueue.AI_MODEL_LISTS, { durable: true });
      const { queue } = await channel.assertQueue('', { exclusive: true });
      await channel.consume(
        queue,
        (message) => {
          const waiting = message && this.pending.get(message.properties.correlationId);
          if (!waiting) return;
          this.pending.delete(message.properties.correlationId);
          try {
            waiting.resolve(JSON.parse(message.content.toString()));
          } catch (error) {
            waiting.reject(error);
          }
        },
        { noAck: true },
      );
      this.replyQueue = queue;
      this.connection = connection;
      this.channel = channel;
    } catch (error) {
      logger.warn(`RabbitMQ not reachable (${error.message}); retrying in ${RETRY_MS / 1000} s`);
      setTimeout(() => this.connect(), RETRY_MS);
    }
  }

  check(sealedKey, timeoutMs = 25_000) {
    return this.ask(LearningQueue.AI_KEY_CHECKS, sealedKey, timeoutMs);
  }

  listModels(sealedKey, timeoutMs = 25_000) {
    return this.ask(LearningQueue.AI_MODEL_LISTS, sealedKey, timeoutMs);
  }

  ask(queue, sealedKey, timeoutMs) {
    if (!this.channel) return Promise.reject(new Error('RabbitMQ is not connected'));
    const correlationId = `${Date.now()}-${++this.next}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error('writing-service did not answer'));
      }, timeoutMs);
      this.pending.set(correlationId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify({ key: sealedKey })), {
        contentType: 'application/json',
        correlationId,
        replyTo: this.replyQueue,
        expiration: String(timeoutMs),
      });
    });
  }

  async stop() {
    this.stopped = true;
    await this.connection?.close().catch(() => {});
  }
}
