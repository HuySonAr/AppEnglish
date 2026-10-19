import amqp from 'amqplib';
import { Logger } from '@nestjs/common';
import { LearningQueue } from '@appenglish/learning-contracts';

const logger = new Logger('ResultsConsumer');
const RETRY_MS = 10_000;
const REQUEUE_MS = 5_000;
const PREFETCH = 10;

// Reads the results learning-service publishes on learning.results (F06,
// D110) and hands each to onMessage. A message that cannot be read (bad JSON
// or shape) is dropped with a warning; one the service could not store (for
// example the database away) goes back to the queue after a pause. The
// service starts without the broker and keeps trying to reach it.
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
      await channel.assertQueue(LearningQueue.RESULTS, { durable: true });
      await channel.prefetch(PREFETCH);
      await channel.consume(LearningQueue.RESULTS, (message) => this.handle(channel, message));
      this.connection = connection;
      this.channel = channel;
      logger.log('Connected to RabbitMQ for learning results');
    } catch (error) {
      logger.warn(`RabbitMQ not reachable (${error.message}); retrying in ${RETRY_MS / 1000} s`);
      setTimeout(() => this.connect(), RETRY_MS);
    }
  }

  // Decides what happens to one delivery: ack when applied or unreadable,
  // requeue after a pause when storing failed. Returns the decision for tests.
  async handle(channel, message) {
    if (!message) return 'none';
    let parsed;
    try {
      parsed = JSON.parse(message.content.toString());
    } catch {
      logger.warn('Dropped a learning result that is not JSON');
      channel.ack(message);
      return 'dropped';
    }
    try {
      await this.onMessage(parsed);
      channel.ack(message);
      return 'applied';
    } catch (error) {
      if (error?.name === 'ZodError') {
        logger.warn(`Dropped a learning result of unexpected shape: ${JSON.stringify(error.issues)}`);
        channel.ack(message);
        return 'dropped';
      }
      logger.warn(`Learning result not stored (${error.message}); back to the queue in ${REQUEUE_MS / 1000} s`);
      setTimeout(() => {
        try {
          channel.nack(message, false, true);
        } catch {
          // The channel is gone; the broker redelivers the unacked message itself.
        }
      }, REQUEUE_MS).unref?.();
      return 'requeued';
    }
  }

  get ready() {
    return Boolean(this.channel);
  }

  async stop() {
    this.stopped = true;
    await this.connection?.close().catch(() => {});
  }
}
