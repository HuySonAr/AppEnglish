import { EntitySchema } from 'typeorm';

export const AccountEntity = new EntitySchema({
  name: 'Account',
  tableName: 'accounts',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    email: { type: 'varchar', length: 320, unique: true },
    passwordHash: { type: 'text' },
    role: { type: 'varchar', length: 32, default: 'STUDENT' },
    status: { type: 'varchar', length: 32, default: 'ACTIVE' },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true }
  }
});
