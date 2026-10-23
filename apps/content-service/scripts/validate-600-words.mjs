import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countBlanks } from '@appenglish/content-contracts';
import { lessonContentSchema, publishIssues, unitReviewContentSchema, unitReviewIssues } from '../src/content/content.schemas.js';
import { toContent, toReviewContent } from '../../../content-samples/600-words/to-content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const packDir = resolve(here, '../../../content-samples/600-words');
const pack = JSON.parse(await readFile(resolve(packDir, 'pack.json'), 'utf8'));
const reviewsOnly = process.argv.includes('reviews');
const only = process.argv.slice(2).map(Number).filter(Boolean);

const lower = (text) => (text || '').trim().toLowerCase();
const words = (text) => (text || '').split(/\s+/).filter(Boolean).length;
const hasBlank = (text) => /_{3,}|-{3,}/.test(text || '');
const mediaIssue = (issue) => /^(Audio|Image) is required$/.test(issue.message);
const relatedTo = (answer, list) => list.some((word) => {
  const a = lower(answer).replace(/\s+/g, ' ');
  const w = lower(word);
  const stem = w.slice(0, Math.max(3, w.length - 2));
  return a === w || a.startsWith(stem) || (w.includes(' ') && a.split(' ')[0].startsWith(w.split(' ')[0].slice(0, 3)));
});

const withIds = (content) => ({
  ...content,
  ...(content.vocabulary ? { vocabulary: content.vocabulary.map((item) => ({ ...item, id: randomUUID() })) } : {}),
  test: Object.fromEntries(
    Object.entries(content.test).map(([key, part]) => [
      key,
      { ...part, questions: part.questions.map((question) => ({ ...question, id: randomUUID(), options: question.options.map((option) => ({ ...option, id: randomUUID() })) })) },
    ]),
  ),
});

let failed = 0;
let checked = 0;

async function checkReview(unitNumber, unit) {
  const label = `review ${String(unitNumber).padStart(2, '0')} ${unit.title}`;
  const errors = [];
  const warnings = [];
  let review;
  try {
    review = JSON.parse(await readFile(resolve(packDir, unit.review), 'utf8'));
  } catch (error) {
    console.log(`✖ ${label}: ${error.code === 'ENOENT' ? 'file missing' : error.message}`);
    failed += 1;
    return;
  }
  checked += 1;
  if (review.unit !== unitNumber) errors.push(`unit is ${review.unit}, pack says ${unitNumber}`);
  if (review.title !== unit.title) errors.push(`title is "${review.title}", pack says "${unit.title}"`);
  try {
    const content = withIds(unitReviewContentSchema.parse(toReviewContent(review)));
    for (const issue of unitReviewIssues(content)) errors.push(`${issue.path}: ${issue.message}`);
    (review.part5 || []).forEach((item, index) => {
      if (!hasBlank(item.prompt)) errors.push(`part5 question ${index + 1} has no blank (_____ or ___)`);
    });
    const unitWords = unit.lessons.flatMap((lesson) => lesson.words.map(lower));
    const text = lower(JSON.stringify(review));
    const absent = unitWords.filter((word) => !text.includes(word.split(' ')[0].slice(0, Math.max(3, word.split(' ')[0].length - 2))));
    if (absent.length) warnings.push(`review does not use: ${absent.join(', ')}`);
    (review.part6 || []).forEach((passage, index) => {
      if (words(passage.passage) < 70) warnings.push(`part6 passage ${index + 1} is short (${words(passage.passage)} words; aim for 80–130)`);
    });
  } catch (error) {
    errors.push(`shape: ${error.issues ? error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ') : error.message}`);
  }
  if (errors.length) failed += 1;
  console.log(`${errors.length ? '✖' : '✔'} ${label}`);
  for (const line of errors) console.log(`    error: ${line}`);
  for (const line of warnings) console.log(`    warn:  ${line}`);
}

if (reviewsOnly) {
  let unitNumber = 0;
  for (const unit of pack.units) {
    unitNumber += 1;
    if (only.length && !only.includes(unitNumber)) continue;
    if (unit.review) await checkReview(unitNumber, unit);
  }
  console.log(`\n${checked} review${checked === 1 ? '' : 's'} checked, ${failed} with errors.`);
  process.exit(failed ? 1 : 0);
}

