import { Body, Controller, Delete, Get, HttpException, Inject, Param, Patch, Post, Query, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PROFILE_LIMITS, displayNameOf } from '@appenglish/auth-contracts';
import { AuthCookie } from '@appenglish/auth-contracts';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { callService, gatewayFailure } from '../grpc/grpc-call.js';

export { gatewayFailure };

export const AUTH_GRPC_CLIENT = 'AUTH_GRPC_CLIENT';

export function callAuth(auth, rpc, message = {}) {
  return callService(auth, rpc, message, 'Authentication');
}

export function sessionTokens(request) {
  return cookies(request);
}

export async function attachProfiles(auth, rows) {
  const list = rows.filter(Boolean);
  const ids = [...new Set(list.map((row) => row.accountId).filter(Boolean))];
  let byId = new Map();
  if (ids.length) {
    try {
      const { status, payload } = await callAuth(auth, 'GetProfiles', { accountIds: ids });
      if (status < 400) byId = new Map(payload.data.profiles.map((profile) => [profile.id, profile]));
    } catch {
    }
  }
  for (const row of list) {
    const profile = byId.get(row.accountId);
    row.displayName = profile?.displayName ?? displayNameOf({ email: row.email });
    row.avatarUrl = profile?.avatarUrl ?? null;
    delete row.email;
  }
}

const MAX_AVATAR_UPLOAD_BYTES = PROFILE_LIMITS.avatarMaxBytes + 64 * 1024;

function text(value) {
  return value === undefined || value === null ? '' : String(value);
}

function fields(body, names) {
  const source = body && typeof body === 'object' ? body : {};
  return Object.fromEntries(names.map((name) => [name, text(source[name])]));
}

function cookies(request) {
  const header = request.headers.cookie || '';
  const parsed = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    try {
      parsed[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
    }
  }
  return {
    accessToken: parsed[AuthCookie.ACCESS] || '',
    refreshToken: parsed[AuthCookie.REFRESH] || '',
  };
}

export class AuthGatewayController {
  constructor(client) {
    this.client = client;
  }

  onModuleInit() {
    this.auth = this.client.getService(AUTH_GRPC_SERVICE);
  }

  async register(body, response) {
    return this.forward('Register', fields(body, ['email', 'password', 'role']), response);
  }
  async login(body, response) {
    return this.forward('Login', fields(body, ['email', 'password']), response);
  }
  async verifyEmail(body, response) {
    return this.forward('VerifyEmail', fields(body, ['email', 'otp']), response);
  }
  async resendVerification(body, response) {
    return this.forward('ResendVerification', fields(body, ['email']), response);
  }
  async forgotPassword(body, response) {
    return this.forward('ForgotPassword', fields(body, ['email']), response);
  }
  async resetPassword(body, response) {
    return this.forward('ResetPassword', fields(body, ['email', 'otp', 'password']), response);
  }
  async refresh(request, response) {
    return this.forward('Refresh', { refreshToken: cookies(request).refreshToken }, response);
  }
  async logout(request, response) {
    return this.forward('Logout', { refreshToken: cookies(request).refreshToken }, response);
  }
  async me(request, response) {
    return this.forward('Me', { accessToken: cookies(request).accessToken }, response);
  }
  async adminList(query, request, response) {
    const relayed = Object.fromEntries(new URLSearchParams(query));
    return this.forward('AdminListAccounts', { accessToken: cookies(request).accessToken, query: relayed }, response);
  }
  async adminNotifications(request, response) {
    return this.forward('AdminListNotifications', { accessToken: cookies(request).accessToken }, response);
  }
  async adminMarkNotificationsRead(body, request, response) {
    const ids = Array.isArray(body?.ids) ? body.ids.map(String) : [];
    return this.forward('AdminMarkNotificationsRead', { accessToken: cookies(request).accessToken, ids }, response);
  }
  async adminStats(request, response) {
    return this.forward('AdminAccountStats', { accessToken: cookies(request).accessToken }, response);
  }
  async adminGet(accountId, request, response) {
    return this.forward('AdminGetAccount', { accessToken: cookies(request).accessToken, accountId }, response);
  }
  async adminUpdate(accountId, body, request, response) {
    return this.forward(
      'AdminUpdateAccount',
      { accessToken: cookies(request).accessToken, accountId, ...fields(body, ['role', 'status', 'reason']) },
      response,
    );
  }
  async adminInvite(body, request, response) {
    return this.forward(
      'AdminInviteAccount',
      { accessToken: cookies(request).accessToken, ...fields(body, ['email', 'displayName', 'role']) },
      response,
    );
  }
  async acceptInvite(body, response) {
    return this.forward('AcceptInvite', fields(body, ['email', 'otp', 'password']), response);
  }
  async adminAction(accountId, body, request, response) {
    return this.forward(
      'AdminAccountAction',
      { accessToken: cookies(request).accessToken, accountId, ...fields(body, ['action', 'reason']) },
      response,
    );
  }

