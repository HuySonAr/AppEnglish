import { EntitySchema } from 'typeorm';

export const AdminNoticeReadEntity = new EntitySchema({
  name: 'AdminNoticeRead',
  tableName: 'admin_notice_reads',
  columns: {
    accountId: { type: 'uuid', primary: true },
    key: { type: 'varchar', length: 160, primary: true },
    readAt: { type: 'timestamptz' },
  },
});
