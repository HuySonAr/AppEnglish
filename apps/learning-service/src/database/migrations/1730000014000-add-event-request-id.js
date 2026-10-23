export class AddEventRequestId1730000014000 {
  name = 'AddEventRequestId1730000014000';

  async up(queryRunner) {
    await queryRunner.query('ALTER TABLE "learning_events" ADD COLUMN IF NOT EXISTS "requestId" varchar(64)');
  }

  async down(queryRunner) {
    await queryRunner.query('ALTER TABLE "learning_events" DROP COLUMN IF EXISTS "requestId"');
  }
}