  async updateProfile(body, request, response) {
    return this.forward(
      'UpdateProfile',
      { accessToken: cookies(request).accessToken, payloadJson: JSON.stringify(body && typeof body === 'object' ? body : {}) },
      response,
    );
  }
  async verifyPassword(body, request, response) {
    return this.forward(
      'VerifyPassword',
      { accessToken: cookies(request).accessToken, ...fields(body, ['currentPassword']) },
      response,
    );
  }
  async changePassword(body, request, response) {
    return this.forward(
      'ChangePassword',
      { accessToken: cookies(request).accessToken, ...fields(body, ['currentPassword', 'newPassword']) },
      response,
    );
  }
  async uploadAvatar(file, request, response) {
    return this.forward(
      'UploadAvatar',
      {
        accessToken: cookies(request).accessToken,
        fileName: file?.originalname || '',
        mimeType: file?.mimetype || '',
        data: file?.buffer || Buffer.alloc(0),
      },
      response,
    );
  }
  async removeAvatar(request, response) {
    return this.forward('RemoveAvatar', { accessToken: cookies(request).accessToken }, response);
  }

  async forward(rpc, message, response) {
    const { status, payload, setCookies } = await callAuth(this.auth, rpc, message);
    if (setCookies.length) response.setHeader('Set-Cookie', setCookies);
    if (status >= 400) throw new HttpException(payload, status);
    return payload;
  }
}

Controller('auth')(AuthGatewayController);
Inject(AUTH_GRPC_CLIENT)(AuthGatewayController, undefined, 0);
const passthrough = () => Res({ passthrough: true });
const routes = [
  [Post, 'register', 'register', [Body(), passthrough()]],
  [Post, 'login', 'login', [Body(), passthrough()]],
  [Post, 'verify-email', 'verifyEmail', [Body(), passthrough()]],
  [Post, 'resend-verification', 'resendVerification', [Body(), passthrough()]],
  [Post, 'forgot-password', 'forgotPassword', [Body(), passthrough()]],
  [Post, 'reset-password', 'resetPassword', [Body(), passthrough()]],
  [Post, 'accept-invite', 'acceptInvite', [Body(), passthrough()]],
  [Post, 'refresh', 'refresh', [Req(), passthrough()]],
  [Post, 'logout', 'logout', [Req(), passthrough()]],
  [Get, 'me', 'me', [Req(), passthrough()]],
  [Get, 'admin/accounts', 'adminList', [Query(), Req(), passthrough()]],
  [Post, 'admin/accounts', 'adminInvite', [Body(), Req(), passthrough()]],
  [Get, 'admin/accounts/stats', 'adminStats', [Req(), passthrough()]],
  [Get, 'admin/notifications', 'adminNotifications', [Req(), passthrough()]],
  [Post, 'admin/notifications/read', 'adminMarkNotificationsRead', [Body(), Req(), passthrough()]],
  [Get, 'admin/accounts/:id', 'adminGet', [Param('id'), Req(), passthrough()]],
  [Patch, 'admin/accounts/:id', 'adminUpdate', [Param('id'), Body(), Req(), passthrough()]],
  [Post, 'admin/accounts/:id/actions', 'adminAction', [Param('id'), Body(), Req(), passthrough()]],
  [Patch, 'profile', 'updateProfile', [Body(), Req(), passthrough()]],
  [Post, 'profile/password/verify', 'verifyPassword', [Body(), Req(), passthrough()]],
  [Post, 'profile/password', 'changePassword', [Body(), Req(), passthrough()]],
  [Post, 'profile/avatar', 'uploadAvatar', [UploadedFile(), Req(), passthrough()]],
  [Delete, 'profile/avatar', 'removeAvatar', [Req(), passthrough()]],
];
for (const [verb, path, method, params] of routes) {
  verb(path)(
    AuthGatewayController.prototype,
    method,
    Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, method),
  );
  params.forEach((decorator, index) => decorator(AuthGatewayController.prototype, method, index));
}
UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_AVATAR_UPLOAD_BYTES } }))(
  AuthGatewayController.prototype,
  'uploadAvatar',
  Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, 'uploadAvatar'),
);
