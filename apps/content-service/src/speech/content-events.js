import { Logger } from '@nestjs/common';
import { SpeechQueue } from '@appenglish/content-contracts';
import { metrics } from '@appenglish/backend-common/metrics';

const logger = new Logger('ContentEvents');
const RELAY_MS = 5_000;
const BATCH = 50;
export const SPEECH_JOB_REQUESTED = 'speech.job.requested';

const published = metrics.counter('outbox_published_total', 'Outbox events sent to the broker.');
const pendingGauge = metrics.gauge('outbox_pending', 'Outbox events not sent yet (last relay).');

export class ContentEvents {
  constructor(repository, broker, { now = () => new Date() } = {}) {
    this.repository = repository;
    this.broker = broker;
    this.now = now;
    this.flushing = false;
  }

  start() {
    this.timer = setInterval(() => this.flush().catch(() => {}), RELAY_MS);
    this.timer.unref?.();
  }

  async flush() {
    if (!this.broker?.ready || this.flushing) return;
    this.flushing = true;
    try {
      const pending = await this.repository.listPendingEvents(BATCH);
      pendingGauge.set({ outbox: 'content_events' }, pending.length);
      for (const event of pending) {
        await this.broker.send(SpeechQueue.AUTOTIME_REQUESTS, { ...event.payload, ...(event.requestId ? { requestId: event.requestId } : {}) }, { messageId: event.id });
        await this.repository.markEventPublished(event.id, this.now());
        published.inc({ outbox: 'content_events' });
      }
      pendingGauge.set({ outbox: 'content_events' }, 0);
    } catch (error) {
      logger.warn(`Speech job requests not relayed: ${error.message}`);
    } finally {
      this.flushing = false;
    }
  }

  stop() {
    clearInterval(this.timer);
  }
}
