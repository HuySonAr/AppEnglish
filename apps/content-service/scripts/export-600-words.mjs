// Writes what the running content-service holds back into the authoring
// files of content-samples/600-words (D124): the unit reviews, and with
// --lessons the lessons too. The published version is taken when there is
// one, else the draft. Media ids are not part of the format.
//
//   node --env-file=../../.env scripts/export-600-words.mjs [--manager-id <uuid>] [--lessons] [--only 1,2]
//
// --only names unit numbers for reviews, lesson numbers with --lessons.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { CONTENT_GRPC_MAX_MESSAGE_BYTES, CONTENT_PROTO_PATH, contentGrpcLoader, contentGrpcUrl } from '@appenglish/content-contracts/grpc';
import { authoringFromLesson, authoringFromReview } from '@appenglish/content-contracts/authoring';

const here = dirname(fileURLToPath(import.meta.url));
const packDir = resolve(here, '../../../content-samples/600-words');
const option = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const lessonsToo = process.argv.includes('--lessons');
const only = (option('only', '') || '').split(',').map(Number).filter(Boolean);
const actor = { id: option('manager-id', '00000000-0000-4000-8000-00000000c0de'), role: 'CONTENT_MANAGER' };

const definition = protoLoader.loadSync(CONTENT_PROTO_PATH, contentGrpcLoader);
const { ContentService } = grpc.loadPackageDefinition(definition).appenglish.content.v1;
const client = new ContentService(contentGrpcUrl(), grpc.credentials.createInsecure(), {
  'grpc.max_send_message_length': CONTENT_GRPC_MAX_MESSAGE_BYTES,
  'grpc.max_receive_message_length': CONTENT_GRPC_MAX_MESSAGE_BYTES,
});
function rpc(name, { id = '', payload } = {}) {
  return new Promise((resolveCall, reject) => {
    client[name]({ actor, id, payloadJson: payload === undefined ? '' : JSON.stringify(payload) }, { deadline: Date.now() + 60000 }, (error, reply) => {
      if (error) return reject(new Error(`${name}: ${error.message}`));
      const data = JSON.parse(reply.dataJson || '{}');
      if (reply.httpStatus >= 400) return reject(new Error(`${name} answered ${reply.httpStatus} (code ${reply.code}): ${JSON.stringify(data)}`));
      resolveCall(data);
    });
  });
}
const save = (file, data) => writeFile(resolve(packDir, file), `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const pack = JSON.parse(await readFile(resolve(packDir, 'pack.json'), 'utf8'));
const { units } = await rpc('ListUnits');
let written = 0;
let unitNumber = 0;
for (const unitEntry of pack.units) {
  unitNumber += 1;
  const unit = units.find((item) => item.title === unitEntry.title);
  if (!unit) {
    console.log(`- unit "${unitEntry.title}" is not in the system`);
    continue;
  }
  if (!lessonsToo && unitEntry.review && (!only.length || only.includes(unitNumber))) {
    const view = await rpc('GetUnitReview', { id: unit.id });
    const content = view.published?.content || view.draft?.content;
    if (!content) console.log(`- ${String(unitNumber).padStart(2, '0')} ${unitEntry.title}: no review`);
    else {
      await save(unitEntry.review, { unit: unitNumber, title: unitEntry.title, ...authoringFromReview(content) });
      written += 1;
      console.log(`+ ${unitEntry.review} (${view.published ? `published v${view.published.versionNumber}` : `draft v${view.draft.versionNumber}`})`);
    }
  }
  if (!lessonsToo) continue;
  for (const entry of unitEntry.lessons) {
    if (only.length && !only.includes(entry.number)) continue;
    const summary = (unit.lessons || []).find((item) => item.title === entry.title);
    if (!summary) {
      console.log(`- ${entry.file}: lesson not in the system`);
      continue;
    }
    const view = await rpc('GetLesson', { id: summary.id });
    const content = view.published?.content || view.draft?.content;
    if (!content) continue;
    await save(entry.file, { number: entry.number, title: entry.title, ...authoringFromLesson(content) });
    written += 1;
    console.log(`+ ${entry.file}`);
  }
}
console.log(`Done: ${written} file${written === 1 ? '' : 's'} written.`);
client.close();
