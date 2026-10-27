import { randomUUID } from 'node:crypto';
import { AccountRole } from '@appenglish/auth-contracts';
import { currentRequestId } from '@appenglish/backend-common/observability';
import { ETS_TASK_TIMING, EtsSpeakingTask, EtsWritingTask, SW_SECTION_MAX_MINUTES, SW_WRITING_GROUPS, SwSection } from '@appenglish/content-contracts';
import { LearningEventType, LearningQueue, LearningResponseCode, RECORDING_KEEP_DAYS, RECORDING_LIMITS, StudyActivity, SwScoringStatus, SubmissionStatus, swDefaultConversion } from '@appenglish/learning-contracts';
import { openWhisperSchema, readAloudResultSchema } from '../speaking/speaking.schemas.js';
import { OPEN_STAGES, finalScore, gradingPrompt, maxOf, readAloudItem, scoringState } from './swtest.scoring.js';
import { LearningError, placementErrors } from '../placement/placement.errors.js';
import { noEvents, recordActivity } from '../events/learning-events.js';

const IN_PROGRESS = 'IN_PROGRESS';
const SUBMITTED = 'SUBMITTED';
const GRACE_MS = 30 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const iso = (value) => (value ? new Date(value).toISOString() : null);
const mimeOf = (value) => String(value || '').split(';')[0].trim().toLowerCase();
const GROUP_ENDS = SW_WRITING_GROUPS.map((group) => group.at(-1));

export const swErrors = Object.freeze({
  notFound: () => new LearningError(LearningResponseCode.SW_TEST_NOT_FOUND, 'The Speaking and Writing test was not found', 404),
  notInProgress: () => new LearningError(LearningResponseCode.SW_ATTEMPT_NOT_IN_PROGRESS, 'There is no test in progress', 409),
  locked: () => new LearningError(LearningResponseCode.SW_ANSWER_LOCKED, 'This question is already closed', 409),
  recordingInvalid: (reason, message) => new LearningError(LearningResponseCode.RECORDING_INVALID, message, 400, { reason }),
});

export function speakingItems(content, media = {}) {
  const url = (id) => (id && media[id]?.url) || null;
  const { speaking } = content;
  const timing = (task) => ETS_TASK_TIMING[task];
  return [
    ...speaking.readAloud.map((item) => ({ task: EtsSpeakingTask.READ_ALOUD, text: item.text, timing: timing(EtsSpeakingTask.READ_ALOUD) })),
    ...speaking.pictures.map((item) => ({ task: EtsSpeakingTask.DESCRIBE_PICTURE, imageUrl: url(item.imageMediaId), timing: timing(EtsSpeakingTask.DESCRIBE_PICTURE) })),
    ...speaking.respondQuestions.questions.map((item, index) => ({ task: EtsSpeakingTask.RESPOND_QUESTIONS, context: speaking.respondQuestions.context, text: item.text, audioUrl: url(item.audioMediaId), setIndex: index, timing: timing(EtsSpeakingTask.RESPOND_QUESTIONS) })),
    ...speaking.respondInfo.questions.map((item, index) => ({ task: EtsSpeakingTask.RESPOND_INFO, info: speaking.respondInfo.info, text: item.text, audioUrl: url(item.audioMediaId), setIndex: index, timing: timing(EtsSpeakingTask.RESPOND_INFO) })),
    { task: EtsSpeakingTask.EXPRESS_OPINION, text: speaking.opinion.text, audioUrl: url(speaking.opinion.audioMediaId), timing: timing(EtsSpeakingTask.EXPRESS_OPINION) },
  ].map((item, index) => ({ number: index + 1, ...item }));
}

