import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1758827130248 implements MigrationInterface {
  name = "Migration1758827130248";

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "wallet" DROP CONSTRAINT "FK_35472b1fe48b6330cd349709564"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_9466682df91534dd95e4dbaa616"`,
    );
    await queryRunner.query(`DROP TABLE "wallet"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_31ef2b4d30675d0c15056b7f6e"`,
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "user_profile"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_profile" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "avatarUrl" character varying, "deletedAt" TIMESTAMP, "firstName" character varying NOT NULL, "lastName" character varying NOT NULL, "version" integer NOT NULL, CONSTRAINT "PK_f44d0cd18cfd80b0fed7806c3b7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "country" character varying NOT NULL, "deletedAt" TIMESTAMP, "email" character varying NOT NULL, "isverified" boolean NOT NULL DEFAULT false, "jwtVersion" integer NOT NULL DEFAULT '0', "password" character varying, "type" character varying NOT NULL, "profileId" integer, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "REL_9466682df91534dd95e4dbaa61" UNIQUE ("profileId"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_31ef2b4d30675d0c15056b7f6e" ON "user" ("type") `,
    );
    await queryRunner.query(
      `CREATE TABLE "wallet" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "balance" numeric NOT NULL DEFAULT '0', "currency" character varying NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "metadata" json, "userId" integer NOT NULL, CONSTRAINT "PK_bec464dd8d54c39c54fd32e2334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_9466682df91534dd95e4dbaa616" FOREIGN KEY ("profileId") REFERENCES "user_profile"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet" ADD CONSTRAINT "FK_35472b1fe48b6330cd349709564" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
