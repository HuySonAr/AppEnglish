import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthorizationService } from './auth/authorization.service.js';
import { PasswordService } from './auth/password.service.js';
import { AccountRepository } from './auth/account.repository.js';
import { createAuthDataSource } from './database/database.config.js';

export const AUTH_DATA_SOURCE = Symbol('AUTH_DATA_SOURCE');
export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export class AppModule {}
Module({
  controllers: [HealthController, AuthController],
  providers: [
    PasswordService,
    AuthorizationService,
    { provide: AUTH_DATA_SOURCE, useFactory: createAuthDataSource },
    { provide: AUTH_REPOSITORY, useFactory: (dataSource) => new AccountRepository(dataSource), inject: [AUTH_DATA_SOURCE] },
    { provide: AuthService, useFactory: (repository, passwordService) => new AuthService(repository, passwordService), inject: [AUTH_REPOSITORY, PasswordService] },
    { provide: AuthController, useFactory: (authService) => new AuthController(authService), inject: [AuthService] }
  ]
})(AppModule);
