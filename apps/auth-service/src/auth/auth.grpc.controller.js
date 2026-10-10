import { Controller, HttpException, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AUTH_GRPC_SERVICE } from '@appenglish/auth-contracts/grpc';
import { AuthController } from './auth.controller.js';
import { HealthService } from '../health/health.service.js';
import { AUTH_DATA_SOURCE } from '../database/database.tokens.js';

// proto3 strings default to ''; optional fields and tokens treat that as absent.
function optional(value) {
  return value === '' ? undefined : value;
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
  adminUpdateAccount({ accessToken, accountId, role, status }) {
    return this.reply(() =>
      this.handlers.adminUpdate(
        accountId,
        withoutEmpty({ role, status }),
        optional(accessToken),
      ),
    );
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

  // Runs a handler and turns its envelope, HTTP-status error and cookies into
  // an AuthReply. Unexpected errors propagate as a gRPC error.
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
  'Ready',
]) {
  const method = rpc[0].toLowerCase() + rpc.slice(1);
  GrpcMethod(AUTH_GRPC_SERVICE, rpc)(
    AuthGrpcController.prototype,
    method,
    Object.getOwnPropertyDescriptor(AuthGrpcController.prototype, method),
  );
}
