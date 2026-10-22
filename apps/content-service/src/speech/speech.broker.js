import amqp from 'amqplib';
import { Logger } from '@nestjs/common';
import { SpeechQueue } from '@appenglish/content-contracts';

const logger = new Logger('SpeechBroker');
const RETRY_MS = 10_000;

// RabbitMQ link to speech-service for auto-time (D97): publishes requests to
// speech.autotime.requests and hands every answer read from
// speech.autotime.results to onResult. The service starts without the
// broker and keeps trying to reach it; a request while it is away fails.
export class SpeechBroker {
  constructor(url) {
    this.url = url;
    this.channel = null;
    this.stopped = false;
    // Requests waiting for their reply (D123), by correlation id.
    this.pending = new Map();
    this.nextCorrelation = 0;
  }

  start(onResult) {
    this.onResult = onResult;
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
      await channel.assertQueue(SpeechQueue.AUTOTIME_REQUESTS, { durable: true });
      await channel.assertQueue(SpeechQueue.AUTOTIME_RESULTS, { durable: true });
      await channel.consume(SpeechQueue.AUTOTIME_RESULTS, async (message) => {
        if (!message) return;
        try {
          await this.onResult?.(JSON.parse(message.content.toString()));
        } catch (error) {
          logger.warn(`Auto-time answer not applied: ${error.message}`);
        }
        channel.ack(message);
      });
      // Replies to this service's own requests (D123) arrive on a private queue.
      await channel.assertQueue(SpeechQueue.PRONOUNCE_REQUESTS, { durable: true });
      const { queue: replyQueue } = await channel.assertQueue('', { exclusive: true });
      await channel.consume(
        replyQueue,
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
      this.replyQueue = replyQueue;
      this.connection = connection;
      this.channel = channel;
      logger.log('Connected to RabbitMQ for auto-time and pronunciation');
    } catch (error) {
      logger.warn(`RabbitMQ not reachable (${error.message}); retrying in ${RETRY_MS / 1000} s`);
      setTimeout(() => this.connect(), RETRY_MS);
    }
  }

  // Whether a speech-service worker listens (System health, D133): the
  // number of consumers on the two request queues. A worker started before
  // D123 serves auto-time only.
  async workerStatus() {
    if (!this.channel) return { status: 'down', detail: 'RabbitMQ not connected' };
    const [autotime, pronounce] = await Promise.all([
      this.channel.checkQueue(SpeechQueue.AUTOTIME_REQUESTS),
      this.channel.checkQueue(SpeechQueue.PRONOUNCE_REQUESTS),
    ]);
    const workers = { autotime: autotime.consumerCount, pronounce: pronounce.consumerCount };
    if (workers.autotime && workers.pronounce) return { status: 'ok', workers };
    if (!workers.autotime && !workers.pronounce) return { status: 'down', detail: 'no worker running', workers };
    return { status: 'down', detail: workers.pronounce ? 'auto-time not served' : 'pronunciation not served: restart the worker', workers };
  }

  // True when a request can be sent now.
  get ready() {
    return Boolean(this.channel);
  }

  // Sends one auto-time request; false when the broker cannot be reached.
  publish(message) {
    if (!this.channel) return false;
    this.channel.sendToQueue(SpeechQueue.AUTOTIME_REQUESTS, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      contentType: 'application/json',
    });
    return true;
  }

  // Sends a request on `queue` and resolves with the answer speech-service
  // sends back (D123); rejects after timeoutMs or when the broker is away.
  request(queue, message, timeoutMs = 30_000) {
    if (!this.channel) return Promise.reject(new Error('RabbitMQ is not connected'));
    const correlationId = `${Date.now()}-${++this.nextCorrelation}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId);
        reject(new Error(`speech-service did not answer within ${timeoutMs / 1000} s`));
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
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        contentType: 'application/json',
        correlationId,
        replyTo: this.replyQueue,
      });
    });
  }

  async stop() {
    this.stopped = true;
    await this.connection?.close().catch(() => {});
  }
}
