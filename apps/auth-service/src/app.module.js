import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller.js';
import { AuthController } from './auth/auth.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthorizationService } from './auth/authorization.service.js';
import { PasswordService } from './auth/password.service.js';
import { AccountRepository } from './auth/account.repository.js';
import { createAuthDataSource } from './database/database.config.js';
import { TokenService } from './auth/token.service.js';
import { EmailService } from './auth/email.service.js';
import {
  AUTH_DATA_SOURCE,
  AUTH_REPOSITORY,
} from './database/database.tokens.js';

export { AUTH_DATA_SOURCE, AUTH_REPOSITORY };

export class AppModule {}
Module({
  controllers: [HealthController, AuthController],
  providers: [
    PasswordService,
    TokenService,
    EmailService,
    AuthorizationService,
    { provide: AUTH_DATA_SOURCE, useFactory: createAuthDataSource },
    {
      provide: AUTH_REPOSITORY,
      useFactory: (dataSource) => new AccountRepository(dataSource),
      inject: [AUTH_DATA_SOURCE],
    },
    {
      provide: AuthService,
      useFactory: (repository, passwordService, tokenService, emailService) =>
        new AuthService(
          repository,
          passwordService,
          tokenService,
          emailService,
        ),
      inject: [AUTH_REPOSITORY, PasswordService, TokenService, EmailService],
    },
    {
      provide: AuthController,
      useFactory: (authService) => new AuthController(authService),
      inject: [AuthService],
    },
  ],
})(AppModule);
