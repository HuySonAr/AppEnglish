import { accountResponseSchema, authResponseSchema } from './auth.schemas.js';
import { authErrors } from './auth.errors.js';
import { lastWeeks, newLearnersNotice, startOfDay } from './admin-notices.js';
import { AccountResponseDto } from './auth.dto.js';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ADMIN_AUDIT_LIMIT, ADMIN_STATS_DAYS, AccountAuditAction, AdminAccountAction, INVITE_TTL_HOURS, displayNameOf } from '@appenglish/auth-contracts';
import { randomBytes } from 'node:crypto';
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
    avatarStorage,
  ) {
    this.accountRepository = accountRepository;
    this.passwordService = passwordService;
    this.tokenService = tokenService;
    this.emailService = emailService;
    this.authorizationService = authorizationService;
    this.avatarStorage = avatarStorage;
  }

  async register(input) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.accountRepository.findByEmail(email);
    if (existing) {
      if (existing.status === AccountStatus.PENDING_VERIFICATION) {
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
    await this.recordLogin(account);
    return this.createSessionResponse(account);
  }

  async recordLogin(account) {
    account.lastLoginAt = new Date();
    try {
      await this.accountRepository.updateLastLogin?.(account.id, account.lastLoginAt);
    } catch {
    }
  }

  async verifyEmail(input) {
    const account = await this.accountRepository.findByEmail(
      input.email.trim().toLowerCase(),
    );
    if (!account) throw authErrors.otpInvalid();
    this.assertLoginStatus(account);
    if (account.status === AccountStatus.ACTIVE) {
      return {
        code: ResponseCode.ADDITIONAL,
        msg: ResponseMsg.ADDITIONAL,
        data: { nextAction: NextAction.LOGIN, email: account.email },
      };
    }
    await this.verifyOtp(account, OtpPurpose.VERIFY_EMAIL, input.otp);
    account.status = AccountStatus.ACTIVE;
    account.emailVerifiedAt = new Date();
    account.lastLoginAt = new Date();
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
    if (!account) throw authErrors.otpInvalid();
    await this.verifyOtp(account, OtpPurpose.RESET_PASSWORD, input.otp);
    account.passwordHash = this.passwordService.hash(input.password);
    account.sessionVersion = (account.sessionVersion || 0) + 1;
    await this.accountRepository.createAccount(account);
    await this.accountRepository.revokeAccountSessions(account.id);
    return { code: 0, msg: 'success', data: {} };
  }

  async issueOtp(account, purpose, { ttlMs = 300000, context = {} } = {}) {
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
      expiresAt: new Date(now + ttlMs),
      resendAfter: new Date(now + 60000),
      attempts: 0,
    });
    try {
      await this.emailService.sendOtp(account.email, code, purpose, context);
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
      throw authErrors.accountDisabled(account.statusReason);
    if (account.status === AccountStatus.SUSPENDED)
      throw authErrors.accountSuspended(account.statusReason);
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
    const [activeSessions, audits] = await Promise.all([
      this.accountRepository.countActiveSessions?.(account.id) ?? 0,
      this.accountRepository.listAudits?.(account.id, ADMIN_AUDIT_LIMIT) ?? [],
    ]);
    return {
      account: this.toAdminResponse(account),
      activeSessions,
      audits: audits.map((audit) => ({
        id: audit.id,
        action: audit.action,
        actorId: audit.actorId,
        actor: audit.actorId === account.id ? 'self' : audit.actorDisplayName || audit.actorEmail || null,
        previousRole: audit.previousRole || null,
        nextRole: audit.nextRole || null,
        previousStatus: audit.previousStatus || null,
        nextStatus: audit.nextStatus || null,
        reason: audit.reason || null,
        createdAt: new Date(audit.createdAt).toISOString(),
      })),
    };
  }

  async adminAction(accessToken, accountId, { action, reason }) {
    const actor = await this.requireAdmin(accessToken);
    const target = await this.accountRepository.findAccountById(accountId);
    if (!target) throw authErrors.accountNotFound();
    const audit = (auditAction) => ({
      actorId: actor.id,
      targetAccountId: target.id,
      action: auditAction,
      previousRole: target.role,
      nextRole: target.role,
      previousStatus: target.status,
      nextStatus: target.status,
      reason: reason || null,
    });
    if (action === AdminAccountAction.REVOKE_SESSIONS) {
      target.sessionVersion = (target.sessionVersion || 0) + 1;
      await this.accountRepository.updateAccountAndAudit(target, audit(AccountAuditAction.SESSIONS_REVOKED));
      return { account: this.toAdminResponse(target), changed: true };
    }
    if (action === AdminAccountAction.SEND_PASSWORD_RESET) {
      if (target.status !== AccountStatus.ACTIVE) throw authErrors.emailVerificationRequired();
      await this.issueOtp(target, OtpPurpose.RESET_PASSWORD);
      await this.accountRepository.saveAudit(audit(AccountAuditAction.PASSWORD_RESET_SENT));
      return { account: this.toAdminResponse(target), changed: true, expiresInSeconds: 300 };
    }
    if (action === AdminAccountAction.REMOVE_AVATAR) {
      const previous = this.avatarAsset(target);
      if (!previous && !target.avatarUrl) return { account: this.toAdminResponse(target), changed: false };
      target.avatarUrl = null;
      target.avatarStorage = null;
      target.avatarStorageId = null;
      await this.accountRepository.saveAccount(target);
      await this.accountRepository.saveAudit(audit(AccountAuditAction.AVATAR_REMOVED));
      if (previous) await this.avatarStorage?.delete(previous).catch(() => {});
      return { account: this.toAdminResponse(target), changed: true };
    }
    if (action === AdminAccountAction.RESET_DISPLAY_NAME) {
      if (!target.displayName) return { account: this.toAdminResponse(target), changed: false };
      target.displayName = null;
      await this.accountRepository.saveAccount(target);
      await this.accountRepository.saveAudit(audit(AccountAuditAction.DISPLAY_NAME_RESET));
      return { account: this.toAdminResponse(target), changed: true };
    }
    if (action === AdminAccountAction.ACTIVATE) {
      if (target.status !== AccountStatus.PENDING_VERIFICATION) throw authErrors.notPending();
      if (target.invitedAt) throw authErrors.invitedPending();
      if (!reason) throw authErrors.reasonRequired();
      target.status = AccountStatus.ACTIVE;
      target.statusReason = null;
      await this.accountRepository.saveAccount(target);
      await this.accountRepository.saveAudit({ ...audit(AccountAuditAction.ACCOUNT_ACTIVATED), previousStatus: AccountStatus.PENDING_VERIFICATION, nextStatus: AccountStatus.ACTIVE });
      return { account: this.toAdminResponse(target), changed: true };
    }
    if (action === AdminAccountAction.RESEND_VERIFICATION) {
      if (target.status !== AccountStatus.PENDING_VERIFICATION) throw authErrors.notPending();
      if (target.invitedAt) throw authErrors.invitedPending();
      await this.issueOtp(target, OtpPurpose.VERIFY_EMAIL);
      await this.accountRepository.saveAudit(audit(AccountAuditAction.VERIFICATION_RESENT));
      return { account: this.toAdminResponse(target), changed: true, expiresInSeconds: 300 };
    }
    if (action === AdminAccountAction.RESEND_INVITE) {
      if (target.status !== AccountStatus.PENDING_VERIFICATION) throw authErrors.notPending();
      if (!target.invitedAt) throw authErrors.notInvited();
      await this.issueOtp(target, OtpPurpose.INVITE, this.inviteOptions(target));
      await this.accountRepository.saveAudit(audit(AccountAuditAction.INVITE_RESENT));
      return { account: this.toAdminResponse(target), changed: true, expiresInHours: INVITE_TTL_HOURS };
    }
    if (action === AdminAccountAction.RESET_PLACEMENT) {
      if (target.role !== AccountRole.STUDENT) throw authErrors.forbiddenRole();
      await this.accountRepository.saveAudit(audit(AccountAuditAction.PLACEMENT_RESET));
      return { account: this.toAdminResponse(target), changed: true };
    }
    throw authErrors.unauthorized();
  }

  async adminInvite(accessToken, { email, displayName, role }) {
    const actor = await this.requireAdmin(accessToken);
    if (await this.accountRepository.findByEmail(email)) throw authErrors.emailTaken();
    const account = await this.accountRepository.createAccount({
      email,
      passwordHash: this.passwordService.hash(randomBytes(32).toString('hex')),
      role,
      status: AccountStatus.PENDING_VERIFICATION,
      displayName: displayName || null,
      invitedAt: new Date(),
    });
    await this.issueOtp(account, OtpPurpose.INVITE, this.inviteOptions(account));
    await this.accountRepository.saveAudit({
      actorId: actor.id,
      targetAccountId: account.id,
      action: AccountAuditAction.ACCOUNT_INVITED,
      previousRole: role,
      nextRole: role,
      previousStatus: AccountStatus.PENDING_VERIFICATION,
      nextStatus: AccountStatus.PENDING_VERIFICATION,
      reason: null,
    });
    return { account: this.toAdminResponse(account), expiresInHours: INVITE_TTL_HOURS };
  }

  inviteOptions(account) {
    return {
      ttlMs: INVITE_TTL_HOURS * 3600000,
      context: { role: account.role, displayName: account.displayName || '', expiresInHours: INVITE_TTL_HOURS },
    };
  }

  async acceptInvite(input) {
    const account = await this.accountRepository.findByEmail(input.email.trim().toLowerCase());
    if (!account || !account.invitedAt) throw authErrors.otpInvalid();
    this.assertLoginStatus(account);
    if (account.status === AccountStatus.ACTIVE)
      return {
        code: ResponseCode.ADDITIONAL,
        msg: ResponseMsg.ADDITIONAL,
        data: { nextAction: NextAction.LOGIN, email: account.email },
      };
    await this.verifyOtp(account, OtpPurpose.INVITE, input.otp);
    account.passwordHash = this.passwordService.hash(input.password);
    account.status = AccountStatus.ACTIVE;
    account.emailVerifiedAt = new Date();
    account.lastLoginAt = new Date();
    await this.accountRepository.createAccount(account);
    await this.accountRepository.saveAudit({
      actorId: account.id,
      targetAccountId: account.id,
      action: AccountAuditAction.INVITE_ACCEPTED,
      previousRole: account.role,
      nextRole: account.role,
      previousStatus: AccountStatus.PENDING_VERIFICATION,
      nextStatus: AccountStatus.ACTIVE,
      reason: null,
    });
    return this.createSessionResponse(account);
  }

  async adminNotices(now = new Date()) {
    const weeks = lastWeeks(now);
    const [newLearners, before] = await Promise.all([
      this.accountRepository.countStudentsCreatedBetween(startOfDay(weeks.lastWeek), startOfDay(weeks.thisWeek)),
      this.accountRepository.countStudentsCreatedBetween(startOfDay(weeks.weekBefore), startOfDay(weeks.lastWeek)),
    ]);
    return [newLearnersNotice(weeks, newLearners, before)];
  }

  async adminNotifications(accessToken) {
    const actor = await this.requireAdmin(accessToken);
    const notices = await this.adminNotices();
    const read = await this.accountRepository.readNoticeKeys(actor.id, notices.map((notice) => notice.id));
    const notifications = notices.map((notice) => ({ ...notice, read: read.has(notice.id) }));
    return { notifications, unread: notifications.filter((item) => !item.read).length };
  }

  async adminMarkNotificationsRead(accessToken, ids) {
    const actor = await this.requireAdmin(accessToken);
    const keys = ids?.length ? ids : (await this.adminNotices()).map((notice) => notice.id);
    await this.accountRepository.markNoticesRead(actor.id, keys, new Date());
    return { unread: (await this.adminNotifications(accessToken)).unread };
  }

  async adminStats(accessToken) {
    await this.requireAdmin(accessToken);
    const stats = await this.accountRepository.accountStats();
    return { ...stats, days: ADMIN_STATS_DAYS };
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
    const locking = nextStatus !== target.status && nextStatus !== AccountStatus.ACTIVE;
    if (locking && !changes.reason) throw authErrors.reasonRequired();
    const previous = { role: target.role, status: target.status };
    target.role = nextRole;
    target.status = nextStatus;
    if (nextStatus !== previous.status) target.statusReason = locking ? changes.reason : null;
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
      reason: changes.reason || null,
    });
    return { account: this.toAdminResponse(target), changed: true };
  }

  async requireAccount(accessToken) {
    const { account } = await this.me(accessToken);
    return this.accountRepository.findAccountById(account.id);
  }

  async updateProfile(accessToken, changes) {
    const account = await this.requireAccount(accessToken);
    account.displayName = changes.displayName || null;
    await this.accountRepository.saveAccount(account);
    return { account: this.toResponse(account) };
  }

  async verifyPassword(accessToken, { currentPassword }) {
    const account = await this.requireAccount(accessToken);
    if (!this.passwordService.verify(currentPassword, account.passwordHash))
      throw authErrors.currentPasswordInvalid();
    return { verified: true };
  }

  async changePassword(accessToken, { currentPassword, newPassword }) {
    const account = await this.requireAccount(accessToken);
    if (!this.passwordService.verify(currentPassword, account.passwordHash))
      throw authErrors.currentPasswordInvalid();
    account.passwordHash = this.passwordService.hash(newPassword);
    account.sessionVersion = (account.sessionVersion || 0) + 1;
    await this.accountRepository.saveAccount(account);
    await this.accountRepository.revokeAccountSessions(account.id);
    const session = await this.createSessionResponse(account);
    return { ...session, passwordChanged: true };
  }

  async uploadAvatar(accessToken, file) {
    const account = await this.requireAccount(accessToken);
    const stored = await this.avatarStorage.upload(file);
    const previous = this.avatarAsset(account);
    account.avatarUrl = stored.url;
    account.avatarStorage = stored.storage;
    account.avatarStorageId = stored.storageId;
    await this.accountRepository.saveAccount(account);
    if (previous) await this.avatarStorage.delete(previous).catch(() => {});
    return { account: this.toResponse(account) };
  }

  async removeAvatar(accessToken) {
    const account = await this.requireAccount(accessToken);
    const previous = this.avatarAsset(account);
    account.avatarUrl = null;
    account.avatarStorage = null;
    account.avatarStorageId = null;
    await this.accountRepository.saveAccount(account);
    if (previous) await this.avatarStorage.delete(previous).catch(() => {});
    return { account: this.toResponse(account) };
  }

  avatarAsset(account) {
    return account.avatarStorage && account.avatarStorageId
      ? { storage: account.avatarStorage, storageId: account.avatarStorageId }
      : null;
  }

  async getProfiles(accountIds) {
    const ids = [...new Set(accountIds)];
    const accounts = ids.length ? await this.accountRepository.findAccountsByIds(ids) : [];
    return {
      profiles: accounts.map((account) => ({
        id: account.id,
        displayName: displayNameOf(account),
        avatarUrl: account.avatarUrl || null,
      })),
    };
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
        displayName: account.displayName || null,
        avatarUrl: account.avatarUrl || null,
      }),
    );
  }

  toAdminResponse(account) {
    return {
      ...this.toResponse(account),
      emailVerifiedAt: account.emailVerifiedAt
        ? new Date(account.emailVerifiedAt).toISOString()
        : null,
      lastLoginAt: account.lastLoginAt ? new Date(account.lastLoginAt).toISOString() : null,
      statusReason: account.statusReason || null,
      invitedAt: account.invitedAt ? new Date(account.invitedAt).toISOString() : null,
    };
  }
}
