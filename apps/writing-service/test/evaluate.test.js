import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords } from '@appenglish/learning-contracts';
import { evaluationJob, parseCsv, readEllipse, sampleItems, systemScores } from '../src/ellipse.js';
import { compareScores, mae, pearson, qwk, spearman } from '../src/metrics.js';
import { buildWritingPrompt } from '../src/rubric.js';

test('metrics match known values', () => {
  assert.equal(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1);
  assert.equal(pearson([1, 1], [1, 2]), null);
  assert.equal(spearman([1, 2, 3], [10, 20, 90]), 1);
  assert.equal(mae([1, 2], [2, 4]), 1.5);
  assert.equal(qwk([1, 2, 3, 4, 5], [1, 2, 3, 4, 5]), 1);
  assert.ok(qwk([1, 5, 1, 5], [5, 1, 5, 1]) < 0);
  const report = compareScores([{ system: { a: 3 }, expert: { a: 3.5 } }, { system: { a: 4 }, expert: { a: 4 } }, { system: { a: null }, expert: { a: 1 } }], ['a']);
  assert.deepEqual([report.a.n, report.a.mae, report.a.pearson], [2, 0.25, 1]);
});

test('the ELLIPSE CSV is read with quotes, commas and line breaks', () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n'), [['a', 'b'], ['x, y', 'say "hi"\nthere']]);
  const csv = '﻿text_id_kaggle,full_text,prompt,Overall,Cohesion,Syntax,Vocabulary,Phraseology,Grammar,Conventions\r\nk1,"I think, school is good.",School uniforms,3.5,3,3.5,4,3,3,4\r\nk2,Phones help,Phones,2,2,2,2.5,2,1.5,2\r\n';
  const items = readEllipse(csv);
  assert.deepEqual(items[0], { id: 'k1', text: 'I think, school is good.', prompt: 'School uniforms', expert: { cohesion: 3, syntax: 3.5, vocabulary: 4, phraseology: 3, grammar: 3, conventions: 4, overall: 3.5 } });
  assert.throws(() => readEllipse('full_text\nhello\n'));
  assert.deepEqual(sampleItems(items, 1, 7), sampleItems(items, 1, 7));
  assert.equal(sampleItems(items, 5, 1).length, 2);
  const job = evaluationJob(items[0], countWords);
  assert.ok(buildWritingPrompt(job).includes('School uniforms'));
  assert.equal(job.prompt.maxWords, 5);
});

test('the system overall is the mean of the six ELLIPSE criteria on the half-point scale', () => {
  const scores = systemScores({ criteria: { cohesion: 3, syntax: 3, vocabulary: 4, phraseology: 3.5, grammar: 2.5, conventions: 3, task: 5 }, scores: { total: 3.6 } });
  assert.deepEqual([scores.overall, scores.total, scores.task], [3, 3.6, 5]);
});
