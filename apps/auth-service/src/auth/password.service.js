import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const keyLength = 64;

export class PasswordService {
  hash(password) {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, keyLength);
    return `scrypt$${salt}$${derivedKey.toString('hex')}`;
  }

  verify(password, encodedHash) {
    const [algorithm, salt, storedKey] = encodedHash.split('$');
    if (algorithm !== 'scrypt' || !salt || !storedKey) return false;
    const derivedKey = scryptSync(password, salt, keyLength);
    const expectedKey = Buffer.from(storedKey, 'hex');
    return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey);
  }
}
