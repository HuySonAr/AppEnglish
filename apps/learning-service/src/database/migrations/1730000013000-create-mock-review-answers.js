export class CreateMockReviewAnswers1730000013000 {
  name = 'CreateMockReviewAnswers1730000013000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "mock_review_answers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "accountId" uuid NOT NULL,
        "mockTestId" uuid NOT NULL,
        "mockVersionId" uuid NOT NULL,
        "partKey" varchar(8) NOT NULL,
        "questionId" uuid NOT NULL,
        "optionId" uuid,
        "correct" boolean NOT NULL,
        "answeredAt" timestamptz NOT NULL
      )
    `);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_mock_review_answers_account" ON "mock_review_answers" ("accountId", "answeredAt")');
  }

  async down(queryRunner) {
    await queryRunner.query('DROP TABLE IF EXISTS "mock_review_answers"');
  }
}
