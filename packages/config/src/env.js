import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info')
});

export function readRuntimeEnv(source = process.env) {
  return envSchema.parse(source);
}
