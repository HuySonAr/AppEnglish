import { EntitySchema } from 'typeorm';

export const RefreshTokenEntity = new EntitySchema({
  name: 'RefreshToken',
  tableName: 'refresh_tokens',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    familyId: { type: 'uuid' },
    tokenHash: { type: 'varchar', length: 64, unique: true },
    expiresAt: { type: 'timestamptz' },
    createdAt: { type: 'timestamptz', createDate: true },
    revokedAt: { type: 'timestamptz', nullable: true },
    replacedByHash: { type: 'varchar', length: 64, nullable: true }
  },
  indices: [
    { name: 'IDX_refresh_tokens_account_id', columns: ['accountId'] },
    { name: 'IDX_refresh_tokens_family_id', columns: ['familyId'] }
  ]
});
