import { AccountEntity } from '../database/account.entity.js';
import { RefreshTokenEntity } from '../database/refresh-token.entity.js';
import { OtpEntity } from '../database/otp.entity.js';
import { AccountAuditEntity } from '../database/account-audit.entity.js';
import { ADMIN_STATS_DAYS, AdminAccountSort, STALE_PENDING_DAYS } from '@appenglish/auth-contracts';

const daysAgo = (days) => new Date(Date.now() - days * 86400000);

export class AccountRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async findByEmail(email) {
    await this.ensureInitialized();
    return this.dataSource
      .getRepository(AccountEntity)
      .findOne({ where: { email } });
  }

  async createAccount(account) {
    await this.ensureInitialized();
    return this.dataSource.getRepository(AccountEntity).save(account);
  }

  async ensureInitialized() {
    if (!this.dataSource.isInitialized) await this.dataSource.initialize();
  }

  async saveRefreshToken(token) {
    await this.ensureInitialized();
    return this.dataSource.getRepository(RefreshTokenEntity).save(token);
  }

  async findRefreshToken(tokenHash) {
    await this.ensureInitialized();
    return this.dataSource
      .getRepository(RefreshTokenEntity)
      .findOne({ where: { tokenHash } });
  }

  async revokeRefreshToken(tokenHash, replacedByHash = null) {
    await this.ensureInitialized();
    await this.dataSource
      .getRepository(RefreshTokenEntity)
      .update({ tokenHash }, { revokedAt: new Date(), replacedByHash });
  }

  async revokeFamily(familyId) {
    await this.ensureInitialized();
    await this.dataSource
      .getRepository(RefreshTokenEntity)
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('"familyId" = :familyId AND "revokedAt" IS NULL', { familyId })
      .execute();
  }

  async findAccountById(id) {
    await this.ensureInitialized();
    return this.dataSource
      .getRepository(AccountEntity)
      .findOne({ where: { id } });
  }

  async findAccountsByIds(ids) {
    await this.ensureInitialized();
    return this.dataSource
      .getRepository(AccountEntity)
      .createQueryBuilder('account')
      .where('account.id IN (:...ids)', { ids })
      .getMany();
  }

  async saveAccount(account) {
    await this.ensureInitialized();
    return this.dataSource.getRepository(AccountEntity).save(account);
  }

  async listAccounts({ email, search, role, status, stale, sort, page, pageSize }) {
    await this.ensureInitialized();
    const query = this.dataSource.getRepository(AccountEntity).createQueryBuilder('account');
    if (email) query.andWhere('LOWER(account.email) LIKE LOWER(:email)', { email: `%${email}%` });
    if (search)
      query.andWhere('(LOWER(account.email) LIKE LOWER(:search) OR LOWER(account."displayName") LIKE LOWER(:search))', { search: `%${search}%` });
    if (role) query.andWhere('account.role = :role', { role });
    if (status) query.andWhere('account.status = :status', { status });
    if (stale)
      query.andWhere('account.status = :pending AND account."createdAt" < :staleBefore', { pending: 'PENDING_VERIFICATION', staleBefore: daysAgo(STALE_PENDING_DAYS) });
    if (sort === AdminAccountSort.OLDEST) query.orderBy('account.createdAt', 'ASC');
    else if (sort === AdminAccountSort.EMAIL) query.orderBy('account.email', 'ASC');
    else if (sort === AdminAccountSort.LAST_LOGIN) query.orderBy('account.lastLoginAt', 'DESC', 'NULLS LAST').addOrderBy('account.createdAt', 'DESC');
    else query.orderBy('account.createdAt', 'DESC');
    query.skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  // Devices still signed in: refresh-token families not revoked and not expired.
  async countActiveSessions(accountId) {
    await this.ensureInitialized();
    const row = await this.dataSource
      .getRepository(RefreshTokenEntity)
      .createQueryBuilder('token')
      .select('COUNT(DISTINCT token."familyId")', 'count')
      .where('token."accountId" = :accountId AND token."revokedAt" IS NULL AND token."expiresAt" > :now', { accountId, now: new Date() })
      .getRawOne();
    return Number(row?.count || 0);
  }

  // The audit trail of one account, newest first, with who did it.
  async listAudits(targetAccountId, limit) {
    await this.ensureInitialized();
    const rows = await this.dataSource
      .getRepository(AccountAuditEntity)
      .createQueryBuilder('audit')
      .leftJoin(AccountEntity, 'actor', 'actor.id = audit."actorId"')
      .select('audit')
      .addSelect('actor.email', 'actorEmail')
      .addSelect('actor."displayName"', 'actorDisplayName')
      .where('audit.targetAccountId = :targetAccountId', { targetAccountId })
      // Property paths, not quoted columns: with take() TypeORM maps the order
      // onto the entity metadata and a raw expression has none.
      .orderBy('audit.createdAt', 'DESC')
      .take(limit)
      .getRawAndEntities();
    return rows.entities.map((audit, index) => ({
      ...audit,
      actorEmail: rows.raw[index]?.actorEmail || null,
      actorDisplayName: rows.raw[index]?.actorDisplayName || null,
    }));
  }

  async updateLastLogin(accountId, at = new Date()) {
    await this.ensureInitialized();
    await this.dataSource.getRepository(AccountEntity).update({ id: accountId }, { lastLoginAt: at });
  }

  // The numbers of the accounts page (D114).
  async accountStats() {
    await this.ensureInitialized();
    const accounts = this.dataSource.getRepository(AccountEntity);
    const group = async (column) =>
      Object.fromEntries(
        (await accounts.createQueryBuilder('account').select(`account.${column}`, 'key').addSelect('COUNT(*)', 'count').groupBy(`account.${column}`).getRawMany())
          .map((row) => [row.key, Number(row.count)]),
      );
    const [byStatus, byRole, activeLast7Days, stale, total, perDay] = await Promise.all([
      group('status'),
      group('role'),
      accounts.createQueryBuilder('account').where('account."lastLoginAt" >= :since', { since: daysAgo(7) }).getCount(),
      accounts.createQueryBuilder('account').where('account.status = :pending AND account."createdAt" < :before', { pending: 'PENDING_VERIFICATION', before: daysAgo(STALE_PENDING_DAYS) }).getCount(),
      accounts.count(),
      accounts
        .createQueryBuilder('account')
        .select('to_char(account."createdAt"::date, \'YYYY-MM-DD\')', 'day')
        .addSelect('COUNT(*)', 'count')
        .where('account."createdAt" >= :since', { since: daysAgo(ADMIN_STATS_DAYS - 1) })
        .groupBy('day')
        .orderBy('day', 'ASC')
        .getRawMany(),
    ]);
    return {
      total,
      byStatus,
      byRole,
      activeLast7Days,
      stalePending: stale,
      newPerDay: perDay.map((row) => ({ day: row.day, count: Number(row.count) })),
    };
  }

  async countActiveAdmins() {
    await this.ensureInitialized();
    return this.dataSource.getRepository(AccountEntity).count({
      where: { role: 'ADMIN', status: 'ACTIVE' },
    });
  }

  async saveAudit(audit) {
    await this.ensureInitialized();
    return this.dataSource.getRepository('AccountAudit').save(audit);
  }

  async updateAccountAndAudit(account, audit) {
    await this.ensureInitialized();
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(AccountEntity).save(account);
      await manager.getRepository(RefreshTokenEntity)
        .createQueryBuilder()
        .update()
        .set({ revokedAt: new Date() })
        .where('"accountId" = :accountId AND "revokedAt" IS NULL', { accountId: account.id })
        .execute();
      return manager.getRepository('AccountAudit').save(audit);
    });
  }

  async saveOtp(otp) {
    await this.ensureInitialized();
    return this.dataSource.getRepository(OtpEntity).save(otp);
  }

  async invalidateOtps(accountId, purpose) {
    await this.ensureInitialized();
    await this.dataSource
      .getRepository(OtpEntity)
      .createQueryBuilder()
      .update()
      .set({ usedAt: new Date() })
      .where(
        '"accountId" = :accountId AND "purpose" = :purpose AND "usedAt" IS NULL',
        { accountId, purpose },
      )
      .execute();
  }

  async findLatestOtp(accountId, purpose) {
    await this.ensureInitialized();
    return this.dataSource
      .getRepository(OtpEntity)
      .findOne({
        where: { accountId, purpose, usedAt: null },
        order: { createdAt: 'DESC' },
      });
  }

  // Latest challenge regardless of usedAt; verification uses this to reject
  // already-used codes explicitly instead of relying on the unused filter.
  async findLatestOtpChallenge(accountId, purpose) {
    await this.ensureInitialized();
    return this.dataSource
      .getRepository(OtpEntity)
      .findOne({
        where: { accountId, purpose },
        order: { createdAt: 'DESC' },
      });
  }

  async updateOtp(id, values) {
    await this.ensureInitialized();
    return this.dataSource.getRepository(OtpEntity).update({ id }, values);
  }

  async countRecentOtps(accountId, purpose, since) {
    await this.ensureInitialized();
    return this.dataSource
      .getRepository(OtpEntity)
      .createQueryBuilder('otp')
      .where(
        'otp."accountId" = :accountId AND otp."purpose" = :purpose AND otp."createdAt" >= :since',
        { accountId, purpose, since },
      )
      .getCount();
  }

  async incrementSessionVersion(accountId) {
    await this.ensureInitialized();
    await this.dataSource
      .getRepository(AccountEntity)
      .increment({ id: accountId }, 'sessionVersion', 1);
  }

  async revokeAccountSessions(accountId) {
    await this.ensureInitialized();
    await this.dataSource
      .getRepository(RefreshTokenEntity)
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('"accountId" = :accountId AND "revokedAt" IS NULL', { accountId })
      .execute();
  }
}