for (const unit of pack.units) {
  for (const entry of unit.lessons) {
    if (only.length && !only.includes(entry.number)) continue;
    const errors = [];
    const warnings = [];
    let lesson;
    try {
      lesson = JSON.parse(await readFile(resolve(packDir, entry.file), 'utf8'));
    } catch (error) {
      console.log(`✖ ${String(entry.number).padStart(2, '0')} ${entry.title}: ${error.code === 'ENOENT' ? 'file missing' : error.message}`);
      failed += 1;
      continue;
    }
    checked += 1;
    if (lesson.number !== entry.number) errors.push(`number is ${lesson.number}, pack says ${entry.number}`);
    if (lesson.title !== entry.title) errors.push(`title is "${lesson.title}", pack says "${entry.title}"`);

    const have = (lesson.vocabulary || []).map((item) => lower(item.word));
    const want = entry.words.map(lower);
    for (const word of want) if (!have.includes(word)) errors.push(`vocabulary is missing "${word}"`);
    for (const word of have) if (!want.includes(word)) errors.push(`vocabulary has "${word}", which is not in the pack`);
    (lesson.vocabulary || []).forEach((item, index) => {
      for (const field of ['meaning', 'example', 'exampleMeaning'])
        if (!lower(item[field])) errors.push(`vocabulary[${index}] "${item.word}": ${field} is empty`);
      if (item.example && !lower(item.example).includes(lower(item.word).split(' ')[0].slice(0, 4)))
        warnings.push(`vocabulary[${index}] "${item.word}": the example does not seem to use the word`);
      if (/[^\x00-\x7F]/.test(item.example || '') && !/[’“”…–—é]/.test(item.example)) warnings.push(`vocabulary[${index}] "${item.word}": example has non-ASCII text`);
    });

    const blanks = countBlanks(lesson.fillIn?.passage);
    const answers = lesson.fillIn?.answers || [];
    if (blanks !== answers.length) errors.push(`fill-in has ${blanks} blanks but ${answers.length} answers`);
    if (blanks < 10) warnings.push(`fill-in has only ${blanks} blanks (aim for 10–12)`);
    answers.forEach((answer, index) => {
      if (!lower(answer)) errors.push(`fill-in answer ${index + 1} is empty`);
      else if (!relatedTo(answer, want)) warnings.push(`fill-in answer ${index + 1} "${answer}" is not one of the lesson words`);
    });
    const unused = want.filter((word) => !answers.some((answer) => relatedTo(answer, [word])));
    if (unused.length) warnings.push(`fill-in does not use: ${unused.join(', ')}`);
    if (words(lesson.fillIn?.passage) < 120) warnings.push(`fill-in passage is short (${words(lesson.fillIn?.passage)} words; aim for 130–200)`);

    try {
      const content = withIds(lessonContentSchema.parse(toContent(lesson)));
      for (const issue of publishIssues(content, new Map())) if (!mediaIssue(issue)) errors.push(`${issue.path}: ${issue.message}`);
      const test = lesson.test;
      if (!test.part1.photoHint) warnings.push('part1 has no photoHint for the person adding the photograph');
      if (test.part3.transcript.split('\n').length < 6) warnings.push('part3 conversation is short (aim for 6–10 lines)');
      if (!/^(Man|Woman):/m.test(test.part3.transcript)) warnings.push('part3 transcript should label speakers "Man:" and "Woman:"');
      if (words(test.part4.transcript) < 90) warnings.push(`part4 talk is short (${words(test.part4.transcript)} words; aim for 100–150)`);
      test.part5.forEach((item, index) => {
        if (!hasBlank(item.prompt)) errors.push(`part5 question ${index + 1} has no blank (_____ or ___)`);
      });
      if (words(test.part7.passage) < 110) warnings.push(`part7 passage is short (${words(test.part7.passage)} words; aim for 120–200)`);
      const testText = lower(JSON.stringify(test));
      const absent = want.filter((word) => !testText.includes(word.split(' ')[0].slice(0, Math.max(3, word.split(' ')[0].length - 2))));
      if (absent.length) warnings.push(`test does not use: ${absent.join(', ')}`);
    } catch (error) {
      errors.push(`shape: ${error.issues ? error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ') : error.message}`);
    }

    const label = `${String(entry.number).padStart(2, '0')} ${entry.title}`;
    if (errors.length) failed += 1;
    console.log(`${errors.length ? '✖' : '✔'} ${label}${entry.note ? ` (note: ${entry.note})` : ''}`);
    for (const line of errors) console.log(`    error: ${line}`);
    for (const line of warnings) console.log(`    warn:  ${line}`);
  }
}
console.log(`\n${checked} lesson${checked === 1 ? '' : 's'} checked, ${failed} with errors.`);
process.exit(failed ? 1 : 0);
