import { randomUUID } from 'node:crypto';
import { AccountRole } from '@appenglish/auth-contracts';
import { Logger } from '@nestjs/common';
import {
  AutoTimeStatus,
  LISTENING_KINDS,
  LISTENING_MAX_SEGMENTS,
  LISTENING_SEGMENT_MAX_LENGTH,
  ListeningFormat,
  SpeechQueue,
  SpeechTask,
  LessonVersionStatus,
  WORKING_VERSION_STATUSES,
  listeningKind,
  lyricBlankCount,
  lyricText,
} from '@appenglish/content-contracts';
import { metrics } from '@appenglish/backend-common/metrics';
import { currentRequestId } from '@appenglish/backend-common/observability';
import { contentErrors } from '../content/content.errors.js';
import { SPEECH_JOB_REQUESTED } from '../speech/content-events.js';
import { autoTimeResultSchema, listeningContentSchema, listeningIssues, listeningMediaIds } from './listening.schemas.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const logger = new Logger('ListeningService');
const AUTOTIME_TIMEOUT_MS = 30 * 60 * 1000;
const speechJobs = metrics.counter('speech_jobs_total', 'Speech jobs finished, by task and status.');
const speechWait = metrics.histogram('speech_job_wait_seconds', 'Time a speech job waited before a worker took it.');
const speechWork = metrics.histogram('speech_job_work_seconds', 'Time a worker spent on a speech job.');
const SPEECH_NOTICE_DAYS = 7;
const ADMIN_NOTICE_DAYS = 30;
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
const speechDay = (iso) => dayFormatter.format(new Date(iso));
const SPEECH_NOTICE_LIMIT = 30;
const active = (job) => job.status === AutoTimeStatus.QUEUED || job.status === AutoTimeStatus.RUNNING;

const iso = (date) => (date ? new Date(date).toISOString() : null);

const withIds = (content) => ({
  ...content,
  segments: content.segments.map((segment) => ({ ...segment, id: segment.id || randomUUID() })),
});

export class ListeningService {
  constructor(repository, contentService, { broker = null, relay = null, now = () => new Date() } = {}) {
    this.repository = repository;
    this.contentService = contentService;
    this.broker = broker;
    this.relay = relay;
    this.now = now;
  }

  assertManager(actor) {
    this.contentService.assertManager(actor);
  }

  assertTeacher(actor) {
    this.contentService.assertTeacher(actor);
  }

  assertStaff(actor) {
    this.contentService.assertStaff(actor);
  }

  assertTopicEditor(actor) {
    if (![AccountRole.ADMIN, AccountRole.CONTENT_MANAGER].includes(actor.role)) throw contentErrors.forbiddenRole();
  }

  topicView(topic) {
    return {
      id: topic.id,
      code: topic.code,
      name: topic.name,
      format: topic.format,
      level: topic.level || null,
      hasEditor: Boolean(LISTENING_KINDS[topic.format]),
    };
  }

  async listTopics() {
    return { topics: (await this.repository.listTopics()).map((topic) => this.topicView(topic)) };
  }

  async assertTopicNameFree(name, exceptId) {
    const code = this.contentService.examTypeCode(name);
    const clash = (await this.repository.listTopics()).some(
      (topic) => topic.id !== exceptId && (topic.code === code || topic.name.toLowerCase() === name.toLowerCase()),
    );
    if (!code || clash) throw contentErrors.listeningTopicInvalid('NAME_TAKEN', 'A topic with this name already exists');
    return code;
  }

  async createTopic(actor, { name, format = null, level = null }) {
    this.assertTopicEditor(actor);
    const code = await this.assertTopicNameFree(name);
    return { topic: this.topicView(await this.repository.saveTopic({ code, name, format, level, createdBy: actor.id })) };
  }

  async updateTopic(actor, topicId, { name, format, level }) {
    this.assertTopicEditor(actor);
    const topic = await this.repository.findTopic(topicId);
    if (!topic) throw contentErrors.listeningTopicNotFound();
    if (name !== undefined) {
      await this.assertTopicNameFree(name, topicId);
      topic.name = name;
    }
    if (format !== undefined && format !== topic.format) {
      if ((await this.repository.listExercises()).some((exercise) => exercise.topicId === topicId))
        throw contentErrors.listeningTopicInvalid('HAS_EXERCISES', 'The format of a topic with exercises cannot change');
      topic.format = format;
    }
    if (level !== undefined) topic.level = level;
    return { topic: this.topicView(await this.repository.saveTopic(topic)) };
  }

