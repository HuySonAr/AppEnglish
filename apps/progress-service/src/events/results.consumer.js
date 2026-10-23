import amqp from 'amqplib';
import { Logger } from '@nestjs/common';
import { LearningQueue } from '@appenglish/learning-contracts';
import { assertRetryTopology, countMessage, retryOrDead, sendToDead } from '@appenglish/backend-common/messaging';
import { runWithRequestId } from '@appenglish/backend-common/observability';

const logger = new Logger('ResultsConsumer');
const RETRY_MS = 10_000;
const PREFETCH = 10;
const QUEUE = LearningQueue.RESULTS;

export class ResultsConsumer {
  constructor(url) {
    this.url = url;
    this.channel = null;
    this.stopped = false;
  }

  start(onMessage) {
    this.onMessage = onMessage;
    this.connect();
  }

  async connect() {
    if (this.stopped) return;
    try {
      const connection = await amqp.connect(this.url);
      connection.on('error', (error) => logger.warn(`RabbitMQ connection error: ${error.message}`));
      connection.on('close', () => {
        this.channel = null;
        if (!this.stopped) {
          logger.warn('RabbitMQ connection closed; reconnecting');
          setTimeout(() => this.connect(), RETRY_MS);
        }
      });
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      await assertRetryTopology(channel, QUEUE);
      await channel.prefetch(PREFETCH);
      await channel.consume(QUEUE, (message) => this.handle(channel, message).catch((error) => logger.warn(`Learning result left for redelivery: ${error.message}`)));
      this.connection = connection;
      this.channel = channel;
      logger.log('Connected to RabbitMQ for learning results');
    } catch (error) {
      logger.warn(`RabbitMQ not reachable (${error.message}); retrying in ${RETRY_MS / 1000} s`);
      setTimeout(() => this.connect(), RETRY_MS);
    }
  }

  async handle(channel, message) {
    if (!message) return 'none';
    let parsed;
    try {
      parsed = JSON.parse(message.content.toString());
    } catch {
      logger.warn('A learning result that is not JSON went to the dead queue');
      return sendToDead(channel, QUEUE, message, 'not JSON');
    }
    return runWithRequestId(parsed?.requestId, async () => {
      try {
        const outcome = await this.onMessage(parsed);
        channel.ack(message);
        const result = outcome === 'duplicate' ? 'duplicate' : 'applied';
        countMessage(QUEUE, result);
        return result;
      } catch (error) {
        if (error?.name === 'ZodError') {
          logger.warn(`A learning result of unexpected shape went to the dead queue: ${JSON.stringify(error.issues)}`);
          return sendToDead(channel, QUEUE, message, 'unexpected shape');
        }
        const outcome = retryOrDead(channel, QUEUE, message, error.message);
        logger.warn(`Learning result ${parsed?.id} not stored (${error.message}); ${outcome === 'dead' ? 'moved to the dead queue' : 'retried later'}`);
        return outcome;
      }
    });
  }

  get ready() {
    return Boolean(this.channel);
  }

  async stop() {
    this.stopped = true;
    await this.connection?.close().catch(() => {});
  }
}
