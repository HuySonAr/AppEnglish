// Syntax-checks every .js/.mjs file under the given directories with
// `node --check`. Usage: node scripts/check-syntax.mjs src test
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = process.argv
  .slice(2)
  .filter((directory) => existsSync(directory))
  .flatMap((directory) =>
    readdirSync(directory, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.m?js$/.test(entry.name))
      .map((entry) => join(entry.parentPath, entry.name)),
  );

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit',
  });
  if (result.status !== 0) failed++;
}
console.log(`syntax check: ${files.length - failed}/${files.length} files OK`);
process.exit(failed ? 1 : 0);
