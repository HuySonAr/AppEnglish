import { EntitySchema } from 'typeorm';

export const OtpEntity = new EntitySchema({
  name: 'OtpChallenge',
  tableName: 'otp_challenges',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    purpose: { type: 'varchar', length: 32 },
    codeHash: { type: 'varchar', length: 64 },
    expiresAt: { type: 'timestamptz' },
    resendAfter: { type: 'timestamptz' },
    attempts: { type: 'int', default: 0 },
    usedAt: { type: 'timestamptz', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true }
  },
  indices: [
    { name: 'IDX_otp_account_purpose', columns: ['accountId', 'purpose'] },
    { name: 'IDX_otp_created_at', columns: ['createdAt'] }
  ]
});
