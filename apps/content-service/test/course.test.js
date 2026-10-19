import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentService } from '../src/content/content.service.js';
import { CourseService } from '../src/course/course.service.js';
import { ListeningService } from '../src/listening/listening.service.js';
import { listeningContentSchema } from '../src/listening/listening.schemas.js';
import { courseItemCreateSchema } from '../src/course/course.schemas.js';
import { admin, createMemoryRepository, manager, student, toeicTopicId } from './memory-repository.js';

async function harness() {
  const repository = createMemoryRepository();
  const storage = {
    async upload(input) {
      return {
        id: 's',
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: 1,
        url: `https://media.test/${input.fileName}`,
        storage: 'r2',
      };
    },
    async delete() {},
  };
  const content = new ContentService(repository, storage);
  const listening = new ListeningService(repository.listening, content);
  const service = new CourseService(repository.course, content, listening);
  // A published library exercise of four sentences.
  const audioId = (
    await content.uploadMedia(manager, {
      kind: 'audio',
      fileName: 'shop.mp3',
      mimeType: 'audio/mpeg',
      data: Buffer.from([1]),
      section: 'listening',
    })
  ).media.id;
  const { exercise } = await listening.createExercise(manager, {
    topicId: toeicTopicId,
    title: 'At the shop',
    level: 'A2',
    kind: 'part1',
  });
  const saved = await listening.saveDraft(
    manager,
    exercise.id,
    listeningContentSchema.parse({
      audioMediaId: audioId,
      segments: ['Can I help you?', 'Yes, a coffee please.', 'Small or large?', 'Large, please.'].map((text) => ({ text })),
    }),
  );
  await listening.publish(manager, exercise.id);
  return {
    service,
    repository,
    exerciseId: exercise.id,
    segments: saved.draft.content.segments,
  };
}

const question = (prompt, skill = 'detail', correct = 0) => ({
  skill,
  prompt,
  options: ['A coffee', 'A tea', 'A cake'].map((text, index) => ({
    text,
    isCorrect: index === correct,
  })),
  explanation: 'She asks for a coffee.',
});

test('only a Content Manager writes the course; one level test per level', async () => {
  const { service } = await harness();
  for (const actor of [student, admin]) {
    await assert.rejects(() => service.listCourse(actor), { code: 26 });
    await assert.rejects(
      () =>
        service.createItem(actor, {
          level: 'A1',
          type: 'unit',
          section: 'social_and_travel',
          title: 'Me',
          description: '',
        }),
      { code: 26 },
    );
  }
  const first = await service.createItem(manager, {
    level: 'A2',
    type: 'unit',
    section: 'social_and_travel',
    title: 'Shopping',
    description: 'Buying things',
  });
  const second = await service.createItem(manager, {
    level: 'A2',
    type: 'unit',
    section: 'social_and_travel',
    title: 'Travel',
    description: '',
  });
  await service.createItem(manager, {
    level: 'A2',
    type: 'level_test',
    title: 'A2 test',
    description: '',
  });
  await assert.rejects(
    () =>
      service.createItem(manager, {
        level: 'A2',
        type: 'level_test',
        title: 'Again',
        description: '',
      }),
    { code: 41, data: { reason: 'LEVEL_TEST_EXISTS' } },
  );
  assert.deepEqual(first.draft.content, {
    lessons: [],
    check: { sections: [] },
  });

  // A unit needs a section; nothing else takes one (D107).
  assert.equal(
    courseItemCreateSchema.safeParse({
      level: 'A2',
      type: 'unit',
      title: 'No section',
    }).success,
    false,
  );
  assert.equal(
    courseItemCreateSchema.safeParse({
      level: 'B1',
      type: 'level_test',
      section: 'work_and_study',
      title: 'B1',
    }).success,
    false,
  );
  assert.equal(
    courseItemCreateSchema.safeParse({
      level: 'B1',
      type: 'unit',
      section: 'work_and_study',
      title: 'B1',
    }).success,
    true,
  );
  const work = await service.createItem(manager, {
    level: 'A2',
    type: 'unit',
    section: 'work_and_study',
    title: 'Phone calls',
    description: '',
  });
  assert.deepEqual([work.item.section, work.item.position], ['work_and_study', 1]);

  // Units move within their section; the sections keep their order.
  await service.updateItem(manager, second.item.id, { position: 1 });
  const { levels } = await service.listCourse(manager);
  assert.deepEqual(
    levels.map((level) => level.level),
    ['A1', 'A2', 'B1', 'B2', 'C1'],
  );
  const a2 = levels[1];
  assert.deepEqual(
    a2.units.map((unit) => [unit.title, unit.section, unit.position, unit.hasDraft, unit.publishedVersionNumber]),
    [
      ['Travel', 'social_and_travel', 1, true, null],
      ['Shopping', 'social_and_travel', 2, true, null],
      ['Phone calls', 'work_and_study', 1, true, null],
    ],
  );

  // Moving to the other section puts the unit last there and closes the gap it left.
  await service.updateItem(manager, second.item.id, {
    section: 'work_and_study',
  });
  const after = (await service.listCourse(manager)).levels[1].units.map((unit) => [unit.title, unit.section, unit.position]);
  assert.deepEqual(after, [
    ['Shopping', 'social_and_travel', 1],
    ['Phone calls', 'work_and_study', 1],
    ['Travel', 'work_and_study', 2],
  ]);
  assert.equal(a2.levelTest.title, 'A2 test');
  assert.equal(levels[0].levelTest, null);
});

