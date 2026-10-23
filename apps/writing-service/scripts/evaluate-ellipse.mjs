import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { countWords } from '@appenglish/learning-contracts';
import { loadConfig } from '../src/config.js';
import { ELLIPSE_FIELDS, evaluationJob, readEllipse, sampleItems, systemScores } from '../src/ellipse.js';
import { GeminiClient, GeminiError } from '../src/gemini.js';
import { compareScores } from '../src/metrics.js';
import { SCHEMA, SYSTEM, buildWritingPrompt, parseWritingResult } from '../src/rubric.js';

const { values } = parseArgs({
  options: {
    csv: { type: 'string' },
    limit: { type: 'string', default: '150' },
    seed: { type: 'string', default: '2024' },
    delay: { type: 'string', default: '7000' },
    out: { type: 'string', default: 'ellipse-report' },
  },
});
const apiKey = process.env.GEMINI_EVAL_KEY;
if (!values.csv || !apiKey) {
  console.error('Usage: GEMINI_EVAL_KEY=<developer key> node scripts/evaluate-ellipse.mjs --csv ELLIPSE_Final_github.csv [--limit 150] [--seed 2024] [--delay 7000] [--out ellipse-report]');
  process.exit(1);
}

const config = loadConfig();
const gemini = new GeminiClient(config);
const items = sampleItems(readEllipse(await readFile(values.csv, 'utf8')), Number(values.limit), Number(values.seed));
const rows = [];
const failures = [];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (const [index, item] of items.entries()) {
  const job = evaluationJob(item, countWords);
  let result = null;
  for (let attempt = 1; attempt <= 4 && !result; attempt++) {
    try {
      const raw = await gemini.generateJson(apiKey, { system: SYSTEM, prompt: buildWritingPrompt(job), schema: SCHEMA });
      result = parseWritingResult(raw, item.text);
    } catch (error) {
      if (!(error instanceof GeminiError) || !error.retryable || attempt === 4) {
        failures.push({ id: item.id, error: error.message });
        break;
      }
      await wait(30_000 * attempt);
    }
  }
  if (result) rows.push({ id: item.id, expert: item.expert, system: systemScores(result) });
  console.error(`${index + 1}/${items.length} ${item.id}: ${result ? `overall ${rows.at(-1).system.overall} vs ${item.expert.overall}` : 'failed'}`);
  await wait(Number(values.delay));
}

const report = { dataset: 'ELLIPSE', model: config.model, seed: Number(values.seed), samples: items.length, scored: rows.length, failures, metrics: compareScores(rows, ELLIPSE_FIELDS) };
await writeFile(`${values.out}.json`, JSON.stringify(report, null, 2));
await writeFile(
  `${values.out}.csv`,
  ['id,' + ELLIPSE_FIELDS.map((field) => `system_${field},expert_${field}`).join(','), ...rows.map((row) => [row.id, ...ELLIPSE_FIELDS.flatMap((field) => [row.system[field], row.expert[field]])].join(','))].join('\n'),
);
console.log(JSON.stringify(report.metrics, null, 2));