  assertTestEditor(actor) {
    if (![AccountRole.TEACHER, AccountRole.ADMIN, AccountRole.CONTENT_MANAGER].includes(actor.role)) throw contentErrors.forbiddenRole();
  }

  testView(test) {
    return { id: test.id, topicId: test.topicId, name: test.name };
  }

  async listTests() {
    return { tests: (await this.repository.listTests()).map((test) => this.testView(test)) };
  }

  async assertTestNameFree(topicId, name, exceptId) {
    const clash = (await this.repository.listTests()).some((test) => test.topicId === topicId && test.id !== exceptId && test.name.toLowerCase() === name.toLowerCase());
    if (clash) throw contentErrors.listeningTopicInvalid('NAME_TAKEN', 'A test with this name already exists');
  }

  async createTest(actor, { topicId, name }) {
    this.assertTestEditor(actor);
    const topic = await this.repository.findTopic(topicId);
    if (!topic) throw contentErrors.listeningTopicNotFound();
    if (topic.format !== ListeningFormat.TOEIC) throw contentErrors.listeningTopicInvalid('NOT_TOEIC', 'Tests belong to TOEIC topics');
    await this.assertTestNameFree(topicId, name);
    return { test: this.testView(await this.repository.saveTest({ topicId, name, createdBy: actor.id })) };
  }

  async findTestOrThrow(testId) {
    const test = await this.repository.findTest(testId);
    if (!test) throw contentErrors.listeningTopicInvalid('NO_TEST', 'The test was not found');
    return test;
  }

  async updateTest(actor, testId, { name }) {
    this.assertTestEditor(actor);
    const test = await this.findTestOrThrow(testId);
    await this.assertTestNameFree(test.topicId, name, testId);
    test.name = name;
    return { test: this.testView(await this.repository.saveTest(test)) };
  }

  async deleteTest(actor, testId) {
    this.assertTestEditor(actor);
    await this.findTestOrThrow(testId);
    const count = (await this.repository.listExercises()).filter((exercise) => exercise.testId === testId).length;
    if (count) throw contentErrors.listeningTopicInvalid('HAS_EXERCISES', `The test still has ${count} exercise${count === 1 ? '' : 's'}`, { exerciseCount: count });
    await this.repository.deleteTest(testId);
    return { deleted: { id: testId } };
  }

  async testFor(topic, testId, actor = null) {
    if (topic.format !== ListeningFormat.TOEIC) return null;
    if (!testId) {
      const first = (await this.repository.listTests()).find((test) => test.topicId === topic.id);
      return first || this.repository.saveTest({ topicId: topic.id, name: 'Test 1', createdBy: actor?.id || null });
    }
    const test = await this.findTestOrThrow(testId);
    if (test.topicId !== topic.id) throw contentErrors.listeningTopicInvalid('TEST_MISMATCH', 'The test belongs to another topic');
    return test;
  }

  async deleteTopic(actor, topicId) {
    this.assertTopicEditor(actor);
    const topic = await this.repository.findTopic(topicId);
    if (!topic) throw contentErrors.listeningTopicNotFound();
    const count = (await this.repository.listExercises()).filter((exercise) => exercise.topicId === topicId).length;
    if (count)
      throw contentErrors.listeningTopicInvalid('HAS_EXERCISES', `The topic still has ${count} exercise${count === 1 ? '' : 's'}`, { exerciseCount: count });
    await this.repository.deleteTopic(topicId);
    return { deleted: { id: topicId } };
  }

  async exerciseView(exercise, topics, tests) {
    const topic = topics
      ? topics.find((item) => item.id === exercise.topicId)
      : await this.repository.findTopic(exercise.topicId);
    const test = !exercise.testId ? null : tests ? tests.find((item) => item.id === exercise.testId) : await this.repository.findTest(exercise.testId);
    return {
      id: exercise.id,
      title: exercise.title,
      level: exercise.level,
      kind: exercise.kind,
      topic: topic ? { id: topic.id, code: topic.code, name: topic.name } : null,
      test: test ? { id: test.id, name: test.name } : null,
    };
  }

