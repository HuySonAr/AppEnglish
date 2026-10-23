import { JsonLogger } from '@appenglish/backend-common/observability';
import { WritingBroker } from './broker.js';
import { loadConfig } from './config.js';
import { GeminiClient } from './gemini.js';
import { startStatusServer } from './status-server.js';

const config = loadConfig();
const logger = new JsonLogger('writing-service');
const log = {
  log: (message) => logger.log(message, 'WritingService'),
  warn: (message) => logger.warn(message, 'WritingService'),
};

if (config.secret.length < 32) {
  log.warn('GEMINI_KEY_SECRET is missing or shorter than 32 characters; set it in .env');
  process.exit(1);
}

const broker = new WritingBroker(config, { gemini: new GeminiClient(config), logger: log });
broker.start();
startStatusServer(config.port)
  .then(() => log.log(`Status on http://127.0.0.1:${config.port}/metrics`))
  .catch((error) => log.warn(`Status server not started: ${error.message}`));

for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await broker.stop();
    process.exit(0);
  });
