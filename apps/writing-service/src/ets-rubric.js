import { SW_ITEM_MAX, WRITING_LIMITS, countWords } from '@appenglish/learning-contracts';
import { GeminiError, GeminiFailure } from './gemini.js';

const GUIDES = {
  describe_picture: [
    '3 = describes the main features of the picture; delivery may need some listener effort but is generally intelligible; vocabulary and structures allow coherent expression of ideas.',
    '2 = connected to the picture but meaning may be obscured in places; vocabulary and structures may be limited and may interfere with overall comprehensibility.',
    '1 = may be connected to the picture but the ability to produce intelligible language is severely limited; vocabulary and structures are severely limited or significantly interfere with comprehensibility.',
    '0 = no response, no English, or completely unrelated to the task.',
  ],
  respond_questions: [
    '3 = a full, relevant, socially appropriate reply to the question; little listener effort; appropriate vocabulary; structures fulfil the task.',
    '2 = a partially effective reply that is not complete or fully appropriate; mostly intelligible; vocabulary limited or somewhat inexact but meaning clear.',
    '1 = does not answer the question effectively; relevant information is not conveyed; vocabulary inaccurate or repeats the prompt; structures interfere with comprehensibility.',
    '0 = no response, no English, or completely unrelated to the task.',
  ],
  respond_info: [
    '3 = a full, relevant, socially appropriate reply; the information taken from the document is accurate; little listener effort; appropriate vocabulary.',
    '2 = a partially effective reply that is not complete, fully appropriate or fully accurate; the speaker may find the right information but fail to separate it from irrelevant details or to turn the written text into clear speech.',
    '1 = does not answer the question effectively; relevant information is not conveyed; vocabulary inaccurate or repeats the document.',
    '0 = no response, no English, or completely unrelated to the task.',
  ],
  express_opinion: [
    '5 = the opinion is clear and its support is intelligible, sustained and coherent: reasons, details or examples with clear relationships between ideas; good control of basic and complex structures; effective vocabulary with only minor slips.',
    '4 = the opinion is clear and adequately supported, though the explanation may not be fully developed; fairly automatic and effective grammar with a somewhat limited range; fairly effective vocabulary.',
    '3 = an opinion is given but its development and support are limited: at least one reason with little elaboration, repetition or vagueness; limited control of grammar; limited vocabulary.',
    '2 = an opinion relevant to the prompt is stated but support is missing, unintelligible or incoherent; grammar severely limits expression; vocabulary severely limited or repetitive.',
    '1 = only reads the prompt, fails to state an intelligible opinion, or consists of isolated words or phrases.',
    '0 = no response, no English, or completely unrelated to the task.',
  ],
  picture_sentence: [
    '3 = ONE sentence with no grammatical errors that uses forms of both given words appropriately and is consistent with the picture.',
    '2 = one or more sentences with grammatical errors that do not obscure meaning; contains both given words (perhaps not in the same sentence or not in an accurate form); consistent with the picture.',
    '1 = errors that interfere with meaning, one or both given words missing, or not consistent with the picture.',
    '0 = blank, not in English, or only keystroke characters.',
  ],
  respond_email: [
    '4 = effectively addresses all the tasks in the directions with several sentences that clearly convey the required information, instructions or questions; organisation or connecting words create coherence; tone and register suit the reader; only a few isolated errors that do not obscure meaning.',
    '3 = mostly successful but omits, answers unsuccessfully or incompletely ONE required task; some organisation or connecting words; some awareness of the reader; noticeable errors, at most one sentence with errors that obscure meaning.',
    '2 = addresses only ONE required task or handles two or three unsuccessfully or incompletely; connections may be missing or obscure; little awareness of the reader; errors obscure meaning in more than one sentence.',
    '1 = addresses none of the required tasks though some content may relate to the email; connections missing; tone or register may be inappropriate; frequent errors obscure meaning most of the time.',
    '0 = only copies words from the prompt, rejects or ignores the topic, is not in English, is only keystrokes, or is blank.',
  ],
  opinion_essay: [
    '5 = effectively addresses the topic and task; well organised and well developed with clearly appropriate explanations, examples or details; unity, progression and coherence; consistent facility with syntactic variety, appropriate word choice and idiomaticity, with only minor errors.',
    '4 = addresses the topic and task well though some points may not be fully elaborated; generally well organised and developed; occasional redundancy, digression or unclear connections; facility with variety and range, with occasional minor errors that do not interfere with meaning.',
    '3 = addresses the topic with somewhat developed explanations, examples or details; connections occasionally obscured; inconsistent sentence formation or word choice that may obscure meaning; accurate but limited range.',
    '2 = limited development; inadequate organisation or connection of ideas; inappropriate or insufficient support; noticeably inappropriate word choices; an accumulation of sentence-structure or usage errors.',
    '1 = seriously disorganised or underdeveloped; little or no detail or irrelevant specifics; serious and frequent errors.',
    '0 = only copies words from the prompt, rejects or ignores the topic, is not in English, is only keystrokes, or is blank.',
  ],
};

