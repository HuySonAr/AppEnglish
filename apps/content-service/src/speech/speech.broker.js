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
          await this.onResult(JSON.parse(message.content.toString()));
        } catch (error) {
          logger.warn(`Auto-time answer not applied: ${error.message}`);
        }
        channel.ack(message);
      });
      this.connection = connection;
      this.channel = channel;
      logger.log('Connected to RabbitMQ for auto-time');
    } catch (error) {
      logger.warn(`RabbitMQ not reachable (${error.message}); retrying in ${RETRY_MS / 1000} s`);
      setTimeout(() => this.connect(), RETRY_MS);
    }
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

  async stop() {
    this.stopped = true;
    await this.connection?.close().catch(() => {});
  }
}
