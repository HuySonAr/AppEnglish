import { EntitySchema } from 'typeorm';

export const AccountAuditEntity = new EntitySchema({
  name: 'AccountAudit',
  tableName: 'account_audits',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    actorId: { type: 'uuid' },
    targetAccountId: { type: 'uuid' },
    action: { type: 'varchar', length: 32 },
    previousRole: { type: 'varchar', length: 32, nullable: true },
    nextRole: { type: 'varchar', length: 32, nullable: true },
    previousStatus: { type: 'varchar', length: 32, nullable: true },
    nextStatus: { type: 'varchar', length: 32, nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
  },
});