export function writingItems(content, media = {}) {
  const url = (id) => (id && media[id]?.url) || null;
  const { writing } = content;
  return [
    ...writing.pictureSentences.map((item) => ({ task: EtsWritingTask.PICTURE_SENTENCE, imageUrl: url(item.imageMediaId), keywords: item.keywords })),
    ...writing.emails.map((item) => ({ task: EtsWritingTask.RESPOND_EMAIL, email: item.email, instructions: item.instructions })),
    { task: EtsWritingTask.OPINION_ESSAY, text: writing.essay.question },
  ].map((item, index) => ({ number: index + 1, ...item }));
}

export function respondLimit(item) {
  const seconds = item.timing?.respondSeconds || [RECORDING_LIMITS.openSpeakingSeconds];
  return item.setIndex === undefined ? seconds[0] : seconds[item.setIndex];
}

export class SwTestService {
  constructor(repository, contentClient, { now = () => new Date(), events = noEvents, keys = null } = {}) {
    this.repository = repository;
    this.contentClient = contentClient;
    this.now = now;
    this.events = events;
    this.keys = keys;
  }

  async conversion() {
    const stored = await this.repository.findConversion();
    return stored ? { speaking: stored.speaking, writing: stored.writing } : swDefaultConversion();
  }

  assertAdmin(actor) {
    if (actor.role !== AccountRole.ADMIN) throw placementErrors.forbiddenRole();
  }

  async getConversion(actor) {
    this.assertAdmin(actor);
    return { conversion: await this.conversion(), isDefault: !(await this.repository.findConversion()), defaults: swDefaultConversion() };
  }

  async updateConversion(actor, conversion) {
    this.assertAdmin(actor);
    await this.repository.saveConversion({ ...conversion, updatedBy: actor.id });
    return this.getConversion(actor);
  }

  event(type, queue, payload) {
    return { type, queue, payload, requestId: currentRequestId(), createdAt: this.now(), publishedAt: null };
  }

  gradingEvent(attempt, item, answer, key, extra = {}) {
    return this.event(LearningEventType.SW_GRADING_REQUESTED, LearningQueue.WRITING_REQUESTS, {
      submissionId: item.jobId,
      accountId: attempt.accountId,
      section: attempt.section,
      number: item.number,
      task: item.task,
      maxScore: item.maxScore,
      prompt: item.prompt,
      answer,
      ...extra,
      key: key.sealed,
      model: key.model || null,
      thinkingLevel: key.thinkingLevel || null,
    });
  }

  async startScoring(attempt) {
    const key = this.keys ? await this.keys.findKey(attempt.accountId) : null;
    if (!key) return this.repository.saveScoring({ ...attempt, scoring: { status: SwScoringStatus.NO_KEY, items: {}, startedAt: this.now().toISOString() } });
    const paper = await this.paper(attempt.testId, attempt.versionId);
    const items = {};
    const jobs = [];
    const events = [];
    for (const row of this.itemsOf(paper, attempt.section)) {
      const base = { number: row.number, task: row.task, maxScore: maxOf(row), prompt: gradingPrompt(row) };
      if (attempt.section === SwSection.SPEAKING) {
        const recording = attempt.recordings?.[row.number];
        if (!recording) {
          items[row.number] = { ...base, stage: 'done', score: 0, ...(row.task === EtsSpeakingTask.READ_ALOUD ? { pronunciation: 0, intonation: 0 } : {}), note: 'No answer' };
          continue;
        }
        const jobId = randomUUID();
        items[row.number] = { ...base, jobId, stage: 'listening' };
        jobs.push({ id: jobId, attemptId: attempt.id, number: row.number });
        const readAloud = row.task === EtsSpeakingTask.READ_ALOUD;
        events.push(this.event(LearningEventType.SPEAKING_REQUESTED, LearningQueue.SPEAKING_REQUESTS, { submissionId: jobId, kind: readAloud ? 'read_aloud' : 'open_speaking', audioUrl: recording.url, text: readAloud ? row.text : '' }));
      } else {
        const answer = String(attempt.answers?.[row.number] || '').trim();
        if (!answer) {
          items[row.number] = { ...base, stage: 'done', score: 0, note: 'No answer' };
          continue;
        }
        const jobId = randomUUID();
        items[row.number] = { ...base, jobId, stage: 'grading' };
        jobs.push({ id: jobId, attemptId: attempt.id, number: row.number });
        events.push(this.gradingEvent(attempt, items[row.number], answer, key));
      }
    }
    const saved = await this.repository.saveScoring({ ...attempt, scoring: { status: SwScoringStatus.SCORING, items, startedAt: this.now().toISOString() } }, jobs, events);
    this.events.flush?.().catch(() => {});
    return jobs.length ? saved : this.finishScoring(saved);
  }

