import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function keyOf(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('The encryption secret must be at least 32 characters');
  return createHash('sha256').update(secret).digest();
}

export function seal(plain, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyOf(secret), iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return { v: 1, iv: iv.toString('base64'), data: data.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

export function open(box, secret) {
  if (!box || box.v !== 1) throw new Error('Unknown sealed value');
  const decipher = createDecipheriv(ALGORITHM, keyOf(secret), Buffer.from(box.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(box.data, 'base64')), decipher.final()]).toString('utf8');
}
