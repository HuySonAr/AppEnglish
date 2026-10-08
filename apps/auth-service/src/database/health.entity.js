import { EntitySchema } from 'typeorm';

export const HealthEntity = new EntitySchema({
  name: 'Health',
  tableName: 'health_checks',
  columns: {
    id: { type: Number, primary: true, generated: true },
    checkedAt: { type: Date }
  }
});