  async listExercises(actor) {
    this.assertStaff(actor);
    const [exercises, topics, versions, tests] = await Promise.all([
      this.repository.listExercises(),
      this.repository.listTopics(),
      this.repository.listVersionSummaries(),
      this.repository.listTests(),
    ]);
    return {
      exercises: await Promise.all(
        exercises.map(async (exercise) => {
          const own = versions.filter((version) => version.exerciseId === exercise.id);
          return {
            ...(await this.exerciseView(exercise, topics, tests)),
            createdAt: iso(exercise.createdAt),
            publishedVersionNumber: own.find((version) => version.id === exercise.publishedVersionId)?.versionNumber ?? null,
            hasDraft: own.some((version) => WORKING_VERSION_STATUSES.includes(version.status)),
            draftStatus: this.contentService.draftStatus(own),
          };
        }),
      ),
    };
  }

  async createExercise(actor, input) {
    this.assertTeacher(actor);
    const topic = await this.repository.findTopic(input.topicId);
    if (!topic) throw contentErrors.listeningTopicNotFound();
    const kinds = LISTENING_KINDS[topic.format];
    if (!kinds) throw contentErrors.listeningTopicInvalid('NO_EDITOR', 'Exercises cannot be written for this topic yet');
    if (!kinds.some((kind) => kind.key === input.kind))
      throw contentErrors.listeningTopicInvalid('KIND_MISMATCH', 'This kind of exercise does not belong to the topic');
    const test = await this.testFor(topic, input.testId, actor);
    const exercise = await this.repository.saveExercise({ ...input, testId: test?.id || null, publishedVersionId: null, createdBy: actor.id });
    const draft = await this.repository.saveVersion(this.contentService.newDraft(actor, { exerciseId: exercise.id, versionNumber: 1, content: listeningContentSchema.parse({}) }));
    return this.managedView(exercise, draft, null);
  }

  async findExerciseOrThrow(exerciseId) {
    const exercise = await this.repository.findExercise(exerciseId);
    if (!exercise) throw contentErrors.listeningExerciseNotFound();
    return exercise;
  }

