import { AccountEntity } from '../database/account.entity.js';
import { RefreshTokenEntity } from '../database/refresh-token.entity.js';

export class AccountRepository {
  constructor(dataSource) {
    this.dataSource = dataSource;
  }

  async findByEmail(email) {
    await this.ensureInitialized();
    return this.dataSource.getRepository(AccountEntity).findOne({ where: { email } });
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
    return this.dataSource.getRepository(RefreshTokenEntity).findOne({ where: { tokenHash } });
  }

  async revokeRefreshToken(tokenHash, replacedByHash = null) {
    await this.ensureInitialized();
    await this.dataSource.getRepository(RefreshTokenEntity).update(
      { tokenHash },
      { revokedAt: new Date(), replacedByHash }
    );
  }

  async revokeFamily(familyId) {
    await this.ensureInitialized();
    await this.dataSource.getRepository(RefreshTokenEntity)
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('"familyId" = :familyId AND "revokedAt" IS NULL', { familyId })
      .execute();
  }

  async findAccountById(id) {
    await this.ensureInitialized();
    return this.dataSource.getRepository(AccountEntity).findOne({ where: { id } });
  }
}
