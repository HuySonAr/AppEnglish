import { accountResponseSchema, authResponseSchema } from './auth.schemas.js';
import { authErrors } from './auth.errors.js';
import { AccountResponseDto } from './auth.dto.js';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { AccountRole, AccountStatus } from './auth.constants.js';
import {
  NextAction,
  OtpPurpose,
  ResponseCode,
  ResponseMsg,
} from '@appenglish/auth-contracts';

export class AuthService {
  constructor(
    accountRepository,
    passwordService,
    tokenService,
    emailService,
    authorizationService,
  ) {
    this.accountRepository = accountRepository;
    this.passwordService = passwordService;
    this.tokenService = tokenService;
    this.emailService = emailService;
    this.authorizationService = authorizationService;
  }

  async register(input) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.accountRepository.findByEmail(email);
    if (existing) {
      if (existing.status === AccountStatus.PENDING_VERIFICATION) {
        // Resume a pending registration: keep the existing account and password
        // untouched and do not send another OTP; the user requests a resend
        // explicitly and the backend keeps enforcing its cooldown/rate limits.
        return {
          code: ResponseCode.ADDITIONAL,
          msg: ResponseMsg.ADDITIONAL,
          data: { nextAction: NextAction.VERIFY_EMAIL, email },
        };
      }
      throw authErrors.emailTaken();
    }
    const account = await this.accountRepository.createAccount({
      email,
      passwordHash: this.passwordService.hash(input.password),
      role: 'STUDENT',
      status: AccountStatus.PENDING_VERIFICATION,
    });
    await this.issueOtp(account, OtpPurpose.VERIFY_EMAIL);
    return {
      code: ResponseCode.ADDITIONAL,
      msg: ResponseMsg.ADDITIONAL,
      data: {
        nextAction: NextAction.VERIFY_EMAIL,
        email,
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      },
    };
  }

  async login(input) {
    const account = await this.accountRepository.findByEmail(
      input.email.trim().toLowerCase(),
    );
    if (
      !account ||
      !this.passwordService.verify(input.password, account.passwordHash)
    ) {
      throw authErrors.invalidCredentials();
    }
    this.assertLoginStatus(account);
    if (account.status !== AccountStatus.ACTIVE)
      throw authErrors.emailNotVerified();
    return this.createSessionResponse(account);
  }

  async verifyEmail(input) {
    const account = await this.accountRepository.findByEmail(
      input.email.trim().toLowerCase(),
    );
    // An unknown email answers like a wrong code so this public route does not
    // reveal which emails are registered.
    if (!account) throw authErrors.otpInvalid();
    this.assertLoginStatus(account);
    if (account.status === AccountStatus.ACTIVE) {
      // The email is already verified (e.g. an old OTP was re-submitted):
      // direct the user to sign in instead of re-verifying or creating a
      // second session.
      return {
        code: ResponseCode.ADDITIONAL,
        msg: ResponseMsg.ADDITIONAL,
        data: { nextAction: NextAction.LOGIN, email: account.email },
      };
    }
    await this.verifyOtp(account, OtpPurpose.VERIFY_EMAIL, input.otp);
    account.status = AccountStatus.ACTIVE;
    account.emailVerifiedAt = new Date();
    await this.accountRepository.createAccount(account);
    return this.createSessionResponse(account);
  }

  async resendVerification(email) {
    const normalizedEmail = email.trim().toLowerCase();
    const account = await this.accountRepository.findByEmail(normalizedEmail);
    if (!account)
      return {
        code: 1,
        msg: 'additional',
        data: {
          nextAction: 'VERIFY_EMAIL',
          email: normalizedEmail,
          expiresInSeconds: 300,
          resendAfterSeconds: 60,
        },
      };
    if (account.status === AccountStatus.ACTIVE)
      return {
        code: 1,
        msg: 'additional',
        data: {
          nextAction: 'LOGIN',
          email: account.email,
          expiresInSeconds: 300,
          resendAfterSeconds: 60,
        },
      };
    await this.issueOtp(account, OtpPurpose.VERIFY_EMAIL);
    return {
      code: 1,
      msg: 'additional',
      data: {
        nextAction: 'VERIFY_EMAIL',
        email: account.email,
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      },
    };
  }

  async forgotPassword(email) {
    const account = await this.accountRepository.findByEmail(
      email.trim().toLowerCase(),
    );
    if (account && account.status === AccountStatus.ACTIVE)
      await this.issueOtp(account, OtpPurpose.RESET_PASSWORD);
    return {
      code: 1,
      msg: 'additional',
      data: {
        nextAction: NextAction.RESET_PASSWORD,
        email: email.trim().toLowerCase(),
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
      },
    };
  }

  async resetPassword(input) {
    const account = await this.accountRepository.findByEmail(
      input.email.trim().toLowerCase(),
    );
    // Same non-enumerating answer as forgot-password: unknown email == bad OTP.
    if (!account) throw authErrors.otpInvalid();
    await this.verifyOtp(account, OtpPurpose.RESET_PASSWORD, input.otp);
    account.passwordHash = this.passwordService.hash(input.password);
    account.sessionVersion = (account.sessionVersion || 0) + 1;
    await this.accountRepository.createAccount(account);
    await this.accountRepository.revokeAccountSessions(account.id);
    return { code: 0, msg: 'success', data: {} };
  }

  async issueOtp(account, purpose) {
    const now = Date.now();
    const recent = await this.accountRepository.countRecentOtps(
      account.id,
      purpose,
      new Date(now - 3600000),
    );
    if (recent >= 5) throw authErrors.otpRateLimited();
    const current = await this.accountRepository.findLatestOtp(
      account.id,
      purpose,
    );
    if (current && new Date(current.resendAfter).getTime() > now)
      throw authErrors.otpRateLimited();
    await this.accountRepository.invalidateOtps(account.id, purpose);
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    const codeHash = this.otpHash(account.id, purpose, code);
    await this.accountRepository.saveOtp({
      accountId: account.id,
      purpose,
      codeHash,
      expiresAt: new Date(now + 300000),
      resendAfter: new Date(now + 60000),
      attempts: 0,
    });
    try {
      await this.emailService.sendOtp(account.email, code, purpose);
    } catch {
      throw authErrors.emailSend();
    }
  }

  async verifyOtp(account, purpose, code) {
    const challenge = await this.accountRepository.findLatestOtpChallenge(
      account.id,
      purpose,
    );
    if (!challenge) throw authErrors.otpInvalid();
    if (challenge.usedAt) throw authErrors.otpInvalid();
    if (challenge.attempts >= 5) throw authErrors.otpAttemptsExceeded();
    if (new Date(challenge.expiresAt).getTime() <= Date.now())
      throw authErrors.otpExpired();
    const expected = this.otpHash(account.id, purpose, code);
    const valid = timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(challenge.codeHash),
    );
    if (!valid) {
      await this.accountRepository.updateOtp(challenge.id, {
        attempts: challenge.attempts + 1,
      });
      throw authErrors.otpInvalid();
    }
    await this.accountRepository.updateOtp(challenge.id, {
      usedAt: new Date(),
    });
  }

  otpHash(accountId, purpose, code) {
    return createHmac(
      'sha256',
      process.env.AUTH_OTP_SECRET || this.tokenService.secret,
    )
      .update(`${accountId}:${purpose}:${code}`)
      .digest('hex');
  }

  assertLoginStatus(account) {
    if (account.status === AccountStatus.DISABLED)
      throw authErrors.accountDisabled();
    if (account.status === AccountStatus.SUSPENDED)
      throw authErrors.accountSuspended();
  }

  async me(accessToken) {
    const claims = this.tokenService.verifyAccessToken(accessToken);
    const account = await this.accountRepository.findAccountById(claims.sub);
    if (!account) throw authErrors.accountNotFound();
    this.assertLoginStatus(account);
    if ((account.sessionVersion || 0) !== (claims.sv || 0))
      throw authErrors.sessionExpired();
    return authResponseSchema.parse({
      account: this.toResponse(account),
      authenticated: true,
      authentication: 'session',
    });
  }

  async adminList(accessToken, query) {
    const actor = await this.requireAdmin(accessToken);
    const result = await this.accountRepository.listAccounts(query);
    return {
      actorId: actor.id,
      items: result.items.map((account) => this.toAdminResponse(account)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  }

  async adminGet(accessToken, accountId) {
    await this.requireAdmin(accessToken);
    const account = await this.accountRepository.findAccountById(accountId);
    if (!account) throw authErrors.accountNotFound();
    return { account: this.toAdminResponse(account) };
  }

  async adminUpdate(accessToken, accountId, changes) {
    const actor = await this.requireAdmin(accessToken);
    const target = await this.accountRepository.findAccountById(accountId);
    if (!target) throw authErrors.accountNotFound();
    const nextRole = changes.role ?? target.role;
    const nextStatus = changes.status ?? target.status;
    if (
      target.status === AccountStatus.PENDING_VERIFICATION &&
      nextStatus === AccountStatus.ACTIVE
    )
      throw authErrors.emailVerificationRequired();
    if (
      target.role === AccountRole.ADMIN &&
      target.status === AccountStatus.ACTIVE &&
      (nextRole !== AccountRole.ADMIN || nextStatus !== AccountStatus.ACTIVE) &&
      (await this.accountRepository.countActiveAdmins()) <= 1
    ) {
      throw authErrors.lastAdmin();
    }
    if (nextRole === target.role && nextStatus === target.status)
      return { account: this.toAdminResponse(target), changed: false };
    const previous = { role: target.role, status: target.status };
    target.role = nextRole;
    target.status = nextStatus;
    target.sessionVersion = (target.sessionVersion || 0) + 1;
    await this.accountRepository.updateAccountAndAudit(target, {
      actorId: actor.id,
      targetAccountId: target.id,
      action:
        changes.role !== undefined && changes.status !== undefined
          ? 'ROLE_STATUS_UPDATED'
          : changes.role !== undefined
            ? 'ROLE_UPDATED'
            : 'STATUS_UPDATED',
      previousRole: previous.role,
      nextRole: target.role,
      previousStatus: previous.status,
      nextStatus: target.status,
    });
    return { account: this.toAdminResponse(target), changed: true };
  }

  async requireAdmin(accessToken) {
    const account = await this.me(accessToken);
    return this.authorizationService.assertRole(account.account, [
      AccountRole.ADMIN,
    ]);
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
    const account = await this.accountRepository.findAccountById(
      stored.accountId,
    );
    if (!account) throw authErrors.accountNotFound();
    if (account.status !== AccountStatus.ACTIVE)
      throw authErrors.accountDisabled();
    const next = this.tokenService.createRefreshToken(account, stored.familyId);
    await this.accountRepository.revokeRefreshToken(tokenHash, next.tokenHash);
    return this.sessionResponse(account, next);
  }

  async logout(rawToken) {
    if (rawToken) {
      const stored = await this.accountRepository.findRefreshToken(
        this.tokenService.hashRefreshToken(rawToken),
      );
      if (stored && !stored.revokedAt)
        await this.accountRepository.revokeFamily(stored.familyId);
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
      expiresAt: refresh.expiresAt,
    });
  }

  sessionResponse(account, refresh) {
    const accessToken = this.tokenService.createAccessToken(account);
    const response = authResponseSchema.parse({
      account: this.toResponse(account),
      authenticated: true,
      authentication: 'session',
    });
    const result = {
      ...response,
      setCookies: [
        this.tokenService.accessCookie(accessToken),
        this.tokenService.refreshCookie(refresh.rawToken),
      ],
    };
    return this.saveSession(account, refresh).then(() => result);
  }

  toResponse(account) {
    return accountResponseSchema.parse(
      new AccountResponseDto({
        id: account.id,
        email: account.email,
        role: account.role,
        status: account.status,
        createdAt: new Date(account.createdAt).toISOString(),
      }),
    );
  }

  toAdminResponse(account) {
    return {
      ...this.toResponse(account),
      emailVerifiedAt: account.emailVerifiedAt
        ? new Date(account.emailVerifiedAt).toISOString()
        : null,
    };
  }
}
