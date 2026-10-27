import { AiKeyCheck, LearningEventType, SubmissionStatus, geminiChoice, geminiModelLabel, isGradingModel } from '@appenglish/learning-contracts';
import { open } from '@appenglish/backend-common/secret-box';
import { GeminiError, GeminiFailure } from './gemini.js';
import { OPEN_SYSTEM, SYSTEM, buildOpenSpeakingPrompt, openSchema, writingSchema, buildWritingPrompt, parseOpenSpeakingResult, parseWritingResult } from './rubric.js';
import { ETS_SCHEMA, ETS_SYSTEM, buildEtsPrompt, etsMaxScore, hasGuide, parseEtsResult } from './ets-rubric.js';

const failed = (submissionId, error) => ({ submissionId, status: SubmissionStatus.FAILED, error });

export const failureText = {
  [GeminiFailure.KEY]: 'Your Gemini key was rejected. Check it in your profile.',
  [GeminiFailure.QUOTA]: 'Your Gemini key has used up its quota for now. Try again later.',
  [GeminiFailure.UNAVAILABLE]: 'Gemini is not available right now. Try again later.',
  [GeminiFailure.BAD_OUTPUT]: 'Gemini did not give a usable score.',
  [GeminiFailure.REJECTED]: 'Gemini refused to score this answer.',
  [GeminiFailure.MODEL]: 'The chosen Gemini model is not available for your key. Pick another in your profile.',
};

export const isSpeakingJob = (message) => message?.type === LearningEventType.SPEAKING_GRADING_REQUESTED;
export const isSwJob = (message) => message?.type === LearningEventType.SW_GRADING_REQUESTED;
export const jobTask = (message) => (isSwJob(message) ? 'sw_test' : isSpeakingJob(message) ? 'open_speaking' : 'writing');

export async function gradeWriting(message, { gemini, secret, defaultModel = gemini.model }) {
  const payload = message?.payload && typeof message.payload === 'object' ? message.payload : message || {};
  const submissionId = payload.submissionId;
  if (!payload.prompt || typeof payload.answer !== 'string') return failed(submissionId, 'The submission was incomplete.');
  let apiKey;
  try {
    apiKey = open(payload.key, secret);
  } catch {
    return failed(submissionId, 'The saved Gemini key could not be read. Save it again in your profile.');
  }
  const speaking = isSpeakingJob(message);
  const ets = isSwJob(message);
  if (ets && !hasGuide(payload.task)) return failed(submissionId, 'The task type cannot be scored.');
  const maxScore = ets ? etsMaxScore(payload.task, payload.maxScore) : null;
  const request = ets
    ? { system: ETS_SYSTEM, prompt: buildEtsPrompt({ ...payload, maxScore }), schema: ETS_SCHEMA }
    : speaking
      ? { system: OPEN_SYSTEM, prompt: buildOpenSpeakingPrompt(payload), schema: openSchema(payload.etsTask) }
      : { system: SYSTEM, prompt: buildWritingPrompt(payload), schema: writingSchema(payload.etsTask) };
  const parse = ets ? (raw) => parseEtsResult(raw, maxScore) : speaking ? (raw, answer) => parseOpenSpeakingResult(raw, answer, payload.etsTask) : (raw, answer) => parseWritingResult(raw, answer, payload.etsTask);
  const choice = geminiChoice(payload.model, payload.thinkingLevel) || { model: defaultModel, thinkingLevel: null };
  for (let attempt = 1; ; attempt++) {
    try {
      const raw = await gemini.generateJson(apiKey, request, choice);
      return { submissionId, status: SubmissionStatus.DONE, result: { ...parse(raw, payload.answer), model: choice.model } };
    } catch (error) {
      if (!(error instanceof GeminiError)) throw error;
      if (error.kind === GeminiFailure.BAD_OUTPUT && attempt < 2) continue;
      if (error.retryable) throw error;
      return failed(submissionId, failureText[error.kind] || error.message);
    }
  }
}

export async function checkKey(request, { gemini, secret }) {
  let apiKey;
  try {
    apiKey = open(request?.key, secret);
  } catch {
    return { status: AiKeyCheck.INVALID, reason: 'The key could not be read.' };
  }
  try {
    await gemini.checkKey(apiKey);
    return { status: AiKeyCheck.VALID };
  } catch (error) {
    if (error instanceof GeminiError && error.kind === GeminiFailure.KEY) return { status: AiKeyCheck.INVALID, reason: failureText[GeminiFailure.KEY] };
    if (error instanceof GeminiError && (error.kind === GeminiFailure.QUOTA || error.kind === GeminiFailure.MODEL)) return { status: AiKeyCheck.VALID };
    return { status: AiKeyCheck.UNAVAILABLE, reason: failureText[GeminiFailure.UNAVAILABLE] };
  }
}

export async function listModels(request, { gemini, secret }) {
  let apiKey;
  try {
    apiKey = open(request?.key, secret);
  } catch {
    return { status: AiKeyCheck.INVALID, reason: 'The key could not be read.' };
  }
  try {
    const seen = new Set();
    const models = [];
    for (const model of await gemini.listModels(apiKey)) {
      const id = String(model.name || '').replace(/^models\//, '');
      if (seen.has(id) || !isGradingModel(id) || !(model.supportedGenerationMethods || []).includes('generateContent')) continue;
      seen.add(id);
      models.push({ id, label: model.displayName || geminiModelLabel(id), thinking: Boolean(model.thinking) });
    }
    return { status: AiKeyCheck.VALID, models };
  } catch (error) {
    if (error instanceof GeminiError && error.kind === GeminiFailure.KEY) return { status: AiKeyCheck.INVALID, reason: failureText[GeminiFailure.KEY] };
    return { status: AiKeyCheck.UNAVAILABLE, reason: failureText[GeminiFailure.UNAVAILABLE] };
  }
}