  async finishScoring(attempt) {
    const state = scoringState(attempt.scoring.items);
    if (state === SwScoringStatus.SCORING) return this.repository.saveScoring(attempt);
    const failed = Object.values(attempt.scoring.items).find((item) => item.stage === 'failed');
    const scoring = {
      ...attempt.scoring,
      status: state,
      error: failed?.error || null,
      ...(state === SwScoringStatus.DONE ? { final: finalScore(attempt.section, attempt.scoring.items, await this.conversion()), scoredAt: this.now().toISOString() } : {}),
    };
    const paper = await this.paper(attempt.testId, attempt.versionId).catch(() => null);
    const events = state === SwScoringStatus.DONE
      ? [this.event(LearningEventType.SW_SCORED, null, { accountId: attempt.accountId, attemptId: attempt.id, swTestId: attempt.testId, section: attempt.section, attemptNumber: attempt.attemptNumber, title: paper?.swTest?.title || '', scaled: scoring.final.scaled, scoredAt: scoring.scoredAt })]
      : [];
    const saved = await this.repository.saveScoring({ ...attempt, scoring }, [], events);
    if (events.length) this.events.flush?.().catch(() => {});
    return saved;
  }

  async jobItem(answer) {
    const job = answer?.submissionId ? await this.repository.findJob(answer.submissionId) : null;
    if (!job) return null;
    const attempt = await this.repository.findAttempt(job.attemptId);
    const item = attempt?.scoring?.items?.[job.number];
    return item?.jobId === job.id ? { attempt, item } : null;
  }

  async applyWhisper(answer) {
    const found = await this.jobItem(answer);
    if (!found) return 'unknown';
    const { attempt, item } = found;
    if (item.stage !== 'listening') return 'duplicate';
    const fail = (error) => Object.assign(item, { stage: 'failed', error: error || 'The recording could not be scored' });
    if (answer.status !== SubmissionStatus.DONE) fail(answer.error);
    else if (item.task === EtsSpeakingTask.READ_ALOUD) {
      const parsed = readAloudResultSchema.safeParse(answer.result);
      if (!parsed.success) fail('The scoring result was not valid');
      else Object.assign(item, readAloudItem(parsed.data.scores), { stage: 'done', heard: parsed.data.heard || '', wordsPerMinute: parsed.data.wordsPerMinute, pauses: parsed.data.pauses });
    } else {
      const parsed = openWhisperSchema.safeParse(answer.result);
      if (!parsed.success) fail('The scoring result was not valid');
      else if (!parsed.data.transcript.trim()) Object.assign(item, { stage: 'done', score: 0, transcript: '', note: 'Nothing was heard' });
      else {
        const key = this.keys ? await this.keys.findKey(attempt.accountId) : null;
        if (!key) fail('Your Gemini key was removed');
        else {
          Object.assign(item, { stage: 'grading', transcript: parsed.data.transcript });
          await this.repository.saveScoring(attempt, [], [this.gradingEvent(attempt, item, parsed.data.transcript, key, { durationSeconds: attempt.recordings?.[item.number]?.durationSeconds ?? null })]);
          this.events.flush?.().catch(() => {});
          return 'applied';
        }
      }
    }
    await this.finishScoring(attempt);
    return 'applied';
  }