  async updateExercise(actor, exerciseId, changes) {
    this.assertTeacher(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    if (changes.testId !== undefined) await this.testFor(await this.repository.findTopic(exercise.topicId), changes.testId || null, actor);
    for (const [field, value] of Object.entries(changes)) if (value !== undefined) exercise[field] = value;
    await this.repository.saveExercise(exercise);
    return { exercise: await this.exerciseView(exercise) };
  }

  async publishedVersion(exercise) {
    return exercise.publishedVersionId ? this.repository.findVersion(exercise.publishedVersionId) : null;
  }

  async getExercise(actor, exerciseId) {
    this.assertStaff(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    return this.managedView(exercise, await this.repository.findDraft(exerciseId), await this.publishedVersion(exercise));
  }

  async saveDraft(actor, exerciseId, content) {
    this.assertTeacher(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    let draft = await this.repository.findDraft(exerciseId);
    const previous = draft ? listeningContentSchema.safeParse(draft.content) : null;
    const previousMediaIds = previous?.success ? listeningMediaIds(previous.data) : [];
    if (draft) this.contentService.openDraft(draft, actor).content = withIds(content);
    else
      draft = this.contentService.newDraft(actor, {
        exerciseId,
        versionNumber: (await this.repository.maxVersionNumber(exerciseId)) + 1,
        content: withIds(content),
      });
    draft = await this.repository.saveVersion(draft);
    const kept = new Set(listeningMediaIds(draft.content));
    await this.contentService.removeUnusedMedia(previousMediaIds.filter((id) => !kept.has(id)));
    return this.managedView(exercise, draft, await this.publishedVersion(exercise));
  }

  async draftIssues(exercise, draft) {
    draft.content = listeningContentSchema.parse(draft.content);
    return listeningIssues(draft.content, listeningKind(exercise.kind), await this.contentService.mediaMapOf(listeningMediaIds(draft.content)));
  }

  async publish(actor, exerciseId) {
    this.assertManager(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    const draft = await this.repository.findDraft(exerciseId);
    this.contentService.assertInReview(draft);
    const issues = await this.draftIssues(exercise, draft);
    if (issues.length) throw contentErrors.notPublishable(issues);
    this.contentService.approve(draft, actor);
    exercise.publishedVersionId = draft.id;
    await this.repository.publishVersion(exercise, draft);
    return this.managedView(exercise, null, draft);
  }

  async unpublish(actor, exerciseId) {
    this.assertManager(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    const published = exercise.publishedVersionId ? await this.repository.findVersion(exercise.publishedVersionId) : null;
    if (exercise.publishedVersionId) {
      exercise.publishedVersionId = null;
      await this.repository.saveExercise(exercise);
      await this.contentService.noteUnpublished(actor, { type: 'exercise', id: exercise.id, title: exercise.title });
    }
    let draft = await this.repository.findDraft(exerciseId);
    if (!draft && published)
      draft = await this.repository.saveVersion(this.contentService.draftFrom(published, {
        exerciseId,
        versionNumber: (await this.repository.maxVersionNumber(exerciseId)) + 1,
      }));
    return this.managedView(exercise, draft, null);
  }

  async delete(actor, exerciseId) {
    this.assertStaff(actor);
    await this.findExerciseOrThrow(exerciseId);
    const summaries = (await this.repository.listVersionSummaries()).filter((version) => version.exerciseId === exerciseId);
    this.contentService.assertCanDelete(actor, summaries.some((version) => version.status === LessonVersionStatus.PUBLISHED));
    const mediaIds = [];
    for (const summary of summaries) {
      const version = await this.repository.findVersion(summary.id);
      const parsed = version ? listeningContentSchema.safeParse(version.content) : null;
      if (parsed?.success) mediaIds.push(...listeningMediaIds(parsed.data));
    }
    await this.repository.deleteExerciseWithVersions(exerciseId);
    const removedMedia = await this.contentService.removeUnusedMedia([...new Set(mediaIds)]);
    return { deleted: true, removedMedia: removedMedia.length };
  }

  timingJobView(job) {
    const late = active(job) && this.now().getTime() - new Date(job.createdAt).getTime() > AUTOTIME_TIMEOUT_MS;
    const task = job.task || SpeechTask.ALIGN;
    return {
      id: job.id,
      task,
      status: late ? AutoTimeStatus.FAILED : job.status,
      error: late ? 'The speech service did not answer in time; try again.' : job.error || null,
      lineCount: task === SpeechTask.ALIGN ? job.lines.length : (job.result || []).length,
      lines: job.result || [],
      createdAt: new Date(job.createdAt).toISOString(),
      updatedAt: new Date(job.updatedAt || job.createdAt).toISOString(),
    };
  }

  async startSpeechJob(actor, exerciseId, task) {
    this.assertTeacher(actor);
    const exercise = await this.findExerciseOrThrow(exerciseId);
    const version = (await this.repository.findDraft(exerciseId)) || (await this.publishedVersion(exercise));
    const content = version ? listeningContentSchema.parse(version.content) : null;
    return this.queueSpeechJob(actor, {
      owner: { exerciseId },
      task,
      kind: exercise.kind,
      audioMediaId: content?.audioMediaId,
      segments: content?.segments || [],
      lineText: (segment) => (exercise.kind === 'song' ? lyricText(segment.text) : segment.text),
    });
  }

  async queueSpeechJob(actor, { owner, task, kind, audioMediaId, segments, lineText = (segment) => segment.text }) {
    if (!audioMediaId) throw contentErrors.autoTimeInvalid('NO_AUDIO', 'Add the recording and save the draft first');
    const [asset] = await this.contentService.repository.findMediaByIds([audioMediaId]);
    if (!asset?.url || asset.storage === 'local')
      throw contentErrors.autoTimeInvalid('NO_AUDIO', 'The recording is not stored where the speech service can download it');
    const lines =
      task === SpeechTask.ALIGN
        ? segments.filter((segment) => segment.text.trim()).map((segment) => ({ id: segment.id, text: lineText(segment) }))
        : [];
    if (task === SpeechTask.ALIGN && !lines.length)
      throw contentErrors.autoTimeInvalid('NO_LINES', 'Write or paste the lines and save the draft first');
    const latest = await this.repository.findLatestTimingJob(owner);
    if (latest && active(latest) && this.timingJobView(latest).status !== AutoTimeStatus.FAILED)
      return { job: this.timingJobView(latest) };
    const job = await this.repository.saveTimingJobWithEvent({ ...owner, task, status: AutoTimeStatus.QUEUED, lines, requestedBy: actor.id }, (saved) => ({
      type: SPEECH_JOB_REQUESTED,
      payload: { jobId: saved.id, task, audioUrl: asset.url, language: 'en', kind, lines },
      requestId: currentRequestId(),
    }));
    this.relay?.flush().catch(() => {});
    return { job: this.timingJobView(job) };
  }

  async latestSpeechJob(owner) {
    const job = await this.repository.findLatestTimingJob(owner);
    return { job: job ? this.timingJobView(job) : null };
  }

  mockRecordingKind(content, audioMediaId) {
    for (const [key, part] of Object.entries(content?.test || {})) {
      const items = [...(part.groups || []), ...(part.questions || [])];
      if (items.some((item) => item.audioMediaId === audioMediaId)) return key;
    }
    return null;
  }

  async listNotifications(actor) {
    this.assertStaff(actor);
    const since = new Date(this.now().getTime() - SPEECH_NOTICE_DAYS * 86400000);
    const jobs = (await this.repository.listJobsRequestedBy(actor.id, since, SPEECH_NOTICE_LIMIT))
      .filter((job) => !job.practicePromptId)
      .map((job) => ({ job, view: this.timingJobView(job) }))
      .filter(({ view }) => view.status === AutoTimeStatus.DONE || view.status === AutoTimeStatus.FAILED);
    const ids = (field) => [...new Set(jobs.map(({ job }) => job[field]).filter(Boolean))];
    const titles = await this.repository.titlesOf({ exerciseIds: ids('exerciseId'), mockTestIds: ids('mockTestId') });
    const ownerOf = (job) =>
      job.exerciseId ? { type: 'exercise', id: job.exerciseId } : { type: 'mockTest', id: job.mockTestId };
    const notifications = jobs.map(({ job, view }) => {
      const owner = ownerOf(job);
      return {
        id: job.id,
        kind: 'SPEECH_JOB',
        data: { task: view.task, status: view.status, error: view.error, lineCount: view.lineCount, owner: { ...owner, title: titles.get(owner.id) || '' } },
        createdAt: view.updatedAt,
        read: Boolean(job.seenAt),
      };
    });
    const notices = await this.reviewNoticesOf(actor);
    const read = await this.contentService.repository.readNoticeKeys(actor.id, notices.map((notice) => notice.id));
    notifications.push(...notices.map((notice) => ({ ...notice, read: read.has(notice.id) })));
    notifications.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { notifications, unread: notifications.filter((item) => !item.read).length };
  }

  useReviewNotices(source) {
    this.reviewNotices = source;
  }

  async reviewNoticesOf(actor) {
    return this.reviewNotices ? this.reviewNotices.notices(actor) : [];
  }

  async markNotificationsRead(actor, { ids } = {}) {
    this.assertStaff(actor);
    const keys = ids ? ids.filter((id) => !UUID.test(id)) : (await this.reviewNoticesOf(actor)).map((notice) => notice.id);
    await this.repository.markJobsSeen(actor.id, ids ? ids.filter((id) => UUID.test(id)) : null, this.now());
    await this.contentService.repository.markNoticesRead(actor.id, keys, this.now());
    return { unread: (await this.listNotifications(actor)).unread };
  }

  async adminNotices() {
    const now = this.now();
    const notices = (await this.contentService.repository.listAdminNotices(new Date(now.getTime() - ADMIN_NOTICE_DAYS * 86400000))).map((row) => ({
      id: row.key,
      kind: row.kind,
      data: row.data,
      createdAt: new Date(row.createdAt).toISOString(),
    }));
    const failures = new Map();
    for (const job of await this.repository.listJobsUpdatedSince(new Date(now.getTime() - SPEECH_NOTICE_DAYS * 86400000))) {
      const view = this.timingJobView(job);
      if (view.status !== AutoTimeStatus.FAILED) continue;
      const day = speechDay(view.updatedAt);
      const entry = failures.get(day) || { day, count: 0, lastError: '', lastAt: view.updatedAt };
      entry.count++;
      if (view.updatedAt >= entry.lastAt) Object.assign(entry, { lastAt: view.updatedAt, lastError: view.error || '' });
      failures.set(day, entry);
    }
    for (const entry of failures.values())
      notices.push({ id: `speech:${entry.day}:${entry.count}`, kind: 'SPEECH_FAILURES', data: { day: entry.day, count: entry.count, lastError: entry.lastError }, createdAt: entry.lastAt });
    return notices.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, SPEECH_NOTICE_LIMIT);
  }

  async listAdminNotifications(actor) {
    this.contentService.assertAdmin(actor);
    const notices = await this.adminNotices();
    const read = await this.contentService.repository.readNoticeKeys(actor.id, notices.map((notice) => notice.id));
    const notifications = notices.map((notice) => ({ ...notice, read: read.has(notice.id) }));
    return { notifications, unread: notifications.filter((item) => !item.read).length };
  }

  async markAdminNotificationsRead(actor, { ids } = {}) {
    this.contentService.assertAdmin(actor);
    const keys = ids || (await this.adminNotices()).map((notice) => notice.id);
    await this.contentService.repository.markNoticesRead(actor.id, keys, this.now());
    return { unread: (await this.listAdminNotifications(actor)).unread };
  }

  async requestMockTranscribe(actor, mockTestId, { audioMediaId }) {
    this.assertTeacher(actor);
    const mockTest = await this.contentService.findMockOrThrow(mockTestId);
    const version = (await this.contentService.repository.findMockDraft(mockTestId)) || (await this.contentService.publishedMockVersion(mockTest));
    const kind = this.mockRecordingKind(version?.content, audioMediaId);
    if (!kind) throw contentErrors.autoTimeInvalid('NO_AUDIO', 'Add the recording and save the draft first');
    return this.queueSpeechJob(actor, { owner: { mockTestId, audioMediaId }, task: SpeechTask.TRANSCRIBE, kind, audioMediaId, segments: [] });
  }

  async listMockTranscribe(actor, mockTestId) {
    this.assertStaff(actor);
    await this.contentService.findMockOrThrow(mockTestId);
    const latest = new Map();
    for (const job of await this.repository.listTimingJobs({ mockTestId })) latest.set(job.audioMediaId, job);
    return { jobs: [...latest.values()].map((job) => ({ audioMediaId: job.audioMediaId, ...this.timingJobView(job) })) };
  }

  requestAutoTime(actor, exerciseId) {
    return this.startSpeechJob(actor, exerciseId, SpeechTask.ALIGN);
  }

  requestTranscribe(actor, exerciseId) {
    return this.startSpeechJob(actor, exerciseId, SpeechTask.TRANSCRIBE);
  }

  async getAutoTime(actor, exerciseId) {
    this.assertStaff(actor);
    await this.findExerciseOrThrow(exerciseId);
    return this.latestSpeechJob({ exerciseId });
  }

  async onAutoTimeResult(message, { messageId = null } = {}) {
    if (messageId && (await this.repository.isProcessed(messageId))) return 'duplicate';
    const outcome = await this.applyAutoTimeResult(message);
    if (messageId) await this.repository.markProcessed(messageId, SpeechQueue.AUTOTIME_RESULTS, this.now());
    return outcome;
  }

  async applyAutoTimeResult(message) {
    const parsed = autoTimeResultSchema.safeParse(message);
    if (!parsed.success) {
      logger.warn('Ignored an auto-time answer that does not match the contract');
      return 'ignored';
    }
    const answer = parsed.data;
    const job = await this.repository.findTimingJob(answer.jobId);
    if (!job || !active(job)) return 'ignored';
    const seconds = (from) => Math.max(0, (this.now().getTime() - new Date(from).getTime()) / 1000);
    if (answer.status === AutoTimeStatus.RUNNING && job.status === AutoTimeStatus.QUEUED) speechWait.observe({ task: job.task || SpeechTask.ALIGN }, seconds(job.createdAt));
    if (answer.status === AutoTimeStatus.DONE || answer.status === AutoTimeStatus.FAILED) {
      speechWork.observe({ task: job.task || SpeechTask.ALIGN }, seconds(job.updatedAt || job.createdAt));
      speechJobs.inc({ task: job.task || SpeechTask.ALIGN, status: answer.status });
    }
    job.status = answer.status;
    if (answer.status === AutoTimeStatus.DONE && (job.task || SpeechTask.ALIGN) === SpeechTask.ALIGN) {
      const asked = new Set(job.lines.map((line) => line.id));
      job.result = (answer.lines || [])
        .filter((line) => asked.has(line.id))
        .map(({ id, start, end, matched }) => ({ id, start, end, matched: matched ?? 0 }));
    }
    if (answer.status === AutoTimeStatus.DONE && job.task === SpeechTask.TRANSCRIBE) {
      job.result = (answer.lines || [])
        .map(({ text, start, end }) => ({ text: (text || '').trim().slice(0, LISTENING_SEGMENT_MAX_LENGTH), start, end }))
        .filter((line) => line.text)
        .slice(0, LISTENING_MAX_SEGMENTS);
    }
    if (answer.status === AutoTimeStatus.FAILED) job.error = answer.error || 'The speech service could not time the lines.';
    await this.repository.saveTimingJob(job);
    return 'applied';
  }

  async listPublished() {
    const [exercises, topics, tests] = await Promise.all([this.repository.listExercises(), this.repository.listTopics(), this.repository.listTests()]);
    const published = exercises.filter((exercise) => exercise.publishedVersionId);
    return {
      topics: topics.map((topic) => this.topicView(topic)),
      tests: tests.map((test) => this.testView(test)),
      exercises: await Promise.all(
        published.map(async (exercise) => {
          const version = await this.repository.findVersion(exercise.publishedVersionId);
          const { segments } = listeningContentSchema.parse(version.content);
          return {
            ...(await this.exerciseView(exercise, topics, tests)),
            segmentCount: segments.length,
            blankCount: exercise.kind === 'song' ? segments.reduce((sum, segment) => sum + lyricBlankCount(segment.text), 0) : 0,
          };
        }),
      ),
    };
  }

  async getPaper(exerciseId, { versionId } = {}) {
    const exercise = await this.repository.findExercise(exerciseId);
    if (!exercise?.publishedVersionId) throw contentErrors.listeningExerciseNotFound();
    const version = await this.repository.findVersion(versionId || exercise.publishedVersionId);
    if (version?.exerciseId !== exercise.id || version.status !== LessonVersionStatus.PUBLISHED)
      throw contentErrors.listeningExerciseNotFound();
    return {
      exercise: await this.exerciseView(exercise),
      versionId: version.id,
      versionNumber: version.versionNumber,
      content: listeningContentSchema.parse(version.content),
      media: await this.mediaOf([version]),
    };
  }

  async mediaOf(versions) {
    const mediaIds = versions.flatMap((version) => {
      const parsed = version ? listeningContentSchema.safeParse(version.content) : null;
      return parsed?.success ? listeningMediaIds(parsed.data) : [];
    });
    const assets = mediaIds.length ? await this.contentService.repository.findMediaByIds([...new Set(mediaIds)]) : [];
    return Object.fromEntries(
      assets.map((asset) => [asset.id, { kind: asset.kind, fileName: asset.fileName, url: asset.storage === 'local' ? null : asset.url }]),
    );
  }

  async managedView(exercise, draft, published) {
    return {
      exercise: await this.exerciseView(exercise),
      media: await this.mediaOf([draft, published]),
      draft: this.contentService.draftView(draft),
      published: published
        ? {
            versionId: published.id,
            versionNumber: published.versionNumber,
            publishedAt: iso(published.publishedAt),
            content: published.content,
          }
        : null,
    };
  }
}
