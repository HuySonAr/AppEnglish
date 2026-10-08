import { Body, Controller, HttpException, Inject, Post } from '@nestjs/common';
import { registerSchema, loginSchema, authResponseSchema } from './auth.schemas.js';
import { RegisterAccountDto, LoginDto } from './auth.dto.js';
import { AuthError } from './auth.errors.js';
import { AuthService } from './auth.service.js';

export class AuthController {
  constructor(authService) {
    this.authService = authService;
  }

  async register(body) {
    try {
      return await this.authService.register(new RegisterAccountDto(registerSchema.parse(body)));
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async login(body) {
    try {
      return authResponseSchema.parse(await this.authService.login(new LoginDto(loginSchema.parse(body))));
    } catch (error) {
      throw this.normalizeError(error);
    }
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
Post('login')(AuthController.prototype, 'login', Object.getOwnPropertyDescriptor(AuthController.prototype, 'login'));
Body()(AuthController.prototype, 'login', 0);
