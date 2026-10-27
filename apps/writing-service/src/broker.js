import { randomUUID } from 'node:crypto';
import amqp from 'amqplib';
import { LearningQueue, SubmissionStatus } from '@appenglish/learning-contracts';
import { RETRY_DELAYS_MS, assertRetryTopology, attemptOf, countMessage, retryOrDead, sendToDead } from '@appenglish/backend-common/messaging';
import { REQUEST_ID_HEADER, runWithRequestId } from '@appenglish/backend-common/observability';
import { gradingJobs, gradingWork, keyChecks } from './status-server.js';
import { checkKey, failureText, gradeWriting, isSpeakingJob, isSwJob, jobTask, listModels } from './worker.js';

const RETRY_MS = 10_000;

export const DEFAULT_QUEUES = Object.freeze({
  requests: LearningQueue.WRITING_REQUESTS,
  results: LearningQueue.WRITING_RESULTS,
  openResults: LearningQueue.OPEN_SPEAKING_RESULTS,
  swResults: LearningQueue.SW_RESULTS,
  keyChecks: LearningQueue.AI_KEY_CHECKS,
  modelLists: LearningQueue.AI_MODEL_LISTS,
});

export function outcomeOf(error, message, delays = RETRY_DELAYS_MS) {
  if (attemptOf(message) >= delays.length) return 'give-up';
  return error?.retryable ? 'retry' : 'crash';
}

export class WritingBroker {
  constructor(config, { gemini, logger = console }) {
    this.config = config;
    this.queues = { ...DEFAULT_QUEUES, ...(config.queues || {}) };
    this.delays = config.retryDelays || RETRY_DELAYS_MS;
    this.gemini = gemini;
    this.logger = logger;
    this.stopped = false;
  }

  start() {
    return this.connect();
  }

  publish(channel, message, queue = this.queues.results) {
    channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      contentType: 'application/json',
      messageId: randomUUID(),
      ...(message.requestId ? { headers: { [REQUEST_ID_HEADER]: message.requestId } } : {}),
    });
  }

  async handleGrading(channel, message) {
    const { requests } = this.queues;
    let body;
    try {
      body = JSON.parse(message.content.toString());
    } catch {
      channel.ack(message);
      countMessage(requests, 'dropped');
      return 'dropped';
    }
    const requestId = body?.requestId || message.properties?.headers?.[REQUEST_ID_HEADER];
    const submissionId = body?.payload?.submissionId;
    const results = isSwJob(body) ? this.queues.swResults : isSpeakingJob(body) ? this.queues.openResults : this.queues.results;
    const task = jobTask(body);
    const started = Date.now();
    return runWithRequestId(requestId, async () => {
      try {
        const answer = await gradeWriting(body, { gemini: this.gemini, secret: this.config.secret });
        gradingJobs.inc({ task, status: answer.status });
        gradingWork.observe({ task }, (Date.now() - started) / 1000);
        this.publish(channel, { ...answer, ...(requestId ? { requestId } : {}) }, results);
        channel.ack(message);
        countMessage(requests, 'applied');
        this.logger.log(`${isSpeakingJob(body) ? 'Speaking' : 'Writing'} submission ${submissionId}: ${answer.status}`);
        return answer.status;
      } catch (error) {
        const outcome = outcomeOf(error, message, this.delays);
        if (outcome === 'give-up') {
          gradingJobs.inc({ task, status: SubmissionStatus.FAILED });
          this.publish(channel, { submissionId, status: SubmissionStatus.FAILED, error: failureText[error?.kind] || 'The answer could not be scored.', ...(requestId ? { requestId } : {}) }, results);
          sendToDead(channel, requests, message, error?.message);
        } else retryOrDead(channel, requests, message, error?.message, this.delays);
        this.logger.warn(`Writing submission ${submissionId}: ${error?.message} (${outcome === 'give-up' ? 'gave up' : 'retry later'})`);
        return outcome;
      }
    });
  }

  async handleKeyCheck(channel, message) {
    return this.answer(channel, message, async (request) => {
      const answer = await checkKey(request, { gemini: this.gemini, secret: this.config.secret });
      keyChecks.inc({ status: answer.status });
      return answer;
    });
  }

  async handleModelList(channel, message) {
    return this.answer(channel, message, (request) => listModels(request, { gemini: this.gemini, secret: this.config.secret }));
  }

  async answer(channel, message, run) {
    let request = {};
    try {
      request = JSON.parse(message.content.toString());
    } catch {
      request = {};
    }
    const answer = await run(request);
    if (message.properties?.replyTo)
      channel.sendToQueue(message.properties.replyTo, Buffer.from(JSON.stringify(answer)), { contentType: 'application/json', correlationId: message.properties.correlationId });
    channel.ack(message);
    return answer.status;
  }

  async connect() {
    if (this.stopped) return;
    const { requests, results, openResults, swResults, keyChecks, modelLists } = this.queues;
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
      await grading.assertQueue(requests, { durable: true });
      await assertRetryTopology(grading, requests, this.delays);
      await grading.assertQueue(results, { durable: true });
      await grading.assertQueue(openResults, { durable: true });
      await grading.assertQueue(swResults, { durable: true });
      await grading.prefetch(this.config.concurrency);
      await grading.consume(requests, (message) => message && this.handleGrading(grading, message).catch((error) => this.logger.warn(`Job left for redelivery: ${error.message}`)));
      const checks = await connection.createChannel();
      await checks.assertQueue(keyChecks, { durable: true });
      await checks.prefetch(4);
      await checks.consume(keyChecks, (message) => message && this.handleKeyCheck(checks, message).catch((error) => this.logger.warn(`Key check not answered: ${error.message}`)));
      await checks.assertQueue(modelLists, { durable: true });
      await checks.consume(modelLists, (message) => message && this.handleModelList(checks, message).catch((error) => this.logger.warn(`Model list not answered: ${error.message}`)));
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
