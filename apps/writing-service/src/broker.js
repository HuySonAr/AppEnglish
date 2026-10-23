import { randomUUID } from 'node:crypto';
import amqp from 'amqplib';
import { LearningQueue, SubmissionStatus } from '@appenglish/learning-contracts';
import { RETRY_DELAYS_MS, assertRetryTopology, attemptOf, countMessage, retryOrDead, sendToDead } from '@appenglish/backend-common/messaging';
import { REQUEST_ID_HEADER, runWithRequestId } from '@appenglish/backend-common/observability';
import { checkKey, failureText, gradeWriting, isSpeakingJob } from './worker.js';

const RETRY_MS = 10_000;

export function outcomeOf(error, message) {
  if (attemptOf(message) >= RETRY_DELAYS_MS.length) return 'give-up';
  return error?.retryable ? 'retry' : 'crash';
}

export class WritingBroker {
  constructor(config, { gemini, logger = console }) {
    this.config = config;
    this.gemini = gemini;
    this.logger = logger;
    this.stopped = false;
  }

  start() {
    this.connect();
  }

  publish(channel, message, queue = LearningQueue.WRITING_RESULTS) {
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      contentType: 'application/json',
      messageId: randomUUID(),
      ...(message.requestId ? { headers: { [REQUEST_ID_HEADER]: message.requestId } } : {}),
    });
  }

  async handleGrading(channel, message) {
    let body;
    try {
      body = JSON.parse(message.content.toString());
    } catch {
      channel.ack(message);
      countMessage(LearningQueue.WRITING_REQUESTS, 'dropped');
      return 'dropped';
    }
    const requestId = body?.requestId || message.properties?.headers?.[REQUEST_ID_HEADER];
    const submissionId = body?.payload?.submissionId;
    const results = isSpeakingJob(body) ? LearningQueue.OPEN_SPEAKING_RESULTS : LearningQueue.WRITING_RESULTS;
    return runWithRequestId(requestId, async () => {
      try {
        const answer = await gradeWriting(body, { gemini: this.gemini, secret: this.config.secret });
        this.publish(channel, { ...answer, ...(requestId ? { requestId } : {}) }, results);
        channel.ack(message);
        countMessage(LearningQueue.WRITING_REQUESTS, 'applied');
        this.logger.log(`${isSpeakingJob(body) ? 'Speaking' : 'Writing'} submission ${submissionId}: ${answer.status}`);
        return answer.status;
      } catch (error) {
        const outcome = outcomeOf(error, message);
        if (outcome === 'give-up') {
          this.publish(channel, { submissionId, status: SubmissionStatus.FAILED, error: failureText[error?.kind] || 'The answer could not be scored.', ...(requestId ? { requestId } : {}) }, results);
          sendToDead(channel, LearningQueue.WRITING_REQUESTS, message, error?.message);
        } else retryOrDead(channel, LearningQueue.WRITING_REQUESTS, message, error?.message);
        this.logger.warn(`Writing submission ${submissionId}: ${error?.message} (${outcome === 'give-up' ? 'gave up' : 'retry later'})`);
        return outcome;
      }
    });
  }

  async handleKeyCheck(channel, message) {
    let request = {};
    try {
      request = JSON.parse(message.content.toString());
    } catch {
      request = {};
    }
    const answer = await checkKey(request, { gemini: this.gemini, secret: this.config.secret });
    if (message.properties?.replyTo)
      channel.sendToQueue(message.properties.replyTo, Buffer.from(JSON.stringify(answer)), { contentType: 'application/json', correlationId: message.properties.correlationId });
    channel.ack(message);
    return answer.status;
  }

  async connect() {
    if (this.stopped) return;
    try {
      const connection = await amqp.connect(this.config.rabbitmqUrl);
      connection.on('error', (error) => this.logger.warn(`RabbitMQ connection error: ${error.message}`));
      connection.on('close', () => {
        if (!this.stopped) {
          this.logger.warn('RabbitMQ connection closed; reconnecting');
          setTimeout(() => this.connect(), RETRY_MS);
        }
      });
      const grading = await connection.createChannel();
      await grading.assertQueue(LearningQueue.WRITING_REQUESTS, { durable: true });
      await assertRetryTopology(grading, LearningQueue.WRITING_REQUESTS);
      await grading.assertQueue(LearningQueue.WRITING_RESULTS, { durable: true });
      await grading.assertQueue(LearningQueue.OPEN_SPEAKING_RESULTS, { durable: true });
      await grading.prefetch(this.config.concurrency);
      await grading.consume(LearningQueue.WRITING_REQUESTS, (message) => message && this.handleGrading(grading, message));
      const checks = await connection.createChannel();
      await checks.assertQueue(LearningQueue.AI_KEY_CHECKS, { durable: true });
      await checks.prefetch(4);
      await checks.consume(LearningQueue.AI_KEY_CHECKS, (message) => message && this.handleKeyCheck(checks, message));
      this.connection = connection;
      this.logger.log(`Waiting for writing submissions (model ${this.config.model})`);
    } catch (error) {
      this.logger.warn(`RabbitMQ not reachable (${error.message}); retrying in ${RETRY_MS / 1000} s`);
      setTimeout(() => this.connect(), RETRY_MS);
    }
  }

  async stop() {
    this.stopped = true;
    await this.connection?.close().catch(() => {});
  }
}
