import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1758835010813 implements MigrationInterface {
  name = "Migration1758835010813";

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ledger_idempotencyKey"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_ledger_txId"`);

    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_prevent_ledger_modification ON "ledger_entry"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_ledger_modification()`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ledger_wallet"`);

    await queryRunner.query(
      `ALTER TABLE "ledger_entry" DROP CONSTRAINT "FK_fe0c2aa0b8901c9162834737c0e"`,
    );
    await queryRunner.query(`ALTER TABLE "wallet" DROP COLUMN "version"`);
    await queryRunner.query(`DROP TABLE "idempotency"`);
    await queryRunner.query(`DROP TABLE "ledger_entry"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ledger_entry" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "amount" numeric NOT NULL, "idempotencyKey" character varying, "metadata" json, "txId" character varying, "type" character varying NOT NULL, "walletId" integer NOT NULL, CONSTRAINT "PK_04e9d274911f909a5848a15cd74" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "idempotency" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "key" character varying NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "response" json, "processedAt" TIMESTAMP, CONSTRAINT "UQ_7db4ecce9e7d787fe8fb72ad97f" UNIQUE ("key"), CONSTRAINT "PK_cec40256e4ef03c10eef53aa729" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet" ADD "version" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "ledger_entry" ADD CONSTRAINT "FK_fe0c2aa0b8901c9162834737c0e" FOREIGN KEY ("walletId") REFERENCES "wallet"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`CREATE OR REPLACE FUNCTION prevent_ledger_modification() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'ledger_entry is append-only and cannot be modified or deleted';
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;`);

    await queryRunner.query(`CREATE TRIGGER trg_prevent_ledger_modification
      BEFORE UPDATE OR DELETE ON "ledger_entry"
      FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();`);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ledger_txId" ON "ledger_entry" ("txId") WHERE "txId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_ledger_idempotencyKey" ON "ledger_entry" ("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ledger_wallet" ON "ledger_entry" ("walletId")`,
    );
  }
}