  async applyGrading(answer) {
    const found = await this.jobItem(answer);
    if (!found) return 'unknown';
    const { attempt, item } = found;
    if (item.stage !== 'grading') return 'duplicate';
    const score = Number(answer.result?.score);
    if (answer.status === SubmissionStatus.DONE && Number.isFinite(score))
      Object.assign(item, { stage: 'done', score: Math.min(item.maxScore, Math.max(0, Math.round(score))), feedback: answer.result.feedback || '', model: answer.result.model || null });
    else Object.assign(item, { stage: 'failed', error: answer.error || 'Gemini did not give a usable score.' });
    await this.finishScoring(attempt);
    return 'applied';
  }

  useReviews(reviews) {
    this.reviews = reviews;
  }

  async attemptFor(accountId, testId, section, attemptNumber) {
    const own = (await this.repository.listAttempts(accountId, testId)).filter((attempt) => attempt.section === section && attempt.status === SUBMITTED);
    return (attemptNumber ? own.find((item) => item.attemptNumber === attemptNumber) : own.at(-1)) || null;
  }

  async reviewSubject(attemptId) {
    const attempt = await this.repository.findAttempt(attemptId);
    if (!attempt) return null;
    const view = await this.resultView(attempt);
    return {
      attemptId: attempt.id,
      accountId: attempt.accountId,
      swTestId: attempt.testId,
      section: attempt.section,
      attemptNumber: attempt.attemptNumber,
      title: `${view.attempt.title} · ${attempt.section === SwSection.SPEAKING ? 'Speaking' : 'Writing'}`,
      ai: attempt.scoring?.status === SwScoringStatus.DONE ? attempt.scoring.final : null,
      aiItems: attempt.scoring?.items || {},
      items: view.items,
    };
  }

  checkTeacherItems(subject, items = {}) {
    const clean = {};
    for (const item of subject.items) {
      const given = items[item.number] ?? items[String(item.number)];
      const bad = (message) => {
        throw new LearningError(LearningResponseCode.VALIDATION_ERROR, message, 400, { issues: [{ path: ['items', String(item.number)], message }] });
      };
      if (item.task === EtsSpeakingTask.READ_ALOUD) {
        const pronunciation = Number(given?.pronunciation);
        const intonation = Number(given?.intonation);
        if (![pronunciation, intonation].every((value) => Number.isInteger(value) && value >= 0 && value <= 3)) bad(`Question ${item.number} needs pronunciation and intonation from 0 to 3`);
        clean[item.number] = { task: item.task, pronunciation, intonation, score: (pronunciation + intonation) / 2 };
      } else {
        const score = Number(typeof given === 'object' ? given?.score : given);
        if (!Number.isInteger(score) || score < 0 || score > item.maxScore) bad(`Question ${item.number} needs a score from 0 to ${item.maxScore}`);
        clean[item.number] = { task: item.task, score };
      }
    }
    return clean;
  }

  async teacherReviewOf(subject, { action, items, note, teacherId, reviewedAt }) {
    const kept = items || Object.fromEntries(Object.entries(subject.aiItems).map(([number, item]) => [number, { task: item.task, score: item.score ?? 0, pronunciation: item.pronunciation, intonation: item.intonation }]));
    return { action, items: kept, note, teacherId, reviewedAt, final: finalScore(subject.section, kept, await this.conversion()) };
  }

  async retryScoring(actor, testId, { section, attemptNumber }) {
    this.assertStudent(actor);
    const own = (await this.repository.listAttempts(actor.id, testId)).filter((attempt) => attempt.section === section && attempt.status === SUBMITTED);
    const attempt = attemptNumber ? own.find((item) => item.attemptNumber === attemptNumber) : own.at(-1);
    if (!attempt) throw swErrors.notInProgress();
    if (attempt.scoring?.status === SwScoringStatus.SCORING || attempt.scoring?.status === SwScoringStatus.DONE) throw swErrors.locked();
    return this.resultView(await this.startScoring(attempt));
  }

