import { Body, Controller, Get, HttpException, Inject, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { AuthCookie } from '@appenglish/auth-contracts';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';

export const AUTH_GRPC_CLIENT = 'AUTH_GRPC_CLIENT';

// Gateway-originated failures use the shared { code, msg, data } envelope with
// SYSTEM_ERROR (32) from @appenglish/auth-contracts.
export function gatewayFailure(message) {
  return { code: 32, msg: 'fail', data: { message } };
}

// gRPC status codes that mean auth-service could not be reached in time.
const UNAVAILABLE_GRPC_CODES = [4, 14];

// Calls one AuthService RPC and returns { status, payload, setCookies }.
// Transport failures become a gateway envelope with 503/500.
export async function callAuth(auth, rpc, message = {}) {
  let reply;
  try {
    reply = await new Promise((resolve, reject) => {
      auth[rpc](message).subscribe({ next: resolve, error: reject });
    });
  } catch (error) {
    if (UNAVAILABLE_GRPC_CODES.includes(error?.code))
      throw new HttpException(gatewayFailure('Authentication service is unavailable'), 503);
    throw new HttpException(gatewayFailure('Authentication service failed'), 500);
  }
  let data;
  try {
    data = JSON.parse(reply.dataJson || '{}');
  } catch {
    throw new HttpException(gatewayFailure('Authentication service returned an invalid response'), 500);
  }
  return {
    status: reply.httpStatus,
    payload: { code: reply.code, msg: reply.msg, data },
    setCookies: reply.setCookies || [],
  };
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
