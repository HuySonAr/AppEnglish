import amqp from 'amqplib';
import { Logger } from '@nestjs/common';
import { LearningEventType, LearningQueue } from '@appenglish/learning-contracts';
import { metrics } from '@appenglish/backend-common/metrics';
import { currentRequestId } from '@appenglish/backend-common/observability';

const published = metrics.counter('outbox_published_total', 'Outbox events sent to the broker.');
const pendingGauge = metrics.gauge('outbox_pending', 'Outbox events not sent yet (last relay).');

const logger = new Logger('LearningEvents');
const RETRY_MS = 10_000;
const RELAY_MS = 5_000;
const BATCH = 100;

export class RabbitTransport {
  constructor(url) {
    this.url = url;
    this.channel = null;
    this.stopped = false;
  }

  start(onReady) {
    this.onReady = onReady;
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
      const channel = await connection.createConfirmChannel();
      await channel.assertQueue(LearningQueue.RESULTS, { durable: true });
      this.connection = connection;
      this.channel = channel;
      logger.log('Connected to RabbitMQ for learning results');
      this.onReady?.();
    } catch (error) {
      logger.warn(`RabbitMQ not reachable (${error.message}); retrying in ${RETRY_MS / 1000} s`);
      setTimeout(() => this.connect(), RETRY_MS);
    }
  }

  get ready() {
    return Boolean(this.channel);
  }

  send(message) {
    return new Promise((resolve, reject) => {
      this.channel.sendToQueue(
        LearningQueue.RESULTS,
        Buffer.from(JSON.stringify(message)),
        { persistent: true, contentType: 'application/json', messageId: message.id },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

  async stop() {
    this.stopped = true;
    await this.connection?.close().catch(() => {});
  }
}

export class LearningEvents {
  constructor(repository, { url = 'amqp://localhost:5672', transport = new RabbitTransport(url), now = () => new Date() } = {}) {
    this.repository = repository;
    this.transport = transport;
    this.now = now;
    this.flushing = false;
  }

  start() {
    this.transport.start(() => this.flush());
    this.timer = setInterval(() => this.flush(), RELAY_MS);
    this.timer.unref?.();
  }

  async record(type, payload) {
    let event;
    try {
      event = await this.repository.addEvent({ type, payload, requestId: currentRequestId(), createdAt: this.now(), publishedAt: null });
    } catch (error) {
      logger.error(`Result event ${type} not recorded: ${error.message}`);
      return null;
    }
    this.flush().catch(() => {});
    return event;
  }

  async flush() {
    if (!this.transport.ready || this.flushing) return;
    this.flushing = true;
    try {
      const pending = await this.repository.listPendingEvents(BATCH);
      pendingGauge.set({ outbox: 'learning_events' }, pending.length);
      for (const event of pending) {
        await this.transport.send({
          id: event.id,
          type: event.type,
          occurredAt: new Date(event.createdAt).toISOString(),
          ...(event.requestId ? { requestId: event.requestId } : {}),
          payload: event.payload,
        });
        await this.repository.markPublished(event.id, this.now());
        published.inc({ outbox: 'learning_events' });
      }
      pendingGauge.set({ outbox: 'learning_events' }, 0);
    } catch (error) {
      logger.warn(`Result events not relayed: ${error.message}`);
    } finally {
      this.flushing = false;
    }
  }

  async stop() {
    clearInterval(this.timer);
    await this.transport.stop?.();
  }
}

export const noEvents = Object.freeze({ record: async () => null });

export function recordActivity(events, accountId, activity, at = new Date()) {
  return events.record(LearningEventType.ACTIVITY_RECORDED, { accountId, activity, occurredAt: at.toISOString() });
}
