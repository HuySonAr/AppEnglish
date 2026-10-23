import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { CONTENT_GRPC_MAX_MESSAGE_BYTES, CONTENT_PROTO_PATH, contentGrpcLoader, contentGrpcUrl } from '@appenglish/content-contracts/grpc';

const option = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const actor = { id: option('manager-id', '00000000-0000-4000-8000-00000000c0de'), role: 'CONTENT_MANAGER' };
const only = option('only', '');
const limit = Number(option('limit', '0')) || Infinity;

const definition = protoLoader.loadSync(CONTENT_PROTO_PATH, contentGrpcLoader);
const { ContentService } = grpc.loadPackageDefinition(definition).appenglish.content.v1;
const client = new ContentService(contentGrpcUrl(), grpc.credentials.createInsecure(), {
  'grpc.max_send_message_length': CONTENT_GRPC_MAX_MESSAGE_BYTES,
  'grpc.max_receive_message_length': CONTENT_GRPC_MAX_MESSAGE_BYTES,
});
function rpc(name, { id = '', payload } = {}) {
  return new Promise((resolve, reject) => {
    client[name]({ actor, id, payloadJson: payload === undefined ? '' : JSON.stringify(payload) }, { deadline: Date.now() + 120000 }, (error, reply) => {
      if (error) return reject(new Error(`${name}: ${error.message}`));
      const data = JSON.parse(reply.dataJson || '{}');
      if (reply.httpStatus >= 400) return reject(new Error(`${name} answered ${reply.httpStatus} (code ${reply.code}): ${JSON.stringify(data)}`));
      resolve(data);
    });
  });
}

const { units } = await rpc('ListUnits');
let words = 0;
let filled = 0;
let failed = 0;
for (const unit of units) {
  for (const summary of unit.lessons) {
    if (only && summary.title !== only) continue;
    const view = await rpc('GetLesson', { id: summary.id });
    const source = view.draft || view.published;
    if (!source) continue;
    const content = structuredClone(source.content);
    let changed = false;
    for (const item of content.vocabulary) {
      if (words >= limit) break;
      const missing = [item.audioUkMediaId ? null : 'uk', item.audioUsMediaId ? null : 'us'].filter(Boolean);
      if (item.phonetic && !missing.length) continue;
      words += 1;
      try {
        const result = await rpc('AutofillPronunciation', { payload: { word: item.word, accents: missing, lessonId: summary.id } });
        if (!item.phonetic && result.phonetic) item.phonetic = result.phonetic;
        if (!item.audioUkMediaId && result.audio.uk) item.audioUkMediaId = result.audio.uk.id;
        if (!item.audioUsMediaId && result.audio.us) item.audioUsMediaId = result.audio.us.id;
        changed = true;
        filled += 1;
        process.stdout.write(`  ${unit.title} / ${summary.title}: ${item.word} ${result.phonetic}\n`);
      } catch (error) {
        failed += 1;
        process.stdout.write(`  ${unit.title} / ${summary.title}: ${item.word} FAILED ${error.message}\n`);
      }
    }
    if (changed) {
      await rpc('SaveLessonDraft', { id: summary.id, payload: content });
      process.stdout.write(`= saved draft of ${summary.title}\n`);
    }
  }
}
console.log(`Done: ${words} words looked at, ${filled} filled, ${failed} failed.`);
client.close();
