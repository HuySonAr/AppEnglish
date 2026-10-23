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
  adminAccountActionSchema,
  adminInviteSchema,
  acceptInviteSchema,
  updateProfileSchema,
  changePasswordSchema,
  verifyPasswordSchema,
  avatarUploadSchema,
  profileIdsSchema,
} from './auth.schemas.js';
import { RegisterAccountDto, LoginDto } from './auth.dto.js';
import { AuthError } from './auth.errors.js';

export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }
  async register(body) {
    try {
      return await this.authService.register(
        new RegisterAccountDto(registerSchema.parse(body)),
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async login(body, response) {
    try {
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
      if (this.isEnvelope(result)) return result;
      return this.withCookies(this.envelope(result), response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async resendVerification(body) {
    try {
      return await this.authService.resendVerification(
        resendVerificationSchema.parse(body).email,
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async forgotPassword(body) {
    try {
      return await this.authService.forgotPassword(
        forgotPasswordSchema.parse(body).email,
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async resetPassword(body) {
    try {
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
  async adminAction(accountId, body, accessToken) {
    try {
      return this.envelope(await this.authService.adminAction(
        accessToken,
        adminAccountIdSchema.parse(accountId),
        adminAccountActionSchema.parse(body),
      ));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async adminNotifications(accessToken) {
    try {
      return this.envelope(await this.authService.adminNotifications(accessToken));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async adminMarkNotificationsRead(ids, accessToken) {
    try {
      return this.envelope(await this.authService.adminMarkNotificationsRead(accessToken, (ids || []).filter((id) => typeof id === 'string' && id.length <= 160).slice(0, 100)));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async adminStats(accessToken) {
    try {
      return this.envelope(await this.authService.adminStats(accessToken));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async adminInvite(body, accessToken) {
    try {
      return this.envelope(await this.authService.adminInvite(accessToken, adminInviteSchema.parse(body)));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async acceptInvite(body, response) {
    try {
      const result = await this.authService.acceptInvite(acceptInviteSchema.parse(body));
      if (this.isEnvelope(result)) return result;
      return this.withCookies(this.envelope(result), response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async updateProfile(body, accessToken) {
    try {
      return this.envelope(await this.authService.updateProfile(
        accessToken,
        updateProfileSchema.parse(body),
      ));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async verifyPassword(body, accessToken) {
    try {
      return this.envelope(await this.authService.verifyPassword(
        accessToken,
        verifyPasswordSchema.parse(body),
      ));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async changePassword(body, accessToken, response) {
    try {
      return this.withCookies(
        this.envelope(await this.authService.changePassword(
          accessToken,
          changePasswordSchema.parse(body),
        )),
        response,
      );
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async uploadAvatar(file, accessToken) {
    try {
      return this.envelope(await this.authService.uploadAvatar(accessToken, {
        ...avatarUploadSchema.parse({ fileName: file?.fileName, mimeType: file?.mimeType }),
        data: file?.data,
      }));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async removeAvatar(accessToken) {
    try {
      return this.envelope(await this.authService.removeAvatar(accessToken));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }
  async getProfiles(accountIds) {
    try {
      return this.envelope(await this.authService.getProfiles(profileIdsSchema.parse(accountIds)));
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
          data: error.nextAction
            ? { nextAction: error.nextAction }
            : error.reason
              ? { reason: error.reason }
              : {},
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