test('a unit is written lesson by lesson and published when complete', async () => {
  const { service, exerciseId, segments } = await harness();
  const { item } = await service.createItem(manager, {
    level: 'A2',
    type: 'unit',
    section: 'social_and_travel',
    title: 'Shopping',
    description: '',
  });

  // An empty unit cannot be published.
  await assert.rejects(
    () => service.publish(manager, item.id),
    (error) => {
      assert.deepEqual(
        error.data.issues.map((issue) => issue.path),
        ['lessons', 'check.sections'],
      );
      return true;
    },
  );

  const lesson = {
    title: 'At the café',
    exerciseId,
    keywords: [{ word: 'large', meaning: 'lớn' }],
    gist: question('Where are they?', 'gist'),
    detail: [question('What does she want?'), question('Which size?', 'detail', 1)],
    closeSegmentIds: [segments[1].id, segments[3].id],
  };
  const check = {
    sections: [
      {
        exerciseId,
        questions: [1, 2, 3, 4, 5].map((n) => question(`Check ${n}?`)),
      },
    ],
  };
  const saved = await service.saveDraft(manager, item.id, {
    lessons: [lesson],
    check,
  });
  // Ids are given to everything; the recording comes with its sentences.
  const [kept] = saved.draft.content.lessons;
  assert.ok(kept.id && kept.keywords[0].id && kept.gist.id && kept.gist.options[0].id && saved.draft.content.check.sections[0].id);
  assert.deepEqual(
    saved.exercises[exerciseId].segments.map((segment) => segment.text),
    ['Can I help you?', 'Yes, a coffee please.', 'Small or large?', 'Large, please.'],
  );
  assert.equal(saved.exercises[exerciseId].audioUrl, 'https://media.test/shop.mp3');

  const published = await service.publish(manager, item.id);
  assert.deepEqual([published.draft, published.published.versionNumber], [null, 1]);
  const unit = (await service.listCourse(manager)).levels[1].units[0];
  assert.deepEqual([unit.publishedVersionNumber, unit.hasDraft, unit.lessons, unit.questions], [1, false, 1, 5]);

  // Editing again makes version 2, keeping the ids.
  const again = await service.saveDraft(manager, item.id, {
    ...published.published.content,
    lessons: [
      {
        ...published.published.content.lessons[0],
        title: 'At the coffee shop',
      },
    ],
  });
  assert.deepEqual([again.draft.versionNumber, again.draft.content.lessons[0].id], [2, kept.id]);
});

