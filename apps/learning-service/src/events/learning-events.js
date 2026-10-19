import amqp from 'amqplib';
import { Logger } from '@nestjs/common';
import { LearningQueue } from '@appenglish/learning-contracts';

const logger = new Logger('LearningEvents');
const RETRY_MS = 10_000;
const RELAY_MS = 5_000;
const BATCH = 100;

// RabbitMQ side of the outbox: a confirm channel on the learning.results
// queue. The service starts without the broker and keeps trying to reach it.
export class RabbitTransport {
  constructor(url) {
    this.url = url;
    this.channel = null;
    this.stopped = false;
  }

  // onReady runs every time the broker is (re)connected.
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

  // Resolves once the broker has confirmed the persistent message.
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

// Results leaving learning-service for progress-service (F06, D110). An event
// is first written to learning_events, next to the result it reports (an
// outbox), and relayed to RabbitMQ afterwards: right away when the broker is
// there, otherwise as soon as it is back. So progress may lag, but never
// misses a result. transport is replaceable in tests.
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

  // Writes one event and tries to relay it. A failure to write is logged, not
  // thrown: the learner's result is already saved and must be answered.
  async record(type, payload) {
    let event;
    try {
      event = await this.repository.addEvent({ type, payload, createdAt: this.now(), publishedAt: null });
    } catch (error) {
      logger.error(`Result event ${type} not recorded: ${error.message}`);
      return null;
    }
    this.flush().catch(() => {});
    return event;
  }

  // Relays the pending events in order; one at a time across callers.
  async flush() {
    if (!this.transport.ready || this.flushing) return;
    this.flushing = true;
    try {
      const pending = await this.repository.listPendingEvents(BATCH);
      for (const event of pending) {
        await this.transport.send({
          id: event.id,
          type: event.type,
          occurredAt: new Date(event.createdAt).toISOString(),
          payload: event.payload,
        });
        await this.repository.markPublished(event.id, this.now());
      }
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

// For services built without a publisher (tests): records nothing.
export const noEvents = Object.freeze({ record: async () => null });
