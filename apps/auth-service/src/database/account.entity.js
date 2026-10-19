import { EntitySchema } from 'typeorm';

export const AccountEntity = new EntitySchema({
  name: 'Account',
  tableName: 'accounts',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    email: { type: 'varchar', length: 320, unique: true },
    passwordHash: { type: 'text' },
    role: { type: 'varchar', length: 32, default: 'STUDENT' },
    status: { type: 'varchar', length: 32, default: 'PENDING_VERIFICATION' },
    emailVerifiedAt: { type: 'timestamptz', nullable: true },
    sessionVersion: { type: 'int', default: 0 },
    // Profile (F09, D113): optional name and avatar; the storage columns let
    // the previous picture be deleted when a new one is uploaded.
    displayName: { type: 'varchar', length: 50, nullable: true },
    avatarUrl: { type: 'text', nullable: true },
    avatarStorage: { type: 'varchar', length: 16, nullable: true },
    avatarStorageId: { type: 'varchar', length: 128, nullable: true },
    // Admin management (D114): last sign-in, and why the account is locked.
    lastLoginAt: { type: 'timestamptz', nullable: true },
    statusReason: { type: 'text', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true }
  }
});
