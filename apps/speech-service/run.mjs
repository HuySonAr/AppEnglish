// Runs Python for speech-service: the service's own .venv when it exists,
// else the python on the PATH, with the repository's .env loaded.
// Starting the worker (pnpm dev) without the .venv only prints how to set it
// up and leaves quietly, so the other services of `pnpm dev` keep running.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(here, '..', '..', '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const venv = path.join(here, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const args = process.argv.slice(2);
const worker = args.join(' ') === '-m speech_service';
if (worker && !existsSync(venv)) {
  console.warn(
    '[speech-service] Not started: its Python environment is missing. Auto-time needs it;\n' +
      '[speech-service] run once: pnpm --filter @appenglish/speech-service python:setup',
  );
  process.exit(0);
}
const python = existsSync(venv) ? venv : process.platform === 'win32' ? 'python' : 'python3';
const result = spawnSync(python, args, { cwd: here, stdio: 'inherit', env: process.env });
if (result.error) {
  console.warn(`[speech-service] Python could not be started (${result.error.message}). Install Python 3.12 and run python:setup.`);
  process.exit(worker ? 0 : 1);
}
process.exit(result.status ?? 1);
