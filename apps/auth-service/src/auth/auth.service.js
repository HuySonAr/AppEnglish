import { accountResponseSchema, authResponseSchema } from './auth.schemas.js';
import { AccountStatus } from './auth.constants.js';
import { authErrors } from './auth.errors.js';
import { AccountResponseDto } from './auth.dto.js';

export class AuthService {
  constructor(accountRepository, passwordService, tokenService) {
    this.accountRepository = accountRepository;
    this.passwordService = passwordService;
    this.tokenService = tokenService;
  }

  async register(input) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.accountRepository.findByEmail(email);
    if (existing) throw authErrors.emailTaken();
    const account = await this.accountRepository.createAccount({
      email,
      passwordHash: this.passwordService.hash(input.password),
      role: 'STUDENT',
      status: AccountStatus.ACTIVE
    });
    return this.createSessionResponse(account);
  }

  async login(input) {
    const account = await this.accountRepository.findByEmail(input.email.trim().toLowerCase());
    if (!account || !this.passwordService.verify(input.password, account.passwordHash)) {
      throw authErrors.invalidCredentials();
    }
    if (account.status !== AccountStatus.ACTIVE) throw authErrors.accountDisabled();
    return this.createSessionResponse(account);
  }

  async me(accessToken) {
    const claims = this.tokenService.verifyAccessToken(accessToken);
    const account = await this.accountRepository.findAccountById(claims.sub);
    if (!account) throw authErrors.accountNotFound();
    if (account.status !== AccountStatus.ACTIVE) throw authErrors.accountDisabled();
    return authResponseSchema.parse({
      account: this.toResponse(account),
      authenticated: true,
      authentication: 'session'
    });
  }

  async refresh(rawToken) {
    if (!rawToken) throw authErrors.sessionExpired();
    const tokenHash = this.tokenService.hashRefreshToken(rawToken);
    const stored = await this.accountRepository.findRefreshToken(tokenHash);
    if (!stored) throw authErrors.sessionExpired();
    if (stored.revokedAt) {
      await this.accountRepository.revokeFamily(stored.familyId);
      throw authErrors.refreshTokenReuse();
    }
    if (new Date(stored.expiresAt).getTime() <= Date.now()) {
      throw authErrors.sessionExpired();
    }
    const account = await this.accountRepository.findAccountById(stored.accountId);
    if (!account) throw authErrors.accountNotFound();
    if (account.status !== AccountStatus.ACTIVE) throw authErrors.accountDisabled();
    const next = this.tokenService.createRefreshToken(account, stored.familyId);
    await this.accountRepository.revokeRefreshToken(tokenHash, next.tokenHash);
    return this.sessionResponse(account, next);
  }

  async logout(rawToken) {
    if (rawToken) {
      const stored = await this.accountRepository.findRefreshToken(this.tokenService.hashRefreshToken(rawToken));
      if (stored && !stored.revokedAt) await this.accountRepository.revokeFamily(stored.familyId);
    }
    return { loggedOut: true, setCookies: this.tokenService.clearCookies() };
  }

  createSessionResponse(account) {
    const refresh = this.tokenService.createRefreshToken(account);
    return this.sessionResponse(account, refresh);
  }

  async saveSession(account, refresh) {
    await this.accountRepository.saveRefreshToken({
      accountId: account.id,
      familyId: refresh.familyId,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt
    });
  }

  sessionResponse(account, refresh) {
    const accessToken = this.tokenService.createAccessToken(account);
    const response = authResponseSchema.parse({
      account: this.toResponse(account),
      authenticated: true,
      authentication: 'session'
    });
    const result = { ...response, setCookies: [this.tokenService.accessCookie(accessToken), this.tokenService.refreshCookie(refresh.rawToken)] };
    return this.saveSession(account, refresh).then(() => result);
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
