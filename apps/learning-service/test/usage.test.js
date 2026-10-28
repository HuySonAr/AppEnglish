import test from 'node:test';
import assert from 'node:assert/strict';
import { UsageGrpcController, UsageRepository } from '../src/usage/usage.grpc.controller.js';

const lessonA = '11111111-1111-4111-8111-111111111111';
const lessonB = '22222222-2222-4222-8222-222222222222';

function fakeDataSource(rows) {
  return {
    isInitialized: true,
    getRepository(entity) {
      const table = rows[entity.options.tableName] || [];
      return {
        async count() { return table.length; },
        createQueryBuilder() {
          let column;
          let ids;
          const builder = {
            select(expression) { column = expression.match(/"(\w+)"/)[1]; return builder; },
            addSelect() { return builder; },
            where(_, params) { ids = params.ids; return builder; },
            groupBy() { return builder; },
            async getRawMany() {
              const counts = new Map();
              for (const row of table) if (ids.includes(row[column])) counts.set(row[column], (counts.get(row[column]) || 0) + 1);
              return [...counts].map(([id, count]) => ({ id, count: String(count) }));
            },
          };
          return builder;
        },
      };
    },
  };
}

test('usage counts learner rows per content id across the tables of its kind', async () => {
  const repository = new UsageRepository(fakeDataSource({
    lesson_test_attempts: [{ lessonId: lessonA }, { lessonId: lessonA }],
    lesson_progress: [{ lessonId: lessonA }, { lessonId: lessonB }],
    mock_attempts: [{ mockTestId: lessonA }],
  }));
  assert.deepEqual(await repository.countUsage('lesson', [lessonA, lessonB]), { [lessonA]: 3, [lessonB]: 1 });
  assert.deepEqual(await repository.countUsage('mockTest', [lessonB]), { [lessonB]: 0 });
  const practice = new UsageRepository(fakeDataSource({ practice_submissions: [{ promptId: lessonA }, { promptId: lessonA }] }));
  assert.deepEqual(await practice.countUsage('practicePrompt', [lessonA, lessonB]), { [lessonA]: 2, [lessonB]: 0 });
});

test('a stored version counts the attempts taken on it (D128)', async () => {
  const repository = new UsageRepository(fakeDataSource({
    lesson_test_attempts: [{ lessonVersionId: lessonA }, { lessonVersionId: lessonA }, { lessonVersionId: lessonB }],
    mock_attempts: [{ mockVersionId: lessonA }],
    unit_review_attempts: [{ reviewVersionId: lessonB }],
  }));
  assert.deepEqual(await repository.countUsage('lessonVersion', [lessonA, lessonB]), { [lessonA]: 2, [lessonB]: 1 });
  assert.deepEqual(await repository.countUsage('mockVersion', [lessonA]), { [lessonA]: 1 });
  assert.deepEqual(await repository.countUsage('unitReviewVersion', [lessonB]), { [lessonB]: 1 });
  assert.deepEqual(await repository.countUsage('listeningVersion', [lessonA]), { [lessonA]: 0 });
});

test('the RPC validates the payload and sums the total', async () => {
  const controller = new UsageGrpcController(new UsageRepository(fakeDataSource({ listening_results: [{ exerciseId: lessonA }] })));
  const ok = await controller.getContentUsage({ payloadJson: JSON.stringify({ kind: 'listeningExercise', ids: [lessonA, lessonA, lessonB] }) });
  assert.equal(ok.httpStatus, 200);
  assert.deepEqual(JSON.parse(ok.dataJson), { kind: 'listeningExercise', counts: { [lessonA]: 1, [lessonB]: 0 }, total: 1 });
  const bad = await controller.getContentUsage({ payloadJson: JSON.stringify({ kind: 'everything', ids: [] }) });
  assert.equal(bad.httpStatus, 400);
  assert.equal(bad.code, 30);
  assert.equal((await controller.getContentUsage({ payloadJson: 'nope' })).httpStatus, 400);
});
