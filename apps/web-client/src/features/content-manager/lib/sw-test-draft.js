import { EtsSpeakingTask, EtsWritingTask, PRACTICE_LIMITS, SW_SPEAKING_LAYOUT, SW_WRITING_LAYOUT, SwSection } from '@appenglish/content-contracts';

const pad = (list, length, make) => Array.from({ length }, (_, index) => ({ ...make(), ...(Array.isArray(list) && list[index] ? list[index] : {}) }));
const asked = () => ({ text: '', audioMediaId: null });

export function normalizeSwContent(content) {
  const speaking = content?.speaking || {};
  const writing = content?.writing || {};
  return {
    speaking: {
      readAloud: pad(speaking.readAloud, SW_SPEAKING_LAYOUT.readAloud, () => ({ text: '' })),
      pictures: pad(speaking.pictures, SW_SPEAKING_LAYOUT.pictures, () => ({ imageMediaId: null })),
      respondQuestions: { context: speaking.respondQuestions?.context || '', questions: pad(speaking.respondQuestions?.questions, SW_SPEAKING_LAYOUT.setQuestions, asked) },
      respondInfo: { info: speaking.respondInfo?.info || '', questions: pad(speaking.respondInfo?.questions, SW_SPEAKING_LAYOUT.setQuestions, asked) },
      opinion: { text: speaking.opinion?.text || '', audioMediaId: speaking.opinion?.audioMediaId || null },
    },
    writing: {
      pictureSentences: pad(writing.pictureSentences, SW_WRITING_LAYOUT.pictureSentences, () => ({ imageMediaId: null, keywords: [] })).map((item) => ({
        imageMediaId: item.imageMediaId || null,
        keywords: Array.from({ length: PRACTICE_LIMITS.keywords }, (_, index) => item.keywords?.[index] || ''),
      })),
      emails: pad(writing.emails, SW_WRITING_LAYOUT.emails, () => ({ email: '', instructions: '' })),
      essay: { question: writing.essay?.question || '' },
    },
  };
}

export const workingSwTest = (data) => normalizeSwContent(data?.draft?.content ?? data?.published?.content ?? null);

export const swBlocks = Object.freeze([
  { key: 'readAloud', section: SwSection.SPEAKING, task: EtsSpeakingTask.READ_ALOUD, first: 1, count: SW_SPEAKING_LAYOUT.readAloud },
  { key: 'pictures', section: SwSection.SPEAKING, task: EtsSpeakingTask.DESCRIBE_PICTURE, first: 3, count: SW_SPEAKING_LAYOUT.pictures },
  { key: 'respondQuestions', section: SwSection.SPEAKING, task: EtsSpeakingTask.RESPOND_QUESTIONS, first: 5, count: SW_SPEAKING_LAYOUT.setQuestions },
  { key: 'respondInfo', section: SwSection.SPEAKING, task: EtsSpeakingTask.RESPOND_INFO, first: 8, count: SW_SPEAKING_LAYOUT.setQuestions },
  { key: 'opinion', section: SwSection.SPEAKING, task: EtsSpeakingTask.EXPRESS_OPINION, first: 11, count: SW_SPEAKING_LAYOUT.opinion },
  { key: 'pictureSentences', section: SwSection.WRITING, task: EtsWritingTask.PICTURE_SENTENCE, first: 1, count: SW_WRITING_LAYOUT.pictureSentences },
  { key: 'emails', section: SwSection.WRITING, task: EtsWritingTask.RESPOND_EMAIL, first: 6, count: SW_WRITING_LAYOUT.emails },
  { key: 'essay', section: SwSection.WRITING, task: EtsWritingTask.OPINION_ESSAY, first: 8, count: SW_WRITING_LAYOUT.essay },
]);

export const blockId = (block) => `${block.section}.${block.key}`;
export const swBlockOf = (id) => swBlocks.find((block) => blockId(block) === id) || null;
export const sectionLabels = { [SwSection.SPEAKING]: 'Speaking', [SwSection.WRITING]: 'Writing' };

export function numbersLabel(block) {
  return block.count === 1 ? `Question ${block.first}` : `Questions ${block.first}–${block.first + block.count - 1}`;
}

const fieldNames = {
  text: 'text',
  imageMediaId: 'picture',
  audioMediaId: 'audio',
  keywords: 'words',
  context: 'context',
  info: 'information',
  email: 'email',
  instructions: 'instructions',
  question: 'question',
};

const tokenOf = (token) => {
  const [, name, index] = /^(\w+?)(?:\[(\d+)\])?$/.exec(token) || [null, token];
  return { name, index: index === undefined ? null : Number(index) };
};

export function swIssueBlock(path) {
  const [section, second] = String(path).split('.');
  const block = swBlocks.find((item) => item.section === section && item.key === tokenOf(second || '').name);
  return block ? blockId(block) : null;
}

export function swIssueLabel(path) {
  const tokens = String(path).split('.').map(tokenOf);
  const block = swBlocks.find((item) => item.section === tokens[0]?.name && item.key === tokens[1]?.name);
  if (!block) return String(path);
  const index = tokens.slice(1).find((token) => token.index !== null)?.index ?? null;
  const last = tokens.at(-1);
  const field = tokens.length > 2 && last.index === null ? fieldNames[last.name] : null;
  const numbers = index !== null ? String(block.first + index) : block.count === 1 ? String(block.first) : `${block.first}–${block.first + block.count - 1}`;
  return [sectionLabels[block.section], numbers, field].filter(Boolean).join(' ');
}

const filled = (value) => Boolean(String(value || '').trim());

export function blockProgress(content, block) {
  const { speaking, writing } = content;
  const asked = (set) => set.questions.map((item) => filled(item.text) && Boolean(item.audioMediaId));
  const units = {
    readAloud: () => speaking.readAloud.map((item) => filled(item.text)),
    pictures: () => speaking.pictures.map((item) => Boolean(item.imageMediaId)),
    respondQuestions: () => [filled(speaking.respondQuestions.context), ...asked(speaking.respondQuestions)],
    respondInfo: () => [filled(speaking.respondInfo.info), ...asked(speaking.respondInfo)],
    opinion: () => [filled(speaking.opinion.text)],
    pictureSentences: () => writing.pictureSentences.map((item) => Boolean(item.imageMediaId) && item.keywords.length === PRACTICE_LIMITS.keywords && item.keywords.every(filled)),
    emails: () => writing.emails.map((item) => filled(item.email) && filled(item.instructions)),
    essay: () => [filled(writing.essay.question)],
  }[block.key]();
  return { filled: units.filter(Boolean).length, total: units.length };
}