  assertStudent(actor) {
    if (actor.role !== AccountRole.STUDENT) throw placementErrors.forbiddenRole();
  }

  async paper(testId, versionId) {
    const paper = await this.contentClient.getSwTestPaper(testId, versionId);
    if (!paper) throw swErrors.notFound();
    return paper;
  }

  itemsOf(paper, section) {
    return section === SwSection.SPEAKING ? speakingItems(paper.content, paper.media) : writingItems(paper.content, paper.media);
  }

  async settle(attempts) {
    const settled = [];
    for (const attempt of attempts) {
      if (attempt.status === IN_PROGRESS && this.now().getTime() > new Date(attempt.expiresAt).getTime() + GRACE_MS)
        settled.push(await this.startScoring(await this.repository.saveAttempt({ ...attempt, status: SUBMITTED, submittedAt: new Date(attempt.expiresAt) })));
      else settled.push(attempt);
    }
    return settled;
  }

  summary(attempt) {
    return {
      id: attempt.id,
      section: attempt.section,
      attemptNumber: attempt.attemptNumber,
      submittedAt: iso(attempt.submittedAt),
      answered: attempt.section === SwSection.SPEAKING ? Object.keys(attempt.recordings || {}).length : Object.values(attempt.answers || {}).filter((value) => String(value).trim()).length,
      scored: Boolean(attempt.teacherReview?.final || attempt.scoring?.final),
      scoringStatus: attempt.scoring?.status || null,
      scaled: attempt.teacherReview?.final?.scaled ?? attempt.scoring?.final?.scaled ?? null,
      reviewed: Boolean(attempt.teacherReview),
    };
  }

  sectionHistory(attempts, section) {
    const own = attempts.filter((attempt) => attempt.section === section);
    return { attempts: own.filter((attempt) => attempt.status === SUBMITTED).map((attempt) => this.summary(attempt)), inProgress: own.some((attempt) => attempt.status === IN_PROGRESS) };
  }

  async listTests(actor) {
    this.assertStudent(actor);
    const [{ swTests = [] } = {}, attempts] = await Promise.all([this.contentClient.listPublishedSwTests(), this.repository.listAttempts(actor.id)]);
    const settled = await this.settle(attempts);
    return {
      swTests: swTests.map((test) => {
        const own = settled.filter((attempt) => attempt.testId === test.id);
        return { ...test, speaking: this.sectionHistory(own, SwSection.SPEAKING), writing: this.sectionHistory(own, SwSection.WRITING) };
      }),
    };
  }

  async getTest(actor, testId) {
    this.assertStudent(actor);
    const paper = await this.paper(testId);
    const own = await this.settle(await this.repository.listAttempts(actor.id, testId));
    return {
      swTest: { ...paper.swTest, speakingCount: speakingItems(paper.content).length, writingCount: writingItems(paper.content).length },
      speaking: this.sectionHistory(own, SwSection.SPEAKING),
      writing: this.sectionHistory(own, SwSection.WRITING),
    };
  }

  attemptView(attempt, paper) {
    return {
      status: attempt.status,
      section: attempt.section,
      attemptNumber: attempt.attemptNumber,
      title: paper.swTest.title,
      startedAt: iso(attempt.startedAt),
      expiresAt: iso(attempt.expiresAt),
      serverNow: this.now().toISOString(),
      lockedThrough: attempt.lockedThrough,
      recorded: Object.keys(attempt.recordings || {}).map(Number).sort((a, b) => a - b),
      answers: attempt.answers || {},
      items: this.itemsOf(paper, attempt.section),
    };
  }

