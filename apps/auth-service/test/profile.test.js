import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AuthService } from '../src/auth/auth.service.js';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PasswordService } from '../src/auth/password.service.js';
import { TokenService } from '../src/auth/token.service.js';
import { LocalAvatarStorage, createAvatarStorage, validateAvatar } from '../src/profile/avatar-storage.js';
import { attachProfiles } from '../../api-gateway/src/auth/auth-gateway.controller.js';

process.env.AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET || 'test-secret-that-is-long-enough-for-hs256';

const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

function harness(accounts, avatarStorage) {
  const refreshTokens = [];
  const saved = [];
  const repo = {
    findAccountById: async (id) => accounts.find((account) => account.id === id) || null,
    findAccountsByIds: async (ids) => accounts.filter((account) => ids.includes(account.id)),
    saveAccount: async (account) => { saved.push({ ...account }); return account; },
    saveRefreshToken: async (token) => { refreshTokens.push({ ...token }); },
    revokeAccountSessions: async (accountId) => {
      refreshTokens.filter((token) => token.accountId === accountId && !token.revokedAt).forEach((token) => { token.revokedAt = new Date(); });
    },
  };
  const passwordService = new PasswordService();
  const service = new AuthService(repo, passwordService, new TokenService(), { sendOtp: async () => {} }, new AuthorizationService(), avatarStorage);
  return { service, passwordService, refreshTokens, saved, token: (account) => service.tokenService.createAccessToken(account) };
}
function student(overrides = {}) {
  return { id: crypto.randomUUID(), email: 'minh.anh@example.com', role: 'STUDENT', status: 'ACTIVE', createdAt: new Date(), sessionVersion: 0, passwordHash: new PasswordService().hash('correct horse battery staple'), ...overrides };
}

test('the display name is saved trimmed and an empty one clears it; me returns it', async () => {
  const account = student();
  const h = harness([account]);
  const updated = await h.service.updateProfile(h.token(account), { displayName: 'Minh Anh' });
  assert.equal(updated.account.displayName, 'Minh Anh');
  assert.equal(updated.account.avatarUrl, null);
  assert.equal((await h.service.me(h.token(account))).account.displayName, 'Minh Anh');
  const cleared = await h.service.updateProfile(h.token(account), { displayName: '' });
  assert.equal(cleared.account.displayName, null);
  const controller = new AuthController(h.service);
  const viaHandler = await controller.updateProfile({ displayName: '  Bình   Nguyễn ' }, h.token(account));
  assert.equal(viaHandler.data.account.displayName, 'Bình Nguyễn');
  await assert.rejects(() => controller.updateProfile({ displayName: 'x'.repeat(51) }, h.token(account)), (error) => error.getStatus() === 400);
  await assert.rejects(() => controller.updateProfile({ displayName: 'ok' }, undefined), (error) => error.getStatus() === 401);
});

test('changing the password needs the current one, signs other devices out and keeps this one', async () => {
  const account = student();
  const h = harness([account]);
  const oldToken = h.token(account);
  await h.service.saveSession(account, h.service.tokenService.createRefreshToken(account));
  await assert.rejects(() => h.service.verifyPassword(oldToken, { currentPassword: 'wrong' }), { code: 27 });
  assert.deepEqual(await h.service.verifyPassword(oldToken, { currentPassword: 'correct horse battery staple' }), { verified: true });
  assert.equal(account.sessionVersion, 0);
  await assert.rejects(() => h.service.changePassword(oldToken, { currentPassword: 'wrong', newPassword: 'another long password' }), { code: 27 });
  const result = await h.service.changePassword(oldToken, { currentPassword: 'correct horse battery staple', newPassword: 'another long password' });
  assert.equal(result.passwordChanged, true);
  assert.equal(result.setCookies.length, 2);
  assert.equal(account.sessionVersion, 1);
  assert.equal(h.passwordService.verify('another long password', account.passwordHash), true);
  await assert.rejects(() => h.service.me(oldToken), { code: 21 });
  assert.deepEqual(h.refreshTokens.map((token) => Boolean(token.revokedAt)), [true, false]);
  assert.equal((await h.service.me(h.token(account))).account.email, account.email);
});

