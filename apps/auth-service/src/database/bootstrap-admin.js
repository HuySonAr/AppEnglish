import dataSource from './data-source.js';
import { AccountEntity } from './account.entity.js';
import { PasswordService } from '../auth/password.service.js';
import { AccountRole, AccountStatus } from '../auth/auth.constants.js';

const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (!email || !password) {
  throw new Error('ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must be set');
}

await dataSource.initialize();
try {
  const repository = dataSource.getRepository(AccountEntity);
  const existing = await repository.findOne({ where: { email } });
  if (existing) {
    if (existing.role !== AccountRole.ADMIN) throw new Error('Bootstrap email already belongs to a non-admin account');
    console.log('Bootstrap admin already exists; no changes made.');
  } else {
    const passwordService = new PasswordService();
    await repository.save({
      email,
      passwordHash: passwordService.hash(password),
      role: AccountRole.ADMIN,
      status: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      sessionVersion: 0,
    });
    console.log('Bootstrap admin created.');
  }
} finally {
  await dataSource.destroy();
}
