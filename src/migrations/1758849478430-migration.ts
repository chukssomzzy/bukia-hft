import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1758849478430 implements MigrationInterface {
  name = "Migration1758849478430";

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."UQ_ledger_idempotencyKey_type"`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_ledger_idempotencyKey" ON "ledger_entry" ("idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL)`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_ledger_idempotencyKey"`);
    await queryRunner.query(`
  CREATE UNIQUE INDEX "UQ_ledger_idempotencyKey_type"
  ON "ledger_entry" ("idempotencyKey", "type")
  WHERE ("idempotencyKey" IS NOT NULL AND "type" IS NOT NULL)
`);
  }
}
