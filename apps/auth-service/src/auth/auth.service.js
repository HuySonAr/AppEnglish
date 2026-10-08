import { accountResponseSchema, authResponseSchema } from './auth.schemas.js';
import { AccountStatus } from './auth.constants.js';
import { authErrors } from './auth.errors.js';
import { AccountResponseDto } from './auth.dto.js';

export class AuthService {
  constructor(accountRepository, passwordService) {
    this.accountRepository = accountRepository;
    this.passwordService = passwordService;
  }

  async register(input) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.accountRepository.findByEmail(email);
    if (existing) throw authErrors.emailTaken();
    const account = await this.accountRepository.createAccount({
      email,
      passwordHash: this.passwordService.hash(input.password),
      role: input.role,
      status: AccountStatus.ACTIVE
    });
    return this.toResponse(account);
  }

  async login(input) {
    const account = await this.accountRepository.findByEmail(input.email.trim().toLowerCase());
    if (!account || !this.passwordService.verify(input.password, account.passwordHash)) {
      throw authErrors.invalidCredentials();
    }
    if (account.status !== AccountStatus.ACTIVE) throw authErrors.accountDisabled();
    return authResponseSchema.parse({
      account: this.toResponse(account),
      authenticated: true,
      authentication: 'credential_verified'
    });
  }

  toResponse(account) {
    return accountResponseSchema.parse(new AccountResponseDto({
      id: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      createdAt: new Date(account.createdAt).toISOString()
    }));
  }
}
