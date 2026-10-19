// Loads the Listening course demo pack (content-samples/listening-course,
// built by build.py) into a running content-service, through the same gRPC
// calls a Content Manager's pages use: a listening topic, one published
// library exercise per recording (audio uploaded to media storage, timed
// sentences), then per level a published unit and level test, and the
// published listening placement.
//
// Safe to run again: what already exists with the same title is reused, and
// what is already published is left as it is.
//
//   node --env-file=../../.env scripts/seed-listening-course.mjs [--manager-id <uuid>] [--pack <pack.json>]
//
// --manager-id is recorded as the author (createdBy); use the id of a
// Content Manager account. Without it a fixed demo id is used.
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { CONTENT_GRPC_MAX_MESSAGE_BYTES, CONTENT_PROTO_PATH, contentGrpcLoader, contentGrpcUrl } from '@appenglish/content-contracts/grpc';

const here = dirname(fileURLToPath(import.meta.url));
const option = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const packPath = resolve(option('pack', resolve(here, '../../../content-samples/listening-course/pack.json')));
const actor = { id: option('manager-id', '00000000-0000-4000-8000-00000000c0de'), role: 'CONTENT_MANAGER' };

const definition = protoLoader.loadSync(CONTENT_PROTO_PATH, contentGrpcLoader);
const { ContentService } = grpc.loadPackageDefinition(definition).appenglish.content.v1;
const client = new ContentService(contentGrpcUrl(), grpc.credentials.createInsecure(), {
  'grpc.max_send_message_length': CONTENT_GRPC_MAX_MESSAGE_BYTES,
  'grpc.max_receive_message_length': CONTENT_GRPC_MAX_MESSAGE_BYTES,
});

// One RPC; its data, or an error with the issues content-service gave.
function call(rpc, request) {
  return new Promise((resolveCall, reject) => {
    client[rpc]({ actor, ...request }, { deadline: Date.now() + 120000 }, (error, reply) => {
      if (error) return reject(new Error(`${rpc}: ${error.message}`));
      const data = JSON.parse(reply.dataJson || '{}');
      if (reply.httpStatus >= 400) return reject(new Error(`${rpc} answered ${reply.httpStatus} (code ${reply.code}): ${JSON.stringify(data)}`));
      resolveCall(data);
    });
  });
}
const rpc = (name, { id = '', payload } = {}) => call(name, { id, payloadJson: payload === undefined ? '' : JSON.stringify(payload) });

const pack = JSON.parse(await readFile(packPath, 'utf8'));
const packDir = dirname(packPath);
console.log(`Pack ${packPath}: ${Object.keys(pack.recordings).length} recordings, ${pack.levels.length} levels.`);

// ----- The topic and the library exercises.
let topic = (await rpc('ListListeningTopics')).topics.find((item) => item.name === pack.topic);
if (!topic) topic = (await rpc('CreateListeningTopic', { payload: { name: pack.topic, format: 'toeic' } })).topic;
console.log(`Topic "${topic.name}"`);

const existing = (await rpc('ListListeningExercises')).exercises.filter((exercise) => exercise.topic?.id === topic.id);
// Recording key → { id, segments (with their ids, in order) }.
const exercises = {};
for (const [key, recording] of Object.entries(pack.recordings)) {
  let exercise = existing.find((item) => item.title === recording.title);
  if (exercise?.publishedVersionNumber) {
    const view = await rpc('GetListeningExercise', { id: exercise.id });
    exercises[key] = { id: exercise.id, segments: view.published.content.segments };
    console.log(`  = ${recording.title}`);
    continue;
  }
  if (!exercise) exercise = (await rpc('CreateListeningExercise', { payload: { topicId: topic.id, title: recording.title, level: recording.level, kind: recording.kind } })).exercise;
  const data = await readFile(resolve(packDir, recording.file));
  const media = await call('UploadMedia', { kind: 'audio', fileName: recording.file.split('/').pop(), mimeType: 'audio/mpeg', data, lessonId: '', section: 'listening' });
  await rpc('SaveListeningExerciseDraft', { id: exercise.id, payload: { audioMediaId: media.media.id, segments: recording.segments } });
  const published = await rpc('PublishListeningExercise', { id: exercise.id });
  exercises[key] = { id: exercise.id, segments: published.published.content.segments };
  console.log(`  + ${recording.title}`);
}

// ----- The course: units, level tests and the placement.
const section = (entry) => ({ exerciseId: exercises[entry.recording].id, questions: entry.questions });
const course = await rpc('ListListeningCourse');

// Creates the item when missing, then saves and publishes its content unless
// it is already published.
async function publishItem(found, create, content, label) {
  if (found?.publishedVersionNumber) return console.log(`  = ${label}`);
  const id = found?.id || (await rpc('CreateCourseItem', { payload: create })).item.id;
  await rpc('SaveCourseItemDraft', { id, payload: content });
  await rpc('PublishCourseItem', { id });
  console.log(`  + ${label}`);
}

for (const level of pack.levels) {
  const current = course.levels.find((entry) => entry.level === level.level);
  const { unit } = level;
  await publishItem(
    current.units.find((entry) => entry.title === unit.title),
    { level: level.level, type: 'unit', section: unit.section || 'social_and_travel', title: unit.title, description: unit.description },
    {
      lessons: unit.lessons.map((lesson) => ({
        title: lesson.title,
        exerciseId: exercises[lesson.recording].id,
        keywords: lesson.keywords,
        gist: lesson.gist,
        detail: lesson.detail,
        closeSegmentIds: lesson.close.map((index) => exercises[lesson.recording].segments[index].id),
      })),
      check: { sections: unit.check.map(section) },
    },
    `${level.level} unit "${unit.title}"`,
  );
  await publishItem(
    current.levelTest,
    { level: level.level, type: 'level_test', title: level.levelTest.title, description: '' },
    { sections: level.levelTest.sections.map(section) },
    `${level.level} level test`,
  );
}

await publishItem(
  course.placement,
  { level: null, type: 'placement', title: 'Listening placement', description: '' },
  { sections: pack.levels.map((level) => ({ ...section(level.placement), level: level.level })) },
  'Listening placement',
);
console.log('Done.');
client.close();