test('a detail question completed with words heard and a Focus on step (D109)', async () => {
  const { service, exerciseId } = await harness();
  const { item } = await service.createItem(manager, { level: 'A2', type: 'unit', section: 'social_and_travel', title: 'Hello', description: '' });
  const complete = { kind: 'complete', prompt: 'Where are you ___?', answers: ['from'], explanation: 'She asks where he is from.' };
  const focus = {
    title: 'Saying hello',
    passage: "A: Hello. How's it ___?\nB: Oh, not too ___, thanks.",
    words: ['going', 'bad', 'well'],
    answers: ['going', 'bad'],
  };
  const lesson = (detail, focusOn) => ({
    title: 'Hi',
    exerciseId,
    keywords: [],
    gist: question('Where?', 'gist'),
    detail,
    focus: focusOn,
    closeSegmentIds: [],
  });
  const issuesOf = async (content) => {
    await service.saveDraft(manager, item.id, content);
    try {
      await service.publish(manager, item.id);
      return [];
    } catch (error) {
      return error.data.issues.map((issue) => issue.path);
    }
  };
  // Right: one choice, one completed sentence, a Focus on with two blanks.
  const good = {
    lessons: [lesson([question('What?'), complete], focus)],
    check: { sections: [{ exerciseId, questions: [1, 2, 3, 4, 5].map((n) => question(`Q${n}?`)) }] },
  };
  const saved = await service.saveDraft(manager, item.id, good);
  const closeIds = saved.exercises[exerciseId].segments.slice(0, 1).map((segment) => segment.id);
  good.lessons[0].closeSegmentIds = closeIds;
  assert.deepEqual(await issuesOf(good), []);
  // Wrong: blanks and answers out of step, an answer not among the words, a
  // completed sentence where only choices are allowed, an empty Focus on is fine.
  const bad = structuredClone(good);
  bad.lessons[0].detail[1] = { ...complete, prompt: 'Where are you ___ ___?' };
  bad.lessons[0].focus = { ...focus, answers: ['going', 'nice'] };
  bad.lessons[0].gist = { ...question('Where?', 'gist'), kind: 'complete', prompt: 'Where ___?', answers: ['x'] };
  bad.check.sections[0].questions[0] = { ...complete };
  assert.deepEqual(await issuesOf(bad), [
    'lessons[0].gist.kind',
    'lessons[0].detail[1].answers',
    'lessons[0].focus.answers',
    'check.sections[0].questions[0].kind',
  ]);
  const none = structuredClone(good);
  none.lessons[0].focus = { title: '', passage: '', words: [], answers: [] };
  assert.deepEqual(await issuesOf(none), []);
});

test('publishing rules of a unit and a level test', async () => {
  const { service, exerciseId, segments } = await harness();
  const { item } = await service.createItem(manager, {
    level: 'B1',
    type: 'unit',
    section: 'social_and_travel',
    title: 'Work',
    description: '',
  });
  const bad = {
    lessons: [
      {
        title: '',
        exerciseId: '99999999-9999-4999-8999-999999999999',
        keywords: [{ word: 'boss', meaning: '' }],
        gist: {
          skill: 'gist',
          prompt: '',
          options: [
            { text: 'Same', isCorrect: true },
            { text: 'same', isCorrect: true },
          ],
        },
        detail: [question('Only one?')],
        closeSegmentIds: [],
      },
      {
        title: 'Two',
        exerciseId,
        gist: question('Gist?', 'gist'),
        detail: [question('A?'), question('B?')],
        closeSegmentIds: ['88888888-8888-4888-8888-888888888888'],
      },
    ],
    check: { sections: [{ exerciseId, questions: [question('Only?')] }] },
  };
  await service.saveDraft(manager, item.id, bad);
  await assert.rejects(
    () => service.publish(manager, item.id),
    (error) => {
      assert.deepEqual(
        error.data.issues.map((issue) => `${issue.path}: ${issue.message}`),
        [
          'lessons[0].title: Give the lesson a title',
          'lessons[0].exerciseId: The recording is not published',
          'lessons[0].keywords[0]: A keyword needs the word and its meaning',
          'lessons[0].gist.prompt: Write the question',
          'lessons[0].gist.options: Options must be different',
          'lessons[0].gist.options: Exactly one option must be correct',
          'lessons[0].detail: 2 to 5 detail questions are needed',
          'lessons[0].closeSegmentIds: Choose 1 to 6 sentences to write down',
          'lessons[1].closeSegmentIds: A chosen sentence is no longer in the recording',
          'check.sections: A unit check needs at least 5 questions; it has 1',
        ],
      );
      return true;
    },
  );
  assert.ok(segments.length);

  const { item: levelTest } = await service.createItem(manager, {
    level: 'B1',
    type: 'level_test',
    title: 'B1 test',
    description: '',
  });
  await service.saveDraft(manager, levelTest.id, {
    sections: [{ exerciseId, questions: [question('One?')] }],
  });
  await assert.rejects(
    () => service.publish(manager, levelTest.id),
    (error) => {
      assert.deepEqual(
        error.data.issues.map((issue) => issue.message),
        ['A level test needs at least 8 questions; it has 1'],
      );
      return true;
    },
  );
  await service.saveDraft(manager, levelTest.id, {
    sections: [
      {
        exerciseId,
        questions: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => question(`Q${n}?`)),
      },
    ],
  });
  assert.equal((await service.publish(manager, levelTest.id)).published.versionNumber, 1);
  await assert.rejects(() => service.getItem(manager, '77777777-7777-4777-8777-777777777777'), { code: 40, status: 404 });
});

