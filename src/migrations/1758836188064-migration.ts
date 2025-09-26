import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1758836188064 implements MigrationInterface {
  name = "Migration1758836188064";

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transfer" DROP CONSTRAINT "FK_f290f07aeb63d612e3622ab8543"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer" DROP CONSTRAINT "FK_1f76ac7cc21b558911433ecf15a"`,
    );
    await queryRunner.query(`DROP TABLE "transfer"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "transfer" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "fromWalletId" integer NOT NULL, "toWalletId" integer NOT NULL, "amount" numeric NOT NULL, "idempotencyKey" character varying, "txId" character varying, "metadata" json, CONSTRAINT "PK_fd9ddbdd49a17afcbe014401295" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer" ADD CONSTRAINT "FK_1f76ac7cc21b558911433ecf15a" FOREIGN KEY ("fromWalletId") REFERENCES "wallet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "transfer" ADD CONSTRAINT "FK_f290f07aeb63d612e3622ab8543" FOREIGN KEY ("toWalletId") REFERENCES "wallet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