  async discardOpen(attempt) {
    const recordings = Object.values(attempt.recordings || {}).map((recording) => ({ storage: recording.storage, storageId: recording.storageId }));
    if (recordings.length) await this.contentClient.deleteLearnerRecordings(recordings).catch(() => null);
    await this.repository.deleteAttempt(attempt.id);
  }

  async start(actor, testId, { section }) {
    this.assertStudent(actor);
    const paper = await this.paper(testId);
    const own = await this.settle(await this.repository.listAttempts(actor.id, testId));
    const open = own.find((attempt) => attempt.section === section && attempt.status === IN_PROGRESS);
    if (open) await this.discardOpen(open);
    const startedAt = this.now();
    const attempt = await this.repository.saveAttempt({
      accountId: actor.id,
      testId,
      versionId: paper.versionId,
      section,
      attemptNumber: own.filter((item) => item.section === section && item.status === SUBMITTED).length + 1,
      status: IN_PROGRESS,
      startedAt,
      expiresAt: new Date(startedAt.getTime() + SW_SECTION_MAX_MINUTES[section] * 60 * 1000),
      submittedAt: null,
      answers: {},
      recordings: {},
      lockedThrough: 0,
      recordingDeletedAt: null,
    });
    return this.attemptView(attempt, paper);
  }

  async openAttempt(actor, testId, section) {
    this.assertStudent(actor);
    const attempt = await this.repository.findOpen(actor.id, testId, section);
    if (!attempt) throw swErrors.notInProgress();
    if (this.now().getTime() > new Date(attempt.expiresAt).getTime() + GRACE_MS) {
      await this.startScoring(await this.repository.saveAttempt({ ...attempt, status: SUBMITTED, submittedAt: new Date(attempt.expiresAt) }));
      throw swErrors.notInProgress();
    }
    return attempt;
  }

  async saveRecording(actor, testId, { section, questionNumber, durationSeconds, mimeType, data }) {
    const attempt = await this.openAttempt(actor, testId, section);
    if (questionNumber <= attempt.lockedThrough) throw swErrors.locked();
    const paper = await this.paper(testId, attempt.versionId);
    const item = speakingItems(paper.content, paper.media).find((row) => row.number === questionNumber);
    if (!item) throw swErrors.locked();
    const type = mimeOf(mimeType);
    if (!RECORDING_LIMITS.mimeTypes.includes(type)) throw swErrors.recordingInvalid('TYPE', 'This recording format is not supported');
    if (!data?.byteLength || data.byteLength > RECORDING_LIMITS.maxBytes) throw swErrors.recordingInvalid('SIZE', 'The recording is empty or too large');
    if (durationSeconds > respondLimit(item) + 2) throw swErrors.recordingInvalid('DURATION', 'The recording is longer than the time allowed');
    const { recording } = await this.contentClient.storeLearnerRecording(type, data);
    attempt.recordings = { ...attempt.recordings, [questionNumber]: { ...recording, durationSeconds: Math.round(durationSeconds * 10) / 10 } };
    attempt.lockedThrough = questionNumber;
    const saved = await this.repository.saveAttempt(attempt);
    return { saved: true, lockedThrough: saved.lockedThrough, recorded: Object.keys(saved.recordings).map(Number).sort((a, b) => a - b) };
  }

  async skipTo(actor, testId, { section, questionNumber }) {
    const attempt = await this.openAttempt(actor, testId, section);
    attempt.lockedThrough = Math.max(attempt.lockedThrough, questionNumber);
    await this.repository.saveAttempt(attempt);
    return { lockedThrough: attempt.lockedThrough };
  }

  async saveAnswers(actor, testId, { section, answers, lockThrough }) {
    const attempt = await this.openAttempt(actor, testId, section);
    const open = Object.entries(answers).filter(([number]) => Number(number) > attempt.lockedThrough);
    attempt.answers = { ...attempt.answers, ...Object.fromEntries(open) };
    if (lockThrough !== undefined && lockThrough > attempt.lockedThrough) {
      if (!GROUP_ENDS.includes(lockThrough)) throw swErrors.locked();
      attempt.lockedThrough = lockThrough;
    }
    const saved = await this.repository.saveAttempt(attempt);
    return { saved: true, lockedThrough: saved.lockedThrough };
  }