test('learning-service reads the published course and one unit with its answers', async () => {
  const { service, exerciseId, segments } = await harness();
  const { item } = await service.createItem(manager, {
    level: 'A2',
    type: 'unit',
    section: 'social_and_travel',
    title: 'Shopping',
    description: '',
  });
  await service.createItem(manager, {
    level: 'A2',
    type: 'unit',
    section: 'social_and_travel',
    title: 'Draft only',
    description: '',
  });
  const lesson = {
    title: 'At the café',
    exerciseId,
    gist: question('Where?', 'gist'),
    detail: [question('What?'), question('Size?')],
    closeSegmentIds: [segments[1].id],
  };
  await service.saveDraft(manager, item.id, {
    lessons: [lesson],
    check: {
      sections: [
        {
          exerciseId,
          questions: [1, 2, 3, 4, 5].map((n) => question(`C${n}?`)),
        },
      ],
    },
  });
  const { published } = await service.publish(manager, item.id);
  const course = await service.listPublished();
  assert.deepEqual(
    course.levels[1].units.map((unit) => [unit.title, unit.lessons.map((entry) => entry.title), unit.questionCount]),
    [['Shopping', ['At the café'], 5]],
  );
  const paper = await service.getPaper(item.id);
  assert.equal(paper.versionId, published.versionId);
  assert.equal(paper.content.lessons[0].gist.options.filter((option) => option.isCorrect).length, 1);
  assert.equal(paper.exercises[exerciseId].segments[1].text, 'Yes, a coffee please.');
  await assert.rejects(
    () =>
      service.getPaper(course.levels[1].units[0].id, {
        versionId: '99999999-9999-4999-8999-999999999999',
      }),
    { code: 40 },
  );
});

test('one listening placement without a level, published with questions for every level', async () => {
  const { service, exerciseId } = await harness();
  // The payload schema: the placement has no level, the others need one.
  assert.equal(
    courseItemCreateSchema.safeParse({
      level: 'A1',
      type: 'placement',
      title: 'P',
    }).success,
    false,
  );
  assert.equal(
    courseItemCreateSchema.safeParse({
      type: 'unit',
      section: 'social_and_travel',
      title: 'U',
    }).success,
    false,
  );
  const { item } = await service.createItem(manager, {
    level: null,
    type: 'placement',
    title: 'Listening placement',
    description: '',
  });
  assert.equal(item.level, null);
  await assert.rejects(
    () =>
      service.createItem(manager, {
        level: null,
        type: 'placement',
        title: 'Again',
        description: '',
      }),
    { code: 41, data: { reason: 'PLACEMENT_EXISTS' } },
  );
  // Two questions for A1 only, and one recording without its level.
  await service.saveDraft(manager, item.id, {
    sections: [
      {
        exerciseId,
        level: 'A1',
        questions: [question('One?'), question('Two?')],
      },
      { exerciseId, questions: [question('Three?')] },
    ],
  });
  await assert.rejects(
    () => service.publish(manager, item.id),
    (error) => {
      assert.deepEqual(
        error.data.issues.map((issue) => `${issue.path}: ${issue.message}`),
        [
          'sections[1].level: Choose the level this recording tests',
          'sections: A2 needs at least 2 questions; it has 0',
          'sections: B1 needs at least 2 questions; it has 0',
          'sections: B2 needs at least 2 questions; it has 0',
          'sections: C1 needs at least 2 questions; it has 0',
        ],
      );
      return true;
    },
  );
  const sections = ['A1', 'A2', 'B1', 'B2', 'C1'].map((level) => ({
    exerciseId,
    level,
    questions: [question(`${level} 1?`), question(`${level} 2?`), question(`${level} 3?`)],
  }));
  const saved = await service.saveDraft(manager, item.id, { sections });
  assert.deepEqual(
    saved.draft.content.sections.map((section) => section.level),
    ['A1', 'A2', 'B1', 'B2', 'C1'],
  );
  await service.publish(manager, item.id);
  const managed = await service.listCourse(manager);
  assert.deepEqual([managed.placement.title, managed.placement.questions, managed.placement.levels], ['Listening placement', 15, 5]);
  const published = await service.listPublished();
  assert.deepEqual([published.placement.id, published.placement.questionCount], [item.id, 15]);
  const paper = await service.getPaper(item.id);
  assert.equal(paper.content.sections[4].level, 'C1');
});