test('avatars are validated, stored, replaced and removed', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'appenglish-avatars-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = new LocalAvatarStorage({ rootDirectory: root, publicBaseUrl: 'http://localhost:3001/avatars/', maxBytes: 1024 });
  const account = student();
  const h = harness([account], storage);
  const token = h.token(account);

  assert.throws(() => validateAvatar({ fileName: 'a.gif', mimeType: 'image/gif', data: png }), { code: 28, reason: 'AVATAR_MIME_TYPE_NOT_ALLOWED' });
  assert.throws(() => validateAvatar({ fileName: 'a.txt', mimeType: 'image/png', data: png }), { code: 28, reason: 'AVATAR_EXTENSION_NOT_ALLOWED' });
  assert.throws(() => validateAvatar({ fileName: 'a.png', mimeType: 'image/png', data: Buffer.alloc(0) }), { code: 28, reason: 'AVATAR_EMPTY' });
  assert.throws(() => validateAvatar({ fileName: 'a.png', mimeType: 'image/png', data: Buffer.alloc(2000) }, 1024), { code: 28, reason: 'AVATAR_FILE_TOO_LARGE' });

  const first = await h.service.uploadAvatar(token, { fileName: 'me.png', mimeType: 'image/png', data: png });
  assert.match(first.account.avatarUrl, /^http:\/\/localhost:3001\/avatars\/[0-9a-f-]{36}\.png$/);
  assert.equal(account.avatarStorage, 'local');
  assert.equal((await readdir(root)).length, 1);

  const second = await h.service.uploadAvatar(token, { fileName: 'me.webp', mimeType: 'image/webp', data: png });
  assert.notEqual(second.account.avatarUrl, first.account.avatarUrl);
  assert.deepEqual(await readdir(root), [path.basename(new URL(second.account.avatarUrl).pathname)]);

  const removed = await h.service.removeAvatar(token);
  assert.equal(removed.account.avatarUrl, null);
  assert.equal(account.avatarStorageId, null);
  assert.deepEqual(await readdir(root), []);

  const controller = new AuthController(h.service);
  await assert.rejects(
    () => controller.uploadAvatar({ fileName: 'a.gif', mimeType: 'image/gif', data: png }, token),
    (error) => error.getStatus() === 400 && error.getResponse().code === 28 && error.getResponse().data.reason === 'AVATAR_MIME_TYPE_NOT_ALLOWED',
  );
});

test('public profiles carry the name or the email local part, never the email', async () => {
  const named = student({ displayName: 'Minh Anh', avatarUrl: 'https://ik.test/a.webp' });
  const unnamed = student({ email: 'binh.nguyen@example.com' });
  const h = harness([named, unnamed]);
  const { profiles } = await h.service.getProfiles([named.id, unnamed.id, unnamed.id, crypto.randomUUID()]);
  assert.deepEqual(profiles.map((profile) => [profile.displayName, profile.avatarUrl, profile.email]), [
    ['Minh Anh', 'https://ik.test/a.webp', undefined],
    ['binh.nguyen', null, undefined],
  ]);
  assert.deepEqual(await h.service.getProfiles([]), { profiles: [] });
});

test('the gateway attaches profiles to ranking rows and falls back to the email local part', async () => {
  const known = crypto.randomUUID();
  const unknown = crypto.randomUUID();
  const reply = (data) => ({ subscribe: ({ next }) => next({ httpStatus: 200, code: 0, msg: 'success', dataJson: JSON.stringify(data), setCookies: [] }) });
  let asked;
  const auth = {
    GetProfiles(message) {
      asked = message.accountIds;
      return reply({ profiles: [{ id: known, displayName: 'Minh Anh', avatarUrl: 'https://ik.test/a.webp' }] });
    },
  };
  const rows = [
    { rank: 1, accountId: known, email: 'minh.anh@example.com' },
    { rank: 2, accountId: unknown, email: 'binh.nguyen@example.com' },
  ];
  await attachProfiles(auth, [...rows, rows[0], null]);
  assert.deepEqual(asked, [known, unknown]);
  assert.deepEqual(rows, [
    { rank: 1, accountId: known, displayName: 'Minh Anh', avatarUrl: 'https://ik.test/a.webp' },
    { rank: 2, accountId: unknown, displayName: 'binh.nguyen', avatarUrl: null },
  ]);
  const down = { GetProfiles: () => ({ subscribe: ({ error }) => error(Object.assign(new Error('down'), { code: 14 })) }) };
  const row = { rank: 1, accountId: known, email: 'minh.anh@example.com' };
  await attachProfiles(down, [row]);
  assert.deepEqual(row, { rank: 1, accountId: known, displayName: 'minh.anh', avatarUrl: null });
});

test('the avatar storage factory follows the environment', () => {
  assert.ok(createAvatarStorage({}) instanceof LocalAvatarStorage);
  assert.equal(createAvatarStorage({ AVATAR_LOCAL_PUBLIC_URL: 'http://x/avatars/' }).publicBaseUrl, 'http://x/avatars');
  assert.throws(() => createAvatarStorage({ AVATAR_STORAGE_ADAPTER: 'imagekit' }), /ImageKit credentials/);
  assert.throws(() => createAvatarStorage({ AVATAR_STORAGE_ADAPTER: 's3' }), /Unsupported/);
  assert.throws(() => createAvatarStorage({ AVATAR_MAX_FILE_SIZE_BYTES: '-1' }), /positive integer/);
});
