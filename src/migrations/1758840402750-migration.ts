import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1758840402750 implements MigrationInterface {
  name = "Migration1758840402750";

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet" ADD "balance" numeric NOT NULL DEFAULT '0'`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "balance"`);
  }
}
