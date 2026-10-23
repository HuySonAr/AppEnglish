import amqp from 'amqplib';
import { Logger } from '@nestjs/common';
import { SpeechQueue } from '@appenglish/content-contracts';
import { assertRetryTopology, countMessage, retryOrDead } from '@appenglish/backend-common/messaging';
import { REQUEST_ID_HEADER, runWithRequestId } from '@appenglish/backend-common/observability';

const logger = new Logger('SpeechBroker');
const RETRY_MS = 10_000;

export class SpeechBroker {
  constructor(url) {
    this.url = url;
    this.channel = null;
    this.stopped = false;
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
      const channel = await connection.createConfirmChannel();
      await channel.assertQueue(SpeechQueue.AUTOTIME_REQUESTS, { durable: true });
      await channel.assertQueue(SpeechQueue.AUTOTIME_RESULTS, { durable: true });
      await assertRetryTopology(channel, SpeechQueue.AUTOTIME_RESULTS);
      await channel.consume(SpeechQueue.AUTOTIME_RESULTS, (message) => this.handleResult(channel, message).catch((error) => logger.warn(`Speech answer left for redelivery: ${error.message}`)));
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
      this.onConnected?.();
    } catch (error) {
      logger.warn(`RabbitMQ not reachable (${error.message}); retrying in ${RETRY_MS / 1000} s`);
      setTimeout(() => this.connect(), RETRY_MS);
    }
  }

  async handleResult(channel, message) {
    if (!message) return 'none';
    let answer;
    try {
      answer = JSON.parse(message.content.toString());
    } catch {
      channel.ack(message);
      countMessage(SpeechQueue.AUTOTIME_RESULTS, 'dropped');
      return 'dropped';
    }
    const requestId = answer?.requestId || message.properties?.headers?.[REQUEST_ID_HEADER];
    return runWithRequestId(requestId, async () => {
      try {
        const outcome = await this.onResult?.(answer, { messageId: message.properties?.messageId || null });
        channel.ack(message);
        countMessage(SpeechQueue.AUTOTIME_RESULTS, outcome === 'duplicate' ? 'duplicate' : 'applied');
        return outcome === 'duplicate' ? 'duplicate' : 'applied';
      } catch (error) {
        const outcome = retryOrDead(channel, SpeechQueue.AUTOTIME_RESULTS, message, error.message);
        logger.warn(`Speech answer for job ${answer?.jobId} not applied (${error.message}); ${outcome === 'dead' ? 'moved to the dead queue' : 'retried later'}`);
        return outcome;
      }
    });
  }

  send(queue, message, { messageId } = {}) {
    if (!this.channel) return Promise.reject(new Error('RabbitMQ is not connected'));
    return new Promise((resolve, reject) => {
      this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          contentType: 'application/json',
          ...(messageId ? { messageId } : {}),
          ...(message.requestId ? { headers: { [REQUEST_ID_HEADER]: message.requestId } } : {}),
        },
        (error) => (error ? reject(error) : resolve()),
      );
    });
  }

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

  get ready() {
    return Boolean(this.channel);
  }

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
