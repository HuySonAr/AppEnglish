import { AccountEntity } from '../database/account.entity.js';
import { RefreshTokenEntity } from '../database/refresh-token.entity.js';
import { OtpEntity } from '../database/otp.entity.js';

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

  async listAccounts({ email, role, status, page, pageSize }) {
    await this.ensureInitialized();
    const query = this.dataSource.getRepository(AccountEntity).createQueryBuilder('account');
    if (email) query.andWhere('LOWER(account.email) LIKE LOWER(:email)', { email: `%${email}%` });
    if (role) query.andWhere('account.role = :role', { role });
    if (status) query.andWhere('account.status = :status', { status });
    query.orderBy('account.createdAt', 'DESC').skip((page - 1) * pageSize).take(pageSize);
    const [items, total] = await query.getManyAndCount();
    return { items, total };
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