const SPOKEN = new Set(['describe_picture', 'respond_questions', 'respond_info', 'express_opinion']);

export const ETS_SYSTEM = [
  'You are a certified rater for the TOEIC Speaking and Writing tests.',
  'Score one response with the official scoring guide given for its task, using whole numbers only.',
  'For spoken tasks you get an automatic transcript, not the audio: ignore punctuation, capital letters and filler words, and do not judge pronunciation or intonation.',
  'For picture tasks you cannot see the picture: judge whether the response plausibly describes or uses a picture, and judge the language.',
  'Write one short, specific, encouraging feedback paragraph for the learner.',
  'Answer only with JSON that matches the schema.',
].join('\n');

export const ETS_SCHEMA = {
  type: 'OBJECT',
  properties: { score: { type: 'INTEGER' }, feedback: { type: 'STRING' } },
  required: ['score', 'feedback'],
};

export function buildEtsPrompt({ task, maxScore, prompt = {}, answer, durationSeconds }) {
  const guide = GUIDES[task];
  const spoken = SPOKEN.has(task);
  return [
    `Task type: ${task.replace(/_/g, ' ')} (score 0-${maxScore})`,
    prompt.context ? `Situation:\n${prompt.context}` : '',
    prompt.info ? `Information the speaker reads:\n${prompt.info}` : '',
    prompt.email ? `Email the learner answers:\n${prompt.email}` : '',
    prompt.instructions ? `Directions:\n${prompt.instructions}` : '',
    prompt.text ? `${task === 'opinion_essay' || task === 'express_opinion' ? 'Question' : 'Question or text'}:\n${prompt.text}` : '',
    prompt.keywords?.length ? `Words that must be used: ${prompt.keywords.join(', ')}` : '',
    spoken && prompt.respondSeconds ? `Answer time: ${prompt.respondSeconds} seconds${durationSeconds ? `; the learner spoke for ${Math.round(durationSeconds)} seconds` : ''}` : '',
    `Scoring guide:\n${guide.join('\n')}`,
    `${spoken ? 'Transcript' : 'Response'} (${countWords(answer)} words):\n"""\n${answer}\n"""`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function parseEtsResult(raw, maxScore) {
  const score = Number(raw?.score);
  if (!Number.isFinite(score)) throw new GeminiError(GeminiFailure.BAD_OUTPUT, 'Gemini did not give a score');
  return {
    score: Math.min(maxScore, Math.max(0, Math.round(score))),
    feedback: String(raw?.feedback || '').trim().slice(0, WRITING_LIMITS.feedbackChars),
  };
}

export const etsMaxScore = (task, given) => SW_ITEM_MAX[task] ?? given ?? 3;
export const hasGuide = (task) => Boolean(GUIDES[task]);
export const spokenGuide = (task) => (SPOKEN.has(task) ? GUIDES[task] : null);
export const writtenGuide = (task) => (GUIDES[task] && !SPOKEN.has(task) ? GUIDES[task] : null);
