import { HttpException } from '@nestjs/common';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  adminAccountQuerySchema,
  adminAccountIdSchema,
  adminAccountUpdateSchema,
} from './auth.schemas.js';
import { RegisterAccountDto, LoginDto } from './auth.dto.js';
import { AuthError } from './auth.errors.js';

// Transport-agnostic auth request handlers: validate the payload, call the
// service and shape the { code, msg, data } envelope. AuthGrpcController exposes
// them over gRPC; HttpException only carries the HTTP status the gateway answers
// with.
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
      return await this.authService.resendVerification(
        resendVerificationSchema.parse(body).email,
      );
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
  async me(accessToken) {
    try {
      return this.envelope(await this.authService.me(accessToken));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async refresh(refreshToken, response) {
    try {
      return this.withCookies(
        this.envelope(await this.authService.refresh(refreshToken)),
        response,
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async logout(refreshToken, response) {
    try {
      return this.withCookies(
        this.envelope(await this.authService.logout(refreshToken)),
        response,
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
    async adminList(query, accessToken) {
      try {
        const parsedQuery = adminAccountQuerySchema.parse(query);
        return this.envelope(await this.authService.adminList(
          accessToken,
          parsedQuery,
        ));
      } catch (error) {
        throw this.normalizeError(error);
      }
    }
    async adminGet(accountId, accessToken) {
      try {
        return this.envelope(await this.authService.adminGet(
          accessToken,
          adminAccountIdSchema.parse(accountId),
        ));
      } catch (error) {
        throw this.normalizeError(error);
      }
    }
    async adminUpdate(accountId, body, accessToken) {
      try {
        return this.envelope(await this.authService.adminUpdate(
          accessToken,
          adminAccountIdSchema.parse(accountId),
          adminAccountUpdateSchema.parse(body),
        ));
      } catch (error) {
        throw this.normalizeError(error);
      }
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
