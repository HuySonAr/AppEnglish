import { AccountEntity } from '../database/account.entity.js';

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
}
