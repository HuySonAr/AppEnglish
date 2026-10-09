import { Body, Controller, Get, HttpException, Inject, Post, Req, Res } from '@nestjs/common';
import { registerSchema, loginSchema, authResponseSchema } from './auth.schemas.js';
import { RegisterAccountDto, LoginDto } from './auth.dto.js';
import { AuthError } from './auth.errors.js';
import { AuthService } from './auth.service.js';

export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  async register(body, response) {
    try {
      return this.withCookies(await this.authService.register(new RegisterAccountDto(registerSchema.parse(body))), response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async login(body, response) {
    try {
      return this.withCookies(authResponseSchema.parse(await this.authService.login(new LoginDto(loginSchema.parse(body)))), response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async me(request) {
    try {
      return await this.authService.me(parseCookies(request.headers.cookie).appenglish_access);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async refresh(request, response) {
    try {
      return this.withCookies(await this.authService.refresh(parseCookies(request.headers.cookie).appenglish_refresh), response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async logout(request, response) {
    try {
      return this.withCookies(await this.authService.logout(parseCookies(request.headers.cookie).appenglish_refresh), response);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  withCookies(result, response) {
    if (!result.setCookies) return result;
    response.setHeader('Set-Cookie', result.setCookies);
    const { setCookies, ...body } = result;
    return body;
  }

  normalizeError(error) {
    if (error instanceof AuthError) {
      return new HttpException({ code: error.code, message: error.message }, error.status);
    }
    if (error?.name === 'ZodError') {
      return new HttpException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        issues: error.issues
      }, 400);
    }
    return error;
  }
}

Controller('auth')(AuthController);
Inject(AuthService)(AuthController, undefined, 0);
Post('register')(AuthController.prototype, 'register', Object.getOwnPropertyDescriptor(AuthController.prototype, 'register'));
Body()(AuthController.prototype, 'register', 0);
Res({ passthrough: true })(AuthController.prototype, 'register', 1);
Post('login')(AuthController.prototype, 'login', Object.getOwnPropertyDescriptor(AuthController.prototype, 'login'));
Body()(AuthController.prototype, 'login', 0);
Res({ passthrough: true })(AuthController.prototype, 'login', 1);
Get('me')(AuthController.prototype, 'me', Object.getOwnPropertyDescriptor(AuthController.prototype, 'me'));
Req()(AuthController.prototype, 'me', 0);
Post('refresh')(AuthController.prototype, 'refresh', Object.getOwnPropertyDescriptor(AuthController.prototype, 'refresh'));
Req()(AuthController.prototype, 'refresh', 0);
Res({ passthrough: true })(AuthController.prototype, 'refresh', 1);
Post('logout')(AuthController.prototype, 'logout', Object.getOwnPropertyDescriptor(AuthController.prototype, 'logout'));
Req()(AuthController.prototype, 'logout', 0);
Res({ passthrough: true })(AuthController.prototype, 'logout', 1);

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }));
}
