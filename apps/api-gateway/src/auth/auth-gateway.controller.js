import { Body, Controller, Get, HttpException, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { AuthCookie } from '@appenglish/auth-contracts';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { callService, gatewayFailure } from '../grpc/grpc-call.js';

export { gatewayFailure };

export const AUTH_GRPC_CLIENT = 'AUTH_GRPC_CLIENT';

// Calls one AuthService RPC and returns { status, payload, setCookies }.
export function callAuth(auth, rpc, message = {}) {
  return callService(auth, rpc, message, 'Authentication');
}

// Reads the session cookies the auth RPCs take as tokens.
export function sessionTokens(request) {
  return cookies(request);
}

// JSON body values become proto strings; auth-service validates them.
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
      // A malformed cookie value is treated as absent.
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
    // Keys and empty values are relayed as sent; repeated keys keep the last value.
    const relayed = Object.fromEntries(new URLSearchParams(query));
    return this.forward('AdminListAccounts', { accessToken: cookies(request).accessToken, query: relayed }, response);
  }
  async adminGet(accountId, request, response) {
    return this.forward('AdminGetAccount', { accessToken: cookies(request).accessToken, accountId }, response);
  }
  async adminUpdate(accountId, body, request, response) {
    return this.forward(
      'AdminUpdateAccount',
      { accessToken: cookies(request).accessToken, accountId, ...fields(body, ['role', 'status']) },
      response,
    );
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
  [Post, 'refresh', 'refresh', [Req(), passthrough()]],
  [Post, 'logout', 'logout', [Req(), passthrough()]],
  [Get, 'me', 'me', [Req(), passthrough()]],
  [Get, 'admin/accounts', 'adminList', [Query(), Req(), passthrough()]],
  [Get, 'admin/accounts/:id', 'adminGet', [Param('id'), Req(), passthrough()]],
  [Patch, 'admin/accounts/:id', 'adminUpdate', [Param('id'), Body(), Req(), passthrough()]],
];
for (const [verb, path, method, params] of routes) {
  verb(path)(
    AuthGatewayController.prototype,
    method,
    Object.getOwnPropertyDescriptor(AuthGatewayController.prototype, method),
  );
  params.forEach((decorator, index) => decorator(AuthGatewayController.prototype, method, index));
}
