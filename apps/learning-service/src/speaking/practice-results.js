import amqp from 'amqplib';
import { Logger } from '@nestjs/common';
import { LearningQueue } from '@appenglish/learning-contracts';
import { assertRetryTopology, countMessage, retryOrDead } from '@appenglish/backend-common/messaging';
import { REQUEST_ID_HEADER, runWithRequestId } from '@appenglish/backend-common/observability';

const logger = new Logger('PracticeResults');
const RETRY_MS = 10_000;

export class PracticeResults {
  constructor(url, onResult, { queue = LearningQueue.SPEAKING_RESULTS, requests = LearningQueue.SPEAKING_REQUESTS } = {}) {
    this.url = url;
    this.onResult = onResult;
    this.queue = queue;
    this.requests = requests;
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
        if (!this.stopped) {
          logger.warn('RabbitMQ connection closed; reconnecting');
          setTimeout(() => this.connect(), RETRY_MS);
        }
      });
      const channel = await connection.createChannel();
      await channel.assertQueue(this.requests, { durable: true });
      await channel.assertQueue(this.queue, { durable: true });
      await assertRetryTopology(channel, this.queue);
      await channel.prefetch(10);
      await channel.consume(this.queue, (message) => this.handle(channel, message));
      this.connection = connection;
      logger.log(`Connected to RabbitMQ for ${this.queue}`);
    } catch (error) {
      logger.warn(`RabbitMQ not reachable (${error.message}); retrying in ${RETRY_MS / 1000} s`);
      setTimeout(() => this.connect(), RETRY_MS);
    }
  }

  async handle(channel, message) {
    if (!message) return 'none';
    let answer;
    try {
      answer = JSON.parse(message.content.toString());
    } catch {
      channel.ack(message);
      countMessage(this.queue, 'dropped');
      return 'dropped';
    }
    const requestId = answer?.requestId || message.properties?.headers?.[REQUEST_ID_HEADER];
    return runWithRequestId(requestId, async () => {
      try {
        const outcome = await this.onResult(answer);
        channel.ack(message);
        countMessage(this.queue, outcome === 'duplicate' ? 'duplicate' : 'applied');
        return outcome;
      } catch (error) {
        const outcome = retryOrDead(channel, this.queue, message, error.message);
        logger.warn(`Result for ${answer?.submissionId} not applied (${error.message}); ${outcome === 'dead' ? 'moved to the dead queue' : 'retried later'}`);
        return outcome;
      }
    });
  }

  async stop() {
    this.stopped = true;
    await this.connection?.close().catch(() => {});
  }
}
