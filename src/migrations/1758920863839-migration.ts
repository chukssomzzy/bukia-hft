import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1758920863839 implements MigrationInterface {
  name = "Migration1758920863839";

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_audit_log"`);
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_prevent_admin_audit_log_modification ON "admin_audit_log"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS prevent_admin_audit_log_modification()`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "admin_audit_log" ("action" character varying NOT NULL, "adminUserId" integer NOT NULL, "details" jsonb, "id" SERIAL NOT NULL, "ipAddress" character varying, "targetUserId" integer, "timestamp" character varying NOT NULL, CONSTRAINT "PK_9425be48a9c753f5753017c61b2" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(`CREATE OR REPLACE FUNCTION prevent_admin_audit_log_modification() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'admin_audit_log is append-only and cannot be modified or deleted';
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql;`);

    await queryRunner.query(`CREATE TRIGGER trg_prevent_admin_audit_log_modification
      BEFORE UPDATE OR DELETE ON "admin_audit_log"
      FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_modification();`);
  }
}