  async submit(actor, testId, { section }) {
    const attempt = await this.openAttempt(actor, testId, section);
    const at = this.now();
    const saved = await this.repository.saveAttempt({ ...attempt, status: SUBMITTED, submittedAt: at });
    await recordActivity(this.events, actor.id, section === SwSection.SPEAKING ? StudyActivity.SPEAKING : StudyActivity.WRITING, at);
    return this.resultView(await this.startScoring(saved));
  }

  async discard(actor, testId, { section }) {
    const attempt = await this.openAttempt(actor, testId, section);
    await this.discardOpen(attempt);
    return { discarded: true };
  }

  async resultView(attempt) {
    const paper = await this.paper(attempt.testId, attempt.versionId);
    const kept = !attempt.recordingDeletedAt;
    const scored = attempt.scoring?.items || {};
    const teacher = attempt.teacherReview?.items || {};
    return {
      attempt: { ...this.summary(attempt), title: paper.swTest.title },
      review: this.reviews ? await this.reviews.reviewFor(attempt.id) : null,
      reviewQuota: this.reviews ? await this.reviews.quotaOf(attempt.accountId) : null,
      scoring: attempt.scoring ? { status: attempt.scoring.status, error: attempt.scoring.error || null, final: attempt.scoring.final || null, scoredAt: attempt.scoring.scoredAt || null } : null,
      teacherReview: attempt.teacherReview ? { final: attempt.teacherReview.final, note: attempt.teacherReview.note || null, reviewedAt: attempt.teacherReview.reviewedAt || null } : null,
      items: this.itemsOf(paper, attempt.section).map((item) => {
        const ai = scored[item.number] || null;
        return {
          ...item,
          recordingUrl: kept ? attempt.recordings?.[item.number]?.url || null : null,
          durationSeconds: attempt.recordings?.[item.number]?.durationSeconds ?? null,
          answer: attempt.answers?.[item.number] ?? null,
          maxScore: maxOf(item),
          ai: ai ? { stage: ai.stage, score: OPEN_STAGES.has(ai.stage) ? null : ai.score ?? null, pronunciation: ai.pronunciation ?? null, intonation: ai.intonation ?? null, transcript: ai.transcript ?? ai.heard ?? null, feedback: ai.feedback || null, note: ai.note || null, error: ai.error || null } : null,
          teacher: teacher[item.number] ?? null,
        };
      }),
    };
  }

  async getResult(actor, testId, { section, attemptNumber }) {
    this.assertStudent(actor);
    const own = (await this.settle(await this.repository.listAttempts(actor.id, testId))).filter((attempt) => attempt.section === section && attempt.status === SUBMITTED);
    const attempt = attemptNumber ? own.find((item) => item.attemptNumber === attemptNumber) : own.at(-1);
    if (!attempt) return { attempt: null, items: [] };
    return this.resultView(attempt);
  }

  async purgeRecordings(limit = 50) {
    const before = new Date(this.now().getTime() - RECORDING_KEEP_DAYS * DAY_MS);
    const expired = await this.repository.listExpiredRecordings(before, limit);
    let count = 0;
    for (const attempt of expired) {
      const recordings = Object.values(attempt.recordings || {}).map((recording) => ({ storage: recording.storage, storageId: recording.storageId }));
      const answer = recordings.length ? await this.contentClient.deleteLearnerRecordings(recordings) : { deleted: [] };
      const deleted = new Set(answer?.deleted || []);
      if (recordings.every((recording) => deleted.has(recording.storageId))) {
        await this.repository.markRecordingsDeleted(attempt.id, this.now());
        count++;
      }
    }
    return count;
  }
}
