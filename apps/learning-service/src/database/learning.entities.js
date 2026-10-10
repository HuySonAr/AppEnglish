import { EntitySchema } from 'typeorm';

// One row per account: a learner takes or skips the placement test once
// (D35). answers maps question id to the chosen option id.
export const PlacementAttemptEntity = new EntitySchema({
  name: 'PlacementAttempt',
  tableName: 'placement_attempts',
  columns: {
    id: { type: 'uuid', primary: true, generated: 'uuid' },
    accountId: { type: 'uuid' },
    status: { type: 'varchar', length: 16 },
    placementVersionId: { type: 'uuid', nullable: true },
    versionNumber: { type: 'int', nullable: true },
    startedAt: { type: 'timestamptz', nullable: true },
    expiresAt: { type: 'timestamptz', nullable: true },
    submittedAt: { type: 'timestamptz', nullable: true },
    answers: { type: 'jsonb', default: {} },
    totalCount: { type: 'int', nullable: true },
    correctCount: { type: 'int', nullable: true },
    listeningCorrect: { type: 'int', nullable: true },
    readingCorrect: { type: 'int', nullable: true },
    startUnit: { type: 'int', nullable: true },
    createdAt: { type: 'timestamptz', createDate: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
  indices: [{ name: 'UQ_placement_attempts_account', columns: ['accountId'], unique: true }],
});

// Single row (id 1): the score thresholds that decide the starting unit.
export const PlacementSettingsEntity = new EntitySchema({
  name: 'PlacementSettings',
  tableName: 'placement_settings',
  columns: {
    id: { type: 'smallint', primary: true },
    unit2Threshold: { type: 'int' },
    unit3Threshold: { type: 'int' },
    updatedBy: { type: 'uuid', nullable: true },
    updatedAt: { type: 'timestamptz', updateDate: true },
  },
});
