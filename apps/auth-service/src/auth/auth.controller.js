import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Post,
  Patch,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  adminAccountQuerySchema,
  adminAccountIdSchema,
  adminAccountUpdateSchema,
} from './auth.schemas.js';
import { RegisterAccountDto, LoginDto } from './auth.dto.js';
import { AuthError } from './auth.errors.js';
import { AuthService } from './auth.service.js';

export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }
  async register(body) {
    try {
      // register already returns the shared { code, msg, data } envelope
      // (SUCCESS or ADDITIONAL); wrapping it again would nest data.data and
      // hide the additional code from clients.
      return await this.authService.register(
        new RegisterAccountDto(registerSchema.parse(body)),
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async login(body, response) {
    try {
      // The service already validates with authResponseSchema; parsing again
      // here would strip the setCookies array and login would never emit
      // session cookies.
      return this.withCookies(
        this.envelope(
          await this.authService.login(new LoginDto(loginSchema.parse(body))),
        ),
        response,
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async verifyEmail(body, response) {
    try {
      const result = await this.authService.verifyEmail(
        verifyEmailSchema.parse(body),
      );
      // The service returns a full envelope for an already verified account
      // (LOGIN guidance, no session) and bare session data + setCookies after a
      // successful verification; only the latter needs wrapping.
      if (this.isEnvelope(result)) return result;
      return this.withCookies(this.envelope(result), response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async resendVerification(body) {
    try {
      // Already an ADDITIONAL envelope from the service; no re-wrap.
      return await this.authService.resendVerification(body.email);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async forgotPassword(body) {
    try {
      // Already an ADDITIONAL envelope from the service; no re-wrap.
      return await this.authService.forgotPassword(
        forgotPasswordSchema.parse(body).email,
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async resetPassword(body) {
    try {
      // Already a { code, msg, data } envelope from the service; no re-wrap.
      return await this.authService.resetPassword(resetPasswordSchema.parse(body));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async me(request) {
    try {
      return this.envelope(
        await this.authService.me(
          parseCookies(request.headers.cookie).appenglish_access,
        ),
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async refresh(request, response) {
    try {
      return this.withCookies(
        this.envelope(
          await this.authService.refresh(
            parseCookies(request.headers.cookie).appenglish_refresh,
          ),
        ),
        response,
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async logout(request, response) {
    try {
      return this.withCookies(
        this.envelope(
          await this.authService.logout(
            parseCookies(request.headers.cookie).appenglish_refresh,
          ),
        ),
        response,
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
    async adminList(query, request) {
      try {
        const parsedQuery = adminAccountQuerySchema.parse(query);
        return this.envelope(await this.authService.adminList(
          parseCookies(request.headers.cookie).appenglish_access,
          parsedQuery,
        ));
      } catch (error) {
        throw this.normalizeError(error);
      }
    }
    async adminGet(accountId, request) {
      return this.envelope(await this.authService.adminGet(
        parseCookies(request.headers.cookie).appenglish_access,
        adminAccountIdSchema.parse(accountId),
      ));
    }
    async adminUpdate(accountId, body, request) {
      return this.envelope(await this.authService.adminUpdate(
        parseCookies(request.headers.cookie).appenglish_access,
        adminAccountIdSchema.parse(accountId),
        adminAccountUpdateSchema.parse(body),
      ));
    }
  envelope(data) {
    return { code: 0, msg: 'success', data: data || {} };
  }
  isEnvelope(result) {
    return Boolean(result) && typeof result === 'object' && typeof result.code === 'number' && typeof result.msg === 'string';
  }
  withCookies(result, response) {
    if (!result?.data?.setCookies) return result;
    response.setHeader('Set-Cookie', result.data.setCookies);
    const data = { ...result.data };
    delete data.setCookies;
    return { ...result, data };
  }
  normalizeError(error) {
    if (error instanceof AuthError)
      return new HttpException(
        {
          code: error.code,
          msg: 'fail',
          data: error.nextAction ? { nextAction: error.nextAction } : {},
        },
        error.status,
      );
    if (error?.name === 'ZodError')
      return new HttpException(
        { code: 30, msg: 'fail', data: { issues: error.issues } },
        400,
      );
    return error;
  }
}
Controller('auth')(AuthController);
Inject(AuthService)(AuthController, undefined, 0);
const routes = [
  ['register', 'register', [Body()]],
  ['login', 'login', [Body(), Res({ passthrough: true })]],
  ['verify-email', 'verifyEmail', [Body(), Res({ passthrough: true })]],
  ['resend-verification', 'resendVerification', [Body()]],
  ['forgot-password', 'forgotPassword', [Body()]],
  ['reset-password', 'resetPassword', [Body()]],
  ['me', 'me', [Req()]],
  ['refresh', 'refresh', [Req(), Res({ passthrough: true })]],
  ['logout', 'logout', [Req(), Res({ passthrough: true })]],
  ['admin/accounts', 'adminList', [Query(), Req()]],
  ['admin/accounts/:id', 'adminGet', [Param('id'), Req()]],
  ['admin/accounts/:id', 'adminUpdate', [Param('id'), Body(), Req()]],
];
for (const [path, method, params] of routes) {
  (method === 'adminList' ? Get(path) : method === 'adminGet' ? Get(path) : method === 'adminUpdate' ? Patch(path) : path === 'me' ? Get(path) : Post(path))(
    AuthController.prototype,
    method,
    Object.getOwnPropertyDescriptor(AuthController.prototype, method),
  );
  params.forEach((decorator, index) =>
    decorator(AuthController.prototype, method, index),
  );
}
function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return [
          part.slice(0, index).trim(),
          decodeURIComponent(part.slice(index + 1).trim()),
        ];
      }),
  );
}
