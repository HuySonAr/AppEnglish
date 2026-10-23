import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { CONTENT_GRPC_MAX_MESSAGE_BYTES, CONTENT_PROTO_PATH, contentGrpcLoader, contentGrpcUrl } from '@appenglish/content-contracts/grpc';
import { toContent, toReviewContent } from '../../../content-samples/600-words/to-content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packDir = resolve(here, '../../../content-samples/600-words');
const option = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const force = process.argv.includes('--force');
const reviewsOnly = process.argv.includes('--reviews');
const only = (option('only', '') || '').split(',').map(Number).filter(Boolean);
const actor = { id: option('manager-id', '00000000-0000-4000-8000-00000000c0de'), role: 'CONTENT_MANAGER' };

const definition = protoLoader.loadSync(CONTENT_PROTO_PATH, contentGrpcLoader);
const { ContentService } = grpc.loadPackageDefinition(definition).appenglish.content.v1;
const client = new ContentService(contentGrpcUrl(), grpc.credentials.createInsecure(), {
  'grpc.max_send_message_length': CONTENT_GRPC_MAX_MESSAGE_BYTES,
  'grpc.max_receive_message_length': CONTENT_GRPC_MAX_MESSAGE_BYTES,
});

function call(rpc, request) {
  return new Promise((resolveCall, reject) => {
    client[rpc]({ actor, ...request }, { deadline: Date.now() + 60000 }, (error, reply) => {
      if (error) return reject(new Error(`${rpc}: ${error.message}`));
      const data = JSON.parse(reply.dataJson || '{}');
      if (reply.httpStatus >= 400) return reject(new Error(`${rpc} answered ${reply.httpStatus} (code ${reply.code}): ${JSON.stringify(data)}`));
      resolveCall(data);
    });
  });
}
const rpc = (name, { id = '', payload } = {}) => call(name, { id, payloadJson: payload === undefined ? '' : JSON.stringify(payload) });

const lower = (text) => (text || '').trim().toLowerCase();

function merged(fresh, existing) {
  if (!existing) return fresh;
  const byWord = new Map((existing.vocabulary || []).map((item) => [lower(item.word), item]));
  const vocabulary = fresh.vocabulary.map((item) => {
    const old = byWord.get(lower(item.word));
    return old
      ? { ...item, phonetic: item.phonetic || old.phonetic || '', audioUkMediaId: old.audioUkMediaId ?? null, audioUsMediaId: old.audioUsMediaId ?? null }
      : item;
  });
  const test = Object.fromEntries(
    Object.entries(fresh.test).map(([key, part]) => {
      const old = existing.test?.[key];
      if (!old) return [key, part];
      return [
        key,
        {
          ...part,
          audioMediaId: old.audioMediaId ?? null,
          imageMediaId: old.imageMediaId ?? null,
          questions: part.questions.map((question, index) => ({ ...question, imageMediaId: old.questions?.[index]?.imageMediaId ?? null })),
        },
      ];
    }),
  );
  return { ...fresh, vocabulary, test };
}

const pack = JSON.parse(await readFile(resolve(packDir, 'pack.json'), 'utf8'));
let { units } = await rpc('ListUnits');
let created = 0;
let updated = 0;
let kept = 0;

let unitNumber = 0;
for (const unitEntry of pack.units) {
  unitNumber += 1;
  if (reviewsOnly ? only.length && !only.includes(unitNumber) : only.length && !unitEntry.lessons.some((entry) => only.includes(entry.number))) continue;
  let unit = units.find((item) => item.title === unitEntry.title);
  if (!unit) {
    unit = (await rpc('CreateUnit', { payload: { title: unitEntry.title, description: unitEntry.description } })).unit;
    unit.lessons = [];
    units.push(unit);
    console.log(`+ unit "${unit.title}"`);
  } else console.log(`= unit "${unit.title}"`);

  if (unitEntry.review && (reviewsOnly || !only.length)) {
    const authored = JSON.parse(await readFile(resolve(packDir, unitEntry.review), 'utf8'));
    const view = await rpc('GetUnitReview', { id: unit.id });
    const existing = view.draft?.content || view.published?.content || null;
    const count = existing ? Object.values(existing.test).reduce((sum, part) => sum + part.questions.length, 0) : 0;
    if (!force && count >= 30) {
      console.log(`  = review (already has ${count} questions; use --force to replace)`);
      kept += 1;
    } else {
      await rpc('SaveUnitReviewDraft', { id: unit.id, payload: toReviewContent(authored) });
      console.log(`  + review${existing ? ' (new draft over existing content)' : ''}`);
      if (existing) updated += 1;
      else created += 1;
    }
  }
  if (reviewsOnly) continue;

  for (const entry of unitEntry.lessons) {
    if (only.length && !only.includes(entry.number)) continue;
    const authored = JSON.parse(await readFile(resolve(packDir, entry.file), 'utf8'));
    let lesson = (unit.lessons || []).find((item) => item.title === entry.title);
    let existing = null;
    if (!lesson) {
      lesson = (await rpc('CreateLesson', { id: unit.id, payload: { title: entry.title } })).lesson;
      created += 1;
    } else {
      const view = await rpc('GetLesson', { id: lesson.id });
      existing = view.draft?.content || view.published?.content || null;
      if (!force && (existing?.vocabulary?.length || 0) >= 12) {
        console.log(`  = ${String(entry.number).padStart(2, '0')} ${entry.title} (already has ${existing.vocabulary.length} words; use --force to replace)`);
        kept += 1;
        continue;
      }
    }
    await rpc('SaveLessonDraft', { id: lesson.id, payload: merged(toContent(authored), existing) });
    if (existing) updated += 1;
    console.log(`  + ${String(entry.number).padStart(2, '0')} ${entry.title}${existing ? ' (new draft over existing content)' : ''}`);
  }
}
console.log(`Done: ${created} created, ${updated} drafts rewritten, ${kept} left as they were.`);
client.close();
