import { Controller, HttpException, Inject } from '@nestjs/common';
import { withGrpcContext } from '@appenglish/backend-common/grpc-context';
import { GrpcMethod } from '@nestjs/microservices';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { AuthController } from './auth.controller.js';
import { HealthService } from '../health/health.service.js';
import { AUTH_DATA_SOURCE } from '../database/database.tokens.js';

function optional(value) {
  return value === '' ? undefined : value;
}

function parseJson(text) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function withoutEmpty(fields) {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== ''),
  );
}

export class AuthGrpcController {
  constructor(handlers, dataSource) {
    this.handlers = handlers;
    this.healthService = new HealthService(dataSource);
  }

  register({ email, password, role }) {
    return this.reply(() =>
      this.handlers.register({ email, password, ...withoutEmpty({ role }) }),
    );
  }
  login({ email, password }) {
    return this.reply((response) =>
      this.handlers.login({ email, password }, response),
    );
  }
  verifyEmail({ email, otp }) {
    return this.reply((response) =>
      this.handlers.verifyEmail({ email, otp }, response),
    );
  }
  resendVerification({ email }) {
    return this.reply(() => this.handlers.resendVerification({ email }));
  }
  forgotPassword({ email }) {
    return this.reply(() => this.handlers.forgotPassword({ email }));
  }
  resetPassword({ email, otp, password }) {
    return this.reply(() =>
      this.handlers.resetPassword({ email, otp, password }),
    );
  }
  me({ accessToken }) {
    return this.reply(() => this.handlers.me(optional(accessToken)));
  }
  refresh({ refreshToken }) {
    return this.reply((response) =>
      this.handlers.refresh(optional(refreshToken), response),
    );
  }
  logout({ refreshToken }) {
    return this.reply((response) =>
      this.handlers.logout(optional(refreshToken), response),
    );
  }
  adminListAccounts({ accessToken, query }) {
    return this.reply(() =>
      this.handlers.adminList(query || {}, optional(accessToken)),
    );
  }
  adminGetAccount({ accessToken, accountId }) {
    return this.reply(() =>
      this.handlers.adminGet(accountId, optional(accessToken)),
    );
  }
  adminUpdateAccount({ accessToken, accountId, role, status, reason }) {
    return this.reply(() =>
      this.handlers.adminUpdate(
        accountId,
        withoutEmpty({ role, status, reason }),
        optional(accessToken),
      ),
    );
  }
  adminAccountAction({ accessToken, accountId, action, reason }) {
    return this.reply(() =>
      this.handlers.adminAction(accountId, withoutEmpty({ action, reason }), optional(accessToken)),
    );
  }
  adminListNotifications({ accessToken }) {
    return this.reply(() => this.handlers.adminNotifications(optional(accessToken)));
  }
  adminMarkNotificationsRead({ accessToken, ids }) {
    return this.reply(() => this.handlers.adminMarkNotificationsRead(ids || [], optional(accessToken)));
  }
  adminAccountStats({ accessToken }) {
    return this.reply(() => this.handlers.adminStats(optional(accessToken)));
  }
  adminInviteAccount({ accessToken, email, displayName, role }) {
    return this.reply(() =>
      this.handlers.adminInvite({ email, ...withoutEmpty({ displayName, role }) }, optional(accessToken)),
    );
  }
  acceptInvite({ email, otp, password }) {
    return this.reply((response) =>
      this.handlers.acceptInvite({ email, otp, password }, response),
    );
  }
  updateProfile({ accessToken, payloadJson }) {
    return this.reply(() =>
      this.handlers.updateProfile(parseJson(payloadJson), optional(accessToken)),
    );
  }
  verifyPassword({ accessToken, currentPassword }) {
    return this.reply(() =>
      this.handlers.verifyPassword({ currentPassword }, optional(accessToken)),
    );
  }
  changePassword({ accessToken, currentPassword, newPassword }) {
    return this.reply((response) =>
      this.handlers.changePassword(
        { currentPassword, newPassword },
        optional(accessToken),
        response,
      ),
    );
  }
  uploadAvatar({ accessToken, fileName, mimeType, data }) {
    return this.reply(() =>
      this.handlers.uploadAvatar({ fileName, mimeType, data }, optional(accessToken)),
    );
  }
  removeAvatar({ accessToken }) {
    return this.reply(() => this.handlers.removeAvatar(optional(accessToken)));
  }
  getProfiles({ accountIds }) {
    return this.reply(() => this.handlers.getProfiles(accountIds || []));
  }
  async ready() {
    try {
      return this.toReply(200, {
        code: 0,
        msg: 'success',
        data: await this.healthService.ready(),
      });
    } catch {
      return this.toReply(503, {
        code: 32,
        msg: 'fail',
        data: { message: 'Authentication database is unavailable' },
      });
    }
  }

  async reply(handler) {
    let setCookies = [];
    const response = {
      setHeader(_name, value) {
        setCookies = value;
      },
    };
    try {
      return this.toReply(200, await handler(response), setCookies);
    } catch (error) {
      if (error instanceof HttpException)
        return this.toReply(error.getStatus(), error.getResponse(), setCookies);
      throw error;
    }
  }

  toReply(httpStatus, envelope, setCookies = []) {
    return {
      httpStatus,
      code: envelope.code,
      msg: envelope.msg,
      dataJson: JSON.stringify(envelope.data ?? {}),
      setCookies,
    };
  }
}

Controller()(AuthGrpcController);
Inject(AuthController)(AuthGrpcController, undefined, 0);
Inject(AUTH_DATA_SOURCE)(AuthGrpcController, undefined, 1);
for (const rpc of [
  'Register',
  'Login',
  'VerifyEmail',
  'ResendVerification',
  'ForgotPassword',
  'ResetPassword',
  'Me',
  'Refresh',
  'Logout',
  'AdminListAccounts',
  'AdminGetAccount',
  'AdminUpdateAccount',
  'AdminAccountAction',
  'AdminAccountStats',
  'AdminListNotifications',
  'AdminMarkNotificationsRead',
  'AdminInviteAccount',
  'AcceptInvite',
  'UpdateProfile',
  'VerifyPassword',
  'ChangePassword',
  'UploadAvatar',
  'RemoveAvatar',
  'GetProfiles',
  'Ready',
]) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  withGrpcContext(AuthGrpcController.prototype, method, rpc);
  GrpcMethod(AUTH_GRPC_SERVICE, rpc)(
    AuthGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(AuthGrpcController.prototype, method),
  );
}
